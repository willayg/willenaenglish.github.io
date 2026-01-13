Param(
  [switch]$RestartExisting
)

# Starts all Cloudflare Worker dev servers (wrangler dev) in separate PowerShell windows
# Saves started PIDs to .workers.pids.json in this scripts folder for later stop

$workers = @(
  @{ Name='supabase-auth'; Path='D:\Willena Website\willenaenglish.github.io\cloudflare-workers\supabase-auth'; Port=8787 },
  @{ Name='log-word-attempt'; Path='D:\Willena Website\willenaenglish.github.io\cloudflare-workers\log-word-attempt'; Port=8788 },
  @{ Name='homework-api'; Path='D:\Willena Website\willenaenglish.github.io\cloudflare-workers\homework-api'; Port=8789 },
  @{ Name='progress-summary'; Path='D:\Willena Website\willenaenglish.github.io\cloudflare-workers\progress-summary'; Port=8790 }
)

$pidFile = Join-Path $PSScriptRoot '.workers.pids.json'

function Stop-ExistingOnPort($port) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.OwningProcess) {
      try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
}

if ($RestartExisting) {
  Write-Host "Stopping any existing processes on worker ports..."
  foreach ($w in $workers) { Stop-ExistingOnPort $w.Port }
  Start-Sleep -Seconds 1
}

$started = @()
foreach ($w in $workers) {
  Write-Host "Starting $($w.Name) on port $($w.Port) in folder $($w.Path)"
  $cmd = "cd '$($w.Path)'; wrangler dev --port $($w.Port)"
  $proc = Start-Process -FilePath 'powershell' -ArgumentList '-NoExit','-Command',$cmd -PassThru
  $started += [pscustomobject]@{ name=$w.Name; port=$w.Port; pid=$proc.Id; path=$w.Path }
  Start-Sleep -Milliseconds 300
}

$started | ConvertTo-Json -Depth 3 | Set-Content -Path $pidFile -Encoding UTF8
Write-Host "Started workers. PID file: $pidFile"
$started | Format-Table -AutoSize

Write-Host "Tip: use scripts\stop-workers.ps1 to stop them, or re-run with -RestartExisting to refresh."
