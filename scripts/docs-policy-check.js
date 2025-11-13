#!/usr/bin/env node
/*
Docs policy enforcement:
- Allow all documentation under docs/ (including docs/OBSOLETE/)
- Restrict root-level Markdown files to: README.md, WARP.md, ROAD-MAP.md
*/

const { execSync } = require('node:child_process');
const path = require('node:path');

try {
  // Evaluate repository tree to enforce root Markdown policy
  const files = execSync('git ls-files', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .split('\n')
    .filter(Boolean);

  const allowedRoot = new Set(['README.md', 'WARP.md', 'ROAD-MAP.md']);
  const rootMd = files.filter((f) => f.endsWith('.md') && f.split('/').length === 1);
  const violations = rootMd.filter((f) => !allowedRoot.has(path.basename(f)));

  if (violations.length > 0) {
    console.error('Docs policy violation: Root Markdown files not allowed:', violations);
    console.error('Only README.md, WARP.md, ROAD-MAP.md are permitted at repository root.');
    process.exit(1);
  }

  console.log('Docs policy passed.');
} catch (err) {
  console.error('Docs policy check encountered an error:', err.message);
  process.exit(1);
}
