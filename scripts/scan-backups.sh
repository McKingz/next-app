#!/usr/bin/env bash
set -euo pipefail

echo "Scanning for backup files and artifacts..."
rg -n --hidden --glob '!node_modules/**' '(.*(~|\.bak|\.old|\.orig|\.rej|\.tmp)$|\.DS_Store|Thumbs\.db)' || {
  echo "✓ No backup files found"
  exit 0
}
