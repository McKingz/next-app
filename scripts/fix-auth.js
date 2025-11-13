#!/usr/bin/env node

/**
 * Immediate Authentication Fix Script
 * 
 * This script helps fix common authentication issues by clearing
 * corrupted session data and resetting the authentication state.
 * 
 * Run with: npm run fix-auth
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 EduDash Pro Authentication Fix\n');

// Function to clear browser localStorage (for web development)
function clearWebStorage() {
  console.log('1. Clearing web localStorage...');
  
  // Instructions for manual cleanup since we can't access localStorage from Node
  console.log('   Please open your browser console and run:');
  console.log('   ```');
  console.log('   // Clear all Supabase and EduDash auth data');
  console.log('   Object.keys(localStorage)');
  console.log('     .filter(key => key.includes("supabase") || key.includes("edudash") || key.includes("auth"))');
  console.log('     .forEach(key => localStorage.removeItem(key));');
  console.log('   ');
  console.log('   // Verify cleanup');
  console.log('   console.log("Remaining keys:", Object.keys(localStorage));');
  console.log('   ```');
  console.log('   ✓ Then refresh the page\n');
}

// Function to clear Expo/React Native cache
function clearExpoCache() {
  console.log('2. Clearing Expo cache...');
  
  const cacheDirectories = [
    '.expo',
    'node_modules/.cache',
    '.next', // if using Next.js
    'dist',
    'build'
  ];
  
  cacheDirectories.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      console.log(`   Removing ${dir}...`);
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`   ✓ Removed ${dir}`);
      } catch (e) {
        console.log(`   ⚠ Could not remove ${dir}: ${e.message}`);
      }
    } else {
      console.log(`   ○ ${dir} not found (OK)`);
    }
  });
  console.log('');
}

// Function to verify environment setup
function checkEnvironment() {
  console.log('3. Checking environment configuration...');
  
  const envFile = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envFile)) {
    console.log('   ❌ .env file not found');
    return false;
  }
  
  const envContent = fs.readFileSync(envFile, 'utf8');
  const hasUrl = envContent.includes('EXPO_PUBLIC_SUPABASE_URL=');
  const hasKey = envContent.includes('EXPO_PUBLIC_SUPABASE_ANON_KEY=');
  
  console.log(`   EXPO_PUBLIC_SUPABASE_URL: ${hasUrl ? '✓' : '❌'}`);
  console.log(`   EXPO_PUBLIC_SUPABASE_ANON_KEY: ${hasKey ? '✓' : '❌'}`);
  
  if (!hasUrl || !hasKey) {
    console.log('   ⚠ Missing required Supabase environment variables');
    return false;
  }
  
  console.log('   ✓ Environment variables look good\n');
  return true;
}

// Main fix process
async function main() {
  try {
    clearWebStorage();
    clearExpoCache();
    
    const envOk = checkEnvironment();
    
    console.log('4. Restart instructions:');
    console.log('   Run the following commands:');
    console.log('   ```bash');
    console.log('   npm ci                 # Reinstall dependencies');
    console.log('   npm run start:clear    # Start with cleared cache');
    console.log('   ```\n');
    
    console.log('5. Additional troubleshooting:');
    console.log('   If issues persist:');
    console.log('   • Clear browser data completely (Ctrl+Shift+Delete)');
    console.log('   • Try incognito/private browsing mode');
    console.log('   • Check browser console for specific error messages');
    console.log('   • Verify Supabase project is accessible\n');
    
    if (envOk) {
      console.log('✅ Authentication fix complete! Try signing in again.');
    } else {
      console.log('⚠ Please fix environment configuration before proceeding.');
    }
    
  } catch (error) {
    console.error('❌ Fix script failed:', error);
    console.log('\nManual steps:');
    console.log('1. Clear browser localStorage');
    console.log('2. Remove .expo and node_modules/.cache directories');
    console.log('3. Run: npm ci && npm run start:clear');
  }
}

main();