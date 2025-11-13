-- ================================================
-- FIX: Voice Notes Upload - 400 Bad Request
-- Issue: RLS policies are blocking uploads to voice-notes bucket
-- ================================================

-- Ensure the voice-notes bucket exists and is configured correctly
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  FALSE,  -- Keep private
  52428800,  -- 50MB limit
  ARRAY[
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/m4a',
    'audio/aac',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = FALSE;

-- Drop all existing voice-note policies to start fresh
DROP POLICY IF EXISTS "insert own voice note" ON storage.objects;
DROP POLICY IF EXISTS "select own voice note" ON storage.objects;
DROP POLICY IF EXISTS "update own voice note" ON storage.objects;
DROP POLICY IF EXISTS "delete own voice note" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_delete_policy" ON storage.objects;

-- Create INSERT policy (allows authenticated users to upload to their own folder)
-- Path structure: android/USER_ID/filename OR ios/USER_ID/filename OR web/USER_ID/filename
CREATE POLICY "voice_notes_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (
    -- Match path structure: platform/user_id/filename
    name LIKE 'android/' || auth.uid()::text || '/%'
    OR name LIKE 'ios/' || auth.uid()::text || '/%'
    OR name LIKE 'web/' || auth.uid()::text || '/%'
    -- Also allow direct user_id/filename (fallback)
    OR name LIKE auth.uid()::text || '/%'
  )
);

-- Create SELECT policy (allows users to read their own voice notes)
CREATE POLICY "voice_notes_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    name LIKE 'android/' || auth.uid()::text || '/%'
    OR name LIKE 'ios/' || auth.uid()::text || '/%'
    OR name LIKE 'web/' || auth.uid()::text || '/%'
    OR name LIKE auth.uid()::text || '/%'
  )
);

-- Create UPDATE policy (allows users to update their own voice notes)
CREATE POLICY "voice_notes_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    name LIKE 'android/' || auth.uid()::text || '/%'
    OR name LIKE 'ios/' || auth.uid()::text || '/%'
    OR name LIKE 'web/' || auth.uid()::text || '/%'
    OR name LIKE auth.uid()::text || '/%'
  )
)
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (
    name LIKE 'android/' || auth.uid()::text || '/%'
    OR name LIKE 'ios/' || auth.uid()::text || '/%'
    OR name LIKE 'web/' || auth.uid()::text || '/%'
    OR name LIKE auth.uid()::text || '/%'
  )
);

-- Create DELETE policy (allows users to delete their own voice notes)
CREATE POLICY "voice_notes_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    name LIKE 'android/' || auth.uid()::text || '/%'
    OR name LIKE 'ios/' || auth.uid()::text || '/%'
    OR name LIKE 'web/' || auth.uid()::text || '/%'
    OR name LIKE auth.uid()::text || '/%'
  )
);

-- Verify the policies were created
SELECT 
  policyname, 
  cmd as operation,
  roles,
  qual as using_expression
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE '%voice_notes%'
ORDER BY policyname;
