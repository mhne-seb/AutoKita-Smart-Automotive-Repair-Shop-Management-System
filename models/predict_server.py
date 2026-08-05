"""
Run this script in terminal before using the website for ML stuff
"""
import os
import warnings
import joblib
import numpy as np

# Suppress sklearn's valid feature names warnings when predicting with numpy arrays
warnings.filterwarnings("ignore", message="X does not have valid feature names")
from flask import Flask, request, jsonify
from flask_cors import CORS
from waitress import serve

app = Flask(__name__)
CORS(app)

# Loading
BASE = os.path.dirname(os.path.abspath(__file__))
EXPORTED = os.path.join(BASE, 'exported')

time_model      = joblib.load(os.path.join(EXPORTED, 'time_model.pkl'))
cost_model      = joblib.load(os.path.join(EXPORTED, 'cost_model.pkl'))
churn_model     = joblib.load(os.path.join(EXPORTED, 'churn_model.pkl'))
veh_encoder     = joblib.load(os.path.join(EXPORTED, 'veh_type_encoder.pkl'))

# Load base-price lookup (service_id -> avg base_price) for ratio-based cost model
_svc_bp_path = os.path.join(EXPORTED, 'service_base_prices.pkl')
service_base_prices: dict = joblib.load(_svc_bp_path) if os.path.exists(_svc_bp_path) else {}

_svc_bd_path = os.path.join(EXPORTED, 'service_base_durations.pkl')
service_base_durations: dict = joblib.load(_svc_bd_path) if os.path.exists(_svc_bd_path) else {}

# Get encoder
KNOWN_TYPES = set(veh_encoder.classes_)

def encode_vehicle_type(vtype):
    """Safely encode a vehicle type, defaulting to 'Unknown' if unseen."""
    if vtype and vtype in KNOWN_TYPES:
        return int(veh_encoder.transform([vtype])[0])
    # Use the most common type as fallback
    return int(veh_encoder.transform([veh_encoder.classes_[0]])[0])


@app.route('/predict/time', methods=['POST'])
def predict_time():
    """
    Predict actual service duration in minutes.
    Expects JSON body with fields:
      estimated_duration_mins, service_id, base_price,
      base_duration_hours, is_price_fixed, vehicle_age, vehicle_type, mileage
    Can also accept an array of objects for batch prediction.
    NOTE: actual_amount is no longer a feature (data leakage fix).
    """
    data = request.json
    if isinstance(data, dict):
        data = [data]

    results = []
    for item in data:
        vtype_enc = encode_vehicle_type(item.get('vehicle_type'))
        features = np.array([[
            int(item.get('service_id', 0)),
            int(item.get('is_price_fixed', 0)),
            int(item.get('vehicle_age', 5)),
            vtype_enc,
            float(item.get('mileage', item.get('vehicle_age', 5) * 15000)),
        ]])
        time_ratio = time_model.predict(features)[0]
        
        base_dur_hrs = float(item.get('base_duration_hours', 0))
        if base_dur_hrs <= 0:
            svc_id = int(item.get('service_id', 0))
            base_dur_hrs = float(service_base_durations.get(svc_id, 1.0))
            
        predicted_mins = round(time_ratio * base_dur_hrs * 60, 2)
        results.append({'predicted_duration_mins': predicted_mins, 'time_ratio': round(float(time_ratio), 4)})

    if len(results) == 1:
        return jsonify(results[0])
    return jsonify(results)


@app.route('/predict/cost', methods=['POST'])
def predict_cost():
    """
    Predict labor cost AND time in a 2-stage pipeline.
    Expects JSON body with fields:
      service_id, base_price, base_duration_hours,
      is_price_fixed, vehicle_age, vehicle_type, mileage
    Can also accept an array for batch prediction.
    """
    data = request.json
    if isinstance(data, dict):
        data = [data]

    results = []
    for item in data:
        vtype_enc = encode_vehicle_type(item.get('vehicle_type'))
        
        # 1. Predict Time Ratio using ONLY vehicle features
        features_t = np.array([[
            int(item.get('service_id', 0)),
            int(item.get('is_price_fixed', 0)),
            int(item.get('vehicle_age', 5)),
            vtype_enc,
            float(item.get('mileage', item.get('vehicle_age', 5) * 15000)),
        ]])
        time_ratio = time_model.predict(features_t)[0]
        
        base_dur_hrs = float(item.get('base_duration_hours', 0))
        if base_dur_hrs <= 0:
            svc_id = int(item.get('service_id', 0))
            base_dur_hrs = float(service_base_durations.get(svc_id, 1.0))
        
        pred_time = round(time_ratio * base_dur_hrs * 60, 2)

        # 2. Predict Cost Ratio using the PREDICTED TIME from step 1
        features_c = np.array([[
            float(pred_time), # The Cost Model now explicitly depends on the predicted time!
            int(item.get('service_id', 0)),
            int(item.get('is_price_fixed', 0)),
            int(item.get('vehicle_age', 5)),
            vtype_enc,
            float(item.get('mileage', item.get('vehicle_age', 5) * 15000)),
        ]])
        ratio = cost_model.predict(features_c)[0]
        
        base_price = float(item.get('base_price', 0))
        if base_price <= 0:
            svc_id = int(item.get('service_id', 0))
            base_price = float(service_base_prices.get(svc_id, 1500))
            
        pred_cost = round(ratio * base_price, 2)

        results.append({
            'predicted_duration_mins': pred_time,
            'predicted_amount': pred_cost,
            'time_ratio': round(float(time_ratio), 4),
            'price_ratio': round(float(ratio), 4)
        })

    if len(results) == 1:
        return jsonify(results[0])
    return jsonify(results)


@app.route('/predict/churn', methods=['POST'])
def predict_churn():
    """
    Classify churn risk for customers.
    Expects JSON body as an array of objects with fields:
      predicted_duration_mins, predicted_amount, service_id, base_price,
      base_duration_hours, vehicle_age, vehicle_type, mileage
    Returns array of { is_churned, churn_probability }.
    """
    data = request.json
    if not isinstance(data, list):
        data = [data]

    results = []
    for item in data:
        vtype_enc = encode_vehicle_type(item.get('vehicle_type'))
        features = np.array([[
            float(item.get('predicted_duration_mins', 60)),
            float(item.get('predicted_amount', 0)),
            int(item.get('service_id', 0)),
            float(item.get('base_price', 0)),
            float(item.get('base_duration_hours', 1)),
            int(item.get('vehicle_age', 5)),
            vtype_enc,
            float(item.get('mileage', item.get('vehicle_age', 5) * 15000)),
        ]])
        pred = int(churn_model.predict(features)[0])
        proba = churn_model.predict_proba(features)[0]
        # proba[1] = probability of churning
        churn_prob = float(proba[1]) if len(proba) > 1 else 0.0
        results.append({
            'is_churned': pred,
            'churn_probability': round(churn_prob, 4),
        })

    return jsonify(results)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'models_loaded': True})


if __name__ == '__main__':
    print("ML Prediction Server starting on http://localhost:5001")
    print(f"   Models loaded from: {EXPORTED}")
    print(f"   Known vehicle types: {sorted(KNOWN_TYPES)}")
    serve(app, host='0.0.0.0', port=5001, threads=8)
