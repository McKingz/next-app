#!/bin/bash

# Script to update WhatsApp Environment Variables
# Run this after generating a new token from Meta Business

echo "🔧 Setting up WhatsApp Environment Variables..."

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo ""
echo "📋 You'll need these values from Meta Business Manager:"
echo "   1. Access Token (from WhatsApp API Setup page)"
echo "   2. Phone Number ID (numeric ID, not the phone number)"
echo ""

# Prompt for access token
read -p "🔑 Enter your new WhatsApp Access Token: " WHATSAPP_TOKEN

if [ -z "$WHATSAPP_TOKEN" ]; then
    echo "❌ Access token cannot be empty"
    exit 1
fi

# Prompt for phone number ID
read -p "📱 Enter your WhatsApp Phone Number ID: " PHONE_NUMBER_ID

if [ -z "$PHONE_NUMBER_ID" ]; then
    echo "❌ Phone Number ID cannot be empty"
    exit 1
fi

echo ""
echo "🚀 Setting environment variables..."

# Set the environment variables
supabase secrets set WHATSAPP_ACCESS_TOKEN="$WHATSAPP_TOKEN"
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="$PHONE_NUMBER_ID"

# Optional: Set API version (defaults to v19.0 if not set)
supabase secrets set META_API_VERSION="v20.0"

echo ""
echo "📦 Redeploying WhatsApp function with new credentials..."
supabase functions deploy whatsapp-send

echo ""
echo "✅ WhatsApp configuration updated successfully!"
echo ""
echo "🧪 Test your setup:"
echo "   1. Go to your teacher dashboard"
echo "   2. Open the WhatsApp Integration modal"
echo "   3. Click 'Send Test Message'"
echo "   4. Check if the message sends without 500 errors"
echo ""
echo "📊 Monitor logs:"
echo "   - Dashboard: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/logs"
echo "   - Look for detailed error logs if issues persist"
echo ""
