#!/bin/bash

# EduDash Pro Database Backup Script
# Run this before applying security fixes

echo "🛡️ EduDash Pro Database Backup Script"
echo "======================================"

# Create backup directory with timestamp
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)_pre_security_fixes"
mkdir -p "$BACKUP_DIR"

echo "📁 Creating backup directory: $BACKUP_DIR"

# Check if we have database connection info
if [ -f ".env.local" ]; then
    echo "✅ Found .env.local file"
    source .env.local
elif [ -f ".env" ]; then
    echo "✅ Found .env file" 
    source .env
else
    echo "⚠️  No .env file found. You'll need to provide database connection manually."
    echo ""
    echo "Please provide your Supabase database connection URL:"
    echo "Format: postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres"
    read -p "Database URL: " SUPABASE_DB_URL
fi

# Check if pg_dump is available
if command -v pg_dump &> /dev/null; then
    echo "✅ pg_dump found"
    
    if [ -n "$SUPABASE_DB_URL" ]; then
        echo "🔄 Creating full database backup..."
        pg_dump "$SUPABASE_DB_URL" \
            --no-owner \
            --no-privileges \
            --verbose \
            --file="$BACKUP_DIR/full_backup.sql" 2>&1 | tee "$BACKUP_DIR/backup.log"
        
        echo "🔄 Creating schema-only backup..."
        pg_dump "$SUPABASE_DB_URL" \
            --schema-only \
            --no-owner \
            --no-privileges \
            --file="$BACKUP_DIR/schema_backup.sql"
            
        echo "🔄 Creating data-only backup..."
        pg_dump "$SUPABASE_DB_URL" \
            --data-only \
            --no-owner \
            --no-privileges \
            --file="$BACKUP_DIR/data_backup.sql"
            
        echo "✅ Database backups created successfully!"
    else
        echo "❌ No database URL provided. Skipping pg_dump backup."
    fi
else
    echo "⚠️  pg_dump not found. Install PostgreSQL client tools or use manual method."
fi

# Create verification script
cat > "$BACKUP_DIR/verify_backup.sql" << 'EOF'
-- Verification queries to run after backup
-- Run these in Supabase Dashboard to verify your backup captured everything

-- Count critical records
SELECT 
  'profiles' as table_name, 
  count(*) as record_count 
FROM public.profiles
UNION ALL
SELECT 
  'preschools', 
  count(*) 
FROM public.preschools
UNION ALL
SELECT 
  'subscriptions', 
  count(*) 
FROM public.subscriptions
UNION ALL
SELECT 
  'subscription_plans', 
  count(*) 
FROM public.subscription_plans;

-- Count functions
SELECT 
  count(*) as function_count,
  'Total custom functions' as description
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname NOT LIKE 'pg_%';

-- Count RLS policies  
SELECT 
  count(*) as policy_count,
  'Total RLS policies' as description
FROM pg_policies
WHERE schemaname = 'public';

-- List all tables
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;
EOF

# Create manual backup instructions
cat > "$BACKUP_DIR/manual_backup_instructions.md" << 'EOF'
# Manual Backup Instructions

If the automated backup didn't work, follow these steps:

## Step 1: Go to Supabase Dashboard
1. Visit https://supabase.com/dashboard
2. Select your EduDash Pro project
3. Click "SQL Editor"

## Step 2: Run Verification Query
Copy and paste this query to get current record counts:

```sql
-- Count critical records
SELECT 
  'profiles' as table_name, 
  count(*) as record_count 
FROM public.profiles
UNION ALL
SELECT 
  'preschools', 
  count(*) 
FROM public.preschools
UNION ALL
SELECT 
  'subscriptions', 
  count(*) 
FROM public.subscriptions;
```

Save the results!

## Step 3: Export Critical Tables
Run each query and save results as CSV:

```sql
-- Export profiles
SELECT * FROM public.profiles ORDER BY created_at;

-- Export preschools  
SELECT * FROM public.preschools ORDER BY created_at;

-- Export subscriptions
SELECT * FROM public.subscriptions ORDER BY created_at;

-- Export subscription plans
SELECT * FROM public.subscription_plans ORDER BY tier;
```

## Step 4: Document Current State
Save screenshots of:
- Record counts
- Table list
- Any error messages

This manual backup ensures you have the critical data even if automated tools fail.
EOF

echo ""
echo "📋 Backup Summary"
echo "=================="
echo "📁 Backup location: $BACKUP_DIR"
echo "📄 Files created:"
ls -la "$BACKUP_DIR/" 2>/dev/null || echo "   (Directory created, check for backup files)"

echo ""
echo "🔍 Next Steps:"
echo "1. Verify backup files exist and have reasonable sizes"
echo "2. Run the verification queries in Supabase Dashboard"  
echo "3. If automated backup failed, follow manual instructions"
echo "4. Only proceed with security fixes after backup is confirmed"

echo ""
echo "⚠️  IMPORTANT: Do not apply security fixes until backup is verified!"