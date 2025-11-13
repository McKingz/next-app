#!/usr/bin/env node

/**
 * Working Avatar Cleanup Script
 * 
 * This script successfully removes local file URIs from user metadata
 * by setting avatar_url to null explicitly.
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

async function workingCleanup() {
  try {
    console.log('🧹 Cleaning up local avatar URIs (working version)...\n');

    // Get all users
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('❌ Error fetching users:', error.message);
      return;
    }

    console.log(`📊 Found ${users.length} users, checking for local avatar URIs...\n`);

    const usersToCleanup = [];

    // Find users with local file URIs
    users.forEach((user) => {
      const metadata = user.user_metadata || {};
      const avatarUrl = metadata.avatar_url;
      
      if (avatarUrl && (avatarUrl.startsWith('file:') || avatarUrl.startsWith('blob:') || avatarUrl.includes('/cache/') || avatarUrl.includes('ImageManipulator'))) {
        usersToCleanup.push({
          id: user.id,
          email: user.email || 'Unknown',
          avatarUrl: avatarUrl
        });
      }
    });

    if (usersToCleanup.length === 0) {
      console.log('✅ No users with local avatar URIs found. All clean!');
      return;
    }

    console.log(`🚨 Found ${usersToCleanup.length} users with local avatar URIs:`);
    usersToCleanup.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
    });
    console.log('');

    let cleanupCount = 0;

    // Clean up each user
    for (const user of usersToCleanup) {
      try {
        console.log(`🧹 Cleaning up avatar for ${user.email}...`);
        
        // Get current metadata
        const { data: currentUser, error: getUserError } = await supabase.auth.admin.getUserById(user.id);
        
        if (getUserError) {
          console.error(`   ❌ Error fetching user: ${getUserError.message}`);
          continue;
        }

        // Create new metadata with avatar_url set to null (this removes it)
        const currentMetadata = currentUser.user.user_metadata || {};
        const newMetadata = { 
          ...currentMetadata,
          avatar_url: null  // Setting to null removes it
        };

        // Update the user metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: newMetadata
        });

        if (updateError) {
          console.error(`   ❌ Error updating user: ${updateError.message}`);
          continue;
        }

        // Verify the update worked
        const { data: verifyUser, error: verifyError } = await supabase.auth.admin.getUserById(user.id);
        
        if (!verifyError && !verifyUser.user.user_metadata?.avatar_url) {
          console.log(`   ✅ Successfully cleaned up avatar for ${user.email}`);
          cleanupCount++;
        } else {
          console.log(`   ⚠️ Update may not have worked for ${user.email}`);
        }
        
      } catch (userError) {
        console.error(`   ❌ Unexpected error for user ${user.email}:`, userError);
      }
    }

    console.log(`\n📈 Cleanup Summary:`);
    console.log(`   Users processed: ${usersToCleanup.length}`);
    console.log(`   Successfully cleaned: ${cleanupCount} ✅`);
    console.log(`   Failed: ${usersToCleanup.length - cleanupCount} ${usersToCleanup.length - cleanupCount > 0 ? '❌' : ''}`);

    if (cleanupCount > 0) {
      console.log('\n🎉 Cleanup completed!');
      console.log('ℹ️ Users will need to re-upload their profile pictures.');
      console.log('ℹ️ The "Not allowed to load local resource" error should now be resolved on web.');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

workingCleanup();