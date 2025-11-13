#!/bin/bash
# ============================================
# Sync Environment Variables to Vercel
# ============================================
# This script uploads environment variables from .env to Vercel
# Usage: ./scripts/deploy/sync-vercel-env.sh
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  EduDash Pro - Vercel Env Sync        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}✗ Error: .env file not found${NC}"
    exit 1
fi

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠ Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

# Login to Vercel (if not already logged in)
echo -e "${BLUE}→ Checking Vercel authentication...${NC}"
vercel whoami &> /dev/null || {
    echo -e "${YELLOW}⚠ Not logged in to Vercel. Please log in:${NC}"
    vercel login
}

echo -e "${GREEN}✓ Authenticated with Vercel${NC}"
echo ""

# Ask for target environment
echo -e "${YELLOW}Select target environment(s):${NC}"
echo "1) Production only"
echo "2) Preview only"
echo "3) Both Production and Preview (recommended)"
read -p "Enter choice (1-3): " env_choice

case $env_choice in
    1)
        TARGETS="production"
        ;;
    2)
        TARGETS="preview"
        ;;
    3)
        TARGETS="production,preview"
        ;;
    *)
        echo -e "${RED}✗ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}→ Reading environment variables from .env...${NC}"

# Count variables
TOTAL_VARS=$(grep -c "^EXPO_PUBLIC_\|^FROM_EMAIL\|^NODE_BINARY" .env || true)
echo -e "${GREEN}✓ Found ${TOTAL_VARS} variables to sync${NC}"
echo ""

# Confirm before proceeding
echo -e "${YELLOW}⚠ This will update environment variables on Vercel${NC}"
read -p "Continue? (y/n): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo -e "${RED}✗ Cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}→ Uploading variables to Vercel...${NC}"

# Counter
COUNT=0
FAILED=0

# Read .env and upload each variable
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ $key =~ ^#.*$ ]] || [ -z "$key" ]; then
        continue
    fi
    
    # Only process EXPO_PUBLIC_, FROM_EMAIL, and NODE_BINARY
    if [[ $key =~ ^EXPO_PUBLIC_ ]] || [ "$key" = "FROM_EMAIL" ] || [ "$key" = "NODE_BINARY" ]; then
        # Remove any surrounding quotes from value
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        
        # Skip empty values (like EXPO_PUBLIC_SENTRY_DSN=)
        if [ -z "$value" ]; then
            echo -e "${YELLOW}⊘ Skipping ${key} (empty value)${NC}"
            continue
        fi
        
        ((COUNT++))
        
        # Upload to Vercel
        if echo "$value" | vercel env add "$key" "$TARGETS" --force &> /dev/null; then
            echo -e "${GREEN}✓ [${COUNT}/${TOTAL_VARS}] ${key}${NC}"
        else
            echo -e "${RED}✗ [${COUNT}/${TOTAL_VARS}] Failed: ${key}${NC}"
            ((FAILED++))
        fi
    fi
done < .env

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Sync Complete                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo -e "${GREEN}✓ Successfully synced: $((COUNT - FAILED)) variables${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}✗ Failed: ${FAILED} variables${NC}"
fi
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Push your code: git push origin web"
echo "2. Vercel will auto-deploy with new environment variables"
echo "3. Verify deployment at: https://vercel.com/dashboard"
echo ""
