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

# Load base-price lookup (service_id -> avg base_price) 
_svc_bp_path = os.path.join(EXPORTED, 'service_base_prices.pkl')
service_base_prices: dict = joblib.load(_svc_bp_path) if os.path.exists(_svc_bp_path) else {}

_svc_bd_path = os.path.join(EXPORTED, 'service_base_durations.pkl')
service_base_durations: dict = joblib.load(_svc_bd_path) if os.path.exists(_svc_bd_path) else {}

# Get encoder
KNOWN_TYPES = set(veh_encoder.classes_)

def encode_vehicle_type(vtype):
    if vtype and vtype in KNOWN_TYPES:
        return int(veh_encoder.transform([vtype])[0])
    return int(veh_encoder.transform([veh_encoder.classes_[0]])[0])

@app.route('/predict/time', methods=['POST'])
def predict_time():
    """
    Predict actual service duration in minutes.
    """
    data = request.json
    if isinstance(data, dict):
        data = [data]

    results = []
    features_list = []
    metadata = []
    
    for item in data:
        vtype_enc = encode_vehicle_type(item.get('vehicle_type'))
        svc_id = int(item.get('service_id', 0))
        base_dur_hrs = float(item.get('base_duration_hours', 0))
        if base_dur_hrs <= 0:
            base_dur_hrs = float(service_base_durations.get(svc_id, 1.0))
            
        base_price = float(item.get('base_price', 0))
        if base_price <= 0:
            base_price = float(service_base_prices.get(svc_id, 1500))

        est_dur_mins = float(item.get('estimated_duration_mins', base_dur_hrs * 60))

        features_list.append([
            est_dur_mins,
            svc_id,
            base_price,
            base_dur_hrs,
            int(item.get('is_price_fixed', 0)),
            int(item.get('vehicle_age', 5)),
            vtype_enc,
            float(item.get('mileage', item.get('vehicle_age', 5) * 15000)),
        ])
        metadata.append({'base_dur_hrs': base_dur_hrs})
        
    if features_list:
        features_arr = np.array(features_list)
        preds = time_model.predict(features_arr)
        
        for i, pred in enumerate(preds):
            predicted_mins = float(pred)
            base_dur_hrs = metadata[i]['base_dur_hrs']
            time_ratio = predicted_mins / (base_dur_hrs * 60) if base_dur_hrs > 0 else 1.0
            results.append({'predicted_duration_mins': round(predicted_mins, 2), 'time_ratio': round(time_ratio, 4)})

    if len(results) == 1:
        return jsonify(results[0])
    return jsonify(results)


@app.route('/predict/cost', methods=['POST'])
def predict_cost():
    """
    Predict labor cost AND time in a 2-stage pipeline.
    """
    data = request.json
    if isinstance(data, dict):
        data = [data]

    results = []
    features_t_list = []
    metadata = []
    
    for item in data:
        vtype_enc = encode_vehicle_type(item.get('vehicle_type'))
        svc_id = int(item.get('service_id', 0))
        base_dur_hrs = float(item.get('base_duration_hours', 0))
        if base_dur_hrs <= 0:
            base_dur_hrs = float(service_base_durations.get(svc_id, 1.0))
            
        base_price = float(item.get('base_price', 0))
        if base_price <= 0:
            base_price = float(service_base_prices.get(svc_id, 1500))

        est_dur_mins = float(item.get('estimated_duration_mins', base_dur_hrs * 60))

        features_t_list.append([
            est_dur_mins,
            svc_id,
            base_price,
            base_dur_hrs,
            int(item.get('is_price_fixed', 0)),
            int(item.get('vehicle_age', 5)),
            vtype_enc,
            float(item.get('mileage', item.get('vehicle_age', 5) * 15000)),
        ])
        metadata.append({'item': item, 'vtype_enc': vtype_enc, 'svc_id': svc_id, 'base_dur_hrs': base_dur_hrs, 'base_price': base_price})
        
    if features_t_list:
        features_t_arr = np.array(features_t_list)
        pred_times = time_model.predict(features_t_arr)
        
        features_c_list = []
        for i, pred_time in enumerate(pred_times):
            md = metadata[i]
            features_c_list.append([
                float(pred_time),
                md['svc_id'],
                md['base_price'],
                md['base_dur_hrs'],
                int(md['item'].get('is_price_fixed', 0)),
                int(md['item'].get('vehicle_age', 5)),
                md['vtype_enc'],
                float(md['item'].get('mileage', md['item'].get('vehicle_age', 5) * 15000)),
            ])
            
        features_c_arr = np.array(features_c_list)
        pred_costs = cost_model.predict(features_c_arr)
        
        for i in range(len(pred_times)):
            md = metadata[i]
            pred_time = float(pred_times[i])
            pred_cost = float(pred_costs[i])
            
            time_ratio = pred_time / (md['base_dur_hrs'] * 60) if md['base_dur_hrs'] > 0 else 1.0
            price_ratio = pred_cost / md['base_price'] if md['base_price'] > 0 else 1.0
            
            results.append({
                'predicted_duration_mins': round(pred_time, 2),
                'predicted_amount': round(pred_cost, 2),
                'time_ratio': round(time_ratio, 4),
                'price_ratio': round(price_ratio, 4)
            })

    if len(results) == 1:
        return jsonify(results[0])
    return jsonify(results)


@app.route('/predict/churn', methods=['POST'])
def predict_churn():
    """
    Classify churn risk for customers.
    """
    data = request.json
    if not isinstance(data, list):
        data = [data]

    results = []
    features_list = []
    
    for item in data:
        vtype_enc = encode_vehicle_type(item.get('vehicle_type'))
        svc_id = int(item.get('service_id', 0))
        base_dur_hrs = float(item.get('base_duration_hours', 1.0))
        base_price = float(item.get('base_price', 0))
        
        features_list.append([
            float(item.get('predicted_duration_mins', 60)),
            float(item.get('predicted_amount', 0)),
            svc_id,
            base_price,
            base_dur_hrs,
            int(item.get('vehicle_age', 5)),
            vtype_enc,
            float(item.get('mileage', item.get('vehicle_age', 5) * 15000)),
        ])
        
    if features_list:
        features_arr = np.array(features_list)
        preds = churn_model.predict(features_arr)
        probas = churn_model.predict_proba(features_arr)
        
        for i in range(len(preds)):
            pred = int(preds[i])
            proba = probas[i]
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
