# AutoKita: A Smart Automotive Repair Shop Management System

AutoKita is a capstone project focused on developing a smart automotive repair shop management system designed to streamline business operations through efficient management of services, customer communication, and digital record keeping. The system replaces traditional paper-based processes with a centralized and structured platform to improve efficiency and service quality.


## System Preview

### Home Page

![Home Page](homepage(1).png)

### About Page

![About Page](aboutpage(1).png)

### Services Page

![Services Page](servicepage(1).png)

### Contact Page

![Contact Page](contactpage(1).png)

### Booking Page

![Booking Page](bookpage(1).png)

## Getting Started & New Device Setup

### 1. Frontend Setup
```bash
npm install
npm run dev
```

### 2. Python Backend Setup (ML Prediction Server)
On a new device, Python packages must be installed before running `predict_server.py`.

**Option A (Automated Batch Runner - Recommended):**
```cmd
.\run_backend.bat
```
*(This automatically creates a Python `venv`, installs required packages from `models/requirements.txt`, and launches the server).*

**Option B (Global / User Environment via PowerShell):**
```powershell
.\setup_ml.ps1
py -3 models/predict_server.py
```

**Option C (Manual pip install):**
```powershell
py -3 -m pip install -r models/requirements.txt
py -3 models/predict_server.py
```

