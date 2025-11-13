-- ================================================
-- 2025-10-07 Voice Notes Storage Setup (RLS policies)
-- Create/ensure private bucket and policies for voice recordings
-- Path convention: {platform}/{user_id}/{filename} OR {user_id}/{filename}
-- ================================================

-- 1) Create or update private bucket for voice notes with 50MB size limit
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  FALSE,
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

-- 2) Policies: allow authenticated users to manage only their own subfolders
--    Matches client code using `${platform}/${auth.uid()}/${filename}`

-- Drop existing voice-note policies (idempotent)
DROP POLICY IF EXISTS "insert own voice note" ON storage.objects;
DROP POLICY IF EXISTS "select own voice note" ON storage.objects;
DROP POLICY IF EXISTS "update own voice note" ON storage.objects;
DROP POLICY IF EXISTS "delete own voice note" ON storage.objects;

-- Insert policy
CREATE POLICY "insert own voice note"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (
    -- Allow platform/user_id/filename structure
    (storage.foldername(name))[2] = auth.uid()::text
    OR
    -- Allow direct user_id/filename structure (fallback)
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Select policy
CREATE POLICY "select own voice note"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Update policy
CREATE POLICY "update own voice note"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Delete policy
CREATE POLICY "delete own voice note"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Helper: signed URL generator restricted to owner
CREATE OR REPLACE FUNCTION get_voice_note_signed_url(file_path text, expires_in integer DEFAULT 3600)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  signed_url TEXT;
  user_id_in_path TEXT;
BEGIN
  -- Extract user ID from path (supports platform/user_id/file and user_id/file)
  user_id_in_path := COALESCE((storage.foldername(file_path))[2], (storage.foldername(file_path))[1]);

  IF NOT user_id_in_path = auth.uid()::text THEN
    RAISE EXCEPTION 'Access denied: can only access own voice notes';
  END IF;

  SELECT storage.get_signed_url('voice-notes', file_path, expires_in) INTO signed_url;
  RETURN signed_url;
END;
$$;

COMMENT ON FUNCTION get_voice_note_signed_url IS 'Generate signed URL for voice-notes only for the owner (auth.uid()).';
