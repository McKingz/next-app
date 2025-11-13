#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/switch-project.sh [dashpro|edudashpro]"
  exit 1
fi

PROJECT="$1"
CONFIG_FILE="config/app.json.${PROJECT}"
TARGET="app.json"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: Config not found: $CONFIG_FILE"
  exit 1
fi

cp -f "$CONFIG_FILE" "$TARGET"

# Print confirmation
node scripts/verify-config.js
