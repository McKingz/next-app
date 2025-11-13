-- Fix 403 Forbidden errors in ai-proxy edge function
-- This ensures the service role can read ai_usage_logs for quota checking

-- Drop conflicting policies that might block service role
DROP POLICY IF EXISTS "ai_usage_logs_superadmin_deny" ON public.ai_usage_logs;

-- Ensure service role has full access to ai_usage_logs
DROP POLICY IF EXISTS "service_role_full_access_ai_usage" ON public.ai_usage_logs;
CREATE POLICY "service_role_full_access_ai_usage" 
ON public.ai_usage_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Also ensure service role can access profiles
DROP POLICY IF EXISTS "service_role_full_access_profiles" ON public.profiles;
CREATE POLICY "service_role_full_access_profiles"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Check current RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE tablename IN ('ai_usage_logs', 'profiles')
  AND schemaname = 'public';

-- List all policies on these tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_expression
FROM pg_policies 
WHERE tablename IN ('ai_usage_logs', 'profiles')
  AND schemaname = 'public'
ORDER BY tablename, policyname;
