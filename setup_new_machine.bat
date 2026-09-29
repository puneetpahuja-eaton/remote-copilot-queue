@echo off
title 1-Click Automated Setup for New Machine
cd /d "%~dp0"
echo ========================================================================
echo       STARTING AUTOMATED FULL-STACK CLONE & SETUP (POWERSHELL)
echo ========================================================================
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0setup_new_machine.ps1"
echo.
echo Setup process finished.
pause
