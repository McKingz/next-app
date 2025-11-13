#!/bin/bash

# Test WhatsApp Integration Script
# Run this after updating your Meta token to verify everything works

echo "🧪 Testing WhatsApp Integration..."

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo ""
echo "📋 This test will:"
echo "   1. Check if environment variables are set"
echo "   2. Test the whatsapp-send function"
echo "   3. Show detailed error logs if something fails"
echo ""

read -p "📱 Enter a test phone number (with country code, e.g., +15551427341): " TEST_PHONE

if [ -z "$TEST_PHONE" ]; then
    echo "❌ Phone number cannot be empty"
    exit 1
fi

echo ""
echo "🔍 Testing WhatsApp function..."

# Create test payload
TEST_PAYLOAD='{
  "phone_number": "'$TEST_PHONE'",
  "message_type": "text",
  "content": "Hello! This is a test message from EduDash Pro to verify WhatsApp integration is working. Please ignore this message."
}'

echo "📤 Sending test message..."
echo "Payload: $TEST_PAYLOAD"
echo ""

# Call the function
curl -X POST \
  "https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/whatsapp-send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(supabase auth login --token)" \
  -d "$TEST_PAYLOAD" \
  -v

echo ""
echo ""
echo "📊 If the test failed, check:"
echo "   1. Supabase Dashboard Logs: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/logs"
echo "   2. Your Meta Business Manager for API errors"
echo "   3. The phone number format (should include country code)"
echo "   4. API version compatibility (using v22.0)"
echo ""
echo "💡 Common issues:"
echo "   - Access token expired or invalid"
echo "   - Phone Number ID incorrect"
echo "   - Phone number not registered in Meta Business"
echo "   - WhatsApp Business API not properly configured"
echo "   - Template 'hello_world' may not be available (try creating a custom template)"
echo ""
echo "🔧 Manual test command (if function test fails):"
echo "   curl -i -X POST \\"
echo "   'https://graph.facebook.com/v22.0/787005484496080/messages' \\"
echo "   -H 'Authorization: Bearer YOUR_TOKEN_HERE' \\"
echo "   -H 'Content-Type: application/json' \\"
echo "   -d '{\"messaging_product\": \"whatsapp\", \"to\": \"$TEST_PHONE\", \"type\": \"template\", \"template\": {\"name\": \"hello_world\", \"language\": {\"code\": \"en_US\"}}}'"
echo ""
