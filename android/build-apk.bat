@echo off
chcp 65001 >nul
echo Сборка app-debug.apk для тестирования...
echo.

:: Используем JDK из Android Studio (нужен для сборки)
if exist "C:\Program Files\Android\Android Studio\jbr" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    echo Используется JDK: %JAVA_HOME%
) else (
    echo Ошибка: не найден JDK в Android Studio. Установите Android Studio или JDK 17+.
    pause
    exit /b 1
)

cd /d "%~dp0"

call gradlew.bat clean assembleDebug
if errorlevel 1 (
    echo.
    echo Сборка завершилась с ошибкой.
    pause
    exit /b 1
)

set "APK_DIR=app\build\outputs\apk\debug"
set "APK_PATH=%APK_DIR%\app-debug.apk"

if exist "%APK_PATH%" (
    echo.
    echo Готово: %APK_PATH%
    echo Открываю папку с APK...
    start "" explorer "%~dp0%APK_DIR%"
) else (
    echo APK не найден: %APK_PATH%
)

pause
