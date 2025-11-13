-- Allow staff to insert audit entries for their own preschool
-- Ensures RLS permits client-side inserts into integration_audit_log

-- Enable RLS (idempotent)
ALTER TABLE IF EXISTS integration_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow principals, teachers, and superadmins to insert rows scoped to their preschool
DROP POLICY IF EXISTS integration_audit_insert_staff ON integration_audit_log;
CREATE POLICY integration_audit_insert_staff ON integration_audit_log
FOR INSERT
WITH CHECK (
  preschool_id IN (
    SELECT users.preschool_id FROM users
    WHERE users.id = auth.uid()
      AND users.role IN ('principal', 'teacher', 'superadmin')
  )
);

-- Optional: index to keep preschool-scoped queries fast
CREATE INDEX IF NOT EXISTS idx_integration_audit_log_preschool
  ON integration_audit_log(preschool_id);
