-- Ensure critical objects exist and policies are correct (idempotent)
-- 1) RPC to update last login
CREATE OR REPLACE FUNCTION public.update_user_last_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET last_login_at = NOW(),
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_user_last_login() TO authenticated;

-- 2) OAuth/SMS/Calendar/Integration tables RLS and policies (drop then recreate)
ALTER TABLE IF EXISTS oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sms_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS calendar_event_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS integration_audit_log ENABLE ROW LEVEL SECURITY;

-- OAuth tokens
DROP POLICY IF EXISTS oauth_tokens_select_own ON oauth_tokens;
DROP POLICY IF EXISTS oauth_tokens_service_role_all ON oauth_tokens;
DROP POLICY IF EXISTS oauth_tokens_insert_own ON oauth_tokens;
DROP POLICY IF EXISTS oauth_tokens_update_own ON oauth_tokens;
DROP POLICY IF EXISTS oauth_tokens_delete_own ON oauth_tokens;
CREATE POLICY oauth_tokens_select_own ON oauth_tokens
FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY oauth_tokens_service_role_all ON oauth_tokens
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY oauth_tokens_insert_own ON oauth_tokens
FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY oauth_tokens_update_own ON oauth_tokens
FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY oauth_tokens_delete_own ON oauth_tokens
FOR DELETE USING (auth.uid() = user_id);

-- SMS messages (fixed to use users table)
DROP POLICY IF EXISTS sms_messages_select_preschool ON sms_messages;
DROP POLICY IF EXISTS sms_messages_service_role_all ON sms_messages;
DROP POLICY IF EXISTS sms_messages_insert_staff ON sms_messages;
CREATE POLICY sms_messages_select_preschool ON sms_messages
FOR SELECT
USING (
  preschool_id IN (
    SELECT preschool_id FROM users
    WHERE id = auth.uid()
  )
);
CREATE POLICY sms_messages_service_role_all ON sms_messages
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY sms_messages_insert_staff ON sms_messages
FOR INSERT
WITH CHECK (
  preschool_id IN (
    SELECT users.preschool_id FROM users
    WHERE
      users.id = auth.uid()
      AND users.role IN ('principal', 'teacher', 'superadmin')
  )
);

-- SMS opt-outs (fixed to use users table)
DROP POLICY IF EXISTS sms_opt_outs_select_preschool ON sms_opt_outs;
DROP POLICY IF EXISTS sms_opt_outs_service_role_all ON sms_opt_outs;
DROP POLICY IF EXISTS sms_opt_outs_insert_staff ON sms_opt_outs;
CREATE POLICY sms_opt_outs_select_preschool ON sms_opt_outs
FOR SELECT
USING (
  preschool_id IN (
    SELECT preschool_id FROM users
    WHERE id = auth.uid()
  )
);
CREATE POLICY sms_opt_outs_service_role_all ON sms_opt_outs
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY sms_opt_outs_insert_staff ON sms_opt_outs
FOR INSERT
WITH CHECK (
  preschool_id IN (
    SELECT users.preschool_id FROM users
    WHERE
      users.id = auth.uid()
      AND users.role IN ('principal', 'teacher', 'superadmin')
  )
);

-- Calendar mappings (fixed to use users table)
DROP POLICY IF EXISTS calendar_mappings_select_preschool ON calendar_event_mappings;
DROP POLICY IF EXISTS calendar_mappings_service_role_all ON calendar_event_mappings;
DROP POLICY IF EXISTS calendar_mappings_insert_preschool ON calendar_event_mappings;
CREATE POLICY calendar_mappings_select_preschool ON calendar_event_mappings
FOR SELECT
USING (
  preschool_id IN (
    SELECT preschool_id FROM users
    WHERE id = auth.uid()
  )
);
CREATE POLICY calendar_mappings_service_role_all ON calendar_event_mappings
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY calendar_mappings_insert_preschool ON calendar_event_mappings
FOR INSERT
WITH CHECK (
  preschool_id IN (
    SELECT preschool_id FROM users
    WHERE id = auth.uid()
  )
);

-- Integration audit log (fixed to use users table)
DROP POLICY IF EXISTS integration_audit_select_admin ON integration_audit_log;
DROP POLICY IF EXISTS integration_audit_service_role_all ON integration_audit_log;
CREATE POLICY integration_audit_select_admin ON integration_audit_log
FOR SELECT
USING (
  preschool_id IN (
    SELECT users.preschool_id FROM users
    WHERE
      users.id = auth.uid()
      AND users.role IN ('principal', 'superadmin')
  )
);
CREATE POLICY integration_audit_service_role_all ON integration_audit_log
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
