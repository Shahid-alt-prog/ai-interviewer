# run_local.ps1
# PowerShell script to run the AI Interviewer locally without Docker

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Starting AI Interviewer Local Servers     " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Start FastAPI Backend with SQLite fallback
Write-Host "Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd backend; .venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

# 2. Check if npm/node is installed locally
$npmExists = Get-Command npm -ErrorAction SilentlyContinue
if ($npmExists) {
    Write-Host "Starting Next.js Frontend on http://localhost:3000..." -ForegroundColor Yellow
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"
    Write-Host "Both servers launched in separate powershell windows!" -ForegroundColor Green
    Write-Host "  - Backend API: http://localhost:8000" -ForegroundColor Green
    Write-Host "  - API Docs:    http://localhost:8000/docs" -ForegroundColor Green
    Write-Host "  - Frontend:    http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "Warning: 'npm' was not found on your system path." -ForegroundColor DarkYellow
    Write-Host "To run the Next.js frontend, please run 'npm install' then 'npm run dev' inside the './frontend' directory." -ForegroundColor Yellow
    Write-Host "Launched FastAPI backend on http://localhost:8000" -ForegroundColor Green
}

Write-Host "=============================================" -ForegroundColor Cyan
