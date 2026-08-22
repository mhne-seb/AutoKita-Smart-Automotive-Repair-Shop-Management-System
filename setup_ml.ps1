Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " AutoKita ML Environment Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " "

Write-Host "Ensuring pip is up to date..." -ForegroundColor Yellow
py -3 -m pip install --user --upgrade pip

Write-Host " "
Write-Host "Installing dependencies from models/requirements.txt..." -ForegroundColor Yellow
cd models
py -3 -m pip install --user -r requirements.txt

Write-Host " "
Write-Host "Installing jupyter (required for retraining notebooks)..." -ForegroundColor Yellow
py -3 -m pip install --user jupyter

Write-Host " "
Write-Host "Setup complete! You can now run .\retrain_ml.ps1 with no problems." -ForegroundColor Green
cd ..
