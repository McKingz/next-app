-- =====================================================
-- SIMPLE PUBLIC STORAGE - NO RLS POLICIES
-- =====================================================
-- Date: 2025-11-08
-- Approach: Make buckets completely public, disable RLS
-- Result: Anyone can upload/read/delete without authentication
-- Trade-off: No tenant isolation, but no RLS headaches
-- =====================================================

-- 1. Make buckets public
UPDATE storage.buckets 
SET public = TRUE 
WHERE id IN ('dash-attachments', 'dash-chat-images');

-- 2. Drop ALL existing policies for these buckets
DROP POLICY IF EXISTS "dash_chat_images_select" ON storage.objects;
DROP POLICY IF EXISTS "dash_chat_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "dash_chat_images_update" ON storage.objects;
DROP POLICY IF EXISTS "dash_chat_images_delete" ON storage.objects;

DROP POLICY IF EXISTS "dash_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "dash_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "dash_attachments_update" ON storage.objects;
DROP POLICY IF EXISTS "dash_attachments_delete" ON storage.objects;

-- 3. Create simple public policies (no auth checks)
CREATE POLICY "public_dash_chat_images_all"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'dash-chat-images')
WITH CHECK (bucket_id = 'dash-chat-images');

CREATE POLICY "public_dash_attachments_all"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'dash-attachments')
WITH CHECK (bucket_id = 'dash-attachments');

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT id, name, public FROM storage.buckets 
WHERE id IN ('dash-attachments', 'dash-chat-images');
-- Expected: both buckets with public = true

SELECT policyname, cmd, roles::text FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND (policyname LIKE '%dash_chat_images%' OR policyname LIKE '%dash_attachments%')
ORDER BY policyname;
-- Expected: 2 simple policies (one per bucket, FOR ALL)

-- =====================================================
-- NOTES
-- =====================================================
-- ✅ No authentication required
-- ✅ No tenant isolation (everyone can access everything)
-- ✅ Simple and works immediately
-- ⚠️  Security: Anyone can upload/delete files
-- ⚠️  Consider adding rate limiting at API gateway level
-- =====================================================
