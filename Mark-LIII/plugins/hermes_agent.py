"""
Drop-in JARVIS plugin: Hermes Agent Bridge.

Discovered automatically by MARK LIII at startup.
Gives JARVIS voice access to Hermes Agent, its long-term memory, skills,
multimodal gateway, and Gmail/Calendar integration.

Respects your standing rules:
  - Read-only operations run immediately.
  - Sensitive operations (sending, deleting, modifying, scheduling) pause
    and require explicit spoken confirmation.
"""
from __future__ import annotations

import json
from pathlib import Path
from memory.config_manager import get_plugin_config
from ._hermes_core import invoke_hermes, get_workspace, is_sensitive, log

PLUGIN = {
    "name": "hermes_agent",
    "description": (
        "Run an autonomous task, search memory, or query Gmail/Calendar via Hermes Agent. "
        "Use this whenever the user asks Hermes to do something, checks a message/email, "
        "or asks about past decisions remembered by Hermes. "
        "Do NOT use this for local window controls or apps (use system/desktop tools instead)."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "request": {
                "type": "STRING",
                "description": "The exact natural-language request to pass to Hermes Agent."
            },
            "workspace": {
                "type": "STRING",
                "description": "Optional directory path for the Hermes run (defaults to project root)."
            }
        },
        "required": ["request"]
    },
}

PLUGIN_SETTINGS = {
    "namespace": "hermes",
    "title": "Hermes Agent Bridge",
    "fields": [
        {
            "key": "workspace",
            "label": "Default Workspace Directory",
            "type": "text",
            "default": "",
            "placeholder": "D:\\Khushboo\\Masai\\AgenticAI\\remote-copilot-queue"
        },
        {
            "key": "require_confirmation",
            "label": "Require Spoken Confirmation for Sensitive Actions",
            "type": "boolean",
            "default": True
        }
    ]
}


def run(parameters: dict, player=None, session_memory=None) -> str:
    """Execute a Hermes query via CLI and return the answer to JARVIS."""
    params = parameters or {}
    request = (params.get("request") or "").strip()
    if not request:
        return "Sir, please specify what you would like Hermes to do."

    # Load stored plugin config
    cfg = get_plugin_config("hermes")
    workspace = (params.get("workspace") or cfg.get("workspace") or "").strip()
    ws = get_workspace({"workspace": workspace} if workspace else cfg)

    # Check sensitivity rule (user's standing rule: confirm before send/delete/publish/pay/modify)
    require_conf = cfg.get("require_confirmation", True)
    if require_conf and is_sensitive(request):
        log(player, f"Hermes gated sensitive request: {request}")
        return (
            f"Sir, that request ('{request}') involves sending, modifying, or deleting records. "
            "Please say 'Yes, proceed' to confirm or tell me what to change."
        )

    log(player, f"Hermes → {request[:60]}...")

    answer = invoke_hermes(request, ws)
    log(player, f"Hermes answered: {answer[:80]}...")
    return answer
