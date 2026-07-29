"""
Run this script in terminal before using the website for ML stuff
"""
import os
import joblib
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Loading
BASE = os.path.dirname(os.path.abspath(__file__))
EXPORTED = os.path.join(BASE, 'exported')

time_model      = joblib.load(os.path.join(EXPORTED, 'time_model.pkl'))
cost_model      = joblib.load(os.path.join(EXPORTED, 'cost_model.pkl'))
churn_model     = joblib.load(os.path.join(EXPORTED, 'churn_model.pkl'))
veh_encoder     = joblib.load(os.path.join(EXPORTED, 'veh_type_encoder.pkl'))

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
      estimated_duration_mins, actual_amount, service_id, base_price,
      base_duration_hours, is_price_fixed, vehicle_age, vehicle_type
    Can also accept an array of objects for batch prediction.
    """
    data = request.json
    if isinstance(data, dict):
        data = [data]

    results = []
    for item in data:
        vtype_enc = encode_vehicle_type(item.get('vehicle_type'))
        features = np.array([[
            float(item.get('estimated_duration_mins', 60)),
            float(item.get('actual_amount', item.get('amount', 0))),
            int(item.get('service_id', 0)),
            float(item.get('base_price', 0)),
            float(item.get('base_duration_hours', 1)),
            int(item.get('is_price_fixed', 0)),
            int(item.get('vehicle_age', 5)),
            vtype_enc,
        ]])
        pred = time_model.predict(features)[0]
        results.append({'predicted_duration_mins': round(float(pred), 2)})

    if len(results) == 1:
        return jsonify(results[0])
    return jsonify(results)


@app.route('/predict/cost', methods=['POST'])
def predict_cost():
    """
    Predict labor cost.
    Expects JSON body with fields:
      predicted_duration_mins, base_price, base_duration_hours,
      is_price_fixed, vehicle_age, vehicle_type
    Can also accept an array for batch prediction.
    """
    data = request.json
    if isinstance(data, dict):
        data = [data]

    results = []
    for item in data:
        vtype_enc = encode_vehicle_type(item.get('vehicle_type'))
        features = np.array([[
            float(item.get('predicted_duration_mins', 60)),
            float(item.get('base_price', 0)),
            float(item.get('base_duration_hours', 1)),
            int(item.get('is_price_fixed', 0)),
            int(item.get('vehicle_age', 5)),
            vtype_enc,
        ]])
        pred = cost_model.predict(features)[0]
        results.append({'predicted_amount': round(float(pred), 2)})

    if len(results) == 1:
        return jsonify(results[0])
    return jsonify(results)


@app.route('/predict/churn', methods=['POST'])
def predict_churn():
    """
    Classify churn risk for customers.
    Expects JSON body as an array of objects with fields:
      predicted_duration_mins, predicted_amount, base_price,
      base_duration_hours, vehicle_age, vehicle_type
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
            float(item.get('base_price', 0)),
            float(item.get('base_duration_hours', 1)),
            int(item.get('vehicle_age', 5)),
            vtype_enc,
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
    app.run(host='0.0.0.0', port=5001, debug=False)
