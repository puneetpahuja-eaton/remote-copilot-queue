# ==============================================================================
# ULTIMATE 1-CLICK CLONE & RESTORE SETUP SCRIPT
# System: Hermes Agent (WhatsApp, Instagram, Telegram, Gmail/Calendar, YouTube)
#         + Jarvis Voice AI (Mark-LIII) + Natively Cluely AI Assistant
#         + Remote Copilot Queue
# Target OS: Windows 10 / 11
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$SkipPrereqs,
    [switch]$SkipHermesInstall,
    [switch]$NonInteractive
)

$ErrorActionPreference = "Continue"

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "       SYSTEM CLONING & FULL STACK RESTORATION ORCHESTRATOR             " -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "Target Machine: $env:COMPUTERNAME ($env:USERNAME)" -ForegroundColor Yellow
Write-Host "Workspace Root: $PSScriptRoot" -ForegroundColor Yellow
Write-Host "User Profile:   $env:USERPROFILE" -ForegroundColor Yellow
Write-Host "Local AppData:  $env:LOCALAPPDATA" -ForegroundColor Yellow
Write-Host "========================================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# STEP 0: Helper Functions
# ------------------------------------------------------------------------------
function Check-Command ($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Refresh-EnvPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$userPath;$machinePath"
}

function Add-ToUserPath ($newDir) {
    if (-not (Test-Path $newDir)) { return }
    $current = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($current -notlike "*$newDir*") {
        Write-Host "Adding $newDir to User PATH..." -ForegroundColor Cyan
        [Environment]::SetEnvironmentVariable("Path", "$newDir;$current", "User")
        $env:Path = "$newDir;$env:Path"
    }
}

# ------------------------------------------------------------------------------
# STEP 1: Prerequisites Check & Auto-Installation (Git, Python, Node.js)
# ------------------------------------------------------------------------------
Write-Host "`n[PHASE 1/6] Checking System Prerequisites..." -ForegroundColor Magenta

if (-not $SkipPrereqs) {
    $hasWinget = Check-Command "winget"

    # 1.1 Git
    if (-not (Check-Command "git")) {
        Write-Host "Git is not detected! Installing Git via winget..." -ForegroundColor Yellow
        if ($hasWinget) {
            winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements
            Refresh-EnvPath
        } else {
            Write-Warning "winget not found. Please install Git manually from https://git-scm.com/download/win"
        }
    } else {
        $gitVer = git --version
        Write-Host "[OK] Git: $gitVer" -ForegroundColor Green
    }

    # 1.2 Python 3.11+
    $pyOk = $false
    if (Check-Command "python") {
        $pyVerStr = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
        if ($pyVerStr -and [version]$pyVerStr -ge [version]"3.11") {
            $pyOk = $true
            Write-Host "[OK] Python: version $pyVerStr detected" -ForegroundColor Green
        }
    }

    if (-not $pyOk) {
        Write-Host "Python 3.11+ is not found. Installing Python 3.11 via winget..." -ForegroundColor Yellow
        if ($hasWinget) {
            winget install --id Python.Python.3.11 -e --silent --accept-package-agreements --accept-source-agreements
            Refresh-EnvPath
        } else {
            Write-Warning "winget not found. Please install Python 3.11 from https://www.python.org/downloads/"
        }
    }

    # 1.3 Node.js & npm (LTS)
    if (-not (Check-Command "node") -or -not (Check-Command "npm")) {
        Write-Host "Node.js / npm not detected. Installing Node.js LTS via winget..." -ForegroundColor Yellow
        if ($hasWinget) {
            winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
            Refresh-EnvPath
        } else {
            Write-Warning "Please install Node.js LTS from https://nodejs.org/"
        }
    } else {
        $nodeVer = node --version
        $npmVer = npm --version
        Write-Host "[OK] Node.js $nodeVer (npm $npmVer)" -ForegroundColor Green
    }

    # 1.4 Astral uv (for fast python management)
    if (-not (Check-Command "uv")) {
        Write-Host "Installing Astral uv..." -ForegroundColor Cyan
        try {
            powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
            Refresh-EnvPath
        } catch {
            Write-Warning "Failed to install uv via web. Python pip will be used as fallback."
        }
    } else {
        Write-Host "[OK] uv tool detected" -ForegroundColor Green
    }
}

# ------------------------------------------------------------------------------
# STEP 2: Hermes Agent Installation & Full Config Restoration
# ------------------------------------------------------------------------------
Write-Host "`n[PHASE 2/6] Restoring Hermes Agent & Credentials..." -ForegroundColor Magenta

$hermesHome = "$env:LOCALAPPDATA\hermes"
$userDotHermes = "$env:USERPROFILE\.hermes"
$hermesBackupApp = Join-Path $PSScriptRoot "hermes_config\AppData_Local_hermes"
$hermesBackupHome = Join-Path $PSScriptRoot "hermes_config\UserProfile_dot_hermes"

# Create directories
New-Item -ItemType Directory -Force -Path $hermesHome | Out-Null
New-Item -ItemType Directory -Force -Path "$hermesHome\bin" | Out-Null
New-Item -ItemType Directory -Force -Path "$hermesHome\cron" | Out-Null
New-Item -ItemType Directory -Force -Path "$hermesHome\memories" | Out-Null
New-Item -ItemType Directory -Force -Path "$hermesHome\scripts" | Out-Null
New-Item -ItemType Directory -Force -Path "$hermesHome\skills" | Out-Null
New-Item -ItemType Directory -Force -Path $userDotHermes | Out-Null

# 2.1 Install Hermes Agent CLI if not present
$hermesExe = "$hermesHome\hermes-agent\bin\hermes.exe"
if (-not (Test-Path $hermesExe) -and -not (Check-Command "hermes") -and -not $SkipHermesInstall) {
    Write-Host "Hermes Agent CLI not installed. Running official Hermes Windows installer..." -ForegroundColor Cyan
    try {
        powershell -ExecutionPolicy Bypass -Command "iex (irm https://hermes-agent.nousresearch.com/install.ps1)"
    } catch {
        Write-Warning "Web install had issues. Attempting direct git clone and setup..."
        if (Check-Command "git") {
            git clone --depth 1 https://github.com/NousResearch/hermes-agent.git "$hermesHome\hermes-agent"
            Push-Location "$hermesHome\hermes-agent"
            python -m venv venv
            .\venv\Scripts\pip install -e .
            Pop-Location
        }
    }
    Refresh-EnvPath
}

# 2.2 Restore all Hermes configurations, keys, tokens, cron jobs, scripts, skills
$vaultEnc = Join-Path $PSScriptRoot "secrets_vault.enc"
$vaultHelper = Join-Path $PSScriptRoot "vault_crypto.ps1"
if (Test-Path $vaultEnc) {
    if (Test-Path $vaultHelper) {
        . $vaultHelper
        Unpack-AllSecrets -RepoRoot $PSScriptRoot
    }
} elseif (Test-Path $hermesBackupApp) {
    Write-Host "Deploying Hermes configuration files and API keys from unencrypted backup..." -ForegroundColor Cyan
    Copy-Item "$hermesBackupApp\*" "$hermesHome" -Recurse -Force

    # Restore ~/.hermes
    if (Test-Path $hermesBackupHome) {
        Write-Host "Deploying UserProfile .hermes files..." -ForegroundColor Cyan
        Copy-Item "$hermesBackupHome\*" "$userDotHermes" -Recurse -Force
    }
}

    # 2.3 Dynamic Path Normalization
    # Replaces old machine path (C:/Users/Asus or D:/Khushboo/...) with new machine paths
    Write-Host "Normalizing hardcoded paths for current machine..." -ForegroundColor Cyan
    $filesToPatch = @(
        "$hermesHome\config.yaml",
        "$hermesHome\.env",
        "$hermesHome\auth.json",
        "$hermesHome\cron\jobs.json"
    ) + (Get-ChildItem "$hermesHome\scripts\*.py" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)

    $oldUserPatterns = @("C:\\Users\\Asus", "C:/Users/Asus", "c:\\users\\asus", "c:/users/asus")
    $newUserWin = $env:USERPROFILE -replace "\\", "\\"
    $newUserFwd = $env:USERPROFILE -replace "\\", "/"
    $newRootWin = $PSScriptRoot -replace "\\", "\\"
    $newRootFwd = $PSScriptRoot -replace "\\", "/"

    foreach ($file in $filesToPatch) {
        if (Test-Path $file) {
            $content = [System.IO.File]::ReadAllText($file)
            $origContent = $content

            # Replace user paths
            $content = $content -replace "C:\\\\Users\\\\Asus", $newUserWin
            $content = $content -replace "C:/Users/Asus", $newUserFwd
            $content = $content -replace "C:\\Users\\Asus", $env:USERPROFILE
            
            # Replace old workspace directory if present
            $content = $content -replace "D:\\\\Khushboo\\\\Masai\\\\AgenticAI\\\\remote-copilot-queue", $newRootWin
            $content = $content -replace "D:/Khushboo/Masai/AgenticAI/remote-copilot-queue", $newRootFwd
            $content = $content -replace "d:\\khushboo\\masai\\agenticai\\remote-copilot-queue", $newRootWin
            $content = $content -replace "d:\\Khushboo\\Masai\\AgenticAI", $newRootWin

            if ($content -ne $origContent) {
                [System.IO.File]::WriteAllText($file, $content)
                Write-Host "  Patched paths in: $([System.IO.Path]::GetFileName($file))" -ForegroundColor DarkGray
            }
        }
    }

    # Ensure hermes binaries in PATH
    Add-ToUserPath "$hermesHome\bin"
    Add-ToUserPath "$hermesHome\hermes-agent\bin"
    Add-ToUserPath "$hermesHome\hermes-agent\venv\Scripts"

    Write-Host "[OK] Hermes Agent & All Keys Restored!" -ForegroundColor Green
} else {
    Write-Warning "hermes_config directory not found in repository root!"
}

# ------------------------------------------------------------------------------
# STEP 3: Jarvis Voice AI (Mark-LIII) Setup
# ------------------------------------------------------------------------------
Write-Host "`n[PHASE 3/6] Setting up Jarvis AI (Mark-LIII)..." -ForegroundColor Magenta
$jarvisDir = Join-Path $PSScriptRoot "Mark-LIII"

if (Test-Path $jarvisDir) {
    Push-Location $jarvisDir

    # Create venv if not existing
    if (-not (Test-Path "venv")) {
        Write-Host "Creating Python virtual environment for Jarvis..." -ForegroundColor Cyan
        python -m venv venv
    }

    $jarvisPip = ".\venv\Scripts\pip.exe"
    $jarvisPython = ".\venv\Scripts\python.exe"

    if (Test-Path $jarvisPython) {
        Write-Host "Upgrading pip & installing Jarvis dependencies..." -ForegroundColor Cyan
        & $jarvisPython -m pip install --upgrade pip setuptools wheel --quiet

        if (Test-Path "requirements.txt") {
            & $jarvisPython -m pip install -r requirements.txt --quiet
        }

        # Run setup.py if available to ensure OS sound & visual drivers
        if (Test-Path "setup.py") {
            Write-Host "Running Jarvis setup.py..." -ForegroundColor Cyan
            & $jarvisPython setup.py
        }

        # Patch workspace in plugins/_hermes_core.py
        $hermesCorePlugin = "plugins\_hermes_core.py"
        if (Test-Path $hermesCorePlugin) {
            $hcContent = [System.IO.File]::ReadAllText($hermesCorePlugin)
            $hcContent = $hcContent -replace "C:\\\\Users\\\\Asus", ($env:USERPROFILE -replace "\\", "\\")
            $hcContent = $hcContent -replace "D:\\\\Khushboo\\\\Masai\\\\AgenticAI\\\\remote-copilot-queue", ($PSScriptRoot -replace "\\", "\\")
            [System.IO.File]::WriteAllText($hermesCorePlugin, $hcContent)
        }

        Write-Host "[OK] Jarvis Voice AI Setup Complete!" -ForegroundColor Green
    } else {
        Write-Warning "Jarvis virtual environment pip could not be located."
    }

    Pop-Location
} else {
    Write-Warning "Mark-LIII directory not found."
}

# ------------------------------------------------------------------------------
# STEP 4: Natively Cluely AI Assistant Setup
# ------------------------------------------------------------------------------
Write-Host "`n[PHASE 4/6] Setting up Natively Cluely AI Assistant..." -ForegroundColor Magenta
$nativelyDir = Join-Path $PSScriptRoot "natively-cluely-ai-assistant"

if (Test-Path $nativelyDir) {
    Push-Location $nativelyDir

    # Restore .env if missing from example
    if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
        Copy-Item ".env.example" ".env"
    }

    Write-Host "Installing Natively npm packages..." -ForegroundColor Cyan
    npm install --legacy-peer-deps --no-audit --prefer-offline

    Write-Host "[OK] Natively Cluely AI Assistant Setup Complete!" -ForegroundColor Green
    Pop-Location
} else {
    Write-Warning "natively-cluely-ai-assistant directory not found."
}

# ------------------------------------------------------------------------------
# STEP 5: Remote Copilot Queue Setup
# ------------------------------------------------------------------------------
Write-Host "`n[PHASE 5/6] Setting up Remote Copilot Queue..." -ForegroundColor Magenta
Push-Location $PSScriptRoot

if (Test-Path "package.json") {
    Write-Host "Installing Queue root dependencies..." -ForegroundColor Cyan
    npm install --no-audit --prefer-offline
}

# Normalize workspace directory in root .env
$rootEnv = Join-Path $PSScriptRoot ".env"
if (Test-Path $rootEnv) {
    $rContent = [System.IO.File]::ReadAllText($rootEnv)
    $rContent = $rContent -replace "COPILOT_WORKSPACE=.*", "COPILOT_WORKSPACE=`"$PSScriptRoot`""
    [System.IO.File]::WriteAllText($rootEnv, $rContent)
    Write-Host "Updated COPILOT_WORKSPACE to: $PSScriptRoot" -ForegroundColor DarkGray
}

Pop-Location
Write-Host "[OK] Remote Copilot Queue Setup Complete!" -ForegroundColor Green

# ------------------------------------------------------------------------------
# STEP 6: Desktop / Quick-Start Launchers Creation
# ------------------------------------------------------------------------------
Write-Host "`n[PHASE 6/6] Generating One-Click Quick Launchers..." -ForegroundColor Magenta

# 6.1 Start Hermes Gateway
$batHermes = @"
@echo off
title Hermes Agent Gateway
cd /d "%~dp0"
echo Starting Hermes Gateway with WhatsApp, Telegram, Instagram, YouTube cron...
hermes gateway
pause
"@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "START_HERMES.bat"), $batHermes)

# 6.2 Start Jarvis AI
$batJarvis = @"
@echo off
title Jarvis Voice AI (Mark LIV)
cd /d "%~dp0Mark-LIII"
echo Starting Jarvis Holographic Voice AI...
call venv\Scripts\python.exe main.py
pause
"@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "START_JARVIS.bat"), $batJarvis)

# 6.3 Start Natively
$batNatively = @"
@echo off
title Natively Cluely AI Assistant
cd /d "%~dp0natively-cluely-ai-assistant"
echo Starting Natively Assistant...
npm run dev
pause
"@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "START_NATIVELY.bat"), $batNatively)

# 6.4 Start Worker
$batWorker = @"
@echo off
title Remote Copilot Queue Worker
cd /d "%~dp0"
echo Starting Remote Copilot Worker...
node worker.js
pause
"@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "START_WORKER.bat"), $batWorker)

# 6.5 Master Launcher (Start All)
$batAll = @"
@echo off
title Master AI Ecosystem Launcher
echo ===================================================
echo     STARTING COMPLETE AI AGENT & ASSISTANT STACK   
echo ===================================================
start "Hermes Gateway" START_HERMES.bat
timeout /t 2 /nobreak >nul
start "Jarvis Voice AI" START_JARVIS.bat
timeout /t 2 /nobreak >nul
start "Natively Assistant" START_NATIVELY.bat
echo All systems launching in separate windows!
"@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "START_ALL_SYSTEMS.bat"), $batAll)

Write-Host "Created Launcher Scripts:" -ForegroundColor Cyan
Write-Host "  - START_ALL_SYSTEMS.bat (Launch everything in 1 click)" -ForegroundColor Green
Write-Host "  - START_HERMES.bat" -ForegroundColor Green
Write-Host "  - START_JARVIS.bat" -ForegroundColor Green
Write-Host "  - START_NATIVELY.bat" -ForegroundColor Green
Write-Host "  - START_WORKER.bat" -ForegroundColor Green

Write-Host "`n========================================================================" -ForegroundColor Cyan
Write-Host "          ALL INSTALLATIONS & CONFIGURATIONS FINISHED!                  " -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "Everything is configured and ready to run with zero manual setup." -ForegroundColor White
Write-Host "To start all services, simply double-click: START_ALL_SYSTEMS.bat" -ForegroundColor Yellow
Write-Host "========================================================================`n" -ForegroundColor Cyan
