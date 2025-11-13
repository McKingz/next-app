-- Phase 1: Row Level Security (RLS) Policies Migration
-- Date: 2025-09-21
-- Purpose: Add RLS policies for all Phase 1 entities
-- Compatible with existing EduDash Pro RBAC system

BEGIN;

-- ====================================================================
-- PART 1: ENABLE RLS ON ALL TABLES
-- ====================================================================

-- Core educational entities
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- AI and audit entities
ALTER TABLE ai_model_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- PART 2: HELPER FUNCTIONS FOR RBAC
-- ====================================================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND LOWER(role) = LOWER(required_role)
    );
$$;

-- Function to check if user is super admin (works with existing roles)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND LOWER(role) IN ('super_admin', 'superadmin')
    );
$$;

-- Function to check if user is admin level (super_admin, principal_admin, principal)
CREATE OR REPLACE FUNCTION public.is_admin_level()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND LOWER(role) IN ('super_admin', 'superadmin', 'principal_admin', 'principal')
    );
$$;

-- Function to check if user is instructor level (teacher, principal, admin)
CREATE OR REPLACE FUNCTION public.is_instructor_level()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND LOWER(role) IN ('super_admin', 'superadmin', 'principal_admin', 'principal', 'teacher')
    );
$$;

-- Function to get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT preschool_id FROM profiles WHERE id = auth.uid();
$$;

-- Function to check if user can access organization data
CREATE OR REPLACE FUNCTION public.can_access_organization(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        -- Super admins can access all organizations
        public.is_super_admin() OR 
        -- Users can access their own organization
        (public.get_user_organization_id() = org_id);
$$;

-- ====================================================================
-- PART 3: COURSES TABLE POLICIES
-- ====================================================================

-- Courses: Read policies
CREATE POLICY "Super admins can view all courses" ON courses
FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Instructors can view courses in their organization" ON courses
FOR SELECT USING (
  public.is_instructor_level()
  AND public.can_access_organization(organization_id)
  AND deleted_at IS NULL
);

CREATE POLICY "Students can view courses they are enrolled in" ON courses
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM enrollments AS e
    WHERE
      e.course_id = courses.id
      AND e.student_id = auth.uid()
      AND e.is_active = TRUE
  ) AND deleted_at IS NULL
);

-- Courses: Write policies
CREATE POLICY "Instructors can create courses in their organization" ON courses
FOR INSERT WITH CHECK (
  public.is_instructor_level()
  AND public.can_access_organization(organization_id)
  AND instructor_id = auth.uid()
);

CREATE POLICY "Course instructors and admins can update their courses" ON courses
FOR UPDATE USING (
  (instructor_id = auth.uid() OR public.is_admin_level())
  AND public.can_access_organization(organization_id)
  AND deleted_at IS NULL
);

CREATE POLICY "Course instructors and admins can delete their courses" ON courses
FOR DELETE USING (
  (instructor_id = auth.uid() OR public.is_admin_level())
  AND public.can_access_organization(organization_id)
);

-- ====================================================================
-- PART 4: ENROLLMENTS TABLE POLICIES
-- ====================================================================

-- Enrollments: Read policies
CREATE POLICY "Super admins can view all enrollments" ON enrollments
FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Instructors can view enrollments for their courses" ON enrollments
FOR SELECT USING (
  public.is_instructor_level()
  AND EXISTS (
    SELECT 1 FROM courses AS c
    WHERE
      c.id = enrollments.course_id
      AND (c.instructor_id = auth.uid() OR public.can_access_organization(c.organization_id))
  )
);

CREATE POLICY "Students can view their own enrollments" ON enrollments
FOR SELECT USING (student_id = auth.uid());

-- Enrollments: Write policies  
CREATE POLICY "Instructors and admins can manage enrollments for their courses" ON enrollments
FOR ALL USING (
  public.is_instructor_level()
  AND EXISTS (
    SELECT 1 FROM courses AS c
    WHERE
      c.id = enrollments.course_id
      AND (c.instructor_id = auth.uid() OR public.can_access_organization(c.organization_id))
  )
);

CREATE POLICY "Students can enroll themselves in courses" ON enrollments
FOR INSERT WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM courses AS c
    WHERE
      c.id = c.course_id
      AND c.is_active = TRUE
      AND c.deleted_at IS NULL
  )
);

-- ====================================================================
-- PART 5: ASSIGNMENTS TABLE POLICIES
-- ====================================================================

-- Assignments: Read policies
CREATE POLICY "Super admins can view all assignments" ON assignments
FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Course instructors can view their assignments" ON assignments
FOR SELECT USING (
  public.is_instructor_level()
  AND EXISTS (
    SELECT 1 FROM courses AS c
    WHERE
      c.id = assignments.course_id
      AND (c.instructor_id = auth.uid() OR public.can_access_organization(c.organization_id))
  ) AND deleted_at IS NULL
);

CREATE POLICY "Students can view assignments for enrolled courses" ON assignments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM enrollments AS e
    INNER JOIN courses AS c ON e.course_id = c.id
    WHERE
      e.student_id = auth.uid()
      AND e.course_id = assignments.course_id
      AND e.is_active = TRUE
      AND c.deleted_at IS NULL
  ) AND deleted_at IS NULL
  AND (available_from IS NULL OR available_from <= now())
);

-- Assignments: Write policies
CREATE POLICY "Course instructors can manage their assignments" ON assignments
FOR ALL USING (
  public.is_instructor_level()
  AND EXISTS (
    SELECT 1 FROM courses AS c
    WHERE
      c.id = assignments.course_id
      AND (c.instructor_id = auth.uid() OR public.can_access_organization(c.organization_id))
  )
);

-- ====================================================================
-- PART 6: SUBMISSIONS TABLE POLICIES
-- ====================================================================

-- Submissions: Read policies
CREATE POLICY "Super admins can view all submissions" ON submissions
FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Course instructors can view submissions for their assignments" ON submissions
FOR SELECT USING (
  public.is_instructor_level()
  AND EXISTS (
    SELECT 1 FROM assignments AS a
    INNER JOIN courses AS c ON a.course_id = c.id
    WHERE
      a.id = submissions.assignment_id
      AND (c.instructor_id = auth.uid() OR public.can_access_organization(c.organization_id))
      AND a.deleted_at IS NULL
      AND c.deleted_at IS NULL
  )
);

CREATE POLICY "Students can view their own submissions" ON submissions
FOR SELECT USING (student_id = auth.uid());

-- Submissions: Write policies
CREATE POLICY "Students can create and update their own submissions" ON submissions
FOR ALL USING (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM assignments AS a
    INNER JOIN courses AS c ON a.course_id = c.id
    INNER JOIN enrollments AS e ON c.id = e.course_id
    WHERE
      a.id = submissions.assignment_id
      AND e.student_id = auth.uid()
      AND e.is_active = TRUE
      AND a.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND (a.available_until IS NULL OR a.available_until > now())
  )
);

-- ====================================================================
-- PART 7: GRADES TABLE POLICIES  
-- ====================================================================

-- Grades: Read policies
CREATE POLICY "Super admins can view all grades" ON grades
FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Course instructors can view grades for their assignments" ON grades
FOR SELECT USING (
  public.is_instructor_level()
  AND EXISTS (
    SELECT 1 FROM submissions AS s
    INNER JOIN assignments AS a ON s.assignment_id = a.id
    INNER JOIN courses AS c ON a.course_id = c.id
    WHERE
      s.id = grades.submission_id
      AND (c.instructor_id = auth.uid() OR public.can_access_organization(c.organization_id))
      AND a.deleted_at IS NULL
      AND c.deleted_at IS NULL
  )
);

CREATE POLICY "Students can view their own published grades" ON grades
FOR SELECT USING (
  is_published = TRUE
  AND EXISTS (
    SELECT 1 FROM submissions AS s
    WHERE
      s.id = grades.submission_id
      AND s.student_id = auth.uid()
  )
);

-- Grades: Write policies
CREATE POLICY "Course instructors can manage grades for their assignments" ON grades
FOR ALL USING (
  public.is_instructor_level()
  AND EXISTS (
    SELECT 1 FROM submissions AS s
    INNER JOIN assignments AS a ON s.assignment_id = a.id
    INNER JOIN courses AS c ON a.course_id = c.id
    WHERE
      s.id = grades.submission_id
      AND (c.instructor_id = auth.uid() OR public.can_access_organization(c.organization_id))
      AND a.deleted_at IS NULL
      AND c.deleted_at IS NULL
  )
);

-- ====================================================================
-- PART 8: AI MODEL TIERS POLICIES
-- ====================================================================

-- AI Model Tiers: Read-only for most users, manage for super admins
CREATE POLICY "Anyone can view active AI model tiers" ON ai_model_tiers
FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Super admins can manage AI model tiers" ON ai_model_tiers
FOR ALL USING (public.is_super_admin());

-- ====================================================================
-- PART 9: USER AI TIERS POLICIES
-- ====================================================================

-- User AI Tiers: Users can view their own, admins can manage
CREATE POLICY "Users can view their own AI tier" ON user_ai_tiers
FOR SELECT USING (user_id = auth.uid() OR public.is_admin_level());

CREATE POLICY "Admins can manage user AI tiers" ON user_ai_tiers
FOR ALL USING (public.is_admin_level());

-- ====================================================================
-- PART 10: AI USAGE POLICIES
-- ====================================================================

-- AI Usage: Users can view their own, organization admins can view their org
CREATE POLICY "Users can view their own AI usage" ON ai_usage
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Organization admins can view their organization's AI usage" ON ai_usage
FOR SELECT USING (
  public.is_admin_level()
  AND public.can_access_organization(organization_id)
);

CREATE POLICY "Super admins can view all AI usage" ON ai_usage
FOR SELECT USING (public.is_super_admin());

-- AI Usage: Only system functions can write (service role)
-- No INSERT/UPDATE/DELETE policies for regular users

-- ====================================================================
-- PART 11: AUDIT LOGS POLICIES  
-- ====================================================================

-- Audit Logs: Read-only, admin access only
CREATE POLICY "Organization admins can view their organization's audit logs" ON audit_logs
FOR SELECT USING (
  public.is_admin_level()
  AND (
    public.is_super_admin()
    OR public.can_access_organization(actor_organization_id)
  )
);

-- Audit Logs: Only system functions can write (service role)
-- No INSERT/UPDATE/DELETE policies for regular users

COMMIT;
