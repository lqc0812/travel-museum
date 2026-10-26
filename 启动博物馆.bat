@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies (requires internet)...
  call npm install
)
echo Starting Travel Museum...
start "" node server/index.js
timeout /t 2 >nul
start "" http://localhost:3000
