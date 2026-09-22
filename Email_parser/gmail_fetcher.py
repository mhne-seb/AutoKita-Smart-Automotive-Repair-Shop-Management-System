#!/usr/bin/env python3
"""
gmail_fetcher.py — Gmail IMAP Diagnostic Report Fetcher
========================================================
Connects to the shop Gmail inbox via IMAP SSL, fetches UNSEEN emails,
fact-checks each attachment, and POSTs validated diagnostic reports
to /api/diagnostics/store.

Configuration via environment variables (or .env.local):
    GMAIL_EMAIL         — e.g. proserv.autokita@gmail.com
    GMAIL_APP_PASSWORD  — 16-character Google App Password (no spaces)
    NEXT_PUBLIC_APP_URL — e.g. http://localhost:3000 (for API calls)
    DIAGNOSTICS_API_KEY — Secret key to authenticate internal API calls

Usage:
    py Email_parser/gmail_fetcher.py
"""

import imaplib
import email
import email.header
import os
import sys
import json
import tempfile
import subprocess
import urllib.request
import urllib.parse

from pathlib import Path
from email.message import Message


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
ENV_PATH   = SCRIPT_DIR.parent / ".env.local"

def _load_env():
    """Load .env.local into os.environ if it exists."""
    if ENV_PATH.exists():
        with open(ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

_load_env()

GMAIL_EMAIL        = os.environ.get("GMAIL_USER", "")       # matches GMAIL_USER in .env.local
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
APP_URL            = os.environ.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000")

# Localhost Next.js dev server runs over plain HTTP
if APP_URL.startswith("https://localhost") or APP_URL.startswith("https://127.0.0.1"):
    APP_URL = APP_URL.replace("https://", "http://", 1)

IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _decode_header(raw) -> str:
    """Decode email header value to a plain string."""
    parts = email.header.decode_header(raw or "")
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(str(part))
    return "".join(decoded)


def _get_pdf_attachments(msg: Message) -> list[tuple[str, bytes]]:
    """Return list of (filename, bytes) for all PDF attachments in the email."""
    attachments = []
    for part in msg.walk():
        content_disposition = part.get("Content-Disposition", "") or ""
        if "attachment" not in content_disposition.lower():
            continue
        filename = _decode_header(part.get_filename() or "")
        if not filename.lower().endswith(".pdf"):
            continue
        payload = part.get_payload(decode=True)
        if payload:
            attachments.append((filename, payload))
    return attachments


def _run_fact_check(pdf_path: str) -> dict:
    """Run fact_check.py and return parsed JSON result."""
    fact_check_script = str(SCRIPT_DIR / "fact_check.py")
    result = subprocess.run(
        ["py", "-3", fact_check_script, pdf_path],
        capture_output=True, text=True
    )
    try:
        return json.loads(result.stdout.strip())
    except json.JSONDecodeError:
        return {"valid": False, "reason": f"fact_check output error: {result.stdout}"}


def _run_parser(pdf_path: str) -> dict | None:
    """Run pdf_parser.py and return parsed JSON result."""
    parser_script = str(SCRIPT_DIR / "pdf_parser.py")
    result = subprocess.run(
        ["py", "-3", parser_script, pdf_path],
        capture_output=True, text=True
    )
    try:
        data = json.loads(result.stdout.strip())
        if "error" in data:
            print(f"  [!] Parser error: {data['error']}")
            return None
        return data
    except json.JSONDecodeError:
        print(f"  [!] Parser JSON parse error: {result.stdout}")
        return None


def _post_to_store(payload: dict, filename: str, pdf_bytes: bytes) -> bool:
    """POST parsed data to /api/diagnostics/store."""
    url = f"{APP_URL}/api/diagnostics/store"
    body = json.dumps({
        "source": "gmail",
        "filename": filename,
        "parsed": payload,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_body = resp.read().decode()
            print(f"  [OK] Stored -- API response: {resp_body[:120]}")
            return True
    except Exception as exc:
        print(f"  [X] Store API call failed: {exc}")
        return False


# ---------------------------------------------------------------------------
# Main fetch loop
# ---------------------------------------------------------------------------

def fetch_and_process():
    if not GMAIL_EMAIL or not GMAIL_APP_PASSWORD:
        print("[ERROR] GMAIL_EMAIL or GMAIL_APP_PASSWORD not set in environment / .env.local")
        sys.exit(1)

    print(f"[>>] Connecting to {IMAP_HOST} as {GMAIL_EMAIL}...")
    mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    mail.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
    mail.select("INBOX")

    # Search for UNSEEN emails only
    _, msg_ids_raw = mail.search(None, "UNSEEN")
    msg_ids = msg_ids_raw[0].split()
    print(f"[>>] Found {len(msg_ids)} unseen email(s).")

    stats = {"fetched": 0, "validated": 0, "skipped": 0, "stored": 0}

    with tempfile.TemporaryDirectory() as tmp_dir:
        for msg_id in msg_ids:
            try:
                # 1. Peek at headers first using BODY.PEEK so the IMAP server does not mark it as \Seen
                _, header_data = mail.fetch(msg_id, "(BODY.PEEK[HEADER.FIELDS (SUBJECT)] UID)")
                if not header_data or not header_data[0]:
                    continue

                header_raw = header_data[0][1]
                header_msg = email.message_from_bytes(header_raw)
                subject = _decode_header(header_msg.get("Subject", ""))
                imap_uid = msg_id.decode()

                # Filter: ONLY check emails whose subject contains "Diagnostic Report" (case-insensitive via lower())
                # This ensures unrelated emails in the inbox are never marked as read.
                if "diagnostic report" not in subject.lower():
                    mail.store(msg_id, "-FLAGS", "\\Seen")
                    continue

                stats["fetched"] += 1
                print(f"\n[Email] Subject: {subject!r} | UID: {imap_uid}")

                # 2. Fetch full message with BODY.PEEK so it stays unread until validation succeeds
                _, msg_data = mail.fetch(msg_id, "(BODY.PEEK[] UID)")
                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                # 3. Get PDF attachments
                attachments = _get_pdf_attachments(msg)
                if not attachments:
                    print("  [skip] No PDF attachments found. Regarded as not valid — marked as unread.")
                    mail.store(msg_id, "-FLAGS", "\\Seen")
                    stats["skipped"] += 1
                    continue

                processed_any = False

                for filename, pdf_bytes in attachments:
                    print(f"  [PDF] {filename}")
                    # Save to temp file
                    pdf_path = os.path.join(tmp_dir, filename)
                    with open(pdf_path, "wb") as f:
                        f.write(pdf_bytes)

                    # Fact-check
                    fc_result = _run_fact_check(pdf_path)
                    if not fc_result.get("valid"):
                        print(f"  [skip] Fact-check failed: {fc_result.get('reason')}")
                        stats["skipped"] += 1
                        continue

                    stats["validated"] += 1
                    print(f"  [OK] Fact-check passed: {fc_result.get('reason')}")

                    # Parse
                    parsed = _run_parser(pdf_path)
                    if parsed is None:
                        print(f"  [skip] Parser failed to extract data from {filename}")
                        stats["skipped"] += 1
                        continue

                    # Attach IMAP UID for deduplication
                    parsed["source_email_uid"] = imap_uid

                    # POST to store API
                    ok = _post_to_store(parsed, filename, pdf_bytes)
                    if ok:
                        stats["stored"] += 1
                        processed_any = True
                    else:
                        print(f"  [skip] Store API call failed for {filename}")
                        stats["skipped"] += 1

                # 4. Final status for this email:
                # If a valid diagnostic report was processed and stored, mark as read (\Seen).
                # If regarded as not valid (no valid attachments, fact-check failed, or couldn't store), mark as unread (-\Seen).
                if processed_any:
                    mail.store(msg_id, "+FLAGS", "\\Seen")
                    print(f"  [OK] Valid diagnostic report stored. Email {imap_uid} marked as read.")
                else:
                    mail.store(msg_id, "-FLAGS", "\\Seen")
                    print(f"  [!] Email {imap_uid} regarded as not valid. Marked as unread.")

            except Exception as e:
                print(f"  [ERROR] Error processing email {msg_id}: {e}")
                mail.store(msg_id, "-FLAGS", "\\Seen")
                stats["skipped"] += 1

    mail.logout()

    print(f"\n[Done] fetched={stats['fetched']} validated={stats['validated']} "
          f"stored={stats['stored']} skipped={stats['skipped']}")
    return stats


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    fetch_and_process()
