@echo off
title NodeCraft Server

:: Locate Node.js installation (try common locations)
set "NODEJS_DIR="
if exist "C:\Program Files\nodejs\pnpm.cmd" set "NODEJS_DIR=C:\Program Files\nodejs"

:: If we found Node.js, use node.exe directly with pnpm from global location
if defined NODEJS_DIR (
    echo.
    echo ============================================
    echo   NodeCraft Server Starting...
    echo ============================================
    echo.
    
    :: Use node.exe to run pnpm directly — vite.config.ts host:true exposes network access
    "%NODEJS_DIR%\node.exe" -e "require('C:\\Users\\admin\\AppData\\Roaming\\npm\\node_modules\\pnpm\\lib\\run.js')" dev
    
    pause
    exit /b 0
)

:: Fallback: try pnpm on PATH
where pnpm >nul 2>nul && (
    echo.
    echo ============================================
    echo   NodeCraft Server Starting...
    echo ============================================
    echo.
    pnpm run dev --host
    pause
    exit /b 0
)

:: Fallback: try npm on PATH
where npm >nul 2>nul && (
    echo.
    echo ============================================
    echo   NodeCraft Server Starting...
    echo ============================================
    echo.
    npm run dev --host
    pause
    exit /b 0
)

echo.
echo [ERROR] Neither pnpm nor npm was found on your PATH.
echo Install Node.js from https://nodejs.org/ and try again.
echo.
pause
exit /b 1