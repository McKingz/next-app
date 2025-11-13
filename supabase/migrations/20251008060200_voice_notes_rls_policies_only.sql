-- =============================================
-- Fix Voice Notes Storage RLS Policies (Simplified)
-- Date: 2025-10-08
-- Purpose: Enable authenticated users to upload voice recordings for transcription
-- Issue: Upload fails with "new row violates row-level security policy"
-- Note: Removed ALTER TABLE as it requires owner permissions
-- =============================================

BEGIN;

-- 1. Ensure the voice-notes bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes', 
  'voice-notes', 
  false, -- Keep private for security
  26214400, -- 25MB limit
  ARRAY['audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a'];

-- 2. Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload their own voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own voice notes" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_delete_policy" ON storage.objects;

-- 3. Create INSERT policy - allow authenticated users to upload their own voice notes
CREATE POLICY "voice_notes_insert_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Create SELECT policy - allow users to read their own voice notes
CREATE POLICY "voice_notes_select_policy"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Create UPDATE policy - allow users to update their own voice notes
CREATE POLICY "voice_notes_update_policy"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Create DELETE policy - allow users to delete their own voice notes
CREATE POLICY "voice_notes_delete_policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-notes' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;

-- Verification queries (run these separately to check)
-- SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'voice-notes';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE '%voice%';
