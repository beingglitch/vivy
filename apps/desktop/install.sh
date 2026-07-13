#!/usr/bin/env bash
# Installs the Vivy desktop agent as a systemd user service (auto-starts on login).
# Usage: ./install.sh <VIVY_INGEST_KEY> [VIVY_URL]
set -euo pipefail

KEY="${1:-}"
URL="${2:-https://vivy-sage.vercel.app}"
DIR="$(cd "$(dirname "$0")" && pwd)"
CONF_DIR="$HOME/.config/vivy"
UNIT_DIR="$HOME/.config/systemd/user"

if [ -z "$KEY" ] && [ ! -f "$CONF_DIR/agent.env" ]; then
  echo "usage: ./install.sh <VIVY_INGEST_KEY> [VIVY_URL]" >&2
  exit 1
fi

mkdir -p "$CONF_DIR" "$UNIT_DIR"

if [ -n "$KEY" ]; then
  cat > "$CONF_DIR/agent.env" <<EOF
VIVY_URL=$URL
VIVY_INGEST_KEY=$KEY
EOF
  chmod 600 "$CONF_DIR/agent.env"
  echo "wrote $CONF_DIR/agent.env"
fi

NODE_BIN="$(command -v node)"

cat > "$UNIT_DIR/vivy-agent.service" <<EOF
[Unit]
Description=Vivy desktop screen-time agent
After=graphical-session.target

[Service]
ExecStart=$NODE_BIN $DIR/agent.js
Restart=on-failure
RestartSec=30

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now vivy-agent.service
echo "vivy-agent running. Check: systemctl --user status vivy-agent"
echo "Remove:  systemctl --user disable --now vivy-agent"
