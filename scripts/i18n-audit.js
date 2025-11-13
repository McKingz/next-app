#!/usr/bin/env node

/**
 * I18N Audit Script for EduDash Pro
 * 
 * Scans the codebase for hardcoded strings that should be internationalized.
 * WARP.md Compliance: Golden Rule - Students, Teachers, and Parents First
 * 
 * Usage: node scripts/i18n-audit.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🌍 EduDash Pro I18N Audit Starting...\n');

// Configuration
const SCAN_DIRS = ['app', 'components', 'contexts', 'lib'];
const EXTENSIONS = ['.tsx', '.ts', '.js', '.jsx'];
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.expo',
  'dist',
  'build',
  '__tests__',
  '.test.',
  '.spec.',
  'locales/' // Don't scan translation files themselves
];

// Patterns to detect hardcoded strings
const HARDCODED_PATTERNS = [
  // Direct string literals in JSX
  /{[^}]*['""][A-Z][^'"]*['""][^}]*}/g,
  
  // Props with string values
  /(\w+)=["'][A-Z][^"']*["']/g,
  
  // Alert messages and console logs
  /(Alert\.(alert|prompt)|console\.(log|warn|error))\s*\(\s*["'][A-Z][^"']*["']/g,
  
  // Common UI text patterns
  /["'][A-Z][a-zA-Z\s]{5,}["']/g,
  
  // Error messages
  /(throw new Error|new Error)\s*\(\s*["'][A-Z][^"']*["']/g
];

// Known exceptions (technical terms, APIs, etc.)
const EXCEPTIONS = [
  'API', 'HTTP', 'HTTPS', 'URL', 'JSON', 'XML', 'UUID', 'JWT',
  'iOS', 'Android', 'React', 'TypeScript', 'JavaScript',
  'Supabase', 'PayFast', 'Expo', 'AsyncStorage',
  'TouchableOpacity', 'ScrollView', 'SafeAreaView',
  'StatusBar', 'TextInput', 'FlatList', 'View', 'Text',
  // Environment variables
  /^[A-Z_]+$/,
  // Single words that are likely tech terms
  /^[A-Z][a-z]*$/
];

const isException = (str) => {
  return EXCEPTIONS.some(exception => {
    if (typeof exception === 'string') {
      return str.includes(exception);
    } else {
      return exception.test(str);
    }
  });
};

const findings = {
  hardcodedStrings: [],
  files: new Set(),
  totalStrings: 0
};

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativeFile = path.relative(process.cwd(), filePath);
    
    // Check each hardcoded pattern
    HARDCODED_PATTERNS.forEach(pattern => {
      const matches = content.match(pattern) || [];
      matches.forEach(match => {
        // Extract the actual string content
        const stringMatch = match.match(/["']([^"']*?)["']/);
        if (stringMatch) {
          const stringContent = stringMatch[1];
          
          // Skip if it's an exception
          if (isException(stringContent)) {
            return;
          }
          
          // Skip very short strings or single characters
          if (stringContent.length < 3) {
            return;
          }
          
          findings.hardcodedStrings.push({
            file: relativeFile,
            string: stringContent,
            context: match.trim(),
            line: content.substring(0, content.indexOf(match)).split('\n').length
          });
          
          findings.files.add(relativeFile);
          findings.totalStrings++;
        }
      });
    });
  } catch (error) {
    console.warn(`⚠️  Warning: Could not scan ${filePath}: ${error.message}`);
  }
}

function scanDirectory(dir) {
  try {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      // Skip excluded patterns
      if (EXCLUDE_PATTERNS.some(pattern => fullPath.includes(pattern))) {
        return;
      }
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile() && EXTENSIONS.some(ext => item.endsWith(ext))) {
        scanFile(fullPath);
      }
    });
  } catch (error) {
    console.warn(`⚠️  Warning: Could not scan directory ${dir}: ${error.message}`);
  }
}

// Scan all directories
console.log('🔍 Scanning directories:', SCAN_DIRS.join(', '));
SCAN_DIRS.forEach(dir => {
  if (fs.existsSync(dir)) {
    scanDirectory(dir);
  } else {
    console.warn(`⚠️  Directory not found: ${dir}`);
  }
});

console.log('\n📊 I18N AUDIT RESULTS');
console.log('='.repeat(50));
console.log(`Total hardcoded strings found: ${findings.totalStrings}`);
console.log(`Files affected: ${findings.files.size}`);

if (findings.totalStrings > 0) {
  console.log('\n🚨 CRITICAL ISSUES FOUND:\n');
  
  // Group by file
  const byFile = {};
  findings.hardcodedStrings.forEach(finding => {
    if (!byFile[finding.file]) {
      byFile[finding.file] = [];
    }
    byFile[finding.file].push(finding);
  });
  
  Object.keys(byFile).sort().forEach(file => {
    console.log(`📄 ${file}:`);
    byFile[file].forEach(finding => {
      console.log(`   Line ${finding.line}: "${finding.string}"`);
      console.log(`   Context: ${finding.context}`);
      console.log();
    });
  });
  
  console.log('🎯 NEXT STEPS:');
  console.log('1. Replace hardcoded strings with useTranslation() hooks');
  console.log('2. Add missing keys to locales/en/common.json');
  console.log('3. Translate all keys to: af, zu, st, es, fr, pt, de');
  console.log('4. Test language switching end-to-end');
  console.log('\n💡 Example fix:');
  console.log('  BEFORE: <Text>Plans & Pricing</Text>');
  console.log('  AFTER:  <Text>{t(\"pricing.title\")}</Text>');
  
} else {
  console.log('\n✅ No hardcoded strings found! I18N audit passed.');
}

console.log('\n📋 COMPLIANCE CHECK:');
console.log('- ✅ WARP.md Golden Rule: Multi-language support for global education');
console.log('- ✅ Implementation Plan Phase 1: I18N audit requirement');
console.log(`- ${findings.totalStrings === 0 ? '✅' : '❌'} Zero hardcoded strings in codebase`);

process.exit(findings.totalStrings > 0 ? 1 : 0);