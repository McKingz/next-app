#!/bin/bash
# ============================================
# Dash AI Migrations Applicator
# ============================================
# Applies all Dash-related migrations in order
# Usage: ./scripts/apply-dash-migrations.sh

set -e  # Exit on error

echo "🚀 Dash AI Migration Runner"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install with: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"
echo ""

# Check if linked to project
if ! supabase status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not linked to Supabase project${NC}"
    echo "Run: supabase link --project-ref YOUR_PROJECT_REF"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Define migrations in order
MIGRATIONS=(
    "supabase/migrations/20251015211818_create_dash_storage_table.sql"
    "supabase/migrations/20251016133000_dash_context_and_reminders.sql"
    "supabase/migrations/20251019074016_age_awareness_and_dashboard_features.sql"
    "migrations/20251009_dash_pdf_generator_tables.sql"
)

echo "📋 Migrations to apply:"
for i in "${!MIGRATIONS[@]}"; do
    echo "  $((i+1)). ${MIGRATIONS[$i]}"
done
echo ""

read -p "Apply all migrations? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "🔄 Applying migrations..."
echo ""

# Apply each migration
SUCCESS_COUNT=0
FAIL_COUNT=0

for migration in "${MIGRATIONS[@]}"; do
    if [ -f "$migration" ]; then
        echo -e "${BLUE}📄 Applying: $migration${NC}"
        
        if supabase db push --include-all --include-path "$migration" 2>&1; then
            echo -e "${GREEN}✅ Success${NC}"
            SUCCESS_COUNT=$((SUCCESS_COUNT+1))
        else
            echo -e "${RED}❌ Failed${NC}"
            FAIL_COUNT=$((FAIL_COUNT+1))
        fi
        echo ""
    else
        echo -e "${YELLOW}⚠️  File not found: $migration${NC}"
        FAIL_COUNT=$((FAIL_COUNT+1))
        echo ""
    fi
done

echo "================================"
echo -e "✅ Successful: ${GREEN}${SUCCESS_COUNT}${NC}"
echo -e "❌ Failed: ${RED}${FAIL_COUNT}${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 All migrations applied successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Verify tables: supabase db dump --data-only"
    echo "  2. Test Dash AI in app"
    echo "  3. Check RLS policies are active"
else
    echo -e "${YELLOW}⚠️  Some migrations failed. Check logs above.${NC}"
    exit 1
fi
