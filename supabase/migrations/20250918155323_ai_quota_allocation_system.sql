-- AI Quota Allocation System Migration
-- Supports school-level AI quotas and teacher allocations
-- Complies with WARP.md Golden Rule: Students, Teachers, and Parents First
-- Enforces multi-tenant security with RLS policies

-- =========================================================================
-- 1. SCHOOL AI SUBSCRIPTION TABLE
-- =========================================================================
-- Tracks school-wide AI quotas and allocation settings
CREATE TABLE school_ai_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL CHECK (subscription_tier IN ('free', 'basic', 'pro', 'premium', 'enterprise')),
  org_type TEXT NOT NULL CHECK (org_type IN ('preschool', 'k12', 'individual')),
  
  -- Total quotas purchased by the school (JSON for flexibility)
  total_quotas JSONB NOT NULL DEFAULT '{"claude_messages": 0, "content_generation": 0, "assessment_ai": 0}',
  
  -- Quotas already allocated to staff
  allocated_quotas JSONB NOT NULL DEFAULT '{"claude_messages": 0, "content_generation": 0, "assessment_ai": 0}',
  
  -- Usage across all staff this period
  total_usage JSONB NOT NULL DEFAULT '{"claude_messages": 0, "content_generation": 0, "assessment_ai": 0}',
  
  -- Admin settings for allocation management
  allow_teacher_self_allocation BOOLEAN NOT NULL DEFAULT false,
  default_teacher_quotas JSONB NOT NULL DEFAULT '{"claude_messages": 10, "content_generation": 5, "assessment_ai": 3}',
  max_individual_quota JSONB NOT NULL DEFAULT '{"claude_messages": 100, "content_generation": 50, "assessment_ai": 30}',
  
  -- Billing cycle tracking
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  UNIQUE(preschool_id),
  CONSTRAINT positive_quotas CHECK (
    (total_quotas->>'claude_messages')::int >= 0 AND
    (total_quotas->>'content_generation')::int >= 0 AND
    (total_quotas->>'assessment_ai')::int >= 0
  ),
  CONSTRAINT allocated_within_total CHECK (
    (allocated_quotas->>'claude_messages')::int <= (total_quotas->>'claude_messages')::int AND
    (allocated_quotas->>'content_generation')::int <= (total_quotas->>'content_generation')::int AND
    (allocated_quotas->>'assessment_ai')::int <= (total_quotas->>'assessment_ai')::int
  )
);

-- =========================================================================
-- 2. TEACHER AI ALLOCATION TABLE
-- =========================================================================
-- Individual teacher quota allocations within schools
CREATE TABLE teacher_ai_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- User info (denormalized for performance)
  teacher_name TEXT NOT NULL,
  teacher_email TEXT NOT NULL,
  role TEXT NOT NULL,
  
  -- Quota allocation (JSON for flexibility)
  allocated_quotas JSONB NOT NULL DEFAULT '{"claude_messages": 0, "content_generation": 0, "assessment_ai": 0}',
  used_quotas JSONB NOT NULL DEFAULT '{"claude_messages": 0, "content_generation": 0, "assessment_ai": 0}',
  
  -- Allocation metadata
  allocated_by UUID NOT NULL REFERENCES users(id),
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  allocation_reason TEXT,
  
  -- Status management
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  suspension_reason TEXT,
  
  -- Auto-allocation settings
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  priority_level TEXT NOT NULL DEFAULT 'normal' CHECK (priority_level IN ('low', 'normal', 'high')),
  
  -- Billing period tracking
  period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(preschool_id, user_id, period_start), -- One allocation per user per period
  CONSTRAINT positive_allocations CHECK (
    (allocated_quotas->>'claude_messages')::int >= 0 AND
    (allocated_quotas->>'content_generation')::int >= 0 AND
    (allocated_quotas->>'assessment_ai')::int >= 0
  ),
  CONSTRAINT usage_within_allocation CHECK (
    (used_quotas->>'claude_messages')::int <= (allocated_quotas->>'claude_messages')::int AND
    (used_quotas->>'content_generation')::int <= (allocated_quotas->>'content_generation')::int AND
    (used_quotas->>'assessment_ai')::int <= (allocated_quotas->>'assessment_ai')::int
  )
);

-- =========================================================================
-- 3. ALLOCATION REQUEST TABLE
-- =========================================================================
-- Teacher requests for quota allocation (if self-service enabled)
CREATE TABLE ai_allocation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Request details
  requested_quotas JSONB NOT NULL,
  justification TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'normal', 'high')),
  auto_approve_similar BOOLEAN NOT NULL DEFAULT false,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  
  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 4. ALLOCATION HISTORY TABLE
-- =========================================================================
-- Audit trail for all allocation changes
CREATE TABLE ai_allocation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Action details
  action TEXT NOT NULL CHECK (action IN ('allocate', 'revoke', 'increase', 'decrease', 'suspend', 'reactivate')),
  quotas_changed JSONB NOT NULL,
  previous_quotas JSONB,
  new_quotas JSONB,
  
  -- Audit metadata
  performed_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 5. ENHANCED AI USAGE LOGS TABLE
-- =========================================================================
-- Extend existing ai_usage_logs with allocation tracking
-- Note: Assumes ai_usage_logs already exists from previous migration
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS allocation_id UUID REFERENCES teacher_ai_allocations(id);
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS quota_consumed_from TEXT CHECK (quota_consumed_from IN ('claude_messages', 'content_generation', 'assessment_ai'));
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS school_total_usage JSONB; -- Snapshot of school usage at time of request
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS teacher_remaining_quota JSONB; -- Snapshot of teacher remaining quota

-- =========================================================================
-- 6. PERFORMANCE INDEXES
-- =========================================================================
-- School AI Subscription indexes
CREATE INDEX idx_school_ai_subscriptions_preschool_id ON school_ai_subscriptions(preschool_id);
CREATE INDEX idx_school_ai_subscriptions_tier_org ON school_ai_subscriptions(subscription_tier, org_type);
CREATE INDEX idx_school_ai_subscriptions_period ON school_ai_subscriptions(current_period_start, current_period_end);

-- Teacher AI Allocation indexes
CREATE INDEX idx_teacher_ai_allocations_preschool_id ON teacher_ai_allocations(preschool_id);
CREATE INDEX idx_teacher_ai_allocations_user_id ON teacher_ai_allocations(user_id);
CREATE INDEX idx_teacher_ai_allocations_period ON teacher_ai_allocations(preschool_id, period_start, period_end);
CREATE INDEX idx_teacher_ai_allocations_active ON teacher_ai_allocations(preschool_id, is_active) WHERE is_active = true;
CREATE INDEX idx_teacher_ai_allocations_priority ON teacher_ai_allocations(preschool_id, priority_level) WHERE is_active = true;

-- Allocation Request indexes
CREATE INDEX idx_ai_allocation_requests_preschool_id ON ai_allocation_requests(preschool_id);
CREATE INDEX idx_ai_allocation_requests_status ON ai_allocation_requests(preschool_id, status);
CREATE INDEX idx_ai_allocation_requests_urgency ON ai_allocation_requests(preschool_id, urgency, status) WHERE status = 'pending';
CREATE INDEX idx_ai_allocation_requests_expires ON ai_allocation_requests(expires_at) WHERE status = 'pending';

-- Allocation History indexes
CREATE INDEX idx_ai_allocation_history_preschool_id ON ai_allocation_history(preschool_id);
CREATE INDEX idx_ai_allocation_history_teacher_id ON ai_allocation_history(teacher_id);
CREATE INDEX idx_ai_allocation_history_action_time ON ai_allocation_history(preschool_id, action, created_at DESC);

-- Enhanced AI Usage Logs indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_allocation_id ON ai_usage_logs(allocation_id) WHERE allocation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_quota_type ON ai_usage_logs(preschool_id, quota_consumed_from, created_at DESC) WHERE quota_consumed_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_date ON ai_usage_logs(preschool_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at DESC);

-- =========================================================================
-- 7. DAILY ROLLUP VIEWS
-- =========================================================================
-- Daily usage aggregation for faster reporting
CREATE OR REPLACE VIEW daily_ai_usage_rollup AS
SELECT 
  preschool_id,
  user_id,
  date_trunc('day', created_at) AS usage_date,
  quota_consumed_from,
  COUNT(*) AS request_count,
  SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS total_tokens,
  AVG(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS avg_tokens_per_request,
  SUM(COALESCE(response_time_ms, 0)) AS total_processing_time,
  AVG(COALESCE(response_time_ms, 0)) AS avg_processing_time,
  SUM(COALESCE(total_cost, 0)) AS total_cost
FROM ai_usage_logs
WHERE quota_consumed_from IS NOT NULL
GROUP BY preschool_id, user_id, date_trunc('day', created_at), quota_consumed_from;

-- Monthly rollup for even faster historical reporting
CREATE OR REPLACE VIEW monthly_ai_usage_rollup AS
SELECT 
  preschool_id,
  user_id,
  date_trunc('month', created_at) AS usage_month,
  quota_consumed_from,
  COUNT(*) AS request_count,
  SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS total_tokens,
  AVG(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS avg_tokens_per_request,
  SUM(COALESCE(response_time_ms, 0)) AS total_processing_time,
  AVG(COALESCE(response_time_ms, 0)) AS avg_processing_time,
  SUM(COALESCE(total_cost, 0)) AS total_cost
FROM ai_usage_logs
WHERE quota_consumed_from IS NOT NULL
GROUP BY preschool_id, user_id, date_trunc('month', created_at), quota_consumed_from;

-- School-level daily aggregation
CREATE OR REPLACE VIEW school_daily_ai_usage AS
SELECT 
  preschool_id,
  date_trunc('day', created_at) AS usage_date,
  quota_consumed_from,
  COUNT(*) AS total_requests,
  COUNT(DISTINCT user_id) AS active_users,
  SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS total_tokens,
  AVG(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS avg_tokens_per_request,
  SUM(COALESCE(response_time_ms, 0)) AS total_processing_time,
  SUM(COALESCE(total_cost, 0)) AS total_cost
FROM ai_usage_logs
WHERE quota_consumed_from IS NOT NULL
GROUP BY preschool_id, date_trunc('day', created_at), quota_consumed_from;

-- =========================================================================
-- 8. RLS POLICIES (Multi-tenant Security)
-- =========================================================================
-- Enable RLS on all new tables
ALTER TABLE school_ai_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_ai_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_allocation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_allocation_history ENABLE ROW LEVEL SECURITY;

-- School AI Subscriptions policies
CREATE POLICY "Users can view their school's AI subscription"
  ON school_ai_subscriptions FOR SELECT
  USING (preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Principals can manage their school's AI subscription"
  ON school_ai_subscriptions FOR ALL
  USING (preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('principal', 'principal_admin', 'super_admin')
  ));

-- Teacher AI Allocations policies
CREATE POLICY "Teachers can view their own allocation"
  ON teacher_ai_allocations FOR SELECT
  USING (user_id IN (
    SELECT id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Principals can view all school allocations"
  ON teacher_ai_allocations FOR SELECT
  USING (preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('principal', 'principal_admin', 'super_admin')
  ));

CREATE POLICY "Principals can manage all school allocations"
  ON teacher_ai_allocations FOR INSERT
  WITH CHECK (preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('principal', 'principal_admin', 'super_admin')
  ));

CREATE POLICY "Principals can update all school allocations"
  ON teacher_ai_allocations FOR UPDATE
  USING (preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('principal', 'principal_admin', 'super_admin')
  ));

-- Allocation Request policies
CREATE POLICY "Teachers can view their own requests"
  ON ai_allocation_requests FOR SELECT
  USING (requested_by IN (
    SELECT id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Principals can view all school requests"
  ON ai_allocation_requests FOR SELECT
  USING (preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('principal', 'principal_admin', 'super_admin')
  ));

CREATE POLICY "Teachers can create allocation requests"
  ON ai_allocation_requests FOR INSERT
  WITH CHECK (preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Principals can update requests (approve/reject)"
  ON ai_allocation_requests FOR UPDATE
  USING (preschool_id IN (
    SELECT preschool_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('principal', 'principal_admin', 'super_admin')
  ));

-- Allocation History policies (read-only audit trail)
CREATE POLICY "Users can view relevant allocation history"
  ON ai_allocation_history FOR SELECT
  USING (
    -- Teachers can see their own history
    teacher_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
    OR
    -- Principals can see all school history
    preschool_id IN (
      SELECT preschool_id FROM users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('principal', 'principal_admin', 'super_admin')
    )
  );

-- =========================================================================
-- 9. HELPER FUNCTIONS
-- =========================================================================

-- Function to automatically update allocated_quotas in school_ai_subscriptions
CREATE OR REPLACE FUNCTION update_school_allocated_quotas()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate total allocated quotas for the school
  UPDATE school_ai_subscriptions 
  SET 
    allocated_quotas = (
      SELECT COALESCE((
        SELECT jsonb_object_agg(
          quota_type, 
          COALESCE(SUM((allocated_quotas->>quota_type)::int), 0)
        )
        FROM teacher_ai_allocations ta,
        jsonb_object_keys(ta.allocated_quotas) AS quota_type
        WHERE ta.preschool_id = NEW.preschool_id 
        AND ta.is_active = true
        AND ta.period_start <= now()
        AND ta.period_end > now()
        GROUP BY quota_type
      ), '{"claude_messages": 0, "content_generation": 0, "assessment_ai": 0}'::jsonb)
    ),
    updated_at = now()
  WHERE preschool_id = NEW.preschool_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update school quotas when teacher allocations change
CREATE TRIGGER trigger_update_school_allocated_quotas
  AFTER INSERT OR UPDATE OR DELETE ON teacher_ai_allocations
  FOR EACH ROW EXECUTE FUNCTION update_school_allocated_quotas();

-- Function to track allocation history
CREATE OR REPLACE FUNCTION log_allocation_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ai_allocation_history (
      preschool_id, teacher_id, action, quotas_changed, 
      previous_quotas, new_quotas, performed_by, reason
    ) VALUES (
      NEW.preschool_id, NEW.user_id, 'allocate', NEW.allocated_quotas,
      '{}'::jsonb, NEW.allocated_quotas, NEW.allocated_by, 
      COALESCE(NEW.allocation_reason, 'Initial allocation')
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine the action based on changes
    DECLARE
      action_type TEXT := 'increase';
      changed_quotas JSONB;
    BEGIN
      -- Calculate quota changes
      SELECT jsonb_object_agg(
        key, 
        (NEW.allocated_quotas->>key)::int - (OLD.allocated_quotas->>key)::int
      ) INTO changed_quotas
      FROM jsonb_object_keys(NEW.allocated_quotas) AS key;
      
      -- Determine action type
      IF NEW.is_suspended = true AND OLD.is_suspended = false THEN
        action_type := 'suspend';
      ELSIF NEW.is_suspended = false AND OLD.is_suspended = true THEN
        action_type := 'reactivate';
      ELSIF EXISTS (
        SELECT 1 FROM jsonb_each_text(changed_quotas) 
        WHERE value::int < 0
      ) THEN
        action_type := 'decrease';
      END IF;
      
      INSERT INTO ai_allocation_history (
        preschool_id, teacher_id, action, quotas_changed,
        previous_quotas, new_quotas, performed_by, reason
      ) VALUES (
        NEW.preschool_id, NEW.user_id, action_type, changed_quotas,
        OLD.allocated_quotas, NEW.allocated_quotas, 
        -- Get current user from session or use allocated_by
        COALESCE(
          (SELECT id FROM users WHERE auth_user_id = auth.uid()),
          NEW.allocated_by
        ), 
        COALESCE(NEW.allocation_reason, 'Allocation updated')
      );
    END;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO ai_allocation_history (
      preschool_id, teacher_id, action, quotas_changed,
      previous_quotas, new_quotas, performed_by, reason
    ) VALUES (
      OLD.preschool_id, OLD.user_id, 'revoke', OLD.allocated_quotas,
      OLD.allocated_quotas, '{}'::jsonb, 
      -- Get current user from session or use allocated_by
      COALESCE(
        (SELECT id FROM users WHERE auth_user_id = auth.uid()),
        OLD.allocated_by
      ), 
      'Allocation revoked'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to log all allocation changes
CREATE TRIGGER trigger_log_allocation_change
  AFTER INSERT OR UPDATE OR DELETE ON teacher_ai_allocations
  FOR EACH ROW EXECUTE FUNCTION log_allocation_change();

-- Function to expire old allocation requests
CREATE OR REPLACE FUNCTION expire_old_allocation_requests()
RETURNS void AS $$
BEGIN
  UPDATE ai_allocation_requests 
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 10. INITIAL DATA SETUP
-- =========================================================================

-- Create default school AI subscriptions for existing schools
-- This ensures all schools have a subscription record
-- Note: All organizations in this system are preschools, so defaulting to preschool type
INSERT INTO school_ai_subscriptions (
  preschool_id, 
  subscription_tier, 
  org_type,
  total_quotas,
  allow_teacher_self_allocation
)
SELECT 
  p.id,
  COALESCE(p.subscription_tier, 'free') as subscription_tier,
  'preschool'::TEXT as org_type, -- All entries in preschools table are preschools
  CASE 
    WHEN COALESCE(p.subscription_tier, 'free') IN ('pro', 'premium', 'enterprise') 
    THEN '{"claude_messages": 100, "content_generation": 50, "assessment_ai": 25}'::jsonb
    ELSE '{"claude_messages": 20, "content_generation": 10, "assessment_ai": 5}'::jsonb
  END as total_quotas,
  CASE 
    WHEN COALESCE(p.subscription_tier, 'free') IN ('premium', 'enterprise') THEN true
    ELSE false
  END as allow_teacher_self_allocation
FROM preschools p
WHERE NOT EXISTS (
  SELECT 1 FROM school_ai_subscriptions s WHERE s.preschool_id = p.id
);

-- =========================================================================
-- 11. COMMENTS AND DOCUMENTATION
-- =========================================================================

COMMENT ON TABLE school_ai_subscriptions IS 'School-wide AI subscription and quota management. Supports allocation to teachers based on subscription tier and organization type.';
COMMENT ON TABLE teacher_ai_allocations IS 'Individual teacher AI quota allocations within schools. Tracks usage and remaining quotas per billing period.';
COMMENT ON TABLE ai_allocation_requests IS 'Teacher requests for AI quota allocation when self-service is enabled by school administrators.';
COMMENT ON TABLE ai_allocation_history IS 'Audit trail for all AI quota allocation changes. Immutable log for compliance and debugging.';

COMMENT ON COLUMN school_ai_subscriptions.total_quotas IS 'JSON object with total quotas purchased: {"claude_messages": 100, "content_generation": 50, "assessment_ai": 25}';
COMMENT ON COLUMN school_ai_subscriptions.allocated_quotas IS 'JSON object with quotas allocated to teachers. Auto-calculated from teacher_ai_allocations.';
COMMENT ON COLUMN school_ai_subscriptions.allow_teacher_self_allocation IS 'Whether teachers can request quota allocations without principal approval.';

COMMENT ON COLUMN teacher_ai_allocations.allocated_quotas IS 'JSON object with allocated quotas per service type. Must not exceed school total_quotas.';
COMMENT ON COLUMN teacher_ai_allocations.used_quotas IS 'JSON object tracking quota usage this period. Updated by ai_usage_logs.';
COMMENT ON COLUMN teacher_ai_allocations.priority_level IS 'Priority for quota allocation when school quotas are limited: low, normal, high.';

COMMENT ON VIEW daily_ai_usage_rollup IS 'Daily aggregation of AI usage for faster reporting and analytics.';
COMMENT ON VIEW monthly_ai_usage_rollup IS 'Monthly aggregation of AI usage for historical analysis and billing.';
COMMENT ON VIEW school_daily_ai_usage IS 'School-level daily AI usage summary for administrators.';

-- End of migration
-- This migration establishes a comprehensive AI quota allocation system that:
-- 1. Supports school-wide quota management
-- 2. Enables principal/admin allocation to teachers
-- 3. Tracks usage and enforces limits
-- 4. Provides audit trails for compliance
-- 5. Optimizes for performance with proper indexing
-- 6. Maintains security with RLS policies
-- 7. Complies with WARP.md Golden Rule and Non-negotiables