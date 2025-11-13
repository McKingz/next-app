-- =============================================
-- EMERGENCY FIX: Simple Superadmin UUID Bypass
-- Direct solution to RLS circular dependency
-- =============================================

-- Drop all existing users policies to start clean
DROP POLICY IF EXISTS users_superadmin_access ON public.users;
DROP POLICY IF EXISTS users_superadmin_authenticated_access ON public.users;
DROP POLICY IF EXISTS users_superadmin_uuid_bypass ON public.users;
DROP POLICY IF EXISTS users_service_role_access ON public.users;
DROP POLICY IF EXISTS users_self_access ON public.users;
DROP POLICY IF EXISTS users_tenant_admin_access ON public.users;
DROP POLICY IF EXISTS users_tenant_admin_profiles ON public.users;
DROP POLICY IF EXISTS users_tenant_visibility ON public.users;
DROP POLICY IF EXISTS users_tenant_visibility_profiles ON public.users;
DROP POLICY IF EXISTS users_profile_based_superadmin ON public.users;
DROP POLICY IF EXISTS users_superadmin_function_check ON public.users;

-- 1. Service role gets full access
CREATE POLICY users_service_role_full_access ON public.users
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

-- 2. Direct UUID bypass for known superadmin (EMERGENCY FIX)
CREATE POLICY users_superadmin_emergency_access ON public.users
FOR ALL
TO authenticated
USING (
  auth.uid() = 'd2df36d4-74bc-4ffb-883b-036754764265'::uuid
)
WITH CHECK (
  auth.uid() = 'd2df36d4-74bc-4ffb-883b-036754764265'::uuid
);

-- 3. Self access for all users (their own record)
CREATE POLICY users_self_record_access ON public.users
FOR ALL
TO authenticated
USING (
  id = auth.uid() OR auth_user_id = auth.uid()
)
WITH CHECK (
  id = auth.uid() OR auth_user_id = auth.uid()
);

-- 4. Basic read access for users to see minimal info about others in their preschool
CREATE POLICY users_preschool_read_only ON public.users
FOR SELECT
TO authenticated
USING (
  -- Allow reading users in the same preschool as the current user's profile
  preschool_id IN (
    SELECT p.preschool_id
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
  )
);

-- Temporary comment on table to indicate emergency state
COMMENT ON TABLE public.users IS 'EMERGENCY RLS FIX APPLIED - Direct UUID bypass for superadmin access';

-- Log the emergency fix
DO $$ 
BEGIN 
    RAISE NOTICE '🚨 EMERGENCY FIX: Simple Superadmin UUID Bypass Applied';
    RAISE NOTICE '✅ Direct access granted for UUID: d2df36d4-74bc-4ffb-883b-036754764265';
    RAISE NOTICE '✅ Self access policy restored';
    RAISE NOTICE '✅ Basic preschool visibility maintained';
    RAISE NOTICE '⚠️  This is a temporary fix - optimize after access is restored';
END $$;
