-- ================================================
-- Digital Signatures Storage Setup
-- Create private bucket and RLS policies for user signatures
-- ================================================

-- 1) Create private bucket for signatures with 1MB size limit
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signatures',
  'signatures',
  FALSE,
  1048576,  -- 1MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 1048576,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];

-- 2) Folder convention: signatures/{user_id}/{filename}.png
-- Allow authenticated users to manage their own folder only

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "insert own signature" ON storage.objects;
DROP POLICY IF EXISTS "select own signature" ON storage.objects;
DROP POLICY IF EXISTS "update own signature" ON storage.objects;
DROP POLICY IF EXISTS "delete own signature" ON storage.objects;

-- Policy for inserting own signature files
CREATE POLICY "insert own signature"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signatures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for selecting own signature files
CREATE POLICY "select own signature"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for updating own signature files
CREATE POLICY "update own signature"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'signatures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for deleting own signature files
CREATE POLICY "delete own signature"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) Optional: Create helper function for generating signed URLs for signatures
CREATE OR REPLACE FUNCTION get_signature_signed_url(file_path text, expires_in integer DEFAULT 3600)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  signed_url TEXT;
BEGIN
  -- Only allow users to get signed URLs for their own signatures
  IF NOT (storage.foldername(file_path))[1] = auth.uid()::text THEN
    RAISE EXCEPTION 'Access denied: can only access own signatures';
  END IF;
  
  -- Generate signed URL
  SELECT storage.get_signed_url('signatures', file_path, expires_in) INTO signed_url;
  
  RETURN signed_url;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_signature_signed_url IS 'Helper function to generate signed URLs for user signatures with access control';
