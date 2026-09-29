# Background helper for start_all.bat:
#   1. waits for the POLARIS web server and opens the browser,
#   2. if the ML embedding service was started, waits for it (first run may be installing)
#      and rebuilds the search embeddings so /explore and the assistant use hybrid retrieval.
param(
    [int]$Port = 3000,
    [string]$Token = '',
    [string]$MlUrl = 'http://127.0.0.1:8765',
    [switch]$WaitForMl,
    [switch]$NoBrowser
)
$ErrorActionPreference = 'SilentlyContinue'
# Poll 127.0.0.1: on Windows "localhost" tries IPv6 first and stalls ~2 s per request.
$base = "http://127.0.0.1:$Port"

function Test-Up([string]$url) {
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 $url | Out-Null; return $true } catch { return $false }
}

# 1. Web server (up to ~3 minutes: first start compiles and seeds the database)
$webUp = $false
for ($i = 0; $i -lt 180; $i++) { if (Test-Up "$base/api/health") { $webUp = $true; break }; Start-Sleep 1 }
if (-not $webUp) { exit 1 }
if (-not $NoBrowser) { Start-Process "http://localhost:$Port" }

# 2. ML service -> rebuild embeddings (up to ~30 minutes: first run downloads PyTorch + the base model)
if ($WaitForMl -and $Token) {
    for ($i = 0; $i -lt 900; $i++) { if (Test-Up "$MlUrl/health") { break }; Start-Sleep 2 }
    if (Test-Up "$MlUrl/health") {
        try {
            $r = Invoke-RestMethod -Method Post -Uri "$base/api/admin/embeddings/rebuild" -Headers @{ Authorization = "Bearer $Token" } -TimeoutSec 600
            Write-Host "[POLARIS] Search embeddings ready: $($r.embedded) records, model $($r.model). Hybrid search is on."
        } catch {
            Write-Host "[POLARIS] Could not rebuild embeddings: $($_.Exception.Message). Use Admin -> Rebuild embeddings."
        }
    }
}
