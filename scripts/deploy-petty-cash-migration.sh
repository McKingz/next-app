#!/bin/bash

# Deploy Petty Cash Table Migration
# This script creates the petty_cash_transactions table and related policies

set -e

echo "🏦 Deploying Petty Cash Table Migration..."

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project directory"
    echo "Please run this script from your project root"
    exit 1
fi

# Load environment variables if available
if [ -f ".env.local" ]; then
    echo "📄 Loading environment variables from .env.local"
    set -a
    source .env.local
    set +a
fi

# Apply the migration
echo "📝 Applying petty cash table migration..."
supabase db push --db-url "${EXPO_PUBLIC_SUPABASE_URL/https:\/\//postgresql://postgres:[password]@}" --include-all

# Alternative: Apply migration file directly if push doesn't work
if [ $? -ne 0 ]; then
    echo "⚠️ Push failed, trying direct SQL execution..."
    
    if [ -n "$SUPABASE_DB_PASSWORD" ]; then
        psql "${DATABASE_URL}" -f "migrations_drafts/20250913_create_petty_cash_table.sql"
    else
        echo "🔧 Please run this SQL manually in your Supabase SQL editor:"
        echo "migrations_drafts/20250913_create_petty_cash_table.sql"
        cat "migrations_drafts/20250913_create_petty_cash_table.sql"
    fi
fi

echo "✅ Petty Cash Migration Complete!"
echo ""
echo "📊 The following was created:"
echo "  - petty_cash_transactions table"
echo "  - Indexes for performance"
echo "  - RLS policies for data security"
echo "  - opening_balance and petty_cash_limit fields in school_settings"
echo "  - Sample data for testing"
echo ""
echo "🔧 Next steps:"
echo "  1. Test the petty cash functionality in the app"
echo "  2. Adjust opening balances per school in school_settings table"
echo "  3. Review and customize expense categories if needed"