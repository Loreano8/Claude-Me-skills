#!/bin/bash
# Installe le CLI Agent Reach v1.6.0 (https://github.com/Panniantong/Agent-Reach) si absent,
# pour que le skill .claude/skills/agent-reach fonctionne dans chaque session cloud.
# Version figée + empreinte SHA-256 vérifiée (voir docs/agent-reach-securite.md).
set -euo pipefail

# Uniquement dans les sessions cloud (Claude Code web / téléphone).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

export PATH="$HOME/.local/bin:$PATH"

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$HOME/.local/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

if command -v agent-reach >/dev/null 2>&1; then
  exit 0
fi

URL="https://github.com/Panniantong/Agent-Reach/releases/download/v1.6.0/agent-reach.zip"
SHA256="59c37586e45e5e111a78686e98a9d11ae71a7b4b1a334c41aef82831ea5b0a05"

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -fsSL -o "$TMP/agent-reach.zip" "$URL"
if ! echo "$SHA256  $TMP/agent-reach.zip" | sha256sum -c --status; then
  echo "Agent Reach : empreinte SHA-256 inattendue, installation annulée." >&2
  exit 0
fi

uv tool install "$TMP/agent-reach.zip" >/dev/null 2>&1
agent-reach setup >/dev/null || true
