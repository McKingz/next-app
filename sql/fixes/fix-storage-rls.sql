-- Fix RLS policies for voice recording uploads
-- Run this in your Supabase SQL Editor

-- 1. Ensure the voice_recordings bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice_recordings', 'voice_recordings', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies if any
DROP POLICY IF EXISTS "Users can upload their own voice recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own voice recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own voice recordings" ON storage.objects;

-- 3. Allow authenticated users to upload voice recordings
CREATE POLICY "Users can upload their own voice recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice_recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Allow authenticated users to read their own voice recordings
CREATE POLICY "Users can read their own voice recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice_recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Allow authenticated users to delete their own voice recordings
CREATE POLICY "Users can delete their own voice recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice_recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 6. Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verification query - run after applying policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
ORDER BY policyname;
