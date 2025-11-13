#!/bin/bash

# Force Disconnect WhatsApp Script
# Use this if the UI disconnect button doesn't work

echo "🔧 Force WhatsApp Disconnect Tool"
echo "This will delete your WhatsApp contact record from the database"
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "⚠️  WARNING: This will permanently delete your WhatsApp connection data!"
echo "This cannot be undone."
echo ""

read -p "Are you sure you want to proceed? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "📱 Getting your user information..."

# Get current user ID and organization
echo "🔍 Checking current WhatsApp connections..."

# You can run this SQL to check current connections:
cat << 'EOF'
-- Check current WhatsApp connections
SELECT
    wc.id,
    wc.phone_e164,
    wc.consent_status,
    wc.created_at,
    p.first_name || ' ' || p.last_name as user_name,
    pr.name as school_name
FROM whatsapp_contacts wc
JOIN profiles p ON wc.user_id = p.id
LEFT JOIN preschools pr ON wc.preschool_id = pr.id
WHERE wc.consent_status = 'opted_in'
ORDER BY wc.created_at DESC;
EOF

echo ""
echo "📋 To force disconnect, run this SQL in your Supabase SQL Editor:"
echo ""
echo "DELETE FROM whatsapp_contacts WHERE consent_status = 'opted_in' AND phone_e164 = '+27670614747';"
echo ""
echo "⚠️  Replace '+27670614747' with the actual phone number you want to disconnect"
echo ""

read -p "Have you run the SQL command above? (yes/no): " SQL_RUN

if [ "$SQL_RUN" = "yes" ]; then
    echo "✅ Force disconnect completed!"
    echo ""
    echo "🔄 Now refresh your app to see the changes."
    echo "The WhatsApp integration should now show as disconnected."
else
    echo "❌ Please run the SQL command first, then re-run this script."
fi