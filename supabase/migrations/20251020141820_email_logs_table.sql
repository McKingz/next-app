-- Email Logs Table
-- Tracks all emails sent through the system for auditing and rate limiting

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL, -- Email address(es) - comma separated if multiple
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'test_mode', 'queued')),
  message_id TEXT, -- Provider's message ID (e.g., Resend)
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT email_logs_organization_id_fkey FOREIGN KEY (organization_id) 
    REFERENCES preschools(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_organization_created 
  ON email_logs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_created 
  ON email_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_status 
  ON email_logs(status);

-- RLS Policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Users can view email logs from their organization
DROP POLICY IF EXISTS "Users can view their organization's email logs" ON email_logs;
CREATE POLICY "Users can view their organization's email logs"
  ON email_logs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT preschool_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Only principals and admins can view all logs (teachers see only their own)
DROP POLICY IF EXISTS "Teachers can view their own email logs" ON email_logs;
CREATE POLICY "Teachers can view their own email logs"
  ON email_logs
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'principal_admin', 'superadmin')
    )
  );

-- System can insert logs (service role)
DROP POLICY IF EXISTS "Service role can insert email logs" ON email_logs;
CREATE POLICY "Service role can insert email logs"
  ON email_logs
  FOR INSERT
  WITH CHECK (true);

-- Comment
COMMENT ON TABLE email_logs IS 'Audit log for all emails sent through the system. Used for rate limiting and compliance.';
COMMENT ON COLUMN email_logs.status IS 'Email delivery status: sent, failed, test_mode, queued';
COMMENT ON COLUMN email_logs.metadata IS 'Additional context: resend response, error details, etc.';