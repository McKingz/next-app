-- =====================================================
-- AI Usage Tracking and Rate Limiting System
-- =====================================================
-- Tracks AI usage per user to prevent API credit exhaustion
-- Implements tiered limits based on subscription level

-- =====================================================
-- 1. User AI Usage Tracking Table
-- =====================================================

CREATE TABLE IF NOT EXISTS user_ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Usage Counters (reset monthly)
  exams_generated_this_month INTEGER DEFAULT 0,
  explanations_requested_this_month INTEGER DEFAULT 0,
  chat_messages_today INTEGER DEFAULT 0,
  
  -- Total Lifetime Counters
  total_exams_generated INTEGER DEFAULT 0,
  total_explanations_requested INTEGER DEFAULT 0,
  total_chat_messages INTEGER DEFAULT 0,
  
  -- Reset Tracking
  last_monthly_reset_at TIMESTAMP DEFAULT NOW(),
  last_daily_reset_at TIMESTAMP DEFAULT NOW(),
  
  -- Metadata
  current_tier VARCHAR(50) DEFAULT 'free', -- 'free', 'trial', 'basic', 'premium', 'school'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- =====================================================
-- 2. AI Usage Tier Limits Configuration
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_usage_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_name VARCHAR(50) UNIQUE NOT NULL,
  
  -- Monthly Limits
  exams_per_month INTEGER NOT NULL,
  explanations_per_month INTEGER NOT NULL,
  
  -- Daily Limits
  chat_messages_per_day INTEGER NOT NULL,
  
  -- Features
  priority_queue BOOLEAN DEFAULT false,
  advanced_features BOOLEAN DEFAULT false,
  
  -- Pricing
  monthly_price_zar DECIMAL(10, 2) DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 3. AI Request Log (for debugging and analytics)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_request_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Request Details
  request_type VARCHAR(50) NOT NULL, -- 'exam_generation', 'explanation', 'chat_message'
  function_name VARCHAR(100), -- 'explain-answer', 'ai-proxy', etc.
  
  -- Status
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'rate_limited'
  error_message TEXT,
  
  -- Performance
  response_time_ms INTEGER,
  tokens_used INTEGER,
  
  -- Context
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 4. Insert Default Tier Configurations
-- =====================================================

INSERT INTO ai_usage_tiers (tier_name, exams_per_month, explanations_per_month, chat_messages_per_day, monthly_price_zar, priority_queue)
VALUES 
  ('free', 3, 5, 10, 0, false),
  ('trial', 10, 20, 50, 0, false),
  ('basic', 30, 100, 200, 99, false),
  ('premium', 100, 500, 1000, 299, true),
  ('school', 999999, 999999, 999999, 0, true)
ON CONFLICT (tier_name) DO NOTHING;

-- =====================================================
-- 5. Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_ai_usage_user_id ON user_ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_request_log_user_id ON ai_request_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_request_log_created_at ON ai_request_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_request_log_status ON ai_request_log(status);

-- =====================================================
-- 6. RLS Policies
-- =====================================================

ALTER TABLE user_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_request_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own AI usage"
  ON user_ai_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view tier configurations
CREATE POLICY "Anyone can view tier limits"
  ON ai_usage_tiers FOR SELECT
  USING (true);

-- Users can view their own request logs
CREATE POLICY "Users can view own request logs"
  ON ai_request_log FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage everything
CREATE POLICY "Service role full access to ai_usage"
  ON user_ai_usage FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to ai_request_log"
  ON ai_request_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 7. Functions for Usage Management
-- =====================================================

-- Function to check if user can make AI request
CREATE OR REPLACE FUNCTION check_ai_usage_limit(
  p_user_id UUID,
  p_request_type VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_usage RECORD;
  v_limits RECORD;
  v_can_proceed BOOLEAN := false;
  v_remaining INTEGER := 0;
  v_limit INTEGER := 0;
BEGIN
  -- Get or create user usage record
  INSERT INTO user_ai_usage (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Reset counters if needed
  UPDATE user_ai_usage
  SET 
    exams_generated_this_month = 0,
    explanations_requested_this_month = 0,
    last_monthly_reset_at = NOW()
  WHERE user_id = p_user_id
    AND last_monthly_reset_at < (NOW() - INTERVAL '30 days');
  
  UPDATE user_ai_usage
  SET 
    chat_messages_today = 0,
    last_daily_reset_at = NOW()
  WHERE user_id = p_user_id
    AND last_daily_reset_at < (NOW() - INTERVAL '1 day');
  
  -- Get current usage
  SELECT * INTO v_usage
  FROM user_ai_usage
  WHERE user_id = p_user_id;
  
  -- Get tier limits
  SELECT * INTO v_limits
  FROM ai_usage_tiers
  WHERE tier_name = v_usage.current_tier
    AND is_active = true;
  
  -- Check limits based on request type
  IF p_request_type = 'exam_generation' THEN
    v_limit := v_limits.exams_per_month;
    v_remaining := v_limit - v_usage.exams_generated_this_month;
    v_can_proceed := v_usage.exams_generated_this_month < v_limit;
  ELSIF p_request_type = 'explanation' THEN
    v_limit := v_limits.explanations_per_month;
    v_remaining := v_limit - v_usage.explanations_requested_this_month;
    v_can_proceed := v_usage.explanations_requested_this_month < v_limit;
  ELSIF p_request_type = 'chat_message' THEN
    v_limit := v_limits.chat_messages_per_day;
    v_remaining := v_limit - v_usage.chat_messages_today;
    v_can_proceed := v_usage.chat_messages_today < v_limit;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_can_proceed,
    'remaining', v_remaining,
    'limit', v_limit,
    'current_tier', v_usage.current_tier,
    'upgrade_available', v_usage.current_tier IN ('free', 'trial')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id UUID,
  p_request_type VARCHAR,
  p_status VARCHAR DEFAULT 'success',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  -- Increment appropriate counter
  IF p_request_type = 'exam_generation' AND p_status = 'success' THEN
    UPDATE user_ai_usage
    SET 
      exams_generated_this_month = exams_generated_this_month + 1,
      total_exams_generated = total_exams_generated + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_request_type = 'explanation' AND p_status = 'success' THEN
    UPDATE user_ai_usage
    SET 
      explanations_requested_this_month = explanations_requested_this_month + 1,
      total_explanations_requested = total_explanations_requested + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_request_type = 'chat_message' AND p_status = 'success' THEN
    UPDATE user_ai_usage
    SET 
      chat_messages_today = chat_messages_today + 1,
      total_chat_messages = total_chat_messages + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
  
  -- Log the request
  INSERT INTO ai_request_log (user_id, request_type, status, metadata)
  VALUES (p_user_id, p_request_type, p_status, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. Subscriptions Table (for PayFast integration)
-- =====================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Subscription Details
  tier VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'cancelled', 'expired'
  
  -- Payment Details
  payment_method VARCHAR(50) DEFAULT 'payfast',
  amount DECIMAL(10, 2),
  payment_id VARCHAR(255),
  pf_payment_id VARCHAR(255), -- PayFast payment ID
  
  -- Dates
  subscription_start TIMESTAMP DEFAULT NOW(),
  subscription_end TIMESTAMP,
  next_billing_date TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to subscriptions"
  ON subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 9. Comments
-- =====================================================

COMMENT ON TABLE user_ai_usage IS 'Tracks AI feature usage per user to enforce rate limits';
COMMENT ON TABLE ai_usage_tiers IS 'Defines usage limits for each subscription tier';
COMMENT ON TABLE ai_request_log IS 'Logs all AI requests for analytics and debugging';
COMMENT ON FUNCTION check_ai_usage_limit IS 'Checks if user can make an AI request based on their tier limits';
COMMENT ON FUNCTION increment_ai_usage IS 'Increments usage counter after successful AI request';
