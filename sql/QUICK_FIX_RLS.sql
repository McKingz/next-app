-- ================================================
-- QUICK FIX: Voice Notes & AI Usage Logs RLS
-- Apply this in Supabase SQL Editor
-- ================================================

-- 1. Fix voice-notes storage (handles android/user_id/file.m4a pattern)
DO $$ 
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "insert own voice note" ON storage.objects;
    DROP POLICY IF EXISTS "select own voice note" ON storage.objects;
    DROP POLICY IF EXISTS "update own voice note" ON storage.objects;
    DROP POLICY IF EXISTS "delete own voice note" ON storage.objects;
    
    -- Create new policies with correct path handling
    CREATE POLICY "insert own voice note" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'voice-notes' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );
    
    CREATE POLICY "select own voice note" ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'voice-notes' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );
    
    CREATE POLICY "update own voice note" ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'voice-notes' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'voice-notes' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );
    
    CREATE POLICY "delete own voice note" ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'voice-notes' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );
    
    RAISE NOTICE 'Voice-notes storage policies created';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating voice-notes policies: %', SQLERRM;
END $$;

-- 2. Fix ai_usage_logs table
DO $$
BEGIN
    -- Enable RLS
    ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "users can insert own ai usage" ON public.ai_usage_logs;
    DROP POLICY IF EXISTS "users can view own ai usage" ON public.ai_usage_logs;
    DROP POLICY IF EXISTS "service role full access" ON public.ai_usage_logs;
    
    -- Create new policies
    CREATE POLICY "users can insert own ai usage" ON public.ai_usage_logs 
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "users can view own ai usage" ON public.ai_usage_logs 
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
    
    CREATE POLICY "service role full access" ON public.ai_usage_logs 
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
    
    RAISE NOTICE 'AI usage logs policies created';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating ai_usage_logs policies: %', SQLERRM;
END $$;

-- 3. Verify the fixes
SELECT 'VOICE NOTES POLICIES:' as check_type;
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE '%voice note%';

SELECT 'AI USAGE LOGS POLICIES:' as check_type;
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'ai_usage_logs';