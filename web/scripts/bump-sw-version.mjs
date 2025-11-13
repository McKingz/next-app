#!/usr/bin/env node
// Bump SW_VERSION in public/sw.js so that a new Service Worker is installed on every build
// This ensures the PWAUpdateChecker banner shows "Update Available" after deploy.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');
const swPath = path.join(projectRoot, 'public', 'sw.js');

function bump() {
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14); // YYYYMMDDHHMM
  const version = `v${ts}`;
  let sw = fs.readFileSync(swPath, 'utf8');

  // Replace SW_VERSION assignment
  const before = sw;
  sw = sw.replace(/const\s+SW_VERSION\s*=\s*'[^']*';/, `const SW_VERSION = '${version}';`);

  if (sw === before) {
    console.warn('[bump-sw-version] No SW_VERSION placeholder found; keeping file as is');
  } else {
    fs.writeFileSync(swPath, sw);
    console.log(`[bump-sw-version] Set SW_VERSION=${version}`);
  }
}

try {
  bump();
} catch (e) {
  console.error('[bump-sw-version] Failed:', e?.message || e);
  process.exit(0); // non-blocking
}
