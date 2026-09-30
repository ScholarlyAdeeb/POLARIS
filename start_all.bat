@echo off
setlocal EnableExtensions
title POLARIS

rem ---------------------------------------------------------------------------
rem  POLARIS launcher: backend (Express API + PostgreSQL from DATABASE_URL in .env)
rem  and frontend (Vite/React) on one port. The Android app connects to the address it prints.
rem
rem    start_all.bat           dev mode (hot reload)
rem    start_all.bat prod      production build, then serve it
rem    start_all.bat nopull    skip the GitHub update
rem  Optional env var: POLARIS_NO_BROWSER=1
rem ---------------------------------------------------------------------------

rem git pull may rewrite this very file while cmd is reading it, so run from a temp copy.
if /i not "%~1"=="--relaunched" (
    copy /y "%~f0" "%TEMP%\polaris_start_all.bat" >nul
    call "%TEMP%\polaris_start_all.bat" --relaunched "%~dp0" %*
    exit /b %errorlevel%
)
set "REPO=%~2"
shift & shift
cd /d "%REPO%" || (echo [x] Cannot open %REPO% & goto :fail)

set "MODE=dev"
set "PULL=1"
:args
if "%~1"=="" goto :argsdone
if /i "%~1"=="prod"   set "MODE=prod"
if /i "%~1"=="nopull" set "PULL=0"
shift
goto :args
:argsdone

echo.
echo  ==================  POLARIS  ==================
echo.

rem ---- 1. Node.js 22.13+ ---------------------------------------------------------
where node >nul 2>&1 || (echo [x] Node.js not found. Install Node 22.13 or newer from https://nodejs.org & goto :fail)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
    for /f %%v in ('node -v') do echo [x] Node %%v is too old. POLARIS needs Node 22.13 or newer.
    goto :fail
)
for /f %%v in ('node -v') do echo [ok] Node %%v

rem ---- 2. Pull the latest build from GitHub ------------------------------------
if "%PULL%"=="0" (
    echo [..] Skipping GitHub update ^(nopull^)
    goto :install
)
where git >nul 2>&1
if errorlevel 1 (
    echo [!] git not found, running the local copy.
    goto :install
)
if not exist ".git" (
    echo [!] Not a git checkout, running the local copy.
    goto :install
)

for /f %%b in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
echo [..] Updating from GitHub ^(branch %BRANCH%^)...
git fetch origin --quiet
if errorlevel 1 (
    echo [!] Could not reach GitHub, running the local copy.
    goto :install
)
git pull --ff-only --quiet origin %BRANCH%
if errorlevel 1 (
    echo [!] Could not fast-forward: you have local changes or commits that GitHub does not.
    echo     Running your local copy as-is. Commit/stash them, or run: git pull --rebase
) else (
    for /f "delims=" %%c in ('git log -1 --oneline') do echo [ok] Up to date: %%c
)

rem ---- 3. Dependencies -----------------------------------------------------------
:install
echo [..] Installing dependencies ^(fast when nothing changed^)...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (echo [x] npm install failed. & goto :fail)
echo [ok] Dependencies ready

rem ---- 4. Config ---------------------------------------------------------------
if not exist ".env" if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo [ok] Created .env from .env.example
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\ensure-token.ps1"
set "PORT=3000"
set "ADMIN_TOKEN="
set "DATABASE_URL="
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if /i "%%a"=="PORT" if not "%%b"=="" set "PORT=%%b"
    if /i "%%a"=="ADMIN_TOKEN" set "ADMIN_TOKEN=%%b"
    if /i "%%a"=="DATABASE_URL" set "DATABASE_URL=%%b"
)

if not defined DATABASE_URL (
    echo [x] DATABASE_URL is not set in .env. Add your PostgreSQL connection string, e.g. from neon.tech.
    goto :fail
)
echo [ok] Database: PostgreSQL ^(DATABASE_URL^)

rem ---- 5. Phone address for the Android app -------------------------------------
set "LAN_URL="
for /f "delims=" %%u in ('node -e "const n=require('os').networkInterfaces();const a=Object.values(n).flat().filter(x=>x&&x.family==='IPv4'&&!x.internal).map(x=>x.address);const ip=a.find(x=>/^192\.168\.(0|1)\./.test(x))||a.find(x=>x.startsWith('10.'))||a[0];if(ip)console.log('http://'+ip+':%PORT%')"') do set "LAN_URL=%%u"

rem ---- 6. Start -----------------------------------------------------------------
set "HELPER_FLAGS="
if defined POLARIS_NO_BROWSER set "HELPER_FLAGS=%HELPER_FLAGS% -NoBrowser"
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\start-helper.ps1" -Port %PORT% %HELPER_FLAGS%

echo.
echo  POLARIS  http://localhost:%PORT%
if defined LAN_URL echo  Android app / phone on the same Wi-Fi:  %LAN_URL%
echo    Explore, map, stations, knowledge graph, learn: open to everyone
echo    Outreach studio and Admin: sign in with ADMIN_TOKEN = %ADMIN_TOKEN%
echo    Press Ctrl+C to stop.
echo.

if /i "%MODE%"=="prod" (
    echo [..] Building the frontend for production...
    call npm run build
    if errorlevel 1 (echo [x] Build failed. & goto :fail)
    set "NODE_ENV=production"
    call npm start
) else (
    call npm run dev
)
exit /b %errorlevel%

:fail)

set "MODE=dev"
set "PULL=1"
:args
if "%~1"=="" goto :argsdone
if /i "%~1"=="prod"   set "MODE=prod"
if /i "%~1"=="nopull" set "PULL=0"
shift
goto :args
:argsdone

echo.
echo  ==================  POLARIS  ==================
echo.

rem ---- 1. Node.js 22.13+ ---------------------------------------------------------
where node >nul 2>&1 || (echo [x] Node.js not found. Install Node 22.13 or newer from https://nodejs.org & goto :fail)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
    for /f %%v in ('node -v') do echo [x] Node %%v is too old. POLARIS needs Node 22.13 or newer.
    goto :fail
)
for /f %%v in ('node -v') do echo [ok] Node %%v

rem ---- 2. Pull the latest build from GitHub ------------------------------------
if "%PULL%"=="0" (
    echo [..] Skipping GitHub update ^(nopull^)
    goto :install
)
where git >nul 2>&1
if errorlevel 1 (
    echo [!] git not found, running the local copy.
    goto :install
)
if not exist ".git" (
    echo [!] Not a git checkout, running the local copy.
    goto :install
)

for /f %%b in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
echo [..] Updating from GitHub ^(branch %BRANCH%^)...
git fetch origin --quiet
if errorlevel 1 (
    echo [!] Could not reach GitHub, running the local copy.
    goto :install
)
git pull --ff-only --quiet origin %BRANCH%
if errorlevel 1 (
    echo [!] Could not fast-forward: you have local changes or commits that GitHub does not.
    echo     Running your local copy as-is. Commit/stash them, or run: git pull --rebase
) else (
    for /f "delims=" %%c in ('git log -1 --oneline') do echo [ok] Up to date: %%c
)

rem ---- 3. Dependencies -----------------------------------------------------------
:install
echo [..] Installing dependencies ^(fast when nothing changed^)...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (echo [x] npm install failed. & goto :fail)
echo [ok] Dependencies ready

rem ---- 4. Config ---------------------------------------------------------------
if not exist ".env" if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo [ok] Created .env from .env.example
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\ensure-token.ps1"
set "PORT=3000"
set "ADMIN_TOKEN="
set "DATABASE_URL="
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if /i "%%a"=="PORT" if not "%%b"=="" set "PORT=%%b"
    if /i "%%a"=="ADMIN_TOKEN" set "ADMIN_TOKEN=%%b"
    if /i "%%a"=="DATABASE_URL" set "DATABASE_URL=%%b"
)

if not defined DATABASE_URL (
    echo [x] DATABASE_URL is not set in .env. Add your PostgreSQL connection string, e.g. from neon.tech.
    goto :fail
)
echo [ok] Database: PostgreSQL ^(DATABASE_URL^)

rem ---- 5. Phone address for the Android app -------------------------------------
set "LAN_URL="
for /f "delims=" %%u in ('node -e "const n=require('os').networkInterfaces();const a=Object.values(n).flat().filter(x=>x&&x.family==='IPv4'&&!x.internal).map(x=>x.address);const ip=a.find(x=>/^192\.168\.(0|1)\./.test(x))||a.find(x=>x.startsWith('10.'))||a[0];if(ip)console.log('http://'+ip+':%PORT%')"') do set "LAN_URL=%%u"

rem ---- 6. Start -----------------------------------------------------------------
set "HELPER_FLAGS="
if defined POLARIS_NO_BROWSER set "HELPER_FLAGS=%HELPER_FLAGS% -NoBrowser"
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\start-helper.ps1" -Port %PORT% %HELPER_FLAGS%

echo.
echo  POLARIS  http://localhost:%PORT%
if defined LAN_URL echo  Android app / phone on the same Wi-Fi:  %LAN_URL%
echo    Explore, map, stations, knowledge graph, learn: open to everyone
echo    Outreach studio and Admin: sign in with ADMIN_TOKEN = %ADMIN_TOKEN%
echo    Press Ctrl+C to stop.
echo.

if /i "%MODE%"=="prod" (
    echo [..] Building the frontend for production...
    call npm run build
    if errorlevel 1 (echo [x] Build failed. & goto :fail)
    set "NODE_ENV=production"
    call npm start
) else (
    call npm run dev
)
exit /b %errorlevel%

rem ---- helpers --------------------------------------------------------------------
rem :ask "question"  ->  errorlevel 0 = yes, 1 = no. Defaults to No after 20 s or without a console.
:ask
if defined POLARIS_NO_PROMPT exit /b 1
choice /c YN /t 20 /d N /m "%~1"
if errorlevel 255 exit /b 1
if errorlevel 2 exit /b 1
exit /b 0

:fail
echo.
pause
exit /b 1
