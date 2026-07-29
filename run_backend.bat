@echo off
echo Starting Python backend

cd models

IF NOT EXIST "venv" (
    echo [1/3] Creating virtual environment...
    python3.12 -m venv --system-site-packages venv || python -m venv --system-site-packages venv
) ELSE (
    echo [1/3] Virtual environment already exists.
)

echo [2/3] Installing dependencies...
.\venv\bin\python.exe -m pip install -r requirements.txt

echo [3/3] Server is starting... (Press CTRL+C to stop)
.\venv\bin\python.exe predict_server.py

pause
