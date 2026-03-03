# DeloApp: build and sync with Android. Run from DeloApp folder: .\run.ps1
$root = $PSScriptRoot
$frontend = Join-Path $root "frontend"
Set-Location $frontend
Write-Host "DeloApp frontend: $frontend"
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }
npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }
npx cap sync
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "Done. Open Android Studio: npx cap open android"
