@echo off
set NODE="C:\Users\mihenriquez\Downloads\node-v24.14.1-win-x64\node-v24.14.1-win-x64\node.exe"
cd /d "%~dp0"
echo.
echo  ATL BIM Naming Convention Checker
echo  Open: http://localhost:8080
echo  Press Ctrl+C to stop.
echo.
%NODE% serve.js
pause
