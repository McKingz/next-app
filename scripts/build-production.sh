#!/bin/bash

# EduDash Pro - Production Build Script
# This script helps build production APK/AAB files locally

set -e

echo "🚀 EduDash Pro Production Build Script"
echo "======================================"

# Function to show usage
show_usage() {
    echo "Usage: $0 [apk|aab|preview]"
    echo ""
    echo "Build types:"
    echo "  apk     - Build production APK (for direct installation)"
    echo "  aab     - Build production AAB (for Google Play Store)"
    echo "  preview - Build preview APK (for testing)"
    echo ""
    echo "Examples:"
    echo "  $0 apk     # Build production APK"
    echo "  $0 aab     # Build production AAB"
    echo "  $0 preview # Build preview version"
}

# Check if argument is provided
if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

BUILD_TYPE=$1

# Pre-build checks
echo "🔍 Running pre-build checks..."

# Check if credentials.json exists
if [ ! -f "credentials.json" ]; then
    echo "❌ credentials.json not found!"
    echo "Please run 'npx eas credentials' to set up local credentials first."
    exit 1
fi

# Check if keystore exists
if [ ! -f "@edudashpro__edudashpro.jks" ]; then
    echo "❌ Keystore file not found!"
    echo "Please download your keystore using 'npx eas credentials'."
    exit 1
fi

# Check environment variables
echo "📋 Environment Configuration:"
echo "   - NODE_ENV: ${NODE_ENV:-not set}"
echo "   - Build Type: $BUILD_TYPE"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf build/

# Run type check
echo "🔧 Running TypeScript type check..."
npm run typecheck

# Run linting
echo "🔍 Running linter..."
npm run lint

echo "✅ Pre-build checks completed!"
echo ""

# Build based on type
case $BUILD_TYPE in
    "apk")
        echo "📱 Building Production APK..."
        echo "This will create an APK file for direct installation."
        npx eas build --platform android --profile production-apk --local
        ;;
    "aab")
        echo "📦 Building Production AAB..."
        echo "This will create an AAB file for Google Play Store."
        npx eas build --platform android --profile production --local
        ;;
    "preview")
        echo "🧪 Building Preview APK..."
        echo "This will create a preview APK for testing."
        npx eas build --platform android --profile preview --local
        ;;
    *)
        echo "❌ Invalid build type: $BUILD_TYPE"
        show_usage
        exit 1
        ;;
esac

echo ""
echo "🎉 Build completed!"
echo ""
echo "📂 Your build files are located in:"
echo "   - Check the output above for the exact file location"
echo "   - Usually in: ./dist/ or shown in the build output"
echo ""
echo "📋 Next steps:"
case $BUILD_TYPE in
    "apk")
        echo "   - Install APK on device: adb install path/to/your.apk"
        echo "   - Or share the APK file for manual installation"
        ;;
    "aab")
        echo "   - Upload AAB to Google Play Console"
        echo "   - Use for Play Store releases and internal testing"
        ;;
    "preview")
        echo "   - Test the preview APK before production"
        echo "   - Share with beta testers"
        ;;
esac
