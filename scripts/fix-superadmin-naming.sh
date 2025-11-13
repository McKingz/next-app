#!/bin/bash

# Fix Superadmin Naming Inconsistency Script
# WARP.md Compliance: Safe text replacement with backup
# Purpose: Replace all "superladmin" with "superadmin" across codebase
# Date: 2025-09-19

set -e

echo "🔧 Starting Superadmin Naming Consistency Fix"
echo "============================================="

# Create backup directory
BACKUP_DIR="temp/naming-fix-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "📁 Backup directory: $BACKUP_DIR"

# Files to exclude from replacement (where "superladmin" should remain as documentation of the issue)
EXCLUDE_FILES=(
    "docs/status/SUPERADMIN_DASHBOARD_STATUS_2025-09-19.md"
    "scripts/fix-superadmin-naming.sh"
    "temp/*"
    "node_modules/*"
    ".git/*"
)

# Build exclude pattern for find
EXCLUDE_PATTERN=""
for pattern in "${EXCLUDE_FILES[@]}"; do
    EXCLUDE_PATTERN="$EXCLUDE_PATTERN -not -path \"./$pattern\""
done

echo "🔍 Finding files with 'superladmin' references..."

# Find all files containing "superladmin" (excluding binary files and excluded paths)
FILES_TO_FIX=$(eval "find . -type f -name \"*.md\" -o -name \"*.sql\" -o -name \"*.js\" -o -name \"*.ts\" -o -name \"*.tsx\" -o -name \"*.json\" -o -name \"*.sh\" $EXCLUDE_PATTERN" | xargs grep -l "superladmin" 2>/dev/null || true)

if [ -z "$FILES_TO_FIX" ]; then
    echo "✅ No files found with 'superladmin' references (excluding backup files)"
    exit 0
fi

echo "📝 Files to be fixed:"
echo "$FILES_TO_FIX" | while read -r file; do
    echo "   - $file"
done

echo ""
echo "🔄 Processing files..."

# Counter for tracking changes
TOTAL_FILES=0
TOTAL_REPLACEMENTS=0

echo "$FILES_TO_FIX" | while read -r file; do
    if [ -f "$file" ]; then
        echo "Processing: $file"
        
        # Create backup
        BACKUP_FILE="$BACKUP_DIR/$(echo "$file" | sed 's/\//_/g')"
        cp "$file" "$BACKUP_FILE"
        
        # Count occurrences before replacement
        BEFORE_COUNT=$(grep -o "superladmin" "$file" | wc -l)
        
        if [ "$BEFORE_COUNT" -gt 0 ]; then
            # Perform replacements with different patterns
            
            # 1. Database object names (tables, functions, etc.)
            sed -i 's/superladmin_/superadmin_/g' "$file"
            
            # 2. Function names
            sed -i 's/superladmin(/superadmin(/g' "$file"
            
            # 3. Text references
            sed -i 's/superladmin/superadmin/g' "$file"
            
            # 4. Title case references
            sed -i 's/Superladmin/Superadmin/g' "$file"
            
            # 5. All caps references  
            sed -i 's/SUPERLADMIN/SUPERADMIN/g' "$file"
            
            # Count occurrences after replacement
            AFTER_COUNT=$(grep -o "superladmin" "$file" 2>/dev/null | wc -l || echo "0")
            REPLACEMENTS=$((BEFORE_COUNT - AFTER_COUNT))
            
            echo "   ✅ $file: $REPLACEMENTS replacements made"
            TOTAL_REPLACEMENTS=$((TOTAL_REPLACEMENTS + REPLACEMENTS))
        else
            echo "   ⚪ $file: No replacements needed"
        fi
        
        TOTAL_FILES=$((TOTAL_FILES + 1))
    fi
done

echo ""
echo "📊 Summary:"
echo "   Files processed: $TOTAL_FILES"
echo "   Total replacements: $TOTAL_REPLACEMENTS"
echo "   Backup location: $BACKUP_DIR"

echo ""
echo "🔍 Verifying fixes..."

# Check if any 'superladmin' references remain (excluding our allowed files)
REMAINING=$(eval "find . -type f -name \"*.md\" -o -name \"*.sql\" -o -name \"*.js\" -o -name \"*.ts\" -o -name \"*.tsx\" -o -name \"*.json\" -o -name \"*.sh\" $EXCLUDE_PATTERN" | xargs grep -l "superladmin" 2>/dev/null || true)

if [ -n "$REMAINING" ]; then
    echo "⚠️ Some 'superladmin' references may still exist:"
    echo "$REMAINING" | while read -r file; do
        echo "   - $file"
        grep -n "superladmin" "$file" | head -3
    done
    echo ""
    echo "Please review these manually if they weren't intentionally left."
else
    echo "✅ All 'superladmin' references successfully replaced!"
fi

echo ""
echo "📋 Next Steps:"
echo "1. Review the changed files to ensure replacements are correct"
echo "2. Test that database functions still work with new names"
echo "3. Update any database objects that may need renaming"
echo "4. Commit the changes once verified"

echo ""
echo "🔄 To rollback changes if needed:"
echo "   scripts/rollback-naming-fix.sh $BACKUP_DIR"

echo ""
echo "✅ Naming consistency fix completed!"