-- ============================================================================
-- Supabase Storage Setup for Profile Avatars
-- ============================================================================
-- This sets up secure storage for user profile pictures with proper RLS policies

-- ============================================================================
-- 1. CREATE STORAGE BUCKET
-- ============================================================================

-- Create the avatars bucket (public for profile pictures)
-- Note: This should also be created via Supabase dashboard if needed
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE, -- Public bucket for profile pictures
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif']
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. STORAGE RLS POLICIES
-- ============================================================================

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can upload their own avatars
DROP POLICY IF EXISTS avatars_upload_policy ON storage.objects;
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

-- Policy: Anyone can view avatars (public bucket)
DROP POLICY IF EXISTS avatars_select_policy ON storage.objects;
CREATE POLICY avatars_select_policy ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
-- Public access for viewing profile pictures
);

-- Policy: Users can update/delete their own avatars
DROP POLICY IF EXISTS avatars_update_policy ON storage.objects;
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

-- Policy: Users can delete their own avatars
DROP POLICY IF EXISTS avatars_delete_policy ON storage.objects;
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

-- ============================================================================
-- 3. HELPER FUNCTIONS FOR PROFILE MANAGEMENT
-- ============================================================================

-- Function to generate a unique avatar filename
CREATE OR REPLACE FUNCTION generate_avatar_filename(
  user_id uuid,
  file_extension text DEFAULT 'jpg'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  filename TEXT;
  timestamp_str TEXT;
BEGIN
  -- Generate timestamp string for uniqueness
  timestamp_str := EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
  
  -- Create filename: profile_{user_id}_{timestamp}.{ext}
  filename := 'profile_' || user_id::text || '_' || timestamp_str || '.' || file_extension;
  
  RETURN filename;
END;
$$;

-- Function to cleanup old avatars for a user (keep only the latest)
CREATE OR REPLACE FUNCTION cleanup_old_avatars(
  user_id uuid,
  keep_count integer DEFAULT 1
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
  avatar_obj RECORD;
BEGIN
  -- Find old avatar objects for this user (keep only the most recent ones)
  FOR avatar_obj IN
    SELECT name, created_at FROM storage.objects
    WHERE bucket_id = 'avatars'
    AND (
      name LIKE ('profile_' || user_id::text || '_%') OR
      name LIKE (user_id::text || '%')
    )
    ORDER BY created_at DESC
    OFFSET keep_count
  LOOP
    -- Delete old avatar objects
    DELETE FROM storage.objects 
    WHERE bucket_id = 'avatars' 
    AND name = avatar_obj.name;
    
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- 4. UPDATE PROFILES TABLE FOR AVATAR URLS
-- ============================================================================

-- Ensure profiles table has avatar_url column (it should already exist)
-- This is just a safety check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

-- Create index on avatar_url for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_url ON profiles (avatar_url)
WHERE avatar_url IS NOT NULL;

-- ============================================================================
-- 5. TRIGGERS FOR AVATAR CLEANUP
-- ============================================================================

-- Function to automatically clean up old avatars when profile is updated
CREATE OR REPLACE FUNCTION trigger_cleanup_old_avatars()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If avatar_url changed, clean up old avatars for this user
  IF OLD.avatar_url IS DISTINCT FROM NEW.avatar_url AND NEW.avatar_url IS NOT NULL THEN
    -- Cleanup old avatars (keep only the current one)
    PERFORM cleanup_old_avatars(NEW.id, 1);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically cleanup old avatars
DROP TRIGGER IF EXISTS profiles_avatar_cleanup_trigger ON profiles;
CREATE TRIGGER profiles_avatar_cleanup_trigger
AFTER UPDATE OF avatar_url ON profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_cleanup_old_avatars();

-- ============================================================================
-- 6. GRANT NECESSARY PERMISSIONS
-- ============================================================================

-- Grant usage on functions to authenticated users
GRANT EXECUTE ON FUNCTION generate_avatar_filename(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_avatars(uuid, integer) TO authenticated;

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION generate_avatar_filename(uuid, text) IS
'Generates a unique filename for user avatar uploads';

COMMENT ON FUNCTION cleanup_old_avatars(uuid, integer) IS
'Cleans up old avatar files for a user, keeping only the specified number of most recent ones';

COMMENT ON TRIGGER profiles_avatar_cleanup_trigger ON profiles IS
'Automatically cleans up old avatar files when a user updates their profile picture';
