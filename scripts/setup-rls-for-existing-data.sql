-- Safe RLS Setup for Existing EduDash Pro Database
-- This script applies RLS policies to your existing database WITHOUT creating new data
-- Compatible with your current data: 2 preschools, 7 users, 1 student, etc.

BEGIN;

-- ============================================================================
-- ENABLE RLS ON ALL CRITICAL TABLES
-- ============================================================================

-- Enable RLS on all tenant tables (safe - won't affect existing data)
ALTER TABLE public.preschools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE HELPER FUNCTIONS FOR RBAC
-- ============================================================================

-- Function to get current user's preschool ID
CREATE OR REPLACE FUNCTION auth.get_user_preschool_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT preschool_id 
  FROM public.users 
  WHERE auth_user_id = auth.uid();
$$;

-- Function to check if user has role in specific preschool
CREATE OR REPLACE FUNCTION auth.has_role_in_preschool(target_preschool_id UUID, required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND preschool_id = target_preschool_id 
    AND role = ANY(required_roles)
  );
$$;

-- Function to check if user can access preschool (includes super admin bypass)
CREATE OR REPLACE FUNCTION auth.can_access_preschool(target_preschool_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    -- Super admin can access all (role = 'superadmin' in your data)
    (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'superadmin'))
    OR
    -- Regular users: must be member of the preschool
    (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND preschool_id = target_preschool_id));
$$;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION auth.is_superadmin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'superadmin'
  );
$$;

-- ============================================================================
-- CREATE RLS POLICIES (COMPATIBLE WITH YOUR EXISTING DATA)
-- ============================================================================

-- PRESCHOOLS: Users can only access their own preschool, superadmin can access all
DROP POLICY IF EXISTS "Preschool access control" ON public.preschools;
CREATE POLICY "Preschool access control"
  ON public.preschools FOR ALL
  TO authenticated
  USING (
    auth.is_superadmin() OR 
    auth.can_access_preschool(id)
  )
  WITH CHECK (
    auth.is_superadmin() OR
    auth.has_role_in_preschool(id, ARRAY['principal'])
  );

-- USERS: Self access + preschool admin access + superadmin access
DROP POLICY IF EXISTS "User access control" ON public.users;
CREATE POLICY "User access control"
  ON public.users FOR ALL
  TO authenticated
  USING (
    auth_user_id = auth.uid() OR  -- Self access
    auth.is_superadmin() OR       -- Superadmin can see all
    (preschool_id IS NOT NULL AND auth.can_access_preschool(preschool_id))  -- School admin access
  )
  WITH CHECK (
    auth_user_id = auth.uid() OR  -- Self updates
    auth.is_superadmin() OR       -- Superadmin can update all
    (preschool_id IS NOT NULL AND auth.has_role_in_preschool(preschool_id, ARRAY['principal']))
  );

-- STUDENTS: School staff and parents can access, superadmin can access all
DROP POLICY IF EXISTS "Student access control" ON public.students;
CREATE POLICY "Student access control"
  ON public.students FOR ALL
  TO authenticated
  USING (
    auth.is_superadmin() OR       -- Superadmin can see all
    auth.can_access_preschool(preschool_id) OR  -- School staff access
    EXISTS (  -- Parent access to their own children
      SELECT 1 FROM public.users 
      WHERE auth_user_id = auth.uid() 
      AND id = public.students.parent_id
    )
  )
  WITH CHECK (
    auth.is_superadmin() OR
    auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'teacher'])
  );

-- CLASSES: School staff can access, superadmin can access all
DROP POLICY IF EXISTS "Class access control" ON public.classes;
CREATE POLICY "Class access control"
  ON public.classes FOR ALL
  TO authenticated
  USING (
    auth.is_superadmin() OR
    auth.can_access_preschool(preschool_id)
  )
  WITH CHECK (
    auth.is_superadmin() OR
    auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'teacher'])
  );

-- ASSIGNMENTS: Teachers and principals can manage, students can view their assignments
DROP POLICY IF EXISTS "Assignment access control" ON public.assignments;
CREATE POLICY "Assignment access control"
  ON public.assignments FOR ALL
  TO authenticated
  USING (
    auth.is_superadmin() OR
    -- Check if the assignment belongs to user's preschool (need to join through classes)
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = public.assignments.class_id
      AND auth.can_access_preschool(c.preschool_id)
    ) OR
    -- Students can view assignments for their classes
    EXISTS (
      SELECT 1 FROM public.students s 
      JOIN public.classes c ON s.class_id = c.id
      WHERE s.parent_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
      AND c.id = public.assignments.class_id
    )
  )
  WITH CHECK (
    auth.is_superadmin() OR
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = public.assignments.class_id
      AND auth.has_role_in_preschool(c.preschool_id, ARRAY['principal', 'teacher'])
    )
  );

-- HOMEWORK ASSIGNMENTS: Similar to assignments
DROP POLICY IF EXISTS "Homework assignment access control" ON public.homework_assignments;
CREATE POLICY "Homework assignment access control"
  ON public.homework_assignments FOR ALL
  TO authenticated
  USING (
    auth.is_superadmin() OR
    auth.can_access_preschool(preschool_id) OR
    -- Students can view homework for their classes
    EXISTS (
      SELECT 1 FROM public.students s 
      WHERE s.parent_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
      AND s.class_id = public.homework_assignments.class_id
    )
  )
  WITH CHECK (
    auth.is_superadmin() OR
    auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'teacher'])
  );

-- ACTIVITY FEED: School community can access
DROP POLICY IF EXISTS "Activity feed access control" ON public.activity_feed;
CREATE POLICY "Activity feed access control"
  ON public.activity_feed FOR ALL
  TO authenticated
  USING (
    auth.is_superadmin() OR
    auth.can_access_preschool(preschool_id)
  )
  WITH CHECK (
    auth.is_superadmin() OR
    auth.can_access_preschool(preschool_id)
  );

-- CLASSROOM REPORTS: Teachers create, parents can view their child's reports
DROP POLICY IF EXISTS "Classroom report access control" ON public.classroom_reports;
CREATE POLICY "Classroom report access control"
  ON public.classroom_reports FOR ALL
  TO authenticated
  USING (
    auth.is_superadmin() OR
    auth.can_access_preschool(preschool_id) OR
    -- Parents can view reports about their children
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = public.classroom_reports.student_id
      AND s.parent_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.is_superadmin() OR
    auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'teacher'])
  );

-- ATTENDANCE: Teachers can manage, parents can view their child's attendance
DROP POLICY IF EXISTS "Attendance access control" ON public.attendance;
CREATE POLICY "Attendance access control"
  ON public.attendance FOR ALL
  TO authenticated
  USING (
    auth.is_superadmin() OR
    -- School staff can see all attendance for their preschool
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = public.attendance.student_id
      AND auth.can_access_preschool(s.preschool_id)
    ) OR
    -- Parents can see their child's attendance
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = public.attendance.student_id
      AND s.parent_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.is_superadmin() OR
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = public.attendance.student_id
      AND auth.has_role_in_preschool(s.preschool_id, ARRAY['principal', 'teacher'])
    )
  );

-- ANNOUNCEMENTS: School community can read, staff can create
DROP POLICY IF EXISTS "Announcement access control" ON public.announcements;
CREATE POLICY "Announcement access control"
  ON public.announcements FOR ALL
  TO authenticated
  USING (
    auth.is_superadmin() OR
    auth.can_access_preschool(preschool_id)
  )
  WITH CHECK (
    auth.is_superadmin() OR
    auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'teacher'])
  );

-- AI USAGE LOGS: Only superadmin and preschool staff can access
DROP POLICY IF EXISTS "AI usage log access control" ON public.ai_usage_logs;
CREATE POLICY "AI usage log access control"
  ON public.ai_usage_logs FOR ALL
  TO authenticated
  USING (
    auth.is_superadmin() OR
    auth.can_access_preschool(preschool_id)
  )
  WITH CHECK (
    auth.is_superadmin() OR
    auth.can_access_preschool(preschool_id)
  );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION auth.get_user_preschool_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_role_in_preschool(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.can_access_preschool(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_superadmin() TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these after applying RLS to test)
-- ============================================================================

-- Test 1: Check if RLS is enabled on all tables
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('preschools', 'users', 'students', 'classes')
ORDER BY tablename;

-- Test 2: Check RLS policies created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;