#!/usr/bin/env tsx

/**
 * Teacher Seat Backfill Script
 * 
 * This script backfills teacher seats for existing teachers up to their plan capacity.
 * It's designed as a one-off admin operation with extensive safety guards.
 * 
 * SAFETY FEATURES:
 * - Dry-run mode by default
 * - Plan capacity limits enforced
 * - Multi-school support with isolation
 * - Comprehensive logging and rollback tracking
 * - Manual confirmation required for production execution
 * 
 * Usage:
 *   npm run tsx scripts/backfill/backfill_teacher_seats.ts --dry-run
 *   npm run tsx scripts/backfill/backfill_teacher_seats.ts --execute --school=<school_id>
 *   npm run tsx scripts/backfill/backfill_teacher_seats.ts --execute --all-schools --confirm
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import { format } from 'date-fns';

// Configuration
interface BackfillConfig {
  dryRun: boolean;
  schoolId?: string;
  allSchools: boolean;
  requireConfirmation: boolean;
  maxSeatsPerSchool: number;
  batchSize: number;
}

interface TeacherProfile {
  id: string;
  email: string;
  name: string;
  preschool_id: string;
  created_at: string;
  last_sign_in_at?: string;
}

interface SchoolInfo {
  id: string;
  name: string;
  plan_name: string;
  seat_limit: number | null;
  active_seats: number;
  available_seats: number | null;
  eligible_teachers: TeacherProfile[];
}

interface BackfillResult {
  school_id: string;
  teacher_id: string;
  teacher_email: string;
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
  seat_id?: string;
}

// Environment setup
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nSet SUPABASE_SERVICE_ROLE_KEY as environment variable or pass as argument');
  process.exit(1);
}

// Create service role client (bypasses RLS for admin operations)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Parse command line arguments
function parseArgs(): BackfillConfig {
  const args = process.argv.slice(2);
  
  const config: BackfillConfig = {
    dryRun: true,
    allSchools: false,
    requireConfirmation: true,
    maxSeatsPerSchool: 100, // Safety limit
    batchSize: 10
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--execute') {
      config.dryRun = false;
    } else if (arg.startsWith('--school=')) {
      config.schoolId = arg.split('=')[1];
    } else if (arg === '--all-schools') {
      config.allSchools = true;
    } else if (arg === '--confirm') {
      config.requireConfirmation = false;
    } else if (arg.startsWith('--max-seats=')) {
      config.maxSeatsPerSchool = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1]);
    }
  }

  return config;
}

// Get user confirmation for production execution
async function getUserConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (type 'YES' to confirm): `, (answer) => {
      rl.close();
      resolve(answer === 'YES');
    });
  });
}

// Fetch school information with current seat usage
async function getSchoolInfo(schoolId?: string): Promise<SchoolInfo[]> {
  console.log('📊 Fetching school information...');
  
  let query = supabase
    .from('preschools')
    .select(`
      id,
      name,
      subscriptions!inner(
        plan_id,
        status,
        subscription_plans!inner(
          name,
          teacher_seat_limit
        )
      )
    `)
    .eq('subscriptions.status', 'active');

  if (schoolId) {
    query = query.eq('id', schoolId);
  }

  const { data: schools, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch schools: ${error.message}`);
  }

  if (!schools || schools.length === 0) {
    throw new Error('No active schools found');
  }

  const schoolInfo: SchoolInfo[] = [];

  for (const school of schools) {
    // Get current seat usage
    const { data: seatCount } = await supabase.rpc('rpc_teacher_seat_limits', {}, {
      headers: { 'x-school-id': school.id }
    });

    // Get eligible teachers (teachers without active seats)
    const { data: teachers, error: teachersError } = await supabase
      .from('profiles')
      .select('id, email, name, preschool_id, created_at, last_sign_in_at')
      .eq('preschool_id', school.id)
      .eq('role', 'teacher')
      .eq('is_active', true);

    if (teachersError) {
      console.warn(`⚠️ Failed to fetch teachers for school ${school.name}: ${teachersError.message}`);
      continue;
    }

    // Filter out teachers who already have active seats
    const { data: existingSeats } = await supabase
      .from('subscription_seats')
      .select('teacher_user_id')
      .eq('preschool_id', school.id)
      .is('revoked_at', null);

    const existingTeacherIds = new Set(existingSeats?.map(seat => seat.teacher_user_id) || []);
    const eligibleTeachers = teachers?.filter(teacher => 
      !existingTeacherIds.has(teacher.id)
    ) || [];

    const subscription = school.subscriptions[0];
    const plan = subscription.subscription_plans;
    
    schoolInfo.push({
      id: school.id,
      name: school.name,
      plan_name: plan.name,
      seat_limit: plan.teacher_seat_limit,
      active_seats: seatCount?.used || 0,
      available_seats: plan.teacher_seat_limit ? Math.max(0, plan.teacher_seat_limit - (seatCount?.used || 0)) : null,
      eligible_teachers: eligibleTeachers.sort((a, b) => {
        // Prioritize by last sign-in (most active first), then by creation date
        if (a.last_sign_in_at && b.last_sign_in_at) {
          return new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime();
        }
        if (a.last_sign_in_at && !b.last_sign_in_at) return -1;
        if (!a.last_sign_in_at && b.last_sign_in_at) return 1;
        
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      })
    });
  }

  return schoolInfo;
}

// Assign seat using the RPC function
async function assignTeacherSeat(teacherId: string, schoolId: string): Promise<{ success: boolean; seatId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('rpc_assign_teacher_seat', {
      target_user_id: teacherId
    }, {
      headers: { 'x-school-id': schoolId }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.status === 'assigned') {
      // Get the seat ID for tracking
      const { data: seat } = await supabase
        .from('subscription_seats')
        .select('id')
        .eq('teacher_user_id', teacherId)
        .eq('preschool_id', schoolId)
        .is('revoked_at', null)
        .single();

      return { success: true, seatId: seat?.id };
    }

    return { success: false, error: `Unexpected status: ${data?.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// Execute backfill for a single school
async function backfillSchool(school: SchoolInfo, config: BackfillConfig): Promise<BackfillResult[]> {
  const results: BackfillResult[] = [];
  
  console.log(`\n🏫 Processing school: ${school.name}`);
  console.log(`   Plan: ${school.plan_name}`);
  console.log(`   Seat limit: ${school.seat_limit === null ? 'unlimited' : school.seat_limit}`);
  console.log(`   Currently used: ${school.active_seats}`);
  console.log(`   Available seats: ${school.available_seats === null ? 'unlimited' : school.available_seats}`);
  console.log(`   Eligible teachers: ${school.eligible_teachers.length}`);

  if (school.available_seats === 0) {
    console.log('   ✅ School is already at capacity - skipping');
    return results;
  }

  const teachersToAssign = school.eligible_teachers.slice(
    0, 
    school.available_seats === null 
      ? Math.min(school.eligible_teachers.length, config.maxSeatsPerSchool)
      : school.available_seats
  );

  console.log(`   🎯 Will assign seats to ${teachersToAssign.length} teachers`);

  for (let i = 0; i < teachersToAssign.length; i += config.batchSize) {
    const batch = teachersToAssign.slice(i, i + config.batchSize);
    console.log(`\n   📦 Processing batch ${Math.floor(i / config.batchSize) + 1} (${batch.length} teachers)`);

    for (const teacher of batch) {
      const result: BackfillResult = {
        school_id: school.id,
        teacher_id: teacher.id,
        teacher_email: teacher.email,
        status: 'skipped'
      };

      if (config.dryRun) {
        result.status = 'skipped';
        result.reason = 'Dry run mode';
        console.log(`     🔍 [DRY RUN] Would assign seat to ${teacher.name} (${teacher.email})`);
      } else {
        console.log(`     👤 Assigning seat to ${teacher.name} (${teacher.email})...`);
        
        const assignment = await assignTeacherSeat(teacher.id, school.id);
        
        if (assignment.success) {
          result.status = 'success';
          result.seat_id = assignment.seatId;
          console.log(`     ✅ Successfully assigned seat (ID: ${assignment.seatId})`);
        } else {
          result.status = 'failed';
          result.reason = assignment.error;
          console.log(`     ❌ Failed to assign seat: ${assignment.error}`);
        }
      }

      results.push(result);
      
      // Small delay between assignments to be respectful to the database
      if (!config.dryRun) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  return results;
}

// Generate report
function generateReport(results: BackfillResult[], config: BackfillConfig): void {
  const timestamp = format(new Date(), 'yyyy-MM-dd-HH-mm-ss');
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEACHER SEAT BACKFILL REPORT');
  console.log('='.repeat(80));
  console.log(`Execution Mode: ${config.dryRun ? 'DRY RUN' : 'PRODUCTION'}`);
  console.log(`Timestamp: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`);
  
  const summary = {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length
  };

  console.log(`\nSummary:`);
  console.log(`  Total teachers processed: ${summary.total}`);
  console.log(`  Successfully assigned: ${summary.success}`);
  console.log(`  Failed assignments: ${summary.failed}`);
  console.log(`  Skipped: ${summary.skipped}`);

  if (summary.failed > 0) {
    console.log(`\n❌ Failed Assignments:`);
    results
      .filter(r => r.status === 'failed')
      .forEach(r => {
        console.log(`  - ${r.teacher_email} (School: ${r.school_id}): ${r.reason}`);
      });
  }

  if (!config.dryRun && summary.success > 0) {
    console.log(`\n✅ Successfully assigned seats:`);
    results
      .filter(r => r.status === 'success')
      .forEach(r => {
        console.log(`  - ${r.teacher_email} → Seat ID: ${r.seat_id}`);
      });
  }

  // Save detailed report to file
  const reportData = {
    timestamp,
    config,
    summary,
    results
  };

  const fs = require('fs');
  const reportPath = `./backfill-report-${timestamp}.json`;
  
  try {
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  } catch (err) {
    console.warn(`⚠️ Failed to save report: ${err}`);
  }
}

// Main execution function
async function main(): Promise<void> {
  const config = parseArgs();
  
  console.log('🚀 Teacher Seat Backfill Script');
  console.log('================================');
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'PRODUCTION EXECUTION'}`);
  console.log(`Target: ${config.schoolId ? `School ${config.schoolId}` : 'All schools'}`);
  console.log(`Max seats per school: ${config.maxSeatsPerSchool}`);
  console.log(`Batch size: ${config.batchSize}`);

  // Safety checks for production execution
  if (!config.dryRun) {
    console.log('\n⚠️  PRODUCTION EXECUTION WARNING ⚠️');
    console.log('This will create actual seat assignments in the database.');
    console.log('Make sure you have:');
    console.log('1. Database backup available');
    console.log('2. Approval from product/business team');
    console.log('3. Verified the plan limits are correct');

    if (config.requireConfirmation) {
      const confirmed = await getUserConfirmation('\nProceed with production execution?');
      if (!confirmed) {
        console.log('❌ Execution canceled by user');
        process.exit(0);
      }
    }
  }

  try {
    // Fetch school information
    const schools = await getSchoolInfo(config.schoolId);
    
    if (schools.length === 0) {
      console.log('❌ No eligible schools found');
      process.exit(1);
    }

    console.log(`\n📋 Found ${schools.length} eligible school(s)`);

    // Display preview
    let totalEligible = 0;
    for (const school of schools) {
      totalEligible += Math.min(
        school.eligible_teachers.length,
        school.available_seats === null ? config.maxSeatsPerSchool : school.available_seats
      );
    }

    console.log(`📊 Total eligible teachers for seat assignment: ${totalEligible}`);

    // Final confirmation for large operations
    if (!config.dryRun && totalEligible > 50) {
      const confirmed = await getUserConfirmation(
        `\nThis will assign seats to ${totalEligible} teachers. Continue?`
      );
      if (!confirmed) {
        console.log('❌ Execution canceled by user');
        process.exit(0);
      }
    }

    // Execute backfill
    const allResults: BackfillResult[] = [];
    
    for (const school of schools) {
      const results = await backfillSchool(school, config);
      allResults.push(...results);
    }

    // Generate report
    generateReport(allResults, config);

    console.log('\n✅ Backfill operation completed successfully');

  } catch (error) {
    console.error('\n❌ Backfill operation failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Rollback function (separate script would be better, but included for reference)
async function rollback(reportPath: string): Promise<void> {
  console.log('🔄 Teacher Seat Backfill Rollback');
  console.log('=================================');

  try {
    const fs = require('fs');
    const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    
    const successfulAssignments = reportData.results.filter((r: BackfillResult) => 
      r.status === 'success' && r.seat_id
    );

    console.log(`Found ${successfulAssignments.length} successful assignments to rollback`);

    const confirmed = await getUserConfirmation('Proceed with rollback?');
    if (!confirmed) {
      console.log('❌ Rollback canceled');
      return;
    }

    for (const assignment of successfulAssignments) {
      try {
        const { error } = await supabase.rpc('rpc_revoke_teacher_seat', {
          target_user_id: assignment.teacher_id
        });

        if (error) {
          console.log(`❌ Failed to revoke seat for ${assignment.teacher_email}: ${error.message}`);
        } else {
          console.log(`✅ Revoked seat for ${assignment.teacher_email}`);
        }
      } catch (err) {
        console.log(`❌ Error revoking seat for ${assignment.teacher_email}: ${err}`);
      }
    }

    console.log('\n✅ Rollback completed');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
  }
}

// Check if running rollback
if (process.argv.includes('--rollback')) {
  const reportPath = process.argv[process.argv.indexOf('--rollback') + 1];
  if (!reportPath) {
    console.error('❌ Please provide report file path for rollback');
    console.error('Usage: tsx scripts/backfill/backfill_teacher_seats.ts --rollback <report-file.json>');
    process.exit(1);
  }
  rollback(reportPath);
} else {
  main();
}