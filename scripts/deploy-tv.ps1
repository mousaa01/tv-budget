# Build, sign, and install the .wgt on the connected Samsung TV or Tizen Emulator.
# Requires: Tizen VS Code extension installed; Samsung certificate profile named "tvbudget";
# TV connected via sdb (run once: sdb connect <TV-IP>:26101).
# Usage:
#   scripts/deploy-tv.ps1              -> targets real TV (model UN...)
#   scripts/deploy-tv.ps1 -Target emulator -> targets Tizen emulator (T-samsung-*)

param(
  [string]$Target = "tv"   # "tv" | "emulator"
)

# Certificate profile to use for signing.
# "tvbudget"          -> registered with the real TV's DUID.
# "tvbudget-emulator" -> registered with the emulator DUID (XTCJYJZXZBZVK).
$CertProfile = if ($Target -eq "emulator") { "tvbudget-emulator" } else { "tvbudget" }

$ErrorActionPreference = 'Stop'
$env:TIZEN_TOOLS = "$env:USERPROFILE\.tizen-extension-platform\server\sdktools\data\tools"
$env:Path = "$env:TIZEN_TOOLS\ide\bin;$env:TIZEN_TOOLS;$env:Path"

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

Write-Host ">>> Signing & packaging tizen/ -> .wgt" -ForegroundColor Cyan
Get-ChildItem "tizen\*.wgt" -ErrorAction SilentlyContinue | Remove-Item -Force

# Cache-bust: rewrite config.xml's <content src> with a fresh timestamp param so
# the Samsung TV webview treats it as a new URL (its cache is keyed on full URL).
$configPath = "tizen\config.xml"
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$cfg = Get-Content $configPath -Raw
$cfg = [regex]::Replace($cfg, '<content src="https://tv-budget\.vercel\.app/[^"]*"', "<content src=`"https://tv-budget.vercel.app/?v=$stamp`"")
Set-Content -Path $configPath -Value $cfg -NoNewline
Write-Host "    cache-bust stamp: $stamp" -ForegroundColor DarkGray

tizen package -t wgt -s $CertProfile -- tizen
if ($LASTEXITCODE -ne 0) { throw "package failed" }

$wgt = Get-ChildItem "tizen\*.wgt" | Select-Object -First 1
if (-not $wgt) { throw "No .wgt produced" }

# Rename to a space-free name; Tizen install fails with spaces in the filename.
$safeName = "AdamsApple.wgt"
if ($wgt.Name -ne $safeName) {
  $newPath = Join-Path $wgt.DirectoryName $safeName
  Move-Item -Force $wgt.FullName $newPath
  $wgt = Get-Item $newPath
}

# For emulator: Tizen emulators auto-register with sdb when booted — no TCP connect needed.
# Just confirm one is visible before we proceed.
if ($Target -eq "emulator") {
  Write-Host ">>> Checking for Tizen emulator in sdb devices ..." -ForegroundColor Cyan
}

$device = (sdb devices | Select-String 'device\s+\S+$' | ForEach-Object {
  $line = $_.ToString()
  $parts = $line -split '\s+'
  [PSCustomObject]@{ Serial = $parts[0]; Model = $parts[-1] }
} | Where-Object {
  if ($Target -eq "emulator") {
    $_.Serial -like '*emulator*' -or $_.Model -like '*Emulator*'
  } else {
    $_.Serial -notlike '*emulator*' -and $_.Model -notlike '*Emulator*'
  }
} | Select-Object -First 1)
if (-not $device) {
  if ($Target -eq "emulator") {
    Write-Host ""  -ForegroundColor Yellow
    Write-Host "No Tizen emulator found after connect attempt." -ForegroundColor Yellow
    Write-Host "Make sure the emulator is fully booted in Tizen Studio Emulator Manager" -ForegroundColor Yellow
    Write-Host "before running this script." -ForegroundColor Yellow
  } else {
    Write-Host "No TV connected. Run: sdb connect <TV-IP>:26101" -ForegroundColor Yellow
  }
  exit 1
}
$deviceTarget = $device.Model
Write-Host ">>> Clearing WebApp cache on TV" -ForegroundColor Cyan
# Clear the webview disk cache. Suppress errors — this may fail if the dir doesn't exist.
$ErrorActionPreference = 'Continue'
sdb -s $device.Serial shell rm -rf /opt/usr/apps/TVbudget01.TVbudget/data/WebApp 2>$null | Out-Null
$ErrorActionPreference = 'Stop'
Write-Host "    cache cleared (or did not exist)." -ForegroundColor DarkGray
# Reconnect in case sdb shell closed the connection.
sdb connect $($device.Serial) 2>$null | Out-Null

Write-Host ">>> Installing $($wgt.Name) on $deviceTarget" -ForegroundColor Cyan
tizen install -n $wgt.FullName -t $deviceTarget
if ($LASTEXITCODE -ne 0) { throw "install failed" }

Write-Host ">>> Killing & relaunching app on TV" -ForegroundColor Cyan
try {
  # Use tizen run (official CLI) to launch the app cleanly after install.
  tizen run -p TVbudget01.TVbudget -t $deviceTarget 2>&1 | Out-Null
  Write-Host "    launched via tizen run." -ForegroundColor DarkGray
} catch {
  # Fallback to SDB shell commands if tizen run not supported
  sdb -s $device.Serial shell 0 was_kill TVbudget01.TVbudget 2>$null | Out-Null
  Start-Sleep -Milliseconds 800
  sdb -s $device.Serial shell 0 was_execute TVbudget01.TVbudget 2>$null | Out-Null
  Write-Host "    launched via sdb shell." -ForegroundColor DarkGray
}
