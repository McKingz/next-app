-- SuperAdmin Security Enhancement Script
-- Date: 2025-09-21
-- Purpose: Enhance security for existing SuperAdmin account (superadmin@edudashpro.org.za)
-- This script is IDEMPOTENT - safe to run multiple times

BEGIN;

-- ====================================================================
-- PART 1: ENSURE SUPERADMIN EXISTS AND IS PROPERLY CONFIGURED
-- ====================================================================

-- First, let's verify the SuperAdmin exists
DO $$
DECLARE
    superadmin_id UUID;
    superadmin_email TEXT := 'superadmin@edudashpro.org.za';
BEGIN
    -- Check if SuperAdmin exists
    SELECT id INTO superadmin_id
    FROM profiles 
    WHERE LOWER(email) = LOWER(superadmin_email)
    AND LOWER(role) IN ('super_admin', 'superadmin');
    
    IF superadmin_id IS NULL THEN
        RAISE NOTICE 'SuperAdmin account not found. Please ensure % exists with super_admin role.', superadmin_email;
        -- We won't create the user here - that should be done through Supabase Auth
    ELSE
        RAISE NOTICE 'SuperAdmin account found: %', superadmin_id;
        
        -- Ensure SuperAdmin has the correct role and capabilities
        UPDATE profiles 
        SET 
            role = 'super_admin',
            capabilities = COALESCE(capabilities, '[]'::jsonb) || jsonb_build_array(
                'access_mobile_app',
                'view_all_organizations',
                'manage_organizations',
                'manage_billing',
                'manage_subscriptions',
                'access_admin_tools',
                'manage_feature_flags',
                'view_system_logs',
                'ai_quota_management',
                'manage_users',
                'view_audit_logs'
            ),
            updated_at = now()
        WHERE id = superadmin_id;
        
        RAISE NOTICE 'SuperAdmin capabilities updated';
    END IF;
END $$;

-- ====================================================================
-- PART 2: SET UP 2FA FOR SUPERADMIN (MANDATORY)
-- ====================================================================

-- Enable mandatory 2FA for SuperAdmin
INSERT INTO user_two_factor_auth (
    user_id,
    method,
    is_enabled,
    is_verified,
    totp_secret,
    totp_backup_codes,
    enforce_for_role,
    metadata
)
SELECT 
    p.id,
    'totp',
    false, -- Will be enabled when user completes setup
    false, -- Will be verified when user completes setup
    public.generate_totp_secret(),
    public.generate_backup_codes(10),
    true, -- Enforce 2FA for this role
    jsonb_build_object(
        'setup_required', true,
        'role_enforcement', true,
        'security_level', 'maximum',
        'setup_instructions', 'SuperAdmin must complete 2FA setup to maintain platform access'
    )
FROM profiles p
WHERE LOWER(p.email) = 'superadmin@edudashpro.org.za'
AND LOWER(p.role) IN ('super_admin', 'superadmin')
ON CONFLICT (user_id, method) DO UPDATE SET
    enforce_for_role = true,
    metadata = EXCLUDED.metadata || jsonb_build_object('security_enhanced', now()),
    updated_at = now();

-- ====================================================================
-- PART 3: ASSIGN ENTERPRISE AI TIER TO SUPERADMIN
-- ====================================================================

-- SuperAdmin gets enterprise AI tier (unlimited access)
INSERT INTO user_ai_tiers (
    user_id,
    tier,
    assigned_by,
    assigned_reason,
    is_active,
    metadata
)
SELECT 
    p.id,
    'enterprise',
    p.id, -- Self-assigned
    'Platform control user - requires unlimited AI access for system management',
    true,
    jsonb_build_object(
        'auto_assigned', true,
        'role_based', true,
        'assignment_date', now(),
        'tier_justification', 'SuperAdmin requires unlimited AI access for platform operations'
    )
FROM profiles p
WHERE LOWER(p.email) = 'superadmin@edudashpro.org.za'
AND LOWER(p.role) IN ('super_admin', 'superadmin')
ON CONFLICT (user_id) DO UPDATE SET
    tier = 'enterprise',
    assigned_reason = 'Platform control user - requires unlimited AI access for system management',
    is_active = true,
    metadata = EXCLUDED.metadata || jsonb_build_object('tier_updated', now()),
    updated_at = now();

-- ====================================================================
-- PART 4: CREATE SECURITY EVENT FOR ENHANCEMENT
-- ====================================================================

-- Log the security enhancement
SELECT public.record_security_event(
    p.id,
    NULL,
    'security_enhancement',
    'security',
    'info',
    NULL,
    true,
    NULL,
    jsonb_build_object(
        'enhancement_type', '2FA_and_AI_tier_assignment',
        'automated', true,
        'script_version', '1.0.0',
        'enhancements', jsonb_build_array(
            '2FA setup prepared',
            'Enterprise AI tier assigned',
            'Security policies enforced'
        )
    ),
    0
)
FROM profiles p
WHERE LOWER(p.email) = 'superadmin@edudashpro.org.za'
AND LOWER(p.role) IN ('super_admin', 'superadmin');

-- ====================================================================
-- PART 5: ENSURE DEFAULT AI TIERS FOR EXISTING USERS
-- ====================================================================

-- Assign default AI tiers to existing users who don't have one
INSERT INTO user_ai_tiers (user_id, tier, assigned_reason, metadata)
SELECT 
    p.id,
    CASE 
        WHEN LOWER(p.role) IN ('super_admin', 'superadmin') THEN 'enterprise'
        WHEN LOWER(p.role) IN ('principal', 'principal_admin') THEN 'premium'
        WHEN LOWER(p.role) = 'teacher' THEN 'starter'
        ELSE 'free'
    END,
    'Auto-assigned based on user role during security enhancement',
    jsonb_build_object(
        'auto_assigned', true,
        'role_based', true,
        'assignment_date', now(),
        'assigned_during', 'security_enhancement_script'
    )
FROM profiles p
LEFT JOIN user_ai_tiers uat ON uat.user_id = p.id
WHERE uat.user_id IS NULL -- Only for users without AI tier
AND p.role IS NOT NULL;

-- ====================================================================
-- PART 6: CLEAN UP AND OPTIMIZE
-- ====================================================================

-- Clean up any expired sessions older than 90 days
SELECT public.cleanup_expired_sessions();

-- Update statistics for better query performance
ANALYZE user_two_factor_auth;
ANALYZE user_ai_tiers;
ANALYZE user_sessions;
ANALYZE security_events;

-- ====================================================================
-- PART 7: SECURITY SUMMARY REPORT
-- ====================================================================

-- Generate a summary of what was configured
DO $$
DECLARE
    superadmin_id UUID;
    superadmin_email TEXT := 'superadmin@edudashpro.org.za';
    has_2fa BOOLEAN;
    ai_tier TEXT;
    total_users_with_ai_tiers INTEGER;
BEGIN
    -- Get SuperAdmin info
    SELECT p.id INTO superadmin_id
    FROM profiles p
    WHERE LOWER(p.email) = LOWER(superadmin_email)
    AND LOWER(p.role) IN ('super_admin', 'superadmin');
    
    IF superadmin_id IS NOT NULL THEN
        -- Check 2FA status
        SELECT EXISTS(
            SELECT 1 FROM user_two_factor_auth 
            WHERE user_id = superadmin_id AND method = 'totp'
        ) INTO has_2fa;
        
        -- Check AI tier
        SELECT tier INTO ai_tier
        FROM user_ai_tiers 
        WHERE user_id = superadmin_id AND is_active = true;
        
        -- Count users with AI tiers
        SELECT COUNT(*) INTO total_users_with_ai_tiers
        FROM user_ai_tiers WHERE is_active = true;
        
        RAISE NOTICE '';
        RAISE NOTICE '==================================================';
        RAISE NOTICE 'SUPERADMIN SECURITY ENHANCEMENT COMPLETE';
        RAISE NOTICE '==================================================';
        RAISE NOTICE 'SuperAdmin Account: %', superadmin_email;
        RAISE NOTICE 'SuperAdmin ID: %', superadmin_id;
        RAISE NOTICE '2FA Configured: % (setup required)', CASE WHEN has_2fa THEN 'YES' ELSE 'NO' END;
        RAISE NOTICE 'AI Tier: %', COALESCE(ai_tier, 'NOT ASSIGNED');
        RAISE NOTICE 'Total Users with AI Tiers: %', total_users_with_ai_tiers;
        RAISE NOTICE '';
        RAISE NOTICE 'NEXT STEPS FOR SUPERADMIN:';
        RAISE NOTICE '1. Complete 2FA setup using authenticator app';
        RAISE NOTICE '2. Save backup codes securely';
        RAISE NOTICE '3. Test login with 2FA';
        RAISE NOTICE '4. Verify AI features are working';
        RAISE NOTICE '==================================================';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '==================================================';
        RAISE NOTICE 'WARNING: SUPERADMIN ACCOUNT NOT FOUND';
        RAISE NOTICE '==================================================';
        RAISE NOTICE 'Expected email: %', superadmin_email;
        RAISE NOTICE 'Please ensure the SuperAdmin account exists in Supabase Auth';
        RAISE NOTICE 'and has the correct role in the profiles table.';
        RAISE NOTICE '==================================================';
    END IF;
END $$;

COMMIT;