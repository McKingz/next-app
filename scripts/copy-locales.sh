#!/bin/bash
# Copy locales and PWA assets to dist folder for web deployment

set -e

echo "📦 Copying assets for Vercel deployment..."

# Create necessary directories
mkdir -p dist/locales
mkdir -p dist/icons

# Copy locale files (i18n translations)
if [ -d "locales" ]; then
  echo "📄 Copying locale files..."
  cp -r locales/* dist/locales/
  echo "✅ Locales copied"
fi

# Copy PWA manifest
if [ -f "public/manifest.json" ]; then
  echo "📱 Copying manifest.json..."
  cp public/manifest.json dist/manifest.json
  echo "✅ Manifest copied"
fi

# Copy PWA icons
if [ -d "public/icons" ]; then
  echo "🎨 Copying PWA icons..."
  cp -r public/icons/* dist/icons/
  echo "✅ Icons copied"
fi

# Copy service worker
if [ -f "public/sw.js" ]; then
  echo "⚙️ Copying service worker..."
  cp public/sw.js dist/sw.js
  echo "✅ Service worker copied"
fi

echo ""
echo "📊 Deployment assets summary:"
echo "Locales: $(find dist/locales -name '*.json' 2>/dev/null | wc -l) files"
echo "Icons: $(ls dist/icons/*.png 2>/dev/null | wc -l) files"
ls -lh dist/manifest.json 2>/dev/null || echo "⚠️ Warning: manifest.json not found"
ls -lh dist/sw.js 2>/dev/null || echo "⚠️ Warning: sw.js not found"
echo ""
echo "✅ All assets copied successfully"
