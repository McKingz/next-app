#!/bin/bash

# Supabase Migration Compliance Audit Script
# WARP.md Compliance: Verify migration process adherence
# Purpose: Check migration status, schema drift, and lint compliance
# Date: 2025-09-19

set -e

echo "🔍 Supabase Migration Compliance Audit"
echo "======================================="

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project root (supabase/config.toml not found)"
    exit 1
fi

# Create audit report directory
AUDIT_DIR="artifacts/migration-audit-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$AUDIT_DIR"
echo "📁 Audit report directory: $AUDIT_DIR"

echo ""
echo "1️⃣ Checking Supabase CLI availability..."

if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with:"
    echo "   npm install -g supabase"
    exit 1
fi

SUPABASE_VERSION=$(supabase --version)
echo "✅ Supabase CLI version: $SUPABASE_VERSION"

echo ""
echo "2️⃣ Checking migration files..."

MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" 2>/dev/null | wc -l || echo "0")
echo "📄 Migration files found: $MIGRATION_COUNT"

if [ "$MIGRATION_COUNT" -eq 0 ]; then
    echo "⚠️ No migration files found in supabase/migrations/"
else
    echo "📋 Migration files:"
    find supabase/migrations -name "*.sql" -exec basename {} \; | sort
fi

echo ""
echo "3️⃣ Checking for sqlfluff..."

SQLFLUFF_AVAILABLE=false
if command -v sqlfluff &> /dev/null; then
    SQLFLUFF_AVAILABLE=true
    SQLFLUFF_VERSION=$(sqlfluff --version)
    echo "✅ SQLFluff version: $SQLFLUFF_VERSION"
else
    echo "⚠️ SQLFluff not found. Install with:"
    echo "   pip install sqlfluff"
    echo "   This is required per WARP.md for SQL linting"
fi

echo ""
echo "4️⃣ Linting migration files (if SQLFluff available)..."

if [ "$SQLFLUFF_AVAILABLE" = true ] && [ "$MIGRATION_COUNT" -gt 0 ]; then
    echo "🔍 Running SQLFluff on migration files..."
    
    LINT_REPORT="$AUDIT_DIR/sqlfluff-lint-report.txt"
    
    if sqlfluff lint supabase/migrations/ > "$LINT_REPORT" 2>&1; then
        echo "✅ All migration files pass SQLFluff linting"
        echo "== SQLFLUFF PASSED ==" > "$LINT_REPORT"
    else
        echo "❌ SQLFluff linting issues found. See: $LINT_REPORT"
        echo ""
        echo "📋 First 20 lines of lint issues:"
        head -20 "$LINT_REPORT"
    fi
else
    echo "⚪ Skipping SQLFluff linting (not available or no migrations)"
    echo "NOT_AVAILABLE" > "$AUDIT_DIR/sqlfluff-lint-report.txt"
fi

echo ""
echo "5️⃣ Checking migration history..."

MIGRATION_LIST_REPORT="$AUDIT_DIR/migration-list.txt"

if supabase migration list > "$MIGRATION_LIST_REPORT" 2>&1; then
    echo "✅ Migration list retrieved successfully"
    echo ""
    echo "📋 Current migration status:"
    cat "$MIGRATION_LIST_REPORT"
else
    echo "❌ Failed to get migration list. Ensure you're connected to Supabase."
    echo "Error details in: $MIGRATION_LIST_REPORT"
fi

echo ""
echo "6️⃣ Checking for schema drift..."

SCHEMA_DIFF_REPORT="$AUDIT_DIR/schema-diff.txt"

if supabase db diff > "$SCHEMA_DIFF_REPORT" 2>&1; then
    DIFF_SIZE=$(wc -l < "$SCHEMA_DIFF_REPORT")
    
    if [ "$DIFF_SIZE" -eq 0 ] || grep -q "No schema changes" "$SCHEMA_DIFF_REPORT"; then
        echo "✅ No schema drift detected - database matches migrations"
    else
        echo "⚠️ Schema drift detected! See: $SCHEMA_DIFF_REPORT"
        echo ""
        echo "📋 First 20 lines of schema differences:"
        head -20 "$SCHEMA_DIFF_REPORT"
        echo ""
        echo "🚨 WARP.md VIOLATION: Schema drift detected!"
        echo "   All changes must go through proper migration process"
    fi
else
    echo "❌ Failed to check schema drift. Ensure database connection."
    echo "Error details in: $SCHEMA_DIFF_REPORT"
fi

echo ""
echo "7️⃣ Checking for direct SQL usage patterns..."

DIRECT_SQL_REPORT="$AUDIT_DIR/direct-sql-patterns.txt"

echo "Scanning for potential WARP.md violations..." > "$DIRECT_SQL_REPORT"
echo "=============================================" >> "$DIRECT_SQL_REPORT"
echo "" >> "$DIRECT_SQL_REPORT"

# Look for common patterns that suggest direct SQL usage
echo "Files mentioning 'Supabase Dashboard' or 'SQL Editor':" >> "$DIRECT_SQL_REPORT"
grep -r -l "Supabase Dashboard\|SQL Editor\|dashboard.*SQL" . --exclude-dir=node_modules --exclude-dir=.git --exclude="$0" >> "$DIRECT_SQL_REPORT" 2>/dev/null || echo "None found" >> "$DIRECT_SQL_REPORT"

echo "" >> "$DIRECT_SQL_REPORT"
echo "SQL files outside migrations directory:" >> "$DIRECT_SQL_REPORT"
find . -name "*.sql" -not -path "./supabase/migrations/*" -not -path "./node_modules/*" -not -path "./.git/*" >> "$DIRECT_SQL_REPORT" 2>/dev/null || echo "None found" >> "$DIRECT_SQL_REPORT"

echo "" >> "$DIRECT_SQL_REPORT"
echo "Files with 'CREATE TABLE' not in migrations:" >> "$DIRECT_SQL_REPORT"
grep -r -l "CREATE TABLE" . --include="*.sql" --exclude-dir=node_modules --exclude-dir=.git | grep -v "supabase/migrations" >> "$DIRECT_SQL_REPORT" 2>/dev/null || echo "None found" >> "$DIRECT_SQL_REPORT"

echo "🔍 Direct SQL usage scan completed. See: $DIRECT_SQL_REPORT"

echo ""
echo "8️⃣ Generating compliance report..."

COMPLIANCE_REPORT="$AUDIT_DIR/MIGRATION_COMPLIANCE_REPORT.md"

cat > "$COMPLIANCE_REPORT" << EOF
# Supabase Migration Compliance Report

**Date**: $(date)  
**Project**: EduDash Pro  
**Audit ID**: $(basename "$AUDIT_DIR")

## Summary

- **Migration Files**: $MIGRATION_COUNT found
- **SQLFluff Available**: $SQLFLUFF_AVAILABLE
- **Schema Drift**: $(if [ -f "$SCHEMA_DIFF_REPORT" ]; then if [ "$(wc -l < "$SCHEMA_DIFF_REPORT")" -eq 0 ] || grep -q "No schema changes" "$SCHEMA_DIFF_REPORT"; then echo "None detected ✅"; else echo "DETECTED ⚠️"; fi; else echo "Could not check"; fi)

## WARP.md Compliance Checklist

- [ ] All schema changes via \`supabase migration new\`
- [ ] No direct SQL execution in Supabase Dashboard
- [ ] All migrations linted with SQLFluff
- [ ] \`supabase db push\` used for applying migrations  
- [ ] \`supabase db diff\` shows no drift after push
- [ ] Migration history intact and documented

## Files Generated

- Migration list: migration-list.txt
- Schema diff: schema-diff.txt
- SQLFluff report: sqlfluff-lint-report.txt
- Direct SQL patterns: direct-sql-patterns.txt

## Recommendations

$(if [ "$MIGRATION_COUNT" -eq 0 ]; then echo "- No migration files found - create proper migrations for all schema changes"; fi)
$(if [ "$SQLFLUFF_AVAILABLE" = false ]; then echo "- Install SQLFluff for required SQL linting: pip install sqlfluff"; fi)
$(if [ -f "$SCHEMA_DIFF_REPORT" ] && [ "$(wc -l < "$SCHEMA_DIFF_REPORT")" -gt 0 ] && ! grep -q "No schema changes" "$SCHEMA_DIFF_REPORT"; then echo "- Resolve schema drift immediately - database does not match migrations"; fi)

---
*Report generated by audit-migration-compliance.sh*
EOF

echo "📊 Compliance report generated: $COMPLIANCE_REPORT"

echo ""
echo "🏁 Audit Summary:"
echo "   Migration files: $MIGRATION_COUNT"
echo "   SQLFluff: $SQLFLUFF_AVAILABLE"
echo "   Schema drift: $(if [ -f "$SCHEMA_DIFF_REPORT" ]; then if [ "$(wc -l < "$SCHEMA_DIFF_REPORT")" -eq 0 ] || grep -q "No schema changes" "$SCHEMA_DIFF_REPORT"; then echo "None ✅"; else echo "DETECTED ⚠️"; fi; else echo "Unknown"; fi)"
echo "   Full report: $COMPLIANCE_REPORT"

echo ""
echo "✅ Migration compliance audit completed!"

# Return non-zero exit code if major issues found
if [ "$SQLFLUFF_AVAILABLE" = false ]; then
    echo ""
    echo "⚠️ Audit completed with warnings - SQLFluff not available"
    exit 1
fi

if [ -f "$SCHEMA_DIFF_REPORT" ] && [ "$(wc -l < "$SCHEMA_DIFF_REPORT")" -gt 0 ] && ! grep -q "No schema changes" "$SCHEMA_DIFF_REPORT"; then
    echo ""
    echo "🚨 Audit failed - Schema drift detected (WARP.md violation)"
    exit 2
fi

echo ""
echo "✅ Audit passed - No major compliance issues detected"