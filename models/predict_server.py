"""
Run this script in terminal before using the website for ML stuff
"""
import os
import json
import warnings
import joblib
import numpy as np

# Suppress sklearn's valid feature names warnings when predicting with numpy arrays
warnings.filterwarnings("ignore", message="X does not have valid feature names")
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Union, List, Dict, Any
import uvicorn

app = FastAPI(title="AutoKita ML Predict API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Loading
BASE = os.path.dirname(os.path.abspath(__file__))
EXPORTED = os.path.join(BASE, 'exported')
SYNC_META_PATH = os.path.join(EXPORTED, 'last_sync_meta.json')

time_model = None
cost_model = None
churn_model = None
veh_encoder = None
KNOWN_TYPES = set()
service_base_prices = {}
service_base_durations = {}

def load_models():
    """Loads or reloads all models and lookup tables from models/exported/."""
    global time_model, cost_model, churn_model, veh_encoder, KNOWN_TYPES, service_base_prices, service_base_durations
    time_model = joblib.load(os.path.join(EXPORTED, 'time_model.pkl'))
    cost_model = joblib.load(os.path.join(EXPORTED, 'cost_model.pkl'))
    churn_model = joblib.load(os.path.join(EXPORTED, 'churn_model.pkl'))
    veh_encoder = joblib.load(os.path.join(EXPORTED, 'veh_type_encoder.pkl'))
    KNOWN_TYPES = set(veh_encoder.classes_)

    _svc_bp_path = os.path.join(EXPORTED, 'service_base_prices.pkl')
    service_base_prices = joblib.load(_svc_bp_path) if os.path.exists(_svc_bp_path) else {}

    _svc_bd_path = os.path.join(EXPORTED, 'service_base_durations.pkl')
    service_base_durations = joblib.load(_svc_bd_path) if os.path.exists(_svc_bd_path) else {}
    print(f" Loaded {len(service_base_prices)} baseline prices and {len(service_base_durations)} baseline durations.")

# Initial load
load_models()

def encode_vehicle_type(vtype):
    if vtype and vtype in KNOWN_TYPES:
        return int(veh_encoder.transform([vtype])[0])
    return int(veh_encoder.transform([veh_encoder.classes_[0]])[0])

@app.post('/predict/time')
def predict_time(data: Union[Dict[str, Any], List[Dict[str, Any]]] = Body(...)):
    """
    Predict actual service duration in minutes.
    """
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
        return results[0]
    return results


@app.post('/predict/cost')
def predict_cost(data: Union[Dict[str, Any], List[Dict[str, Any]]] = Body(...)):
    """
    Predict labor cost AND time in a 2-stage pipeline.
    """
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
        return results[0]
    return results


@app.post('/predict/churn')
def predict_churn(data: Union[Dict[str, Any], List[Dict[str, Any]]] = Body(...)):
    """
    Classify churn risk for customers.
    """
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

    return results


@app.get('/health')
def health():
    return {'status': 'ok', 'models_loaded': True}


@app.get('/api/model-status')
def get_model_status():
    """Returns training metadata, cursor position, and evaluation metrics."""
    if os.path.exists(SYNC_META_PATH):
        try:
            with open(SYNC_META_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            return {'status': 'error', 'message': str(e)}
    return {
        'status': 'no_sync_meta',
        'models_loaded': True,
        'total_baseline_services': len(service_base_prices),
    }


@app.get('/api/baselines')
def get_baselines():
    """Returns active service baseline prices and durations."""
    return {
        'service_base_prices': service_base_prices,
        'service_base_durations': service_base_durations,
    }


@app.post('/api/reload')
def reload_in_memory_models():
    """Hot-reloads models and baselines from disk without process restart."""
    try:
        load_models()
        return {'status': 'reloaded', 'known_types': sorted(list(KNOWN_TYPES))}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


@app.post('/api/batch-sync')
def trigger_batch_sync(
    min_batch_size: int = 10,
    alpha: float = 0.15,
    dry_run: bool = False
):
    """
    Triggers batch continuous learning from Supabase database.
    Applies outlier filtering, damped EMA updates to baselines, and retrains models.
    """
    try:
        from retrain_engine import execute_batch_sync
        execute_batch_sync(min_batch_size=min_batch_size, alpha=alpha, dry_run=dry_run)
        if not dry_run:
            load_models()
        return {
            'status': 'completed',
            'dry_run': dry_run,
            'message': f'Batch sync executed (min_batch={min_batch_size}, alpha={alpha}). Models reloaded.'
        }
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


if __name__ == '__main__':
    print("ML Prediction Server starting on http://localhost:5001")
    print(f"   Models loaded from: {EXPORTED}")
    print(f"   Known vehicle types: {sorted(KNOWN_TYPES)}")
    uvicorn.run(app, host='0.0.0.0', port=5001)
