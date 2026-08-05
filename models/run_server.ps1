# run_server.ps1
# Use this script to start the ML Prediction Server instead of bash run.bash
Write-Host "Starting ML Prediction Server..." -ForegroundColor Cyan
py -3 predict_server.py
