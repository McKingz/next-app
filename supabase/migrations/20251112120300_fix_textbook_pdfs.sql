-- Fix Textbook PDFs - Supabase Storage Setup and URL Cleanup
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Create Textbooks Storage Bucket
-- ============================================

-- Create public bucket for textbook PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'textbooks',
  'textbooks',
  true,  -- Public access for reading
  52428800,  -- 50MB max file size
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- ============================================
-- STEP 2: Set RLS Policies for Storage
-- ============================================

-- Allow public READ access to all textbook PDFs
CREATE POLICY IF NOT EXISTS "Public read access for textbooks"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'textbooks');

-- Allow authenticated users with admin/superadmin role to UPLOAD
CREATE POLICY IF NOT EXISTS "Admins can upload textbooks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'textbooks' AND
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('superadmin', 'admin', 'principal')
  )
);

-- Allow admins to UPDATE textbook files
CREATE POLICY IF NOT EXISTS "Admins can update textbooks"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'textbooks' AND
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('superadmin', 'admin', 'principal')
  )
);

-- Allow admins to DELETE textbook files
CREATE POLICY IF NOT EXISTS "Admins can delete textbooks"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'textbooks' AND
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('superadmin', 'admin', 'principal')
  )
);

-- ============================================
-- STEP 3: Clean Up Broken PDF URLs
-- ============================================

-- Set broken education.gov.za URLs to NULL
-- UI will show friendly "PDF coming soon" message
UPDATE textbooks 
SET pdf_url = NULL
WHERE pdf_url LIKE '%education.gov.za%'
   OR pdf_url LIKE '%everythingmaths.co.za%/grade-%/pspictures/summary.pdf'
   OR pdf_url LIKE '%everythingscience.co.za%/grade-%/pspictures/summary.pdf';

-- ============================================
-- STEP 4: Verify Changes
-- ============================================

SELECT 
  title,
  grade,
  subject,
  publisher,
  CASE 
    WHEN pdf_url IS NULL THEN '⏳ Pending Upload'
    WHEN pdf_url LIKE '%supabase.co/storage%' THEN '✅ Supabase Storage'
    ELSE '⚠️ External URL'
  END as pdf_status,
  SUBSTRING(pdf_url, 1, 60) as url_preview
FROM textbooks
ORDER BY 
  CASE WHEN pdf_url IS NULL THEN 0 ELSE 1 END,
  grade::int,
  subject;

-- ============================================
-- STEP 5: Add Helper Function for URL Generation
-- ============================================

-- Function to generate Supabase Storage URL for a textbook
CREATE OR REPLACE FUNCTION generate_textbook_storage_url(
  p_textbook_id UUID,
  p_filename TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_url TEXT;
  v_storage_url TEXT;
BEGIN
  -- Get Supabase project URL
  v_project_url := current_setting('app.settings.supabase_url', true);
  
  IF v_project_url IS NULL THEN
    v_project_url := 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
  END IF;
  
  -- Generate storage URL
  v_storage_url := v_project_url || '/storage/v1/object/public/textbooks/' || p_filename;
  
  -- Update textbook record
  UPDATE textbooks
  SET pdf_url = v_storage_url,
      updated_at = NOW()
  WHERE id = p_textbook_id;
  
  RETURN v_storage_url;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_textbook_storage_url TO authenticated, service_role;

-- ============================================
-- USAGE EXAMPLES
-- ============================================

-- After uploading a PDF to Supabase Storage, update the textbook:
-- SELECT generate_textbook_storage_url(
--   'textbook-uuid-here'::UUID,
--   'siyavula-math-grade-10.pdf'
-- );

-- Or update manually:
-- UPDATE textbooks
-- SET pdf_url = 'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-math-grade-10.pdf'
-- WHERE title = 'Mathematics Grade 10' AND publisher = 'Siyavula';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check storage bucket was created
SELECT * FROM storage.buckets WHERE id = 'textbooks';

-- Check policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE '%textbook%';

-- Count textbooks by PDF status
SELECT 
  CASE 
    WHEN pdf_url IS NULL THEN 'No PDF'
    WHEN pdf_url LIKE '%supabase.co/storage%' THEN 'Supabase Storage'
    ELSE 'External URL'
  END as pdf_location,
  COUNT(*) as count
FROM textbooks
GROUP BY 1
ORDER BY 2 DESC;
