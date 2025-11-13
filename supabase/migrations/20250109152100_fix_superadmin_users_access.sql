-- =============================================
-- EMERGENCY FIX: Superadmin Users Table Access  
-- Issue: RLS policies blocking superadmin web access
-- Fix: Add superadmin role-based policy for authenticated users
-- =============================================

-- Drop and recreate the superadmin policy to include authenticated superadmin users
DROP POLICY IF EXISTS users_superadmin_access ON public.users;

-- FIXED: Superadmin access for both service role AND authenticated superadmin users
CREATE POLICY users_superadmin_access ON public.users
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

-- NEW: Superadmin access for authenticated users with superadmin role
CREATE POLICY users_superadmin_authenticated_access ON public.users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.id = auth.uid()
      AND u.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.id = auth.uid()
      AND u.role = 'superadmin'
  )
);

-- Ensure the tenant admin access policy is more permissive for superadmin
DROP POLICY IF EXISTS users_tenant_admin_access ON public.users;

CREATE POLICY users_tenant_admin_access ON public.users
FOR ALL
TO authenticated
USING (
  -- User is superadmin (full platform access)
  EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE
      admin_user.id = auth.uid()
      AND admin_user.role = 'superadmin'
  )
  -- Or user is principal/admin in the same preschool
  OR EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE
      admin_user.id = auth.uid()
      AND admin_user.role IN ('principal', 'preschool_admin')
      AND admin_user.preschool_id = users.preschool_id
  )
)
WITH CHECK (
  -- Superadmin can create/update any user
  EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE
      admin_user.id = auth.uid()
      AND admin_user.role = 'superadmin'
  )
  -- Or principal/admin can manage users in their preschool
  OR EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE
      admin_user.id = auth.uid()
      AND admin_user.role IN ('principal', 'preschool_admin')
      AND admin_user.preschool_id = users.preschool_id
  )
);

-- Add an index to optimize the superadmin role lookup
CREATE INDEX IF NOT EXISTS idx_users_superadmin_role
ON public.users (id) WHERE role = 'superadmin';

-- Log the fix
DO $$ 
BEGIN 
    RAISE NOTICE '🔧 EMERGENCY FIX APPLIED: Superadmin Users Access';
    RAISE NOTICE '✅ Superadmin users can now access users table via web app';
    RAISE NOTICE '✅ Both service_role and authenticated superadmin access enabled';
    RAISE NOTICE '🛡️ Security maintained with role-based checks';
END $$;
