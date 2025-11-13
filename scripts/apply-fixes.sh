#!/bin/bash

# Script to apply database fixes for push_devices and subscription function

set -e

echo "🚀 Applying database fixes..."

# Check if required environment variables are set
if [ -z "$SUPABASE_DB_URL" ] && [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: SUPABASE_DB_URL or DATABASE_URL must be set"
    exit 1
fi

DB_URL="${SUPABASE_DB_URL:-$DATABASE_URL}"

echo "📋 Applying push_devices language column migration..."
psql "$DB_URL" -f db/20250916_add_language_to_push_devices.sql

echo "📋 Applying function overload fix (if needed)..."
if psql "$DB_URL" -f fix-function-overload.sql 2>/dev/null; then
    echo "✅ Function overload fix applied successfully"
else
    echo "⚠️  Function overload fix skipped (may already be applied or not needed)"
fi

echo "🔍 Verifying push_devices table structure..."
psql "$DB_URL" -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'push_devices' AND table_schema = 'public' ORDER BY ordinal_position;"

echo "🔍 Verifying function exists..."
psql "$DB_URL" -c "SELECT proname, pg_get_function_arguments(oid) as args FROM pg_proc WHERE proname = 'update_preschool_subscription';"

echo "✅ All fixes applied successfully!"
echo ""
echo "📌 Next steps:"
echo "1. Test subscription creation in the super admin dashboard"
echo "2. Test push notification functionality"
echo "3. Ensure the back button works properly in the subscription modal"