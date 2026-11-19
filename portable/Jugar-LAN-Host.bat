@echo off
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 (
  echo Se pide permiso de administrador para abrir el puerto en el firewall.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Jugar-LAN-Host.ps1"
if errorlevel 1 pause
