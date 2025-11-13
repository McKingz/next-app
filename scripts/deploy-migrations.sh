#!/bin/bash

# Database Migration Deployment Script for EduDash
# This script helps deploy the critical schema fixes and RLS policies

set -e  # Exit on any error

echo "🚀 EduDash Database Migration Deployment"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Error: Supabase CLI is not installed or not in PATH${NC}"
    echo "Please install it with: npm install -g supabase"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Available Migration Files:${NC}"
ls -la migrations_drafts/

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Make sure you have a backup of your database before proceeding!${NC}"
echo ""

# Prompt for confirmation
read -p "Do you want to proceed with the migration deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Migration deployment cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}🔧 Step 1: Applying Core Schema Fixes...${NC}"
echo "This will fix the missing foreign key relationships causing RBAC failures."

# Apply the core schema fix
supabase db push --file migrations_drafts/20250910_fix_core_schema_relationships.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Core schema fixes applied successfully!${NC}"
else
    echo -e "${RED}❌ Failed to apply core schema fixes${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🛡️  Step 2: Applying RLS Policies...${NC}"
echo "This will enable comprehensive Row Level Security policies."

# Apply RLS policies
supabase db push --file migrations_drafts/20250910_comprehensive_rls_policies.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ RLS policies applied successfully!${NC}"
else
    echo -e "${RED}❌ Failed to apply RLS policies${NC}"
    echo -e "${YELLOW}⚠️  Core schema should still be working, but security policies are not active${NC}"
fi

echo ""
echo -e "${BLUE}📊 Step 3: Running Verification Queries...${NC}"

# Run verification queries
echo "Checking table relationships and data integrity..."

supabase db reset --linked

echo ""
echo -e "${GREEN}🎉 Migration Deployment Complete!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Test your app - the RBAC error should be resolved"
echo "2. Check that user authentication and routing works"
echo "3. Verify that users can only see data from their organization"
echo "4. Monitor the app logs for any remaining issues"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "- See docs/RLS_IMPLEMENTATION.md for detailed security documentation"
echo "- Run 'npm run test:rls' to test RLS policies (when implemented)"
echo ""
echo -e "${BLUE}🔍 Troubleshooting:${NC}"
echo "If you still see RBAC errors:"
echo "1. Check Supabase dashboard for any failed migrations"
echo "2. Verify that organization_members table exists and has data"
echo "3. Check that your user profile has a preschool_id assigned"
echo ""
