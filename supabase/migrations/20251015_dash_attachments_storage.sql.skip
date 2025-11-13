-- Create dash-attachments storage bucket for Dash AI image attachments
-- Migration: 20251015_dash_attachments_storage

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dash-attachments',
  'dash-attachments',
  false,  -- Private bucket (requires authentication)
  2097152,  -- 2MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload their own attachments
CREATE POLICY "Users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dash-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can read their own attachments
CREATE POLICY "Users can view own attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dash-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users within same preschool can view attachments (for shared conversations)
CREATE POLICY "Preschool users can view shared attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dash-attachments' AND
  EXISTS (
    SELECT 1 FROM public.users u1, public.users u2
    WHERE u1.auth_user_id = auth.uid()
      AND u2.auth_user_id::text = (storage.foldername(name))[1]
      AND u1.preschool_id = u2.preschool_id
      AND u1.preschool_id IS NOT NULL
  )
);

-- Policy: Users can delete their own attachments
CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dash-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own attachments
CREATE POLICY "Users can update own attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dash-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create index on bucket_id for faster queries
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id
ON storage.objects(bucket_id);
