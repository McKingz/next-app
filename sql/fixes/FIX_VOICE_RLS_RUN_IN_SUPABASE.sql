-- ================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Dashboard: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql
-- 
-- This fixes the RLS policy error:
-- "new row violates row-level security policy"
-- ================================================

-- STEP 1: Drop all existing voice-note policies
DO $$ 
BEGIN
  -- Drop if exists (ignore errors if they don't exist)
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
END $$;

-- STEP 2: Create simple, working policies
-- Path format: {user_uuid}/{filename}.m4a

-- INSERT: Allow authenticated users to upload files to their own folder
CREATE POLICY "voice_notes_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes'
  AND name ~ ('^' || auth.uid()::text || '/')
);

-- SELECT: Allow authenticated users to read their own files
CREATE POLICY "voice_notes_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND name ~ ('^' || auth.uid()::text || '/')
);

-- UPDATE: Allow authenticated users to update their own files
CREATE POLICY "voice_notes_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND name ~ ('^' || auth.uid()::text || '/')
)
WITH CHECK (
  bucket_id = 'voice-notes'
  AND name ~ ('^' || auth.uid()::text || '/')
);

-- DELETE: Allow authenticated users to delete their own files
CREATE POLICY "voice_notes_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND name ~ ('^' || auth.uid()::text || '/')
);

-- STEP 3: Verify the policies were created successfully
SELECT 
  policyname, 
  cmd as operation,
  'voice-notes bucket' as applies_to
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE 'voice_notes%'
ORDER BY policyname;

-- SUCCESS! You should see 4 policies:
-- 1. voice_notes_insert (INSERT)
-- 2. voice_notes_select (SELECT)
-- 3. voice_notes_update (UPDATE)
-- 4. voice_notes_delete (DELETE)
