-- ============================================================================
-- Create Petty Cash Receipts Table Migration
-- ============================================================================
-- Creates the missing petty_cash_receipts table for storing receipt attachments

-- Create petty cash receipts table
CREATE TABLE IF NOT EXISTS petty_cash_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES petty_cash_transactions (id) ON DELETE CASCADE,

  -- File details
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  file_name TEXT NOT NULL,
  original_name TEXT, -- User's original filename
  content_type TEXT,
  size_bytes BIGINT,

  -- Upload details
  created_by UUID NOT NULL REFERENCES auth.users (id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Constraints
  CONSTRAINT petty_cash_receipts_positive_size CHECK (size_bytes IS NULL OR size_bytes > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_petty_cash_receipts_transaction_id ON petty_cash_receipts (transaction_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_receipts_school_id ON petty_cash_receipts (school_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_receipts_created_by ON petty_cash_receipts (created_by);
CREATE INDEX IF NOT EXISTS idx_petty_cash_receipts_created_at ON petty_cash_receipts (created_at DESC);

-- Enable RLS
ALTER TABLE petty_cash_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for petty_cash_receipts
-- Users can view receipts from their school
CREATE POLICY petty_cash_receipts_select_policy ON petty_cash_receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE
      auth_user_id = auth.uid()
      AND preschool_id = school_id
  )
);

-- Users can insert receipts for their school's transactions
CREATE POLICY petty_cash_receipts_insert_policy ON petty_cash_receipts
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM users
    WHERE
      auth_user_id = auth.uid()
      AND preschool_id = school_id
  )
  AND EXISTS (
    SELECT 1 FROM petty_cash_transactions AS t
    WHERE
      t.id = t.transaction_id
      AND t.school_id = petty_cash_receipts.school_id
  )
);

-- Users can delete their own receipts or admins can delete any from their school
CREATE POLICY petty_cash_receipts_delete_policy ON petty_cash_receipts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE
      auth_user_id = auth.uid()
      AND preschool_id = school_id
      AND (
        created_by = auth.uid()
        OR role IN ('principal_admin', 'finance_admin')
      )
  )
);

-- Create storage bucket for receipts if it doesn't exist
-- Note: This will be handled separately in Supabase Storage configuration

-- Comments for documentation
COMMENT ON TABLE petty_cash_receipts IS 'Receipt attachments for petty cash transactions';
COMMENT ON COLUMN petty_cash_receipts.storage_path IS 'Path to file in Supabase Storage';
COMMENT ON COLUMN petty_cash_receipts.metadata IS 'Additional receipt data as JSON';
COMMENT ON COLUMN petty_cash_receipts.original_name IS 'Original filename from user upload';
