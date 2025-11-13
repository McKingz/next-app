-- =====================================================
-- FRESH START: Simple Chat Images Storage
-- =====================================================
-- Date: 2025-11-08
-- Create ONE bucket for all image uploads
-- Completely public - no RLS complications
-- =====================================================

-- 1. Drop old buckets (if you want to start fresh)
-- WARNING: This will delete ALL existing images!
-- Uncomment if you want to start completely fresh:
-- DELETE FROM storage.objects WHERE bucket_id IN ('dash-attachments', 'dash-chat-images');
-- DELETE FROM storage.buckets WHERE id IN ('dash-attachments', 'dash-chat-images');

-- 2. Create new simple bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  TRUE,  -- Completely public
  5242880,  -- 5MB limit
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Drop any existing policies for this bucket
DROP POLICY IF EXISTS "public_chat_images_all" ON storage.objects;

-- 4. Create ONE simple policy - allow everything
CREATE POLICY "public_chat_images_all"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'chat-images')
WITH CHECK (bucket_id = 'chat-images');

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'chat-images';
-- Expected: chat-images | chat-images | t | 5242880

SELECT policyname, cmd, roles::text FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage' AND bucket_id = 'chat-images';
-- Expected: public_chat_images_all | ALL | {public}

-- =====================================================
-- DONE!
-- =====================================================
