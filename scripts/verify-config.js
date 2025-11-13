const fs = require('fs');

const j = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const out = {
  owner: j.expo?.owner ?? null,
  projectId: j.expo?.extra?.eas?.projectId ?? null,
  updatesUrl: j.expo?.updates?.url ?? null,
  slug: j.expo?.slug ?? null,
  androidPackage: j.expo?.android?.package ?? null,
  iosBundleIdentifier: j.expo?.ios?.bundleIdentifier ?? null,
};

console.log('✓ Active Expo project configuration:');
console.log(out);
