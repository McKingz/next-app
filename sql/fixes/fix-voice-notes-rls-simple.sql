-- ================================================
-- SIMPLE FIX: Voice Notes RLS Policies
-- Issue: "new row violates row-level security policy"
-- Path structure: {user_id}/{filename}
-- ================================================

-- Drop all existing voice-note policies
DROP POLICY IF EXISTS "insert own voice note" ON storage.objects;
DROP POLICY IF EXISTS "select own voice note" ON storage.objects;
DROP POLICY IF EXISTS "update own voice note" ON storage.objects;
DROP POLICY IF EXISTS "delete own voice note" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_delete_policy" ON storage.objects;

-- Simple INSERT policy: allow uploads to bucket if path starts with user's ID
CREATE POLICY "voice_notes_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (name ~ ('^' || auth.uid()::text || '/'))
);

-- Simple SELECT policy: allow reads if path starts with user's ID
CREATE POLICY "voice_notes_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (name ~ ('^' || auth.uid()::text || '/'))
);

-- Simple UPDATE policy: allow updates if path starts with user's ID
CREATE POLICY "voice_notes_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (name ~ ('^' || auth.uid()::text || '/'))
)
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (name ~ ('^' || auth.uid()::text || '/'))
);

-- Simple DELETE policy: allow deletes if path starts with user's ID
CREATE POLICY "voice_notes_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (name ~ ('^' || auth.uid()::text || '/'))
);

-- Verify policies were created
SELECT 
  policyname, 
  cmd as operation,
  tablename
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE 'voice_notes%'
ORDER BY policyname;

-- Test the policy (run this as authenticated user)
-- This should show if the policy allows the insert
SELECT 
  auth.uid() as current_user_id,
  'voice-notes' as bucket,
  auth.uid()::text || '/test.m4a' as test_path,
  (auth.uid()::text || '/test.m4a') ~ ('^' || auth.uid()::text || '/') as policy_should_allow;
