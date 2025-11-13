-- =============================================
-- EduDash Pro: Notification System Enhancements
-- Version: 1.0.0
-- Date: 2025-09-19
-- Purpose: Add notification functions for school registrations and system events
-- WARP.md Compliance: Migration-only, production-safe, forward-only
-- =============================================

BEGIN;

-- ============================================================================
-- FUNCTION 1: CREATE_SYSTEM_NOTIFICATION - Helper for creating notifications
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_system_notification(
  p_recipient_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_notification_type TEXT DEFAULT 'system',
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
  v_preschool_id UUID;
BEGIN
  -- Get the user's preschool_id for context
  SELECT preschool_id INTO v_preschool_id 
  FROM public.users 
  WHERE id = p_recipient_user_id;
  
  -- Insert notification
  INSERT INTO public.push_notifications (
    recipient_user_id,
    title,
    message,
    notification_type,
    preschool_id,
    metadata,
    created_at,
    read_at
  )
  VALUES (
    p_recipient_user_id,
    p_title,
    p_message,
    p_notification_type,
    v_preschool_id,
    p_metadata,
    NOW(),
    NULL
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- ============================================================================
-- FUNCTION 2: NOTIFY_SUPERADMINS - Notify all superadmins of an event
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_superadmins(
  p_title TEXT,
  p_message TEXT,
  p_notification_type TEXT DEFAULT 'admin_alert',
  p_metadata JSONB DEFAULT '{}'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_superadmin_record RECORD;
  v_notification_count INTEGER := 0;
BEGIN
  -- Loop through all superadmin users
  FOR v_superadmin_record IN
    SELECT id FROM public.users WHERE role = 'superadmin' AND is_active = TRUE
  LOOP
    -- Create notification for each superadmin
    PERFORM create_system_notification(
      v_superadmin_record.id,
      p_title,
      p_message,
      p_notification_type,
      p_metadata
    );
    
    v_notification_count := v_notification_count + 1;
  END LOOP;
  
  RETURN v_notification_count;
END;
$$;

-- ============================================================================
-- UPDATE RPC FUNCTIONS TO INCLUDE NOTIFICATIONS
-- ============================================================================

-- Update register_new_school to include notifications
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
  v_notification_count INTEGER;
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
  
  -- Notify superadmins about new school registration
  SELECT notify_superadmins(
    'New School Registration',
    TRIM(p_school_name) || ' (' || 
    CASE p_school_type 
      WHEN 'preschool' THEN 'Preschool'
      WHEN 'k12_school' THEN 'K-12 School'
      WHEN 'hybrid' THEN 'Hybrid Institution'
      ELSE 'School'
    END || ') has registered via self-service.',
    'school_registration',
    json_build_object(
      'school_id', v_school_id,
      'school_name', TRIM(p_school_name),
      'school_type', p_school_type,
      'principal_email', LOWER(TRIM(p_principal_email)),
      'onboarding_flow', 'self_service',
      'requires_verification', TRUE
    )
  ) INTO v_notification_count;
  
  -- Build success response
  v_result := json_build_object(
    'success', TRUE,
    'school_id', v_school_id,
    'verification_id', v_verification_id,
    'onboarding_id', v_onboarding_id,
    'next_step', 'email_verification',
    'message', 'School registered successfully. Email verification required.',
    'notifications_sent', v_notification_count
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
      'notifications_sent', v_notification_count
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

-- Update superadmin_onboard_school to include notifications
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
  
  -- Notify the creating admin (confirmation)
  PERFORM create_system_notification(
    v_current_user_id,
    'School Created Successfully',
    TRIM(v_school_name) || ' has been created and is ready for principal invitation.',
    'school_creation_success',
    json_build_object(
      'school_id', v_school_id,
      'school_name', TRIM(v_school_name),
      'school_type', v_school_type,
      'has_subscription', v_subscription_id IS NOT NULL
    )
  );
  
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
-- GRANT NECESSARY PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.create_system_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_superadmins TO authenticated;

-- ============================================================================
-- LOG MIGRATION COMPLETION
-- ============================================================================

INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'notification_system_enhancements_20250919225337',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::TEXT,
    'functions_created', json_build_array(
      'create_system_notification',
      'notify_superadmins',
      'register_new_school (updated)',
      'superadmin_onboard_school (updated)'
    ),
    'migration_file', '20250919225337_notification_system_enhancements.sql'
  ),
  'Notification system enhancements completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'NOTIFICATION SYSTEM ENHANCEMENTS COMPLETED' AS status;

COMMIT;
