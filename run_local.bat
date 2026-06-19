@echo off
title AI Interviewer - Local Runner
echo ====================================================
echo      Starting AI Interviewer Local Servers
echo ====================================================

:: 1. Start FastAPI Backend with SQLite fallback
echo Starting FastAPI Backend on http://localhost:8000...
start "AI Interviewer Backend" cmd /k "cd backend && .venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

:: 2. Check if npm is installed locally
where npm >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Starting Next.js Frontend on http://localhost:3000...
    start "AI Interviewer Frontend" cmd /k "cd frontend && npm run dev"
    echo.
    echo Both servers launched in separate windows!
    echo   - Backend API: http://localhost:8000
    echo   - API Docs:    http://localhost:8000/docs
    echo   - Frontend:    http://localhost:3000
) else (
    echo.
    echo Warning: 'npm' was not found on your system path.
    echo To run the Next.js frontend, please run 'npm install' then 'npm run dev' inside the './frontend' directory.
    echo.
    echo Launched FastAPI backend on http://localhost:8000
)

echo ====================================================
pause
