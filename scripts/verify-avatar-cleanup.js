#!/usr/bin/env node

/**
 * Verify Avatar Cleanup Script
 * 
 * This script verifies that the local avatar URI cleanup worked
 * and shows the current state of avatar URLs.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyCleanup() {
  try {
    console.log('✅ Verifying avatar cleanup...\n');

    // Check user metadata
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('❌ Error fetching users:', error.message);
      return;
    }

    console.log(`📊 Checking ${users.length} users for avatar URLs...\n`);

    let usersWithAvatars = 0;
    let localFileCount = 0;
    let validUrlCount = 0;

    users.forEach((user) => {
      const metadata = user.user_metadata || {};
      const avatarUrl = metadata.avatar_url;
      
      if (!avatarUrl) return;
      
      usersWithAvatars++;
      const email = user.email || 'Unknown';
      
      console.log(`• User: ${email}`);
      console.log(`  Avatar URL: ${avatarUrl ? avatarUrl.substring(0, 60) + (avatarUrl.length > 60 ? '...' : '') : 'None'}`);
      
      if (avatarUrl && (avatarUrl.startsWith('file:') || avatarUrl.startsWith('blob:') || avatarUrl.includes('/cache/') || avatarUrl.includes('ImageManipulator'))) {
        console.log('  ⚠️ STILL HAS LOCAL URI - CLEANUP NEEDED');
        localFileCount++;
      } else if (avatarUrl) {
        console.log('  ✅ Valid URL');
        validUrlCount++;
      }
      console.log('');
    });

    console.log('📈 Verification Summary:');
    console.log(`   Total users: ${users.length}`);
    console.log(`   Users with avatars: ${usersWithAvatars}`);
    console.log(`   Local file URIs: ${localFileCount} ${localFileCount > 0 ? '⚠️' : '✅'}`);
    console.log(`   Valid URLs: ${validUrlCount} ✅`);
    console.log(`   Users without avatars: ${users.length - usersWithAvatars}`);

    if (localFileCount === 0) {
      console.log('\n🎉 All avatar URLs are now clean!');
      console.log('✅ The "Not allowed to load local resource" error should be resolved.');
    } else {
      console.log('\n⚠️ Some local file URIs still exist. Re-run the cleanup script.');
    }

  } catch (error) {
    console.error('❌ Verification error:', error);
  }
}

verifyCleanup();