#!/usr/bin/env tsx
/**
 * Development utility to check and fix user roles
 * Run with: npx tsx scripts/fix-user-role.ts [email]
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:');
  console.error('- EXPO_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error('Usage: npx tsx scripts/fix-user-role.ts [email]');
    console.error('Example: npx tsx scripts/fix-user-role.ts admin@example.com');
    process.exit(1);
  }

  console.log(`🔍 Looking for user: ${email}`);
  
  try {
    // Find user by email
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError.message);
      process.exit(1);
    }

    const user = authUsers.users.find(u => u.email === email);
    
    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.id}`);
    
    // Check current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Error fetching profile:', profileError.message);
      process.exit(1);
    }

    console.log('📋 Current profile:');
    console.log(`   ID: ${profile.id}`);
    console.log(`   Email: ${profile.email}`);
    console.log(`   Role: ${profile.role}`);
    console.log(`   Organization ID: ${profile.organization_id}`);
    console.log(`   Created: ${profile.created_at}`);

    // Update to super_admin role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        role: 'super_admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error updating profile:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Successfully updated user role to super_admin');
    
    // Verify the update
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log(`✅ Verified - New role: ${updatedProfile?.role}`);
    console.log('');
    console.log('🎉 User role updated successfully!');
    console.log('📱 Please refresh your browser/app to see the changes.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

main().catch(console.error);