@echo off
echo Starting JobPilot...
echo.

cd /d "%~dp0"

:: If Windows bin shims are missing, reinstall to get correct platform binaries
if not exist "node_modules\.bin\tsx.cmd" (
    echo First-time setup: installing dependencies for Windows...
    call npm install
    cd backend && call npx prisma generate && cd ..
    echo.
)

:: Start backend in a new window
start "JobPilot Backend" cmd /k "cd /d %~dp0backend && npx tsx watch src/index.ts"

:: Wait a moment for backend to initialize
timeout /t 4 /nobreak >nul

:: Start frontend in a new window
start "JobPilot Frontend" cmd /k "cd /d %~dp0frontend && npx vite"

echo.
echo JobPilot is starting up!
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo.
echo Close the "JobPilot Backend" and "JobPilot Frontend" windows to stop.
pause
