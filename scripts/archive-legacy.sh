#!/usr/bin/env bash
#
# Archive Legacy Code Script
# Purpose: Move obsolete and legacy code to docs/archive for clean codebase
# Author: Warp AI Agent
# Date: October 13, 2025
#
# Usage: ./scripts/archive-legacy.sh
# Note: This script only MOVES files, never deletes them

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="/home/king/Desktop/edudashpro"
ARCHIVE_ROOT="$PROJECT_ROOT/docs/archive"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}   EduDash Pro Legacy Code Archiver${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Create archive directories
echo -e "${GREEN}Creating archive directories...${NC}"
mkdir -p "$ARCHIVE_ROOT/legacy-implementations"
mkdir -p "$ARCHIVE_ROOT/backups/build-configs"
mkdir -p "$ARCHIVE_ROOT/backups/configs"
mkdir -p "$ARCHIVE_ROOT/backups/screen-backups"
mkdir -p "$ARCHIVE_ROOT/deprecated-services"

# Function to move file if it exists
move_if_exists() {
    local src="$1"
    local dest="$2"
    
    if [ -f "$src" ]; then
        echo -e "  Moving: ${YELLOW}$src${NC} → ${BLUE}$dest${NC}"
        mv "$src" "$dest"
        return 0
    elif [ -d "$src" ]; then
        echo -e "  Moving dir: ${YELLOW}$src${NC} → ${BLUE}$dest${NC}"
        mv "$src" "$dest"
        return 0
    else
        echo -e "  ${YELLOW}Skip (not found): $src${NC}"
        return 1
    fi
}

echo ""
echo -e "${GREEN}Archiving legacy implementations...${NC}"
move_if_exists "$PROJECT_ROOT/app/screens/account-old.tsx" "$ARCHIVE_ROOT/legacy-implementations/"

echo ""
echo -e "${GREEN}Archiving backup files...${NC}"
move_if_exists "$PROJECT_ROOT/app/(auth)/sign-in.tsx.backup" "$ARCHIVE_ROOT/backups/screen-backups/"
move_if_exists "$PROJECT_ROOT/eas.json.backup" "$ARCHIVE_ROOT/backups/"

echo ""
echo -e "${GREEN}Archiving build backups...${NC}"
if [ -d "$PROJECT_ROOT/docs/build-backup" ]; then
    for file in "$PROJECT_ROOT/docs/build-backup"/*; do
        if [ -f "$file" ]; then
            move_if_exists "$file" "$ARCHIVE_ROOT/backups/build-configs/"
        fi
    done
    # Remove empty directory
    rmdir "$PROJECT_ROOT/docs/build-backup" 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}Archiving config backups...${NC}"
if [ -d "$PROJECT_ROOT/docs/config-backups" ]; then
    for file in "$PROJECT_ROOT/docs/config-backups"/*; do
        if [ -f "$file" ]; then
            move_if_exists "$file" "$ARCHIVE_ROOT/backups/configs/"
        fi
    done
    # Remove empty directory
    rmdir "$PROJECT_ROOT/docs/config-backups" 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}Archiving JS fixes backup...${NC}"
if [ -d "$PROJECT_ROOT/docs/js-fixes-backup" ]; then
    move_if_exists "$PROJECT_ROOT/docs/js-fixes-backup" "$ARCHIVE_ROOT/backups/"
fi

echo ""
echo -e "${GREEN}Creating archive index...${NC}"

# Create index file
cat > "$ARCHIVE_ROOT/LEGACY_CODE_INDEX.md" << 'EOF'
# Legacy Code Archive Index

**Date:** October 13, 2025  
**Reason:** Dash Full Agentic Activation - Clean Codebase Initiative

---

## 📁 Archive Structure

```
docs/archive/
├── legacy-implementations/   # Replaced or obsolete screen implementations
├── backups/                  # Configuration and build backups
│   ├── build-configs/       # Build configuration backups
│   ├── configs/             # App configuration backups
│   └── screen-backups/      # Screen component backups
└── deprecated-services/     # Services replaced by agentic modules
```

---

## 📋 Archived Files

### Legacy Implementations
| File | Original Location | Reason | Replacement |
|------|-------------------|--------|-------------|
| `account-old.tsx` | `app/screens/` | Outdated account screen | New settings screens |
| `sign-in.tsx.backup` | `app/(auth)/` | Old sign-in implementation | Current auth flow |

### Build Backups
| File | Original Location | Reason |
|------|-------------------|--------|
| `app.config.js` | `docs/build-backup/` | Build configuration backup |
| `app.json` | `docs/build-backup/` | Expo config backup |
| `babel.config.js` | `docs/build-backup/` | Babel config backup |
| `eas.json` | `docs/build-backup/` | EAS build config backup |
| `metro.config.js` | `docs/build-backup/` | Metro bundler config backup |
| `package.json` | `docs/build-backup/` | Dependencies snapshot |
| `tsconfig.json` | `docs/build-backup/` | TypeScript config backup |
| `FIXES_APPLIED.md` | `docs/build-backup/` | Historical fixes log |

### Config Backups
| File | Original Location | Reason |
|------|-------------------|--------|
| `AndroidManifest.xml.bak` | `docs/config-backups/` | Android manifest backup |
| `Expo.plist.bak` | `docs/config-backups/` | iOS Expo plist backup |
| `app.config.js.bak` | `docs/config-backups/` | App config backup |
| `app.json.bak` | `docs/config-backups/` | Expo config backup |

### Other Backups
| File | Original Location | Reason |
|------|-------------------|--------|
| `eas.json.backup` | Project root | Root-level backup file |
| `js-fixes-backup/` | `docs/` | Historical JavaScript fixes |

---

## 🔄 Restoration Guide

If you need to restore any archived file:

```bash
# Restore a specific file
cp docs/archive/path/to/file original/location/

# Example: Restore account-old.tsx
cp docs/archive/legacy-implementations/account-old.tsx app/screens/
```

---

## 🗑️ Future Cleanup

These files are safe to delete after:
- 90 days from archive date (January 11, 2026)
- Confirmation that new implementations are stable
- No need for historical reference

**DO NOT DELETE** without team approval if:
- Files contain unique configuration
- Historical context needed for troubleshooting
- Compliance/audit requirements exist

---

## 📝 Related Documentation

- [Dash Full Agentic Activation Plan](../agentic/DASH_FULL_AGENTIC_ACTIVATION_PLAN.md)
- [Legacy Dash Implementation](../LEGACY_DASH_IMPLEMENTATION.md)
- [Archived Code - Old Input](../archived-code-dashassistant-old-input.md)

---

**Archived by:** Warp AI Agent  
**Script:** `scripts/archive-legacy.sh`
EOF

echo ""
echo -e "${GREEN}Archive complete!${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo -e "  Archive location: ${YELLOW}$ARCHIVE_ROOT${NC}"
echo -e "  Index file: ${YELLOW}$ARCHIVE_ROOT/LEGACY_CODE_INDEX.md${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo -e "  1. Review archived files in $ARCHIVE_ROOT"
echo -e "  2. Verify application still works correctly"
echo -e "  3. Update LEGACY_DASH_IMPLEMENTATION.md with cross-references"
echo -e "  4. Commit changes to git"
echo ""
echo -e "${GREEN}✅ Done!${NC}"
