@echo off
chcp 65001 >nul
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
  echo ADB не найден: %ADB%
  echo Укажите путь в Android Studio: File - Settings - Android SDK - Android SDK Location
  pause
  exit /b 1
)
echo Перезапуск ADB...
"%ADB%" kill-server
timeout /t 2 /nobreak >nul
"%ADB%" start-server
timeout /t 2 /nobreak >nul
echo.
echo Устройства:
"%ADB%" devices
echo.
echo Готово. Запустите приложение в Android Studio (Run).
pause
