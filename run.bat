@echo off
title Placement Outreach OS Runner
echo ===================================================
echo   Placement Outreach OS Startup Script (Windows)
echo ===================================================
echo.

:: Check Python installation
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in your system PATH.
    echo Please install Python version 3.9 or higher before running this application.
    pause
    exit /b
)

:: Create virtual environment if it doesn't exist
if not exist "venv" (
    echo [INFO] Creating Python virtual environment venv...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b
    )
)

:: Activate virtual environment and install requirements
echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat

echo [INFO] Installing required dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b
)

:: Initialize SQLite database tables
echo [INFO] Initializing SQLite database...
python -m backend.database
if errorlevel 1 (
    echo [ERROR] Database initialization failed.
    pause
    exit /b
)

:: Start browser to let uvicorn boot up
echo [INFO] Launching Placement Outreach OS in browser...
start "" "http://127.0.0.1:8001"

:: Run the FastAPI server
echo [INFO] Starting web application server (Uvicorn)...
echo Press Ctrl+C in this window to stop the application.
echo.
uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload

pause
