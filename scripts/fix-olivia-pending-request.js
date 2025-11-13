#!/usr/bin/env node

/**
 * Fix Olivia's pending guardian request
 * Updates status from 'pending' to 'approved' since she's already linked
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixOliviaPendingRequest() {
  console.log('🔍 Checking for Olivia\'s guardian request...\n');

  // Find Olivia's student record
  const { data: oliviaStudent, error: studentError } = await supabase
    .from('students')
    .select('id, first_name, last_name, parent_id, preschool_id')
    .ilike('first_name', 'Olivia')
    .ilike('last_name', 'Makunyane')
    .maybeSingle();

  if (studentError) {
    console.error('❌ Error finding Olivia:', studentError);
    return;
  }

  if (!oliviaStudent) {
    console.log('⚠️  Olivia student record not found');
    return;
  }

  console.log('✅ Found Olivia:');
  console.log(`   ID: ${oliviaStudent.id}`);
  console.log(`   Name: ${oliviaStudent.first_name} ${oliviaStudent.last_name}`);
  console.log(`   Parent ID: ${oliviaStudent.parent_id}`);
  console.log(`   Preschool ID: ${oliviaStudent.preschool_id}\n`);

  // Find any pending guardian requests for Olivia
  const { data: pendingRequests, error: requestError } = await supabase
    .from('guardian_requests')
    .select('*')
    .eq('student_id', oliviaStudent.id)
    .eq('status', 'pending');

  if (requestError) {
    console.error('❌ Error finding guardian requests:', requestError);
    return;
  }

  if (!pendingRequests || pendingRequests.length === 0) {
    console.log('✅ No pending requests found for Olivia - all clean!\n');
    return;
  }

  console.log(`⚠️  Found ${pendingRequests.length} pending request(s) for Olivia:\n`);

  for (const request of pendingRequests) {
    console.log(`   Request ID: ${request.id}`);
    console.log(`   Parent Auth ID: ${request.parent_auth_id}`);
    console.log(`   Child Name: ${request.child_full_name}`);
    console.log(`   Created: ${request.created_at}`);
    console.log(`   Status: ${request.status}\n`);

    // Check if this parent is already linked to Olivia
    if (oliviaStudent.parent_id === request.parent_auth_id) {
      console.log('   ✅ Parent is already linked to student - updating status to approved...\n');

      const { error: updateError } = await supabase
        .from('guardian_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('   ❌ Error updating request:', updateError);
      } else {
        console.log('   ✅ Successfully updated request status to approved!\n');
      }
    } else {
      console.log(`   ⚠️  Parent not linked yet (student parent_id: ${oliviaStudent.parent_id}, request parent: ${request.parent_auth_id})\n`);
    }
  }

  // Verify the fix
  const { data: remainingPending, error: verifyError } = await supabase
    .from('guardian_requests')
    .select('id')
    .eq('student_id', oliviaStudent.id)
    .eq('status', 'pending');

  if (verifyError) {
    console.error('❌ Error verifying fix:', verifyError);
    return;
  }

  if (!remainingPending || remainingPending.length === 0) {
    console.log('✅ SUCCESS: No more pending requests for Olivia!\n');
  } else {
    console.log(`⚠️  Still ${remainingPending.length} pending request(s) remaining\n`);
  }
}

// Run the fix
fixOliviaPendingRequest()
  .then(() => {
    console.log('✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
