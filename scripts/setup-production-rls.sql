-- Production RLS Setup and Test Data for EduDash Pro
-- This script sets up comprehensive RLS policies and creates sample data
-- for testing role-based access control

BEGIN;

-- ============================================================================
-- ENABLE RLS ON ALL CRITICAL TABLES
-- ============================================================================

-- Enable RLS on all tenant tables
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
  WHERE id = auth.uid();
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
    WHERE id = auth.uid() 
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
    -- Super admin can access all
    (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'))
    OR
    -- Regular users: must be member of the preschool
    (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND preschool_id = target_preschool_id));
$$;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================

-- PRESCHOOLS: Users can only access their own preschool
DROP POLICY IF EXISTS "Users can access their preschool" ON public.preschools;
CREATE POLICY "Users can access their preschool"
  ON public.preschools FOR ALL
  TO authenticated
  USING (auth.can_access_preschool(id))
  WITH CHECK (auth.has_role_in_preschool(id, ARRAY['principal', 'principal_admin', 'super_admin']));

-- USERS: Self access + principals can see their school users
DROP POLICY IF EXISTS "Users can manage their data" ON public.users;
CREATE POLICY "Users can manage their data"
  ON public.users FOR ALL
  TO authenticated
  USING (
    id = auth.uid() OR  -- Self access
    auth.can_access_preschool(preschool_id)  -- School admin access
  )
  WITH CHECK (
    id = auth.uid() OR  -- Self updates
    auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'principal_admin', 'super_admin'])
  );

-- STUDENTS: School staff and parents can access
DROP POLICY IF EXISTS "Student access control" ON public.students;
CREATE POLICY "Student access control"
  ON public.students FOR ALL
  TO authenticated
  USING (
    auth.can_access_preschool(preschool_id) OR  -- School staff access
    EXISTS (  -- Parent access to their own children
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND id IN (public.students.parent_id, public.students.guardian_id)
    )
  )
  WITH CHECK (auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'principal_admin', 'teacher', 'super_admin']));

-- CLASSES: School staff can access
DROP POLICY IF EXISTS "Class access control" ON public.classes;
CREATE POLICY "Class access control"
  ON public.classes FOR ALL
  TO authenticated
  USING (auth.can_access_preschool(preschool_id))
  WITH CHECK (auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'principal_admin', 'teacher', 'super_admin']));

-- ASSIGNMENTS: Teachers and principals can manage, students can view their assignments
DROP POLICY IF EXISTS "Assignment access control" ON public.assignments;
CREATE POLICY "Assignment access control"
  ON public.assignments FOR ALL
  TO authenticated
  USING (
    auth.can_access_preschool(organization_id) OR
    -- Students can view assignments for their classes
    EXISTS (
      SELECT 1 FROM public.students s 
      JOIN public.classes c ON s.class_id = c.id
      WHERE s.user_id = auth.uid() 
      AND c.id = public.assignments.class_id
    )
  )
  WITH CHECK (auth.has_role_in_preschool(organization_id, ARRAY['principal', 'principal_admin', 'teacher', 'super_admin']));

-- HOMEWORK ASSIGNMENTS: Similar to assignments
DROP POLICY IF EXISTS "Homework assignment access control" ON public.homework_assignments;
CREATE POLICY "Homework assignment access control"
  ON public.homework_assignments FOR ALL
  TO authenticated
  USING (
    auth.can_access_preschool(preschool_id) OR
    -- Students can view homework for their classes
    EXISTS (
      SELECT 1 FROM public.students s 
      WHERE s.user_id = auth.uid() 
      AND s.class_id = public.homework_assignments.class_id
    )
  )
  WITH CHECK (auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'principal_admin', 'teacher', 'super_admin']));

-- ACTIVITY FEED: School community can access
DROP POLICY IF EXISTS "Activity feed access control" ON public.activity_feed;
CREATE POLICY "Activity feed access control"
  ON public.activity_feed FOR ALL
  TO authenticated
  USING (auth.can_access_preschool(preschool_id))
  WITH CHECK (auth.can_access_preschool(preschool_id));

-- CLASSROOM REPORTS: Teachers create, parents can view their child's reports
DROP POLICY IF EXISTS "Classroom report access control" ON public.classroom_reports;
CREATE POLICY "Classroom report access control"
  ON public.classroom_reports FOR ALL
  TO authenticated
  USING (
    auth.can_access_preschool(preschool_id) OR
    -- Parents can view reports about their children
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = public.classroom_reports.student_id
      AND s.parent_id = auth.uid()
    )
  )
  WITH CHECK (auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'principal_admin', 'teacher', 'super_admin']));

-- ATTENDANCE: Teachers can manage, parents can view their child's attendance
DROP POLICY IF EXISTS "Attendance access control" ON public.attendance;
CREATE POLICY "Attendance access control"
  ON public.attendance FOR ALL
  TO authenticated
  USING (
    -- School staff can see all attendance
    auth.can_access_preschool((SELECT preschool_id FROM public.students WHERE id = public.attendance.student_id)) OR
    -- Parents can see their child's attendance
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = public.attendance.student_id
      AND s.parent_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.has_role_in_preschool(
      (SELECT preschool_id FROM public.students WHERE id = public.attendance.student_id), 
      ARRAY['principal', 'principal_admin', 'teacher', 'super_admin']
    )
  );

-- ANNOUNCEMENTS: School community can read, staff can create
DROP POLICY IF EXISTS "Announcement access control" ON public.announcements;
CREATE POLICY "Announcement access control"
  ON public.announcements FOR ALL
  TO authenticated
  USING (auth.can_access_preschool(preschool_id))
  WITH CHECK (auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'principal_admin', 'teacher', 'super_admin']));

-- AI USAGE LOGS: Principals can monitor, users can see their own usage
DROP POLICY IF EXISTS "AI usage log access control" ON public.ai_usage_logs;
CREATE POLICY "AI usage log access control"
  ON public.ai_usage_logs FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() OR  -- Users can see their own usage
    auth.has_role_in_preschool(preschool_id, ARRAY['principal', 'principal_admin', 'super_admin'])
  )
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- GRANT APPROPRIATE PERMISSIONS
-- ============================================================================

-- Grant authenticated users access to helper functions
GRANT EXECUTE ON FUNCTION auth.get_user_preschool_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_role_in_preschool(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.can_access_preschool(UUID) TO authenticated;

-- ============================================================================
-- CREATE SAMPLE DATA FOR TESTING
-- ============================================================================

-- Only create sample data if no preschools exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.preschools LIMIT 1) THEN
    
    -- Create sample preschool
    INSERT INTO public.preschools (
      id, name, address, email, phone, max_students, max_teachers, 
      is_active, setup_completed, timezone
    ) VALUES (
      '550e8400-e29b-41d4-a716-446655440000', 
      'Sunnydale Learning Centre', 
      '123 Education Street, Cape Town, 8001', 
      'admin@sunnydale.edu.za', 
      '+27-21-123-4567', 
      120, 
      15, 
      true, 
      true,
      'Africa/Johannesburg'
    );
    
    -- Create sample users (these would normally be created via Supabase Auth)
    -- Note: In production, these should be linked to actual auth.users entries
    
    -- Principal
    INSERT INTO public.users (
      id, email, role, preschool_id, first_name, last_name, is_active, phone
    ) VALUES (
      '11111111-1111-1111-1111-111111111111',
      'principal@sunnydale.edu.za',
      'principal',
      '550e8400-e29b-41d4-a716-446655440000',
      'Sarah',
      'Johnson',
      true,
      '+27-82-123-4567'
    );
    
    -- Teachers
    INSERT INTO public.users (
      id, email, role, preschool_id, first_name, last_name, is_active, phone
    ) VALUES 
    (
      '22222222-2222-2222-2222-222222222222',
      'teacher1@sunnydale.edu.za',
      'teacher',
      '550e8400-e29b-41d4-a716-446655440000',
      'Michael',
      'Smith',
      true,
      '+27-83-234-5678'
    ),
    (
      '33333333-3333-3333-3333-333333333333',
      'teacher2@sunnydale.edu.za',
      'teacher',
      '550e8400-e29b-41d4-a716-446655440000',
      'Emily',
      'Davis',
      true,
      '+27-84-345-6789'
    );
    
    -- Parents
    INSERT INTO public.users (
      id, email, role, preschool_id, first_name, last_name, is_active, phone
    ) VALUES 
    (
      '44444444-4444-4444-4444-444444444444',
      'parent1@example.com',
      'parent',
      '550e8400-e29b-41d4-a716-446655440000',
      'John',
      'Williams',
      true,
      '+27-85-456-7890'
    ),
    (
      '55555555-5555-5555-5555-555555555555',
      'parent2@example.com',
      'parent',
      '550e8400-e29b-41d4-a716-446655440000',
      'Lisa',
      'Brown',
      true,
      '+27-86-567-8901'
    );
    
    -- Super Admin (not tied to a specific preschool)
    INSERT INTO public.users (
      id, email, role, preschool_id, first_name, last_name, is_active, phone
    ) VALUES (
      '99999999-9999-9999-9999-999999999999',
      'superadmin@edudashpro.com',
      'super_admin',
      NULL,
      'Admin',
      'EduDash',
      true,
      '+27-21-555-0000'
    );
    
    -- Create sample classes
    INSERT INTO public.classes (
      id, preschool_id, name, age_group, max_capacity, current_enrollment, teacher_id, is_active
    ) VALUES 
    (
      gen_random_uuid(),
      '550e8400-e29b-41d4-a716-446655440000',
      'Grade R Lions',
      'Grade R',
      25,
      20,
      '22222222-2222-2222-2222-222222222222',
      true
    ),
    (
      gen_random_uuid(),
      '550e8400-e29b-41d4-a716-446655440000',
      'Grade 1 Eagles',
      'Grade 1',
      30,
      25,
      '33333333-3333-3333-3333-333333333333',
      true
    );
    
    -- Create sample students
    INSERT INTO public.students (
      id, preschool_id, first_name, last_name, date_of_birth, 
      parent_id, guardian_id, is_active,
      class_id, grade_level
    ) VALUES 
    (
      gen_random_uuid(),
      '550e8400-e29b-41d4-a716-446655440000',
      'Emma',
      'Williams',
      '2018-03-15',
      '44444444-4444-4444-4444-444444444444',
      NULL,
      true,
      (SELECT id FROM public.classes WHERE name = 'Grade R Lions' LIMIT 1),
      'Grade R'
    ),
    (
      gen_random_uuid(),
      '550e8400-e29b-41d4-a716-446655440000',
      'Liam',
      'Brown',
      '2017-08-22',
      '55555555-5555-5555-5555-555555555555',
      NULL,
      true,
      (SELECT id FROM public.classes WHERE name = 'Grade 1 Eagles' LIMIT 1),
      'Grade 1'
    );
    
    -- Create sample AI usage log
    INSERT INTO public.ai_usage_logs (
      preschool_id, user_id, service_type, ai_service_id, organization_id, status,
      input_tokens, output_tokens, total_cost
    ) VALUES (
      '550e8400-e29b-41d4-a716-446655440000',
      '22222222-2222-2222-2222-222222222222',
      'lesson_generation',
      (SELECT id FROM public.ai_services LIMIT 1),
      '550e8400-e29b-41d4-a716-446655440000',
      'completed',
      1250,
      800,
      0.25
    );
    
    -- Create sample announcement
    INSERT INTO public.announcements (
      preschool_id, author_id, title, content, is_published, target_audience
    ) VALUES (
      '550e8400-e29b-41d4-a716-446655440000',
      '11111111-1111-1111-1111-111111111111',
      'Welcome to the New School Year!',
      'We are excited to welcome all our students and families back for another wonderful year of learning and growth.',
      true,
      'all'
    );
    
    RAISE NOTICE 'Sample data created successfully for Sunnydale Learning Centre';
    
  ELSE
    RAISE NOTICE 'Preschools already exist, skipping sample data creation';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-SETUP VERIFICATION QUERIES (FOR TESTING)
-- ============================================================================

-- These can be run separately to verify the setup
-- SELECT 'RLS Policies Created' as status;
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
-- SELECT count(*) as preschools_count FROM public.preschools;
-- SELECT count(*) as users_count FROM public.users;
-- SELECT role, count(*) as role_count FROM public.users GROUP BY role;