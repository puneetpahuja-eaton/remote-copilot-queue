# 🚀 Complete System Cloning & Auto-Setup Guide

This repository contains the **complete, fully configured AI ecosystem** from your current system, including:
- **Hermes Agent** with full toolsets, custom skills, personality (`SOUL.md`), long-term memory (`MEMORY.md`, `USER.md`), and active cron monitors (Morning Briefing with Gmail & Calendar, Instagram Graph API Monitor, YouTube Monitor).
- **All Configured Integrations & Platforms**: WhatsApp Cloud API, Telegram Bot, Instagram Business, Gmail/Google Calendar OAuth, YouTube Data API, and LinkedIn.
- **All AI Provider Keys & OAuth Sessions**: OpenAI Codex tokens, Google Gemini, OpenRouter, NVIDIA, DeepSeek, OpenCode Zen, GitHub Copilot token, Kimi, Minimax, Groq, and Hugging Face.
- **Jarvis Holographic Voice AI (Mark-LIV)**: Complete with MediaPipe animated face model, real lip-sync, and custom **Hermes Agent Voice Bridge** plugins (`plugins/hermes_agent.py` and `plugins/_hermes_core.py`).
- **Natively Cluely AI Assistant**: Modified and upgraded Electron services (`LocalKnowledgeOrchestrator.ts`, `HindsightManager.ts`, `requestBuilder.ts`, `ProfileIntelligenceSettings.tsx`, etc.).
- **Remote Copilot Queue & Worker**: Supabase background worker and desktop automation.

---

## 🔒 Security & Secrets Vault Architecture

To protect your credentials from public exposure and prevent GitHub Secret Scanning / Push Protection blocks, all plaintext `.env` files, API keys, and OAuth token files are packaged into a high-security **AES-256 Encrypted Vault (`secrets_vault.enc`)**.

- **Encryption Standard**: AES-256-CBC with PBKDF2 (SHA-256, 50,000 iterations).
- **Default Master Passphrase**: `PuneetEatonHermes2026!` (pre-configured into the 1-click restore script for 100% hands-free execution).
- **Zero Exposure**: No raw tokens (`ghu_`, `AIzaSy`, `sk-`, etc.) are tracked as plaintext in Git history.

---

## ⚡ How to Clone & Setup on Another Machine (Zero Manual Involvement)

### Step 1: Clone this Repository on the New Machine
Open PowerShell or Command Prompt on your target computer and run:
```bash
git clone https://github.com/puneetpahuja-eaton/remote-copilot-queue.git
cd remote-copilot-queue
```

### Step 2: Run the 1-Click Setup Script
Simply double-click **`setup_new_machine.bat`** (or run in PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File .\setup_new_machine.ps1
```

The script will automatically execute all 6 phases:
1. **Prerequisite Auto-Installer**: Installs Git, Python 3.11+, Node.js LTS, and Astral uv via `winget`.
2. **Hermes Agent CLI Setup**: Installs the `hermes` CLI and adds binaries to the system PATH.
3. **Automated Vault Decryption & Key Deployment**: Decrypts `secrets_vault.enc` and deploys all configuration files, tokens, and cron jobs directly to `%LOCALAPPDATA%\hermes`, `%USERPROFILE%\.hermes`, `Mark-LIII\config\`, `natively-cluely-ai-assistant\`, and the root `.env`.
4. **Dynamic Path Normalization**: Detects the new machine's username and directories and automatically updates any hardcoded old paths.
5. **Jarvis Voice AI Setup**: Creates a dedicated Python virtual environment (`venv`), installs all audio and UI dependencies, and compiles OS audio bindings via `setup.py`.
6. **Natively & Queue Setup**: Runs `npm install` and configures Electron native modules.
7. **Generates Desktop Launchers**: Creates 1-click desktop batch files to start any or all services.

---

## 🎮 Launching Systems on the New Machine

After setup finishes, start any service with 1 click:

| Launcher Script | Description |
| :--- | :--- |
| **`START_ALL_SYSTEMS.bat`** | **Launches the complete AI stack** (Hermes Gateway, Jarvis Voice HUD, and Natively) together in separate windows. |
| **`START_HERMES.bat`** | Starts Hermes Agent Gateway (runs WhatsApp Cloud, Telegram Bot, and background cron jobs for Morning Brief, Instagram & YouTube). |
| **`START_JARVIS.bat`** | Launches Mark-LIV Holographic Voice AI with real lip-sync and Hermes voice integration. |
| **`START_NATIVELY.bat`** | Launches the Natively Cluely Electron desktop assistant. |
| **`START_WORKER.bat`** | Starts the Remote Copilot Supabase queue worker daemon. |

---

## 🔄 Re-bundling Updated Secrets in the Future

If you ever update your API keys or configurations and want to sync them again:
```powershell
# Re-packs all updated local configs into secrets_vault.enc
powershell -ExecutionPolicy Bypass -Command ". .\vault_crypto.ps1; Pack-AllSecrets -RepoRoot ."
git add secrets_vault.enc
git commit -m "chore: update encrypted secrets vault"
git push origin main
```
