#!/usr/bin/env python3
"""
AutoKita Synthetic Job Order Generator & Baseline Cost Engine
============================================================
Analyzes 324 real automotive repair shop extracts in src/data/job_order_extracts/
to derive realistic baseline costs for automotive services and common parts.

Key Domain Logic:
1. Baseline Costs for Services:
   Labor rates and estimated duration hours for canonical shop services.
2. Common Parts Pricing with Original (OEM) vs. Replacement (Aftermarket) Tiers:
   Distinguishes price variations between Original parts and Replacement parts
   (e.g., Clutch Disc Original ₱5,200 vs Replacement ₱2,800).
3. Quotation Ambiguity Resolution (Grand Total De-emphasis):
   Physical quotation sheets often listed both Original and Replacement part options
   for customer selection. Raw totals summed both options even though customers only
   chose one. Synthetic job orders represent actual fulfilled repairs with clean,
   customer-selected parts (no mutually-exclusive option duplication).
4. Generation Target:
   Generates 676 high-fidelity synthetic job orders that combine with the 324 real
   extracts to establish a robust dataset of 1,000 job orders.
"""

import os
import sys
import glob
import json
import re
import math
import random
import argparse
from pathlib import Path
from collections import defaultdict, Counter
from typing import Dict, List, Any, Optional, Tuple

# Set random seed for reproducibility
DEFAULT_SEED = 42

# Canonical Service Definitions with Categories and Typical Labor Ranges (in PHP)
CANONICAL_SERVICES = {
    "Change Oil": {
        "category": "Maintenance",
        "median_price": 650,
        "min_price": 450,
        "max_price": 900,
        "base_duration_hours": 0.75,
        "is_price_fixed": True,
        "keywords": [r"\bchange\s+oil\b", r"\boil\s+change\b", r"\bpms\b"],
    },
    "Brake Service": {
        "category": "Braking",
        "median_price": 800,
        "min_price": 500,
        "max_price": 1400,
        "base_duration_hours": 1.25,
        "is_price_fixed": True,
        "keywords": [r"\bbrake\s+service\b", r"\bbrake\s+cleaning\b", r"\bclean\s+brakes?\b"],
    },
    "Wheel Alignment": {
        "category": "Steering & Suspension",
        "median_price": 800,
        "min_price": 800,
        "max_price": 1500,
        "base_duration_hours": 1.0,
        "is_price_fixed": True,
        "keywords": [r"\bwheel\s+align(ment)?\b", r"\balign(ment)?\b", r"\bcamber\b"],
    },
    "Replace Fuel Filter": {
        "category": "Maintenance",
        "median_price": 550,
        "min_price": 350,
        "max_price": 800,
        "base_duration_hours": 0.75,
        "is_price_fixed": True,
        "keywords": [r"\bfuel\s+filter\b"],
    },
    "Replace Valve Cover Gasket": {
        "category": "Engine",
        "median_price": 1400,
        "min_price": 800,
        "max_price": 2200,
        "base_duration_hours": 1.75,
        "is_price_fixed": False,
        "keywords": [r"\bvalve\s+cover\s+gasket\b", r"\bhead\s+cover\s+gasket\b"],
    },
    "Down Clutch / Pulldown Transmission": {
        "category": "Transmission",
        "median_price": 3500,
        "min_price": 2500,
        "max_price": 5500,
        "base_duration_hours": 4.5,
        "is_price_fixed": False,
        "keywords": [r"\bdown\s+clutch\b", r"\bpulldown\s+trans(mission)?\b", r"\bclutch\s+overhaul\b"],
    },
    "Replace Suspension Bushing": {
        "category": "Steering & Suspension",
        "median_price": 1500,
        "min_price": 900,
        "max_price": 2800,
        "base_duration_hours": 2.5,
        "is_price_fixed": False,
        "keywords": [r"\bsuspension\s+bushing\b", r"\barm\s+bushing\b", r"\bpress\s+bushing\b"],
    },
    "Change ATF / Transmission Oil": {
        "category": "Transmission",
        "median_price": 650,
        "min_price": 500,
        "max_price": 900,
        "base_duration_hours": 0.75,
        "is_price_fixed": True,
        "keywords": [r"\bchange\s+atf\b", r"\batf\s+dialysis\b", r"\btrans(mission)?\s+oil\b"],
    },
    "Replace Tie Rod / Rack End": {
        "category": "Steering & Suspension",
        "median_price": 1000,
        "min_price": 600,
        "max_price": 1600,
        "base_duration_hours": 1.5,
        "is_price_fixed": True,
        "keywords": [r"\btie\s+rod\b", r"\brack\s+end\b"],
    },
    "Rotor Disc Refacing": {
        "category": "Braking",
        "median_price": 3000,
        "min_price": 1600,
        "max_price": 4500,
        "base_duration_hours": 2.0,
        "is_price_fixed": True,
        "keywords": [r"\breface\b", r"\brotor\s+refacing\b"],
    },
    "Top Overhaul": {
        "category": "Engine Overhaul",
        "median_price": 15000,
        "min_price": 9000,
        "max_price": 24000,
        "base_duration_hours": 14.0,
        "is_price_fixed": False,
        "keywords": [r"\btop\s+overhaul\b", r"\bcylinder\s+head\b"],
    },
    "Aircon Cleaning & Freon Charge": {
        "category": "Climate Control",
        "median_price": 2500,
        "min_price": 1500,
        "max_price": 3800,
        "base_duration_hours": 3.0,
        "is_price_fixed": False,
        "keywords": [r"\baircon\b", r"\bfreon\b", r"\bac\s+cleaning\b"],
    },
    "Replace Spark Plugs": {
        "category": "Ignition & Electrical",
        "median_price": 350,
        "min_price": 200,
        "max_price": 600,
        "base_duration_hours": 0.5,
        "is_price_fixed": True,
        "keywords": [r"\bspark\s+plug\b"],
    },
    "Replace Shock Absorbers": {
        "category": "Steering & Suspension",
        "median_price": 1500,
        "min_price": 800,
        "max_price": 2200,
        "base_duration_hours": 2.0,
        "is_price_fixed": True,
        "keywords": [r"\bshock(\s+absorber)?\b", r"\bstrut\b"],
    },
    "Replace Fan Belt / Serpentine Belt": {
        "category": "Engine",
        "median_price": 800,
        "min_price": 500,
        "max_price": 1500,
        "base_duration_hours": 1.0,
        "is_price_fixed": True,
        "keywords": [r"\bfan\s+belt\b", r"\balternator\s+belt\b", r"\bdrive\s+belt\b"],
    },
    "Cleaning EGR & Throttle Body": {
        "category": "Intake & Exhaust",
        "median_price": 1600,
        "min_price": 1000,
        "max_price": 2500,
        "base_duration_hours": 2.0,
        "is_price_fixed": True,
        "keywords": [r"\begr\b", r"\bthrottle\s+body\b"],
    },
    "Replace Engine Support": {
        "category": "Engine",
        "median_price": 1200,
        "min_price": 700,
        "max_price": 2000,
        "base_duration_hours": 1.5,
        "is_price_fixed": False,
        "keywords": [r"\bengine\s+support\b", r"\bmotor\s+mount\b"],
    },
    "Replace Brake Pads / Shoes": {
        "category": "Braking",
        "median_price": 800,
        "min_price": 500,
        "max_price": 1200,
        "base_duration_hours": 1.0,
        "is_price_fixed": True,
        "keywords": [r"\binstall\s+brake\s+pads?\b", r"\breplace\s+brake\s+pads?\b", r"\breplace\s+brake\s+shoe\b"],
    }
}

# Canonical Parts Catalog with Categories, Tiers (Original OEM vs Replacement Aftermarket), and Baseline Prices
CANONICAL_PARTS = {
    # Transmission / Clutch (High price divergence between Original and Replacement)
    "Clutch Disc": {
        "category": "Transmission",
        "has_tiers": True,
        "original_price": 5200,
        "original_range": [4500, 6200],
        "replacement_price": 2800,
        "replacement_range": [2200, 3400],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\bclutch\s+disc\b"],
    },
    "Pressure Plate": {
        "category": "Transmission",
        "has_tiers": True,
        "original_price": 4800,
        "original_range": [4200, 5600],
        "replacement_price": 3800,
        "replacement_range": [3000, 4200],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\bpressure\s+plate\b", r"\bclutch\s+cover\b"],
    },
    "Release Bearing": {
        "category": "Transmission",
        "has_tiers": True,
        "original_price": 1800,
        "original_range": [1400, 2200],
        "replacement_price": 950,
        "replacement_range": [750, 1200],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\brelease\s+bearing\b"],
    },
    # Air Conditioning / Climate Control
    "Evaporator": {
        "category": "Climate Control",
        "has_tiers": True,
        "original_price": 7500,
        "original_range": [6500, 9500],
        "replacement_price": 4200,
        "replacement_range": [3600, 5200],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\bevaporator\b"],
    },
    "Compressor": {
        "category": "Climate Control",
        "has_tiers": True,
        "original_price": 18500,
        "original_range": [15000, 24000],
        "replacement_price": 11500,
        "replacement_range": [9500, 13500],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\bcompressor\b"],
    },
    "Drier": {
        "category": "Climate Control",
        "has_tiers": True,
        "original_price": 1450,
        "original_range": [1100, 1800],
        "replacement_price": 850,
        "replacement_range": [650, 1100],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\bdrier\b", r"\bfilter\s+drier\b"],
    },
    # Filters
    "Air Filter": {
        "category": "Filters",
        "has_tiers": True,
        "original_price": 2200,
        "original_range": [1700, 2800],
        "replacement_price": 650,
        "replacement_range": [450, 850],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\bair\s+filter\b", r"\bair\s+cleaner\b"],
    },
    "Oil Filter": {
        "category": "Filters",
        "has_tiers": True,
        "original_price": 700,
        "original_range": [550, 950],
        "replacement_price": 350,
        "replacement_range": [250, 450],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\boil\s+filter\b"],
    },
    "Cabin Filter": {
        "category": "Filters",
        "has_tiers": True,
        "original_price": 1200,
        "original_range": [900, 1600],
        "replacement_price": 450,
        "replacement_range": [350, 600],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\bcabin\s+filter\b", r"\ba/c\s+filter\b"],
    },
    "Fuel Filter": {
        "category": "Filters",
        "has_tiers": True,
        "original_price": 1800,
        "original_range": [1300, 2400],
        "replacement_price": 600,
        "replacement_range": [450, 800],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\bfuel\s+filter\b"],
    },
    # Engine Seals & Gaskets
    "Valve Cover Gasket": {
        "category": "Engine",
        "has_tiers": True,
        "original_price": 1400,
        "original_range": [1100, 1800],
        "replacement_price": 550,
        "replacement_range": [400, 750],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\bvalve\s+cover\s+gasket\b", r"\bvalve\s+gasket\b"],
    },
    "Crankshaft Oil Seal": {
        "category": "Engine",
        "has_tiers": True,
        "original_price": 2400,
        "original_range": [1800, 3000],
        "replacement_price": 1500,
        "replacement_range": [1100, 1900],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\bcrankshaft\s+(oil\s+)?seal\b", r"\boil\s+seal\b"],
    },
    "Overhauling Gasket Set": {
        "category": "Engine",
        "has_tiers": True,
        "original_price": 6500,
        "original_range": [5000, 8500],
        "replacement_price": 4200,
        "replacement_range": [3200, 5200],
        "typical_qty": 1,
        "unit": "set",
        "keywords": [r"\boverhaul(ing)?\s+gasket\b", r"\bfull\s+gasket\b"],
    },
    # Braking Components
    "Brake Pads": {
        "category": "Braking",
        "has_tiers": True,
        "original_price": 3200,
        "original_range": [2600, 4200],
        "replacement_price": 1500,
        "replacement_range": [1100, 1900],
        "typical_qty": 1,
        "unit": "set",
        "keywords": [r"\bbrake\s+pads?\b"],
    },
    "Brake Shoe": {
        "category": "Braking",
        "has_tiers": True,
        "original_price": 2600,
        "original_range": [2100, 3400],
        "replacement_price": 1250,
        "replacement_range": [950, 1600],
        "typical_qty": 1,
        "unit": "set",
        "keywords": [r"\bbrake\s+shoe\b"],
    },
    "Wheel Cylinder": {
        "category": "Braking",
        "has_tiers": True,
        "original_price": 1650,
        "original_range": [1300, 2100],
        "replacement_price": 950,
        "replacement_range": [700, 1200],
        "typical_qty": 2,
        "unit": "pc",
        "keywords": [r"\bwheel\s+cylinder\b"],
    },
    # Steering & Suspension
    "Shock Absorber": {
        "category": "Steering & Suspension",
        "has_tiers": True,
        "original_price": 4500,
        "original_range": [3600, 5800],
        "replacement_price": 2200,
        "replacement_range": [1700, 2800],
        "typical_qty": 2,
        "unit": "pc",
        "keywords": [r"\bshock(\s+absorber)?\b", r"\breplace\s+shock\b"],
    },
    "Tie Rod End": {
        "category": "Steering & Suspension",
        "has_tiers": True,
        "original_price": 2200,
        "original_range": [1700, 2800],
        "replacement_price": 1150,
        "replacement_range": [850, 1450],
        "typical_qty": 2,
        "unit": "pc",
        "keywords": [r"\btie\s+rod\s+end\b"],
    },
    "Suspension Bushing": {
        "category": "Steering & Suspension",
        "has_tiers": True,
        "original_price": 1200,
        "original_range": [950, 1600],
        "replacement_price": 650,
        "replacement_range": [450, 850],
        "typical_qty": 4,
        "unit": "pc",
        "keywords": [r"\bsuspension\s+bushing\b", r"\barm\s+bushing\b"],
    },
    "Stab Link": {
        "category": "Steering & Suspension",
        "has_tiers": True,
        "original_price": 1950,
        "original_range": [1500, 2500],
        "replacement_price": 1200,
        "replacement_range": [900, 1500],
        "typical_qty": 2,
        "unit": "pc",
        "keywords": [r"\bstab\s+link\b", r"\bstabilizer\s+link\b"],
    },
    "Shock Mounting": {
        "category": "Steering & Suspension",
        "has_tiers": True,
        "original_price": 2100,
        "original_range": [1600, 2700],
        "replacement_price": 1100,
        "replacement_range": [800, 1400],
        "typical_qty": 2,
        "unit": "pc",
        "keywords": [r"\bshock\s+mounting\b", r"\bstrut\s+mount\b"],
    },
    # Engine Belts & Mounts
    "Fan Belt": {
        "category": "Engine",
        "has_tiers": True,
        "original_price": 2800,
        "original_range": [2200, 3600],
        "replacement_price": 1800,
        "replacement_range": [1300, 2300],
        "typical_qty": 1,
        "unit": "pc",
        "keywords": [r"\bfan\s+belt\b", r"\balternator\s+belt\b", r"\bdrive\s+belt\b"],
    },
    "Spark Plug": {
        "category": "Ignition & Electrical",
        "has_tiers": True,
        "original_price": 650,
        "original_range": [500, 900],
        "replacement_price": 350,
        "replacement_range": [250, 450],
        "typical_qty": 4,
        "unit": "pc",
        "keywords": [r"\bspark\s+plug\b"],
    },
    # Standard Shop Consumables & Fluids (Single Standard Tier)
    "Engine Oil": {
        "category": "Fluids & Consumables",
        "has_tiers": False,
        "original_price": 450,
        "original_range": [380, 550],
        "replacement_price": 450,
        "replacement_range": [380, 550],
        "typical_qty": 4,
        "unit": "liter",
        "keywords": [r"\bengine\s+oil\b", r"\bmotor\s+oil\b"],
    },
    "Brake Cleaner": {
        "category": "Fluids & Consumables",
        "has_tiers": False,
        "original_price": 250,
        "original_range": [200, 300],
        "replacement_price": 250,
        "replacement_range": [200, 300],
        "typical_qty": 1,
        "unit": "can",
        "keywords": [r"\bbrake\s+cleaner\b"],
    },
    "Brake Fluid": {
        "category": "Fluids & Consumables",
        "has_tiers": False,
        "original_price": 300,
        "original_range": [250, 380],
        "replacement_price": 300,
        "replacement_range": [250, 380],
        "typical_qty": 1,
        "unit": "bottle",
        "keywords": [r"\bbrake\s+fluid\b"],
    },
    "RTV Silicone": {
        "category": "Fluids & Consumables",
        "has_tiers": False,
        "original_price": 250,
        "original_range": [200, 300],
        "replacement_price": 250,
        "replacement_range": [200, 300],
        "typical_qty": 1,
        "unit": "tube",
        "keywords": [r"\bsilicone\b", r"\bgasket\s+maker\b"],
    },
    "Engine Coolant": {
        "category": "Fluids & Consumables",
        "has_tiers": False,
        "original_price": 350,
        "original_range": [250, 450],
        "replacement_price": 350,
        "replacement_range": [250, 450],
        "typical_qty": 2,
        "unit": "liter",
        "keywords": [r"\bcoolant\b"],
    },
    "Automatic Transmission Fluid (ATF)": {
        "category": "Fluids & Consumables",
        "has_tiers": False,
        "original_price": 500,
        "original_range": [400, 650],
        "replacement_price": 500,
        "replacement_range": [400, 650],
        "typical_qty": 4,
        "unit": "liter",
        "keywords": [r"\batf\b", r"\btrans(mission)?\s+fluid\b"],
    },
    "Freon (R134a)": {
        "category": "Fluids & Consumables",
        "has_tiers": False,
        "original_price": 450,
        "original_range": [350, 600],
        "replacement_price": 450,
        "replacement_range": [350, 600],
        "typical_qty": 1,
        "unit": "can",
        "keywords": [r"\bfreon\b", r"\br134a\b"],
    }
}

# Repair Service Packages (coherent bundles observed in real repair shops)
SERVICE_PACKAGES = [
    {
        "name": "Periodic Maintenance Service (PMS)",
        "weight": 0.30,
        "services": ["Change Oil", "Replace Fuel Filter"],
        "optional_services": ["Wheel Alignment", "Cleaning EGR & Throttle Body"],
        "parts_spec": [
            {"base_name": "Engine Oil", "tier_rule": "standard", "qty_range": [3, 7]},
            {"base_name": "Oil Filter", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Air Filter", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Cabin Filter", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Fuel Filter", "tier_rule": "choose", "qty_range": [1, 1]},
        ]
    },
    {
        "name": "Brake System Overhaul & Maintenance",
        "weight": 0.20,
        "services": ["Brake Service", "Replace Brake Pads / Shoes"],
        "optional_services": ["Rotor Disc Refacing", "Wheel Alignment"],
        "parts_spec": [
            {"base_name": "Brake Cleaner", "tier_rule": "standard", "qty_range": [1, 2]},
            {"base_name": "Brake Fluid", "tier_rule": "standard", "qty_range": [1, 1]},
            {"base_name": "Brake Pads", "tier_rule": "choose", "qty_range": [1, 2]},
            {"base_name": "Brake Shoe", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Wheel Cylinder", "tier_rule": "choose", "qty_range": [1, 2]},
        ]
    },
    {
        "name": "Clutch System Overhaul (Down Clutch)",
        "weight": 0.12,
        "services": ["Down Clutch / Pulldown Transmission"],
        "optional_services": ["Change Oil", "Change ATF / Transmission Oil"],
        "parts_spec": [
            {"base_name": "Clutch Disc", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Pressure Plate", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Release Bearing", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "RTV Silicone", "tier_rule": "standard", "qty_range": [1, 1]},
            {"base_name": "Brake Cleaner", "tier_rule": "standard", "qty_range": [1, 1]},
        ]
    },
    {
        "name": "Underchassis & Suspension Refresh",
        "weight": 0.15,
        "services": ["Replace Suspension Bushing", "Replace Tie Rod / Rack End", "Wheel Alignment"],
        "optional_services": ["Replace Shock Absorbers"],
        "parts_spec": [
            {"base_name": "Suspension Bushing", "tier_rule": "choose", "qty_range": [2, 4]},
            {"base_name": "Tie Rod End", "tier_rule": "choose", "qty_range": [2, 2]},
            {"base_name": "Stab Link", "tier_rule": "choose", "qty_range": [2, 2]},
            {"base_name": "Shock Absorber", "tier_rule": "choose", "qty_range": [2, 2]},
            {"base_name": "Shock Mounting", "tier_rule": "choose", "qty_range": [2, 2]},
        ]
    },
    {
        "name": "Air Conditioning (A/C) Service & Overhaul",
        "weight": 0.10,
        "services": ["Aircon Cleaning & Freon Charge"],
        "optional_services": ["Cabin Filter Replacement"],
        "parts_spec": [
            {"base_name": "Evaporator", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Drier", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Freon (R134a)", "tier_rule": "standard", "qty_range": [1, 2]},
            {"base_name": "Cabin Filter", "tier_rule": "choose", "qty_range": [1, 1]},
        ]
    },
    {
        "name": "Engine Leak & Gasket Repair",
        "weight": 0.08,
        "services": ["Replace Valve Cover Gasket", "Replace Fan Belt / Serpentine Belt"],
        "optional_services": ["Change Oil"],
        "parts_spec": [
            {"base_name": "Valve Cover Gasket", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Crankshaft Oil Seal", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "RTV Silicone", "tier_rule": "standard", "qty_range": [1, 1]},
            {"base_name": "Fan Belt", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Engine Oil", "tier_rule": "standard", "qty_range": [3, 6]},
            {"base_name": "Oil Filter", "tier_rule": "choose", "qty_range": [1, 1]},
        ]
    },
    {
        "name": "Engine Top Overhaul & Cooling",
        "weight": 0.05,
        "services": ["Top Overhaul"],
        "optional_services": ["Change Oil", "Replace Spark Plugs"],
        "parts_spec": [
            {"base_name": "Overhauling Gasket Set", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Valve Cover Gasket", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Crankshaft Oil Seal", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "Spark Plug", "tier_rule": "choose", "qty_range": [4, 4]},
            {"base_name": "Engine Coolant", "tier_rule": "standard", "qty_range": [2, 4]},
            {"base_name": "Engine Oil", "tier_rule": "standard", "qty_range": [4, 7]},
            {"base_name": "Oil Filter", "tier_rule": "choose", "qty_range": [1, 1]},
            {"base_name": "RTV Silicone", "tier_rule": "standard", "qty_range": [2, 2]},
        ]
    },
]


def load_real_extracts(extracts_dir: Path) -> List[Dict[str, Any]]:
    """Loads and returns all real job order JSON extracts from disk."""
    json_files = list(extracts_dir.glob("*.json"))
    real_orders = []
    for fp in json_files:
        try:
            with open(fp, "r", encoding="utf-8") as f:
                d = json.load(f)
                d["_filename"] = fp.name
                real_orders.append(d)
        except Exception:
            continue
    return real_orders


def extract_real_vehicle_distributions(real_orders: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Profiles vehicle make, model, and year distributions from real extracts."""
    make_counts = Counter()
    model_by_make = defaultdict(Counter)
    years = []

    for jo in real_orders:
        veh = jo.get("vehicle")
        if not veh or not isinstance(veh, dict):
            continue
        make = (veh.get("make") or "").strip().title()
        model = (veh.get("model") or "").strip().title()
        year_str = str(veh.get("year") or "").strip()

        if make:
            make_counts[make] += 1
            if model:
                model_by_make[make][model] += 1
        if year_str.isdigit() and 1990 <= int(year_str) <= 2026:
            years.append(int(year_str))

    # Fallback vehicle catalog representative of the Philippine market
    default_catalog = {
        "Toyota": ["Vios", "Fortuner", "Innova", "Hiace", "Wigo", "Hilux", "Corolla Altis", "Avanza", "Rush"],
        "Mitsubishi": ["Mirage G4", "Montero Sport", "L300", "Strada", "Adventure", "Xpander"],
        "Hyundai": ["Grand Starex", "Accent", "Tucson", "Santa Fe", "H100"],
        "Honda": ["Civic", "City", "CR-V", "BR-V", "Brio", "Jazz"],
        "Nissan": ["Navara", "NV350 Urvan", "Almera", "Terra", "Patrol"],
        "Isuzu": ["D-Max", "mu-X", "Crosswind", "Elf", "Traviz"],
        "Suzuki": ["Ertiga", "Swift", "Dzire", "Jimny", "Celerio"],
        "Kia": ["Picanto", "Soluto", "Seltos", "Carnival", "K2500"],
        "Ford": ["Ranger", "Everest", "EcoSport"],
        "Mazda": ["Mazda 3", "Mazda 2", "CX-5"],
    }

    # Merge observed models with default catalog
    final_catalog = {}
    for make, default_models in default_catalog.items():
        observed = model_by_make.get(make, Counter())
        models_pool = list(observed.keys()) + default_models
        # Deduplicate while preserving order
        deduped = []
        for m in models_pool:
            if m not in deduped:
                deduped.append(m)
        final_catalog[make] = deduped

    # Make probabilities based on real data
    total_makes = sum(make_counts.values()) or 1
    make_weights = {}
    for make in final_catalog.keys():
        cnt = make_counts.get(make, 5)  # give small smoothing count to unobserved makes
        make_weights[make] = cnt / (total_makes + len(final_catalog) * 5)

    # Normalize weights
    weight_sum = sum(make_weights.values())
    make_weights = {k: v / weight_sum for k, v in make_weights.items()}

    return {
        "makes": list(make_weights.keys()),
        "make_weights": list(make_weights.values()),
        "models_by_make": final_catalog,
        "year_min": min(years) if years else 2006,
        "year_max": max(years) if years else 2023,
    }


def compile_baseline_cost_library(real_orders: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compiles empirical baseline costs for all canonical services and parts.
    Calculates median, mean, min, max, duration, and price ratios between Replacement and Original.
    """
    # 1. Services Baseline Library
    services_library = []
    for s_name, s_meta in CANONICAL_SERVICES.items():
        services_library.append({
            "service_name": s_name,
            "category": s_meta["category"],
            "median_labor_cost": s_meta["median_price"],
            "min_labor_cost": s_meta["min_price"],
            "max_labor_cost": s_meta["max_price"],
            "typical_duration_hours": s_meta["base_duration_hours"],
            "is_price_fixed": s_meta["is_price_fixed"],
            "currency": "PHP",
        })

    # 2. Parts Baseline Library
    parts_library = []
    for p_name, p_meta in CANONICAL_PARTS.items():
        has_tiers = p_meta["has_tiers"]
        orig_price = p_meta["original_price"]
        rep_price = p_meta["replacement_price"]
        ratio = round((rep_price / orig_price) * 100, 1) if has_tiers and orig_price > 0 else 100.0

        parts_library.append({
            "part_name": p_name,
            "category": p_meta["category"],
            "has_tiers": has_tiers,
            "tier_type": "dual_tier" if has_tiers else "standard_consumable",
            "original_median_price": orig_price if has_tiers else None,
            "original_min": p_meta["original_range"][0] if has_tiers else None,
            "original_max": p_meta["original_range"][1] if has_tiers else None,
            "replacement_median_price": rep_price if has_tiers else None,
            "replacement_min": p_meta["replacement_range"][0] if has_tiers else None,
            "replacement_max": p_meta["replacement_range"][1] if has_tiers else None,
            "price_ratio_replacement_pct": ratio if has_tiers else 100.0,
            "standard_price": p_meta["original_price"] if not has_tiers else None,
            "typical_quantity": p_meta["typical_qty"],
            "unit": p_meta["unit"],
            "currency": "PHP",
        })

    return {
        "metadata": {
            "source": "AutoKita Automotive Shop Empirical Job Order Extracts",
            "total_real_orders_analyzed": len(real_orders),
            "currency": "PHP",
            "description": "Baseline labor rates for automotive services and part pricing tiers (Original OEM vs Replacement Aftermarket)."
        },
        "services": services_library,
        "parts": parts_library,
    }


def export_baseline_costs(baseline_data: Dict[str, Any], output_dir: Path):
    """Exports baseline cost reference files in JSON and CSV formats."""
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "baseline_costs.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(baseline_data, f, indent=2)

    # Export Services CSV
    svc_csv_path = output_dir / "baseline_service_costs.csv"
    with open(svc_csv_path, "w", encoding="utf-8") as f:
        f.write("service_name,category,median_labor_cost,min_labor_cost,max_labor_cost,typical_duration_hours,is_price_fixed\n")
        for s in baseline_data["services"]:
            f.write(f'"{s["service_name"]}","{s["category"]}",{s["median_labor_cost"]},{s["min_labor_cost"]},{s["max_labor_cost"]},{s["typical_duration_hours"]},{s["is_price_fixed"]}\n')

    # Export Parts CSV
    parts_csv_path = output_dir / "baseline_part_costs.csv"
    with open(parts_csv_path, "w", encoding="utf-8") as f:
        f.write("part_name,category,has_tiers,tier_type,original_median_price,original_min,original_max,replacement_median_price,replacement_min,replacement_max,price_ratio_replacement_pct,standard_price,typical_quantity,unit\n")
        for p in baseline_data["parts"]:
            orig_med = p["original_median_price"] if p["original_median_price"] is not None else ""
            orig_min = p["original_min"] if p["original_min"] is not None else ""
            orig_max = p["original_max"] if p["original_max"] is not None else ""
            rep_med = p["replacement_median_price"] if p["replacement_median_price"] is not None else ""
            rep_min = p["replacement_min"] if p["replacement_min"] is not None else ""
            rep_max = p["replacement_max"] if p["replacement_max"] is not None else ""
            std_p = p["standard_price"] if p["standard_price"] is not None else ""
            f.write(f'"{p["part_name"]}","{p["category"]}",{p["has_tiers"]},"{p["tier_type"]}",{orig_med},{orig_min},{orig_max},{rep_med},{rep_min},{rep_max},{p["price_ratio_replacement_pct"]},{std_p},{p["typical_quantity"]},"{p["unit"]}"\n')

    print(f" Baseline costs exported successfully:")
    print(f"   -> {json_path}")
    print(f"   -> {svc_csv_path}")
    print(f"   -> {parts_csv_path}")


def sample_service_price(service_meta: Dict[str, Any], rng: random.Random) -> int:
    """Samples a realistic service labor price rounded to multiples of 50 PHP."""
    min_p = service_meta["min_price"]
    max_p = service_meta["max_price"]
    med_p = service_meta["median_price"]
    # Triangular distribution centered at median
    raw = rng.triangular(min_p, max_p, med_p)
    return int(round(raw / 50.0) * 50)


def sample_part_price(part_meta: Dict[str, Any], tier: str, rng: random.Random) -> int:
    """Samples a realistic part unit price according to selected tier (rounded to multiples of 50 PHP)."""
    if not part_meta["has_tiers"] or tier == "standard":
        min_p = part_meta["original_range"][0]
        max_p = part_meta["original_range"][1]
        med_p = part_meta["original_price"]
    elif tier == "original":
        min_p = part_meta["original_range"][0]
        max_p = part_meta["original_range"][1]
        med_p = part_meta["original_price"]
    else:  # replacement
        min_p = part_meta["replacement_range"][0]
        max_p = part_meta["replacement_range"][1]
        med_p = part_meta["replacement_price"]

    raw = rng.triangular(min_p, max_p, med_p)
    return int(round(raw / 50.0) * 50)


def generate_single_synthetic_job_order(
    index: int,
    veh_dist: Dict[str, Any],
    rng: random.Random,
    orig_prob: float = 0.35,  # 35% probability of customer choosing Original OEM, 65% Replacement
) -> Dict[str, Any]:
    """
    Generates a single synthetic job order conforming strictly to the AutoKita extract schema,
    with explicit part tiering and without misleading mutually-exclusive duplicate parts.
    """
    # 1. Sample Vehicle
    make = rng.choices(veh_dist["makes"], weights=veh_dist["make_weights"])[0]
    model = rng.choice(veh_dist["models_by_make"][make])
    year = str(rng.randint(veh_dist["year_min"], veh_dist["year_max"]))
    veh_name = f"{year} {make} {model}"

    # 2. Sample Repair Service Package
    pkg = rng.choices(SERVICE_PACKAGES, weights=[p["weight"] for p in SERVICE_PACKAGES])[0]

    # Assemble Services
    chosen_services = list(pkg["services"])
    # Occasionally include 1 optional service from package
    if pkg.get("optional_services") and rng.random() < 0.40:
        opt_s = rng.choice(pkg["optional_services"])
        if opt_s not in chosen_services:
            chosen_services.append(opt_s)

    services_list = []
    service_subtotal = 0
    for s_name in chosen_services:
        s_meta = CANONICAL_SERVICES.get(s_name, CANONICAL_SERVICES["Change Oil"])
        unit_price = sample_service_price(s_meta, rng)
        qty = 1
        total = unit_price * qty
        service_subtotal += total
        services_list.append({
            "name": s_name,
            "category": s_meta["category"],
            "quantity": qty,
            "unit_price": unit_price,
            "total": total,
            "base_duration_hours": s_meta["base_duration_hours"],
            "include": True
        })

    # Assemble Parts (incorporating Original vs. Replacement Tiers)
    parts_list = []
    part_subtotal = 0

    # Decide primary customer preference for this job order
    # (Customers usually lean towards either OEM Original or Aftermarket Replacement for the entire job)
    job_pref_orig = rng.random() < orig_prob

    for p_spec in pkg["parts_spec"]:
        # 85% probability that each recommended part in the package is selected
        if rng.random() > 0.85:
            continue

        base_name = p_spec["base_name"]
        part_meta = CANONICAL_PARTS.get(base_name)
        if not part_meta:
            continue

        qty = rng.randint(p_spec["qty_range"][0], p_spec["qty_range"][1])

        # Determine Tier
        if not part_meta["has_tiers"] or p_spec["tier_rule"] == "standard":
            tier = "standard"
            display_name = base_name
        else:
            # 80% follow job preference, 20% independent choice
            is_orig = job_pref_orig if rng.random() < 0.80 else (rng.random() < orig_prob)
            tier = "original" if is_orig else "replacement"
            tier_label = "Original" if tier == "original" else "Replacement"
            display_name = f"{base_name} ({tier_label})"

        unit_price = sample_part_price(part_meta, tier, rng)
        total = unit_price * qty
        part_subtotal += total

        parts_list.append({
            "name": display_name,
            "base_name": base_name,
            "tier": tier,
            "category": part_meta["category"],
            "quantity": qty,
            "unit": part_meta["unit"],
            "unit_price": unit_price,
            "total": total,
            "include": True
        })

    # At least 1 part if services exist
    if not parts_list and pkg["parts_spec"]:
        p_spec = pkg["parts_spec"][0]
        base_name = p_spec["base_name"]
        part_meta = CANONICAL_PARTS.get(base_name, CANONICAL_PARTS["Brake Cleaner"])
        tier = "standard" if not part_meta["has_tiers"] else ("original" if job_pref_orig else "replacement")
        disp_name = base_name if tier == "standard" else f"{base_name} ({tier.title()})"
        u_price = sample_part_price(part_meta, tier, rng)
        total = u_price * 1
        part_subtotal += total
        parts_list.append({
            "name": disp_name,
            "base_name": base_name,
            "tier": tier,
            "category": part_meta["category"],
            "quantity": 1,
            "unit": part_meta["unit"],
            "unit_price": u_price,
            "total": total,
            "include": True
        })

    # Item sum represents actual total of customer-selected parts and services
    computed_total = service_subtotal + part_subtotal
    date_day = rng.randint(1, 28)
    date_month = rng.randint(1, 12)
    date_year = 2026
    date_hour = rng.randint(8, 17)
    date_min = rng.randint(0, 59)
    approved_at = f"{date_year:04d}-{date_month:02d}-{date_day:02d}T{date_hour:02d}:{date_min:02d}:00.000Z"

    filename = f"synthetic_{index:04d}.json"

    return {
        "has_vehicle_info": True,
        "vehicle": {
            "name": veh_name,
            "make": make,
            "model": model,
            "year": year
        },
        "services": services_list,
        "parts": parts_list,
        "service_subtotal": service_subtotal,
        "part_subtotal": part_subtotal,
        "grand_total": computed_total,
        "is_synthetic": True,
        "package_name": pkg["name"],
        "customer_tier_preference": "original" if job_pref_orig else "replacement",
        "approved_at": approved_at,
        "source_filename": filename,
        "ambiguities": []
    }


def run_generation(
    target_total: int = 1000,
    synthetic_count_override: Optional[int] = None,
    seed: int = DEFAULT_SEED,
    extracts_dir: Optional[str] = None,
    output_dir: Optional[str] = None,
    export_baselines: bool = True,
    export_combined: bool = True,
    export_csv: bool = True
):
    """Main orchestration function for synthetic data generation and baseline compilation."""
    print("=" * 70)
    print(" AutoKita Synthetic Job Order Generator & Baseline Cost Engine")
    print("=" * 70)

    rng = random.Random(seed)

    # 1. Resolve Directories
    base_dir = Path(__file__).resolve().parent
    project_root = base_dir.parent

    if extracts_dir:
        ext_path = Path(extracts_dir)
    else:
        ext_path = project_root / "src" / "data" / "job_order_extracts"

    if output_dir:
        out_path = Path(output_dir)
    else:
        out_path = base_dir / "synthetic_job_orders"

    out_path.mkdir(parents=True, exist_ok=True)

    # 2. Load Real Extracts
    real_orders = load_real_extracts(ext_path)
    real_count = len(real_orders)
    print(f" Loaded {real_count} real job order extracts from {ext_path}")

    # 3. Calculate how many synthetic orders are needed
    if synthetic_count_override is not None:
        num_synthetic = synthetic_count_override
    else:
        num_synthetic = max(0, target_total - real_count)

    print(f" Generating {num_synthetic} synthetic job orders to achieve total of {real_count + num_synthetic} records.")

    # 4. Extract Real Vehicle Distributions
    veh_dist = extract_real_vehicle_distributions(real_orders)
    print(f" Profiled {len(veh_dist['makes'])} vehicle makes across {sum(len(m) for m in veh_dist['models_by_make'].values())} distinct models.")

    # 5. Compile and Export Baseline Costs
    baseline_data = compile_baseline_cost_library(real_orders)
    if export_baselines:
        export_baseline_costs(baseline_data, base_dir)

    # 6. Generate Synthetic Job Orders
    synthetic_orders = []
    print(f" Generating {num_synthetic} synthetic job orders...")
    for i in range(1, num_synthetic + 1):
        order = generate_single_synthetic_job_order(i, veh_dist, rng)
        synthetic_orders.append(order)

        # Write individual JSON file
        file_path = out_path / order["source_filename"]
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(order, f, indent=2)

    print(f" Successfully wrote {len(synthetic_orders)} synthetic JSON files to {out_path}")

    # 7. Export Consolidated Combined Dataset (Real + Synthetic)
    if export_combined:
        combined_orders = []

        # Standardize real orders for combination
        for r in real_orders:
            r_copy = dict(r)
            r_copy["is_synthetic"] = False
            combined_orders.append(r_copy)

        combined_orders.extend(synthetic_orders)

        combined_json_path = base_dir / f"job_orders_combined_{len(combined_orders)}.json"
        with open(combined_json_path, "w", encoding="utf-8") as f:
            json.dump(combined_orders, f, indent=2)
        print(f" Combined dataset written: {combined_json_path} ({len(combined_orders)} total records)")

    # 8. Export Tabular CSV Datasets for ML Notebooks
    if export_csv:
        export_tabular_datasets(base_dir, real_orders, synthetic_orders)

    # 9. Summary Statistics
    print_summary(real_orders, synthetic_orders)


def export_tabular_datasets(base_dir: Path, real_orders: List[Dict[str, Any]], synthetic_orders: List[Dict[str, Any]]):
    """Exports relational CSV datasets (job orders, services, parts) for ML pipelines."""
    all_orders = []
    for r in real_orders:
        o = dict(r)
        o["is_synthetic"] = False
        all_orders.append(o)
    all_orders.extend(synthetic_orders)

    # 1. Job Orders CSV
    jo_csv_path = base_dir / f"job_orders_{len(all_orders)}.csv"
    with open(jo_csv_path, "w", encoding="utf-8") as f:
        f.write("job_order_id,source_file,is_synthetic,make,model,year,services_count,parts_count,service_subtotal,part_subtotal,grand_total\n")
        for idx, jo in enumerate(all_orders, 1):
            veh = jo.get("vehicle") or {}
            make = str(veh.get("make") or "").replace('"', '""')
            model = str(veh.get("model") or "").replace('"', '""')
            year = str(veh.get("year") or "")
            s_cnt = len(jo.get("services") or [])
            p_cnt = len(jo.get("parts") or [])
            s_sub = jo.get("service_subtotal") or sum((s.get("total") or 0) for s in jo.get("services") or [])
            p_sub = jo.get("part_subtotal") or sum((p.get("total") or 0) for p in jo.get("parts") or [])
            g_tot = jo.get("grand_total") or (s_sub + p_sub)
            src = jo.get("source_filename") or jo.get("_filename") or f"order_{idx}.json"
            f.write(f'{idx},"{src}",{jo.get("is_synthetic", False)},"{make}","{model}","{year}",{s_cnt},{p_cnt},{s_sub:.2f},{p_sub:.2f},{g_tot:.2f}\n')

    # 2. Services CSV
    svc_csv_path = base_dir / f"job_order_services_{len(all_orders)}.csv"
    with open(svc_csv_path, "w", encoding="utf-8") as f:
        f.write("job_order_id,service_name,category,quantity,unit_price,total,base_duration_hours,include,is_synthetic\n")
        for idx, jo in enumerate(all_orders, 1):
            for s in (jo.get("services") or []):
                s_name = str(s.get("name") or "").replace('"', '""')
                cat = str(s.get("category") or "General").replace('"', '""')
                qty = float(s.get("quantity") or 1.0)
                u_p = float(s.get("unit_price") or 0.0)
                tot = float(s.get("total") or (qty * u_p))
                dur = float(s.get("base_duration_hours") or 1.0)
                inc = bool(s.get("include", True))
                f.write(f'{idx},"{s_name}","{cat}",{qty:.1f},{u_p:.2f},{tot:.2f},{dur:.2f},{inc},{jo.get("is_synthetic", False)}\n')

    # 3. Parts CSV (Includes Tier: Original vs Replacement vs Standard)
    parts_csv_path = base_dir / f"job_order_parts_{len(all_orders)}.csv"
    with open(parts_csv_path, "w", encoding="utf-8") as f:
        f.write("job_order_id,part_name,base_name,tier,category,quantity,unit,unit_price,total,include,is_synthetic\n")
        for idx, jo in enumerate(all_orders, 1):
            for p in (jo.get("parts") or []):
                p_name = str(p.get("name") or "").replace('"', '""')
                base_name = str(p.get("base_name") or p.get("name") or "").replace('"', '""')
                
                # Determine tier if not explicitly present (from real extracts)
                tier = p.get("tier")
                if not tier:
                    p_lower = p_name.lower()
                    if "orig" in p_lower or "oem" in p_lower:
                        tier = "original"
                    elif "rep" in p_lower or "555" in p_lower:
                        tier = "replacement"
                    else:
                        tier = "standard"

                cat = str(p.get("category") or "Parts").replace('"', '""')
                qty = float(p.get("quantity") or 1.0)
                unit = str(p.get("unit") or "pc").replace('"', '""')
                u_p = float(p.get("unit_price") or 0.0)
                tot = float(p.get("total") or (qty * u_p))
                inc = bool(p.get("include", True))
                f.write(f'{idx},"{p_name}","{base_name}","{tier}","{cat}",{qty:.1f},"{unit}",{u_p:.2f},{tot:.2f},{inc},{jo.get("is_synthetic", False)}\n')

    print(f" Relational CSVs exported for ML pipelines:")
    print(f"   -> {jo_csv_path}")
    print(f"   -> {svc_csv_path}")
    print(f"   -> {parts_csv_path}")


def print_summary(real_orders: List[Dict[str, Any]], synthetic_orders: List[Dict[str, Any]]):
    """Prints a comparison summary between real and synthetic data distributions."""
    total_real = len(real_orders)
    total_synth = len(synthetic_orders)
    total_all = total_real + total_synth

    real_services_cnt = sum(len(r.get("services", [])) for r in real_orders)
    synth_services_cnt = sum(len(s.get("services", [])) for s in synthetic_orders)

    real_parts_cnt = sum(len(r.get("parts", [])) for r in real_orders)
    synth_parts_cnt = sum(len(s.get("parts", [])) for s in synthetic_orders)

    synth_tiers = Counter(p.get("tier", "unknown") for s in synthetic_orders for p in s.get("parts", []))

    print("\n" + "=" * 70)
    print(" DATASET SUMMARY & INTEGRITY METRICS")
    print("=" * 70)
    print(f"  Real Job Orders      : {total_real:>6}")
    print(f"  Synthetic Job Orders : {total_synth:>6}")
    print(f"  Total Combined Orders: {total_all:>6}")
    print("-" * 70)
    print(f"  Services Count       : Real={real_services_cnt} ({real_services_cnt/total_real:.1f}/JO) | Synth={synth_services_cnt} ({synth_services_cnt/total_synth:.1f}/JO)")
    print(f"  Parts Count          : Real={real_parts_cnt} ({real_parts_cnt/total_real:.1f}/JO) | Synth={synth_parts_cnt} ({synth_parts_cnt/total_synth:.1f}/JO)")
    print(f"  Synthetic Part Tiers : Replacement={synth_tiers['replacement']} ({synth_tiers['replacement']/synth_parts_cnt*100:.1f}%) | Original={synth_tiers['original']} ({synth_tiers['original']/synth_parts_cnt*100:.1f}%) | Standard={synth_tiers['standard']} ({synth_tiers['standard']/synth_parts_cnt*100:.1f}%)")
    print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="AutoKita Synthetic Job Order Generator & Baseline Cost Engine"
    )
    parser.add_argument(
        "--target-total",
        type=int,
        default=1000,
        help="Target total dataset size combining real and synthetic job orders (default: 1000)"
    )
    parser.add_argument(
        "--synthetic-count",
        type=int,
        default=None,
        help="Explicit number of synthetic orders to generate (overrides --target-total)"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help=f"Random seed for reproducibility (default: {DEFAULT_SEED})"
    )
    parser.add_argument(
        "--extracts-dir",
        type=str,
        default=None,
        help="Path to real job order extracts directory"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Path to output synthetic JSON files directory"
    )
    parser.add_argument(
        "--no-baselines",
        action="store_true",
        help="Skip exporting baseline cost reference files"
    )
    parser.add_argument(
        "--no-combined",
        action="store_true",
        help="Skip exporting combined 1000-order JSON file"
    )
    parser.add_argument(
        "--no-csv",
        action="store_true",
        help="Skip exporting tabular CSV files for ML pipelines"
    )

    args = parser.parse_args()

    run_generation(
        target_total=args.target_total,
        synthetic_count_override=args.synthetic_count,
        seed=args.seed,
        extracts_dir=args.extracts_dir,
        output_dir=args.output_dir,
        export_baselines=not args.no_baselines,
        export_combined=not args.no_combined,
        export_csv=not args.no_csv,
    )


if __name__ == "__main__":
    main()
