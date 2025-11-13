-- Check user subscription and trial status
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at,
  p.role,
  p.subscription_tier,
  p.organization_id,
  p.preschool_id,
  p.trial_ends_at,
  p.trial_granted_at,
  -- Check if trial is active
  CASE 
    WHEN p.trial_ends_at IS NULL THEN 'No trial'
    WHEN p.trial_ends_at > NOW() THEN 'Active trial'
    ELSE 'Trial expired'
  END as trial_status
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.id = 'a04eee28-78e1-4ef3-a625-08c1a066e959';

-- Check AI usage for this user
SELECT 
  service_type,
  COUNT(*) as requests_this_month,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
  MAX(created_at) as last_request
FROM ai_usage_logs
WHERE user_id = 'a04eee28-78e1-4ef3-a625-08c1a066e959'
  AND created_at >= DATE_TRUNC('month', NOW())
GROUP BY service_type
ORDER BY requests_this_month DESC;
