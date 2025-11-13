#!/usr/bin/env tsx
/**
 * Migrate Legacy Teacher Accounts
 * 
 * Finds teacher profiles that exist but lack organization_members entries,
 * and creates proper membership records with active seats.
 * 
 * This fixes accounts created before the organization_members system was implemented.
 * 
 * Usage: npx tsx scripts/migrate-legacy-teachers.ts [--dry-run] [--org-id=<uuid>]
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

// Use service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const targetOrgId = args.find(a => a.startsWith('--org-id='))?.split('=')[1];

interface LegacyTeacher {
  user_id: string;
  email: string;
  organization_id: string;
  organization_name: string;
  subscription_plan: string;
  has_membership: boolean;
}

async function findLegacyTeachers(): Promise<LegacyTeacher[]> {
  console.log('🔍 Searching for legacy teacher accounts...\n');

  // Query teachers with organization but no membership
  const query = `
    SELECT 
      p.id as user_id,
      p.email,
      p.organization_id,
      o.name as organization_name,
      o.subscription_plan,
      CASE WHEN om.user_id IS NULL THEN false ELSE true END as has_membership
    FROM profiles p
    INNER JOIN organizations o ON p.organization_id = o.id
    LEFT JOIN organization_members om ON p.id = om.user_id AND p.organization_id = om.organization_id
    WHERE p.role = 'teacher'
      AND p.organization_id IS NOT NULL
      ${targetOrgId ? `AND p.organization_id = '${targetOrgId}'` : ''}
      AND om.user_id IS NULL
    ORDER BY o.name, p.email;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });

  if (error) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  }

  return data || [];
}

async function migrateLegacyTeacher(teacher: LegacyTeacher): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('organization_members')
      .insert({
        organization_id: teacher.organization_id,
        user_id: teacher.user_id,
        role: 'teacher',
        seat_status: 'active',
        invited_by: null, // Legacy accounts have unknown inviter
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      return false;
    }

    console.log(`   ✅ Created membership`);
    return true;
  } catch (err: any) {
    console.error(`   ❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🔧 Legacy Teacher Account Migration');
  console.log('='.repeat(60));
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no changes)' : '✍️  WRITE MODE (will modify DB)'}`);
  if (targetOrgId) {
    console.log(`Filter: Organization ID = ${targetOrgId}`);
  }
  console.log('='.repeat(60));
  console.log();

  const legacyTeachers = await findLegacyTeachers();

  if (legacyTeachers.length === 0) {
    console.log('✅ No legacy teacher accounts found. All teachers have proper memberships!');
    return;
  }

  console.log(`📊 Found ${legacyTeachers.length} legacy teacher account(s):\n`);

  // Group by organization
  const byOrg = legacyTeachers.reduce((acc, t) => {
    if (!acc[t.organization_id]) {
      acc[t.organization_id] = {
        name: t.organization_name,
        plan: t.subscription_plan,
        teachers: []
      };
    }
    acc[t.organization_id].teachers.push(t);
    return acc;
  }, {} as Record<string, { name: string; plan: string; teachers: LegacyTeacher[] }>);

  // Display findings
  for (const [orgId, info] of Object.entries(byOrg)) {
    console.log(`📁 ${info.name} (${info.plan} plan)`);
    console.log(`   ID: ${orgId}`);
    console.log(`   Teachers: ${info.teachers.length}`);
    info.teachers.forEach(t => {
      console.log(`   - ${t.email} (${t.user_id})`);
    });
    console.log();
  }

  if (isDryRun) {
    console.log('='.repeat(60));
    console.log('🔍 DRY RUN MODE - No changes made');
    console.log('='.repeat(60));
    console.log('\nTo apply these changes, run without --dry-run flag:');
    console.log('  npx tsx scripts/migrate-legacy-teachers.ts');
    return;
  }

  // Confirm before proceeding
  console.log('='.repeat(60));
  console.log('⚠️  WARNING: About to create organization memberships');
  console.log('='.repeat(60));
  console.log(`This will create ${legacyTeachers.length} organization_members records.`);
  console.log('All legacy teachers will receive active seats.\n');

  // In production, you'd want a confirmation prompt here
  // For now, proceeding automatically after 3 second delay
  console.log('Starting migration in 3 seconds... (Ctrl+C to cancel)');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n🚀 Starting migration...\n');

  let successCount = 0;
  let failCount = 0;

  for (const teacher of legacyTeachers) {
    console.log(`👤 ${teacher.email} (${teacher.organization_name})`);
    const success = await migrateLegacyTeacher(teacher);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Total: ${legacyTeachers.length}`);
  console.log('='.repeat(60));

  if (successCount > 0) {
    console.log('\n✅ Migration complete! Legacy teachers now have proper organization memberships.');
    console.log('\n⚠️  NOTE: Teachers in organizations on "free" tier will still not have AI access.');
    console.log('   Upgrade organization subscription_plan to "pro" or "premium" to enable AI.');
  }
}

main().catch(console.error);
