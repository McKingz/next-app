/**
 * Database Inspection using Direct SQL
 * 
 * This script uses direct SQL queries to inspect the database
 * when the Supabase client methods don't work with service role
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Load environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_DB_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.log('❌ SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// Create service role client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function runSQL(query: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query });
    
    if (error) {
      console.log(`⚠️ SQL Error: ${error.message}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.log(`❌ Failed to execute SQL: ${error}`);
    return null;
  }
}

async function getTableCounts(): Promise<Record<string, number>> {
  console.log('📊 Getting table counts...');
  
  const tables = [
    'preschools', 'users', 'students', 'classes', 'assignments', 
    'homework_assignments', 'teachers', 'parents', 'activity_feed',
    'classroom_reports', 'attendance', 'announcements', 'ai_usage_logs'
  ];
  
  const counts: Record<string, number> = {};
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        console.log(`  ⚠️ ${table}: ${error.message}`);
        counts[table] = 0;
      } else {
        counts[table] = count || 0;
        console.log(`  ✅ ${table}: ${count || 0} records`);
      }
    } catch (error) {
      console.log(`  ❌ ${table}: ${error}`);
      counts[table] = 0;
    }
  }
  
  return counts;
}

async function getTableInfo(): Promise<any> {
  console.log('📋 Getting table information...');
  
  const query = `
    SELECT 
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'preschools', 'users', 'students', 'classes', 'assignments',
      'homework_assignments', 'teachers', 'parents', 'activity_feed',
      'classroom_reports', 'attendance', 'announcements', 'ai_usage_logs'
    )
    ORDER BY table_name, ordinal_position;
  `;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query });
    
    if (error) {
      console.log('⚠️ Could not get table info via RPC, trying direct query...');
      
      // Try using a simple query instead
      const simpleQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      
      const result = await supabase.rpc('exec_sql', { query: simpleQuery });
      return result.data;
    }
    
    return data;
  } catch (error) {
    console.log(`❌ Failed to get table info: ${error}`);
    return null;
  }
}

async function checkRLSPolicies(): Promise<any[]> {
  console.log('🔒 Checking RLS policies...');
  
  const query = `
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query });
    
    if (error) {
      console.log(`⚠️ Could not fetch RLS policies: ${error.message}`);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.log(`❌ Failed to check RLS policies: ${error}`);
    return [];
  }
}

async function getSampleData(): Promise<Record<string, any[]>> {
  console.log('📋 Getting sample data...');
  
  const samples: Record<string, any[]> = {};
  const tables = ['preschools', 'users', 'students', 'classes'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(3);
        
      if (error) {
        console.log(`  ⚠️ ${table} sample: ${error.message}`);
        samples[table] = [];
      } else {
        samples[table] = data || [];
        console.log(`  ✅ ${table}: Got ${(data || []).length} sample records`);
      }
    } catch (error) {
      console.log(`  ❌ ${table} sample: ${error}`);
      samples[table] = [];
    }
  }
  
  return samples;
}

async function performInspection(): Promise<void> {
  console.log('🔍 Starting SQL-based database inspection...');
  console.log(`🔗 Database: ${SUPABASE_URL}`);
  console.log(`🔑 Service Role Key Length: ${SERVICE_ROLE_KEY.length} characters`);
  
  const report = {
    timestamp: new Date().toISOString(),
    counts: {} as Record<string, number>,
    samples: {} as Record<string, any[]>,
    tableInfo: null as any,
    rlsPolicies: [] as any[],
  };
  
  // Get counts
  report.counts = await getTableCounts();
  
  // Get RLS policies
  report.rlsPolicies = await checkRLSPolicies();
  
  // Get table info
  report.tableInfo = await getTableInfo();
  
  // Get sample data for tables with records
  report.samples = await getSampleData();
  
  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('📊 SQL-BASED DATABASE INSPECTION REPORT');
  console.log('='.repeat(80));
  
  const totalRecords = Object.values(report.counts).reduce((sum, count) => sum + count, 0);
  
  console.log(`\n🕐 Timestamp: ${report.timestamp}`);
  console.log(`📊 Total Records: ${totalRecords}`);
  
  console.log('\n📈 Record Counts:');
  Object.entries(report.counts).forEach(([table, count]) => {
    const icon = count > 0 ? '✅' : '⚪';
    console.log(`  ${icon} ${table}: ${count} records`);
  });
  
  if (report.rlsPolicies.length > 0) {
    console.log(`\n🔒 Found ${report.rlsPolicies.length} RLS Policies:`);
    const policiesByTable = report.rlsPolicies.reduce((acc, policy) => {
      if (!acc[policy.tablename]) acc[policy.tablename] = [];
      acc[policy.tablename].push({
        name: policy.policyname,
        command: policy.cmd,
        roles: policy.roles
      });
      return acc;
    }, {} as Record<string, any[]>);
    
    Object.entries(policiesByTable).forEach(([table, policies]) => {
      console.log(`  🛡️ ${table}: ${policies.length} policies`);
      policies.forEach(policy => {
        console.log(`    - ${policy.name} (${policy.command}) for roles: ${policy.roles}`);
      });
    });
  } else {
    console.log('\n⚠️ No RLS policies found!');
  }
  
  console.log('\n🏫 Sample Data:');
  Object.entries(report.samples).forEach(([table, samples]) => {
    if (samples.length > 0) {
      console.log(`\n  📋 ${table} (${samples.length} samples):`);
      samples.forEach((record, index) => {
        const preview = Object.entries(record)
          .slice(0, 3)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        console.log(`    ${index + 1}. ${preview}`);
      });
    }
  });
  
  // Save report
  const reportPath = `database-sql-inspection-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n='.repeat(80));
  console.log(`📄 Report saved to: ${reportPath}`);
  
  // Recommendations
  console.log('\n🎯 Next Steps:');
  if (totalRecords === 0) {
    console.log('  🆕 Database is empty - can proceed with fresh setup');
    console.log('  ✅ Safe to run the full RLS setup script');
  } else {
    console.log(`  📊 Found ${totalRecords} existing records`);
    console.log('  🔧 Need to create RLS policies compatible with existing data');
  }
  
  if (report.rlsPolicies.length === 0) {
    console.log('  🚨 CRITICAL: No RLS protection - database is wide open!');
    console.log('  🔒 Must apply RLS policies immediately');
  }
}

// Run inspection
if (require.main === module) {
  performInspection().catch(error => {
    console.error('💥 Inspection failed:', error);
    process.exit(1);
  });
}

export { performInspection };