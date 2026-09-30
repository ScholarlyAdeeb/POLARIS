# Background helper for start_all.bat: waits for the POLARIS web server, then opens the browser.
param(
    [int]$Port = 3000,
    [switch]$NoBrowser
)
$ErrorActionPreference = 'SilentlyContinue'
# Poll 127.0.0.1: on Windows "localhost" tries IPv6 first and stalls ~2 s per request.
$base = "http://127.0.0.1:$Port"

function Test-Up([string]$url) {
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 $url | Out-Null; return $true } catch { return $false }
}

# Up to ~3 minutes: the first start creates the tables and seeds the database.
$webUp = $false
for ($i = 0; $i -lt 180; $i++) { if (Test-Up "$base/api/health") { $webUp = $true; break }; Start-Sleep 1 }
if (-not $webUp) { exit 1 }
if (-not $NoBrowser) { Start-Process "http://localhost:$Port" }
