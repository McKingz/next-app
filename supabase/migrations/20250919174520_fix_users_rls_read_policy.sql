-- ============================================
-- Fix users RLS read policy
-- principal visibility, non-recursive, preschool-aware
-- ============================================
-- Generated: 2025-09-19T17:45:20Z

-- Drop and recreate a non-recursive version using JWT/helper functions
-- instead of selecting from users (avoids recursive RLS).

DROP POLICY IF EXISTS users_rls_read ON users;

CREATE POLICY users_rls_read
ON users
FOR SELECT
TO public
USING (
  app_auth.is_superadmin()
  OR id = app_auth.current_user_id()
  OR (
    app_auth.is_principal()
    AND COALESCE(preschool_id, organization_id)
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
  OR (
    app_auth.is_teacher()
    AND role IN ('student', 'parent')
    AND COALESCE(preschool_id, organization_id)
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
  OR (
    app_auth.is_parent()
    AND role = 'teacher'
    AND COALESCE(preschool_id, organization_id)
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
  )
);
