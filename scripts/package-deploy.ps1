# package-deploy.ps1
# Usage: .\scripts\package-deploy.ps1 [-SkipBuild]
# Creates deploy/kittangi-backend.zip and deploy/kittangi-frontend.zip

param(
    [switch]$SkipBuild
)

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

# ── Build ────────────────────────────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host ">>> Building workspace..." -ForegroundColor Cyan
    pnpm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed. Aborting."
        exit 1
    }
}

# ── Prepare deploy folder ────────────────────────────────────────────────────
$DeployDir = "$Root\deploy"
New-Item -ItemType Directory -Force -Path $DeployDir | Out-Null

# ── Backend zip ──────────────────────────────────────────────────────────────
Write-Host ">>> Packaging backend..." -ForegroundColor Cyan

$BackendStage = "$DeployDir\_backend-stage"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $BackendStage
New-Item -ItemType Directory -Force -Path $BackendStage | Out-Null

Copy-Item -Recurse -Force "$Root\artifacts\api-server\dist"               "$BackendStage\dist"
Copy-Item -Force          "$Root\artifacts\api-server\ecosystem.config.cjs" "$BackendStage\ecosystem.config.cjs"
Copy-Item -Force          "$Root\artifacts\api-server\.env.production"      "$BackendStage\.env.production"

$BackendZip = "$DeployDir\kittangi-backend.zip"
Remove-Item -Force -ErrorAction SilentlyContinue $BackendZip
Compress-Archive -Path "$BackendStage\*" -DestinationPath $BackendZip
Remove-Item -Recurse -Force $BackendStage

Write-Host "    kittangi-backend.zip -> $([math]::Round((Get-Item $BackendZip).Length / 1KB, 1)) KB" -ForegroundColor Green

# ── Frontend zip ─────────────────────────────────────────────────────────────
Write-Host ">>> Packaging frontend..." -ForegroundColor Cyan

$FrontendZip = "$DeployDir\kittangi-frontend.zip"
Remove-Item -Force -ErrorAction SilentlyContinue $FrontendZip
Compress-Archive -Path "$Root\artifacts\kittangi-os\dist\public\*" -DestinationPath $FrontendZip

Write-Host "    kittangi-frontend.zip -> $([math]::Round((Get-Item $FrontendZip).Length / 1KB, 1)) KB" -ForegroundColor Green

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Deploy packages ready ===" -ForegroundColor Yellow
Get-ChildItem $DeployDir | Format-Table Name, @{Label="Size (KB)"; Expression={[math]::Round($_.Length/1KB, 1)}}
