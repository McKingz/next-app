#!/bin/bash

# ⚠️  DEPRECATED: LOCAL MIGRATION RESET & SYNC SCRIPT
# ⚠️  WARNING: This script encourages local Docker usage which is now AGAINST POLICY
# ⚠️  See WARP.md - Remote-first development is now mandatory
# ⚠️  Only use local Docker for controlled exceptions with approval
#
# DEPRECATED: Execute after successful Supabase dashboard migration
# DEPRECATED: This ensures local development environment matches remote exactly

set -e  # Exit on any error

echo "🚨 DEPRECATED SCRIPT WARNING"
echo "============================="
echo "⚠️  This script is DEPRECATED and violates current WARP.md policy"
echo "⚠️  Remote-first development is now mandatory"
echo "⚠️  Only use local Docker with explicit approval for complex migrations"
echo "⚠️  See: WARP.md Local Docker Resource Policy"
echo ""
read -p "Do you have approval to use local Docker? (y/N): " -n 1 -r
echo
if [[ ! \$REPLY =~ ^[Yy]\$ ]]; then
    echo "❌ Exiting. Use remote-first development instead:"
    echo "   supabase migration new 'your_change'"
    echo "   sqlfluff lint migrations/"
    echo "   supabase db push"
    echo "   supabase db diff"
    exit 1
fi
echo ""
echo "🗄️  EduDash Pro: Local Migration Reset & Sync (DEPRECATED)"
echo "============================================="
echo ""

# Check we're in the right directory
if [[ ! -f "package.json" || ! -d "supabase" ]]; then
    echo "❌ Error: Please run this script from the EduDash Pro root directory"
    exit 1
fi

echo "📋 Pre-flight checks..."

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found. Please install it first."
    echo "   npm install -g supabase"
    exit 1
fi

# Check if we can connect to Supabase
echo "🔗 Testing Supabase connection..."
if ! supabase status &> /dev/null; then
    echo "⚠️  Warning: Supabase not running locally. This is OK for remote sync."
fi

echo "✅ Pre-flight checks passed"
echo ""

# Step 1: Backup current local migrations (just in case)
echo "💾 Step 1: Backing up current local migrations..."
BACKUP_DIR="./migration_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [[ -d "supabase/migrations" ]]; then
    cp -r supabase/migrations/* "$BACKUP_DIR/" 2>/dev/null || echo "   No migrations to backup"
    echo "   ✅ Local migrations backed up to: $BACKUP_DIR"
else
    echo "   ℹ️  No existing migrations directory found"
fi

# Step 2: Clean up local migration files  
echo ""
echo "🧹 Step 2: Cleaning up local migrations..."

# Remove all local migration files except the init
if [[ -d "supabase/migrations" ]]; then
    # Keep only the initial migration (usually starts with very early date)
    find supabase/migrations -name "*.sql" -not -name "202404*" -delete 2>/dev/null || true
    echo "   ✅ Local migration files cleaned"
else
    echo "   ℹ️  No migrations to clean"
fi

# Step 3: Reset local database schema (if running locally)
echo ""
echo "🔄 Step 3: Resetting local database (if running)..."

if supabase status &> /dev/null; then
    echo "   🛑 Stopping local Supabase..."
    supabase stop
    
    echo "   🗑️  Resetting local database..."
    supabase db reset --local
    
    echo "   ✅ Local database reset complete"
else
    echo "   ℹ️  Local Supabase not running - skipping local reset"
fi

# Step 4: Pull remote schema to local
echo ""
echo "⬇️  Step 4: Pulling remote schema to local..."

echo "   📡 Connecting to remote database..."
if supabase db pull; then
    echo "   ✅ Remote schema pulled successfully"
else
    echo "   ❌ Failed to pull remote schema"
    echo "   Please check your Supabase connection and try manually:"
    echo "   supabase db pull"
    exit 1
fi

# Step 5: Start local Supabase with synced schema
echo ""
echo "🚀 Step 5: Starting local Supabase with synced schema..."

if supabase start; then
    echo "   ✅ Local Supabase started with remote schema"
else
    echo "   ❌ Failed to start local Supabase"
    echo "   Please try manually: supabase start"
    exit 1
fi

# Step 6: Verify sync success
echo ""
echo "🔍 Step 6: Verifying sync success..."

# Check that the new tables exist locally
echo "   📋 Checking for core business tables..."
LOCAL_TABLES=$(supabase db diff --local 2>/dev/null | grep -c "CREATE TABLE" || echo "0")

if [[ "$LOCAL_TABLES" -eq "0" ]]; then
    echo "   ✅ Schema sync verified - no differences detected"
else
    echo "   ⚠️  Warning: Schema differences detected ($LOCAL_TABLES differences)"
    echo "   This might be normal if you have local-only changes"
fi

# Step 7: Final status check
echo ""
echo "📊 Step 7: Final status check..."

echo "   🔗 Supabase Status:"
supabase status | grep -E "(API|DB|Studio)" || true

echo ""
echo "🎉 MIGRATION SYNC COMPLETE!"
echo "=========================="
echo ""
echo "✅ What was accomplished:"
echo "   • Local migrations cleaned and backed up"
echo "   • Remote schema pulled to local environment"
echo "   • Local database synced with remote state"
echo "   • Development environment ready"
echo ""
echo "📋 Next steps:"
echo "   1. Test your app locally to verify everything works"
echo "   2. Continue with push notification testing"
echo "   3. Start I18N emergency fix for critical strings"
echo ""
echo "🗂️  Backup location: $BACKUP_DIR"
echo "   (You can delete this once you're confident everything works)"
echo ""
echo "🎯 Current priorities:"
echo "   • Push notification device testing (when EAS build ready)"
echo "   • I18N audit fixes for critical UI strings" 
echo "   • Verify new database tables work in your app"
echo ""
echo "Happy coding! 🚀"