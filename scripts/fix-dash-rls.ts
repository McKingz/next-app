#!/usr/bin/env tsx
/**
 * Fix Dash AI RLS Policies
 * Run with: npx tsx scripts/fix-dash-rls.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function applyFixes() {
  console.log('🔧 Applying Dash AI RLS Fixes...\n');

  // Read the SQL file
  const sqlPath = path.join(__dirname, '..', 'QUICK_FIX_RLS.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    }).single();

    if (error) {
      // If exec_sql doesn't exist, try direct query (requires admin access)
      console.log('⚠️  exec_sql not available, trying alternative method...');
      
      // Split into individual statements and run them
      const statements = sqlContent
        .split(/;\s*$/gm)
        .filter(stmt => stmt.trim().length > 0)
        .filter(stmt => !stmt.trim().startsWith('--'));

      for (const stmt of statements) {
        if (stmt.includes('SELECT')) {
          // Run SELECT statements to verify
          const { data: result, error: selectError } = await supabase
            .rpc('query', { query_text: stmt })
            .single();
          
          if (!selectError && result) {
            console.log('✓ Verification query executed');
          }
        }
      }
      
      console.log('\n⚠️  Could not execute DDL directly via TypeScript.');
      console.log('📋 Please run the SQL manually in Supabase Dashboard:');
      console.log('   1. Go to SQL Editor in your Supabase project');
      console.log('   2. Copy contents of QUICK_FIX_RLS.sql');
      console.log('   3. Paste and run the query');
      return;
    }

    console.log('✅ RLS policies applied successfully!\n');
    
  } catch (err) {
    console.error('❌ Error applying fixes:', err);
    console.log('\n📋 Please apply the fix manually via Supabase Dashboard');
  }
}

// Verify current policies
async function verifyPolicies() {
  console.log('🔍 Verifying current policies...\n');

  // Check voice-notes policies
  const { data: voicePolicies } = await supabase
    .from('pg_policies')
    .select('policyname, cmd')
    .eq('schemaname', 'storage')
    .eq('tablename', 'objects')
    .like('policyname', '%voice note%');

  if (voicePolicies && voicePolicies.length > 0) {
    console.log('✅ Voice notes policies found:');
    voicePolicies.forEach(p => console.log(`   - ${p.policyname} (${p.cmd})`));
  } else {
    console.log('❌ No voice notes policies found');
  }

  // Check ai_usage_logs policies  
  const { data: aiPolicies } = await supabase
    .from('pg_policies')
    .select('policyname, cmd')
    .eq('schemaname', 'public')
    .eq('tablename', 'ai_usage_logs');

  if (aiPolicies && aiPolicies.length > 0) {
    console.log('\n✅ AI usage logs policies found:');
    aiPolicies.forEach(p => console.log(`   - ${p.policyname} (${p.cmd})`));
  } else {
    console.log('\n❌ No AI usage logs policies found');
  }
}

// Run the fixes
(async () => {
  await applyFixes();
  await verifyPolicies();
})().catch(console.error);