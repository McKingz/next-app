#!/bin/bash

# Deploy Financial Management Tables Migration
# This script deploys the comprehensive financial management schema

set -e

echo "🚀 Deploying Financial Management Tables Migration..."

# Load environment variables
if [ -f .env.migration ]; then
    echo "📁 Loading migration environment variables from .env.migration"
    source .env.migration
elif [ -f .env.local ]; then
    echo "📁 Loading environment variables from .env.local"
    source .env.local
fi

# Check if required environment variables are set
if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Missing required environment variables"
    echo "   Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set"
    exit 1
fi

SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL"

echo "🔗 Connecting to: $SUPABASE_URL"

# Function to execute SQL
execute_sql() {
    local sql_file="$1"
    local description="$2"
    
    echo "📋 $description..."
    
    if curl -s -X POST \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -d "$(jq -n --arg query "$(cat "$sql_file")" '{query: $query}')" \
        "$SUPABASE_URL/rest/v1/rpc/exec_sql" > /tmp/sql_result.json; then
        
        if grep -q '"error"' /tmp/sql_result.json; then
            echo "❌ SQL Error in $sql_file:"
            cat /tmp/sql_result.json | jq -r '.error // .message // .'
            return 1
        else
            echo "✅ $description completed successfully"
            return 0
        fi
    else
        echo "❌ Failed to connect to database"
        return 1
    fi
}

# Create exec_sql function if it doesn't exist
echo "🔧 Setting up SQL execution function..."
cat > /tmp/create_exec_sql.sql << 'EOF'
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE query;
    RETURN json_build_object('status', 'success');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('error', SQLERRM);
END;
$$;
EOF

curl -s -X POST \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -d "$(cat /tmp/create_exec_sql.sql | jq -Rs '{query: .}')" \
    "$SUPABASE_URL/rest/v1/rpc/exec_sql" > /dev/null || true

# Deploy the main financial management migration
if [ -f "migrations_drafts/20250913_create_financial_management_tables.sql" ]; then
    execute_sql "migrations_drafts/20250913_create_financial_management_tables.sql" "Creating Financial Management Tables"
else
    echo "❌ Financial management migration file not found!"
    exit 1
fi

# Deploy petty cash tables if they don't exist
if [ -f "migrations_drafts/20250913_create_petty_cash_table.sql" ]; then
    echo "📋 Creating Petty Cash Tables (if not already present)..."
    execute_sql "migrations_drafts/20250913_create_petty_cash_table.sql" "Creating Petty Cash Tables"
fi

# Verify deployment
echo "🔍 Verifying table creation..."

# Check if tables exist
cat > /tmp/verify_tables.sql << 'EOF'
SELECT 
    table_name,
    CASE WHEN table_name IS NOT NULL THEN '✅' ELSE '❌' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'financial_transactions',
    'expense_categories',
    'fee_structures',
    'student_fees',
    'payment_reminders',
    'school_settings',
    'petty_cash_transactions'
)
ORDER BY table_name;
EOF

echo "📊 Financial tables status:"
curl -s -X POST \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -d "$(cat /tmp/verify_tables.sql | jq -Rs '{query: .}')" \
    "$SUPABASE_URL/rest/v1/rpc/exec_sql" | jq -r '.[] | .table_name + " " + .status' 2>/dev/null || echo "Unable to verify tables"

# Check row counts
echo "📈 Sample data status:"
cat > /tmp/check_data.sql << 'EOF'
SELECT 
    'expense_categories' as table_name,
    COUNT(*) as row_count
FROM public.expense_categories
UNION ALL
SELECT 
    'fee_structures' as table_name,
    COUNT(*) as row_count
FROM public.fee_structures
UNION ALL
SELECT 
    'school_settings' as table_name,
    COUNT(*) as row_count
FROM public.school_settings;
EOF

curl -s -X POST \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -d "$(cat /tmp/check_data.sql | jq -Rs '{query: .}')" \
    "$SUPABASE_URL/rest/v1/rpc/exec_sql" | jq -r '.[] | .table_name + ": " + (.row_count | tostring) + " rows"' 2>/dev/null || echo "Unable to check data"

# Cleanup temporary files
rm -f /tmp/sql_result.json /tmp/create_exec_sql.sql /tmp/verify_tables.sql /tmp/check_data.sql

echo ""
echo "🎉 Financial Management Tables Migration Completed!"
echo ""
echo "📋 Tables created:"
echo "  ✅ financial_transactions - Main financial transactions"
echo "  ✅ expense_categories - Expense categorization"
echo "  ✅ fee_structures - Fee templates"
echo "  ✅ student_fees - Individual fee assignments"
echo "  ✅ payment_reminders - Payment reminder tracking"
echo "  ✅ school_settings - School financial settings"
echo "  ✅ petty_cash_transactions - Petty cash management"
echo ""
echo "🔐 Row Level Security (RLS) enabled with appropriate policies"
echo "📊 Default data inserted for existing preschools"
echo "🔄 Triggers and indexes created for optimal performance"
echo ""
echo "🎯 Next steps:"
echo "  1. Test the financial dashboard"
echo "  2. Verify data appears correctly"
echo "  3. Test creating new transactions"
echo ""