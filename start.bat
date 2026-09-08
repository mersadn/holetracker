@echo off
chcp 65001 >nul
title مدیریت سوراخ‌های DTF - سرور محلی
cd /d "%~dp0"

echo.
echo   در حال راه‌اندازی برنامه مدیریت سوراخ‌های DTF ...
echo.

set PORT=8420

where python >nul 2>nul
if %errorlevel%==0 (
    start "" http://localhost:%PORT%/index.html
    python -m http.server %PORT%
    goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
    start "" http://localhost:%PORT%/index.html
    py -m http.server %PORT%
    goto :eof
)

echo.
echo   پایتون (Python) روی این سیستم پیدا نشد.
echo   برای اجرای برنامه، یک‌بار پایتون را از این آدرس نصب کنید:
echo   https://www.python.org/downloads/
echo   (هنگام نصب، گزینه "Add python.exe to PATH" را تیک بزنید)
echo   سپس دوباره همین فایل (start.bat) را اجرا کنید.
echo.
pause
