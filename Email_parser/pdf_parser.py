#!/usr/bin/env python3
"""
pdf_parser.py — OBD-II Diagnostic PDF Data Extractor
=====================================================
Extracts structured vehicle info and DTC error code table from a validated
OBD-II diagnostic scanner PDF (LAUNCH X-431 and compatible formats).

Usage:
    py Email_parser/pdf_parser.py <pdf_path>

Output (JSON to stdout):
    {
      "scanner_tool": "LAUNCH X-431",
      "scanner_software": "V8.00.027",
      "report_date": "2026-09-17T11:38:14",
      "vehicle_info": {
        "vin": null,
        "plate": null,
        "make": "Hyundai",
        "model": "Tucson",
        "year": 2018,
        "engine": "2.0L",
        "mileage": 72340.0
      },
      "dtc_codes": [
        {"code": "P0115", "description": "Engine Coolant Temp Circuit", "state": "Current", "system": "Engine"},
        {"code": "C1234", "description": "ABS Wheel Speed Sensor",     "state": "History", "system": "Brakes"}
      ]
    }
"""

import sys
import os
import json
import re
from datetime import datetime
from typing import Optional

import pdfplumber  # type: ignore


# ---------------------------------------------------------------------------
# Regex helpers
# ---------------------------------------------------------------------------

# Matches dates like: 2026-09-17 11:38:14AM  /  2026-09-17 11:38:14  /  DATE:2026-09-17...
DATE_PATTERNS = [
    r"(\d{4}-\d{2}-\d{2}[\s:T]\d{2}:\d{2}:\d{2}(?:AM|PM)?)",
    r"DATE[:\s]+(\d{4}-\d{2}-\d{2}(?:[\sT]\d{2}:\d{2}:\d{2})?)",
]

# Software version like V8.00.027 or V50.75
SOFTWARE_PATTERN = r"(?:Diagnostic Application Version:|Vehicle Software Version:)?\s*\b(V\d+(?:\.\d+)+)\b"

# DTC code patterns: P/C/B/U + 4 or more alphanumeric characters, optional failure bytes e.g. P2887:68-08, C140158
DTC_CODE_PATTERN = re.compile(r"\b([PCBU][0-9A-Z]{4,}(?:[:\-][0-9A-Z\-]+)?)\b", re.IGNORECASE)

# Known vehicle make dictionary for fallback inference from filename
KNOWN_MAKES = {
    "usaford": "Ford",
    "ford": "Ford",
    "toyota": "Toyota",
    "honda": "Honda",
    "hyundai": "Hyundai",
    "nissan": "Nissan",
    "mitsubishi": "Mitsubishi",
    "isuzu": "Isuzu",
    "mazda": "Mazda",
    "suzuki": "Suzuki",
    "chevrolet": "Chevrolet",
    "chevy": "Chevrolet",
    "kia": "Kia",
    "bmw": "BMW",
    "mercedes": "Mercedes-Benz",
    "benz": "Mercedes-Benz",
    "subaru": "Subaru",
    "audi": "Audi",
    "volkswagen": "Volkswagen",
    "vw": "Volkswagen",
    "lexus": "Lexus",
    "chery": "Chery",
    "geely": "Geely",
    "mg": "MG",
    "foton": "Foton",
}

# Vehicle info label → field name mapping
VEHICLE_FIELD_MAP = {
    r"(?:license|plate|licence)\s*(?:#|number|no\.?)?": "plate",
    r"\bvin\b": "vin",
    r"\byear\b": "year",
    r"\bmake\b": "make",
    r"\bmodel\b": "model",
    r"\bengine\b": "engine",
    r"mileage|odometer|km": "mileage",
}

# Known scanner tool names to look for in the PDF header
SCANNER_TOOLS = ["LAUNCH X-431", "LAUNCH X431", "Autel", "TOPDON", "LAUNCH", "Foxwell", "Thinkcar"]


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _extract_text_all(doc) -> str:
    """Concatenate text from all pages."""
    parts = []
    for page in doc.pages:
        text = page.extract_text() or ""
        parts.append(text)
    return "\n".join(parts)


def _parse_date(text: str) -> Optional[str]:
    """Extract and normalise the first date found in text."""
    for pattern in DATE_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            raw = m.group(1).strip()
            # Normalise AM/PM suffix
            raw_clean = re.sub(r"(AM|PM)$", "", raw, flags=re.IGNORECASE).strip()
            # Replace space separator with T for ISO format
            raw_iso = re.sub(r"\s+", "T", raw_clean)
            try:
                dt = datetime.fromisoformat(raw_iso)
                return dt.strftime("%Y-%m-%dT%H:%M:%S")
            except ValueError:
                return raw
    return None


def _parse_scanner_tool(text: str) -> Optional[str]:
    """Detect scanner tool name from PDF text."""
    text_upper = text.upper()
    for tool in SCANNER_TOOLS:
        if tool.upper() in text_upper:
            return tool

    # LAUNCH X-431 layout signatures
    if any(sig in text for sig in [
        "Diagnostic Application Version:",
        "The Report is created by",
        "Diagnostic History",
        "Smart Detection",
    ]):
        return "LAUNCH X-431"

    return None


def _parse_software(text: str) -> Optional[str]:
    """Extract software version, favoring Diagnostic Application Version if present."""
    m_app = re.search(r"Diagnostic Application Version:\s*(\S+)", text, re.IGNORECASE)
    if m_app:
        return m_app.group(1).strip()

    m_veh = re.search(r"Vehicle Software Version:\s*(\S+)", text, re.IGNORECASE)
    if m_veh:
        return m_veh.group(1).strip()

    m = re.search(r"\b(V\d+(?:\.\d+)+)\b", text)
    return m.group(1) if m else None


def _parse_vehicle_info(text: str, filename: str = "") -> dict:
    """Extract vehicle fields from header text and/or filename if VIN is omitted."""
    info: dict[str, Optional[str | int | float]] = {
        "vin": None,
        "plate": None,
        "make": None,
        "model": None,
        "year": None,
        "engine": None,
        "mileage": None,
    }

    lines = text.splitlines()
    for line in lines:
        for pattern, field in VEHICLE_FIELD_MAP.items():
            if re.search(pattern, line, re.IGNORECASE):
                # Value is typically after a colon or tab
                parts = re.split(r"[:\t]+", line, maxsplit=1)
                if len(parts) == 2:
                    value = parts[1].strip()
                    if value and value.lower() not in ("n/a", "none", "-", "---", "null", "undefined", ""):
                        if field == "year":
                            m = re.search(r"\b(19\d{2}|20\d{2})\b", value)
                            info["year"] = int(m.group(1)) if m else None
                        elif field == "mileage":
                            m = re.search(r"[\d,]+(?:\.\d+)?", value.replace(",", ""))
                            info["mileage"] = float(m.group()) if m else None
                        elif field == "vin":
                            # Standard VIN is 17 alphanumeric characters (no I, O, Q)
                            m = re.search(r"\b([A-HJ-NPR-Z0-9]{17})\b", value, re.IGNORECASE)
                            info["vin"] = m.group(1).upper() if m else None
                        else:
                            info[field] = value

    # Secondary inspection: check User Operation path e.g.
    # "Vehicle Select > FORD > Vehicle = Territory > Capacity = 2.7L > Engine Type = Direct Injection"
    if not info["model"]:
        m_mod = re.search(r"Vehicle\s*=\s*([A-Za-z0-9\-_ ]+?)(?:\s*>|\s*$)", text, re.IGNORECASE)
        if m_mod:
            info["model"] = m_mod.group(1).strip()

    if not info["engine"]:
        m_cap = re.search(r"Capacity\s*=\s*([A-Za-z0-9\.\-_ ]+?)(?:\s*>|\s*$)", text, re.IGNORECASE)
        if m_cap:
            info["engine"] = m_cap.group(1).strip()

    # Fallback to infer make from filename if header had no make (common when VIN is omitted)
    if not info["make"] and filename:
        fn_clean = os.path.splitext(os.path.basename(filename))[0].lower()
        for prefix, make_name in KNOWN_MAKES.items():
            if fn_clean.startswith(prefix) or f"_{prefix}_" in f"_{fn_clean}_":
                info["make"] = make_name
                break

    return info


def _extract_dtc_table(doc) -> list[dict]:
    """
    Extract DTC rows from tables or column layouts across all pages.
    1. First tries standard vector table extraction (Autel, Topdon).
    2. If no records found, uses column coordinate bounding for borderless layouts (Launch X-431).
    3. Falls back to regex scanning if needed.
    """
    dtc_records = []

    # Strategy 1: Standard vector tables with borders
    for page in doc.pages:
        tables = page.extract_tables() or []
        for table in tables:
            if not table or len(table) < 2:
                continue

            header = [str(cell).lower().strip() if cell else "" for cell in table[0]]
            if not any("dtc" in h or "code" in h or "fault" in h for h in header):
                continue

            col = {}
            for i, h in enumerate(header):
                if "dtc" in h or "code" in h or "fault" in h:
                    col.setdefault("code", i)
                elif "desc" in h or "name" in h or "definition" in h:
                    col.setdefault("description", i)
                elif "state" in h or "status" in h or "type" in h:
                    col.setdefault("state", i)
                elif "system" in h or "module" in h or "ecu" in h:
                    col.setdefault("system", i)

            for row in table[1:]:
                if not row:
                    continue
                code_val = str(row[col.get("code", 0)] or "").strip()
                if not DTC_CODE_PATTERN.match(code_val):
                    continue
                dtc_records.append({
                    "code": code_val.upper(),
                    "description": str(row[col.get("description", 1)] or "").strip() or None,
                    "state": str(row[col.get("state", 2)] or "").strip() or None,
                    "system": str(row[col.get("system", 3)] or "").strip() or None,
                })

    # Strategy 2: Borderless text column layout (standard in Launch X-431 reports)
    if not dtc_records:
        for page_idx, page in enumerate(doc.pages):
            words = page.extract_words()
            # Look for DTC codes positioned in the leftmost column (x0 < 100)
            code_words = []
            for w in words:
                text = w['text'].strip()
                if w['x0'] < 100 and DTC_CODE_PATTERN.match(text):
                    code_words.append(w)

            if not code_words:
                continue

            # Calculate vertical boundaries for each code row
            for i, cw in enumerate(code_words):
                if i == 0:
                    prev_top = 0
                    for w in words:
                        if w['text'] in ['DTC', 'Description', 'State', 'System'] and w['top'] < cw['top']:
                            prev_top = max(prev_top, w['bottom'])
                    row_top = prev_top if prev_top > 0 else (cw['top'] - 12)
                else:
                    row_top = (code_words[i-1]['top'] + cw['top']) / 2

                if i + 1 < len(code_words):
                    row_bottom = (cw['top'] + code_words[i+1]['top']) / 2
                else:
                    row_bottom = 9999

                # Segment words across columns:
                # Column 1: DTC Code (x0 < 95)
                # Column 2: Description (95 <= x0 < 295)
                # Column 3: State (295 <= x0 < 405)
                # Column 4: System (x0 >= 405)
                row_words = [w for w in words if row_top <= w['top'] < row_bottom]
                desc_words = [w['text'] for w in row_words if 95 <= w['x0'] < 295]
                state_words = [w['text'] for w in row_words if 295 <= w['x0'] < 405]
                sys_words = [w['text'] for w in row_words if w['x0'] >= 405]

                desc = " ".join(desc_words).replace("||", " ").replace("|", " ").strip()
                desc = re.sub(r'\s+', ' ', desc)
                state = re.sub(r'\s+', ' ', " ".join(state_words)).strip()
                system = re.sub(r'\s+', ' ', " ".join(sys_words)).strip()

                dtc_records.append({
                    "code": cw['text'].upper(),
                    "description": desc or None,
                    "state": state or None,
                    "system": system or None,
                })

    # Strategy 3: Fallback regex scan of raw text if structured extraction found nothing
    if not dtc_records:
        all_text = _extract_text_all(doc)
        for m in DTC_CODE_PATTERN.finditer(all_text):
            dtc_records.append({
                "code": m.group(1).upper(),
                "description": None,
                "state": None,
                "system": None,
            })
        # Deduplicate
        seen = set()
        unique = []
        for r in dtc_records:
            if r["code"] not in seen:
                seen.add(r["code"])
                unique.append(r)
        dtc_records = unique

    return dtc_records


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse(pdf_path: str) -> dict:
    filename = os.path.basename(pdf_path)
    with pdfplumber.open(pdf_path) as doc:
        full_text = _extract_text_all(doc)

        result = {
            "scanner_tool": _parse_scanner_tool(full_text),
            "scanner_software": _parse_software(full_text),
            "report_date": _parse_date(full_text),
            "vehicle_info": _parse_vehicle_info(full_text, filename=filename),
            "dtc_codes": _extract_dtc_table(doc),
        }

    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: pdf_parser.py <pdf_path>"}))
        sys.exit(1)

    try:
        output = parse(sys.argv[1])
        print(json.dumps(output, ensure_ascii=False, indent=2))
        sys.exit(0)
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)

