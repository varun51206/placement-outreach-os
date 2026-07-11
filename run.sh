#!/bin/bash

# Placement Outreach OS macOS/Linux Startup Script

echo "==================================================="
echo "  Placement Outreach OS Startup Script (macOS/Linux)  "
echo "==================================================="
echo ""

# Check if python3 is installed
if ! command -v python3 &> /dev/null
then
    echo "[ERROR] Python 3 is not installed or not in your system PATH."
    echo "Please install Python 3 (3.9+) before running this application."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "[INFO] Creating Python virtual environment (venv)..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to create virtual environment."
        exit 1
    fi
fi

# Activate virtual environment
echo "[INFO] Activating virtual environment..."
source venv/bin/activate

# Install requirements
echo "[INFO] Installing required dependencies..."
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install dependencies."
    exit 1
fi

# Initialize SQLite database tables
echo "[INFO] Initializing SQLite database..."
python3 -m backend.database
if [ $? -ne 0 ]; then
    echo "[ERROR] Database initialization failed."
    exit 1
fi

# Open default browser (macOS uses 'open', Linux uses 'xdg-open')
echo "[INFO] Launching Placement Outreach OS in browser..."
if command -v open &> /dev/null; then
    open "http://127.0.0.1:8001"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://127.0.0.1:8001"
fi

# Run the FastAPI server
echo "[INFO] Starting web application server (Uvicorn)..."
echo "Press Ctrl+C to stop the application."
echo ""
uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload
