"""
Shared helper for JARVIS <-> Hermes bridge plugins (NOT a plugin itself).

Dropping this file here means a plugin can `from _hermes_core import ...`
without a network call or extra dependency — it only shells out to the
`hermes` CLI that is already installed on this machine.

Why it exists / what it does:
  - Locate the `hermes` binary on PATH (fall back to common install spots).
  - Run `hermes chat -q "<request>"` in a chosen workspace and return the
    agent's final answer, trimmed to something the voice channel can speak.
  - Gate consequential requests: anything that sends / deletes / publishes /
    changes records / spends money requires an explicit spoken confirmation,
    matching the user's standing rule for Gmail/Calendar and money actions.

The plugin (the `PLUGIN` dict + `run()`) lives in its own file so JARVIS
auto-discovers it; this file starts with `_` so the loader skips it, exactly
like the project's other `_core.py` helpers.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

# Default workspace: Hermes runs where the user keeps remote-copilot-queue.
# Configurable per install via plugin_config["hermes"]["workspace"].
DEFAULT_WORKSPACE = str(Path(__file__).resolve().parent.parent)

# Requests hitting these verbs/permissions need a spoken "yes" first. This is
# the user's standing preference (explicit approval before consequential
# actions), carried into the voice channel.
SENSITIVE_PATTERNS = re.compile(
    r"\b(send|delete|remove|cancel|publish|post|pay|transfer|book|order|"
    r"buy|purchase|approve|reject|modify|update|change|schedule|create)\b",
    re.IGNORECASE,
)

# Hermes answers are drawn inside a box; the first non-box line after it is
# the actual reply. These are the box border / envelope lines to drop.
_NOISE_LINES = re.compile(
    r"^(Query:|Initializing agent|─|╭|╰|│\s*$|Resume this session|"
    r"hermes --resume|hermes -c|Session:|Title:|Duration:|Messages:|"
    r">\s*$)"
)


def hermes_command() -> str:
    """Absolute path to the hermes CLI, or 'hermes' if only on PATH."""
    exe = shutil.which("hermes")
    if exe:
        return exe
    # Common fallbacks when PATH isn't set up (e.g. launched from a GUI).
    for cand in (
        r"C:\Users\Asus\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe",
        r"C:\Users\Asus\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes",
        "/c/Users/Asus/AppData/Local/hermes/hermes-agent/venv/Scripts/hermes",
    ):
        if Path(cand).exists():
            return cand
    return "hermes"  # let subprocess raise a clear FileNotFoundError


def get_workspace(config: dict | None) -> str:
    """Workspace from plugin_config, else the repo root."""
    cfg = config or {}
    ws = cfg.get("workspace") or DEFAULT_WORKSPACE
    return str(os.path.expanduser(ws))


def is_sensitive(request: str) -> bool:
    """True if the request touches actions the user must confirm explicitly."""
    return bool(request and SENSITIVE_PATTERNS.search(request))


def add_kw(word: str) -> str:
    """Unused inline guard kept for clarity — kw handling is in run()."""
    return word


def invoke_hermes(request: str, workspace: str, timeout: int = 300) -> str:
    """Run one Hermes query in `workspace`; return the answer or an error line.

    Returns a short string safe to speak back. Raises nothing: any failure is
    returned as text so the voice loop keeps running.
    """
    herm = hermes_command()
    try:
        proc = subprocess.run(
            [herm, "chat", "-q", request],
            cwd=workspace,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except FileNotFoundError:
        return ("Sir, I could not find the Hermes CLI on this machine. "
                "Check that Hermes is installed and on the PATH.")
    except subprocess.TimeoutExpired:
        return "Sir, Hermes took too long to answer and I stopped waiting."
    except Exception as e:      # noqa: BLE001 — always recover as speech
        return f"Sir, the Hermes bridge hit an error: {e}"

    combined = (proc.stdout or "") + "\n" + (proc.stderr or "")
    answer = extract_answer(combined)
    if answer:
        return answer
    if proc.returncode != 0:
        return f"Sir, Hermes exited with an error ({proc.returncode}). " + excerpt(combined)
    # non-zero-free run but nothing parseable — surface the tail raw
    return excerpt(combined)


def extract_answer(text: str) -> str:
    """Pull the meaningful reply out of `hermes chat -q` stdout.

    The CLI wraps the reply in a box; we take the first non-noise line and
    stop at the next box/envelope marker.
    """
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or _NOISE_LINES.match(line):
            continue
        # stop at the next closing border or the "Resume this session" block
        if line in ("╰", "╯") or line.startswith("╰─"):
            if lines:
                break
            continue
        if "Resume this session" in line:
            break
        lines.append(line)
    out = " ".join(lines).strip()
    return out[:1200]


def excerpt(text: str, limit: int = 200) -> str:
    flat = " ".join(l for l in text.splitlines() if l.strip())
    return flat[-limit:]


def log(player, message: str) -> None:
    """Write to JARVIS's activity log if a player (JarvisUI) is present."""
    if player is not None:
        try:
            player.write_log(f"JARVIS: {message}")
        except Exception:
            pass
