@echo off
REM Setup script for MRTD Meat Freshness Detection

echo Creating virtual environment...
python -m venv .venv

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Installing dependencies from requirements.txt...
pip install -r requirements.txt

echo Setup complete! Virtual environment is ready.
echo To activate in the future, run: .venv\Scripts\activate.bat
pause
