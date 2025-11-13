# PWA Setup for EduDash Pro Web

This document describes the Progressive Web App (PWA) implementation for the EduDash Pro web platform.

## Overview

The web platform is a fully functional PWA that can be installed on any device, providing:
- **Offline capability** with service worker caching
- **App-like experience** in standalone mode
- **Install prompts** for Chrome/Edge/Android and iOS devices
- **Fast loading** with optimized caching strategies

## Architecture

### Service Worker (`/public/sw.js`)

The service worker implements multiple caching strategies:

1. **Static Cache**: Icons, manifest, offline page
2. **Runtime Cache**: Dynamic content with network-first strategy
3. **Image/Font Cache**: Cache-first for static assets
4. **API Requests**: Network-first with cache fallback

### Web App Manifest (`/public/manifest.json` & `/public/manifest.webmanifest`)

Defines the app metadata for installation:
- App name, description, icons
- Display mode: `standalone`
- Theme colors: `#00f5ff` (cyan)
- Shortcuts: Direct links to dashboard
- Purpose: `any maskable` for adaptive icons

### Install Prompt Component (`/src/components/PWAInstallPrompt.tsx`)

Detects platform and shows appropriate install prompt:

**Chrome/Edge/Android:**
- Captures `beforeinstallprompt` event
- Shows custom install UI with "Install" button
- Dismissible with session storage tracking

**iOS/Safari:**
- Detects iOS devices
- Shows manual instructions: "Add to Home Screen"
- Includes share icon visual cue

## Testing PWA Installation

### Android (Chrome/Edge)

1. Visit the deployed site on Chrome/Edge
2. After 3 seconds, an install prompt will appear at the bottom
3. Click "Install" to add to home screen
4. App opens in standalone mode without browser UI

### iOS (Safari)

1. Visit the deployed site on Safari
2. After 5 seconds, instructions appear
3. Tap the share button (square with arrow)
4. Tap "Add to Home Screen"
5. Confirm installation

### Desktop (Chrome/Edge)

1. Visit the deployed site
2. Look for install icon in address bar (⊕ or computer icon)
3. Click to install as desktop app
4. App opens in separate window

## Verification Checklist

✅ **Manifest Valid**
- Check: `https://your-domain.com/manifest.json`
- Should return valid JSON with `200` status
- Content-Type: `application/manifest+json`

✅ **Service Worker Registered**
- Open DevTools → Application → Service Workers
- Should show "Activated and running"

✅ **Icons Present**
- Check: `/icon-192.png` and `/icon-512.png`
- Should be square, high-quality PNG

✅ **Offline Page Works**
- Disconnect internet
- Navigate to new page
- Should show custom offline page

✅ **Install Prompt Appears**
- Fresh browser session (clear storage)
- Wait 3-5 seconds on homepage
- Prompt should slide up from bottom

## File Structure

```
web/
├── public/
│   ├── manifest.json              # Web app manifest
│   ├── manifest.webmanifest       # Alternative manifest URL
│   ├── sw.js                      # Service worker
│   ├── offline.html               # Offline fallback page
│   ├── icon-192.png               # Small icon
│   └── icon-512.png               # Large icon
├── src/
│   ├── components/
│   │   ├── PWARegister.tsx        # SW registration
│   │   └── PWAInstallPrompt.tsx   # Install UI
│   └── app/
│       ├── layout.tsx             # Root layout with PWA components
│       └── globals.css            # Slide-up animation
└── vercel.json                    # Deployment config
```

## Deployment Configuration

### Vercel Headers (`vercel.json`)

Critical headers for PWA functionality:

```json
{
  "source": "/sw.js",
  "headers": [
    { "key": "Content-Type", "value": "application/javascript" },
    { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" },
    { "key": "Service-Worker-Allowed", "value": "/" }
  ]
}
```

### Build Commands

```bash
# Local development (no SW)
npm run dev

# Production build
npm run build

# Deploy to Vercel
vercel deploy --prod
```

## Troubleshooting

### Install Prompt Not Showing

1. **Check HTTPS**: PWAs require secure context
2. **Clear cache**: Service worker might be cached
3. **Check session storage**: Prompt dismissal is tracked
4. **Wait**: Prompt has 3-5 second delay

### Service Worker Not Registering

1. **Check console**: Look for registration errors
2. **Verify path**: SW must be at `/sw.js` (root)
3. **Check headers**: `Service-Worker-Allowed` must be `/`
4. **Clear all**: DevTools → Application → Clear storage

### Offline Mode Not Working

1. **Check SW status**: Must be "Activated"
2. **Check cache**: DevTools → Application → Cache Storage
3. **Test fetch**: Look for cached responses in Network tab
4. **Reload**: Sometimes requires page refresh

## Browser Support

| Browser | Install Support | SW Support | Notes |
|---------|----------------|------------|-------|
| Chrome (Android) | ✅ Yes | ✅ Yes | Best experience |
| Edge (Desktop) | ✅ Yes | ✅ Yes | Full support |
| Safari (iOS) | ⚠️ Manual | ✅ Yes | No automatic prompt |
| Firefox | ❌ No | ✅ Yes | SW only, no install |
| Samsung Internet | ✅ Yes | ✅ Yes | Full support |

## Maintenance

### Updating Service Worker

When updating `sw.js`:

1. Change `CACHE_NAME` version
2. Add new assets to static cache if needed
3. Deploy changes
4. Users get update on next visit
5. Old caches automatically cleaned up

### Updating Manifest

When updating `manifest.json`:

1. Update both `.json` and `.webmanifest`
2. Keep icon paths absolute (`/icon-192.png`)
3. Test with Lighthouse PWA audit
4. Deploy and verify with DevTools

## Analytics & Monitoring

Track PWA installation events:

```typescript
window.addEventListener('appinstalled', () => {
  // Track successful installation
  console.log('PWA installed successfully');
});
```

Monitor service worker lifecycle:

```typescript
navigator.serviceWorker.addEventListener('controllerchange', () => {
  // New SW activated
  console.log('Service worker updated');
});
```

## Resources

- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest Spec](https://w3c.github.io/manifest/)
- [Workbox (Advanced Caching)](https://developers.google.com/web/tools/workbox)
