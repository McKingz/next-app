#!/bin/bash
# Apply Dash AI RLS Fixes
# This script applies RLS policies for voice-notes storage and ai_usage_logs table

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Dash AI RLS Policy Fix ===${NC}"
echo ""

# Check for Supabase connection details
if [ -z "$SUPABASE_DB_URL" ]; then
    echo -e "${RED}Error: SUPABASE_DB_URL environment variable not set${NC}"
    echo ""
    echo "Please set it using:"
    echo "export SUPABASE_DB_URL='postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres'"
    exit 1
fi

echo -e "${GREEN}✓ Found database connection${NC}"
echo ""

# Apply the SQL fix
echo -e "${YELLOW}Applying RLS policies...${NC}"
psql "$SUPABASE_DB_URL" -f fix-dash-rls-policies.sql

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ RLS policies applied successfully!${NC}"
    echo ""
    echo "Fixed:"
    echo "  1. voice-notes storage bucket RLS policies"
    echo "  2. ai_usage_logs table RLS policies"
    echo ""
    echo "You can now:"
    echo "  - Upload voice notes via Dash AI Assistant"
    echo "  - AI usage will be logged properly"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Failed to apply policies${NC}"
    echo "Please check the error messages above"
    exit 1
fi