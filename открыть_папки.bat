@echo off
cd /d "%~dp0"
start "" "%cd%"
start "" "%cd%\frontend"
start "" "%cd%\frontend\android"
start "" "%cd%\app"
echo Открыты папки: DeloApp, frontend, frontend\android, app
pause
