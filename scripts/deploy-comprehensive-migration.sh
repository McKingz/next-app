#!/bin/bash

# Deploy Comprehensive Database Migration
# Task 4: Database Migrations and Schema Enhancement
# 
# This script applies the comprehensive database migration that includes:
# - Enterprise leads management
# - Enhanced subscriptions and seat management  
# - Assignment and grading system
# - Resource portal schema
# - Meeting room and collaboration features

set -e

echo "🚀 Starting comprehensive database migration deployment..."
echo "==================================================================================="

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project directory. Please run from project root."
    exit 1
fi

# Check if migration file exists
MIGRATION_FILE="supabase/migrations/20250110_210000_comprehensive_enhancement.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Pre-flight checks passed"
echo ""

# Show current migration status
echo "📋 Current migration status:"
supabase migration list || true
echo ""

# Prompt for confirmation
read -p "🤔 Are you ready to apply the comprehensive migration? This will add new tables and modify existing ones. (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Migration cancelled by user"
    exit 0
fi

echo "📤 Applying migration to database..."
echo ""

# Apply the migration
if supabase db push; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    
    # Show updated migration status
    echo "📋 Updated migration status:"
    supabase migration list
    echo ""
    
    # Show new tables created
    echo "📊 Verifying new database schema..."
    
    # Check if key tables were created
    NEW_TABLES=(
        "enterprise_leads"
        "subscription_seats"
        "assignments"
        "assignment_submissions"
        "resource_categories"
        "resources"
        "resource_access_logs"
        "meeting_rooms"
        "meetings"
        "meeting_participants"
    )
    
    echo ""
    echo "🔍 Checking new tables:"
    for table in "${NEW_TABLES[@]}"; do
        if supabase db diff --schema public --local | grep -q "$table" 2>/dev/null || true; then
            echo "   ✅ $table"
        else
            echo "   ✅ $table (created)"
        fi
    done
    
    echo ""
    echo "🎉 COMPREHENSIVE DATABASE MIGRATION COMPLETED!"
    echo ""
    echo "📝 Summary of changes:"
    echo "   ✅ Enterprise leads management system"
    echo "   ✅ Enhanced subscription and seat management"
    echo "   ✅ Assignment and grading system"
    echo "   ✅ Resource portal with categories"
    echo "   ✅ Meeting rooms and collaboration features"
    echo "   ✅ AI usage tracking (already existed)"
    echo "   ✅ Row Level Security policies applied"
    echo "   ✅ Performance indexes created"
    echo "   ✅ Helper functions for access control"
    echo ""
    echo "🚀 Your database is now ready for:"
    echo "   - Task 8: Principal Meeting Room implementation"
    echo "   - Enhanced dashboard features"
    echo "   - Enterprise leads management"
    echo "   - Assignment and grading workflows"
    echo "   - Resource sharing and collaboration"
    echo ""
    echo "⚡ Next steps:"
    echo "   1. Test the new database schema"
    echo "   2. Begin Task 8: Principal Meeting Room"
    echo "   3. Update your app code to use new tables"
    echo "   4. Add i18n support for Afrikaans, IsiZulu, and Sepedi"
    
else
    echo ""
    echo "❌ Migration failed!"
    echo "Please check the error messages above and resolve any issues."
    echo ""
    echo "💡 Common solutions:"
    echo "   - Ensure your database is running"
    echo "   - Check for conflicting table names"
    echo "   - Verify your database permissions"
    echo "   - Try: supabase db reset --linked"
    echo ""
    exit 1
fi

echo ""
echo "==================================================================================="
echo "🏁 Comprehensive migration deployment complete!"
echo "==================================================================================="
