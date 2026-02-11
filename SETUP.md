# MRTD Meat Freshness Detection

## Setup Instructions

### Quick Setup (Automated)

**Windows:**
- Double-click `setup_env.bat` OR
- In PowerShell: `.\setup_env.ps1`

**Linux/Mac:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Manual Setup
1. Create virtual environment: `python -m venv .venv`
2. Activate it:
   - Windows: `.\.venv\Scripts\activate`
   - Linux/Mac: `source .venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`

## Why No `.venv` in GitHub?
- The `.venv/` folder is excluded via `.gitignore` because it's large and contains platform-specific files
- Instead, we use `requirements.txt` to track dependencies
- Anyone cloning the repo can quickly recreate the environment with the setup script or manual commands above

## Project Dependencies
- **Python**: 3.8+
- **ultralytics**: YOLO model framework
- **opencv-python**: Image processing
- **torch**: Required by ultralytics
