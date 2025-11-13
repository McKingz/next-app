-- Fix Avatar Storage RLS Policies
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Enable RLS on storage.objects (should already be enabled)
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "avatars_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_policy" ON storage.objects;  
DROP POLICY IF EXISTS "avatars_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_policy" ON storage.objects;

-- Policy 1: Authenticated users can upload their own avatars
CREATE POLICY "avatars_upload_policy" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    -- Filename must start with user's auth UID or be profile_{user_id}_
    (
      name LIKE (auth.uid()::text || '%') OR
      name LIKE ('profile_' || auth.uid()::text || '_%')
    ) AND
    -- Only authenticated users can upload
    auth.role() = 'authenticated'
  );

-- Policy 2: Anyone can view avatars (public bucket)
CREATE POLICY "avatars_select_policy" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'avatars'
    -- Public access for viewing profile pictures
  );

-- Policy 3: Users can update their own avatars
CREATE POLICY "avatars_update_policy" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    (
      name LIKE (auth.uid()::text || '%') OR
      name LIKE ('profile_' || auth.uid()::text || '_%')
    ) AND
    auth.role() = 'authenticated'
  );

-- Policy 4: Users can delete their own avatars  
CREATE POLICY "avatars_delete_policy" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    (
      name LIKE (auth.uid()::text || '%') OR
      name LIKE ('profile_' || auth.uid()::text || '_%')
    ) AND
    auth.role() = 'authenticated'
  );

-- Verify policies were created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
AND policyname LIKE '%avatars%';