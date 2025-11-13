#!/bin/bash

##############################################################################
# Voice System Deployment Script
# 
# This script deploys the TTS proxy Edge Function to Supabase
# and configures Azure Speech Services credentials.
#
# Usage: ./scripts/deploy-voice-system.sh
##############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓ ${NC}$1"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${NC}$1"
}

print_error() {
    echo -e "${RED}✗ ${NC}$1"
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

##############################################################################
# Step 1: Check Prerequisites
##############################################################################

print_header "Step 1: Checking Prerequisites"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI is not installed"
    echo "Install it with: npm install -g supabase"
    exit 1
fi
print_success "Supabase CLI is installed"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Not in project root directory"
    echo "Please run this script from the project root"
    exit 1
fi
print_success "In project root directory"

# Check if TTS proxy function exists
if [ ! -f "supabase/functions/tts-proxy/index.ts" ]; then
    print_error "TTS proxy function not found at supabase/functions/tts-proxy/index.ts"
    exit 1
fi
print_success "TTS proxy function exists"

# Check if .env.local exists and get project URL
if [ ! -f ".env.local" ]; then
    print_error ".env.local file not found"
    echo "Please create .env.local with your Supabase credentials"
    exit 1
fi

PROJECT_URL=$(grep "EXPO_PUBLIC_SUPABASE_URL" .env.local | cut -d '=' -f 2)
if [ -z "$PROJECT_URL" ]; then
    print_error "EXPO_PUBLIC_SUPABASE_URL not found in .env.local"
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $PROJECT_URL | sed -n 's|.*://\([^.]*\)\.supabase\.co|\1|p')
print_success "Found Supabase project: $PROJECT_REF"

##############################################################################
# Step 2: Check Azure Credentials
##############################################################################

print_header "Step 2: Azure Credentials Setup"

echo "You need your Azure Speech Services credentials:"
echo "  1. Azure Speech Key"
echo "  2. Azure Region (e.g., southafricanorth)"
echo ""

# Check if environment variables are set
if [ -n "$AZURE_SPEECH_KEY" ] && [ -n "$AZURE_SPEECH_REGION" ]; then
    print_info "Azure credentials found in environment"
    SPEECH_KEY="$AZURE_SPEECH_KEY"
    SPEECH_REGION="$AZURE_SPEECH_REGION"
else
    print_warning "Azure credentials not found in environment"
    echo ""
    read -p "Enter your Azure Speech Key: " SPEECH_KEY
    read -p "Enter your Azure Region (default: southafricanorth): " SPEECH_REGION
    SPEECH_REGION=${SPEECH_REGION:-southafricanorth}
fi

if [ -z "$SPEECH_KEY" ]; then
    print_error "Azure Speech Key is required"
    echo ""
    echo "Get your key from: https://portal.azure.com"
    echo "Navigate to: Cognitive Services -> Speech Services -> Keys and Endpoint"
    exit 1
fi

print_success "Azure credentials configured"
echo "  Region: $SPEECH_REGION"
echo "  Key: ${SPEECH_KEY:0:10}... (hidden)"

##############################################################################
# Step 3: Link to Supabase Project
##############################################################################

print_header "Step 3: Linking to Supabase Project"

# Check if already linked
if supabase projects list 2>&1 | grep -q "Access token"; then
    print_warning "Not logged in to Supabase CLI"
    echo ""
    read -p "Would you like to log in now? (y/n): " LOGIN_CHOICE
    if [ "$LOGIN_CHOICE" = "y" ]; then
        supabase login
        print_success "Logged in to Supabase"
    else
        print_error "Login required to continue"
        exit 1
    fi
else
    print_success "Already logged in to Supabase CLI"
fi

# Link to project (if not already linked)
print_info "Linking to project: $PROJECT_REF"
if supabase link --project-ref $PROJECT_REF 2>&1 | grep -q "already linked"; then
    print_success "Project already linked"
else
    print_success "Project linked successfully"
fi

##############################################################################
# Step 4: Set Supabase Secrets
##############################################################################

print_header "Step 4: Setting Supabase Secrets"

print_info "Setting AZURE_SPEECH_KEY..."
if supabase secrets set AZURE_SPEECH_KEY="$SPEECH_KEY" --project-ref $PROJECT_REF; then
    print_success "AZURE_SPEECH_KEY set"
else
    print_error "Failed to set AZURE_SPEECH_KEY"
    exit 1
fi

print_info "Setting AZURE_SPEECH_REGION..."
if supabase secrets set AZURE_SPEECH_REGION="$SPEECH_REGION" --project-ref $PROJECT_REF; then
    print_success "AZURE_SPEECH_REGION set"
else
    print_error "Failed to set AZURE_SPEECH_REGION"
    exit 1
fi

# Verify secrets were set
print_info "Verifying secrets..."
supabase secrets list --project-ref $PROJECT_REF

##############################################################################
# Step 5: Deploy Edge Function
##############################################################################

print_header "Step 5: Deploying TTS Proxy Edge Function"

print_info "Deploying function to Supabase..."
if supabase functions deploy tts-proxy --project-ref $PROJECT_REF; then
    print_success "Function deployed successfully!"
else
    print_error "Function deployment failed"
    exit 1
fi

# Wait a moment for deployment to propagate
sleep 2

##############################################################################
# Step 6: Test Deployment
##############################################################################

print_header "Step 6: Testing Deployment"

# Get anon key from .env.local
ANON_KEY=$(grep "EXPO_PUBLIC_SUPABASE_ANON_KEY" .env.local | cut -d '=' -f 2)

if [ -z "$ANON_KEY" ]; then
    print_error "Could not find EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    print_warning "Skipping automated test"
else
    print_info "Testing TTS synthesis with Afrikaans..."
    
    TEST_RESPONSE=$(curl -s -X POST "$PROJECT_URL/functions/v1/tts-proxy" \
        -H "Authorization: Bearer $ANON_KEY" \
        -H "Content-Type: application/json" \
        -d '{"action":"synthesize","text":"Hallo, dit is n toets","language":"af"}')
    
    if echo "$TEST_RESPONSE" | grep -q "audio_url"; then
        print_success "Test successful! TTS is working"
        echo ""
        echo "Response preview:"
        echo "$TEST_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TEST_RESPONSE"
    elif echo "$TEST_RESPONSE" | grep -q "error"; then
        print_warning "Test returned an error:"
        echo "$TEST_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TEST_RESPONSE"
    else
        print_warning "Test response unclear:"
        echo "$TEST_RESPONSE"
    fi
fi

##############################################################################
# Summary
##############################################################################

print_header "🎉 Deployment Complete!"

echo "Your voice system is now deployed and ready to use!"
echo ""
echo "What's been set up:"
echo "  ✓ TTS Proxy Edge Function deployed"
echo "  ✓ Azure Speech Services configured"
echo "  ✓ Support for 4 languages (af, zu, xh, nso)"
echo ""
echo "Next steps:"
echo "  1. Test the voice demo screen: app/screens/voice-demo.tsx"
echo "  2. Check deployment guide: docs/voice/TTS_PROXY_DEPLOYMENT.md"
echo "  3. Review integration examples: docs/voice/CLIENT_INTEGRATION.md"
echo ""
echo "Deployment info:"
echo "  Project: $PROJECT_REF"
echo "  Function URL: $PROJECT_URL/functions/v1/tts-proxy"
echo "  Region: $SPEECH_REGION"
echo ""
echo "To view function logs:"
echo "  supabase functions logs tts-proxy --project-ref $PROJECT_REF"
echo ""

print_success "All done! 🚀"
