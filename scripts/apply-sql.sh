#!/usr/bin/env bash
set -euo pipefail

# Purpose: Apply SQL using Supabase CLI to the linked project
# Requirements: supabase CLI logged in and linked to the correct project

SQL_FILE="$1"
if [[ ! -f "$SQL_FILE" ]]; then
  echo "❌ SQL file not found: $SQL_FILE" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "❌ supabase CLI not found. Install: npm i -g supabase" >&2
  exit 1
fi

# Ensure project is linked
if ! supabase status >/dev/null 2>&1; then
  echo "⚠️  Not linked to a project. Run: supabase link --project-ref <ref>" >&2
  exit 1
fi

# Apply the SQL to the remote db
echo "🚀 Applying SQL: $SQL_FILE"
supabase db query "$(cat "$SQL_FILE")"
echo "✅ SQL applied successfully"
