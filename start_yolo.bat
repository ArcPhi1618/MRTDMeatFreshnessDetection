@echo off
pushd %~dp0
set "PY=%~dp0\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
echo Starting YOLO server...
start "YOLO" cmd /c "%PY% "%~dp0yolo_server.py" >> "%~dp0yolo_server.log" 2>&1"
popd
echo Started. Check yolo_server.log for output.
pause
