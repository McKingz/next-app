#!/usr/bin/env bash
set -euo pipefail

echo "Scanning for TODO/FIXME comments..."
rg -n --hidden --glob '!node_modules/**' --glob '!docs/OBSOLETE/**' '(TODO|FIXME)' || {
  echo "✓ No TODO/FIXME comments found"
  exit 0
}
