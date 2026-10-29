@echo off
title FileTfer Derleyici
echo ==============================================
echo   FileTfer - Masaustu Istemcisi Derleniyor
echo ==============================================

echo [1/3] Calisan uygulama varsa kapatiliyor...
taskkill /F /IM FileTfer.exe >nul 2>&1

echo [2/3] Frontend Vite paketi derleniyor...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [HATA] Frontend derlemesi basarisiz oldu!
    cd ..
    pause
    exit /b %ERRORLEVEL%
)
cd ..

echo [3/3] Wails ile masaustu uygulamasi derleniyor...
wails build
if %ERRORLEVEL% NEQ 0 (
    echo [HATA] Wails derlemesi basarisiz oldu!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==============================================
echo   BASARILI: FileTfer.exe derlendi!
echo   Konum: build\bin\FileTfer.exe
echo ==============================================
pause
