#!/usr/bin/env tsx
/**
 * Fix Young Eagles Teacher AI Access
 * 
 * Upgrades organization to Pro plan and ensures teacher has active membership
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ORG_ID = 'bd5fe69c-8bee-445d-811d-a6db37f0e49b';
const TEACHER_ID = 'd699bb7d-7b9e-4a2f-9bf3-72e2d1fe7e64';

async function main() {
  console.log('🔧 Fixing Young Eagles Teacher AI Access\n');
  console.log('='.repeat(60));

  // Step 1: Upgrade organization to Pro
  console.log('\n📈 Step 1: Upgrading organization to Pro plan...');
  const { data: orgUpdate, error: orgError } = await supabase
    .from('organizations')
    .update({ plan_tier: 'pro' })
    .eq('id', ORG_ID)
    .select('id, name, plan_tier')
    .single();

  if (orgError) {
    console.error('❌ Failed to upgrade organization:', orgError.message);
    process.exit(1);
  }

  console.log('✅ Organization upgraded successfully');
  console.log(`   Name: ${orgUpdate.name}`);
  console.log(`   Plan: ${orgUpdate.plan_tier}`);

  // Step 2: Check if membership exists
  console.log('\n👤 Step 2: Checking teacher membership...');
  const { data: existingMember, error: checkError } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', ORG_ID)
    .eq('user_id', TEACHER_ID)
    .maybeSingle();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error('❌ Error checking membership:', checkError.message);
    process.exit(1);
  }

  if (existingMember) {
    console.log('ℹ️  Membership already exists');
    
    // Update to active if not already
    if (existingMember.seat_status !== 'active') {
      console.log('   Updating seat status to active...');
      const { error: updateError } = await supabase
        .from('organization_members')
        .update({ seat_status: 'active' })
        .eq('id', existingMember.id);

      if (updateError) {
        console.error('❌ Failed to update seat status:', updateError.message);
      } else {
        console.log('✅ Seat status updated to active');
      }
    } else {
      console.log('✅ Seat status is already active');
    }
  } else {
    // Create new membership
    console.log('   Creating new membership...');
    
    // Find principal to set as inviter
    const { data: principal } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', ORG_ID)
      .eq('role', 'principal')
      .maybeSingle();

    const { error: insertError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: ORG_ID,
        user_id: TEACHER_ID,
        role: 'teacher',
        seat_status: 'active',
        invited_by: principal?.id || null,
      });

    if (insertError) {
      console.error('❌ Failed to create membership:', insertError.message);
      process.exit(1);
    }

    console.log('✅ Membership created successfully');
  }

  // Step 3: Verify the fix
  console.log('\n🔍 Step 3: Verifying changes...');
  const { data: verification, error: verifyError } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      role,
      organization_id,
      organizations!inner(
        id,
        name,
        plan_tier
      ),
      organization_members!inner(
        role,
        seat_status
      )
    `)
    .eq('id', TEACHER_ID)
    .single();

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
    process.exit(1);
  }

  console.log('✅ Verification successful\n');
  console.log('Teacher Details:');
  console.log(`   Email: ${verification.email}`);
  console.log(`   Role: ${verification.role}`);
  console.log(`   Organization: ${(verification.organizations as any).name}`);
  console.log(`   Plan Tier: ${(verification.organizations as any).plan_tier}`);
  console.log(`   Seat Status: ${(verification.organization_members as any)[0].seat_status}`);

  // Check AI capability
  const hasPaidPlan = ['premium', 'pro', 'enterprise'].includes(
    (verification.organizations as any).plan_tier
  );
  const hasActiveSeat = (verification.organization_members as any)[0].seat_status === 'active';
  const hasAI = hasPaidPlan && hasActiveSeat;

  console.log('\n🤖 AI Capability Status:');
  console.log(`   Has Paid Plan: ${hasPaidPlan ? '✅' : '❌'}`);
  console.log(`   Has Active Seat: ${hasActiveSeat ? '✅' : '❌'}`);
  console.log(`   AI Access: ${hasAI ? '✅ GRANTED' : '❌ DENIED'}`);

  if (hasAI) {
    console.log('\n🎉 Success! Teacher now has AI access.');
  } else {
    console.log('\n⚠️  Warning: Teacher still does not have AI access.');
    console.log('   Please check the RBAC logic and capability granting.');
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
