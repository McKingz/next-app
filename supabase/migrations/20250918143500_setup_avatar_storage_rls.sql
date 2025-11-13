-- Setup Avatar Storage RLS Policies
-- Migration: 20250918143500_setup_avatar_storage_rls.sql

-- Enable RLS on storage.objects (should already be enabled)
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing avatar policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS avatars_upload_policy ON storage.objects;
DROP POLICY IF EXISTS avatars_select_policy ON storage.objects;
DROP POLICY IF EXISTS avatars_update_policy ON storage.objects;
DROP POLICY IF EXISTS avatars_delete_policy ON storage.objects;

-- Policy 1: Authenticated users can upload their own avatars
CREATE POLICY avatars_upload_policy ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  -- Filename must start with user's auth UID or be profile_{user_id}_
  AND (
    name LIKE (auth.uid()::text || '%')
    OR name LIKE ('profile_' || auth.uid()::text || '_%')
  )
  -- Only authenticated users can upload
  AND auth.role() = 'authenticated'
);

-- Policy 2: Anyone can view avatars (public bucket)
CREATE POLICY avatars_select_policy ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
-- Public access for viewing profile pictures
);

-- Policy 3: Users can update their own avatars
CREATE POLICY avatars_update_policy ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (
    name LIKE (auth.uid()::text || '%')
    OR name LIKE ('profile_' || auth.uid()::text || '_%')
  )
  AND auth.role() = 'authenticated'
);

-- Policy 4: Users can delete their own avatars  
CREATE POLICY avatars_delete_policy ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (
    name LIKE (auth.uid()::text || '%')
    OR name LIKE ('profile_' || auth.uid()::text || '_%')
  )
  AND auth.role() = 'authenticated'
);

-- Create comment for documentation
COMMENT ON POLICY avatars_upload_policy ON storage.objects IS 'Allow authenticated users to upload their own avatar files';
COMMENT ON POLICY avatars_select_policy ON storage.objects IS 'Allow public read access to avatar files';
COMMENT ON POLICY avatars_update_policy ON storage.objects IS 'Allow users to update their own avatar files';
COMMENT ON POLICY avatars_delete_policy ON storage.objects IS 'Allow users to delete their own avatar files';
