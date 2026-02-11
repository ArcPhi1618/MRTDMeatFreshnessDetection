# Setup script for MRTD Meat Freshness Detection (PowerShell)

Write-Host "Creating virtual environment..."
python -m venv .venv

Write-Host "Activating virtual environment..."
& .\.venv\Scripts\Activate.ps1

Write-Host "Installing dependencies from requirements.txt..."
pip install -r requirements.txt

Write-Host "Setup complete! Virtual environment is ready."
Write-Host "To activate in the future, run: .\.venv\Scripts\Activate.ps1"
