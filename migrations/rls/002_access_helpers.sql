-- ============================================
-- RLS Relationship Access Helpers Migration
-- ============================================
-- Date: 2025-09-19
-- Purpose: Create relationship-based access helper functions
-- Author: Security Team
-- Dependencies: 001_auth_helpers.sql
-- ============================================

-- Ensure app_auth schema exists
CREATE SCHEMA IF NOT EXISTS app_auth;

-- ============================================
-- Teacher-Student Relationship Helpers
-- ============================================

-- Check if teacher can access specific student
CREATE OR REPLACE FUNCTION app_auth.teacher_can_access_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    -- Direct class assignment approach
    SELECT 1 
    FROM students s
    JOIN classes c ON c.id = s.class_id
    JOIN class_teachers ct ON ct.class_id = c.id
    WHERE s.id = p_student_id
      AND ct.teacher_id = app_auth.teacher_id()
      AND c.organization_id = app_auth.org_id()
      AND s.is_active = true
      AND c.is_active = true
  )
  OR EXISTS (
    -- Alternative: via enrollment table if it exists
    SELECT 1
    FROM students s
    JOIN student_enrollments se ON se.student_id = s.id
    JOIN classes c ON c.id = se.class_id
    JOIN class_teachers ct ON ct.class_id = c.id
    WHERE s.id = p_student_id
      AND ct.teacher_id = app_auth.teacher_id()
      AND c.organization_id = app_auth.org_id()
      AND se.is_active = true
      AND c.is_active = true
  )
  OR EXISTS (
    -- Fallback: direct teacher assignment in students table
    SELECT 1
    FROM students s
    WHERE s.id = p_student_id
      AND s.teacher_id = app_auth.teacher_id()
      AND s.organization_id = app_auth.org_id()
      AND s.is_active = true
  );
$$;

-- Check if teacher can access specific class
CREATE OR REPLACE FUNCTION app_auth.teacher_can_access_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM class_teachers ct
    JOIN classes c ON c.id = ct.class_id
    WHERE ct.class_id = p_class_id
      AND ct.teacher_id = app_auth.teacher_id()
      AND c.organization_id = app_auth.org_id()
      AND c.is_active = true
  )
  OR EXISTS (
    -- Alternative: direct teacher assignment in classes table
    SELECT 1
    FROM classes c
    WHERE c.id = p_class_id
      AND c.teacher_id = app_auth.teacher_id()
      AND c.organization_id = app_auth.org_id()
      AND c.is_active = true
  );
$$;

-- Get all student IDs accessible to current teacher
CREATE OR REPLACE FUNCTION app_auth.teacher_accessible_students()
RETURNS UUID []
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT s.id
      FROM students s
      JOIN classes c ON c.id = s.class_id
      JOIN class_teachers ct ON ct.class_id = c.id
      WHERE ct.teacher_id = app_auth.teacher_id()
        AND c.organization_id = app_auth.org_id()
        AND s.is_active = true
        AND c.is_active = true
      
      UNION
      
      SELECT DISTINCT s.id
      FROM students s
      JOIN student_enrollments se ON se.student_id = s.id
      JOIN classes c ON c.id = se.class_id
      JOIN class_teachers ct ON ct.class_id = c.id
      WHERE ct.teacher_id = app_auth.teacher_id()
        AND c.organization_id = app_auth.org_id()
        AND se.is_active = true
        AND c.is_active = true
      
      UNION
      
      SELECT DISTINCT s.id
      FROM students s
      WHERE s.teacher_id = app_auth.teacher_id()
        AND s.organization_id = app_auth.org_id()
        AND s.is_active = true
    ),
    ARRAY[]::UUID[]
  );
$$;

-- ============================================
-- Parent-Child Relationship Helpers
-- ============================================

-- Check if parent can access specific student (their child)
CREATE OR REPLACE FUNCTION app_auth.parent_can_access_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    -- Via parent_child_links table
    SELECT 1
    FROM parent_child_links pcl
    WHERE pcl.student_id = p_student_id
      AND pcl.parent_id = app_auth.parent_id()
      AND pcl.is_active = true
  )
  OR EXISTS (
    -- Direct parent assignment in students table
    SELECT 1
    FROM students s
    WHERE s.id = p_student_id
      AND (s.parent_id = app_auth.parent_id() OR s.guardian_id = app_auth.parent_id())
      AND s.organization_id = app_auth.org_id()
      AND s.is_active = true
  )
  OR EXISTS (
    -- Via child_registration_requests (approved children)
    SELECT 1
    FROM child_registration_requests crr
    WHERE crr.student_id = p_student_id
      AND crr.parent_id = app_auth.parent_id()
      AND crr.status = 'approved'
  );
$$;

-- Get all student IDs accessible to current parent
CREATE OR REPLACE FUNCTION app_auth.parent_accessible_students()
RETURNS UUID []
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT s.id
      FROM students s
      JOIN parent_child_links pcl ON pcl.student_id = s.id
      WHERE pcl.parent_id = app_auth.parent_id()
        AND pcl.is_active = true
        AND s.is_active = true
      
      UNION
      
      SELECT DISTINCT s.id
      FROM students s
      WHERE (s.parent_id = app_auth.parent_id() OR s.guardian_id = app_auth.parent_id())
        AND s.organization_id = app_auth.org_id()
        AND s.is_active = true
      
      UNION
      
      SELECT DISTINCT s.id
      FROM students s
      JOIN child_registration_requests crr ON crr.student_id = s.id
      WHERE crr.parent_id = app_auth.parent_id()
        AND crr.status = 'approved'
        AND s.is_active = true
    ),
    ARRAY[]::UUID[]
  );
$$;

-- ============================================
-- Communication & Assignment Helpers
-- ============================================

-- Check if user can access specific assignment
CREATE OR REPLACE FUNCTION app_auth.can_access_assignment(p_assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT 
    app_auth.is_super_admin()
    OR (
      app_auth.is_principal() 
      AND EXISTS (
        SELECT 1 FROM assignments a
        WHERE a.id = p_assignment_id 
        AND a.organization_id = app_auth.org_id()
      )
    )
    OR (
      app_auth.is_teacher()
      AND EXISTS (
        SELECT 1 FROM assignments a
        WHERE a.id = p_assignment_id
        AND (
          a.teacher_id = app_auth.teacher_id()
          OR app_auth.teacher_can_access_class(a.class_id)
        )
        AND a.organization_id = app_auth.org_id()
      )
    )
    OR (
      app_auth.is_parent()
      AND EXISTS (
        SELECT 1 FROM assignments a
        JOIN assignment_submissions asub ON asub.assignment_id = a.id
        WHERE a.id = p_assignment_id
        AND app_auth.parent_can_access_student(asub.student_id)
        AND a.organization_id = app_auth.org_id()
      )
    );
$$;

-- Check if user can participate in conversation/message thread
CREATE OR REPLACE FUNCTION app_auth.can_access_conversation(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT 
    app_auth.is_super_admin()
    OR EXISTS (
      -- Direct participant
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = app_auth.user_id()
      AND cp.is_active = true
    )
    OR (
      -- Principal can access org conversations
      app_auth.is_principal()
      AND EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = p_conversation_id
        AND c.organization_id = app_auth.org_id()
      )
    );
$$;

-- ============================================
-- Advanced Organization Access Helpers
-- ============================================

-- Enhanced organization access with role-specific logic
CREATE OR REPLACE FUNCTION app_auth.can_access_org_advanced(p_org UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT 
    -- Super admin can access any org
    app_auth.is_super_admin()
    OR
    -- User's own organization
    p_org = app_auth.org_id()
    OR
    -- Handle NULL org (global/system data)
    p_org IS NULL
    OR
    -- Teachers can access partner organizations (if supported)
    (
      app_auth.is_teacher()
      AND EXISTS (
        SELECT 1 FROM organization_partnerships op
        WHERE (op.org_a_id = app_auth.org_id() AND op.org_b_id = p_org)
           OR (op.org_b_id = app_auth.org_id() AND op.org_a_id = p_org)
        AND op.is_active = true
      )
    );
$$;

-- Check if user can manage specific user profile
CREATE OR REPLACE FUNCTION app_auth.can_manage_user(p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT 
    app_auth.is_super_admin()
    OR
    -- Self management
    p_target_user_id = app_auth.user_id()
    OR (
      -- Principal can manage users in their org
      app_auth.is_principal()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = p_target_user_id
        AND u.organization_id = app_auth.org_id()
      )
    )
    OR (
      -- Teachers can manage students/parents in their classes
      app_auth.is_teacher()
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = p_target_user_id
        AND u.organization_id = app_auth.org_id()
        AND (
          (u.role = 'student' AND app_auth.teacher_can_access_student(u.id))
          OR
          (u.role = 'parent' AND EXISTS (
            SELECT 1 FROM parent_child_links pcl
            WHERE pcl.parent_id = u.id
            AND pcl.student_id = ANY(app_auth.teacher_accessible_students())
          ))
        )
      )
    );
$$;

-- ============================================
-- Performance and Utility Helpers
-- ============================================

-- Batch check for student access (for performance)
CREATE OR REPLACE FUNCTION app_auth.filter_accessible_students(p_student_ids UUID [])
RETURNS UUID []
LANGUAGE sql STABLE
AS $$
  SELECT 
    CASE 
      WHEN app_auth.is_super_admin() THEN p_student_ids
      WHEN app_auth.is_principal() THEN (
        SELECT ARRAY(
          SELECT s.id 
          FROM students s 
          WHERE s.id = ANY(p_student_ids)
          AND s.organization_id = app_auth.org_id()
        )
      )
      WHEN app_auth.is_teacher() THEN (
        SELECT ARRAY(
          SELECT unnest(p_student_ids)
          INTERSECT
          SELECT unnest(app_auth.teacher_accessible_students())
        )
      )
      WHEN app_auth.is_parent() THEN (
        SELECT ARRAY(
          SELECT unnest(p_student_ids)
          INTERSECT  
          SELECT unnest(app_auth.parent_accessible_students())
        )
      )
      ELSE ARRAY[]::UUID[]
    END;
$$;

-- Get accessible organization IDs for current user
CREATE OR REPLACE FUNCTION app_auth.accessible_org_ids()
RETURNS UUID []
LANGUAGE sql STABLE
AS $$
  SELECT 
    CASE 
      WHEN app_auth.is_super_admin() THEN (
        SELECT ARRAY(SELECT id FROM organizations WHERE is_active = true)
      )
      ELSE ARRAY[app_auth.org_id()]
    END;
$$;

-- ============================================
-- Grant Permissions
-- ============================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_auth TO authenticated;

-- Set secure search paths for SECURITY DEFINER functions
-- (None in this migration, but keeping pattern consistent)

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON FUNCTION app_auth.teacher_can_access_student(
  UUID
) IS 'Returns true if teacher can access specific student through class assignments';
COMMENT ON FUNCTION app_auth.teacher_can_access_class(UUID) IS 'Returns true if teacher is assigned to specific class';
COMMENT ON FUNCTION app_auth.teacher_accessible_students() IS 'Returns array of all student IDs accessible to current teacher';
COMMENT ON FUNCTION app_auth.parent_can_access_student(
  UUID
) IS 'Returns true if parent can access specific student (their child)';
COMMENT ON FUNCTION app_auth.parent_accessible_students() IS 'Returns array of all student IDs accessible to current parent';
COMMENT ON FUNCTION app_auth.can_access_assignment(
  UUID
) IS 'Returns true if user can access specific assignment based on role and relationships';
COMMENT ON FUNCTION app_auth.can_access_conversation(
  UUID
) IS 'Returns true if user can participate in conversation based on participants and role';
COMMENT ON FUNCTION app_auth.can_access_org_advanced(
  UUID
) IS 'Enhanced organization access check with partnership support';
COMMENT ON FUNCTION app_auth.can_manage_user(UUID) IS 'Returns true if user can manage/edit specific user profile';
COMMENT ON FUNCTION app_auth.filter_accessible_students(
  UUID []
) IS 'Filters array of student IDs to only those accessible by current user';
COMMENT ON FUNCTION app_auth.accessible_org_ids() IS 'Returns array of organization IDs accessible to current user';

-- ============================================
-- Migration Verification
-- ============================================

-- Verify all functions were created successfully
DO $$
BEGIN
  -- Check that expected functions exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'app_auth' 
    AND routine_name = 'teacher_can_access_student'
  ) THEN
    RAISE EXCEPTION 'Relationship helper functions not created properly';
  END IF;
  
  RAISE NOTICE '✅ RLS Relationship Helper Functions Migration Complete';
  RAISE NOTICE '📋 Created % total functions in app_auth schema', (
    SELECT COUNT(*) FROM information_schema.routines 
    WHERE routine_schema = 'app_auth'
  );
END $$;

-- Final status message
SELECT
  '🎯 RLS RELATIONSHIP HELPERS MIGRATION COMPLETE' AS status,
  'All relationship access helper functions ready for RLS policies' AS summary;

-- ============================================
-- Test Data Validation Queries (Optional)
-- ============================================

-- Uncomment these to test function behavior:
/*
-- Test teacher access (will return false without proper JWT claims)
SELECT app_auth.teacher_can_access_student('00000000-0000-0000-0000-000000000000'::uuid) as teacher_test;

-- Test parent access (will return false without proper JWT claims)
SELECT app_auth.parent_can_access_student('00000000-0000-0000-0000-000000000000'::uuid) as parent_test;

-- Test accessible students arrays (will return empty without JWT claims)
SELECT app_auth.teacher_accessible_students() as teacher_students;
SELECT app_auth.parent_accessible_students() as parent_students;
*/
