@echo off
echo ===================================================
echo   Smart Energy Monitoring System - Startup Script
echo ===================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python and check 'Add Python to PATH'.
    pause
    exit /b
)

:: 2. Install dependencies
echo [1/3] Installing dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] pip install failed, trying direct install...
    pip install Flask requests
)

:: 3. Start Flask Backend
echo [2/3] Starting Flask web server in a new window...
start "Smart Energy - Web Server" cmd /k python app.py

:: Wait for server to start, then open browser
echo [3/3] Opening web browser...
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:5000

:: 4. Start simulator in this window
echo.
echo ===================================================
echo   Starting IoT Simulator in this window...
echo   To close the system, close both terminal windows.
echo ===================================================
echo.
python simulator.py

pause
