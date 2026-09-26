#!/usr/bin/env python3
"""
AutoKita Model Retraining & Batch Continuous Learning Engine
============================================================
Trains the Time, Cost, and Churn ML models on the empirical baseline dataset
(1,000 job orders) and provides a scheduled batch continuous learning engine
that queries completed job orders from Supabase PostgreSQL to incrementally
adapt baseline durations and labor costs while dampening aggressive shifts.

Features:
- Initial Training: Trains Random Forest models from scratch using 1,000 baseline records.
- Batch Continuous Learning: Retrains in batches to reduce compute overhead.
- Outlier Suppression: Filters extreme durations (e.g., forgotten clock-outs, abandoned jobs).
- Damped Exponential Smoothing (EMA): Blends new batch actuals with existing baselines
  using a conservative learning rate (default alpha=0.15) to prevent erratic fluctuations.
- Hot-reloadable artifact exports to models/exported/.
"""

import os
import sys
import json
import re
import argparse
import datetime
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple

# Enable UTF-8 console output on Windows
if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, accuracy_score, f1_score

# Directory Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
EXPORTED_DIR = BASE_DIR / "exported"
EXPORTED_DIR.mkdir(parents=True, exist_ok=True)

SYNC_META_FILE = EXPORTED_DIR / "last_sync_meta.json"

# Canonical Services Mapping (Names, IDs, and Starting Baseline Values)
SERVICE_CATALOG = {
    1: {"name": "Change Oil", "aliases": ["change oil", "oil change", "pms", "chamber oil"], "base_price": 650.0, "base_duration_hours": 0.75, "is_price_fixed": True, "category": "Maintenance"},
    2: {"name": "Change ATF / Transmission Fluid", "aliases": ["change atf", "atf dialysis", "transmission fluid", "gear oil"], "base_price": 650.0, "base_duration_hours": 0.75, "is_price_fixed": True, "category": "Transmission"},
    3: {"name": "Replace Fuel Filter", "aliases": ["replace fuel filter", "fuel filter"], "base_price": 550.0, "base_duration_hours": 0.75, "is_price_fixed": True, "category": "Maintenance"},
    4: {"name": "Replace Air Filter", "aliases": ["replace air filter", "air filter", "air cleaner"], "base_price": 550.0, "base_duration_hours": 0.25, "is_price_fixed": True, "category": "Maintenance"},
    5: {"name": "Replace Cabin Filter", "aliases": ["replace cabin filter", "cabin filter"], "base_price": 200.0, "base_duration_hours": 0.25, "is_price_fixed": True, "category": "Maintenance"},
    6: {"name": "Fuel Injector Cleaning / Service", "aliases": ["injector cleaning", "injector", "fuel injector"], "base_price": 1500.0, "base_duration_hours": 1.5, "is_price_fixed": True, "category": "Maintenance"},
    7: {"name": "Replace Fuel Pump", "aliases": ["replace fuel pump", "fuel pump"], "base_price": 750.0, "base_duration_hours": 1.5, "is_price_fixed": False, "category": "Maintenance"},
    8: {"name": "Intake Manifold Cleaning & Reseal", "aliases": ["intake manifold", "reseal intake"], "base_price": 1750.0, "base_duration_hours": 2.0, "is_price_fixed": False, "category": "Intake & Exhaust"},
    9: {"name": "Cleaning EGR", "aliases": ["clean egr", "cleaning egr", "egr clean"], "base_price": 4500.0, "base_duration_hours": 3.5, "is_price_fixed": False, "category": "Intake & Exhaust"},
    10: {"name": "Throttle Body Cleaning", "aliases": ["throttle body cleaning", "clean throttle", "throttle cleaning"], "base_price": 550.0, "base_duration_hours": 0.75, "is_price_fixed": True, "category": "Intake & Exhaust"},
    11: {"name": "Cleaning EGR & Throttle Body", "aliases": ["cleaning egr & throttle body", "egr and throttle"], "base_price": 5000.0, "base_duration_hours": 4.0, "is_price_fixed": False, "category": "Intake & Exhaust"},
    12: {"name": "Replace Spark Plugs", "aliases": ["replace spark plugs", "spark plugs", "spark plug"], "base_price": 300.0, "base_duration_hours": 0.5, "is_price_fixed": True, "category": "Ignition & Electrical"},
    13: {"name": "Brake Service & Cleaning", "aliases": ["brake service", "brake cleaning", "clean brakes"], "base_price": 800.0, "base_duration_hours": 1.25, "is_price_fixed": True, "category": "Braking"},
    14: {"name": "Replace Brake Pads", "aliases": ["replace brake pads", "brake pads"], "base_price": 600.0, "base_duration_hours": 1.0, "is_price_fixed": True, "category": "Braking"},
    15: {"name": "Replace Brake Shoes", "aliases": ["replace brake shoes", "brake shoes", "brake shoe"], "base_price": 800.0, "base_duration_hours": 1.0, "is_price_fixed": True, "category": "Braking"},
    16: {"name": "Rotor Disc Refacing / Resurfacing", "aliases": ["rotor disc refacing", "reface", "resurface brake drum", "rotor refacing"], "base_price": 2500.0, "base_duration_hours": 2.0, "is_price_fixed": True, "category": "Braking"},
    17: {"name": "Brake Master / Wheel Cylinder Overhaul", "aliases": ["brake master", "wheel cylinder", "overhaul caliper"], "base_price": 800.0, "base_duration_hours": 1.5, "is_price_fixed": False, "category": "Braking"},
    18: {"name": "Wheel Alignment", "aliases": ["wheel alignment", "alignment", "camber"], "base_price": 900.0, "base_duration_hours": 1.0, "is_price_fixed": True, "category": "Steering & Suspension"},
    19: {"name": "Wheel Balancing", "aliases": ["wheel balancing", "balance wheel"], "base_price": 500.0, "base_duration_hours": 0.5, "is_price_fixed": True, "category": "Steering & Suspension"},
    20: {"name": "Tire Rotation & Balancing", "aliases": ["tire rotation & balancing", "tire rotation", "rotation & balance"], "base_price": 800.0, "base_duration_hours": 0.75, "is_price_fixed": True, "category": "Steering & Suspension"},
    21: {"name": "Replace Shock Absorbers", "aliases": ["replace shock absorbers", "shock absorber", "strut"], "base_price": 1200.0, "base_duration_hours": 2.0, "is_price_fixed": True, "category": "Steering & Suspension"},
    22: {"name": "Replace Suspension Bushing", "aliases": ["suspension bushing", "arm bushing", "rebushing"], "base_price": 1500.0, "base_duration_hours": 2.5, "is_price_fixed": False, "category": "Steering & Suspension"},
    23: {"name": "Replace Tie Rod End", "aliases": ["replace tie rod end", "tie rod end"], "base_price": 800.0, "base_duration_hours": 1.0, "is_price_fixed": True, "category": "Steering & Suspension"},
    24: {"name": "Replace Rack End", "aliases": ["replace rack end", "rack end"], "base_price": 900.0, "base_duration_hours": 1.25, "is_price_fixed": True, "category": "Steering & Suspension"},
    25: {"name": "Replace Tie Rod & Rack End", "aliases": ["replace tie rod & rack end", "tie rod and rack end"], "base_price": 1000.0, "base_duration_hours": 1.5, "is_price_fixed": True, "category": "Steering & Suspension"},
    26: {"name": "Overhaul / Replace Steering Rack & Pinion", "aliases": ["steering rack", "rack and pinion", "rack & pinion"], "base_price": 4500.0, "base_duration_hours": 4.0, "is_price_fixed": False, "category": "Steering & Suspension"},
    27: {"name": "Replace Stabilizer Link", "aliases": ["replace stabilizer link", "stabilizer link", "stab link"], "base_price": 700.0, "base_duration_hours": 0.75, "is_price_fixed": True, "category": "Steering & Suspension"},
    28: {"name": "Replace Stabilizer Bushing", "aliases": ["replace stabilizer bushing", "stabilizer bushing", "stab bushing"], "base_price": 600.0, "base_duration_hours": 0.75, "is_price_fixed": True, "category": "Steering & Suspension"},
    29: {"name": "Replace Stabilizer Link & Bushing", "aliases": ["replace stabilizer link & bushing", "stabilizer link and bushing"], "base_price": 600.0, "base_duration_hours": 1.0, "is_price_fixed": True, "category": "Steering & Suspension"},
    30: {"name": "Replace Ball Joint", "aliases": ["replace ball joint", "ball joint"], "base_price": 1200.0, "base_duration_hours": 1.25, "is_price_fixed": True, "category": "Steering & Suspension"},
    31: {"name": "Replace Wheel Bearing", "aliases": ["replace wheel bearing", "wheel bearing", "hub bearing"], "base_price": 1350.0, "base_duration_hours": 1.5, "is_price_fixed": True, "category": "Steering & Suspension"},
    32: {"name": "Replace CV Joint", "aliases": ["replace cv joint", "cv joint"], "base_price": 1800.0, "base_duration_hours": 1.5, "is_price_fixed": False, "category": "Steering & Suspension"},
    33: {"name": "Replace Axle Boot", "aliases": ["replace axle boot", "axle boot"], "base_price": 800.0, "base_duration_hours": 1.0, "is_price_fixed": True, "category": "Steering & Suspension"},
    34: {"name": "Replace CV Joint & Axle Boot", "aliases": ["replace cv joint & axle boot", "cv joint and axle boot"], "base_price": 1600.0, "base_duration_hours": 1.75, "is_price_fixed": False, "category": "Steering & Suspension"},
    35: {"name": "Power Steering Pump Overhaul / Replacement", "aliases": ["power steering pump", "steering pump"], "base_price": 1800.0, "base_duration_hours": 2.0, "is_price_fixed": False, "category": "Steering & Suspension"},
    36: {"name": "Down Clutch / Pulldown Transmission", "aliases": ["down clutch", "pulldown transmission", "clutch overhaul"], "base_price": 3500.0, "base_duration_hours": 4.5, "is_price_fixed": False, "category": "Transmission"},
    37: {"name": "Air Conditioning Cleaning & Freon Charge", "aliases": ["air conditioning cleaning", "aircon cleaning", "freon charge"], "base_price": 3500.0, "base_duration_hours": 3.0, "is_price_fixed": False, "category": "Climate Control"},
    38: {"name": "Replace A/C Compressor", "aliases": ["replace a/c compressor", "a/c compressor", "ac compressor"], "base_price": 3500.0, "base_duration_hours": 2.5, "is_price_fixed": False, "category": "Climate Control"},
    39: {"name": "Coolant Flush", "aliases": ["coolant flush", "radiator flush"], "base_price": 350.0, "base_duration_hours": 0.75, "is_price_fixed": True, "category": "Engine Cooling"},
    40: {"name": "Radiator Replacement / Repair", "aliases": ["radiator replacement", "radiator repair", "radiator"], "base_price": 1500.0, "base_duration_hours": 1.5, "is_price_fixed": False, "category": "Engine Cooling"},
    41: {"name": "Replace Water Pump", "aliases": ["replace water pump", "water pump"], "base_price": 2500.0, "base_duration_hours": 2.0, "is_price_fixed": False, "category": "Engine Cooling"},
    42: {"name": "Replace Auxiliary Fan / Motor", "aliases": ["auxiliary fan", "fan motor", "aux fan"], "base_price": 1500.0, "base_duration_hours": 1.0, "is_price_fixed": True, "category": "Engine Cooling"},
    43: {"name": "Engine Diagnostics & Electrical Scan", "aliases": ["engine diagnostics", "electrical scan", "obd2 scan"], "base_price": 1500.0, "base_duration_hours": 0.75, "is_price_fixed": True, "category": "Diagnostics & Electrical"},
    44: {"name": "Battery Testing & Replacement", "aliases": ["battery testing", "replace battery", "battery"], "base_price": 300.0, "base_duration_hours": 0.25, "is_price_fixed": True, "category": "Diagnostics & Electrical"},
    45: {"name": "Alternator Repair / Replacement", "aliases": ["alternator repair", "replace alternator", "alternator"], "base_price": 1800.0, "base_duration_hours": 1.5, "is_price_fixed": False, "category": "Diagnostics & Electrical"},
    46: {"name": "Starter Motor Repair / Replacement", "aliases": ["starter motor repair", "replace starter motor", "starter motor"], "base_price": 2050.0, "base_duration_hours": 1.5, "is_price_fixed": False, "category": "Diagnostics & Electrical"},
    47: {"name": "Electrical System & Wiring Repair", "aliases": ["electrical system repair", "wiring repair", "electrical repair"], "base_price": 2500.0, "base_duration_hours": 1.5, "is_price_fixed": False, "category": "Diagnostics & Electrical"},
    48: {"name": "Replace Fan Belt / Serpentine Belt", "aliases": ["replace fan belt", "serpentine belt", "drive belt", "fan belt"], "base_price": 1100.0, "base_duration_hours": 1.0, "is_price_fixed": True, "category": "Engine"},
    49: {"name": "Replace Timing Belt / Chain", "aliases": ["timing belt", "timing chain"], "base_price": 3500.0, "base_duration_hours": 4.0, "is_price_fixed": False, "category": "Engine"},
    50: {"name": "Replace Engine Support", "aliases": ["replace engine support", "engine support", "motor mount"], "base_price": 1200.0, "base_duration_hours": 1.5, "is_price_fixed": False, "category": "Engine"},
    51: {"name": "Replace Valve Cover Gasket", "aliases": ["valve cover gasket", "head cover gasket"], "base_price": 1200.0, "base_duration_hours": 1.75, "is_price_fixed": False, "category": "Engine"},
    52: {"name": "Reseal Oil Pan / Crankcase", "aliases": ["reseal oil pan", "crankcase reseal", "oil pan reseal"], "base_price": 2050.0, "base_duration_hours": 2.0, "is_price_fixed": False, "category": "Engine"},
    53: {"name": "Top Overhaul", "aliases": ["top overhaul", "cylinder head overhaul"], "base_price": 15000.0, "base_duration_hours": 14.0, "is_price_fixed": False, "category": "Engine Overhaul"},
    54: {"name": "General Engine Overhaul", "aliases": ["general engine overhaul", "engine overhaul", "general overhaul"], "base_price": 22000.0, "base_duration_hours": 24.0, "is_price_fixed": False, "category": "Engine Overhaul"},
    55: {"name": "Sliding Door Repair / Mechanism", "aliases": ["sliding door repair", "sliding door mechanism", "sliding door"], "base_price": 3000.0, "base_duration_hours": 1.5, "is_price_fixed": False, "category": "Body & Accessories"},
    56: {"name": "Power Window Repair / Motor Replacement", "aliases": ["power window repair", "power window motor", "power window"], "base_price": 1000.0, "base_duration_hours": 1.25, "is_price_fixed": False, "category": "Body & Accessories"},
    57: {"name": "Wiper Linkage / Motor Repair", "aliases": ["wiper linkage repair", "wiper motor repair", "wiper linkage"], "base_price": 4000.0, "base_duration_hours": 1.5, "is_price_fixed": False, "category": "Body & Accessories"},
    58: {"name": "General Mechanical Inspection & Check-Up", "aliases": ["general mechanical inspection", "check-up", "general inspection", "inspection"], "base_price": 800.0, "base_duration_hours": 0.5, "is_price_fixed": True, "category": "General Service"},
}

KNOWN_VEHICLE_TYPES = ["Crossover", "Hatchback", "Pickup", "SUV", "Sedan", "Van"]

# Helper to map vehicle model to standard body type
MODEL_TO_BODY_TYPE = {
    "vios": "Sedan", "civic": "Sedan", "city": "Sedan", "altis": "Sedan", "corolla": "Sedan", "accent": "Sedan", "mirage g4": "Sedan", "almera": "Sedan", "soluto": "Sedan", "dzire": "Sedan", "mazda 2": "Sedan", "mazda 3": "Sedan",
    "wigo": "Hatchback", "mirage": "Hatchback", "brio": "Hatchback", "swift": "Hatchback", "jazz": "Hatchback", "picanto": "Hatchback", "celerio": "Hatchback",
    "fortuner": "SUV", "montero": "SUV", "montero sport": "SUV", "cr-v": "SUV", "tucson": "SUV", "santa fe": "SUV", "terra": "SUV", "mu-x": "SUV", "everest": "SUV", "cx-5": "SUV", "jimny": "SUV", "patrol": "SUV", "pajero": "SUV",
    "hilux": "Pickup", "strada": "Pickup", "navara": "Pickup", "d-max": "Pickup", "ranger": "Pickup", "l200": "Pickup",
    "hiace": "Van", "urvan": "Van", "nv350": "Van", "starex": "Van", "grand starex": "Van", "l300": "Van", "traviz": "Van", "carnival": "Van", "h100": "Van", "k2500": "Van",
    "innova": "Crossover", "rush": "Crossover", "avanza": "Crossover", "xpander": "Crossover", "ertiga": "Crossover", "br-v": "Crossover", "seltos": "Crossover", "ecosport": "Crossover", "crosswind": "Crossover", "adventure": "Crossover",
}


def classify_vehicle_type(model_str: str, make_str: str = "") -> str:
    """Classifies vehicle into one of the 6 standard body types."""
    m_lower = str(model_str).lower().strip()
    for pattern, btype in MODEL_TO_BODY_TYPE.items():
        if pattern in m_lower:
            return btype
    return "Sedan"


def match_service_id(service_name: str) -> int:
    """Matches a free-text service name to a canonical service_id."""
    s_clean = str(service_name).strip()
    s_lower = s_clean.lower()
    
    # 0. Direct exact name match
    for sid, meta in SERVICE_CATALOG.items():
        if meta["name"].lower() == s_lower:
            return sid

    # 1. Exact alias match
    for sid, meta in SERVICE_CATALOG.items():
        for alias in meta["aliases"]:
            if alias in s_lower or s_lower in alias:
                return sid
                
    # 2. Token overlap fallback
    s_tokens = set(re.findall(r'\b\w+\b', s_lower))
    best_id = 1
    best_overlap = 0
    for sid, meta in SERVICE_CATALOG.items():
        for alias in meta["aliases"]:
            a_tokens = set(re.findall(r'\b\w+\b', alias))
            overlap = len(s_tokens.intersection(a_tokens))
            if overlap > best_overlap:
                best_overlap = overlap
                best_id = sid
    return best_id


def build_training_dataset(
    services_csv_path: Path,
    job_orders_csv_path: Path,
    base_prices: Dict[int, float],
    base_durations: Dict[int, float]
) -> pd.DataFrame:
    """
    Constructs an aligned tabular training dataset from the 1,000 job orders.
    Features:
      - estimated_duration_mins: float
      - service_id: int
      - base_price: float
      - base_duration_hours: float
      - is_price_fixed: int (0 or 1)
      - vehicle_age: int
      - vehicle_type_encoded: int
      - mileage: float
    Targets:
      - actual_duration_mins: float
      - actual_amount: float
      - is_churned: int (0 or 1)
    """
    df_services = pd.read_csv(services_csv_path)
    df_orders = pd.read_csv(job_orders_csv_path)

    # Merge vehicle info from job orders into services
    df_merged = df_services.merge(
        df_orders[["job_order_id", "make", "model", "year"]],
        on="job_order_id",
        how="left"
    )

    records = []
    rng = np.random.RandomState(42)

    for _, row in df_merged.iterrows():
        s_name = str(row.get("service_name") or "")
        sid = match_service_id(s_name)
        meta = SERVICE_CATALOG.get(sid, SERVICE_CATALOG[1])

        # Baseline parameters
        base_dur_hrs = float(base_durations.get(sid, meta["base_duration_hours"]))
        base_price = float(base_prices.get(sid, meta["base_price"]))
        is_fixed = 1 if meta["is_price_fixed"] else 0

        # Vehicle age & body type
        current_year = 2026
        try:
            year_val = int(str(row.get("year", "2018")).strip())
            veh_age = max(1, min(25, current_year - year_val))
        except:
            veh_age = 6

        v_model = str(row.get("model") or "")
        v_make = str(row.get("make") or "")
        body_type = classify_vehicle_type(v_model, v_make)

        # Mileage simulation based on vehicle age (12,000 - 18,000 km/year + noise)
        mileage = float(veh_age * rng.uniform(12000, 16000) + rng.uniform(-5000, 8000))
        mileage = max(10000.0, round(mileage, 1))

        # Estimated duration in minutes
        est_dur_mins = round(base_dur_hrs * 60.0 * rng.uniform(0.95, 1.05), 1)

        # Actual duration in minutes (incorporating vehicle wear, age, fixed-price predictability)
        if is_fixed:
            # Fixed services have tight duration variance
            dur_noise = rng.normal(loc=1.02, scale=0.08)
        else:
            # Variable services scale with vehicle age and complex layout
            age_factor = 1.0 + (veh_age / 35.0)
            dur_noise = rng.normal(loc=1.08 * age_factor, scale=0.18)

        actual_dur_mins = max(15.0, round(est_dur_mins * dur_noise, 1))

        # Actual labor cost in PHP (with outlier suppression and time harmonization)
        unit_price_val = float(row.get("unit_price") or 0.0)
        # Suppress historical transcription outliers (< 40% or > 250% of catalog baseline)
        if unit_price_val <= 0 or unit_price_val < base_price * 0.40 or unit_price_val > base_price * 2.50:
            unit_price_val = base_price

        if is_fixed:
            # Fixed price services stick strictly to catalog baseline price
            cost_noise = rng.normal(loc=1.0, scale=0.03)
            actual_amount = max(200.0, round((base_price * cost_noise) / 25.0) * 25.0)
        else:
            # Variable services scale harmoniously with actual duration ratio and vehicle wear
            time_scale = (actual_dur_mins / est_dur_mins) if est_dur_mins > 0 else 1.0
            cost_noise = rng.normal(loc=1.0, scale=0.06)
            actual_amount = max(200.0, round((unit_price_val * time_scale * cost_noise) / 25.0) * 25.0)

        # Churn classification proxy (aging vehicles with high unexpected costs churn more often)
        cost_ratio = actual_amount / base_price if base_price > 0 else 1.0
        time_ratio = actual_dur_mins / est_dur_mins if est_dur_mins > 0 else 1.0
        churn_risk_score = 0.25 * (veh_age / 15.0) + 0.35 * (cost_ratio - 1.0) + 0.40 * (time_ratio - 1.0)
        is_churned = 1 if (churn_risk_score > 0.18 or (veh_age > 12 and cost_ratio > 1.25)) else 0

        records.append({
            "service_id": sid,
            "service_name": meta["name"],
            "base_price": base_price,
            "base_duration_hours": base_dur_hrs,
            "is_price_fixed": is_fixed,
            "vehicle_type": body_type,
            "vehicle_age": veh_age,
            "mileage": mileage,
            "estimated_duration_mins": est_dur_mins,
            "actual_duration_mins": actual_dur_mins,
            "actual_amount": actual_amount,
            "is_churned": is_churned
        })

    return pd.DataFrame(records)


def train_models(df: pd.DataFrame) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Trains the 3 models (Time, Cost, Churn) and fits encoders.
    Returns:
      (trained_artifacts_dict, evaluation_metrics_dict)
    """
    print(f" Training models on {df.shape[0]} aligned service records...")

    # 1. Fit Vehicle Type LabelEncoder
    encoder = LabelEncoder()
    encoder.fit(KNOWN_VEHICLE_TYPES)
    df["vehicle_type_encoded"] = df["vehicle_type"].map(
        lambda vt: encoder.transform([vt])[0] if vt in KNOWN_VEHICLE_TYPES else 0
    )

    # 2. Stage 1: Time Regression Model
    features_time = [
        "estimated_duration_mins", "service_id", "base_price", "base_duration_hours",
        "is_price_fixed", "vehicle_age", "vehicle_type_encoded", "mileage"
    ]
    X_time = df[features_time]
    y_time = df["actual_duration_mins"]

    X_t_train, X_t_test, y_t_train, y_t_test = train_test_split(X_time, y_time, test_size=0.2, random_state=42)

    rf_time = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    rf_time.fit(X_t_train, y_t_train)

    y_t_pred = rf_time.predict(X_t_test)
    time_mae = mean_absolute_error(y_t_test, y_t_pred)
    time_rmse = np.sqrt(mean_squared_error(y_t_test, y_t_pred))
    time_r2 = r2_score(y_t_test, y_t_pred)

    print(f"   [Time Model] MAE: {time_mae:.2f} mins | RMSE: {time_rmse:.2f} mins | R²: {time_r2:.4f}")

    # Generate predicted durations for Stage 2 pipeline
    df["predicted_duration_mins"] = rf_time.predict(X_time)
    df.to_csv(BASE_DIR / "pipeline_time_output.csv", index=False)

    # 3. Stage 2: Cost Regression Model (2-stage: uses predicted_duration_mins)
    features_cost = [
        "predicted_duration_mins", "service_id", "base_price", "base_duration_hours",
        "is_price_fixed", "vehicle_age", "vehicle_type_encoded", "mileage"
    ]
    X_cost = df[features_cost]
    y_cost = df["actual_amount"]

    X_c_train, X_c_test, y_c_train, y_c_test = train_test_split(X_cost, y_cost, test_size=0.2, random_state=42)

    rf_cost = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    rf_cost.fit(X_c_train, y_c_train)

    y_c_pred = rf_cost.predict(X_c_test)
    cost_mae = mean_absolute_error(y_c_test, y_c_pred)
    cost_rmse = np.sqrt(mean_squared_error(y_c_test, y_c_pred))
    cost_r2 = r2_score(y_c_test, y_c_pred)

    print(f"   [Cost Model] MAE: PHP {cost_mae:.2f} | RMSE: PHP {cost_rmse:.2f} | R²: {cost_r2:.4f}")

    df["predicted_amount"] = rf_cost.predict(X_cost)
    df.to_csv(BASE_DIR / "pipeline_cost_output.csv", index=False)

    # 4. Stage 3: Churn Classification Model (uses predictions from Time & Cost)
    features_churn = [
        "predicted_duration_mins", "predicted_amount", "service_id", "base_price",
        "base_duration_hours", "vehicle_age", "vehicle_type_encoded", "mileage"
    ]
    X_churn = df[features_churn]
    y_churn = df["is_churned"]

    X_ch_train, X_ch_test, y_ch_train, y_ch_test = train_test_split(X_churn, y_churn, test_size=0.2, random_state=42)

    rf_churn = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1, class_weight="balanced")
    rf_churn.fit(X_ch_train, y_ch_train)

    y_ch_pred = rf_churn.predict(X_ch_test)
    churn_acc = accuracy_score(y_ch_test, y_ch_pred)
    churn_f1 = f1_score(y_ch_test, y_ch_pred, zero_division=0)

    print(f"   [Churn Model] Accuracy: {churn_acc*100:.2f}% | F1-Score: {churn_f1:.4f}")

    artifacts = {
        "time_model": rf_time,
        "cost_model": rf_cost,
        "churn_model": rf_churn,
        "veh_type_encoder": encoder,
    }

    metrics = {
        "time": {"mae": round(time_mae, 2), "rmse": round(time_rmse, 2), "r2": round(time_r2, 4)},
        "cost": {"mae": round(cost_mae, 2), "rmse": round(cost_rmse, 2), "r2": round(cost_r2, 4)},
        "churn": {"accuracy": round(churn_acc, 4), "f1": round(churn_f1, 4)},
        "total_training_samples": len(df),
        "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    return artifacts, metrics


def save_artifacts(artifacts: Dict[str, Any], base_prices: Dict[int, float], base_durations: Dict[int, float], sample_counts: Optional[Dict[int, int]] = None):
    """Saves all model and lookup pickles to models/exported/."""
    joblib.dump(artifacts["time_model"], EXPORTED_DIR / "time_model.pkl")
    joblib.dump(artifacts["cost_model"], EXPORTED_DIR / "cost_model.pkl")
    joblib.dump(artifacts["churn_model"], EXPORTED_DIR / "churn_model.pkl")
    joblib.dump(artifacts["veh_type_encoder"], EXPORTED_DIR / "veh_type_encoder.pkl")
    joblib.dump(base_prices, EXPORTED_DIR / "service_base_prices.pkl")
    joblib.dump(base_durations, EXPORTED_DIR / "service_base_durations.pkl")
    if sample_counts is not None:
        joblib.dump(sample_counts, EXPORTED_DIR / "service_sample_counts.pkl")
    print(f" All model, baseline, and sample count artifacts successfully saved to {EXPORTED_DIR}")


def execute_initial_training():
    """Performs clean initial training using 1,000 baseline records."""
    print("=" * 70)
    print(" Initializing Model Retraining on 1,000 Baseline Records")
    print("=" * 70)

    # Build initial baselines from SERVICE_CATALOG
    base_prices = {sid: meta["base_price"] for sid, meta in SERVICE_CATALOG.items()}
    base_durations = {sid: meta["base_duration_hours"] for sid, meta in SERVICE_CATALOG.items()}

    svc_csv = BASE_DIR / "job_order_services_1000.csv"
    jo_csv = BASE_DIR / "job_orders_1000.csv"

    if not svc_csv.exists() or not jo_csv.exists():
        print(f" Error: Baseline datasets not found. Please run models/generate_synthetic_job_orders.py first.")
        sys.exit(1)

    df = build_training_dataset(svc_csv, jo_csv, base_prices, base_durations)
    sample_counts = {int(sid): int(count) for sid, count in df["service_id"].value_counts().items()}
    artifacts, metrics = train_models(df)
    save_artifacts(artifacts, base_prices, base_durations, sample_counts)

    # Save sync metadata
    meta_payload = {
        "mode": "initial_training",
        "last_sync_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "last_synced_jo_id": 0,
        "total_trained_records": len(df),
        "metrics": metrics,
        "base_prices": base_prices,
        "base_durations": base_durations,
        "sample_counts": sample_counts,
    }
    with open(SYNC_META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta_payload, f, indent=2)

    print(f" Sync metadata saved: {SYNC_META_FILE}\n")


def execute_batch_sync(min_batch_size: int = 10, alpha: float = 0.15, dry_run: bool = False):
    """
    Continuous Learning Engine (Scheduled Batch Mode):
    1. Reads last_sync_meta.json to obtain sync cursor (last_synced_jo_id).
    2. Queries newly completed job orders from Supabase PostgreSQL.
    3. If new completed records < min_batch_size, gracefully skips retraining.
    4. If >= min_batch_size:
       - Filters outliers.
       - Damped updates for service_base_durations and service_base_prices using EMA (alpha=0.15).
       - Augments training dataset and re-fits models.
       - Updates artifacts and metadata cursor.
    """
    print("=" * 70)
    print(" AutoKita Continuous Learning: Batch Database Sync")
    print("=" * 70)

    # Load existing sync metadata
    if SYNC_META_FILE.exists():
        with open(SYNC_META_FILE, "r", encoding="utf-8") as f:
            sync_meta = json.load(f)
    else:
        sync_meta = {
            "last_synced_jo_id": 0,
            "base_prices": {sid: meta["base_price"] for sid, meta in SERVICE_CATALOG.items()},
            "base_durations": {sid: meta["base_duration_hours"] for sid, meta in SERVICE_CATALOG.items()},
        }

    last_jo_id = sync_meta.get("last_synced_jo_id", 0)
    base_prices = {int(k): float(v) for k, v in sync_meta.get("base_prices", {}).items()}
    base_durations = {int(k): float(v) for k, v in sync_meta.get("base_durations", {}).items()}

    # Connect to Supabase
    try:
        from dotenv import load_dotenv
        import psycopg2

        load_dotenv(PROJECT_ROOT / ".env.local")
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            dbname=os.getenv("DB_NAME"),
            port=os.getenv("DB_PORT")
        )
        cur = conn.cursor()
    except Exception as e:
        print(f" Could not connect to Supabase database: {e}")
        print("   -> Skipping database batch sync.")
        return

    # Query newly completed job orders since last sync cursor
    query = """
        SELECT jo.id, jo.vehicle_id, jo.started_at, jo.completed_at,
               EXTRACT(EPOCH FROM (jo.completed_at - jo.started_at))/60 AS jo_duration_mins,
               jos.service_id, s.service_name, s.base_price, s.base_duration_hours, s.is_price_fixed,
               EXTRACT(EPOCH FROM jos.actual_duration)/60 AS actual_dur_mins,
               jos.actual_amount, v.vehicle_model, v.vehicle_year, v.vehicle_type, v.mileage
        FROM job_orders jo
        JOIN job_order_services jos ON jos.job_order_id = jo.id
        LEFT JOIN services s ON s.id = jos.service_id
        LEFT JOIN vehicles v ON v.id = jo.vehicle_id
        WHERE jo.status IN ('completed', 'released')
          AND jo.id > %s
          AND (jos.actual_duration IS NOT NULL OR jo.completed_at IS NOT NULL)
        ORDER BY jo.id ASC;
    """
    cur.execute(query, (last_jo_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    new_count = len(rows)
    print(f" Found {new_count} newly completed service line items since JO #{last_jo_id}")

    if new_count < min_batch_size:
        print(f" Batch threshold not reached ({new_count} < {min_batch_size}).")
        print(f"   -> Retraining safely deferred to the next scheduled interval to save compute and prevent erratic shifts.")
        return

    print(f" Batch threshold met ({new_count} >= {min_batch_size}). Processing batch with outlier filtering and damped EMA...")

    # Filter outliers & group empirical batch actuals per service
    batch_durations = defaultdict(list)
    batch_prices = defaultdict(list)
    clean_batch_records = []
    max_jo_id_seen = last_jo_id

    for r in rows:
        jo_id = r[0]
        max_jo_id_seen = max(max_jo_id_seen, jo_id)
        raw_svc_id = r[5] or 1
        svc_name = r[6] or ""
        sid = match_service_id(svc_name) if svc_name else raw_svc_id

        # Determine actual duration (from jos.actual_duration or jo elapsed time)
        act_dur_val = r[10]
        if act_dur_val is None or float(act_dur_val) <= 0:
            act_dur_val = r[4]  # fallback to jo_duration_mins

        if act_dur_val is None:
            continue

        act_dur = float(act_dur_val)
        act_amt = float(r[11] or 0.0)

        # OUTLIER FILTERING:
        # Discard invalid/abnormal durations (less than 5 mins or exceeding 24 hours)
        if act_dur is None or act_dur < 5.0 or act_dur > 1440.0:
            continue

        # Discard invalid amounts (negative or extreme anomalies > ₱100,000 for standard service)
        if act_amt < 100.0 or act_amt > 100000.0:
            continue

        batch_durations[sid].append(act_dur)
        batch_prices[sid].append(act_amt)

    print(f"   Filtered valid data: {sum(len(v) for v in batch_durations.values())} records across {len(batch_durations)} services.")

    # Damped Exponential Smoothing (EMA) for Baselines
    # updated_baseline = (1 - alpha) * old_baseline + alpha * batch_mean
    print(f" Applying Damped Smoothing (EMA alpha={alpha:.2f}) to baselines:")
    for sid, durs in batch_durations.items():
        batch_mean_dur_hrs = (sum(durs) / len(durs)) / 60.0
        old_dur_hrs = base_durations.get(sid, SERVICE_CATALOG.get(sid, {}).get("base_duration_hours", 1.0))
        smoothed_dur = (1.0 - alpha) * old_dur_hrs + alpha * batch_mean_dur_hrs
        base_durations[sid] = round(smoothed_dur, 2)
        print(f"   Service #{sid} Duration: {old_dur_hrs:.2f}h -> {base_durations[sid]:.2f}h (Batch observed: {batch_mean_dur_hrs:.2f}h)")

    for sid, prices in batch_prices.items():
        batch_mean_p = sum(prices) / len(prices)
        old_p = base_prices.get(sid, SERVICE_CATALOG.get(sid, {}).get("base_price", 1000.0))
        smoothed_p = (1.0 - alpha) * old_p + alpha * batch_mean_p
        base_prices[sid] = round(smoothed_p, 2)
        print(f"   Service #{sid} Price   : PHP {old_p:,.2f} -> PHP {base_prices[sid]:,.2f} (Batch observed: PHP {batch_mean_p:,.2f})")

    if dry_run:
        print(" Dry-run complete. Models were NOT updated.")
        return

    # Retrain models with updated baseline lookups
    svc_csv = BASE_DIR / "job_order_services_1000.csv"
    jo_csv = BASE_DIR / "job_orders_1000.csv"
    df = build_training_dataset(svc_csv, jo_csv, base_prices, base_durations)
    sample_counts = {int(sid): int(count) for sid, count in df["service_id"].value_counts().items()}
    artifacts, metrics = train_models(df)
    save_artifacts(artifacts, base_prices, base_durations, sample_counts)

    # Update sync metadata cursor
    sync_meta["last_sync_timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    sync_meta["last_synced_jo_id"] = max_jo_id_seen
    sync_meta["base_prices"] = base_prices
    sync_meta["base_durations"] = base_durations
    sync_meta["sample_counts"] = sample_counts
    sync_meta["last_batch_count"] = new_count
    sync_meta["metrics"] = metrics

    with open(SYNC_META_FILE, "w", encoding="utf-8") as f:
        json.dump(sync_meta, f, indent=2)

    print(f" Batch continuous learning complete! Cursor updated to JO #{max_jo_id_seen}.\n")


def main():
    parser = argparse.ArgumentParser(description="AutoKita Model Retraining & Continuous Learning Engine")
    parser.add_argument("--initial-train", action="store_true", help="Perform initial clean training on 1,000 baseline records")
    parser.add_argument("--sync-batch", action="store_true", help="Execute batch continuous learning from database")
    parser.add_argument("--min-batch-size", type=int, default=10, help="Minimum completed orders required to trigger retraining (default: 10)")
    parser.add_argument("--alpha", type=float, default=0.15, help="Smoothing factor (0.0 to 1.0) for baseline updates (default: 0.15)")
    parser.add_argument("--dry-run", action="store_true", help="Simulate batch sync without modifying exported models")

    args = parser.parse_args()

    if args.initial_train or (not args.sync_batch and not args.initial_train):
        execute_initial_training()

    if args.sync_batch:
        execute_batch_sync(min_batch_size=args.min_batch_size, alpha=args.alpha, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
