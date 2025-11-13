-- ============================================================================
-- OAuth Tokens and SMS Integration Schema (FIXED for EduDash)
-- ============================================================================
-- Description: Database schema for third-party integrations (Google Calendar, SMS)
-- Dependencies: preschools, auth.users, users table
-- ============================================================================

-- ============================================================================
-- 1. OAuth Tokens Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'stripe')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_preschool ON oauth_tokens(preschool_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);

-- ============================================================================
-- 2. SMS Messages Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'sending', 'sent', 'delivered', 'failed', 'undelivered'
  )),
  error_code TEXT,
  error_message TEXT,
  provider TEXT NOT NULL DEFAULT 'twilio' CHECK (provider IN ('twilio', 'clicksend')),
  provider_message_id TEXT,
  sent_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  segments INTEGER DEFAULT 1,
  cost_per_segment NUMERIC(10, 4),
  total_cost NUMERIC(10, 4) GENERATED ALWAYS AS (segments * COALESCE(cost_per_segment, 0)) STORED
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_preschool ON sms_messages(preschool_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON sms_messages(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_provider_id ON sms_messages(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_to_number ON sms_messages(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages(created_at DESC);

-- ============================================================================
-- 3. SMS Opt-Outs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS sms_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opt_out_method TEXT CHECK (opt_out_method IN ('sms_reply', 'app_settings', 'admin')),
  opted_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(preschool_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_preschool_phone ON sms_opt_outs(preschool_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_active ON sms_opt_outs(preschool_id) WHERE opted_in_at IS NULL;

-- ============================================================================
-- 4. Calendar Events Integration Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS calendar_event_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  internal_event_id UUID,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  external_event_id TEXT NOT NULL,
  external_calendar_id TEXT,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (
    sync_direction IN ('to_external', 'from_external', 'bidirectional')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_mappings_preschool ON calendar_event_mappings(preschool_id);
CREATE INDEX IF NOT EXISTS idx_calendar_mappings_internal_event ON calendar_event_mappings(internal_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_mappings_provider_external ON calendar_event_mappings(provider, external_event_id);

-- ============================================================================
-- 5. Integration Audit Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS integration_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL CHECK (integration_type IN (
    'google_calendar', 'microsoft_teams', 'twilio_sms', 'stripe_payment'
  )),
  action TEXT NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  status_code INTEGER,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_audit_preschool ON integration_audit_log(preschool_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_type_action ON integration_audit_log(integration_type, action);
CREATE INDEX IF NOT EXISTS idx_integration_audit_created_at ON integration_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_audit_user ON integration_audit_log(user_id);

-- ============================================================================
-- 6. Row-Level Security Policies
-- ============================================================================

ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_audit_log ENABLE ROW LEVEL SECURITY;

-- OAuth Tokens Policies
DROP POLICY IF EXISTS oauth_tokens_select_own ON oauth_tokens;
DROP POLICY IF EXISTS oauth_tokens_service_role_all ON oauth_tokens;
DROP POLICY IF EXISTS oauth_tokens_insert_own ON oauth_tokens;
DROP POLICY IF EXISTS oauth_tokens_update_own ON oauth_tokens;
DROP POLICY IF EXISTS oauth_tokens_delete_own ON oauth_tokens;
CREATE POLICY oauth_tokens_select_own ON oauth_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY oauth_tokens_service_role_all ON oauth_tokens
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY oauth_tokens_insert_own ON oauth_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY oauth_tokens_update_own ON oauth_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY oauth_tokens_delete_own ON oauth_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- SMS Messages Policies (FIXED to use users table)
DROP POLICY IF EXISTS sms_messages_select_preschool ON sms_messages;
DROP POLICY IF EXISTS sms_messages_service_role_all ON sms_messages;
DROP POLICY IF EXISTS sms_messages_insert_staff ON sms_messages;
CREATE POLICY sms_messages_select_preschool ON sms_messages
  FOR SELECT
  USING (
    preschool_id IN (
      SELECT preschool_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY sms_messages_service_role_all ON sms_messages
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY sms_messages_insert_staff ON sms_messages
  FOR INSERT
  WITH CHECK (
    preschool_id IN (
      SELECT u.preschool_id FROM users u
      WHERE u.id = auth.uid() 
        AND u.role IN ('principal', 'teacher', 'superadmin')
    )
  );

-- SMS Opt-Outs Policies (FIXED to use users table)
DROP POLICY IF EXISTS sms_opt_outs_select_preschool ON sms_opt_outs;
DROP POLICY IF EXISTS sms_opt_outs_service_role_all ON sms_opt_outs;
DROP POLICY IF EXISTS sms_opt_outs_insert_staff ON sms_opt_outs;
CREATE POLICY sms_opt_outs_select_preschool ON sms_opt_outs
  FOR SELECT
  USING (
    preschool_id IN (
      SELECT preschool_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY sms_opt_outs_service_role_all ON sms_opt_outs
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY sms_opt_outs_insert_staff ON sms_opt_outs
  FOR INSERT
  WITH CHECK (
    preschool_id IN (
      SELECT u.preschool_id FROM users u
      WHERE u.id = auth.uid() 
        AND u.role IN ('principal', 'teacher', 'superadmin')
    )
  );

-- Calendar Event Mappings Policies (FIXED to use users table)
DROP POLICY IF EXISTS calendar_mappings_select_preschool ON calendar_event_mappings;
DROP POLICY IF EXISTS calendar_mappings_service_role_all ON calendar_event_mappings;
DROP POLICY IF EXISTS calendar_mappings_insert_preschool ON calendar_event_mappings;
CREATE POLICY calendar_mappings_select_preschool ON calendar_event_mappings
  FOR SELECT
  USING (
    preschool_id IN (
      SELECT preschool_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY calendar_mappings_service_role_all ON calendar_event_mappings
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY calendar_mappings_insert_preschool ON calendar_event_mappings
  FOR INSERT
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id FROM users WHERE id = auth.uid()
    )
  );

-- Integration Audit Log Policies (FIXED to use users table)
DROP POLICY IF EXISTS integration_audit_select_admin ON integration_audit_log;
DROP POLICY IF EXISTS integration_audit_service_role_all ON integration_audit_log;
CREATE POLICY integration_audit_select_admin ON integration_audit_log
  FOR SELECT
  USING (
    preschool_id IN (
      SELECT u.preschool_id FROM users u
      WHERE u.id = auth.uid() 
        AND u.role IN ('principal', 'superadmin')
    )
  );

CREATE POLICY integration_audit_service_role_all ON integration_audit_log
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 7. Helper Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION is_phone_opted_out(
  p_preschool_id UUID,
  p_phone_number TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM sms_opt_outs
    WHERE preschool_id = p_preschool_id
      AND phone_number = p_phone_number
      AND opted_in_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_valid_oauth_token(
  p_user_id UUID,
  p_provider TEXT
)
RETURNS TABLE (
  access_token TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ot.access_token, ot.expires_at
  FROM oauth_tokens ot
  WHERE ot.user_id = p_user_id
    AND ot.provider = p_provider
    AND ot.expires_at > NOW() + INTERVAL '5 minutes'
  LIMIT 1;
END;
$$;

-- ============================================================================
-- 8. Comments
-- ============================================================================

COMMENT ON TABLE oauth_tokens IS 'OAuth tokens for third-party integrations (Google, Microsoft)';
COMMENT ON TABLE sms_messages IS 'SMS messages sent via Twilio/ClickSend';
COMMENT ON TABLE sms_opt_outs IS 'Phone numbers opted out of SMS notifications';
COMMENT ON TABLE calendar_event_mappings IS 'Maps internal events to external calendar systems';
COMMENT ON TABLE integration_audit_log IS 'Audit trail for third-party API calls';
