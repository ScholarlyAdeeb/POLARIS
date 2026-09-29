# Give .env a persistent ADMIN_TOKEN (needed by the outreach studio, admin page and embedding rebuild).
# Leaves an existing non-empty token untouched. Writes UTF-8 without BOM.
param([string]$EnvFile = '.env')
$path = (Resolve-Path $EnvFile).Path
$lines = [System.IO.File]::ReadAllLines($path)
if ($lines | Where-Object { $_ -match '^\s*ADMIN_TOKEN\s*=\s*\S' }) { exit 0 }
$chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$token = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
$kept = @($lines | Where-Object { $_ -notmatch '^\s*ADMIN_TOKEN\s*=' })
$kept += "ADMIN_TOKEN=$token"
[System.IO.File]::WriteAllLines($path, $kept, (New-Object System.Text.UTF8Encoding $false))
Write-Host '[ok] Created a persistent ADMIN_TOKEN in .env'
