-- Attachments Storage Setup - allow user-scoped uploads for chat attachments
-- Date: 2025-10-07
-- Bucket: attachments (private)
-- Path convention: {auth.uid()}/{conversation_id}/{filename}

-- 1) Create private attachments bucket with 50MB limit and common document/image/audio types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  FALSE,
  52428800,
  ARRAY[
    -- documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    -- images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    -- audio (some chats upload audio notes as attachments too)
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/ogg',
    'audio/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) RLS policies: authenticated users can only manage files under their own uid folder
--    Required path structure: {auth.uid()}/{conversation_id}/...
--    First folder segment must equal auth.uid().

-- Clean up any preexisting attachment policies (idempotent safety)
DROP POLICY IF EXISTS "attachments_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "attachments_select_own" ON storage.objects;
DROP POLICY IF EXISTS "attachments_update_own" ON storage.objects;
DROP POLICY IF EXISTS "attachments_delete_own" ON storage.objects;

-- INSERT
CREATE POLICY "attachments_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT
CREATE POLICY "attachments_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE
CREATE POLICY "attachments_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE
CREATE POLICY "attachments_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
