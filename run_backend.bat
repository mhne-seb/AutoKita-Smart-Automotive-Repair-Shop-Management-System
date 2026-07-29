@echo off
echo Starting Python backend

cd models

IF NOT EXIST "venv" (
    echo [1/3] Creating virtual environment...
    py -3 -m venv venv || python -m venv venv
) ELSE (
    echo [1/3] Virtual environment already exists.
)

echo [2/3] Installing dependencies...
IF EXIST "venv\Scripts\python.exe" (
    .\venv\Scripts\python.exe -m pip install -r requirements.txt
) ELSE (
    .\venv\bin\python.exe -m pip install -r requirements.txt
)

echo [3/3] Server is starting... (Press CTRL+C to stop)
IF EXIST "venv\Scripts\python.exe" (
    .\venv\Scripts\python.exe predict_server.py
) ELSE (
    .\venv\bin\python.exe predict_server.py
)

pause
