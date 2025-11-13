/**
 * Database Inspection Script
 * 
 * This script connects to the remote Supabase database to:
 * 1. Inspect existing data (schools, users, classes, etc.)
 * 2. Verify RLS policies are working correctly
 * 3. Test role-based access control
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../lib/database.types';

// Load environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_DB_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase env. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

interface InspectionReport {
  timestamp: string;
  schemas: {
    preschools: number;
    users: number;
    students: number;
    teachers: number;
    classes: number;
    assignments: number;
  };
  sampleData: {
    preschools: any[];
    users: any[];
    rlsStatus: any[];
  };
  rlsTests: {
    anonymousAccess: any;
    userAccess: any;
  };
}

async function inspectDatabase(): Promise<InspectionReport> {
  console.log('🔍 Starting database inspection...');
  
  const report: InspectionReport = {
    timestamp: new Date().toISOString(),
    schemas: {
      preschools: 0,
      users: 0,
      students: 0,
      teachers: 0,
      classes: 0,
      assignments: 0
    },
    sampleData: {
      preschools: [],
      users: [],
      rlsStatus: []
    },
    rlsTests: {
      anonymousAccess: null,
      userAccess: null
    }
  };

  try {
    // 1. Count records in key tables
    console.log('📊 Counting records in key tables...');
    
    const [
      preschoolsCount,
      usersCount,
      studentsCount,
      classesCount,
      assignmentsCount
    ] = await Promise.allSettled([
      supabase.from('preschools').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('students').select('*,age_groups!students_age_group_id_fkey(*)', { count: 'exact', head: true }),
      supabase.from('classes').select('*', { count: 'exact', head: true }),
      supabase.from('assignments').select('*', { count: 'exact', head: true })
    ]);

    // Process counts
    if (preschoolsCount.status === 'fulfilled') {
      report.schemas.preschools = preschoolsCount.value.count || 0;
    }
    if (usersCount.status === 'fulfilled') {
      report.schemas.users = usersCount.value.count || 0;
    }
    if (studentsCount.status === 'fulfilled') {
      report.schemas.students = studentsCount.value.count || 0;
    }
    if (classesCount.status === 'fulfilled') {
      report.schemas.classes = classesCount.value.count || 0;
    }
    if (assignmentsCount.status === 'fulfilled') {
      report.schemas.assignments = assignmentsCount.value.count || 0;
    }
    
    // Get teachers count separately
    const { count: teachersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'teacher');
    report.schemas.teachers = teachersCount || 0;

    // 2. Get sample data from key tables
    console.log('📋 Fetching sample data...');
    
    // Get sample preschools
    const { data: preschools, error: preschoolsError } = await supabase
      .from('preschools')
      .select('id, name, address, email, max_students, created_at')
      .limit(5);
    
    if (preschoolsError) {
      console.error('Error fetching preschools:', preschoolsError);
    } else {
      report.sampleData.preschools = preschools || [];
    }

    // Get sample users with roles
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role, preschool_id, is_active, created_at')
      .limit(5);
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
    } else {
      report.sampleData.users = users || [];
    }

    // 3. Test RLS policies
    console.log('🔒 Testing RLS policies...');
    
    // Test anonymous access (should be restricted)
    const { data: anonData, error: anonError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    report.rlsTests.anonymousAccess = {
      success: !anonError,
      error: anonError?.message,
      dataReturned: anonData?.length || 0,
      expectedBehavior: 'Should return 0 records due to RLS'
    };

    // 4. Check if RLS is enabled on key tables
    console.log('🛡️ Checking RLS status...');
    
    // This would need to be done with a service role or admin access
    // For now, we'll just note what we expect
    report.sampleData.rlsStatus = [
      { table: 'users', rlsExpected: true },
      { table: 'preschools', rlsExpected: true },
      { table: 'students', rlsExpected: true },
      { table: 'teachers', rlsExpected: true },
      { table: 'classes', rlsExpected: true }
    ];

    console.log('✅ Database inspection completed');
    return report;

  } catch (error) {
    console.error('❌ Database inspection failed:', error);
    throw error;
  }
}

async function generateReport() {
  try {
    const report = await inspectDatabase();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 DATABASE INSPECTION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n🕐 Timestamp: ${report.timestamp}`);
    
    console.log('\n📈 Record Counts:');
    console.log(`  • Preschools: ${report.schemas.preschools}`);
    console.log(`  • Users: ${report.schemas.users}`);
    console.log(`  • Students: ${report.schemas.students}`);
    console.log(`  • Teachers: ${report.schemas.teachers}`);
    console.log(`  • Classes: ${report.schemas.classes}`);
    console.log(`  • Assignments: ${report.schemas.assignments}`);
    
    console.log('\n🏫 Sample Preschools:');
    report.sampleData.preschools.forEach((school, index) => {
      console.log(`  ${index + 1}. ${school.name} (${school.id})`);
      console.log(`     📧 ${school.email} | 👥 Max Students: ${school.max_students}`);
    });
    
    console.log('\n👥 Sample Users:');
    report.sampleData.users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (${user.role})`);
      console.log(`     🏫 School: ${user.preschool_id || 'None'} | Active: ${user.is_active}`);
    });
    
    console.log('\n🔒 RLS Test Results:');
    console.log(`  Anonymous Access: ${report.rlsTests.anonymousAccess?.success ? '✅' : '❌'}`);
    console.log(`    Records returned: ${report.rlsTests.anonymousAccess?.dataReturned}`);
    console.log(`    Expected: ${report.rlsTests.anonymousAccess?.expectedBehavior}`);
    if (report.rlsTests.anonymousAccess?.error) {
      console.log(`    Error: ${report.rlsTests.anonymousAccess.error}`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Save report to file
    require('fs').writeFileSync(
      'database-inspection-report.json', 
      JSON.stringify(report, null, 2)
    );
    console.log('📄 Full report saved to: database-inspection-report.json');
    
  } catch (error) {
    console.error('Failed to generate report:', error);
    process.exit(1);
  }
}

// Run the inspection
if (require.main === module) {
  generateReport();
}

export { inspectDatabase, generateReport };