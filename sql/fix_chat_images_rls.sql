-- =====================================================
-- FIX: Grant explicit permissions to anon/authenticated
-- =====================================================
-- The "public" role in policies doesn't work for Supabase anon/authenticated
-- Need to explicitly grant to both roles
-- =====================================================

-- Drop existing public policy
DROP POLICY IF EXISTS "public_chat_images_all" ON storage.objects;

-- Create policy for anon role (unauthenticated)
CREATE POLICY "anon_chat_images_all"
ON storage.objects
FOR ALL
TO anon
USING (bucket_id = 'chat-images')
WITH CHECK (bucket_id = 'chat-images');

-- Create policy for authenticated role
CREATE POLICY "authenticated_chat_images_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'chat-images')
WITH CHECK (bucket_id = 'chat-images');

-- Verify
SELECT policyname, cmd, roles::text 
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage' 
  AND policyname LIKE '%chat_images%'
ORDER BY policyname;
