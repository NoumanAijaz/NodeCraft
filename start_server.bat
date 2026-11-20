@echo off
setlocal
title NodeCraft Server
pushd "%~dp0" || exit /b 1

set "NODECRAFT_PACKAGE_MANAGER="
where pnpm >nul 2>nul
if not errorlevel 1 set "NODECRAFT_PACKAGE_MANAGER=pnpm"
if not defined NODECRAFT_PACKAGE_MANAGER (
    where npm >nul 2>nul
    if not errorlevel 1 set "NODECRAFT_PACKAGE_MANAGER=npm"
)
if defined NODECRAFT_PACKAGE_MANAGER goto start

echo.
echo [ERROR] Neither pnpm nor npm was found on your PATH.
echo Install Node.js from https://nodejs.org/ and try again.
set "NODECRAFT_EXIT=1"
goto finish

:start
echo.
echo ============================================
echo   NodeCraft Server Starting...
echo ============================================
call %NODECRAFT_PACKAGE_MANAGER% run dev
set "NODECRAFT_EXIT=%errorlevel%"

:finish
echo.
pause
popd
exit /b %NODECRAFT_EXIT%
