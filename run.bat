@echo off
chcp 65001 >nul
cd /d "%~dp0frontend"
echo [1/3] Установка зависимостей...
call npm install
echo.
echo [2/3] Сборка приложения (все последние изменения из кода)...
call npm run build
if errorlevel 1 (echo Ошибка сборки. pause & exit /b 1)
echo.
echo [3/3] Копирование в Android-проект...
call npx cap sync android
if errorlevel 1 (echo Ошибка sync. pause & exit /b 1)
echo.
echo Готово. Чтобы увидеть изменения на эмуляторе:
echo   1. Откройте frontend\android в Android Studio
echo   2. Нажмите Run (зелёный треугольник)
echo   3. Если старый интерфейс всё ещё виден: в меню Build -^> Clean Project, затем Run снова
echo.
pause
