-- Add Signature Workflow to Progress Reports
-- Purpose: Enable teacher-principal digital signature approval workflow for Term 2 and School Readiness reports
-- Date: 2025-10-25
-- References:
--   - PostgreSQL CHECK constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
--   - Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security

-- ============================================================================
-- STEP 1: Add Columns for Signature Workflow
-- ============================================================================

-- Status tracking for approval workflow
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' 
CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'sent'));

-- Teacher signature data (base64 encoded image)
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS teacher_signature_data TEXT;

-- Teacher signature timestamp
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS teacher_signed_at TIMESTAMPTZ;

-- Principal signature data (base64 encoded image)
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS principal_signature_data TEXT;

-- Principal signature timestamp
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS principal_signed_at TIMESTAMPTZ;

-- Approval metadata
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);

ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Rejection details
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Submission tracking for resubmissions after rejection
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- STEP 2: Add Column Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN progress_reports.status IS 'Workflow status: draft (teacher editing) | pending_review (submitted to principal) | approved (principal signed) | rejected (needs revision) | sent (delivered to parent)';
COMMENT ON COLUMN progress_reports.teacher_signature_data IS 'Base64 encoded PNG image of teacher digital signature';
COMMENT ON COLUMN progress_reports.teacher_signed_at IS 'Timestamp when teacher signed report before submission';
COMMENT ON COLUMN progress_reports.principal_signature_data IS 'Base64 encoded PNG image of principal digital signature';
COMMENT ON COLUMN progress_reports.principal_signed_at IS 'Timestamp when principal approved and signed report';
COMMENT ON COLUMN progress_reports.reviewed_by IS 'Principal/admin who reviewed and approved/rejected the report';
COMMENT ON COLUMN progress_reports.reviewed_at IS 'Timestamp of approval or rejection';
COMMENT ON COLUMN progress_reports.rejection_reason IS 'Reason provided by principal for rejection (required if rejected)';
COMMENT ON COLUMN progress_reports.review_notes IS 'Optional notes from principal during approval/rejection';
COMMENT ON COLUMN progress_reports.submission_count IS 'Number of times report was submitted (increments on resubmission after rejection)';

-- ============================================================================
-- STEP 3: Create Indexes for Performance
-- ============================================================================

-- Index for filtering by status within a preschool (principal review dashboard)
CREATE INDEX IF NOT EXISTS idx_progress_reports_status 
ON progress_reports(preschool_id, status);

-- Index for filtering by reviewer
CREATE INDEX IF NOT EXISTS idx_progress_reports_reviewed_by 
ON progress_reports(reviewed_by);

-- ============================================================================
-- STEP 4: Backfill Existing Data
-- ============================================================================

-- Set status='sent' for reports already sent to parents (email_sent_at is populated)
UPDATE progress_reports 
SET status = 'sent' 
WHERE email_sent_at IS NOT NULL 
  AND status = 'draft';

-- Set status='draft' for reports with no email sent (ensures all rows have valid status)
UPDATE progress_reports 
SET status = 'draft' 
WHERE email_sent_at IS NULL 
  AND status IS NULL;

-- ============================================================================
-- STEP 5: Update RLS Policies for Workflow Security
-- ============================================================================

-- Drop existing policies to recreate with workflow awareness
DROP POLICY IF EXISTS "Teachers can view their students' reports" ON progress_reports;
DROP POLICY IF EXISTS "Teachers can create reports for their students" ON progress_reports;
DROP POLICY IF EXISTS "Teachers can update their own reports" ON progress_reports;

-- ============================================================================
-- SELECT Policies
-- ============================================================================

-- Teachers can view their own reports regardless of status
CREATE POLICY "Teachers can view their own reports"
ON progress_reports FOR SELECT
USING (
  teacher_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);

-- Principals/admins can view all reports in their preschool
CREATE POLICY "Principals can view all preschool reports"
ON progress_reports FOR SELECT
USING (
  preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('principal', 'principal_admin', 'superadmin')
  )
);

-- Parents can view reports only when status='sent' and linked to their student
CREATE POLICY "Parents can view sent reports for their students"
ON progress_reports FOR SELECT
USING (
  status = 'sent'
  AND student_id IN (
    SELECT id FROM students 
    WHERE parent_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  )
);

-- ============================================================================
-- INSERT Policies
-- ============================================================================

-- Teachers can create reports (always start as 'draft')
CREATE POLICY "Teachers can create reports for their students"
ON progress_reports FOR INSERT
WITH CHECK (
  teacher_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  AND preschool_id IN (
    SELECT preschool_id FROM users WHERE auth_user_id = auth.uid()
  )
  AND status = 'draft'
);

-- ============================================================================
-- UPDATE Policies
-- ============================================================================

-- Teachers can update reports only when status is 'draft' or 'rejected'
CREATE POLICY "Teachers can update draft or rejected reports"
ON progress_reports FOR UPDATE
USING (
  teacher_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  AND status IN ('draft', 'rejected')
  AND preschool_id IN (
    SELECT preschool_id FROM users WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  teacher_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  AND status IN ('draft', 'rejected', 'pending_review')
  AND preschool_id IN (
    SELECT preschool_id FROM users WHERE auth_user_id = auth.uid()
  )
);

-- Principals can update reports in 'pending_review' status (for approval/rejection)
-- CRITICAL: This policy ONLY allows updating approval fields, not content
CREATE POLICY "Principals can review pending reports"
ON progress_reports FOR UPDATE
USING (
  status = 'pending_review'
  AND preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('principal', 'principal_admin', 'superadmin')
  )
)
WITH CHECK (
  status IN ('pending_review', 'approved', 'rejected')
  AND preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('principal', 'principal_admin', 'superadmin')
  )
);

-- Teachers can update approved reports only to mark as 'sent' (no content changes)
CREATE POLICY "Teachers can mark approved reports as sent"
ON progress_reports FOR UPDATE
USING (
  teacher_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  AND status = 'approved'
  AND preschool_id IN (
    SELECT preschool_id FROM users WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  status = 'sent'
  AND preschool_id IN (
    SELECT preschool_id FROM users WHERE auth_user_id = auth.uid()
  )
);

-- ============================================================================
-- DELETE Policies
-- ============================================================================

-- Teachers can delete only draft reports (prevent deletion after submission)
CREATE POLICY "Teachers can delete only draft reports"
ON progress_reports FOR DELETE
USING (
  teacher_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  AND status = 'draft'
  AND preschool_id IN (
    SELECT preschool_id FROM users WHERE auth_user_id = auth.uid()
  )
);

-- Principals can delete any report in their preschool except 'sent' (audit trail)
CREATE POLICY "Principals can delete non-sent reports"
ON progress_reports FOR DELETE
USING (
  preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('principal', 'principal_admin', 'superadmin')
  )
  AND status != 'sent'
);

-- ============================================================================
-- STEP 6: Add Validation Function (Optional - For Future Use)
-- ============================================================================

-- Function to validate workflow transitions (can be called from client or used in triggers)
CREATE OR REPLACE FUNCTION validate_report_status_transition(
  old_status TEXT,
  new_status TEXT,
  user_role TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Teacher transitions
  IF user_role IN ('teacher', 'teacher_assistant') THEN
    -- draft -> pending_review (submit)
    IF old_status = 'draft' AND new_status = 'pending_review' THEN
      RETURN TRUE;
    END IF;
    -- rejected -> pending_review (resubmit)
    IF old_status = 'rejected' AND new_status = 'pending_review' THEN
      RETURN TRUE;
    END IF;
    -- approved -> sent (send to parent)
    IF old_status = 'approved' AND new_status = 'sent' THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Principal transitions
  IF user_role IN ('principal', 'principal_admin', 'superadmin') THEN
    -- pending_review -> approved
    IF old_status = 'pending_review' AND new_status = 'approved' THEN
      RETURN TRUE;
    END IF;
    -- pending_review -> rejected
    IF old_status = 'pending_review' AND new_status = 'rejected' THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- No status change (allowed)
  IF old_status = new_status THEN
    RETURN TRUE;
  END IF;
  
  -- All other transitions denied
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_report_status_transition IS 'Validates that report status transitions follow the defined workflow rules';

-- ============================================================================
-- Migration Complete
-- ============================================================================