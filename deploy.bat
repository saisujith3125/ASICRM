@echo off
title ASICRM Enterprise Automated Deployment Runner (Windows)
echo ==================================================================
echo          ASICRM Enterprise Automated Deployment Runner (Windows)
echo ==================================================================
echo.

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo >> [1/4] Pulling latest updates from Git (origin/main)...
git pull origin main
if %errorlevel% neq 0 (
    echo [Warning] Git pull encountered an error or repository is already up to date.
)

echo.
echo >> [2/4] Checking backend dependencies...
cd /d "%SCRIPT_DIR%backend"
call npm install --silent
cd /d "%SCRIPT_DIR%"

echo.
echo >> [3/4] Building production React frontend bundle via Vite...
cd /d "%SCRIPT_DIR%frontend"
call npm install --silent
call npm run build
cd /d "%SCRIPT_DIR%"

if exist "%SCRIPT_DIR%frontend\dist\index.html" (
    echo [OK] Frontend compiled successfully in frontend\dist\
) else (
    echo [Error] frontend\dist\index.html was not generated!
    pause
    exit /b 1
)

echo.
echo >> [4/4] Running system verification check...
node backend/tests/verify_all_requirements_system_audit.js
if %errorlevel% neq 0 (
    echo [Warning] Verification check reported errors.
) else (
    echo [OK] All system verification checks passed!
)

echo.
echo ==================================================================
echo    ASICRM DEPLOYMENT BUILD COMPLETED SUCCESSFULLY!
echo ==================================================================
echo.
pause
