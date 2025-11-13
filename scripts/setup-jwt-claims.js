#!/usr/bin/env node

/**
 * JWT Claims Setup Script
 * 
 * This script helps set up JWT claims with preschool_id for RLS policies.
 * Run with: node scripts/setup-jwt-claims.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

// Use service role if available, otherwise anon key
const supabaseKey = supabaseServiceKey || supabaseAnonKey;
if (!supabaseKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupJWTClaims() {
  console.log('🔧 Setting up JWT Claims for preschool_id...\n');

  try {
    // Test if the migration functions exist
    console.log('1. Testing custom_access_token_hook function...');
    
    const { data: hookTest, error: hookError } = await supabase
      .rpc('custom_access_token_hook', {
        event: {
          user_id: '00000000-0000-0000-0000-000000000000',
          claims: {}
        }
      });

    if (hookError) {
      console.log('   ⚠️  Hook function not found or accessible');
      console.log('   📝 Please run the migration first:');
      console.log('      npx supabase db push');
      console.log('   or apply the SQL migration manually in Supabase Dashboard\n');
    } else {
      console.log('   ✅ Hook function exists and is callable\n');
    }

    // Test the current_preschool_id function
    console.log('2. Testing current_preschool_id function...');
    
    const { data: preschoolTest, error: preschoolError } = await supabase
      .rpc('current_preschool_id');

    if (preschoolError) {
      console.log('   ⚠️  Function error:', preschoolError.message);
    } else {
      console.log('   ✅ Function exists, returned:', preschoolTest || 'null (expected without auth)');
    }

    console.log('\n3. Testing test_jwt_claims function...');
    
    const { data: testClaims, error: testError } = await supabase
      .rpc('test_jwt_claims');

    if (testError) {
      console.log('   ⚠️  Test function error:', testError.message);
    } else {
      console.log('   ✅ Test function exists');
      if (testClaims && testClaims.length > 0) {
        console.log('   📊 Test results:', testClaims[0]);
      }
    }

    // Check for users with preschool_id
    console.log('\n4. Checking users with preschool_id...');
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, preschool_id, role, email')
      .not('preschool_id', 'is', null)
      .limit(3);

    if (usersError) {
      console.log('   ⚠️  Error fetching users:', usersError.message);
    } else if (users && users.length > 0) {
      console.log(`   ✅ Found ${users.length} users with preschool_id:`);
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email || 'No email'} (${user.role})`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Preschool: ${user.preschool_id}`);
      });
    } else {
      console.log('   ⚠️  No users found with preschool_id');
      console.log('   💡 You may need to update user records or create test users');
    }

  } catch (error) {
    console.error('💥 Setup failed:', error.message);
  }

  // Instructions for enabling the hook
  console.log('\n' + '='.repeat(70));
  console.log('📋 NEXT STEPS TO ENABLE JWT CLAIMS');
  console.log('='.repeat(70));
  
  console.log('\n🎯 The JWT claims hook function is created, but needs to be enabled.');
  console.log('   Choose ONE of the following methods:\n');
  
  console.log('📌 METHOD 1: Supabase Dashboard (Recommended)');
  console.log('   1. Go to: https://supabase.com/dashboard');
  console.log('   2. Select your project');
  console.log('   3. Navigate to: Authentication > Hooks');
  console.log('   4. Click "Add Hook"');
  console.log('   5. Configure:');
  console.log('      - Hook Name: custom_access_token_hook');
  console.log('      - Type: Custom Access Token');
  console.log('      - Function: public.custom_access_token_hook');
  console.log('      - Secrets: (leave empty)');
  console.log('   6. Click "Save"\n');
  
  console.log('📌 METHOD 2: Supabase CLI');
  console.log('   1. Install Supabase CLI if not already installed');
  console.log('   2. Login: supabase login');
  console.log('   3. Get your project ref from the dashboard URL');
  console.log('   4. Run:');
  console.log('      supabase secrets set --project-ref YOUR_PROJECT_REF \\');
  console.log('        AUTH_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/public/custom_access_token_hook');
  console.log('\n📌 METHOD 3: REST API (Advanced)');
  console.log('   Use the Supabase Management API to enable the hook programmatically\n');
  
  console.log('🧪 TESTING THE SETUP');
  console.log('   After enabling the hook:');
  console.log('   1. Sign out of the app completely');
  console.log('   2. Sign back in');
  console.log('   3. Check JWT token contains preschool_id');
  console.log('   4. Test lessons queries work\n');
  
  console.log('🔍 DEBUGGING JWT CLAIMS');
  console.log('   You can test JWT claims with this query in SQL Editor:');
  console.log('   SELECT * FROM test_jwt_claims();\n');
  
  console.log('📝 TROUBLESHOOTING');
  console.log('   - Ensure users have valid preschool_id values');
  console.log('   - Clear app storage/cache after enabling hook'); 
  console.log('   - Check Supabase logs for hook execution');
  console.log('   - Use service role key for testing if needed\n');
}

// Run the setup
setupJWTClaims().then(() => {
  console.log('🏁 JWT Claims setup check complete!');
}).catch((error) => {
  console.error('💥 Setup check failed:', error);
  process.exit(1);
});