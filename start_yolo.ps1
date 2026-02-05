$script = Join-Path $PSScriptRoot 'yolo_server.py'
$venv = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
$py = (Test-Path $venv) ? $venv : 'python'

# Use cmd.exe to handle redirection reliably on Windows PowerShell 5.x
$cmd = "`"$py`" `"$script`" >> `"$PSScriptRoot\yolo_server.log`" 2>&1"
Start-Process -FilePath 'cmd.exe' -ArgumentList "/c $cmd" -WindowStyle Minimized
Write-Host "YOLO server started (background). Logs -> yolo_server.log"