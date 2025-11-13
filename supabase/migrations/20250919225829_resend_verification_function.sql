-- =============================================
-- EduDash Pro: Resend Verification Function
-- Version: 1.0.0
-- Date: 2025-09-19
-- Purpose: Add RPC function to resend school verification emails
-- WARP.md Compliance: Migration-only, production-safe, forward-only
-- =============================================

BEGIN;

-- ============================================================================
-- FUNCTION: RESEND_SCHOOL_VERIFICATION
-- Purpose: Resend verification email for a school registration
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resend_school_verification(
  p_email TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id UUID;
  v_verification_id UUID;
  v_school_name TEXT;
  v_verification_token TEXT;
  v_result JSON;
  v_error_msg TEXT;
  v_notification_count INTEGER;
BEGIN
  -- Input validation
  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN json_build_object('error', 'Valid email address is required');
  END IF;
  
  -- Find the school by contact email
  SELECT id, name INTO v_school_id, v_school_name
  FROM public.preschools
  WHERE LOWER(contact_email) = LOWER(TRIM(p_email))
  AND verification_status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Check if school exists and needs verification
  IF v_school_id IS NULL THEN
    RETURN json_build_object(
      'error', 
      'No pending verification found for this email address. The school may already be verified or the email address may be incorrect.'
    );
  END IF;
  
  -- Check for existing unexpired verification
  SELECT id, verification_token INTO v_verification_id, v_verification_token
  FROM public.school_verifications
  WHERE school_id = v_school_id
  AND verification_type = 'email'
  AND status = 'pending'
  AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no valid verification exists, create a new one
  IF v_verification_id IS NULL THEN
    -- Generate new verification token
    v_verification_token := encode(gen_random_bytes(32), 'hex');
    
    -- Create new verification record
    INSERT INTO public.school_verifications (
      school_id,
      verification_type,
      status,
      verification_data,
      verification_token,
      expires_at
    )
    VALUES (
      v_school_id,
      'email',
      'pending',
      json_build_object(
        'email', LOWER(TRIM(p_email)),
        'school_name', v_school_name,
        'resend_requested', NOW()::TEXT
      ),
      v_verification_token,
      NOW() + INTERVAL '24 hours'
    )
    RETURNING id INTO v_verification_id;
  END IF;
  
  -- Update school's last activity
  UPDATE public.preschools 
  SET updated_at = NOW()
  WHERE id = v_school_id;
  
  -- Notify superadmins about resend request (optional)
  SELECT notify_superadmins(
    'Verification Email Resent',
    v_school_name || ' requested a new verification email.',
    'verification_resent',
    json_build_object(
      'school_id', v_school_id,
      'school_name', v_school_name,
      'email', LOWER(TRIM(p_email)),
      'verification_id', v_verification_id
    )
  ) INTO v_notification_count;
  
  -- Build success response
  v_result := json_build_object(
    'success', TRUE,
    'message', 'Verification email has been resent successfully',
    'school_id', v_school_id,
    'verification_id', v_verification_id,
    'expires_in_hours', 24,
    'school_name', v_school_name
  );
  
  -- Log the resend request
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    metadata
  )
  VALUES (
    NULL, -- No user, this is self-service
    'school_verification_resent',
    'school_verifications',
    v_verification_id,
    '{}',
    json_build_object(
      'school_id', v_school_id,
      'email', LOWER(TRIM(p_email)),
      'verification_token', LEFT(v_verification_token, 8) || '...'
    ),
    json_build_object(
      'ip_address', inet_client_addr()::TEXT,
      'user_agent', current_setting('request.headers', true)::json->>'user-agent'
    )
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RETURN json_build_object(
      'error', 'Failed to resend verification email: ' || v_error_msg
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.resend_school_verification TO anon;
GRANT EXECUTE ON FUNCTION public.resend_school_verification TO authenticated;

-- ============================================================================
-- LOG MIGRATION COMPLETION
-- ============================================================================

INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'resend_verification_function_20250919225829',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::TEXT,
    'functions_created', json_build_array(
      'resend_school_verification'
    ),
    'migration_file', '20250919225829_resend_verification_function.sql'
  ),
  'Resend verification function completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'RESEND VERIFICATION FUNCTION COMPLETED' AS status;

COMMIT;
