#Requires -Version 5.1
<#
.SYNOPSIS
  One-shot Windows build and verification for the Signalwatch desktop app.

.DESCRIPTION
  Runs the complete documented desktop build path on a Windows host and then
  inspects the produced bundle. Designed to be run unattended by any local
  execution context — a human in PowerShell, CI, or a local agent runtime —
  so the result is reproducible and self-reporting.

  It deliberately does NOT weaken any verification gate. If a prerequisite is
  missing or the bundle looks wrong, it fails loudly rather than producing a
  plausible-looking installer.

.PARAMETER SkipBuild
  Run prerequisite checks and verification only; do not compile.

.EXAMPLE
  pwsh -File scripts/build-windows.ps1
#>
param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$projectRoot   = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent (Split-Path -Parent $projectRoot)

function Write-Step { param($Message) Write-Host "`n=== $Message ===" -ForegroundColor Cyan }
function Write-Ok   { param($Message) Write-Host "  [ok]   $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "  [warn] $Message" -ForegroundColor Yellow }
function Fail       { param($Message) Write-Host "  [FAIL] $Message" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
# 0. Platform
# ---------------------------------------------------------------------------
Write-Step 'Platform'
if (-not ($IsWindows -or $env:OS -eq 'Windows_NT')) {
  Fail 'This script must run on Windows. prepare-sidecar.mjs copies the build host''s Node runtime, so building elsewhere would stage a non-Windows binary inside the installer.'
}
Write-Ok "Windows $([System.Environment]::OSVersion.Version)"

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
Write-Step 'Prerequisites'

function Require-Command {
  param([string]$Name, [string]$Hint)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) { Fail "$Name not found. $Hint" }
  return $cmd.Source
}

$nodePath = Require-Command 'node'  'Install Node.js 20+ from https://nodejs.org'
Write-Ok "node   $(node --version)  ($nodePath)"

Require-Command 'pnpm'  'Run: corepack enable' | Out-Null
Write-Ok "pnpm   $(pnpm --version)"

Require-Command 'rustc' 'Install Rust from https://rustup.rs' | Out-Null
Write-Ok "rustc  $((rustc --version) -replace '^rustc ','')"

Require-Command 'cargo' 'Install Rust from https://rustup.rs' | Out-Null

# MSVC linker: Tauri needs the C++ build tools, and the failure mode without
# them ("link.exe not found") is confusing enough to be worth pre-empting.
if (-not (Get-Command 'link.exe' -ErrorAction SilentlyContinue)) {
  $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  if (Test-Path $vswhere) {
    $vs = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    if ($vs) { Write-Ok "MSVC build tools present ($vs)" }
    else { Write-Warn 'MSVC C++ build tools not detected; `cargo build` will fail at link time. Install "Desktop development with C++".' }
  } else {
    Write-Warn 'Could not detect MSVC build tools. If linking fails, install Visual Studio Build Tools with "Desktop development with C++".'
  }
} else {
  Write-Ok 'MSVC linker on PATH'
}

# WebView2 is a runtime requirement, not a build requirement.
$webview2 = Get-ItemProperty -Path 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
if ($webview2) { Write-Ok "WebView2 runtime $($webview2.pv)" }
else { Write-Warn 'WebView2 runtime not detected. The installer can bootstrap it, but the app will not launch without it.' }

# ---------------------------------------------------------------------------
# 2. Install dependencies
# ---------------------------------------------------------------------------
Write-Step 'Install workspace dependencies'
Push-Location $workspaceRoot
try {
  pnpm install --allow-build=esbuild
  if ($LASTEXITCODE -ne 0) { Fail 'pnpm install failed' }
  Write-Ok 'dependencies installed'
} finally { Pop-Location }

# ---------------------------------------------------------------------------
# 3. Build + verify (gates enforced, never relaxed)
# ---------------------------------------------------------------------------
Write-Step 'Build web client and prepare the API sidecar'
Push-Location $workspaceRoot
try {
  $env:PORT = '5000'; $env:BASE_PATH = '/'
  pnpm --filter '@workspace/signalwatch' run build
  if ($LASTEXITCODE -ne 0) { Fail 'web production build failed' }
  Write-Ok 'web production build'

  pnpm --filter '@workspace/signalwatch' exec node scripts/verify-pwa.mjs
  if ($LASTEXITCODE -ne 0) { Fail 'verify-pwa failed' }
  Write-Ok 'verify-pwa'

  pnpm --filter '@workspace/signalwatch-desktop' exec node scripts/prepare-sidecar.mjs
  if ($LASTEXITCODE -ne 0) { Fail 'sidecar preparation failed' }
  Write-Ok 'sidecar prepared with the Windows Node runtime'
} finally { Pop-Location }

Write-Step 'Verify desktop shell contract'
$env:VERIFY_DESKTOP_REQUIRE_RUNTIME = '1'
$env:VERIFY_DESKTOP_BOOT_SIDECAR    = '1'
$env:VERIFY_DESKTOP_TARGET          = 'win32'
Push-Location $projectRoot
try {
  node scripts/verify-desktop.mjs
  if ($LASTEXITCODE -ne 0) { Fail 'verify-desktop failed' }
  Write-Ok 'verify-desktop (incl. PE runtime guard and sidecar boot)'
} finally { Pop-Location }

if ($SkipBuild) {
  Write-Host "`nPrerequisites and gates verified. Skipping compilation (-SkipBuild)." -ForegroundColor Cyan
  exit 0
}

# ---------------------------------------------------------------------------
# 4. Compile and package
# ---------------------------------------------------------------------------
Write-Step 'Compile Tauri and package NSIS installer'
Push-Location $workspaceRoot
try {
  pnpm --filter '@workspace/signalwatch-desktop' run build
  if ($LASTEXITCODE -ne 0) { Fail 'tauri build failed' }
} finally { Pop-Location }

# ---------------------------------------------------------------------------
# 5. Inspect what was produced
# ---------------------------------------------------------------------------
Write-Step 'Inspect bundle'
$bundleDir = Join-Path $projectRoot 'src-tauri\target\release\bundle'
$installer = Get-ChildItem -Path (Join-Path $bundleDir 'nsis') -Filter '*.exe' -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) { Fail "no NSIS installer found under $bundleDir\nsis" }

$sizeMb = [math]::Round($installer.Length / 1MB, 1)
Write-Ok "installer  $($installer.FullName)"
Write-Ok "size       $sizeMb MB"

# The staged runtime must be a Windows PE binary, not an ELF copied in from
# another machine.
$stagedNode = Join-Path $projectRoot 'src-tauri\resources\runtime\node.exe'
if (-not (Test-Path $stagedNode)) { Fail 'resources/runtime/node.exe missing from the staged bundle' }
$magic = [System.IO.File]::ReadAllBytes($stagedNode)[0..1]
if ($magic[0] -ne 0x4D -or $magic[1] -ne 0x5A) { Fail 'staged runtime is not a Windows PE binary' }
Write-Ok 'staged runtime is a Windows PE binary (node.exe)'

$apiEntry = Join-Path $projectRoot 'src-tauri\resources\api\index.mjs'
if (-not (Test-Path $apiEntry)) { Fail 'resources/api/index.mjs missing from the staged bundle' }
Write-Ok 'Signalwatch API resources staged'

Write-Host @"

Build complete.

  installer : $($installer.FullName)
  size      : $sizeMb MB
  signing   : none (unsigned - SmartScreen will warn on first run)

Next, install and launch it, then confirm:
  * the app window opens and the UI loads
  * the bundled API answers on a loopback port
  * layers render (cameras, public events, maritime, natural hazards)
  * closing the app leaves no stray node.exe:
        Get-Process node -ErrorAction SilentlyContinue
"@ -ForegroundColor Cyan
