#!/usr/bin/env tsx
/**
 * Diagnose and Fix Dash AI RLS Issues
 * Run with: npx tsx scripts/diagnose-and-fix-rls.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Need: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function diagnoseIssues() {
  console.log('🔍 DIAGNOSING RLS ISSUES\n');

  // 1. Check voice-notes bucket
  console.log('=== VOICE-NOTES BUCKET ===');
  const { data: bucket, error: bucketError } = await supabase
    .storage
    .getBucket('voice-notes');
  
  if (bucketError) {
    console.log('❌ voice-notes bucket NOT FOUND');
    console.log('Error:', bucketError.message);
  } else {
    console.log('✅ Bucket exists:', {
      public: bucket.public,
      file_size_limit: bucket.file_size_limit,
      allowed_mime_types: bucket.allowed_mime_types
    });
  }

  // 2. Check storage policies using SQL
  console.log('\n=== STORAGE.OBJECTS POLICIES ===');
  const { data: storagePolicies, error: storageError } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT policyname, cmd, roles::text, 
               substring(qual::text, 1, 200) as qual_preview,
               substring(with_check::text, 1, 200) as check_preview
        FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects'
        ORDER BY policyname;
      `
    });

  if (storageError) {
    console.log('⚠️  Could not query storage policies directly');
    console.log('Trying alternative method...');
    
    // Try listing objects to test permissions
    const { data: testList, error: listError } = await supabase
      .storage
      .from('voice-notes')
      .list('android', { limit: 1 });
    
    if (listError) {
      console.log('❌ Storage access test failed:', listError.message);
    } else {
      console.log('✅ Storage is accessible');
    }
  } else {
    if (storagePolicies && storagePolicies.length > 0) {
      console.log('Found policies:');
      storagePolicies.forEach((p: any) => {
        console.log(`  - ${p.policyname} [${p.cmd}]`);
        if (p.check_preview) console.log(`    CHECK: ${p.check_preview}`);
      });
    } else {
      console.log('❌ NO STORAGE POLICIES FOUND - This is the problem!');
    }
  }

  // 3. Check ai_usage_logs table and RLS
  console.log('\n=== AI_USAGE_LOGS TABLE ===');
  const { data: tableInfo, error: tableError } = await supabase
    .from('ai_usage_logs')
    .select('id')
    .limit(1);

  if (tableError) {
    console.log('❌ Error accessing ai_usage_logs:', tableError.message);
    if (tableError.message.includes('permission denied')) {
      console.log('   This means RLS is blocking access');
    }
  } else {
    console.log('✅ ai_usage_logs table is accessible');
  }

  // 4. Test actual path parsing
  console.log('\n=== PATH PARSING TEST ===');
  const testPath = 'android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/dash_test.m4a';
  console.log('Test path:', testPath);
  console.log('Expected user_id at position [1]: a1fd12d2-5f09-4a23-822d-f3071bfc544b');

  return { bucket, storagePolicies };
}

async function applyFixes() {
  console.log('\n\n🔧 APPLYING FIXES\n');

  // Fix 1: Create/update storage policies for voice-notes
  console.log('1. Creating voice-notes storage policies...');
  
  const storagePolicySQL = `
    -- Drop existing policies
    DROP POLICY IF EXISTS "insert own voice note" ON storage.objects;
    DROP POLICY IF EXISTS "select own voice note" ON storage.objects;
    DROP POLICY IF EXISTS "update own voice note" ON storage.objects;
    DROP POLICY IF EXISTS "delete own voice note" ON storage.objects;
    
    -- Create policies for android/user_id/file pattern
    CREATE POLICY "insert own voice note" ON storage.objects 
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'voice-notes' AND 
      (storage.foldername(name))[1] = auth.uid()::text
    );
    
    CREATE POLICY "select own voice note" ON storage.objects 
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'voice-notes' AND 
      (storage.foldername(name))[1] = auth.uid()::text
    );
    
    CREATE POLICY "update own voice note" ON storage.objects 
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'voice-notes' AND 
      (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'voice-notes' AND 
      (storage.foldername(name))[1] = auth.uid()::text
    );
    
    CREATE POLICY "delete own voice note" ON storage.objects 
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'voice-notes' AND 
      (storage.foldername(name))[1] = auth.uid()::text
    );
  `;

  try {
    // Try using service role to execute SQL
    const { error } = await supabase.rpc('exec_sql', { query: storagePolicySQL });
    if (error) throw error;
    console.log('✅ Voice-notes storage policies created');
  } catch (err: any) {
    console.log('⚠️  Direct SQL execution failed');
    console.log('📋 You need to run this SQL manually in Supabase Dashboard:\n');
    console.log(storagePolicySQL);
  }

  // Fix 2: Create/update ai_usage_logs policies
  console.log('\n2. Creating ai_usage_logs table policies...');
  
  const aiUsagePolicySQL = `
    -- Enable RLS
    ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "users can insert own ai usage" ON public.ai_usage_logs;
    DROP POLICY IF EXISTS "users can view own ai usage" ON public.ai_usage_logs;
    DROP POLICY IF EXISTS "service role full access" ON public.ai_usage_logs;
    
    -- Create policies
    CREATE POLICY "users can insert own ai usage" ON public.ai_usage_logs 
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "users can view own ai usage" ON public.ai_usage_logs 
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
    
    CREATE POLICY "service role full access" ON public.ai_usage_logs 
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { query: aiUsagePolicySQL });
    if (error) throw error;
    console.log('✅ AI usage logs policies created');
  } catch (err: any) {
    console.log('⚠️  Direct SQL execution failed');
    console.log('📋 You need to run this SQL manually in Supabase Dashboard:\n');
    console.log(aiUsagePolicySQL);
  }

  // Create combined SQL file for manual execution
  const fs = require('fs');
  const combinedSQL = `-- DASH AI RLS FIX - Generated at ${new Date().toISOString()}\n\n${storagePolicySQL}\n\n${aiUsagePolicySQL}`;
  fs.writeFileSync('RLS_FIX_MANUAL.sql', combinedSQL);
  console.log('\n📄 Combined SQL saved to: RLS_FIX_MANUAL.sql');
}

// Main execution
(async () => {
  try {
    await diagnoseIssues();
    await applyFixes();
    
    console.log('\n\n✅ DIAGNOSIS AND FIX COMPLETE');
    console.log('\nNext steps:');
    console.log('1. If fixes were applied automatically, restart your app');
    console.log('2. If you see SQL above, copy it to Supabase Dashboard SQL Editor');
    console.log('3. Test voice recording in the app');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
})();