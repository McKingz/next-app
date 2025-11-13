-- =============================================
-- EduDash Pro: Hybrid Onboarding RPC Functions
-- Version: 1.0.0
-- Date: 2025-09-19
-- Purpose: Secure RPC functions for hybrid preschool/K-12 onboarding flows
-- WARP.md Compliance: Migration-only, production-safe, forward-only
-- =============================================

BEGIN;

-- ============================================================================
-- FUNCTION 1: REGISTER_NEW_SCHOOL - Self-Service School Registration
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_new_school(
  p_school_name TEXT,
  p_principal_email TEXT,
  p_principal_name TEXT,
  p_school_type VARCHAR(20) DEFAULT 'preschool',
  p_grade_levels TEXT [] DEFAULT ARRAY['pre_k'],
  p_contact_email TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_physical_address TEXT DEFAULT NULL,
  p_selected_plan_id UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id UUID;
  v_principal_id UUID;
  v_verification_id UUID;
  v_onboarding_id UUID;
  v_result JSON;
  v_error_msg TEXT;
BEGIN
  -- Input validation
  IF p_school_name IS NULL OR LENGTH(TRIM(p_school_name)) = 0 THEN
    RETURN json_build_object('error', 'School name is required');
  END IF;
  
  IF p_principal_email IS NULL OR p_principal_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN json_build_object('error', 'Valid principal email is required');
  END IF;
  
  IF p_principal_name IS NULL OR LENGTH(TRIM(p_principal_name)) = 0 THEN
    RETURN json_build_object('error', 'Principal name is required');
  END IF;
  
  IF p_school_type NOT IN ('preschool', 'k12_school', 'hybrid') THEN
    RETURN json_build_object('error', 'Invalid school type');
  END IF;
  
  -- Check if school name already exists
  IF EXISTS (SELECT 1 FROM public.preschools WHERE name = TRIM(p_school_name)) THEN
    RETURN json_build_object('error', 'School name already exists');
  END IF;
  
  -- Check if principal email already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(p_principal_email))) THEN
    RETURN json_build_object('error', 'Principal email already registered');
  END IF;
  
  -- Create school record
  INSERT INTO public.preschools (
    name,
    school_type,
    grade_levels,
    contact_email,
    contact_phone,
    physical_address,
    verification_status,
    onboarding_flow,
    created_at
  )
  VALUES (
    TRIM(p_school_name),
    p_school_type,
    p_grade_levels,
    LOWER(TRIM(p_contact_email)),
    TRIM(p_contact_phone),
    TRIM(p_physical_address),
    'pending',
    'self_service',
    NOW()
  )
  RETURNING id INTO v_school_id;
  
  -- Create verification record for email
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
      'email', LOWER(TRIM(p_contact_email)),
      'school_name', TRIM(p_school_name)
    ),
    encode(gen_random_bytes(32), 'hex'),
    NOW() + INTERVAL '24 hours'
  )
  RETURNING id INTO v_verification_id;
  
  -- Create onboarding progress tracker
  INSERT INTO public.onboarding_progress (
    school_id,
    flow_type,
    current_step,
    completed_steps,
    step_data
  )
  VALUES (
    v_school_id,
    'self_service',
    'school_registered',
    ARRAY['school_registered'],
    json_build_object(
      'school_name', TRIM(p_school_name),
      'school_type', p_school_type,
      'principal_email', LOWER(TRIM(p_principal_email)),
      'principal_name', TRIM(p_principal_name),
      'selected_plan_id', p_selected_plan_id
    )
  )
  RETURNING id INTO v_onboarding_id;
  
  -- Build success response
  v_result := json_build_object(
    'success', TRUE,
    'school_id', v_school_id,
    'verification_id', v_verification_id,
    'onboarding_id', v_onboarding_id,
    'next_step', 'email_verification',
    'message', 'School registered successfully. Email verification required.'
  );
  
  -- Log the registration
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
    NULL, -- No user yet, this is self-registration
    'school_self_registration',
    'preschools',
    v_school_id,
    '{}',
    json_build_object(
      'name', TRIM(p_school_name),
      'school_type', p_school_type,
      'onboarding_flow', 'self_service'
    ),
    json_build_object(
      'ip_address', inet_client_addr()::TEXT,
      'user_agent', current_setting('request.headers', TRUE)::JSON->>'user-agent'
    )
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RETURN json_build_object(
      'error', 'Registration failed: ' || v_error_msg
    );
END;
$$;

-- ============================================================================
-- FUNCTION 2: SUPERADMIN_ONBOARD_SCHOOL - Admin-Managed School Onboarding
-- ============================================================================

CREATE OR REPLACE FUNCTION public.superadmin_onboard_school(
  p_school_data JSONB,
  p_principal_data JSONB,
  p_subscription_data JSONB DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id UUID;
  v_principal_id UUID;
  v_subscription_id UUID;
  v_onboarding_id UUID;
  v_current_user_id UUID := auth.uid();
  v_result JSON;
  v_error_msg TEXT;
  v_school_name TEXT;
  v_school_type VARCHAR(20);
  v_principal_email TEXT;
  v_principal_name TEXT;
BEGIN
  -- Check if current user is superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = v_current_user_id 
    AND role = 'superadmin'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Superadmin access required');
  END IF;
  
  -- Extract and validate school data
  v_school_name := p_school_data->>'name';
  v_school_type := COALESCE(p_school_data->>'school_type', 'preschool');
  
  IF v_school_name IS NULL OR LENGTH(TRIM(v_school_name)) = 0 THEN
    RETURN json_build_object('error', 'School name is required');
  END IF;
  
  -- Extract and validate principal data
  v_principal_email := p_principal_data->>'email';
  v_principal_name := p_principal_data->>'name';
  
  IF v_principal_email IS NULL OR v_principal_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN json_build_object('error', 'Valid principal email is required');
  END IF;
  
  -- Check for existing school
  IF EXISTS (SELECT 1 FROM public.preschools WHERE name = TRIM(v_school_name)) THEN
    RETURN json_build_object('error', 'School name already exists');
  END IF;
  
  -- Create school record
  INSERT INTO public.preschools (
    name,
    school_type,
    grade_levels,
    contact_email,
    contact_phone,
    physical_address,
    verification_status,
    onboarding_flow,
    registration_notes,
    created_at
  )
  VALUES (
    TRIM(v_school_name),
    v_school_type,
    COALESCE(
      (SELECT ARRAY(SELECT jsonb_array_elements_text(p_school_data->'grade_levels'))),
      ARRAY['pre_k']
    ),
    p_school_data->>'contact_email',
    p_school_data->>'contact_phone',
    p_school_data->>'physical_address',
    'manual_override', -- Superadmin bypass verification
    'superadmin_invite',
    p_school_data->>'notes',
    NOW()
  )
  RETURNING id INTO v_school_id;
  
  -- Create onboarding progress tracker
  INSERT INTO public.onboarding_progress (
    school_id,
    flow_type,
    current_step,
    completed_steps,
    step_data,
    created_by
  )
  VALUES (
    v_school_id,
    'superadmin_invite',
    'school_created',
    ARRAY['school_created'],
    json_build_object(
      'school_data', p_school_data,
      'principal_data', p_principal_data,
      'subscription_data', p_subscription_data,
      'created_by_admin', v_current_user_id
    ),
    v_current_user_id
  )
  RETURNING id INTO v_onboarding_id;
  
  -- Create subscription if provided
  IF p_subscription_data IS NOT NULL AND p_subscription_data->>'plan_id' IS NOT NULL THEN
    -- Use existing subscription creation RPC
    SELECT id INTO v_subscription_id
    FROM public.subscriptions
    WHERE school_id = v_school_id
    AND plan_id = (p_subscription_data->>'plan_id')
    LIMIT 1;
    
    -- If no subscription exists, create one
    IF v_subscription_id IS NULL THEN
      INSERT INTO public.subscriptions (
        school_id,
        plan_id,
        status,
        seats_total,
        seats_used,
        created_at
      )
      VALUES (
        v_school_id,
        (p_subscription_data->>'plan_id')::UUID,
        'active',
        COALESCE((p_subscription_data->>'seats')::INTEGER, 5),
        0,
        NOW()
      )
      RETURNING id INTO v_subscription_id;
    END IF;
  END IF;
  
  -- Build success response
  v_result := json_build_object(
    'success', TRUE,
    'school_id', v_school_id,
    'subscription_id', v_subscription_id,
    'onboarding_id', v_onboarding_id,
    'next_step', 'principal_invitation',
    'message', 'School created successfully. Principal invitation can be sent.'
  );
  
  -- Log the creation
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
    v_current_user_id,
    'superadmin_school_creation',
    'preschools',
    v_school_id,
    '{}',
    json_build_object(
      'name', v_school_name,
      'school_type', v_school_type,
      'onboarding_flow', 'superadmin_invite'
    ),
    json_build_object(
      'subscription_created', v_subscription_id IS NOT NULL,
      'principal_data', p_principal_data
    )
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RETURN json_build_object(
      'error', 'School creation failed: ' || v_error_msg
    );
END;
$$;

-- ============================================================================
-- FUNCTION 3: VERIFY_SCHOOL - School Verification Management
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_school(
  p_school_id UUID,
  p_verification_type VARCHAR(50),
  p_verification_data JSONB DEFAULT '{}',
  p_verification_token TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_verification_id UUID;
  v_current_user_id UUID := auth.uid();
  v_is_superadmin BOOLEAN := FALSE;
  v_is_school_admin BOOLEAN := FALSE;
  v_verification_record RECORD;
  v_result JSON;
  v_error_msg TEXT;
BEGIN
  -- Check user permissions
  IF v_current_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.users 
      WHERE id = v_current_user_id AND role = 'superadmin'
    ) INTO v_is_superadmin;
    
    SELECT EXISTS(
      SELECT 1 FROM public.users 
      WHERE id = v_current_user_id 
      AND preschool_id = p_school_id
      AND role IN ('principal', 'preschool_admin')
    ) INTO v_is_school_admin;
  END IF;
  
  -- For token-based verification (email, phone), allow public access
  IF p_verification_token IS NOT NULL THEN
    -- Find verification record by token
    SELECT * INTO v_verification_record
    FROM public.school_verifications
    WHERE school_id = p_school_id
    AND verification_type = p_verification_type
    AND verification_token = p_verification_token
    AND expires_at > NOW()
    AND status = 'pending';
    
    IF NOT FOUND THEN
      RETURN json_build_object(
        'error', 'Invalid or expired verification token'
      );
    END IF;
  ELSE
    -- For manual verification, require admin permissions
    IF NOT (v_is_superadmin OR v_is_school_admin) THEN
      RETURN json_build_object(
        'error', 'Unauthorized: Admin access required for manual verification'
      );
    END IF;
    
    -- Find pending verification record
    SELECT * INTO v_verification_record
    FROM public.school_verifications
    WHERE school_id = p_school_id
    AND verification_type = p_verification_type
    AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
      RETURN json_build_object(
        'error', 'No pending verification found for this type'
      );
    END IF;
  END IF;
  
  -- Update verification record
  UPDATE public.school_verifications
  SET 
    status = 'verified',
    verified_by = v_current_user_id,
    verified_at = NOW(),
    verification_data = verification_data || p_verification_data
  WHERE id = v_verification_record.id
  RETURNING id INTO v_verification_id;
  
  -- Check if all required verifications are complete
  IF NOT EXISTS (
    SELECT 1 FROM public.school_verifications
    WHERE school_id = p_school_id
    AND verification_type IN ('email') -- Add other required types as needed
    AND status != 'verified'
  ) THEN
    -- All verifications complete, update school status
    UPDATE public.preschools
    SET verification_status = 'verified'
    WHERE id = p_school_id;
    
    -- Update onboarding progress
    UPDATE public.onboarding_progress
    SET 
      current_step = 'verification_complete',
      completed_steps = array_append(completed_steps, 'verification_complete'),
      step_data = step_data || json_build_object('verified_at', NOW())
    WHERE school_id = p_school_id;
  END IF;
  
  -- Build success response
  v_result := json_build_object(
    'success', TRUE,
    'verification_id', v_verification_id,
    'verification_type', p_verification_type,
    'message', 'Verification completed successfully'
  );
  
  -- Log the verification
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
    v_current_user_id,
    'school_verification',
    'school_verifications',
    v_verification_id,
    json_build_object('status', 'pending'),
    json_build_object('status', 'verified'),
    json_build_object(
      'school_id', p_school_id,
      'verification_type', p_verification_type,
      'token_used', p_verification_token IS NOT NULL
    )
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RETURN json_build_object(
      'error', 'Verification failed: ' || v_error_msg
    );
END;
$$;

-- ============================================================================
-- FUNCTION 4: GET_ONBOARDING_STATUS - Get School Onboarding Progress
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_onboarding_status(
  p_school_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_is_authorized BOOLEAN := FALSE;
  v_school_record RECORD;
  v_progress_record RECORD;
  v_verifications JSONB;
  v_result JSON;
BEGIN
  -- Check authorization
  IF v_current_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.users 
      WHERE id = v_current_user_id 
      AND (
        role = 'superadmin' 
        OR (preschool_id = p_school_id AND role IN ('principal', 'preschool_admin'))
      )
    ) INTO v_is_authorized;
  END IF;
  
  IF NOT v_is_authorized THEN
    RETURN json_build_object('error', 'Unauthorized access');
  END IF;
  
  -- Get school information
  SELECT 
    id,
    name,
    school_type,
    verification_status,
    onboarding_flow,
    onboarding_completed_at,
    created_at
  INTO v_school_record
  FROM public.preschools
  WHERE id = p_school_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'School not found');
  END IF;
  
  -- Get onboarding progress
  SELECT 
    flow_type,
    current_step,
    completed_steps,
    step_data,
    started_at,
    completed_at
  INTO v_progress_record
  FROM public.onboarding_progress
  WHERE school_id = p_school_id
  ORDER BY started_at DESC
  LIMIT 1;
  
  -- Get verification status
  SELECT json_agg(
    json_build_object(
      'type', verification_type,
      'status', status,
      'verified_at', verified_at,
      'expires_at', expires_at
    )
  )
  INTO v_verifications
  FROM public.school_verifications
  WHERE school_id = p_school_id;
  
  -- Build response
  v_result := json_build_object(
    'success', TRUE,
    'school', json_build_object(
      'id', v_school_record.id,
      'name', v_school_record.name,
      'school_type', v_school_record.school_type,
      'verification_status', v_school_record.verification_status,
      'onboarding_flow', v_school_record.onboarding_flow,
      'onboarding_completed_at', v_school_record.onboarding_completed_at,
      'created_at', v_school_record.created_at
    ),
    'progress', CASE
      WHEN v_progress_record.flow_type IS NOT NULL THEN
        json_build_object(
          'flow_type', v_progress_record.flow_type,
          'current_step', v_progress_record.current_step,
          'completed_steps', v_progress_record.completed_steps,
          'step_data', v_progress_record.step_data,
          'started_at', v_progress_record.started_at,
          'completed_at', v_progress_record.completed_at
        )
      ELSE NULL
    END,
    'verifications', COALESCE(v_verifications, '[]'::JSONB)
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', 'Failed to get onboarding status: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- GRANT NECESSARY PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.register_new_school TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_onboard_school TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_school TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_status TO authenticated;

-- ============================================================================
-- LOG MIGRATION COMPLETION
-- ============================================================================

INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'hybrid_onboarding_rpcs_20250919221913',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::TEXT,
    'functions_created', json_build_array(
      'register_new_school',
      'superadmin_onboard_school',
      'verify_school',
      'get_onboarding_status'
    ),
    'migration_file', '20250919221913_hybrid_onboarding_rpc_functions.sql'
  ),
  'Hybrid onboarding RPC functions completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'HYBRID ONBOARDING RPC FUNCTIONS CREATED SUCCESSFULLY' AS status;

COMMIT;
