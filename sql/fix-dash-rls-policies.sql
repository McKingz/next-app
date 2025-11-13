-- ================================================
-- Fix Dash AI RLS Policies
-- Fixes voice-notes storage and ai_usage_logs table
-- ================================================

-- =======================
-- 1. Voice Notes Storage
-- =======================

-- Drop existing voice-notes policies if they exist
DROP POLICY IF EXISTS "insert own voice note" ON storage.objects;
DROP POLICY IF EXISTS "select own voice note" ON storage.objects;  
DROP POLICY IF EXISTS "update own voice note" ON storage.objects;
DROP POLICY IF EXISTS "delete own voice note" ON storage.objects;

-- Create corrected voice-notes storage policies
-- Path structure: platform/user_id/filename (e.g., android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/dash_xxx.m4a)

CREATE POLICY "insert own voice note"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (
    -- Format: platform/user_id/filename (user_id is at position [1])
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Format: user_id/filename (user_id is at position [0] - fallback)
    (storage.foldername(name))[0] = auth.uid()::text
  )
);

CREATE POLICY "select own voice note"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (storage.foldername(name))[0] = auth.uid()::text
  )
);

CREATE POLICY "update own voice note"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (storage.foldername(name))[0] = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (storage.foldername(name))[0] = auth.uid()::text
  )
);

CREATE POLICY "delete own voice note"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (storage.foldername(name))[0] = auth.uid()::text
  )
);

-- =======================
-- 2. AI Usage Logs Table
-- =======================

-- Enable RLS on ai_usage_logs if not already enabled
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "users can insert own ai usage" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "users can view own ai usage" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "service role full access" ON public.ai_usage_logs;

-- Users can insert their own AI usage logs
CREATE POLICY "users can insert own ai usage"
ON public.ai_usage_logs FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- Users can view their own AI usage logs
CREATE POLICY "users can view own ai usage"
ON public.ai_usage_logs FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Service role (Edge Functions) can do anything
CREATE POLICY "service role full access"
ON public.ai_usage_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('ai_usage_logs')
   OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY tablename, policyname;