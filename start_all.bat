@echo off
setlocal EnableExtensions
title POLARIS

rem ---------------------------------------------------------------------------
rem  POLARIS launcher. Brings up everything:
rem    - web app: backend (Express API + SQLite) and frontend (Vite/React), one port
rem    - local AI: Ollama model for the assistant and outreach drafts (if installed)
rem    - ML embedding service (ml\serve.ps1) + automatic search-embedding rebuild
rem  Large downloads (Ollama model, CUDA PyTorch) are only started after you say Y.
rem
rem    start_all.bat           dev mode (hot reload)
rem    start_all.bat prod      production build, then serve it
rem    start_all.bat nopull    skip the GitHub update
rem  Optional env vars: POLARIS_NO_PROMPT=1 (answer No to downloads), POLARIS_NO_BROWSER=1,
rem                     POLARIS_ML_BACKEND=st|hash|off (hash = no-PyTorch wiring test)
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
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\ensure-token.ps1"
set "PORT=3000"
set "ADMIN_TOKEN="
set "GEMINI_API_KEY="
set "OLLAMA_MODEL=llama3.1:8b"
set "ML_URL=http://127.0.0.1:8765"
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if /i "%%a"=="PORT" if not "%%b"=="" set "PORT=%%b"
    if /i "%%a"=="ADMIN_TOKEN" set "ADMIN_TOKEN=%%b"
    if /i "%%a"=="GEMINI_API_KEY" set "GEMINI_API_KEY=%%b"
    if /i "%%a"=="OLLAMA_MODEL" if not "%%b"=="" set "OLLAMA_MODEL=%%b"
    if /i "%%a"=="ML_SERVICE_URL" if not "%%b"=="" set "ML_URL=%%b"
)

rem ---- 5. AI generator: Gemini key, else local Ollama, else offline mode -------
set "AI_STATE=offline extractive mode - answers are quoted from archive records"
if defined GEMINI_API_KEY (
    set "AI_STATE=Gemini API key found"
    goto :ai_done
)
where ollama >nul 2>&1
if errorlevel 1 (
    echo [--] Local AI: Ollama not installed. The assistant uses offline mode. Get it from https://ollama.com
    goto :ai_done
)
rem "ollama list" also starts the Ollama server if it is not running
ollama list > "%TEMP%\polaris_ollama.txt" 2>nul
findstr /b /i /c:"%OLLAMA_MODEL%" "%TEMP%\polaris_ollama.txt" >nul
if not errorlevel 1 (
    set "AI_STATE=Ollama %OLLAMA_MODEL% ready"
    goto :ai_done
)
echo [..] Ollama is installed but the model %OLLAMA_MODEL% is not downloaded - about 5 GB.
call :ask "     Download it now in a separate window"
if errorlevel 1 (
    echo [--] Skipped. The assistant uses offline mode until you run: ollama pull %OLLAMA_MODEL%
    goto :ai_done
)
start "POLARIS - downloading %OLLAMA_MODEL%" cmd /c "ollama pull %OLLAMA_MODEL% && echo. && echo Done. POLARIS switches to Ollama automatically within 30 seconds. && pause"
set "AI_STATE=Ollama %OLLAMA_MODEL% downloading - switches on automatically when done"
:ai_done
echo [ok] Assistant: %AI_STATE%

rem ---- 6. ML embedding service (semantic half of hybrid search) ----------------
set "ML_STARTED="
set "ML_BACKEND=st"
if defined POLARIS_ML_BACKEND set "ML_BACKEND=%POLARIS_ML_BACKEND%"
if /i "%ML_BACKEND%"=="off" (
    echo [--] Semantic search: turned off ^(POLARIS_ML_BACKEND=off^). Search uses BM25 keywords.
    goto :ml_done
)
powershell -NoProfile -Command "try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%ML_URL%/health'|Out-Null;exit 0}catch{exit 1}"
if not errorlevel 1 (
    echo [ok] Semantic search: ML service already running at %ML_URL%
    set "ML_STARTED=1"
    goto :ml_done
)
if /i "%ML_BACKEND%"=="hash" goto :ml_start
if exist "ml\.venv\.polaris-installed" goto :ml_start
echo [..] Semantic search needs a one-time setup: CUDA PyTorch + embedding model, about 3 GB.
call :ask "     Set it up now in a separate window"
if errorlevel 1 (
    echo [--] Skipped. Search uses BM25 keywords until you run start_all.bat again and answer Y.
    goto :ml_done
)
:ml_start
start "POLARIS - ML embedding service" /min powershell -NoExit -NoProfile -ExecutionPolicy Bypass -File "%CD%\ml\serve.ps1" -Backend %ML_BACKEND%
set "ML_STARTED=1"
echo [ok] Semantic search: ML service starting in its own window; embeddings rebuild automatically when it is ready.
:ml_done

rem ---- 7. Start -----------------------------------------------------------------
set "HELPER_FLAGS="
if defined ML_STARTED set "HELPER_FLAGS=-WaitForMl"
if defined POLARIS_NO_BROWSER set "HELPER_FLAGS=%HELPER_FLAGS% -NoBrowser"
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\start-helper.ps1" -Port %PORT% -Token "%ADMIN_TOKEN%" -MlUrl "%ML_URL%" %HELPER_FLAGS%

echo.
echo  POLARIS  http://localhost:%PORT%
echo    Explore, map, stations, knowledge graph, assistant: open to everyone
echo    Outreach studio and Admin: sign in with ADMIN_TOKEN = %ADMIN_TOKEN%
echo    Press Ctrl+C to stop the web app. Close the "POLARIS - ..." windows to stop the extras.
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
