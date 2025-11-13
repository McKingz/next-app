-- ============================================
-- EduDash Pro RLS Policies - Phase CRITICAL
-- ============================================
-- Generated: 2025-09-19T14:21:40.961Z
-- Phase: critical
-- Tables: 4
-- Security Level: CRITICAL
-- ============================================

-- Ensure app_auth schema exists (dependency check)
SELECT 1
FROM pg_proc AS p
WHERE
  p.proname = 'is_super_admin'
  AND p.pronamespace = (
    SELECT n.oid
    FROM pg_namespace AS n
    WHERE n.nspname = 'app_auth'
  );


-- ============================================
-- USERS TABLE POLICIES
-- ============================================
-- Description: User accounts with role-based selective access
-- Template: users_selective
-- Priority: critical
-- Complexity: high

-- Drop existing policies
DROP POLICY IF EXISTS users_rls_read
ON users;
DROP POLICY IF EXISTS users_rls_write
ON users;

-- Read Policy
CREATE POLICY users_rls_read
ON users
FOR SELECT
TO public
USING (
  (
    (app_auth.is_superadmin() OR app_auth.is_super_admin())
    OR (
      (app_auth.is_superadmin() OR app_auth.is_super_admin())
      OR app_auth.is_super_admin()
    )
  )
  OR (
    COALESCE(preschool_id, organization_id)
    = COALESCE(
      app_auth.current_user_org_id(),
      app_auth.org_id()
    )
    AND (
      -- Users can see their own record
      id = app_auth.current_user_id()
      OR
      -- Principals can see all users in their organization
      app_auth.is_principal()
      OR
      -- Teachers can see students and parents in their organization
      (
        app_auth.is_teacher()
        AND (role = 'student' OR role = 'parent')
      )
      OR
      -- Parents can see teachers in their organization
      (
        app_auth.is_parent()
        AND role = 'teacher'
        AND COALESCE(preschool_id, organization_id)
        = COALESCE(
          app_auth.current_user_org_id(),
          app_auth.org_id()
        )
      )
    )
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY users_rls_write
ON users
FOR ALL
TO public
USING (
  (
    (app_auth.is_superadmin() OR app_auth.is_super_admin())
    OR (
      (app_auth.is_superadmin() OR app_auth.is_super_admin())
      OR app_auth.is_super_admin()
    )
  )
  OR (
    COALESCE(preschool_id, organization_id)
    = COALESCE(
      app_auth.current_user_org_id(),
      app_auth.org_id()
    )
    AND (
      -- Users can see their own record
      id = app_auth.current_user_id()
      OR
      -- Principals can see all users in their organization
      app_auth.is_principal()
      OR
      -- Teachers can see students and parents in their organization
      (
        app_auth.is_teacher()
        AND (role = 'student' OR role = 'parent')
      )
      OR
      -- Parents can see teachers in their organization
      (
        app_auth.is_parent()
        AND role = 'teacher'
        AND COALESCE(preschool_id, organization_id)
        = COALESCE(
          app_auth.current_user_org_id(),
          app_auth.org_id()
        )
      )
    )
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    COALESCE(preschool_id, organization_id)
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
    AND (
      -- Users can update their own profile
      id = app_auth.current_user_id()
      OR
      -- Principals can manage all users in their organization
      app_auth.is_principal()
    )
  )
);


-- ============================================
-- STUDENTS TABLE POLICIES
-- ============================================
-- Description: Student records with teacher/parent/admin access
-- Template: students_scoped
-- Priority: critical
-- Complexity: high

-- Drop existing policies
DROP POLICY IF EXISTS students_rls_read
ON students;
DROP POLICY IF EXISTS students_rls_write
ON students;

-- Read Policy
CREATE POLICY students_rls_read
ON students
FOR SELECT
TO public
USING (
  (
    (app_auth.is_superadmin() OR app_auth.is_super_admin())
    OR (
      (app_auth.is_superadmin() OR app_auth.is_super_admin())
      OR app_auth.is_super_admin()
    )
  )
  OR (
    preschool_id
    = COALESCE(
      COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
      COALESCE(
        COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
        app_auth.org_id()
      )
    )
    AND (
      -- Principals can see all students in their organization
      app_auth.is_principal()
      OR
      -- Teachers can see students in their organization
      (
        app_auth.is_teacher()
        AND preschool_id
        = COALESCE(
          COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
          COALESCE(
            COALESCE(
              app_auth.current_user_org_id(), app_auth.org_id()
            ),
            app_auth.org_id()
          )
        )
      )
      OR
      -- Parents can see students in their organization (simplified)
      (
        app_auth.is_parent()
        AND preschool_id
        = COALESCE(
          COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
          COALESCE(
            COALESCE(
              app_auth.current_user_org_id(), app_auth.org_id()
            ),
            app_auth.org_id()
          )
        )
      )
    )
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY students_rls_write
ON students
FOR ALL
TO public
USING (
  (
    (app_auth.is_superadmin() OR app_auth.is_super_admin())
    OR (
      (app_auth.is_superadmin() OR app_auth.is_super_admin())
      OR app_auth.is_super_admin()
    )
  )
  OR (
    preschool_id
    = COALESCE(
      COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
      COALESCE(
        COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
        app_auth.org_id()
      )
    )
    AND (
      -- Principals can see all students in their organization
      app_auth.is_principal()
      OR
      -- Teachers can see students in their organization
      (
        app_auth.is_teacher()
        AND preschool_id
        = COALESCE(
          COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
          COALESCE(
            COALESCE(
              app_auth.current_user_org_id(), app_auth.org_id()
            ),
            app_auth.org_id()
          )
        )
      )
      OR
      -- Parents can see students in their organization (simplified)
      (
        app_auth.is_parent()
        AND preschool_id
        = COALESCE(
          COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
          COALESCE(
            COALESCE(
              app_auth.current_user_org_id(), app_auth.org_id()
            ),
            app_auth.org_id()
          )
        )
      )
    )
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
    AND (
      -- Principals can manage all students
      app_auth.is_principal()
      OR
      -- Teachers can update students in their organization
      (
        app_auth.is_teacher()
        AND preschool_id
        = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
      )
    )
  )
);


-- ============================================
-- ORGANIZATIONS TABLE POLICIES
-- ============================================
-- Description: Organization/preschool records
-- Template: org_scoped
-- Priority: critical
-- Complexity: low

-- Drop existing policies
DROP POLICY IF EXISTS organizations_rls_read
ON organizations;
DROP POLICY IF EXISTS organizations_rls_write
ON organizations;

-- Read Policy
CREATE POLICY organizations_rls_read
ON organizations
FOR SELECT
TO public
USING (
  (
    (app_auth.is_superadmin() OR app_auth.is_super_admin())
    OR (
      (app_auth.is_superadmin() OR app_auth.is_super_admin())
      OR app_auth.is_super_admin()
    )
  )
  OR id
  = COALESCE(
    COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
    COALESCE(
      COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
      app_auth.org_id()
    )
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY organizations_rls_write
ON organizations
FOR ALL
TO public
USING (
  (
    (app_auth.is_superadmin() OR app_auth.is_super_admin())
    OR (
      (app_auth.is_superadmin() OR app_auth.is_super_admin())
      OR app_auth.is_super_admin()
    )
  )
  OR id
  = COALESCE(
    COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
    COALESCE(
      COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
      app_auth.org_id()
    )
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    id = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
    AND (
      app_auth.is_principal()
      OR app_auth.is_teacher()
    )
  )
);


-- ============================================
-- CLASSES TABLE POLICIES
-- ============================================
-- Description: Class management data
-- Template: org_scoped
-- Priority: critical
-- Complexity: low

-- Drop existing policies
DROP POLICY IF EXISTS classes_rls_read
ON classes;
DROP POLICY IF EXISTS classes_rls_write
ON classes;

-- Read Policy
CREATE POLICY classes_rls_read
ON classes
FOR SELECT
TO public
USING (
  (
    (app_auth.is_superadmin() OR app_auth.is_super_admin())
    OR (
      (app_auth.is_superadmin() OR app_auth.is_super_admin())
      OR app_auth.is_super_admin()
    )
  )
  OR preschool_id
  = COALESCE(
    COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
    COALESCE(
      COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
      app_auth.org_id()
    )
  )
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY classes_rls_write
ON classes
FOR ALL
TO public
USING (
  (
    (app_auth.is_superadmin() OR app_auth.is_super_admin())
    OR (
      (app_auth.is_superadmin() OR app_auth.is_super_admin())
      OR app_auth.is_super_admin()
    )
  )
  OR preschool_id
  = COALESCE(
    COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
    COALESCE(
      COALESCE(app_auth.current_user_org_id(), app_auth.org_id()),
      app_auth.org_id()
    )
  )
)
WITH CHECK (
  (app_auth.is_superadmin() OR app_auth.is_super_admin())
  OR (
    preschool_id
    = COALESCE(app_auth.current_user_org_id(), app_auth.org_id())
    AND (
      app_auth.is_principal()
      OR app_auth.is_teacher()
    )
  )
);


-- ============================================
-- PERFORMANCE INDEXES FOR RLS POLICIES
-- ============================================
-- Purpose: Optimize RLS policy performance
-- Target: <20ms overhead per query

CREATE INDEX IF NOT EXISTS idx_users_organization_id
ON users (organization_id);

CREATE INDEX IF NOT EXISTS idx_users_org_role
ON users (organization_id, role);

CREATE INDEX IF NOT EXISTS idx_students_preschool_id
ON students (preschool_id);

CREATE INDEX IF NOT EXISTS idx_organizations_id
ON organizations (id);

CREATE INDEX IF NOT EXISTS idx_classes_preschool_id
ON classes (preschool_id);

-- Analyze tables after index creation
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['users', 'students', 'organizations', 'classes'])
    LOOP
        EXECUTE format('ANALYZE %I', t);
    END LOOP;
    RAISE NOTICE '📊 Analyzed tables for query planner optimization';
END $$;

-- ============================================
-- Migration Completion Notice
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS Policy Generation Complete - Phase CRITICAL';
  RAISE NOTICE '📋 Generated policies for 4 tables';
  RAISE NOTICE '🔒 Security level: CRITICAL - Immediate deployment required';
  RAISE NOTICE '⚡ Performance indexes added for optimal query performance';
  RAISE NOTICE '🚨 WARNING: Critical security vulnerabilities addressed';
END $$;
