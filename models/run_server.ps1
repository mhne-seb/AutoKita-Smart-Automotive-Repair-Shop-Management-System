# run_server.ps1
# Starts the AutoKita ML Prediction Server on http://localhost:5001
Set-Location -Path $PSScriptRoot
Write-Host "Starting ML Prediction Server..." -ForegroundColor Cyan
py -3 predict_server.py
