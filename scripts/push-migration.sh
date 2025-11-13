#!/bin/bash

# Push Migration Script
# Usage: ./push-migration.sh <migration_file.sql>
# Requires SUPABASE_SERVICE_ROLE_KEY environment variable

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="https://lvvvjywrmpcqrpvuptdi.supabase.co"

# Check if migration file is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: Please provide a migration file${NC}"
    echo "Usage: $0 <migration_file.sql>"
    echo ""
    echo "Available migrations:"
    ls -1 migrations_drafts/*.sql 2>/dev/null | sed 's/^/  /' || echo "  No migration files found"
    exit 1
fi

MIGRATION_FILE="$1"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    # Try looking in migrations_drafts directory
    if [ -f "migrations_drafts/$MIGRATION_FILE" ]; then
        MIGRATION_FILE="migrations_drafts/$MIGRATION_FILE"
    else
        echo -e "${RED}❌ Error: Migration file '$MIGRATION_FILE' not found${NC}"
        exit 1
    fi
fi

# Check if service role key is set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set${NC}"
    echo ""
    echo "Please export your service role key:"
    echo "export SUPABASE_SERVICE_ROLE_KEY=\"your_service_role_key_here\""
    exit 1
fi

echo -e "${BLUE}🚀 Pushing Migration to Supabase${NC}"
echo -e "${BLUE}================================${NC}"
echo "Database: $SUPABASE_URL"
echo "Migration: $MIGRATION_FILE"
echo ""

# Read the migration file
echo -e "${YELLOW}📖 Reading migration file...${NC}"
if [ ! -r "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Error: Cannot read migration file '$MIGRATION_FILE'${NC}"
    exit 1
fi

MIGRATION_SQL=$(cat "$MIGRATION_FILE")
echo -e "${GREEN}✅ Migration file loaded ($(wc -l < "$MIGRATION_FILE") lines)${NC}"

# Create a temporary file for the SQL execution
TEMP_FILE=$(mktemp /tmp/migration_XXXXXX.sql)
echo "$MIGRATION_SQL" > "$TEMP_FILE"

echo ""
echo -e "${YELLOW}🔧 Executing migration...${NC}"

# Execute the migration using curl
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Prefer: return=minimal" \
    -d "{\"query\": $(jq -Rs . < "$TEMP_FILE")}" \
    "$SUPABASE_URL/rest/v1/rpc/exec" 2>/dev/null)

# Extract HTTP status and body
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
HTTP_BODY=$(echo $RESPONSE | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')

# Clean up temp file
rm "$TEMP_FILE"

# Check response
if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 201 ]; then
    echo -e "${GREEN}✅ Migration executed successfully!${NC}"
    
    # Check if there's an error in the response body
    if echo "$HTTP_BODY" | grep -q '"error"'; then
        echo -e "${RED}❌ SQL Error in migration:${NC}"
        echo "$HTTP_BODY" | jq -r '.error // .message // .' 2>/dev/null || echo "$HTTP_BODY"
        exit 1
    else
        echo -e "${GREEN}🎉 Migration completed successfully!${NC}"
    fi
elif [ "$HTTP_STATUS" -eq 404 ]; then
    echo -e "${YELLOW}⚠️  RPC function 'exec' not found, trying alternative method...${NC}"
    
    # Try using the SQL editor endpoint
    RESPONSE2=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        --data-raw "$MIGRATION_SQL" \
        "$SUPABASE_URL/sql" 2>/dev/null)
    
    HTTP_STATUS2=$(echo $RESPONSE2 | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    HTTP_BODY2=$(echo $RESPONSE2 | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    
    if [ "$HTTP_STATUS2" -eq 200 ]; then
        echo -e "${GREEN}✅ Migration executed via SQL endpoint!${NC}"
    else
        echo -e "${RED}❌ Failed to execute migration${NC}"
        echo "HTTP Status: $HTTP_STATUS2"
        echo "Response: $HTTP_BODY2"
        echo ""
        echo -e "${YELLOW}💡 Alternative: Run this SQL manually in Supabase Dashboard:${NC}"
        echo "$SUPABASE_URL/project/lvvvjywrmpcqrpvuptdi/sql"
        exit 1
    fi
else
    echo -e "${RED}❌ Failed to execute migration${NC}"
    echo "HTTP Status: $HTTP_STATUS"
    echo "Response: $HTTP_BODY"
    echo ""
    echo -e "${YELLOW}💡 Manual execution required:${NC}"
    echo "Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql"
    echo "And paste the contents of: $MIGRATION_FILE"
    exit 1
fi

echo ""
echo -e "${BLUE}📊 Next steps:${NC}"
echo "1. Verify the migration worked by checking your Supabase dashboard"
echo "2. Test your application to ensure everything works correctly"
echo "3. Consider running: npm run inspect-db to verify the changes"