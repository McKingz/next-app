-- ================================================
-- CORRECTED Voice Notes RLS Policies
-- Fix for path structure: platform/user_id/filename
-- ================================================

-- Drop existing policies
DROP POLICY IF EXISTS "insert own voice note" ON storage.objects;
DROP POLICY IF EXISTS "select own voice note" ON storage.objects;  
DROP POLICY IF EXISTS "update own voice note" ON storage.objects;
DROP POLICY IF EXISTS "delete own voice note" ON storage.objects;

-- CORRECTED Policy for inserting own voice note files
-- Path structure: android/USER_ID/filename or USER_ID/filename
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

-- CORRECTED Policy for selecting own voice note files
CREATE POLICY "select own voice note"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    -- Format: platform/user_id/filename (user_id is at position [1])
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Format: user_id/filename (user_id is at position [0] - fallback)
    (storage.foldername(name))[0] = auth.uid()::text
  )
);

-- CORRECTED Policy for updating own voice note files
CREATE POLICY "update own voice note"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    -- Format: platform/user_id/filename (user_id is at position [1])
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Format: user_id/filename (user_id is at position [0] - fallback)
    (storage.foldername(name))[0] = auth.uid()::text
  )
)
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

-- CORRECTED Policy for deleting own voice note files
CREATE POLICY "delete own voice note"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    -- Format: platform/user_id/filename (user_id is at position [1])
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Format: user_id/filename (user_id is at position [0] - fallback)
    (storage.foldername(name))[0] = auth.uid()::text
  )
);

-- Test the policy logic (optional - just for verification)
-- You can run this to see how the path parsing works:
/*
SELECT 
  'android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/test.m4a' as example_path,
  (storage.foldername('android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/test.m4a'))[0] as folder_0,
  (storage.foldername('android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/test.m4a'))[1] as folder_1,
  (storage.foldername('android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/test.m4a'))[2] as folder_2;
*/