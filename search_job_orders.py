#!/usr/bin/env python3
"""
AutoKita Job Order Item Search Tool
====================================
Searches for services or parts across all job order JSON extracts using
intelligent fuzzy and semantic similarity matching.

Features:
- Typo-resilient fuzzy matching (e.g. "brak pad" -> "Brake Pad")
- Word-order independent matching (e.g. "oil change" -> "Change oil")
- Substring & acronym matching (e.g. "egr", "atf")
- Filter by type (services, parts, or all)
- Filter by vehicle make/model/year
- Grouped summary view (frequency, price range, vehicles) or Detailed occurrence view
- JSON export option for automation/integration
- Interactive mode when run without arguments

Usage:
  py search_job_orders.py "brake pad"
  py search_job_orders.py "oil change" --type services
  py search_job_orders.py "filter" --detailed
  py search_job_orders.py --interactive
"""

import os
import sys
import glob
import json
import difflib
import re
import argparse
from pathlib import Path
from collections import defaultdict
from typing import List, Dict, Any, Tuple, Optional

# Enable VT100 colors on Windows terminals
if sys.platform == "win32":
    os.system("")
    # Ensure stdout handles UTF-8 nicely
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")


# Terminal Color Styling
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    UNDERLINE = "\033[4m"
    
    # Text colors
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    GRAY = "\033[90m"
    
    # Background colors
    BG_BLUE = "\033[44m"
    BG_MAGENTA = "\033[45m"
    BG_DARK = "\033[100m"

    @classmethod
    def score_color(cls, score: float) -> str:
        if score >= 0.85:
            return cls.GREEN
        elif score >= 0.70:
            return cls.YELLOW
        elif score >= 0.55:
            return cls.CYAN
        return cls.GRAY

    @classmethod
    def type_badge(cls, item_type: str) -> str:
        if item_type.lower() == "service":
            return f"{cls.MAGENTA}[SERVICE]{cls.RESET}"
        return f"{cls.BLUE}[PART   ]{cls.RESET}"


def normalize(text: str) -> str:
    """Lowercase and strip non-alphanumeric characters for clean tokenization."""
    if not text:
        return ""
    return re.sub(r"[^a-z0-9\s]", " ", text.lower()).strip()


def compute_similarity(query: str, target: str) -> float:
    """
    Computes a composite similarity score between query and target string (0.0 to 1.0).
    Resilient to:
    - Typos (Levenshtein/difflib ratio)
    - Word-order differences ("oil change" vs "change oil")
    - Substring containment ("aircon" in "Aircon Cabin Filter")
    - Extra words ("spark plug" in "Spark Plug (Iridium - Long Tip)")
    """
    q_raw = query.strip().lower()
    t_raw = target.strip().lower()
    if not q_raw or not t_raw:
        return 0.0

    # Exact match
    if q_raw == t_raw:
        return 1.0

    q_norm = normalize(query)
    t_norm = normalize(target)

    # Exact after removing punctuation/spacing
    if q_norm == t_norm:
        return 0.99

    q_tokens = [w for w in q_norm.split() if w]
    t_tokens = [w for w in t_norm.split() if w]
    if not q_tokens or not t_tokens:
        return 0.0

    candidate_scores = []

    # 1. Word-boundary aware Substring Containment
    if len(q_norm) >= 2:
        pattern_word = r"\b" + re.escape(q_norm) + r"\b"
        pattern_prefix = r"\b" + re.escape(q_norm)
        if re.search(pattern_word, t_norm):
            ratio = len(q_norm) / len(t_norm)
            candidate_scores.append(0.88 + 0.10 * ratio)
        elif re.search(pattern_prefix, t_norm):
            ratio = len(q_norm) / len(t_norm)
            candidate_scores.append(0.80 + 0.16 * ratio)
        elif len(q_norm) >= 4 and q_norm in t_norm:
            ratio = len(q_norm) / len(t_norm)
            candidate_scores.append(0.50 + 0.35 * ratio)

    # 2. Token Set Containment (all query words present in target words)
    q_set = set(q_tokens)
    t_set = set(t_tokens)
    if q_set.issubset(t_set):
        coverage = len(q_set) / len(t_set)
        candidate_scores.append(0.88 + 0.10 * coverage)

    # 3. Order-independent token sequence match
    q_sorted = " ".join(sorted(q_tokens))
    t_sorted = " ".join(sorted(t_tokens))
    candidate_scores.append(difflib.SequenceMatcher(None, q_sorted, t_sorted).ratio() * 0.96)

    # 4. Difflib direct normalized sequence ratio
    candidate_scores.append(difflib.SequenceMatcher(None, q_norm, t_norm).ratio())

    # 5. Fuzzy per-token alignment (handles typos, prefixes, & partial words)
    token_scores = []
    for qt in q_tokens:
        best_token_match = 0.0
        for tt in t_tokens:
            if qt == tt:
                best_token_match = 1.0
                break
            # Prefix match (e.g. 'trans' in 'transmission', 'alter' in 'alternator')
            if len(qt) >= 3 and tt.startswith(qt):
                best_token_match = max(best_token_match, 0.82 + 0.14 * (len(qt) / len(tt)))
            elif len(tt) >= 3 and qt.startswith(tt):
                best_token_match = max(best_token_match, 0.78 + 0.14 * (len(tt) / len(qt)))
            # Suffix match (e.g. 'clean' in 'cleaning')
            elif len(qt) >= 4 and tt.endswith(qt):
                best_token_match = max(best_token_match, 0.76 + 0.14 * (len(qt) / len(tt)))

            min_len = min(len(qt), len(tt))
            threshold = 0.82 if min_len <= 3 else 0.72
            sm = difflib.SequenceMatcher(None, qt, tt).ratio()
            if sm >= threshold:
                best_token_match = max(best_token_match, sm)
        token_scores.append(best_token_match)

    avg_token_score = sum(token_scores) / len(token_scores)
    size_penalty = min(1.0, (len(q_tokens) / len(t_tokens)) ** 0.35)
    candidate_scores.append(avg_token_score * (0.70 + 0.30 * size_penalty))

    # 6. Acronym / Initialism boost (e.g. 'egr', 'atf', 'cvtf')
    if 2 <= len(q_raw) <= 4 and len(q_tokens) == 1 and len(t_tokens) >= 2:
        initials = "".join([w[0] for w in t_tokens if w])
        if q_raw == initials:
            candidate_scores.append(0.92)

    return min(1.0, max(candidate_scores))


def find_job_order_directory(custom_path: Optional[str] = None) -> Path:
    """Finds the path to src/data/job_order_extracts directory."""
    if custom_path:
        p = Path(custom_path)
        if p.is_dir():
            return p
        raise FileNotFoundError(f"Specified directory not found: {custom_path}")

    # Search candidates
    script_dir = Path(__file__).resolve().parent
    candidates = [
        Path.cwd() / "src" / "data" / "job_order_extracts",
        script_dir / "src" / "data" / "job_order_extracts",
        script_dir / ".." / "src" / "data" / "job_order_extracts",
        script_dir / "data" / "job_order_extracts",
    ]

    for candidate in candidates:
        if candidate.resolve().is_dir():
            return candidate.resolve()

    # Search parent directory tree
    curr = script_dir
    for _ in range(3):
        possible = curr / "src" / "data" / "job_order_extracts"
        if possible.is_dir():
            return possible.resolve()
        curr = curr.parent

    raise FileNotFoundError("Could not find 'src/data/job_order_extracts' directory.")


def load_job_orders(data_dir: Path) -> List[Dict[str, Any]]:
    """Loads and parses all job order JSON extract files."""
    json_files = list(data_dir.glob("*.json"))
    job_orders = []

    for file_path in json_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                data["_file_name"] = file_path.name
                data["_file_path"] = str(file_path)
                job_orders.append(data)
        except Exception as e:
            # Skip invalid or corrupt JSON files gracefully
            continue

    return job_orders


def format_vehicle(veh: Optional[Dict[str, Any]]) -> str:
    """Returns a clean display string for vehicle info."""
    if not veh or not isinstance(veh, dict):
        return "Unknown Vehicle"
    make = str(veh.get("make") or "").strip()
    model = str(veh.get("model") or "").strip()
    year = str(veh.get("year") or "").strip()

    parts = [p for p in [year, make, model] if p]
    return " ".join(parts) if parts else "Unknown Vehicle"


def search_items(
    job_orders: List[Dict[str, Any]],
    query: str,
    item_type: str = "all",  # 'all', 'services', 'parts'
    min_score: float = 0.50,
    vehicle_filter: Optional[str] = None,
    include_only_active: bool = False,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Searches all job orders for items matching query.
    Returns:
      (grouped_results, individual_occurrences)
    """
    occurrences = []
    norm_query = query.strip().lower()

    # Determine categories to inspect
    check_services = item_type.lower() in ("all", "services", "service", "s")
    check_parts = item_type.lower() in ("all", "parts", "part", "p")

    norm_vehicle_filter = vehicle_filter.strip().lower() if vehicle_filter else None

    for jo in job_orders:
        veh_str = format_vehicle(jo.get("vehicle"))
        if norm_vehicle_filter and norm_vehicle_filter not in veh_str.lower():
            continue

        file_name = jo.get("_file_name", "")
        approved_at = jo.get("approved_at", "")
        grand_total = jo.get("grand_total", 0)

        # Inspect Services
        if check_services:
            for s in jo.get("services", []):
                if not isinstance(s, dict):
                    continue
                name = (s.get("name") or "").strip()
                if not name:
                    continue
                if include_only_active and s.get("include") is False:
                    continue

                sim = compute_similarity(norm_query, name)
                if sim >= min_score:
                    unit_price = float(s.get("unit_price") or 0.0)
                    qty = float(s.get("quantity") or 1.0)
                    total = float(s.get("total") or (unit_price * qty))
                    occurrences.append({
                        "type": "service",
                        "name": name,
                        "similarity": sim,
                        "unit_price": unit_price,
                        "quantity": qty,
                        "total": total,
                        "include": s.get("include", True),
                        "vehicle": veh_str,
                        "file_name": file_name,
                        "approved_at": approved_at,
                        "grand_total": grand_total,
                    })

        # Inspect Parts
        if check_parts:
            for p in jo.get("parts", []):
                if not isinstance(p, dict):
                    continue
                name = (p.get("name") or "").strip()
                if not name:
                    continue
                if include_only_active and p.get("include") is False:
                    continue

                sim = compute_similarity(norm_query, name)
                if sim >= min_score:
                    unit_price = float(p.get("unit_price") or 0.0)
                    qty = float(p.get("quantity") or 1.0)
                    total = float(p.get("total") or (unit_price * qty))
                    occurrences.append({
                        "type": "part",
                        "name": name,
                        "similarity": sim,
                        "unit_price": unit_price,
                        "quantity": qty,
                        "total": total,
                        "include": p.get("include", True),
                        "vehicle": veh_str,
                        "file_name": file_name,
                        "approved_at": approved_at,
                        "grand_total": grand_total,
                    })

    # Sort occurrences by similarity score descending, then price descending
    occurrences.sort(key=lambda x: (x["similarity"], x["unit_price"]), reverse=True)

    # Aggregate by (item_type, normalized_name)
    grouped_dict = {}
    for occ in occurrences:
        key = (occ["type"], normalize(occ["name"]))
        if key not in grouped_dict:
            grouped_dict[key] = {
                "type": occ["type"],
                "normalized_name": normalize(occ["name"]),
                "display_names": defaultdict(int),
                "max_similarity": occ["similarity"],
                "occurrences_count": 0,
                "total_quantity": 0.0,
                "prices": [],
                "vehicles": set(),
                "file_names": set(),
                "occurrences": [],
            }
        g = grouped_dict[key]
        g["display_names"][occ["name"]] += 1
        g["max_similarity"] = max(g["max_similarity"], occ["similarity"])
        g["occurrences_count"] += 1
        g["total_quantity"] += occ["quantity"]
        if occ["unit_price"] > 0:
            g["prices"].append(occ["unit_price"])
        if occ["vehicle"] and occ["vehicle"] != "Unknown Vehicle":
            g["vehicles"].add(occ["vehicle"])
        g["file_names"].add(occ["file_name"])
        g["occurrences"].append(occ)

    grouped_list = []
    for g in grouped_dict.values():
        # Pick the most commonly used casing as canonical display name
        canonical_name = max(g["display_names"].items(), key=lambda item: item[1])[0]
        prices = g["prices"]
        min_p = min(prices) if prices else 0.0
        max_p = max(prices) if prices else 0.0
        avg_p = (sum(prices) / len(prices)) if prices else 0.0

        grouped_list.append({
            "type": g["type"],
            "name": canonical_name,
            "similarity": g["max_similarity"],
            "count": g["occurrences_count"],
            "total_quantity": g["total_quantity"],
            "min_price": min_p,
            "max_price": max_p,
            "avg_price": avg_p,
            "vehicles": sorted(list(g["vehicles"])),
            "sample_files": sorted(list(g["file_names"]))[:3],
            "occurrences": g["occurrences"],
        })

    # Sort grouped list by similarity descending, then frequency count descending
    grouped_list.sort(key=lambda x: (x["similarity"], x["count"]), reverse=True)

    return grouped_list, occurrences


def print_grouped_results(grouped_results: List[Dict[str, Any]], query: str, limit: int = 15):
    """Renders a clean, formatted table for grouped results."""
    total_found = len(grouped_results)
    if not grouped_results:
        print(f"\n{Colors.YELLOW}No services or parts found matching '{query}'.{Colors.RESET}")
        print(f"{Colors.DIM}Tip: Try shortening your search query or lowering the min score threshold.{Colors.RESET}\n")
        return

    shown = grouped_results[:limit] if limit > 0 else grouped_results

    print(f"\n{Colors.BOLD}{Colors.WHITE}Search Results for:{Colors.RESET} {Colors.CYAN}\"{query}\"{Colors.RESET} "
          f"({total_found} unique items found, showing {len(shown)})\n")

    header = f"{'TYPE':<9} {'SCORE':<7} {'NAME':<36} {'COUNT':<7} {'AVG PRICE':<12} {'PRICE RANGE':<20}"
    divider = "─" * 94
    print(f"{Colors.GRAY}{header}{Colors.RESET}")
    print(f"{Colors.GRAY}{divider}{Colors.RESET}")

    for item in shown:
        badge = Colors.type_badge(item["type"])
        score_pct = f"{item['similarity'] * 100:5.1f}%"
        score_styled = f"{Colors.score_color(item['similarity'])}{score_pct}{Colors.RESET}"
        
        name_trunc = item["name"][:34] + ".." if len(item["name"]) > 34 else item["name"]
        count_str = f"{item['count']}x"
        
        avg_price_str = f"₱{item['avg_price']:,.2f}" if item["avg_price"] > 0 else "-"
        if item["min_price"] == item["max_price"] and item["min_price"] > 0:
            range_str = f"₱{item['min_price']:,.2f}"
        elif item["max_price"] > 0:
            range_str = f"₱{item['min_price']:,.0f} - ₱{item['max_price']:,.0f}"
        else:
            range_str = "-"

        row = f"{badge} {score_styled} {item['name']:<36} {count_str:<7} {avg_price_str:<12} {range_str:<20}"
        print(row)

        # Vehicle summary line
        if item["vehicles"]:
            veh_summary = ", ".join(item["vehicles"][:3])
            if len(item["vehicles"]) > 3:
                veh_summary += f" +{len(item['vehicles']) - 3} more"
            print(f"  {Colors.DIM}Vehicles: {veh_summary}{Colors.RESET}")

    print(f"{Colors.GRAY}{divider}{Colors.RESET}")
    if limit > 0 and total_found > limit:
        print(f"{Colors.DIM}Use --limit 0 to view all {total_found} items, or --detailed (-d) to inspect each job order.{Colors.RESET}\n")
    else:
        print(f"{Colors.DIM}Use --detailed (-d) to inspect individual job orders and source files.{Colors.RESET}\n")


def print_detailed_results(occurrences: List[Dict[str, Any]], query: str, limit: int = 20):
    """Renders detailed occurrences across specific job orders."""
    total_found = len(occurrences)
    if not occurrences:
        print(f"\n{Colors.YELLOW}No occurrences found matching '{query}'.{Colors.RESET}\n")
        return

    shown = occurrences[:limit] if limit > 0 else occurrences

    print(f"\n{Colors.BOLD}{Colors.WHITE}Detailed Job Order Matches for:{Colors.RESET} {Colors.CYAN}\"{query}\"{Colors.RESET} "
          f"({total_found} occurrences, showing {len(shown)})\n")

    for idx, occ in enumerate(shown, 1):
        badge = Colors.type_badge(occ["type"])
        score_pct = f"{occ['similarity'] * 100:5.1f}%"
        score_styled = f"{Colors.score_color(occ['similarity'])}{score_pct}{Colors.RESET}"

        status = "" if occ["include"] else f" {Colors.RED}[EXCLUDED]{Colors.RESET}"
        price_info = f"Qty: {occ['quantity']:.0f}  |  Unit: ₱{occ['unit_price']:,.2f}  |  Total: ₱{occ['total']:,.2f}"

        print(f"{Colors.BOLD}#{idx:<3}{Colors.RESET} {badge} {score_styled} {Colors.WHITE}{occ['name']}{Colors.RESET}{status}")
        print(f"     {Colors.CYAN}Vehicle:{Colors.RESET} {occ['vehicle']}")
        print(f"     {Colors.GREEN}Pricing:{Colors.RESET} {price_info}")
        print(f"     {Colors.GRAY}Source File:{Colors.RESET} {occ['file_name']}  {Colors.DIM}(Approved: {occ['approved_at'][:10] if occ['approved_at'] else 'N/A'}){Colors.RESET}")
        print(f"{Colors.GRAY}     {'─' * 60}{Colors.RESET}")

    if limit > 0 and total_found > limit:
        print(f"{Colors.DIM}Showing first {limit} of {total_found} occurrences. Use --limit 0 to display all.{Colors.RESET}\n")


def interactive_session(job_orders: List[Dict[str, Any]]):
    """Interactive command-line search loop."""
    total_orders = len(job_orders)
    total_services = sum(len(j.get("services", [])) for j in job_orders)
    total_parts = sum(len(j.get("parts", [])) for j in job_orders)

    current_type = "all"
    detailed_mode = False
    min_score = 0.50
    limit = 15
    vehicle_filter = None

    banner = (
        f"{Colors.BOLD}{Colors.GREEN}\n"
        r"   ___         __         __ __  _ __        " "\n"
        r"  / _ | __ __ / /_ ___   / //_/ (_) /_ ___ _ " "\n"
        r" / __ |/ // // __// _ \ / ,<   / / __// _ `/ " "\n"
        r"/_/ |_|\_,_/ \__/ \___//_/|_| /_/\__/ \_,_/  " "\n"
        f"{Colors.CYAN}Job Order Service & Part Fuzzy Search Engine{Colors.RESET}\n"
        "────────────────────────────────────────────────────────\n"
        f"Loaded: {Colors.BOLD}{total_orders}{Colors.RESET} job orders  |  "
        f"{Colors.BOLD}{total_services}{Colors.RESET} services  |  "
        f"{Colors.BOLD}{total_parts}{Colors.RESET} parts\n"
        "Type your search query (or 'help' for commands, 'exit' to quit).\n"
    )
    print(banner)

    while True:
        try:
            prompt_meta = f"[{current_type.upper()}|min:{int(min_score*100)}%"
            if detailed_mode:
                prompt_meta += "|detailed"
            if vehicle_filter:
                prompt_meta += f"|veh:{vehicle_filter}"
            prompt_meta += "]"

            raw = input(f"{Colors.BOLD}{Colors.MAGENTA}AutoKita {prompt_meta}> {Colors.RESET}").strip()
        except (KeyboardInterrupt, EOFError):
            print(f"\n{Colors.YELLOW}Exiting AutoKita search. Goodbye!{Colors.RESET}")
            break

        if not raw:
            continue

        cmd_lower = raw.lower()
        if cmd_lower in ("exit", "quit", "q"):
            print(f"{Colors.YELLOW}Exiting. Have a great day!{Colors.RESET}")
            break

        if cmd_lower in ("help", "?"):
            print(f"""
{Colors.BOLD}Interactive Commands:{Colors.RESET}
  {Colors.CYAN}<query>{Colors.RESET}             Search services and parts (e.g. 'oil change', 'brak pad', 'egr')
  {Colors.CYAN}type [all|s|p]{Colors.RESET}      Filter by all, services, or parts (e.g. 'type parts')
  {Colors.CYAN}detailed [on|off]{Colors.RESET}   Toggle individual job order breakdown
  {Colors.CYAN}min [score]{Colors.RESET}         Set minimum match % threshold (e.g. 'min 60')
  {Colors.CYAN}limit [number]{Colors.RESET}      Set maximum results to show (e.g. 'limit 25')
  {Colors.CYAN}vehicle [name]{Colors.RESET}      Filter by vehicle make or model (e.g. 'vehicle honda', 'vehicle clear')
  {Colors.CYAN}exit / quit{Colors.RESET}         Close search tool
""")
            continue

        # Check for interactive control commands
        if cmd_lower.startswith("type "):
            arg = cmd_lower.split(" ", 1)[1].strip()
            if arg in ("all", "services", "service", "s", "parts", "part", "p"):
                current_type = "services" if arg in ("services", "service", "s") else ("parts" if arg in ("parts", "part", "p") else "all")
                print(f"{Colors.GREEN}Search category set to: {current_type.upper()}{Colors.RESET}")
            else:
                print(f"{Colors.RED}Invalid category. Choose 'all', 'services', or 'parts'.{Colors.RESET}")
            continue

        if cmd_lower.startswith("detailed"):
            parts = cmd_lower.split()
            if len(parts) > 1 and parts[1] in ("off", "0", "false"):
                detailed_mode = False
            else:
                detailed_mode = True if len(parts) > 1 and parts[1] in ("on", "1", "true") else not detailed_mode
            print(f"{Colors.GREEN}Detailed mode: {'ON' if detailed_mode else 'OFF'}{Colors.RESET}")
            continue

        if cmd_lower.startswith("min "):
            val_str = cmd_lower.split(" ", 1)[1].strip().replace("%", "")
            try:
                val = float(val_str)
                if val > 1.0:
                    val = val / 100.0
                min_score = max(0.1, min(1.0, val))
                print(f"{Colors.GREEN}Minimum score set to: {int(min_score * 100)}%{Colors.RESET}")
            except ValueError:
                print(f"{Colors.RED}Please provide a valid number between 1 and 100.{Colors.RESET}")
            continue

        if cmd_lower.startswith("limit "):
            val_str = cmd_lower.split(" ", 1)[1].strip()
            try:
                limit = int(val_str)
                print(f"{Colors.GREEN}Display limit set to: {limit}{Colors.RESET}")
            except ValueError:
                print(f"{Colors.RED}Please provide a valid integer.{Colors.RESET}")
            continue

        if cmd_lower.startswith("vehicle "):
            v_arg = raw.split(" ", 1)[1].strip()
            if v_arg.lower() in ("clear", "none", "all", "reset"):
                vehicle_filter = None
                print(f"{Colors.GREEN}Vehicle filter cleared.{Colors.RESET}")
            else:
                vehicle_filter = v_arg
                print(f"{Colors.GREEN}Vehicle filter set to: '{vehicle_filter}'{Colors.RESET}")
            continue

        # Perform the search
        grouped, detailed = search_items(
            job_orders=job_orders,
            query=raw,
            item_type=current_type,
            min_score=min_score,
            vehicle_filter=vehicle_filter,
        )

        if detailed_mode:
            print_detailed_results(detailed, raw, limit=limit)
        else:
            print_grouped_results(grouped, raw, limit=limit)


def main():
    parser = argparse.ArgumentParser(
        description="Search services or parts within AutoKita job orders using fuzzy similarity matching."
    )
    parser.add_argument(
        "query",
        nargs="?",
        default=None,
        help="Search query text (e.g. 'oil change', 'brak pad', 'egr'). If omitted, starts interactive mode."
    )
    parser.add_argument(
        "-t", "--type",
        choices=["all", "services", "service", "parts", "part"],
        default="all",
        help="Filter results by item type (default: all)"
    )
    parser.add_argument(
        "-s", "--min-score",
        type=float,
        default=50.0,
        help="Minimum similarity score percentage between 1 and 100 (default: 50)"
    )
    parser.add_argument(
        "-n", "--limit",
        type=int,
        default=15,
        help="Maximum number of items to display (0 for all, default: 15)"
    )
    parser.add_argument(
        "-d", "--detailed",
        action="store_true",
        help="Show individual job order occurrences instead of aggregated summary"
    )
    parser.add_argument(
        "-v", "--vehicle",
        type=str,
        default=None,
        help="Filter items by vehicle make or model (e.g. 'Honda', 'Montero')"
    )
    parser.add_argument(
        "--dir",
        type=str,
        default=None,
        help="Path to job_order_extracts directory (default: auto-detect)"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results in JSON format"
    )
    parser.add_argument(
        "-i", "--interactive",
        action="store_true",
        help="Force interactive search session even if query is provided"
    )

    args = parser.parse_args()

    # Find and load job orders
    try:
        data_dir = find_job_order_directory(args.dir)
    except FileNotFoundError as err:
        print(f"{Colors.RED}Error: {err}{Colors.RESET}", file=sys.stderr)
        sys.exit(1)

    job_orders = load_job_orders(data_dir)
    if not job_orders:
        print(f"{Colors.RED}Error: No valid JSON job order files found in {data_dir}{Colors.RESET}", file=sys.stderr)
        sys.exit(1)

    # If no query and not explicitly JSON, or interactive requested -> run interactive
    if (not args.query and not args.json) or args.interactive:
        interactive_session(job_orders)
        return

    if not args.query:
        print(f"{Colors.RED}Please provide a search query or run without arguments for interactive mode.{Colors.RESET}")
        sys.exit(1)

    # Normalize min_score to 0.0 - 1.0
    min_score = args.min_score / 100.0 if args.min_score > 1.0 else args.min_score

    grouped, detailed = search_items(
        job_orders=job_orders,
        query=args.query,
        item_type=args.type,
        min_score=min_score,
        vehicle_filter=args.vehicle,
    )

    if args.json:
        payload = {
            "query": args.query,
            "type_filter": args.type,
            "min_score": min_score,
            "total_grouped": len(grouped),
            "total_occurrences": len(detailed),
            "results": detailed if args.detailed else grouped,
        }
        print(json.dumps(payload, indent=2, default=str))
        return

    if args.detailed:
        print_detailed_results(detailed, args.query, limit=args.limit)
    else:
        print_grouped_results(grouped, args.query, limit=args.limit)


if __name__ == "__main__":
    main()
