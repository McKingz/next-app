-- =====================================================
-- FIX DASH STORAGE BUCKETS - DISABLE AUTH, TENANT ISOLATION ONLY
-- =====================================================
-- Date: 2025-11-08
-- Issue: RLS policy blocking uploads to dash-chat-images and dash-attachments buckets
-- Solution: Allow any authenticated user to upload to their own folder
-- Tenant isolation: Path structure is {user_id}/{filename}
-- =====================================================

-- 1. Ensure dash-chat-images bucket exists and is public for reads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dash-chat-images',
  'dash-chat-images',
  TRUE,  -- Public for reads
  10485760,  -- 10MB limit
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Ensure dash-attachments bucket exists and is public for reads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dash-attachments',
  'dash-attachments',
  TRUE,  -- Public for reads (changed from private)
  2097152,  -- 2MB limit
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Drop all existing policies for dash-chat-images
DROP POLICY IF EXISTS "dash_chat_images_select" ON storage.objects;
DROP POLICY IF EXISTS "dash_chat_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "dash_chat_images_update" ON storage.objects;
DROP POLICY IF EXISTS "dash_chat_images_delete" ON storage.objects;

-- Drop all existing policies for dash-attachments
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Preschool users can view shared attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own attachments" ON storage.objects;

-- 3. DASH-CHAT-IMAGES POLICIES
-- Allow public SELECT (anyone can view images - bucket is public)
CREATE POLICY "dash_chat_images_select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'dash-chat-images');

-- Allow authenticated INSERT to own folder only (tenant isolation)
-- Path structure: {user_id}/{filename}
CREATE POLICY "dash_chat_images_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dash-chat-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated UPDATE to own files only
CREATE POLICY "dash_chat_images_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dash-chat-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'dash-chat-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated DELETE to own files only
CREATE POLICY "dash_chat_images_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'dash-chat-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. DASH-ATTACHMENTS POLICIES
-- Allow public SELECT (anyone can view images - bucket is now public)
CREATE POLICY "dash_attachments_select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'dash-attachments');

-- Allow authenticated INSERT to own folder only (tenant isolation)
-- Path structure: {user_id}/{filename}
CREATE POLICY "dash_attachments_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dash-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated UPDATE to own files only
CREATE POLICY "dash_attachments_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dash-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'dash-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated DELETE to own files only
CREATE POLICY "dash_attachments_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'dash-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check bucket configuration
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id IN ('dash-chat-images', 'dash-attachments')
ORDER BY id;
-- Expected: both buckets with public = true

-- Check policies
SELECT 
  policyname, 
  cmd, 
  roles::text,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND (policyname LIKE 'dash_chat_images_%' OR policyname LIKE 'dash_attachments_%')
ORDER BY policyname, cmd;
-- Expected: 8 policies total (4 for each bucket: SELECT for public, INSERT/UPDATE/DELETE for authenticated with user_id check)

-- =====================================================
-- NOTES
-- =====================================================
-- ✅ Tenant isolation: Users can only upload/modify/delete their own files
-- ✅ Path structure: {user_id}/{filename}
-- ✅ Public reads: Anyone can view images (both buckets are public)
-- ✅ No organization_id needed - user_id provides sufficient isolation
-- ✅ Fixed both dash-chat-images AND dash-attachments buckets
-- =====================================================
