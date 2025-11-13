#!/bin/bash

# Rollback Naming Fix Script
# Purpose: Restore files from backup if naming fix caused issues
# Usage: ./rollback-naming-fix.sh <backup_directory>

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: $0 <backup_directory>"
    echo "Example: $0 temp/naming-fix-backup-20250919-190000"
    exit 1
fi

BACKUP_DIR="$1"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

echo "🔄 Rolling back naming fixes from: $BACKUP_DIR"
echo "================================================"

RESTORED=0

for backup_file in "$BACKUP_DIR"/*; do
    if [ -f "$backup_file" ]; then
        # Convert backup filename back to original path
        original_file=$(basename "$backup_file" | sed 's/_/\//g')
        
        if [ -f "$original_file" ]; then
            echo "Restoring: $original_file"
            cp "$backup_file" "$original_file"
            RESTORED=$((RESTORED + 1))
        else
            echo "⚠️ Original file not found: $original_file"
        fi
    fi
done

echo ""
echo "📊 Rollback Summary:"
echo "   Files restored: $RESTORED"
echo "   Backup preserved at: $BACKUP_DIR"

echo ""
echo "✅ Rollback completed!"