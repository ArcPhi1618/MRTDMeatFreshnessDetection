Auto-start helper for YOLO server

Files:
- start_yolo.bat — double-click to start the YOLO Flask server in a new window and write logs to `yolo_server.log`.
- start_yolo.ps1 — PowerShell helper that starts the server in background (Minimized) and logs to `yolo_server.log`.

How to use:

1) From File Explorer: double-click `start_yolo.bat`.

2) From PowerShell (recommended):

```powershell
cd C:\wamp64\www\MRTDMeatFreshnessDetection
# Run the batch file
start .\start_yolo.bat

# Or run the PowerShell helper (may require execution policy change):
powershell -ExecutionPolicy Bypass -File .\start_yolo.ps1
```

3) Verify the server is running (health-check):

```powershell
curl http://localhost:5555/health
```

Notes:
- The helpers prefer the virtualenv Python at `.venv\Scripts\python.exe`. If that doesn't exist they use the system `python`.
- Logs are written to `yolo_server.log` in the project root.
- If you want the server to always start on login, create a Windows Scheduled Task that runs `start_yolo.bat` at login.
