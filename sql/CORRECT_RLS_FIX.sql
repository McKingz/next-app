-- ===================================================================
-- CORRECT DASH AI RLS FIX - Fixes array indexing issue
-- The problem: storage.foldername() is 1-indexed
-- Path: android/USER_ID/file.m4a
-- [1] = "android", [2] = USER_ID  <-- This is the fix!
-- ===================================================================

-- 1. DROP ALL CONFLICTING VOICE-NOTES POLICIES
DROP POLICY IF EXISTS "insert own voice note" ON storage.objects;
DROP POLICY IF EXISTS "select own voice note" ON storage.objects;
DROP POLICY IF EXISTS "update own voice note" ON storage.objects;
DROP POLICY IF EXISTS "delete own voice note" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_upload" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_select" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_delete" ON storage.objects;

-- 2. CREATE CORRECT POLICIES - Using position [2] for user_id
CREATE POLICY "voice_notes_insert" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[2] = auth.uid()::text  -- POSITION [2] not [1]!
);

CREATE POLICY "voice_notes_select" 
ON storage.objects FOR SELECT 
TO authenticated
USING (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[2] = auth.uid()::text  -- POSITION [2] not [1]!
);

CREATE POLICY "voice_notes_update" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[2] = auth.uid()::text  -- POSITION [2] not [1]!
)
WITH CHECK (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[2] = auth.uid()::text  -- POSITION [2] not [1]!
);

CREATE POLICY "voice_notes_delete" 
ON storage.objects FOR DELETE 
TO authenticated
USING (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[2] = auth.uid()::text  -- POSITION [2] not [1]!
);

-- 3. FIX AI_USAGE_LOGS - Clean up duplicate policies
-- There are 12 policies! Let's keep only what's needed

-- Drop all existing policies
DROP POLICY IF EXISTS "ai_usage_logs_authenticated_insert" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_org_admin_access" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_read_policy" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_service_role_all" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_superadmin_access" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_user_access" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_user_select" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_write_policy" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "service role full access" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "superadmin_service_role_access" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "users can insert own ai usage" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "users can view own ai usage" ON public.ai_usage_logs;

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create clean, simple policies
CREATE POLICY "ai_usage_insert" 
ON public.ai_usage_logs 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_usage_select" 
ON public.ai_usage_logs 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- CRITICAL: Service role needs full access for Edge Functions
CREATE POLICY "ai_usage_service_role" 
ON public.ai_usage_logs 
FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

-- 4. VERIFY THE FIX
\echo '\n=== VERIFICATION ==='

-- Test path parsing
SELECT 
  'Path parsing test' as test,
  (storage.foldername('android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/test.m4a'))[1] as position_1_platform,
  (storage.foldername('android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/test.m4a'))[2] as position_2_user_id;

-- Show active policies
SELECT 
  'STORAGE' as policy_location,
  policyname,
  cmd::text as operation
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE 'voice_notes%'
  
UNION ALL

SELECT 
  'AI_USAGE_LOGS' as policy_location,
  policyname,
  cmd::text as operation
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'ai_usage_logs'
  AND policyname LIKE 'ai_usage%'
ORDER BY policy_location, policyname;

\echo '\n✅ Expected: 4 storage policies + 3 ai_usage policies = 7 total'