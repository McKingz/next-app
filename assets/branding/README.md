# EduDash Pro Brand Assets

This directory contains the official logo files and brand assets for EduDash Pro. These assets represent our visual identity and should be used consistently across all platforms and materials.

## 📁 File Structure

```
assets/branding/
├── svg/                          # Vector source files (preferred for web/UI)
│   ├── logo-icon-only.svg       # App icon (1024x1024)
│   ├── logo-full.svg             # Stacked icon + wordmark (1600x1200)
│   ├── logo-horizontal.svg       # Horizontal layout for headers (1600x512)
│   └── logo-monochrome.svg       # Single-color version for print
├── png/                          # Raster exports (for app stores, favicons)
│   ├── icon-1024.png            # App icon @ 1024x1024
│   ├── icon-512.png             # App icon @ 512x512
│   ├── icon-192.png             # App icon @ 192x192
│   ├── logo-full-1024w.png      # Full logo @ 1024w
│   ├── logo-horizontal-1024w.png # Horizontal @ 1024w
│   └── logo-monochrome-1024w.png # Monochrome @ 1024w
├── scripts/
│   └── convert-logos.sh          # PNG generation script
└── README.md                     # This file
```

## 🎨 Logo Variants

### 1. Icon Only (`logo-icon-only.svg`)
**Use for:** App icons, favicons, profile pictures, small spaces

The iconic speech bubble with three dots inside a gradient-framed square, featuring a colorful bookmark ribbon. This is our primary mark for mobile app icons and small digital contexts.

**Features:**
- Speech bubble represents communication
- Three dots indicate ongoing conversation
- Book foundation symbolizes education
- Bookmark accent adds progress/tracking metaphor
- Gradient frame creates modern, tech-forward feel

### 2. Full Logo (`logo-full.svg`)
**Use for:** Marketing materials, splash screens, presentations

Vertically stacked layout with icon on top and EDUDASH wordmark below. Best for materials where vertical space is available.

### 3. Horizontal Logo (`logo-horizontal.svg`)
**Use for:** Website headers, navigation bars, email signatures

Icon and wordmark side-by-side. Ideal for horizontal layouts and headers.

### 4. Monochrome Logo (`logo-monochrome.svg`)
**Use for:** Print materials, single-color applications, accessibility

Uses `currentColor` so it can be recolored by parent containers. Perfect for documents, receipts, and contexts where gradients aren't supported.

## 🌈 Brand Colors

### Primary Gradient (Icon Frame)
```
Turquoise: #33C3D4
Blue: #1E6FBF  
Purple: #7B3FF2
```
Applied diagonally (top-left to bottom-right) on the icon frame.

### Text Gradients
**EDU:** `#33C3D4` → `#1E6FBF` (turquoise to blue)  
**DASH:** `#7B3FF2` → `#9B5FF2` (purple gradient)

### Accent Colors
**Bookmark Gradient:** `#FF4D8F` → `#FF8C5F` → `#FFD54D` (pink to coral to yellow)  
**Dots:** `#6B7280` (neutral gray)  
**Speech Bubble:** `#FFFFFF` (white with subtle shadow)

### Monochrome
**Default:** `#111827` (dark gray)  
**Inverse:** `#FFFFFF` (white, for dark backgrounds)

## 📏 Spacing & Sizing Rules

### Clear Space
Maintain minimum clear space around the logo equal to **12% of the icon width** or the **height of the three dots combined**. No text, graphics, or UI elements should intrude into this area.

### Minimum Sizes
- **Icon alone:** 24px × 24px (digital), 0.5" (print)
- **Wordmark width:** 120px minimum for legibility
- **Full logo:** 180px width minimum

### Proportions
Never distort, stretch, or skew the logo. Always maintain aspect ratio when resizing.

## ✅ Do's

- ✓ Use provided SVG files for scalable digital applications
- ✓ Use PNG exports for app stores, favicons, and fixed-size contexts
- ✓ Maintain exact gradient colors and proportions
- ✓ Ensure adequate clear space around the logo
- ✓ Use monochrome version when gradients cannot be rendered
- ✓ Place logo on clean, high-contrast backgrounds
- ✓ Test legibility at small sizes (24px–48px)

## ❌ Don'ts

- ✗ Don't distort, rotate, or skew the logo
- ✗ Don't add outlines, drop shadows, or effects beyond the built-in soft shadow
- ✗ Don't recolor the brand gradients or change color values
- ✗ Don't place logo on busy backgrounds that reduce contrast
- ✗ Don't attach taglines or slogans to the logo (use separately for marketing)
- ✗ Don't recreate or redraw the logo—always use official files
- ✗ Don't use low-resolution or pixelated versions

## 🎯 Platform-Specific Guidelines

### Android App Icons
- Use `icon-1024.png` as the base
- Consider adaptive icon with transparent foreground layer
- Ensure icon elements stay within safe zone (inner 70% of canvas)
- Test at 48dp, 72dp, 96dp, and 192dp sizes

### iOS App Icons
- Use `icon-1024.png` for app store submission
- iOS automatically rounds corners—design accounts for this
- No transparency in iOS app icons (use solid background color if needed)

### Web Favicons
- Use `icon-192.png` for modern browsers
- Generate additional sizes: 16×16, 32×32, 48×48, 64×64
- Include in `<link rel="icon">` and web manifest

### Social Media
- Profile pictures: Use `logo-icon-only.svg` or `icon-512.png`
- Cover images: Use `logo-horizontal.svg` or PNG export
- Ensure logo is centered and has adequate padding

## 🔄 Regenerating PNG Exports

To regenerate PNG files from SVG sources:

```bash
./assets/branding/scripts/convert-logos.sh
```

**Requirements:** Inkscape, rsvg-convert, or ImageMagick must be installed.

```bash
# Install on Ubuntu/Debian
sudo apt-get install librsvg2-bin

# Install on macOS
brew install librsvg

# Or use Inkscape
brew install inkscape
```

## ♿ Accessibility

### Contrast Requirements
- Logo maintains **WCAG 2.1 AA** contrast on white backgrounds
- For dark backgrounds (e.g., dark mode), use monochrome white version
- Test contrast ratio: icon frame gradients average to ~3:1 minimum against white

### Screen Reader Considerations
When using logos in web contexts:
- Provide meaningful `alt` text: "EduDash Pro logo"
- Use `aria-label` for icon-only instances
- Decorative uses should have `alt=""` or `aria-hidden="true"`

## 📞 Brand Inquiries

For questions about logo usage, custom sizes, or special applications:
- Review this document first
- Check `/docs/design/brand-assets.md` for technical integration details
- Contact: [Your brand/design team contact]

## 📜 License & Copyright

© 2024 EduDash Pro. All rights reserved.

The EduDash Pro logo and brand assets are proprietary and may not be used without permission. These files are provided for authorized use in official EduDash Pro materials only.

---

**Version:** 1.0.0  
**Last Updated:** 2025-10-14  
**Maintainer:** EduDash Pro Design Team
