#!/usr/bin/env node
/**
 * Patch dist/index.html after Expo export:
 * - Ensure manifest link uses credentials for Vercel Authentication protected previews
 * - Add mobile-web-app-capable meta to silence Chrome deprecation warning
 */
const fs = require('fs');
const path = require('path');

const dist = path.join(process.cwd(), 'dist');
const indexPath = path.join(dist, 'index.html');

try {
  if (!fs.existsSync(indexPath)) {
    console.log('[patch-manifest] dist/index.html not found, skipping');
    process.exit(0);
  }
  let html = fs.readFileSync(indexPath, 'utf8');

  // Add crossorigin="use-credentials" to manifest link
  const manifestLinkRe = /<link([^>]*?)rel=["']manifest["']([^>]*?)>/i;
  if (manifestLinkRe.test(html)) {
    html = html.replace(manifestLinkRe, (match, pre, post) => {
      if (/crossorigin=/i.test(match)) return match; // already present
      return `<link${pre}rel="manifest"${post} crossorigin="use-credentials">`;
    });
  } else {
    // If no manifest link present, add one near the end of <head>
    html = html.replace(/<\/head>/i, `  <link rel="manifest" href="/manifest.json" crossorigin="use-credentials">\n</head>`);
  }

  // Add mobile-web-app-capable meta (non-Apple) to address deprecation notice
  if (!/name=["']mobile-web-app-capable["']/i.test(html)) {
    html = html.replace(/<\/head>/i, `  <meta name="mobile-web-app-capable" content="yes">\n</head>`);
  }

  fs.writeFileSync(indexPath, html);
  console.log('[patch-manifest] Patched dist/index.html successfully');
} catch (e) {
  console.error('[patch-manifest] Failed:', e.message);
  process.exit(1);
}
