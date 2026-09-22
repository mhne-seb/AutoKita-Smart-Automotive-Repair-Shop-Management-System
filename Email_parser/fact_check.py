#!/usr/bin/env python3
"""
fact_check.py — OBD-II Diagnostic PDF Validator
================================================
Validates whether an email attachment is a genuine OBD-II diagnostic report PDF
before any parsing or storage takes place.

Usage:
    py Email_parser/fact_check.py <pdf_path>

Output (JSON to stdout):
    {"valid": true, "reason": "passed all checks"}
    {"valid": false, "reason": "keyword check failed (found 1/2 required keywords)"}
"""

import sys
import os
import json
import re


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Check 2: filename keywords (case-insensitive OR match)
# Matches diagnostic terms, scanners, and automotive makes/models commonly used
# when scanners export reports without a VIN (e.g. USAFORD_2026-08-27...pdf, Hyundai_Tucson.pdf)
FILENAME_KEYWORDS = [
    "diagnostic", "dtc", "obd", "launch", "x-431", "x431",
    "scan", "report", "autel", "topdon", "trouble",
    # Common vehicle makes & models (useful when scanner exports as MAKE_DATETIME)
    "ford", "usaford", "toyota", "honda", "hyundai", "nissan", "mitsubishi",
    "isuzu", "mazda", "suzuki", "chevrolet", "chevy", "kia", "bmw", "benz",
    "mercedes", "audi", "vw", "volkswagen", "subaru", "lexus", "territory",
    "ranger", "everest", "vios", "hilux", "innova", "fortuner", "montero",
]

# Regex: 17-char VIN embedded in filename (alphanumeric, no I/O/Q)
VIN_IN_FILENAME = re.compile(r'[A-HJ-NPR-Z0-9]{17}', re.IGNORECASE)

# Regex: datetime stamp in filename like 2026-08-27 or 20260827
DATE_IN_FILENAME = re.compile(r'20\d{2}[-_]?\d{2}[-_]?\d{2}')

# Regex: Scanner export pattern without VIN, e.g. USAFORD_2026-08-27112409AM or HYUNDAI_20260922
SCANNER_EXPORT_PATTERN = re.compile(r'^[A-Za-z0-9]+[-_]20\d{2}[-_]?\d{2}', re.IGNORECASE)

# Check 4: content keywords — must find at least MIN_CONTENT_KEYWORDS of these
CONTENT_KEYWORDS = [
    "dtc",
    "diagnostic",
    "diagnostic trouble code",
    "diagnostic history",
    "vehicle information",
    "launch",
    "engine",
    "system",
    "history",
    "current",
    "pending",
    "fault",
    "scanner",
    "continuous",
    "module",
]
MIN_CONTENT_KEYWORDS = 2

# Check 5: DTC table header or code candidates
DTC_TABLE_HEADERS = ["dtc", "code", "fault code", "diagnostic trouble code", "dtc description"]
DTC_CODE_REGEX = re.compile(r'\b[PCBU][0-9A-Z]{4,}(?:[:\-][0-9A-Z\-]+)?\b', re.IGNORECASE)


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------

def check_filename(pdf_path: str) -> tuple[bool, str]:
    """
    Check 2: filename heuristic.
    Passes if the filename contains:
      a) A known diagnostic or automotive keyword (diagnostic, launch, ford, hyundai, etc.), OR
      b) A VIN-like string (17 alphanumeric chars), OR
      c) A scanner export pattern (e.g. MAKE_DATETIME) even without a VIN:
         USAFORD_2026-08-27112409AM.pdf
    """
    basename = os.path.basename(pdf_path).lower()
    stem = os.path.splitext(basename)[0]  # strip .pdf

    # Option A: keyword match
    for kw in FILENAME_KEYWORDS:
        if kw in basename:
            return True, f"filename contains recognized keyword '{kw}'"

    # Option B: VIN embedded in filename
    has_vin  = bool(VIN_IN_FILENAME.search(stem))
    has_date = bool(DATE_IN_FILENAME.search(stem))
    if has_vin and has_date:
        return True, "filename matches scanner export pattern (VIN + date)"
    if has_vin:
        return True, "filename contains a VIN-like identifier"

    # Option C: Scanner export pattern without VIN (MAKE_DATE)
    if SCANNER_EXPORT_PATTERN.search(stem):
        return True, "filename matches scanner export pattern without VIN (Make + date)"

    return False, f"filename '{basename}' has no standard diagnostic or VIN prefix"


def check_readable(pdf_path: str):
    """Check 3: PDF must open and have at least one readable page. Returns (ok, reason, doc)."""
    try:
        import pdfplumber  # type: ignore
        doc = pdfplumber.open(pdf_path)
        if len(doc.pages) == 0:
            doc.close()
            return False, "PDF has 0 pages", None
        return True, f"PDF opened successfully ({len(doc.pages)} pages)", doc
    except Exception as exc:
        return False, f"pdfplumber failed to open PDF: {exc}", None


def check_keywords(doc, pages: int = 3) -> tuple[bool, str]:
    """Check 4: first N pages must contain MIN_CONTENT_KEYWORDS distinct keywords."""
    text = ""
    for page in doc.pages[:pages]:
        extracted = page.extract_text() or ""
        text += extracted.lower() + "\n"

    found = [kw for kw in CONTENT_KEYWORDS if kw in text]
    if len(found) >= MIN_CONTENT_KEYWORDS:
        return True, f"found {len(found)} keywords: {found[:5]}"
    return (
        False,
        f"keyword check failed (found {len(found)}/{MIN_CONTENT_KEYWORDS} required): {found}",
    )


def check_dtc_table(doc) -> tuple[bool, str]:
    """
    Check 5: detects DTC data via:
      1. Standard table extraction (Autel, Topdon, generic), OR
      2. Column text headers / DTC patterns (Launch X-431 borderless layouts).
    """
    # 1. Vector table check
    for page in doc.pages:
        tables = page.extract_tables() or []
        for table in tables:
            if not table:
                continue
            header_row = [str(cell).lower().strip() if cell else "" for cell in table[0]]
            for cell in header_row:
                for dtc_kw in DTC_TABLE_HEADERS:
                    if dtc_kw in cell:
                        return True, f"DTC table header detected: '{cell}'"

    # 2. Text layout / DTC code presence check (for Launch X-431 borderless tables)
    for page in doc.pages:
        text = page.extract_text() or ""
        text_lower = text.lower()
        # Look for DTC column header in text
        if "dtc description" in text_lower or ("dtc" in text_lower and "state" in text_lower and "system" in text_lower):
            return True, "DTC column header detected in layout text"
        # Look for standard DTC codes in text
        matches = DTC_CODE_REGEX.findall(text)
        if len(matches) > 0:
            return True, f"detected {len(matches)} OBD-II DTC code(s) in report"

    return False, "no DTC table or fault codes detected"


# ---------------------------------------------------------------------------
# Main validation pipeline
# ---------------------------------------------------------------------------

def validate(pdf_path: str) -> dict:
    """
    Run validation pipeline.
    Resilient to diagnostic reports that do not include a VIN in the filename.
    """
    # Check 1: file exists and is a PDF
    if not os.path.isfile(pdf_path):
        return {"valid": False, "reason": f"file not found: {pdf_path}"}
    if not pdf_path.lower().endswith(".pdf"):
        return {"valid": False, "reason": "attachment is not a .pdf file"}

    # Check 2: filename heuristic (non-fatal if content proves it is diagnostic)
    filename_ok, filename_reason = check_filename(pdf_path)

    # Check 3: PDF is readable
    ok, reason, doc = check_readable(pdf_path)
    if not ok:
        return {"valid": False, "reason": reason}

    try:
        # Check 4: keyword presence (required to store)
        kw_ok, kw_reason = check_keywords(doc)

        # Check 5: DTC table or code detection
        dtc_ok, dtc_reason = check_dtc_table(doc)

        # Decision logic:
        # If content has diagnostic keywords and DTC codes/headers, it IS a diagnostic report
        # regardless of whether the filename had a VIN or known prefix!
        if kw_ok and dtc_ok:
            return {
                "valid": True,
                "reason": "passed content and DTC validation",
                "filename_checked": filename_reason,
                "has_dtc_table": dtc_ok,
                "dtc_table_reason": dtc_reason,
            }

        # If filename was recognized and at least keywords passed:
        if filename_ok and kw_ok:
            return {
                "valid": True,
                "reason": f"passed ({filename_reason}, {kw_reason})",
                "has_dtc_table": dtc_ok,
                "dtc_table_reason": dtc_reason,
            }

        # Otherwise reject
        if not filename_ok:
            return {"valid": False, "reason": f"unrecognized filename and {kw_reason}"}
        return {"valid": False, "reason": kw_reason}

    finally:
        doc.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"valid": False, "reason": "usage: fact_check.py <pdf_path>"}))
        sys.exit(1)

    result = validate(sys.argv[1])
    print(json.dumps(result))
    sys.exit(0 if result["valid"] else 1)

