-- ============================================================================
-- Supabase Storage Setup for Petty Cash Receipts
-- ============================================================================
-- This sets up secure storage for receipt images with proper RLS policies

-- ============================================================================
-- 1. CREATE STORAGE BUCKET
-- ============================================================================

-- Create the petty-cash-receipts bucket (private)
-- Note: This should be done via Supabase dashboard or API as well
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'petty-cash-receipts',
  'petty-cash-receipts',
  FALSE, -- Private bucket
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/heic']
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. STORAGE RLS POLICIES
-- ============================================================================

-- Enable RLS on storage.objects
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload receipts to their school's folder
DROP POLICY IF EXISTS petty_cash_receipts_upload_policy ON storage.objects;
CREATE POLICY petty_cash_receipts_upload_policy ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'petty-cash-receipts'
  -- Path must start with user's school ID
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text
    FROM preschools AS p
    INNER JOIN users AS u ON p.id = u.preschool_id
    WHERE u.auth_user_id = auth.uid()
  )
  -- Only authenticated users can upload
  AND auth.role() = 'authenticated'
);

-- Policy: Users can view receipts from their school
DROP POLICY IF EXISTS petty_cash_receipts_select_policy ON storage.objects;
CREATE POLICY petty_cash_receipts_select_policy ON storage.objects
FOR SELECT
USING (
  bucket_id = 'petty-cash-receipts'
  -- Path must be from user's school
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text
    FROM preschools AS p
    INNER JOIN users AS u ON p.id = u.preschool_id
    WHERE u.auth_user_id = auth.uid()
  )
  AND auth.role() = 'authenticated'
);

-- Policy: Users can delete their own receipts, admins can delete any in their school
DROP POLICY IF EXISTS petty_cash_receipts_delete_policy ON storage.objects;
CREATE POLICY petty_cash_receipts_delete_policy ON storage.objects
FOR DELETE
USING (
  bucket_id = 'petty-cash-receipts'
  -- Must be from user's school
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text
    FROM preschools AS p
    INNER JOIN users AS u ON p.id = u.preschool_id
    WHERE u.auth_user_id = auth.uid()
  )
  AND (
    -- Own receipts (check via petty_cash_receipts table)
    EXISTS (
      SELECT 1 FROM petty_cash_receipts AS pcr
      WHERE
        pcr.storage_path = storage.objects.name
        AND pcr.created_by = auth.uid()
    )
    -- Admins can delete any receipt in their school
    OR EXISTS (
      SELECT 1 FROM users AS u
      WHERE
        u.auth_user_id = auth.uid()
        AND u.role IN ('principal_admin', 'finance_admin', 'super_admin')
    )
  )
);

-- ============================================================================
-- 3. HELPER FUNCTIONS FOR STORAGE OPERATIONS
-- ============================================================================

-- Generate signed URL for receipt display
-- Note: This would typically be called from the application layer
CREATE OR REPLACE FUNCTION get_receipt_signed_url(
  school_uuid uuid,
  receipt_id uuid,
  expires_in integer DEFAULT 3600 -- 1 hour
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  receipt_path TEXT;
  signed_url TEXT;
BEGIN
  -- Get the storage path for the receipt
  SELECT storage_path INTO receipt_path
  FROM petty_cash_receipts
  WHERE id = receipt_id
    AND school_id = school_uuid;
    
  IF receipt_path IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Generate signed URL (this is a placeholder - actual implementation would use Supabase functions)
  -- In practice, this would be done in the application layer using Supabase client
  -- signed_url := storage.create_signed_url('petty-cash-receipts', receipt_path, expires_in);
  
  -- For now, return the path (actual signing happens in app layer)
  RETURN receipt_path;
END;
$$;

-- Generate upload URL for new receipt
CREATE OR REPLACE FUNCTION generate_receipt_upload_path(
  school_uuid uuid,
  transaction_id uuid,
  file_extension text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  upload_path TEXT;
  timestamp_str TEXT;
  random_suffix TEXT;
BEGIN
  -- Generate timestamp string
  timestamp_str := EXTRACT(EPOCH FROM NOW())::TEXT;
  
  -- Generate random suffix
  random_suffix := substr(md5(random()::text), 1, 8);
  
  -- Create path: school_id/transaction_id/timestamp-random.ext
  upload_path := school_uuid::text || '/' || 
                 transaction_id::text || '/' || 
                 timestamp_str || '-' || random_suffix || '.' || file_extension;
                 
  RETURN upload_path;
END;
$$;

-- ============================================================================
-- 4. STORAGE CLEANUP FUNCTIONS
-- ============================================================================

-- Clean up orphaned storage objects (receipts without database records)
CREATE OR REPLACE FUNCTION cleanup_orphaned_receipts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
  storage_obj RECORD;
BEGIN
  -- Find storage objects that don't have corresponding database records
  FOR storage_obj IN
    SELECT name FROM storage.objects
    WHERE bucket_id = 'petty-cash-receipts'
    AND name NOT IN (
      SELECT storage_path FROM petty_cash_receipts
    )
  LOOP
    -- Delete the storage object
    DELETE FROM storage.objects 
    WHERE bucket_id = 'petty-cash-receipts' 
    AND name = storage_obj.name;
    
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$;

-- Clean up database records without storage objects
CREATE OR REPLACE FUNCTION cleanup_orphaned_receipt_records()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
  receipt_record RECORD;
BEGIN
  -- Find database records that don't have corresponding storage objects
  FOR receipt_record IN
    SELECT id, storage_path FROM petty_cash_receipts
    WHERE storage_path NOT IN (
      SELECT name FROM storage.objects
      WHERE bucket_id = 'petty-cash-receipts'
    )
  LOOP
    -- Delete the database record
    DELETE FROM petty_cash_receipts WHERE id = receipt_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- 5. STORAGE USAGE MONITORING
-- ============================================================================

-- View for storage usage by school
CREATE OR REPLACE VIEW petty_cash_storage_usage AS
SELECT
  pcr.school_id,
  p.name AS school_name,
  count(pcr.id) AS receipt_count,
  sum(pcr.size_bytes) AS total_bytes,
  round(sum(pcr.size_bytes)::numeric / 1048576, 2) AS total_mb,
  avg(pcr.size_bytes) AS avg_file_size,
  max(pcr.created_at) AS last_upload
FROM petty_cash_receipts AS pcr
INNER JOIN preschools AS p ON pcr.school_id = p.id
GROUP BY pcr.school_id, p.name
ORDER BY total_bytes DESC;

-- Function to get storage stats for a school
CREATE OR REPLACE FUNCTION get_school_storage_stats(school_uuid uuid)
RETURNS TABLE (
  receipt_count bigint,
  total_bytes bigint,
  total_mb numeric,
  avg_file_size numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    COUNT(id) as receipt_count,
    SUM(size_bytes) as total_bytes,
    ROUND(SUM(size_bytes)::numeric / 1048576, 2) as total_mb,
    ROUND(AVG(size_bytes)::numeric, 2) as avg_file_size
  FROM petty_cash_receipts
  WHERE school_id = school_uuid;
$$;

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_receipt_signed_url(
  uuid, uuid, integer
) IS 'Generate signed URL for receipt viewing (placeholder for app-layer implementation)';
COMMENT ON FUNCTION generate_receipt_upload_path(
  uuid, uuid, text
) IS 'Generate standardized upload path for new receipts';
COMMENT ON FUNCTION cleanup_orphaned_receipts() IS 'Clean up storage objects without database records';
COMMENT ON FUNCTION cleanup_orphaned_receipt_records() IS 'Clean up database records without storage objects';
COMMENT ON FUNCTION get_school_storage_stats(uuid) IS 'Get storage usage statistics for a school';

COMMENT ON VIEW petty_cash_storage_usage IS 'Storage usage statistics by school for monitoring';

-- Note: Actual signed URL generation should be done in the application layer
-- using the Supabase client's storage.from().createSignedUrl() method
-- This ensures proper authentication and reduces server load
