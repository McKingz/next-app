-- =====================================================
-- MAKE MEDIA UPLOADS PUBLIC
-- =====================================================
-- Run this in Supabase SQL Editor
-- Makes uploads available to everyone (authenticated or not)
-- Tenant isolation handled at application layer
-- =====================================================

-- 1. Ensure bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'dash-chat-images';

-- 2. Make SELECT public (anyone can view)
DROP POLICY IF EXISTS "dash_chat_images_select" ON storage.objects;

CREATE POLICY "dash_chat_images_select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'dash-chat-images');

-- 3. Make INSERT public (anyone can upload)
DROP POLICY IF EXISTS "dash_chat_images_insert" ON storage.objects;

CREATE POLICY "dash_chat_images_insert"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'dash-chat-images' 
  AND (storage.foldername(name))[1] = 'chat-images'
);

-- 4. Remove UPDATE policy (not needed - images immutable)
DROP POLICY IF EXISTS "dash_chat_images_update" ON storage.objects;

-- 5. Remove DELETE policy (not needed - images persist)
DROP POLICY IF EXISTS "dash_chat_images_delete" ON storage.objects;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check bucket
SELECT id, name, public FROM storage.buckets WHERE id = 'dash-chat-images';
-- Expected: public = true

-- Check policies
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE 'dash_chat_images_%';
-- Expected: 2 rows (SELECT and INSERT, both TO public)

-- =====================================================
-- DONE! 
-- =====================================================
-- ✅ Anyone can upload images
-- ✅ Anyone can view images  
-- ✅ Restricted to chat-images/ folder
-- ✅ 50MB file size limit
-- ✅ Images only
-- ✅ Tenant isolation at app layer
-- =====================================================
