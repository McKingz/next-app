-- Add approval workflow columns to progress_reports table
-- This enables teacher signatures and principal review/approval

-- Create approval status enum
CREATE TYPE approval_status AS ENUM ('draft', 'pending_review', 'approved', 'rejected');

-- Add new columns to progress_reports
ALTER TABLE progress_reports
  ADD COLUMN IF NOT EXISTS approval_status approval_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS teacher_signature TEXT,
  ADD COLUMN IF NOT EXISTS principal_signature TEXT,
  ADD COLUMN IF NOT EXISTS principal_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

-- Create index for faster queries on approval status
CREATE INDEX IF NOT EXISTS idx_progress_reports_approval_status 
  ON progress_reports(approval_status);

-- Create index for principal review queries
CREATE INDEX IF NOT EXISTS idx_progress_reports_pending_review 
  ON progress_reports(preschool_id, approval_status) 
  WHERE approval_status = 'pending_review';

-- Add comment for documentation
COMMENT ON COLUMN progress_reports.approval_status IS 'Current approval status: draft, pending_review, approved, or rejected';
COMMENT ON COLUMN progress_reports.teacher_signature IS 'Base64 encoded teacher signature image';
COMMENT ON COLUMN progress_reports.principal_signature IS 'Base64 encoded principal signature image';
COMMENT ON COLUMN progress_reports.principal_notes IS 'Notes from principal during review (approval or rejection reason)';
COMMENT ON COLUMN progress_reports.reviewed_at IS 'Timestamp when principal reviewed the report';
COMMENT ON COLUMN progress_reports.reviewed_by IS 'User ID of principal who reviewed the report';