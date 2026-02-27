@echo off
setlocal EnableDelayedExpansion

echo ========================================================
echo Eldorado AI Project - Advanced Environment Setup
echo ========================================================
echo.

:: 1. Request administrative privileges to install environments and set PATH
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Requesting administrative privileges for environment installation...
    echo Set UAC = CreateObject^("Shell.Application"^)>"%temp%\getadmin.vbs"
    echo UAC.ShellExecute "cmd.exe", "/c ""%~s0""", "", "runas", 1 >>"%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B
)

:: 2. Ensure we are operating in the project root directory
cd /d "%~dp0\.."

goto Main

:: Function to download files reliably
:DownloadFile
set URL=%~1
set FILE=%~2
echo [DOWNLOADING] %URL%
curl -L -o "%FILE%" "%URL%" 2>nul
if %errorlevel% neq 0 (
    echo [INFO] curl unavailable or failed, falling back to PowerShell...
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%URL%' -OutFile '%FILE%'"
)
exit /b

:Main
:: Hardcoded versions based on the host environment for maximum compatibility
set PYTHON_VERSION=3.10.14
set PYTHON_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-amd64.exe
set PYTHON_EXE=%temp%\python-installer.exe

set NODE_VERSION=20.11.1
set NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-x64.msi
set NODE_MSI=%temp%\node-installer.msi

echo [1/8] Checking Environment Variables...

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Python not found or not in PATH. Installing Python %PYTHON_VERSION%...
    call :DownloadFile "%PYTHON_URL%" "%PYTHON_EXE%"
    echo [INSTALLING] Python silently (This may take a minute)...
    start /wait "" "%PYTHON_EXE%" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
    echo [OK] Python installed successfully.
) else (
    echo [OK] Python is already installed.
)

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js not found or not in PATH. Installing Node.js %NODE_VERSION%...
    call :DownloadFile "%NODE_URL%" "%NODE_MSI%"
    echo [INSTALLING] Node.js silently (This may take a minute)...
    start /wait "" msiexec /i "%NODE_MSI%" /qn
    echo [OK] Node.js installed successfully.
) else (
    echo [OK] Node.js is already installed.
)

:: Refresh PATH from registry so newly installed tools are immediately available in this script
echo [INFO] Refreshing local environment variables...
for /f "tokens=*" %%A in ('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')"') do set "PATH=%%A"

:: Verify installation again after refresh
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python installation failed or PATH not completely updated. 
    echo Please restart your computer and run this script again.
    pause
    exit /b
)

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js installation failed or PATH not completely updated. 
    echo Please restart your computer and run this script again.
    pause
    exit /b
)

echo [2/8] Upgrading global pip...
python -m pip install --upgrade pip >nul 2>&1

echo [3/8] Installing root Python dependencies...
python -m pip install -r requirements.txt

echo [4/8] Installing backend Python dependencies...
cd backend
python -m pip install -r requirements.txt
cd ..

echo [5/8] Installing brainrotBB Python dependencies...
cd brainrotBB
python -m pip install -r requirements.txt
cd ..

echo [6/8] Installing frontend_client Node dependencies...
cd frontend_client
call npm install
cd ..

echo [7/8] Installing BackFrontend Node dependencies...
cd BackFrontend
call npm install
cd ..

echo [8/8] Installing backend_api Node dependencies...
cd backend_api
call npm install
cd ..

echo.
echo ========================================================
echo [SUCCESS] Environment Setup is 100%% Complete!
echo.
echo You can now start all services by running:
echo     python start_project.py
echo ========================================================
pause