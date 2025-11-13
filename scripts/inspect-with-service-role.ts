/**
 * Enhanced Database Inspection with Service Role
 * 
 * This script performs a comprehensive inspection of the remote Supabase database
 * using the service role key to bypass RLS and see all data
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Load environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_DB_URL || '';

// Service role will be provided as environment variable or command line argument
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.log('❌ SERVICE_ROLE_KEY is required');
  console.log('Usage: tsx scripts/inspect-with-service-role.ts <SERVICE_ROLE_KEY>');
  console.log('Or set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

// Create service role client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
if (!SUPABASE_URL) {
  console.error('Missing SUPABASE URL env');
  process.exit(1);
}

interface InspectionReport {
  timestamp: string;
  counts: Record<string, number>;
  samples: Record<string, any[]>;
  rlsPolicies: any[];
  schema: any;
  errors: string[];
}

async function getTableCount(tableName: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`⚠️ Error counting ${tableName}:`, error.message);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.log(`❌ Failed to count ${tableName}:`, error);
    return 0;
  }
}

async function getSampleData(tableName: string, limit = 3): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(limit);
    
    if (error) {
      console.log(`⚠️ Error fetching sample ${tableName}:`, error.message);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.log(`❌ Failed to fetch sample ${tableName}:`, error);
    return [];
  }
}

async function getRLSPolicies(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'public');
    
    if (error) {
      console.log('⚠️ Error fetching RLS policies:', error.message);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.log('❌ Failed to fetch RLS policies:', error);
    return [];
  }
}

async function getTableInfo(): Promise<any> {
  try {
    // Get table information from information_schema
    const { data, error } = await supabase
      .rpc('get_table_info', {});
    
    if (error) {
      console.log('⚠️ Error fetching table info:', error.message);
      
      // Fallback: Get basic table list
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE');
        
      if (tablesError) {
        console.log('⚠️ Error fetching table list:', tablesError.message);
        return null;
      }
      
      return { tables: tables?.map(t => t.table_name) || [] };
    }
    
    return data;
  } catch (error) {
    console.log('❌ Failed to fetch table info:', error);
    return null;
  }
}

async function performFullInspection(): Promise<void> {
  console.log('🔍 Starting comprehensive database inspection with service role...');
  console.log(`🔗 Database: ${SUPABASE_URL}`);
  
  const report: InspectionReport = {
    timestamp: new Date().toISOString(),
    counts: {},
    samples: {},
    rlsPolicies: [],
    schema: null,
    errors: []
  };

  // Core tables to inspect
  const coreTables = [
    'preschools',
    'users', 
    'students',
    'classes',
    'assignments',
    'homework_assignments',
    'teachers',
    'parents',
    'activity_feed',
    'classroom_reports',
    'attendance',
    'announcements',
    'ai_usage_logs'
  ];

  console.log('\n📊 Counting records in all tables...');
  for (const table of coreTables) {
    console.log(`  Counting ${table}...`);
    const count = await getTableCount(table);
    report.counts[table] = count;
    console.log(`    ✅ ${table}: ${count} records`);
  }

  console.log('\n📋 Fetching sample data...');
  for (const table of coreTables) {
    if (report.counts[table] > 0) {
      console.log(`  Sampling ${table}...`);
      const samples = await getSampleData(table);
      report.samples[table] = samples;
      console.log(`    ✅ Got ${samples.length} sample records from ${table}`);
    }
  }

  console.log('\n🔒 Inspecting RLS policies...');
  report.rlsPolicies = await getRLSPolicies();
  console.log(`  ✅ Found ${report.rlsPolicies.length} RLS policies`);

  console.log('\n📋 Getting schema information...');
  report.schema = await getTableInfo();

  // Generate detailed report
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE DATABASE INSPECTION REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n🕐 Timestamp: ${report.timestamp}`);
  
  console.log('\n📈 Record Counts:');
  Object.entries(report.counts).forEach(([table, count]) => {
    const icon = count > 0 ? '✅' : '⚪';
    console.log(`  ${icon} ${table}: ${count} records`);
  });

  const totalRecords = Object.values(report.counts).reduce((sum, count) => sum + count, 0);
  console.log(`\n📊 Total Records: ${totalRecords}`);

  if (report.rlsPolicies.length > 0) {
    console.log('\n🔒 Active RLS Policies:');
    const policiesByTable = report.rlsPolicies.reduce((acc, policy) => {
      if (!acc[policy.tablename]) acc[policy.tablename] = [];
      acc[policy.tablename].push(policy.policyname);
      return acc;
    }, {} as Record<string, string[]>);
    
    Object.entries(policiesByTable).forEach(([table, policies]) => {
      console.log(`  🛡️ ${table}: ${policies.length} policies`);
      policies.forEach(policy => console.log(`    - ${policy}`));
    });
  } else {
    console.log('\n⚠️ No RLS policies found - Database may be unprotected!');
  }

  console.log('\n🏫 Sample Data Summary:');
  Object.entries(report.samples).forEach(([table, samples]) => {
    if (samples.length > 0) {
      console.log(`\n  📋 ${table} (showing ${samples.length} records):`);
      samples.forEach((record, index) => {
        const key = record.id || record.name || record.email || Object.keys(record)[0];
        const value = record.id || record.name || record.email || Object.values(record)[0];
        console.log(`    ${index + 1}. ${key}: ${value}`);
      });
    }
  });

  // Identify data relationships
  console.log('\n🔗 Data Relationships:');
  if (report.counts.preschools > 0 && report.counts.users > 0) {
    const preschools = report.samples.preschools || [];
    const users = report.samples.users || [];
    
    console.log(`  • ${report.counts.preschools} preschool(s) with ${report.counts.users} total users`);
    
    if (users.length > 0) {
      const roleStats = users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(roleStats).forEach(([role, count]) => {
        console.log(`    - ${role}: ${count} users (in sample)`);
      });
    }
  }

  // Save detailed report
  const reportPath = `database-inspection-detailed-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n='.repeat(80));
  console.log(`📄 Detailed report saved to: ${reportPath}`);
  console.log('\nNext steps based on findings:');
  
  if (totalRecords === 0) {
    console.log('  🆕 Database appears empty - ready for fresh setup');
  } else {
    console.log(`  📊 Found ${totalRecords} existing records`);
    console.log('  🔧 Will need to create RLS policies that work with existing data');
  }
  
  if (report.rlsPolicies.length === 0) {
    console.log('  ⚠️ URGENT: No RLS policies detected - database is unprotected!');
  } else {
    console.log(`  🛡️ Found ${report.rlsPolicies.length} existing RLS policies`);
  }
}

// Run the inspection
if (require.main === module) {
  performFullInspection().catch(error => {
    console.error('💥 Inspection failed:', error);
    process.exit(1);
  });
}

export { performFullInspection };