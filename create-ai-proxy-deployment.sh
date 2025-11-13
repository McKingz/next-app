#!/bin/bash

# Create deployment package for ai-proxy edge function
# This packages the function for manual upload to Supabase Dashboard

set -e

echo "🎯 Creating ai-proxy deployment package..."
echo ""

cd /workspaces/edupro/supabase/functions

# Create a clean deployment directory
rm -rf /tmp/ai-proxy-deploy
mkdir -p /tmp/ai-proxy-deploy/ai-proxy

# Copy all necessary files
echo "📦 Copying function files..."
cp -r ai-proxy/* /tmp/ai-proxy-deploy/ai-proxy/

# Create zip file
cd /tmp/ai-proxy-deploy
zip -r ai-proxy-deployment.zip ai-proxy/

# Move to workspace root for easy access
mv ai-proxy-deployment.zip /workspaces/edupro/

echo ""
echo "✅ Deployment package created: /workspaces/edupro/ai-proxy-deployment.zip"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Download the file: ai-proxy-deployment.zip"
echo ""
echo "2. Go to Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/functions"
echo ""
echo "3. Click on 'ai-proxy' function"
echo ""
echo "4. Click 'Deploy new version'"
echo ""
echo "5. Upload ai-proxy-deployment.zip"
echo ""
echo "6. ⚠️  CRITICAL: Verify ANTHROPIC_API_KEY is set in:"
echo "   https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/functions"
echo ""
echo "7. Test exam generation!"
echo ""
