@echo off
echo Starting Python backend


cd models

IF NOT EXIST "venv" (
    echo [1/3] Creating virtual environment...
    python -m venv venv
) ELSE (
    echo [1/3] Virtual environment already exists.
)

echo [2/3] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/3] Installing dependencies...
pip install -r requirements.txt --quiet


echo Server is starting... (Press CTRL+C to stop)
python predict_server.py

pause
