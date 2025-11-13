-- ================================================
-- DIAGNOSE RLS ISSUES FOR DASH AI
-- ================================================

-- 1. Check voice-notes storage bucket and its policies
\echo '=== VOICE-NOTES STORAGE BUCKET ==='
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'voice-notes';

\echo '\n=== CURRENT STORAGE POLICIES FOR VOICE-NOTES ==='
SELECT 
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd,
    p.qual,
    p.with_check
FROM pg_policies p
WHERE p.schemaname = 'storage' 
  AND p.tablename = 'objects'
  AND (p.qual LIKE '%voice-notes%' OR p.with_check LIKE '%voice-notes%')
ORDER BY p.policyname;

-- 2. Test path parsing for the actual path pattern
\echo '\n=== PATH PARSING TEST ==='
SELECT 
    'android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/dash_1759184998818_n2cefrk5fq.m4a' as full_path,
    (storage.foldername('android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/dash_1759184998818_n2cefrk5fq.m4a'))[0] as folder_0,
    (storage.foldername('android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/dash_1759184998818_n2cefrk5fq.m4a'))[1] as folder_1,
    (storage.foldername('android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/dash_1759184998818_n2cefrk5fq.m4a'))[2] as folder_2;

-- 3. Check ai_usage_logs table and its policies
\echo '\n=== AI_USAGE_LOGS TABLE RLS STATUS ==='
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'ai_usage_logs';

\echo '\n=== CURRENT POLICIES FOR AI_USAGE_LOGS ==='
SELECT 
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd,
    p.qual,
    p.with_check
FROM pg_policies p
WHERE p.schemaname = 'public' 
  AND p.tablename = 'ai_usage_logs'
ORDER BY p.policyname;

-- 4. Check if there are ANY storage policies that might interfere
\echo '\n=== ALL STORAGE.OBJECTS POLICIES ==='
SELECT 
    p.policyname,
    p.cmd,
    p.roles,
    substring(p.qual, 1, 100) as qual_preview,
    substring(p.with_check, 1, 100) as check_preview
FROM pg_policies p
WHERE p.schemaname = 'storage' 
  AND p.tablename = 'objects'
ORDER BY p.policyname;

-- 5. Check the actual user ID to verify it matches
\echo '\n=== AUTH CHECK ==='
SELECT 
    'Current auth.uid()' as context,
    auth.uid() as user_id,
    auth.role() as role,
    auth.email() as email;

-- 6. Check if service role is properly configured
\echo '\n=== SERVICE ROLE CHECK ==='
SELECT 
    rolname,
    rolsuper,
    rolinherit,
    rolcreaterole,
    rolcreatedb,
    rolcanlogin
FROM pg_roles 
WHERE rolname IN ('authenticator', 'authenticated', 'anon', 'service_role')
ORDER BY rolname;