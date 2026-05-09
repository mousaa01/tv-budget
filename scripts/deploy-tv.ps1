# Build, sign, and install the .wgt on the connected Samsung TV.
# Requires: Tizen VS Code extension installed; Samsung certificate profile named "tvbudget";
# TV connected via sdb (run once: sdb connect <TV-IP>:26101).

$ErrorActionPreference = 'Stop'
$env:TIZEN_TOOLS = "$env:USERPROFILE\.tizen-extension-platform\server\sdktools\data\tools"
$env:Path = "$env:TIZEN_TOOLS\ide\bin;$env:TIZEN_TOOLS;$env:Path"

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

Write-Host ">>> Signing & packaging tizen/ -> TVBudget.wgt" -ForegroundColor Cyan
Remove-Item "tizen\TVBudget.wgt" -ErrorAction SilentlyContinue
tizen package -t wgt -s tvbudget -- tizen
if ($LASTEXITCODE -ne 0) { throw "package failed" }

$device = (sdb devices | Select-String 'device\s+\S+$' | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1)
if (-not $device) {
  Write-Host "No TV connected. Run: sdb connect <TV-IP>:26101" -ForegroundColor Yellow
  exit 1
}
Write-Host ">>> Installing on $device" -ForegroundColor Cyan
tizen install -n tizen/TVBudget.wgt -t $device
