/**
 * Apply RLS Setup Script
 * 
 * This script applies RLS policies and creates sample data
 * directly on the remote Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const SUPABASE_URL = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzc4MzgsImV4cCI6MjA2ODYxMzgzOH0.mjXejyRHPzEJfMlhW46TlYI0qw9mtoSRJZhGsCkuvd8';

// For running SQL, we need service role key (not anon key)
// NOTE: This would normally come from environment variables or be input securely
console.log('⚠️ This script needs SERVICE_ROLE key to create RLS policies');
console.log('Please provide your Supabase service role key to proceed:');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function executeSQL(sql: string) {
  console.log('📝 Executing SQL script...');
  
  // Split the SQL into individual statements
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== 'BEGIN' && stmt !== 'COMMIT');
  
  console.log(`Found ${statements.length} SQL statements to execute`);
  
  const results = [];
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;
    
    console.log(`\n${i + 1}/${statements.length}: Executing statement...`);
    console.log(`Statement: ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
    
    try {
      // Note: This is a simplified approach. In production, you'd use the service role
      // and proper SQL execution methods
      console.log('⚠️ Cannot execute with anon key - would need service role');
      results.push({ success: false, error: 'Service role required' });
    } catch (error) {
      console.error('❌ Error executing statement:', error);
      results.push({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  return results;
}

async function applyRLSSetup() {
  try {
    console.log('🔧 Starting RLS setup application...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'setup-production-rls.sql');
    console.log(`📖 Reading SQL file from: ${sqlFilePath}`);
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`📄 SQL file loaded (${sqlContent.length} characters)`);
    
    // Execute the SQL
    const results = await executeSQL(sqlContent);
    
    console.log('\n🔍 Execution Summary:');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed statements:');
      results.filter(r => !r.success).forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.error}`);
      });
    }
    
    console.log('\n🏁 RLS setup application completed');
    
    // Create a manual setup guide
    console.log('\n' + '='.repeat(80));
    console.log('📋 MANUAL SETUP REQUIRED');
    console.log('='.repeat(80));
    console.log('');
    console.log('Since we need the service role key to create RLS policies,');
    console.log('please run the following SQL manually in your Supabase SQL Editor:');
    console.log('');
    console.log('1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql');
    console.log('2. Copy and paste the contents of: scripts/setup-production-rls.sql');
    console.log('3. Click "Run" to execute the script');
    console.log('');
    console.log('The script will:');
    console.log('• ✅ Enable RLS on all critical tables');
    console.log('• ✅ Create helper functions for role-based access');
    console.log('• ✅ Set up comprehensive RLS policies');  
    console.log('• ✅ Create sample data for testing');
    console.log('');
    console.log('After running the script, you can test RLS by running:');
    console.log('  npm run inspect-db');
    
  } catch (error) {
    console.error('💥 Failed to apply RLS setup:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  applyRLSSetup();
}

export { applyRLSSetup };