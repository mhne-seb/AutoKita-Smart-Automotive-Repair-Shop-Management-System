cd models

Write-Host '=========================================' -ForegroundColor Cyan
Write-Host ' AutoKita ML Retraining Pipeline' -ForegroundColor Cyan
Write-Host '=========================================' -ForegroundColor Cyan

Write-Host ' '
Write-Host '[0/3] Cleaning up lingering background processes...' -ForegroundColor Yellow
$port = 5001
$pid_to_kill = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
if ($pid_to_kill) {
    Write-Host " -> Killing port $port (PID: $pid_to_kill)" -ForegroundColor Yellow
    Stop-Process -Id $pid_to_kill -Force -ErrorAction SilentlyContinue
}
Get-CimInstance Win32_Process -Filter "Name = 'python.exe' OR Name = 'py.exe'" | Where-Object { 
    $_.CommandLine -match 'predict_server\.py' -or $_.CommandLine -match 'jupyter' 
} | ForEach-Object {
    Write-Host " -> Killing dangling process PID $($_.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

Write-Host ' '
Write-Host '[1/4] Normalizing ML training data based on vehicle age...' -ForegroundColor Yellow
py -3 normalize_ml_data.py

Write-Host ' '
Write-Host '[2/4] Exporting database to CSV...' -ForegroundColor Yellow
py -3 export_db_to_csv.py

Write-Host ' '
Write-Host '[3/4] Retraining ML Models (ratio-based approach)...' -ForegroundColor Yellow
py -3 retrain_models.py

Write-Host ' '
Write-Host '  -> Training churn_classification (notebook)...' -ForegroundColor Yellow
py -3 -m jupyter nbconvert --execute --to notebook --inplace churn_classification.ipynb

Write-Host ' '
Write-Host 'Models successfully re-exported to models/exported/ folder!' -ForegroundColor Green

Write-Host ' '
Write-Host '[4/4] Starting Prediction Server...' -ForegroundColor Yellow
Write-Host '!!! Killing old prediction server if it is running...' -ForegroundColor Yellow

$port = 5001
$pid_to_kill = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
if ($pid_to_kill) {
    Write-Host "Found old server on PID $pid_to_kill. Terminating..." -ForegroundColor Yellow
    Stop-Process -Id $pid_to_kill -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
} else {
    Write-Host "No old server found running on port $port." -ForegroundColor Green
}

py -3 predict_server.py
