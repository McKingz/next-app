-- ===================================================================
-- FINAL DASH AI RLS FIX
-- Copy this entire file and run in Supabase Dashboard > SQL Editor
-- ===================================================================

-- 1. FIX VOICE-NOTES STORAGE BUCKET POLICIES
-- Drop any existing conflicting policies first
DROP POLICY IF EXISTS "insert own voice note" ON storage.objects;
DROP POLICY IF EXISTS "select own voice note" ON storage.objects;
DROP POLICY IF EXISTS "update own voice note" ON storage.objects;
DROP POLICY IF EXISTS "delete own voice note" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;

-- Create correct policies for path: android/USER_ID/file.m4a
-- Position [1] contains the user_id
CREATE POLICY "insert own voice note" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "select own voice note" 
ON storage.objects FOR SELECT 
TO authenticated
USING (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "update own voice note" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "delete own voice note" 
ON storage.objects FOR DELETE 
TO authenticated
USING (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. FIX AI_USAGE_LOGS TABLE POLICIES
-- Enable RLS on the table
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "users can insert own ai usage" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "users can view own ai usage" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "service role full access" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Users can view their own usage" ON public.ai_usage_logs;

-- Create policies for authenticated users
CREATE POLICY "users can insert own ai usage" 
ON public.ai_usage_logs 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can view own ai usage" 
ON public.ai_usage_logs 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- CRITICAL: Allow service role (Edge Functions) full access
CREATE POLICY "service role full access" 
ON public.ai_usage_logs 
FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

-- 3. VERIFY THE FIXES
-- This will show all policies that were just created
SELECT 
  'STORAGE POLICIES' as policy_type,
  policyname,
  cmd::text as operation,
  roles::text as for_role
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%voice note%'

UNION ALL

SELECT 
  'AI_USAGE_LOGS POLICIES' as policy_type,
  policyname,
  cmd::text as operation,
  roles::text as for_role
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'ai_usage_logs'
ORDER BY policy_type, policyname;

-- Expected output:
-- 4 storage policies (insert, select, update, delete)
-- 3 ai_usage_logs policies (insert for authenticated, select for authenticated, all for service_role)