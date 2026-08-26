@echo off
cd /d "%~dp0"
start "Поля A5" cmd /k "npm.cmd run dev"
timeout /t 3 /nobreak >nul
start "" http://localhost:3000
