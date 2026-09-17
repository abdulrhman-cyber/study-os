$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$www  = Join-Path $PSScriptRoot "www"

if (Test-Path -LiteralPath $www) { Remove-Item -LiteralPath $www -Recurse -Force }
New-Item -ItemType Directory -Path $www | Out-Null

$items = @("index.html", "sw.js", "css", "js", "img")
foreach ($item in $items) {
  $src = Join-Path $root $item
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination $www -Recurse -Force
    Write-Host "  + $item"
  } else {
    Write-Host "  ! skipped (not found): $item"
  }
}

# استبعاد أي نسخ احتياطية من الحزمة
Get-ChildItem -LiteralPath $www -Recurse -File -Filter *.bak -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Host "Web assets synced -> $www"
