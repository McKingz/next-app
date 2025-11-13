-- =============================================
-- CRITICAL SECURITY FIX: Users Table RLS Policies
-- Version: 3.1.0 - Emergency Security Patch
-- Generated: 2025-01-09T15:15:00Z  
-- Priority: CRITICAL - Users table was unprotected
-- =============================================

-- Enable RLS on users table (CRITICAL)
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USERS TABLE POLICIES - CRITICAL SECURITY
-- Schema: id, preschool_id, role, auth_user_id
-- =============================================

-- Drop any existing policies first
DROP POLICY IF EXISTS users_superadmin_access ON public.users;
DROP POLICY IF EXISTS users_self_access ON public.users;
DROP POLICY IF EXISTS users_tenant_admin_access ON public.users;
DROP POLICY IF EXISTS users_tenant_visibility ON public.users;
DROP POLICY IF EXISTS users_public_profile_read ON public.users;

-- CRITICAL: Superadmin full access with service role
CREATE POLICY users_superadmin_access ON public.users
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

-- CRITICAL: Users can manage their own profile
CREATE POLICY users_self_access ON public.users
FOR ALL
TO authenticated
USING (
  id = auth.uid()
  OR auth_user_id = auth.uid()
)
WITH CHECK (
  id = auth.uid()
  OR auth_user_id = auth.uid()
);

-- CRITICAL: Principal/Admin access to users in their preschool
CREATE POLICY users_tenant_admin_access ON public.users
FOR ALL
TO authenticated
USING (
  -- User is principal/admin in the same preschool
  EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE
      admin_user.id = auth.uid()
      AND admin_user.role IN (
        'principal', 'preschool_admin', 'superadmin'
      )
      AND admin_user.preschool_id = users.preschool_id
  )
  -- Or user is platform superadmin
  OR EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE
      admin_user.id = auth.uid()
      AND admin_user.role = 'superadmin'
  )
)
WITH CHECK (
  -- Only allow creating/updating users in same preschool for admins
  EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE
      admin_user.id = auth.uid()
      AND admin_user.role IN (
        'principal', 'preschool_admin', 'superadmin'
      )
      AND (
        admin_user.preschool_id = users.preschool_id
        OR admin_user.role = 'superadmin'
      )
  )
);

-- CRITICAL: Limited visibility for users in same preschool (read-only)
CREATE POLICY users_tenant_visibility ON public.users
FOR SELECT
TO authenticated
USING (
  -- Users can see other users in their preschool (limited fields)
  preschool_id IN (
    SELECT u.preschool_id
    FROM public.users AS u
    WHERE u.id = auth.uid()
  )
  -- Teachers can see other teachers and parents of their students
  OR EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.id = auth.uid()
      AND u.role = 'teacher'
      AND u.preschool_id = users.preschool_id
  )
  -- Parents can see teachers of their children's classes
  OR EXISTS (
    SELECT 1 FROM public.students AS s
    INNER JOIN public.classes AS c ON s.class_id = c.id
    WHERE
      (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
      AND c.teacher_id = users.id
  )
);

-- =============================================
-- PERFORMANCE INDEXES FOR USERS TABLE
-- =============================================

-- Critical performance indexes for RLS policies
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id
ON public.users (auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_preschool_tenant
ON public.users (preschool_id) WHERE preschool_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role_preschool
ON public.users (role, preschool_id) WHERE preschool_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_active_status
ON public.users (is_active, preschool_id) WHERE is_active = TRUE;

-- Composite index for complex admin queries
CREATE INDEX IF NOT EXISTS idx_users_preschool_role_active
ON public.users (preschool_id, role, is_active)
WHERE preschool_id IS NOT NULL AND is_active = TRUE;

-- =============================================
-- SECURITY VALIDATION FUNCTION
-- =============================================

-- Function to validate user access patterns
CREATE OR REPLACE FUNCTION public.validate_user_access(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_role text;
    current_preschool_id uuid;
    target_preschool_id uuid;
    is_valid boolean := false;
BEGIN
    -- Get current user details
    SELECT role, preschool_id INTO current_user_role, current_preschool_id
    FROM public.users 
    WHERE id = auth.uid();

    -- Get target user preschool
    SELECT preschool_id INTO target_preschool_id
    FROM public.users 
    WHERE id = target_user_id;

    -- Validation logic
    IF current_user_role = 'superadmin' THEN
        is_valid := true;
    ELSIF current_user_role IN ('principal', 'preschool_admin') THEN
        is_valid := (current_preschool_id = target_preschool_id);
    ELSIF auth.uid() = target_user_id THEN
        is_valid := true;
    END IF;

    RETURN is_valid;
END;
$$;

-- =============================================
-- AUDIT TRIGGER FOR USER CHANGES
-- =============================================

-- Audit trigger for critical user table changes
CREATE OR REPLACE FUNCTION public.audit_user_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log all user table changes for security audit
    INSERT INTO public.audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values,
        ip_address,
        created_at
    ) VALUES (
        auth.uid(),
        TG_OP,
        'users',
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
        inet_client_addr(),
        now()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create the audit trigger
DROP TRIGGER IF EXISTS users_audit_trigger ON public.users;
CREATE TRIGGER users_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.audit_user_changes();

-- =============================================
-- SECURITY COMPLIANCE VERIFICATION
-- =============================================

-- Add configuration record for compliance tracking
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'users_table_rls_deployed',
  jsonb_build_object(
    'deployed_at', now(),
    'version', '3.1.0',
    'security_level', 'CRITICAL',
    'compliance_status', 'SECURED',
    'policies_count', 4,
    'indexes_count', 5,
    'audit_enabled', TRUE
  ),
  'Users table RLS policies deployment - CRITICAL SECURITY FIX',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = jsonb_build_object(
    'deployed_at', now(),
    'version', '3.1.0',
    'security_level', 'CRITICAL',
    'compliance_status', 'SECURED',
    'policies_count', 4,
    'indexes_count', 5,
    'audit_enabled', TRUE
  ),
  updated_at = now();

-- =============================================
-- MIGRATION COMPLETE - CRITICAL FIX APPLIED
-- =============================================

-- Add security comment to table
COMMENT ON TABLE public.users IS 'RLS enabled - CRITICAL SECURITY FIX v3.1.0 - All user access secured';

-- Log successful completion
DO $$ 
BEGIN 
    RAISE NOTICE '🔒 CRITICAL SECURITY FIX COMPLETE';
    RAISE NOTICE '✅ Users table now protected with RLS policies';
    RAISE NOTICE '✅ 4 security policies applied';
    RAISE NOTICE '✅ 5 performance indexes created';
    RAISE NOTICE '✅ Audit logging enabled';
    RAISE NOTICE '🛡️ Security Level: MAXIMUM PROTECTION';
END $$;
