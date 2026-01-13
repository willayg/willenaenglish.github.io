# Show status of worker ports and any saved PIDs
$pidFile = Join-Path $PSScriptRoot '.workers.pids.json'
Write-Host "=== Listening TCP on worker ports ==="
netstat -ano | Select-String ':8787|:8788|:8789|:8790' | Select-String 'LISTENING' | ForEach-Object { $_.ToString() }
Write-Host "`n=== PID file contents (if present) ==="
if (Test-Path $pidFile) { Get-Content $pidFile } else { Write-Host "No PID file: $pidFile" }
