@echo off
setlocal EnableExtensions
title POLARIS

rem ---------------------------------------------------------------------------
rem  POLARIS launcher: pulls the latest code from GitHub, installs dependencies
rem  and starts the backend (Express API + SQLite) and the frontend (Vite/React).
rem  Both run in ONE Node process on ONE port (default http://localhost:3000).
rem
rem    start_all.bat           dev mode (hot reload)
rem    start_all.bat prod      production build, then serve it
rem    start_all.bat nopull    skip the GitHub update
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

rem ---- 1. Node.js 22.13+ (the backend uses the built-in node:sqlite) ----------
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
set "PORT=3000"
for /f "usebackq tokens=1,* delims==" %%a in (".env") do if /i "%%a"=="PORT" if not "%%b"=="" set "PORT=%%b"

rem ---- 5. Start ----------------------------------------------------------------
rem Open the browser once /api/health answers (backend + frontend are then both up).
if not defined POLARIS_NO_BROWSER start "" /b powershell -NoProfile -WindowStyle Hidden -Command ^
  "for($i=0;$i -lt 90;$i++){try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:%PORT%/api/health|Out-Null;Start-Process http://localhost:%PORT%;break}catch{Start-Sleep 1}}"

if /i "%MODE%"=="prod" (
    echo [..] Building the frontend for production...
    call npm run build
    if errorlevel 1 (echo [x] Build failed. & goto :fail)
    set "NODE_ENV=production"
    echo.
    echo [ok] Starting POLARIS ^(production^) on http://localhost:%PORT%   -  Ctrl+C to stop
    echo.
    call npm start
) else (
    echo.
    echo [ok] Starting POLARIS ^(backend API + frontend^) on http://localhost:%PORT%   -  Ctrl+C to stop
    echo      First start creates and seeds data\polaris.db. The admin token is printed below.
    echo.
    call npm run dev
)
exit /b %errorlevel%

:fail
echo.
pause
exit /b 1
