#!/usr/bin/env node
/**
 * Export English translation keys to CSV for translators
 * 
 * Usage: node scripts/export-for-translation.js
 * Output: translations-template.csv
 */

const fs = require('fs');
const path = require('path');

const LANGUAGES = ['en', 'es', 'fr', 'pt', 'de', 'af', 'zu', 'st'];
const enFile = path.join(__dirname, '../locales/en/common.json');

/**
 * Extract context from key structure
 */
function getContext(key) {
  const parts = key.split('.');
  const namespace = parts[0];
  
  const contextMap = {
    'auth': 'Authentication',
    'dashboard': 'Dashboard',
    'parent': 'Parent screen',
    'teacher': 'Teacher screen',
    'principal': 'Principal screen',
    'admin': 'Admin',
    'ai': 'AI feature',
    'settings': 'Settings',
    'errors': 'Error message',
    'success': 'Success message',
    'validation': 'Validation',
    'forms': 'Form',
    'modals': 'Modal dialog',
    'components': 'Component',
    'loading': 'Loading state',
    'empty': 'Empty state',
    'actions': 'Action button',
    'navigation': 'Navigation',
  };
  
  return contextMap[namespace] || namespace;
}

/**
 * Detect variable placeholders
 */
function extractVariables(value) {
  if (typeof value !== 'string') return [];
  const matches = value.match(/\{\{(\w+)\}\}/g);
  return matches ? matches.map(m => m.slice(2, -2)) : [];
}

function flattenKeys(obj, prefix = '') {
  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result.push(...flattenKeys(value, fullKey));
    } else {
      const variables = extractVariables(value);
      result.push({ 
        key: fullKey, 
        en: value,
        context: getContext(fullKey),
        variables: variables.length > 0 ? variables.join(', ') : ''
      });
    }
  }
  return result;
}

try {
  console.log('📤 Exporting translation keys...\n');
  
  const enData = JSON.parse(fs.readFileSync(enFile, 'utf8'));
  const keys = flattenKeys(enData);

  // Generate CSV with context and variables
  const header = ['Key', 'Context', 'Variables', ...LANGUAGES].join(',');
  const rows = keys.map(({ key, en, context, variables }) => {
    const cells = [key, context, variables, en, ...Array(LANGUAGES.length - 1).fill('')];
    return cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
  });

  const csvPath = path.join(__dirname, '../translations-template.csv');
  fs.writeFileSync(csvPath, [header, ...rows].join('\n'));
  
  // Calculate statistics
  const keysWithVars = keys.filter(k => k.variables).length;
  const namespaces = new Set(keys.map(k => k.key.split('.')[0]));
  
  console.log(`✅ Exported ${keys.length} keys to translations-template.csv`);
  console.log(`📊 Statistics:`);
  console.log(`   • Total keys: ${keys.length}`);
  console.log(`   • Keys with variables: ${keysWithVars}`);
  console.log(`   • Namespaces: ${namespaces.size}`);
  console.log(`   • Languages: ${LANGUAGES.join(', ')}`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Open translations-template.csv in a spreadsheet editor`);
  console.log(`   2. Fill in translations for each language column`);
  console.log(`   3. Keep variable placeholders like {{name}} unchanged`);
  console.log(`   4. Run verification: node scripts/verify-translations.js`);
} catch (error) {
  console.error('❌ Export failed:', error.message);
  process.exit(1);
}
