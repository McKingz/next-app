#!/bin/bash

# EAS Deployment Helper Script
# Usage: ./deploy.sh [preview|production] "message"

set -e

BRANCH=${1:-preview}
MESSAGE=${2:-"Update"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 EAS Deployment Helper${NC}"
echo "Branch: $BRANCH"
echo "Message: $MESSAGE"
echo ""

# Safety checks
if [ "$BRANCH" = "production" ]; then
    echo -e "${RED}⚠️  WARNING: Deploying to PRODUCTION${NC}"
    echo -e "${YELLOW}Production updates should only be for:${NC}"
    echo "  - Version releases (1.0.1, 1.0.2, etc.)"
    echo "  - Critical security fixes"
    echo "  - Major bug fixes affecting users"
    echo "  - Significant feature releases"
    echo ""
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Deployment cancelled${NC}"
        exit 1
    fi
fi

# Pre-deployment checks
echo -e "${YELLOW}📋 Running pre-deployment checks...${NC}"

# Check for TypeScript errors (non-blocking for now)
echo "Checking TypeScript..."
if ! npx tsc --noEmit --skipLibCheck > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  TypeScript errors found (proceeding anyway)${NC}"
else
    echo -e "${GREEN}✅ TypeScript check passed${NC}"
fi

# Check for critical ESLint errors
echo "Checking ESLint..."
if ! npm run lint > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  ESLint warnings found (proceeding anyway)${NC}"
else
    echo -e "${GREEN}✅ ESLint check passed${NC}"
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
    git status --short
    echo ""
    read -p "Continue with uncommitted changes? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Deployment cancelled${NC}"
        exit 1
    fi
fi

# Deploy
echo -e "${GREEN}📦 Deploying to $BRANCH...${NC}"
eas update --branch "$BRANCH" --message "$MESSAGE"

echo -e "${GREEN}✅ Deployment complete!${NC}"

# Show recent updates
echo ""
echo -e "${YELLOW}📈 Recent updates on $BRANCH:${NC}"
eas update:list --branch "$BRANCH" --limit 3

# Deployment reminders
if [ "$BRANCH" = "production" ]; then
    echo ""
    echo -e "${GREEN}🎉 Production deployment successful!${NC}"
    echo -e "${YELLOW}Don't forget to:${NC}"
    echo "  - Update changelog/release notes"
    echo "  - Monitor app performance"
    echo "  - Check user feedback"
fi