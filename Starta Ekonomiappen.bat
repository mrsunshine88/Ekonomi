@echo off
echo Startar Ekonomiapp...
cd /d "%~dp0"
start http://localhost:5173
npm run dev
