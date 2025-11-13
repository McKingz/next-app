# PWA Icons

This directory contains icons for the Progressive Web App (PWA) installation.

## Required Icons

You need to generate the following icons from your app logo (`assets/icon.png`):

### 1. **icon-192.png** (192x192px)
- Standard PWA icon
- Used for: Android home screen, app drawer
- Format: PNG with transparent or solid background
- **Generation**: Resize `assets/icon.png` to exactly 192x192px

### 2. **icon-512.png** (512x512px)
- High-resolution PWA icon
- Used for: Splash screens, app info pages
- Format: PNG with transparent or solid background
- **Generation**: Resize `assets/icon.png` to exactly 512x512px

### 3. **maskable-512.png** (512x512px) - OPTIONAL BUT RECOMMENDED
- Adaptive icon for Android
- Must have **safe zone** (center 80% contains important content)
- Outer 20% may be masked/cropped by system
- Format: PNG with solid background recommended
- **Generation**: 
  - Take `assets/icon.png`
  - Add padding so logo is in center 80%
  - Fill outer area with brand color (#00f5ff or #0a0a0f)
  - Resize to 512x512px

## Quick Generation Methods

### Method 1: Using ImageMagick (Command Line)
\`\`\`bash
# Install ImageMagick if needed
# Ubuntu/Debian: sudo apt-get install imagemagick
# macOS: brew install imagemagick

# Standard icons
convert assets/icon.png -resize 192x192 public/icons/icon-192.png
convert assets/icon.png -resize 512x512 public/icons/icon-512.png

# Maskable icon (with padding)
convert assets/icon.png -resize 410x410 -background "#0a0a0f" -gravity center -extent 512x512 public/icons/maskable-512.png
\`\`\`

### Method 2: Using Online Tools
- **PWA Asset Generator**: https://www.pwabuilder.com/imageGenerator
  - Upload `assets/icon.png`
  - Download generated icons
  - Copy to this directory

- **Maskable.app**: https://maskable.app/editor
  - Upload icon
  - Adjust safe zone
  - Export as maskable-512.png

### Method 3: Manual (Any Image Editor)
1. Open `assets/icon.png` in Photoshop/GIMP/Figma
2. Resize canvas to 192x192px (for icon-192.png)
3. Resize canvas to 512x512px (for icon-512.png and maskable-512.png)
4. For maskable: Add 10% padding on all sides, center logo
5. Export as PNG with transparency (or solid background for maskable)

## Verification

After generating icons, verify them:

1. **Size Check**: Use `file` command or image viewer
   \`\`\`bash
   file public/icons/*.png
   # Should show exact dimensions: 192x192 and 512x512
   \`\`\`

2. **Visual Check**: Open each icon to ensure no distortion

3. **Maskable Check**: Use https://maskable.app/ to preview maskable icon with different shapes

## Integration

Once icons are generated, they are automatically referenced in:
- `/public/manifest.json` (already configured)
- `app/_layout.tsx` (head tags - will be added in next step)

**Note**: Icons are NOT committed to version control if > 1MB. Add to `.gitignore` if needed.
