#!/bin/bash
set -e

echo "🚀 Deploying edge function fix..."
echo ""

cd /workspace

echo "📦 Deploying ai-proxy edge function..."
supabase functions deploy ai-proxy --no-verify-jwt

echo ""
echo "✅ Deployment complete!"
echo ""
echo "⚠️  CRITICAL: Check your ANTHROPIC_API_KEY"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/functions"
echo "2. Click 'Manage Environment Variables'"
echo "3. Verify ANTHROPIC_API_KEY exists and has a value"
echo ""
echo "If missing, add it from: https://console.anthropic.com/settings/keys"
echo ""
echo "Then test exam generation!"
echo ""
