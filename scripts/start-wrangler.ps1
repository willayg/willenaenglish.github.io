<#
start-wrangler.ps1
Usage: .\start-wrangler.ps1 <worker-folder> <port>
Example: .\start-wrangler.ps1 "cloudflare-workers\supabase-auth" 8787

This script loads key=value pairs from the repo root `.env` (ignores lines starting with #),
exports them into the current PowerShell environment, maps a couple Supabase key names for
compatibility, then runs `npx wrangler dev --port <port>` in the worker folder.

Security: Do NOT commit your real `.env` to public repos. This is for local dev only.
#>
param(
  [Parameter(Mandatory=$true)][string]$WorkerPath,
  [Parameter(Mandatory=$true)][int]$Port
)

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$EnvFile = Join-Path $RepoRoot ".env"

if (-not (Test-Path $EnvFile)) {
  Write-Error "Cannot find .env at $EnvFile. Create one or run with environment variables already set."
  exit 1
}

# Load .env lines (KEY=VALUE), ignore comments and empty lines
Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if (-not [string]::IsNullOrWhiteSpace($line) -and -not $line.StartsWith('#')) {
    $parts = $line -split '=',2
    if ($parts.Count -eq 2) {
      $key = $parts[0].Trim()
      $val = $parts[1].Trim()
      # Remove surrounding quotes if present
      if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
        $val = $val.Substring(1,$val.Length-2)
      }
      # Use Set-Item to set environment variables when the name is dynamic
      Set-Item -Path "Env:\$key" -Value $val -Force
    }
  }
}

# Map older key names to the worker-expected names (adjust as needed)
if ($env:SUPABASE_KEY -and -not $env:SUPABASE_ANON_KEY) { $env:SUPABASE_ANON_KEY = $env:SUPABASE_KEY }
if ($env:SUPABASE_SERVICE_ROLE_KEY -and -not $env:SUPABASE_SERVICE_KEY) { $env:SUPABASE_SERVICE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY }

# Show which critical keys are available (redact values)
function _showKey($k) {
  $item = Get-Item -Path "Env:\$k" -ErrorAction SilentlyContinue
  if ($item -and $item.Value) { return "$k=***" } else { return "$k=(missing)" }
}
Write-Host "Starting wrangler dev for worker: $WorkerPath on port $Port"
Write-Host ($null) -NoNewline
Write-Host "Env summary: " -NoNewline
Write-Host "$(_showKey 'SUPABASE_URL'), $(_showKey 'SUPABASE_ANON_KEY'), $(_showKey 'SUPABASE_SERVICE_KEY')"

# Change directory into the worker folder and run wrangler dev
Push-Location (Join-Path $RepoRoot $WorkerPath)
Write-Host "CWD: $(Get-Location)"
# Run wrangler dev; this will keep the shell open and stream logs
npx wrangler dev --port $Port

# When wrangler exits, pop location
Pop-Location
