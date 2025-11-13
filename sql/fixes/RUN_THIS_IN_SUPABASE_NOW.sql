-- ================================================
-- COPY THIS ENTIRE SCRIPT AND RUN IN SUPABASE SQL EDITOR
-- Dashboard: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql
-- ================================================

-- Step 1: Drop ALL existing voice-note policies
DROP POLICY IF EXISTS "insert own voice note" ON storage.objects;
DROP POLICY IF EXISTS "select own voice note" ON storage.objects;
DROP POLICY IF EXISTS "update own voice note" ON storage.objects;
DROP POLICY IF EXISTS "delete own voice note" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_insert" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_select" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_update" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_delete" ON storage.objects;

-- Step 2: Create new working policies
-- User ID: 136cf31c-b37c-45c0-9cf7-755bd1b9afbf
-- Path format: {user_id}/{filename}.m4a

-- INSERT policy - allows authenticated users to upload to their folder
CREATE POLICY "voice_notes_user_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (name LIKE auth.uid()::text || '/%')
);

-- SELECT policy - allows users to read their own files  
CREATE POLICY "voice_notes_user_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (name LIKE auth.uid()::text || '/%')
);

-- UPDATE policy - allows users to update their own files
CREATE POLICY "voice_notes_user_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (name LIKE auth.uid()::text || '/%')
)
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (name LIKE auth.uid()::text || '/%')
);

-- DELETE policy - allows users to delete their own files
CREATE POLICY "voice_notes_user_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (name LIKE auth.uid()::text || '/%')
);

-- Step 3: Verify policies were created
SELECT 
  policyname, 
  cmd as operation,
  'Fixed!' as status
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE 'voice_notes_user%'
ORDER BY policyname;

-- You should see 4 policies:
-- voice_notes_user_delete   | DELETE
-- voice_notes_user_insert   | INSERT
-- voice_notes_user_select   | SELECT
-- voice_notes_user_update   | UPDATE
