#!/bin/bash
# Script to help fix email confirmation 404 error
# This script guides you through the Supabase Dashboard configuration changes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Email Confirmation 404 Fix Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create a .env file from .env.example"
    exit 1
fi

# Load environment variables
source .env

# Extract Supabase project URL
SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL}"
if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}Error: EXPO_PUBLIC_SUPABASE_URL not set in .env${NC}"
    exit 1
fi

# Extract project reference from URL
PROJECT_REF=$(echo "$SUPABASE_URL" | sed -n 's/https:\/\/\([^.]*\).*/\1/p')

echo -e "${GREEN}✓ Found Supabase project: ${PROJECT_REF}${NC}\n"

# Display current issue
echo -e "${YELLOW}Issue:${NC}"
echo "Email confirmation links are redirecting to payment bridge URL instead of landing page"
echo -e "Current behavior: ${RED}404 NOT_FOUND${NC}\n"

# Display what needs to be done
echo -e "${BLUE}Required Actions:${NC}\n"

echo "1. Open Supabase Dashboard:"
echo -e "   ${GREEN}https://supabase.com/dashboard/project/${PROJECT_REF}/auth/url-configuration${NC}\n"

echo "2. Update 'Site URL' to:"
echo -e "   ${GREEN}https://www.edudashpro.org.za/landing${NC}\n"

echo "3. Add these 'Redirect URLs' (one per line):"
echo -e "${GREEN}https://www.edudashpro.org.za${NC}"
echo -e "${GREEN}https://www.edudashpro.org.za/landing${NC}"
echo -e "${GREEN}https://www.edudashpro.org.za/landing?**${NC}"
echo -e "${GREEN}https://bridge-edudashpro-g2818dbtv-k1ng-devops-projects.vercel.app${NC}"
echo -e "${GREEN}https://bridge-edudashpro-g2818dbtv-k1ng-devops-projects.vercel.app/payments${NC}"
echo -e "${GREEN}edudashpro://**${NC}\n"

echo "4. Verify Email Template:"
echo -e "   ${GREEN}https://supabase.com/dashboard/project/${PROJECT_REF}/auth/templates${NC}"
echo "   Ensure 'Confirm signup' template uses:"
echo -e "   ${GREEN}{{ .ConfirmationURL }}${NC}\n"

echo -e "${YELLOW}After making these changes:${NC}"
echo "1. Test by registering a new parent account"
echo "2. Check the email confirmation link format"
echo "3. Click the link and verify it works"
echo ""

# Offer to open the browser
read -p "Would you like to open the Supabase Dashboard now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    DASHBOARD_URL="https://supabase.com/dashboard/project/${PROJECT_REF}/auth/url-configuration"
    
    # Try different browser commands based on what's available
    if command -v xdg-open &> /dev/null; then
        xdg-open "$DASHBOARD_URL" 2>/dev/null
    elif command -v firefox &> /dev/null; then
        firefox "$DASHBOARD_URL" 2>/dev/null &
    elif command -v google-chrome &> /dev/null; then
        google-chrome "$DASHBOARD_URL" 2>/dev/null &
    elif command -v chromium &> /dev/null; then
        chromium "$DASHBOARD_URL" 2>/dev/null &
    else
        echo -e "${YELLOW}Could not detect browser. Please open this URL manually:${NC}"
        echo "$DASHBOARD_URL"
    fi
    
    echo -e "\n${GREEN}Dashboard opened in browser${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Next Steps After Dashboard Update:${NC}"
echo -e "${BLUE}========================================${NC}\n"
echo "1. Run test registration:"
echo "   npm run test:email-confirmation"
echo ""
echo "2. Check documentation:"
echo "   cat docs/fixes/email-confirmation-404-fix.md"
echo ""
echo -e "${GREEN}Done!${NC}"
