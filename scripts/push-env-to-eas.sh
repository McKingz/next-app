#!/bin/bash
# Push all EXPO_PUBLIC environment variables from .env to EAS environment
# This ensures EAS builds have the same configuration as local development

set -e

ENV_FILE="${1:-.env}"
ENVIRONMENT="${2:-development}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

echo "🚀 Pushing EXPO_PUBLIC_ environment variables to EAS environment: $ENVIRONMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Extract only EXPO_PUBLIC_ variables to a temporary file
TEMP_ENV="/tmp/edudash_public_vars_$$.env"
grep "^EXPO_PUBLIC_" "$ENV_FILE" > "$TEMP_ENV"

count=$(wc -l < "$TEMP_ENV")
echo "📦 Found $count EXPO_PUBLIC_ variables in $ENV_FILE"
echo ""

# Use EAS env:push to batch upload all variables
echo "⏳ Uploading to EAS..."
eas env:push --environment "$ENVIRONMENT" --path "$TEMP_ENV"

# Cleanup
rm -f "$TEMP_ENV"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Complete: Pushed $count variables to $ENVIRONMENT"
echo "✨ All variables uploaded successfully!"
echo ""
echo "Run 'eas env:list --environment $ENVIRONMENT' to verify"
