-- ================================================
-- Digital Signatures Storage Bucket Migration
-- Creates private storage bucket for user digital signatures
-- ================================================

-- 1) Create private storage bucket for signatures with 1MB file size limit
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signatures',
  'signatures',
  FALSE,
  1048576, -- 1MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- 2) Storage policies for signatures bucket
-- Users can only manage files in their own folder (signatures/{user_id}/*)

-- Allow users to insert their own signatures
DROP POLICY IF EXISTS "Users can upload own signatures" ON storage.objects;
CREATE POLICY "Users can upload own signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signatures'
  AND (SPLIT_PART(name, '/', 1) = auth.uid()::TEXT)
);

-- Allow users to view their own signatures
DROP POLICY IF EXISTS "Users can view own signatures" ON storage.objects;
CREATE POLICY "Users can view own signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (SPLIT_PART(name, '/', 1) = auth.uid()::TEXT)
);

-- Allow users to update their own signatures
DROP POLICY IF EXISTS "Users can update own signatures" ON storage.objects;
CREATE POLICY "Users can update own signatures"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (SPLIT_PART(name, '/', 1) = auth.uid()::TEXT)
)
WITH CHECK (
  bucket_id = 'signatures'
  AND (SPLIT_PART(name, '/', 1) = auth.uid()::TEXT)
);

-- Allow users to delete their own signatures
DROP POLICY IF EXISTS "Users can delete own signatures" ON storage.objects;
CREATE POLICY "Users can delete own signatures"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (SPLIT_PART(name, '/', 1) = auth.uid()::TEXT)
);

-- 3) Comment on the bucket for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets including private signatures bucket for user digital signatures';
