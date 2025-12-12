# Stops workers previously started by run-workers.ps1
$pidFile = Join-Path $PSScriptRoot '.workers.pids.json'
if (Test-Path $pidFile) {
  try {
    $list = Get-Content $pidFile -Raw | ConvertFrom-Json
    foreach ($entry in $list) {
      if ($entry.pid) {
        try { Stop-Process -Id $entry.pid -Force -ErrorAction SilentlyContinue; Write-Host "Stopped $($entry.name) PID $($entry.pid)" } catch {}
      }
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    Write-Host "Stopped processes from PID file and removed $pidFile"
  } catch {
    Write-Host "Error reading pid file, falling back to port-based kill"
    Remove-Item $pidFile -ErrorAction SilentlyContinue
  }
} else {
  Write-Host "No PID file found — killing any process listening on worker ports"
}

# Fallback: kill processes listening on the known worker ports
$ports = 8787,8788,8789,8790
foreach ($p in $ports) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.OwningProcess) {
      try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host "Stopped process $($_.OwningProcess) on port $p" } catch {}
    }
  }
}

Write-Host "Done."
