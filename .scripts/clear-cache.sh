#!/bin/bash
# Clear React Native / Expo build cache

echo "🧹 Clearing build cache..."

# Clear Metro bundler cache
echo "Clearing Metro cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/react-* 2>/dev/null || true
rm -rf $TMPDIR/haste-* 2>/dev/null || true

# Clear Expo cache
echo "Clearing Expo cache..."
rm -rf .expo 2>/dev/null || true

# Clear node_modules cache
echo "Clearing node_modules cache..."
rm -rf node_modules/.cache 2>/dev/null || true

# Clear watchman watches (if watchman is installed)
if command -v watchman &> /dev/null; then
  echo "Clearing Watchman watches..."
  watchman watch-del-all 2>/dev/null || true
fi

echo "✅ Cache cleared successfully!"
echo ""
echo "Next steps:"
echo "1. Run: npm start -- --clear"
echo "   OR: npx expo start -c"
echo "2. Press 'a' for Android or 'i' for iOS"
