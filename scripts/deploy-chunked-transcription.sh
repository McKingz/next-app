#!/bin/bash

# Quick Deployment Script for Chunked Transcription Phase 1
# This script helps deploy the Edge Function and test the system

set -e

echo "🚀 Deploying Chunked Transcription - Phase 1"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from project root${NC}"
    exit 1
fi

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI not found${NC}"
    echo "Install with: npm install -g supabase"
    exit 1
fi

# Check if logged in
echo -e "${YELLOW}Checking Supabase login status...${NC}"
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Supabase${NC}"
    echo "Run: supabase login"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI ready${NC}"
echo ""

# Step 1: Check/Set Secrets
echo "📝 Step 1: Checking API Secrets"
echo "--------------------------------"
echo ""

echo "Checking if OPENAI_API_KEY is set..."
if supabase secrets list 2>/dev/null | grep -q "OPENAI_API_KEY"; then
    echo -e "${GREEN}✓ OPENAI_API_KEY already set${NC}"
else
    echo -e "${YELLOW}! OPENAI_API_KEY not set${NC}"
    echo ""
    read -p "Enter your OpenAI API key (sk-...): " OPENAI_KEY
    if [ -n "$OPENAI_KEY" ]; then
        supabase secrets set OPENAI_API_KEY="$OPENAI_KEY"
        echo -e "${GREEN}✓ OPENAI_API_KEY set${NC}"
    else
        echo -e "${RED}Error: OpenAI API key required${NC}"
        exit 1
    fi
fi

echo ""
echo "Checking if OPENAI_TRANSCRIPTION_MODEL is set..."
if supabase secrets list 2>/dev/null | grep -q "OPENAI_TRANSCRIPTION_MODEL"; then
    echo -e "${GREEN}✓ OPENAI_TRANSCRIPTION_MODEL already set${NC}"
else
    echo "Setting OPENAI_TRANSCRIPTION_MODEL to whisper-1..."
    supabase secrets set OPENAI_TRANSCRIPTION_MODEL=whisper-1
    echo -e "${GREEN}✓ OPENAI_TRANSCRIPTION_MODEL set${NC}"
fi

echo ""
echo -e "${GREEN}✓ All secrets configured${NC}"
echo ""

# Step 2: Deploy Edge Function
echo "🚢 Step 2: Deploying Edge Function"
echo "-----------------------------------"
echo ""

echo "Deploying transcribe-chunk function..."
if supabase functions deploy transcribe-chunk; then
    echo ""
    echo -e "${GREEN}✓ Edge Function deployed successfully${NC}"
else
    echo ""
    echo -e "${RED}✗ Edge Function deployment failed${NC}"
    exit 1
fi

echo ""

# Step 3: Test with Expo Web
echo "🧪 Step 3: Testing with Expo Web"
echo "---------------------------------"
echo ""

echo "Starting Expo web server..."
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wait for web server to start"
echo "2. Navigate to /screens/test-chunked-transcription"
echo "3. Click 'Start Recording' and speak for 10-15 seconds"
echo "4. Watch chunks transcribe in real-time!"
echo ""
echo "Expected results:"
echo "  - First chunk: ~1.5 seconds"
echo "  - Subsequent chunks: ~1-2 seconds each"
echo "  - Success rate: >90%"
echo ""

read -p "Press Enter to start Expo web server (or Ctrl+C to exit)..."

npm run web

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
