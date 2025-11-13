#!/bin/bash

# =====================================================
# Setup AI API Keys for Supabase Edge Functions
# =====================================================
# This script helps you configure OpenAI and Anthropic API keys
# for the ai-proxy Edge Function

echo "🔑 AI API Keys Setup for Supabase Edge Functions"
echo "=================================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "This script will help you set up API keys for:"
echo "  1. OpenAI API (for GPT models)"
echo "  2. Anthropic API (for Claude models)"
echo ""

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ You're not logged in to Supabase."
    echo "   Please run: supabase login"
    exit 1
fi

echo "📋 Available options:"
echo "  1. Set OpenAI API Key"
echo "  2. Set Anthropic API Key"
echo "  3. Set both keys"
echo "  4. View current secrets"
echo ""

read -p "Choose an option (1-4): " option

case $option in
    1)
        read -p "Enter your OpenAI API Key (starts with sk-): " openai_key
        if [ ! -z "$openai_key" ]; then
            echo "Setting OPENAI_API_KEY..."
            echo "$openai_key" | supabase secrets set OPENAI_API_KEY --project-ref=$(cat .supabase-project-ref 2>/dev/null || echo "")
            echo "✅ OpenAI API Key set successfully!"
        else
            echo "❌ No key provided"
        fi
        ;;
    2)
        read -p "Enter your Anthropic API Key (starts with sk-ant-): " anthropic_key
        if [ ! -z "$anthropic_key" ]; then
            echo "Setting ANTHROPIC_API_KEY..."
            echo "$anthropic_key" | supabase secrets set ANTHROPIC_API_KEY --project-ref=$(cat .supabase-project-ref 2>/dev/null || echo "")
            echo "✅ Anthropic API Key set successfully!"
        else
            echo "❌ No key provided"
        fi
        ;;
    3)
        read -p "Enter your OpenAI API Key (starts with sk-): " openai_key
        read -p "Enter your Anthropic API Key (starts with sk-ant-): " anthropic_key
        
        if [ ! -z "$openai_key" ]; then
            echo "Setting OPENAI_API_KEY..."
            echo "$openai_key" | supabase secrets set OPENAI_API_KEY --project-ref=$(cat .supabase-project-ref 2>/dev/null || echo "")
            echo "✅ OpenAI API Key set!"
        fi
        
        if [ ! -z "$anthropic_key" ]; then
            echo "Setting ANTHROPIC_API_KEY..."
            echo "$anthropic_key" | supabase secrets set ANTHROPIC_API_KEY --project-ref=$(cat .supabase-project-ref 2>/dev/null || echo "")
            echo "✅ Anthropic API Key set!"
        fi
        ;;
    4)
        echo ""
        echo "📋 Current Supabase secrets:"
        supabase secrets list
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "📝 Next steps:"
echo "  1. Redeploy the ai-proxy function: cd supabase/functions && supabase functions deploy ai-proxy"
echo "  2. Or the function will automatically use the new keys on next deployment"
echo ""
echo "💡 To get API keys:"
echo "  - OpenAI: https://platform.openai.com/api-keys"
echo "  - Anthropic: https://console.anthropic.com/settings/keys"
