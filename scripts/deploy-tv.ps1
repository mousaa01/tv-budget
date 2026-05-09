# Build, sign, and install the .wgt on the connected Samsung TV.
# Requires: Tizen VS Code extension installed; Samsung certificate profile named "tvbudget";
# TV connected via sdb (run once: sdb connect <TV-IP>:26101).

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

tizen package -t wgt -s tvbudget -- tizen
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

$device = (sdb devices | Select-String 'device\s+\S+$' | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1)
if (-not $device) {
  Write-Host "No TV connected. Run: sdb connect <TV-IP>:26101" -ForegroundColor Yellow
  exit 1
}
Write-Host ">>> Installing $($wgt.Name) on $device" -ForegroundColor Cyan
tizen install -n $wgt.FullName -t $device
if ($LASTEXITCODE -ne 0) { throw "install failed" }

# Kill any running instance, then launch fresh so the new code actually runs.
Write-Host ">>> Killing & relaunching app on TV" -ForegroundColor Cyan
sdb -s $device shell 0 was_kill TVbudget01.TVbudget 2>$null | Out-Null
Start-Sleep -Milliseconds 500
sdb -s $device shell 0 was_execute TVbudget01.TVbudget 2>$null | Out-Null
Write-Host "    relaunched." -ForegroundColor DarkGray
