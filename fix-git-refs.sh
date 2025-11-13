#!/bin/bash
# Script to fix broken Git references (AUTO_MERGE, REBASE_HEAD, etc.)

echo "=== Fixing broken Git references ==="

# Step 1: Check for broken references
echo "Step 1: Checking for broken references..."
if [ -f .git/AUTO_MERGE ]; then
    echo "  Found broken AUTO_MERGE reference"
    rm -f .git/AUTO_MERGE
    echo "  Removed AUTO_MERGE"
fi

if [ -f .git/REBASE_HEAD ]; then
    echo "  Found broken REBASE_HEAD reference"
    rm -f .git/REBASE_HEAD
    echo "  Removed REBASE_HEAD"
fi

if [ -f .git/ORIG_HEAD ]; then
    echo "  Found ORIG_HEAD reference"
fi

# Step 2: Abort any ongoing rebase
echo ""
echo "Step 2: Checking for ongoing rebase..."
if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
    echo "  Found ongoing rebase, aborting..."
    git rebase --abort 2>/dev/null || echo "  No active rebase to abort"
else
    echo "  No ongoing rebase found"
fi

# Step 3: Clean up Git state
echo ""
echo "Step 3: Cleaning up Git state..."
git fsck --full 2>&1 | grep -E "broken|dangling|missing" || echo "  Repository integrity check passed"

# Step 4: Update Git's internal state
echo ""
echo "Step 4: Updating Git refs..."
git update-ref -d AUTO_MERGE 2>/dev/null || echo "  AUTO_MERGE already clean"
git update-ref -d REBASE_HEAD 2>/dev/null || echo "  REBASE_HEAD already clean"

echo ""
echo "=== Git repository cleanup complete ==="
echo ""
echo "You can now try your git pull again:"
echo "  git pull origin development"
