-- Enhanced Educational RLS Policies
-- Date: 2025-09-21
-- Purpose: Comprehensive Row Level Security policies for educational entities
-- Enhances existing policies with additional security layers and edge case coverage

BEGIN;

-- ====================================================================
-- PART 1: ENHANCED HELPER FUNCTIONS
-- ====================================================================

-- Function to check if user owns a specific course (instructor)
CREATE OR REPLACE FUNCTION public.user_owns_course(course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM courses 
        WHERE id = course_id 
        AND instructor_id = auth.uid()
        AND deleted_at IS NULL
    );
$$;

-- Function to check if user is enrolled in a course (student)
CREATE OR REPLACE FUNCTION public.user_enrolled_in_course(course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        WHERE e.course_id = course_id
        AND e.student_id = auth.uid()
        AND e.is_active = true
        AND c.deleted_at IS NULL
    );
$$;

-- Function to check if assignment is available to students
CREATE OR REPLACE FUNCTION public.assignment_available_to_student(assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM assignments a
        WHERE a.id = assignment_id
        AND a.deleted_at IS NULL
        AND (a.available_from IS NULL OR a.available_from <= now())
        AND (a.available_until IS NULL OR a.available_until > now())
    );
$$;

-- Function to check if user can access assignment (enrolled student or instructor)
CREATE OR REPLACE FUNCTION public.user_can_access_assignment(assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM assignments a
        JOIN courses c ON c.id = a.course_id
        WHERE a.id = assignment_id
        AND a.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND (
            -- User is the course instructor
            c.instructor_id = auth.uid() OR
            -- User is enrolled in the course
            EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.course_id = c.id
                AND e.student_id = auth.uid()
                AND e.is_active = true
            )
        )
    );
$$;

-- Function to check if user owns a submission
CREATE OR REPLACE FUNCTION public.user_owns_submission(submission_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM submissions 
        WHERE id = submission_id 
        AND student_id = auth.uid()
    );
$$;

-- Function to check if user can access submission (owner, instructor, or admin)
CREATE OR REPLACE FUNCTION public.user_can_access_submission(submission_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN courses c ON c.id = a.course_id
        WHERE s.id = submission_id
        AND a.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND (
            -- User is the student who made the submission
            s.student_id = auth.uid() OR
            -- User is the course instructor
            c.instructor_id = auth.uid() OR
            -- User is admin in the organization
            (public.is_admin_level() AND public.can_access_organization(c.organization_id))
        )
    );
$$;

-- Function to check if user can access grade (student with published grade, instructor, or admin)
CREATE OR REPLACE FUNCTION public.user_can_access_grade(grade_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM grades g
        JOIN submissions s ON s.id = g.submission_id
        JOIN assignments a ON a.id = s.assignment_id
        JOIN courses c ON c.id = a.course_id
        WHERE g.id = grade_id
        AND a.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND (
            -- Student can see their own published grade
            (s.student_id = auth.uid() AND g.is_published = true) OR
            -- Course instructor can see all grades
            c.instructor_id = auth.uid() OR
            -- Admin can see all grades in their organization
            (public.is_admin_level() AND public.can_access_organization(c.organization_id))
        )
    );
$$;

-- ====================================================================
-- PART 2: ENHANCED COURSE POLICIES
-- ====================================================================

-- Drop and recreate course policies with enhanced security
DROP POLICY IF EXISTS "Super admins can view all courses" ON courses;
DROP POLICY IF EXISTS "Instructors can view courses in their organization" ON courses;
DROP POLICY IF EXISTS "Students can view courses they are enrolled in" ON courses;
DROP POLICY IF EXISTS "Instructors can create courses in their organization" ON courses;
DROP POLICY IF EXISTS "Course instructors and admins can update their courses" ON courses;
DROP POLICY IF EXISTS "Course instructors and admins can delete their courses" ON courses;

-- Enhanced course read policies
CREATE POLICY "courses_super_admin_read" ON courses
    FOR SELECT USING (public.is_super_admin());

CREATE POLICY "courses_admin_read" ON courses
    FOR SELECT USING (
        public.is_admin_level() AND 
        public.can_access_organization(organization_id) AND
        deleted_at IS NULL
    );

CREATE POLICY "courses_instructor_read" ON courses
    FOR SELECT USING (
        public.is_instructor_level() AND 
        public.can_access_organization(organization_id) AND
        deleted_at IS NULL
    );

CREATE POLICY "courses_enrolled_student_read" ON courses
    FOR SELECT USING (
        public.user_enrolled_in_course(id) AND
        is_active = true AND
        deleted_at IS NULL
    );

CREATE POLICY "courses_public_read" ON courses
    FOR SELECT USING (
        deleted_at IS NULL AND
        is_active = true AND
        -- Add any public course visibility logic here if needed
        false -- Currently no public courses
    );

-- Enhanced course write policies
CREATE POLICY "courses_instructor_create" ON courses
    FOR INSERT WITH CHECK (
        public.is_instructor_level() AND
        public.can_access_organization(organization_id) AND
        instructor_id = auth.uid()
    );

CREATE POLICY "courses_owner_update" ON courses
    FOR UPDATE USING (
        (instructor_id = auth.uid() OR public.is_admin_level()) AND
        public.can_access_organization(organization_id) AND
        deleted_at IS NULL
    );

CREATE POLICY "courses_owner_delete" ON courses
    FOR DELETE USING (
        (instructor_id = auth.uid() OR public.is_admin_level()) AND
        public.can_access_organization(organization_id)
    );

-- ====================================================================
-- PART 3: ENHANCED ENROLLMENT POLICIES
-- ====================================================================

-- Drop existing enrollment policies
DROP POLICY IF EXISTS "Super admins can view all enrollments" ON enrollments;
DROP POLICY IF EXISTS "Instructors can view enrollments for their courses" ON enrollments;
DROP POLICY IF EXISTS "Students can view their own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Instructors and admins can manage enrollments for their courses" ON enrollments;
DROP POLICY IF EXISTS "Students can enroll themselves in courses" ON enrollments;

-- Enhanced enrollment read policies
CREATE POLICY "enrollments_super_admin_read" ON enrollments
    FOR SELECT USING (public.is_super_admin());

CREATE POLICY "enrollments_instructor_read" ON enrollments
    FOR SELECT USING (
        public.is_instructor_level() AND
        public.user_owns_course(course_id)
    );

CREATE POLICY "enrollments_admin_read" ON enrollments
    FOR SELECT USING (
        public.is_admin_level() AND
        EXISTS (
            SELECT 1 FROM courses c
            WHERE c.id = enrollments.course_id
            AND public.can_access_organization(c.organization_id)
        )
    );

CREATE POLICY "enrollments_student_read_own" ON enrollments
    FOR SELECT USING (student_id = auth.uid());

-- Enhanced enrollment write policies
CREATE POLICY "enrollments_instructor_manage" ON enrollments
    FOR ALL USING (
        public.is_instructor_level() AND
        public.user_owns_course(course_id)
    );

CREATE POLICY "enrollments_admin_manage" ON enrollments
    FOR ALL USING (
        public.is_admin_level() AND
        EXISTS (
            SELECT 1 FROM courses c
            WHERE c.id = enrollments.course_id
            AND public.can_access_organization(c.organization_id)
        )
    );

CREATE POLICY "enrollments_student_self_enroll" ON enrollments
    FOR INSERT WITH CHECK (
        student_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM courses c
            WHERE c.id = course_id
            AND c.is_active = true
            AND c.deleted_at IS NULL
            AND public.can_access_organization(c.organization_id)
        )
    );

CREATE POLICY "enrollments_student_self_update" ON enrollments
    FOR UPDATE USING (
        student_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM courses c
            WHERE c.id = enrollments.course_id
            AND c.is_active = true
            AND c.deleted_at IS NULL
        )
    );

-- ====================================================================
-- PART 4: ENHANCED ASSIGNMENT POLICIES
-- ====================================================================

-- Drop existing assignment policies
DROP POLICY IF EXISTS "Super admins can view all assignments" ON assignments;
DROP POLICY IF EXISTS "Course instructors can view their assignments" ON assignments;
DROP POLICY IF EXISTS "Students can view assignments for enrolled courses" ON assignments;
DROP POLICY IF EXISTS "Course instructors can manage their assignments" ON assignments;

-- Enhanced assignment read policies
CREATE POLICY "assignments_super_admin_read" ON assignments
    FOR SELECT USING (public.is_super_admin());

CREATE POLICY "assignments_instructor_read" ON assignments
    FOR SELECT USING (
        public.is_instructor_level() AND
        public.user_can_access_assignment(id) AND
        deleted_at IS NULL
    );

CREATE POLICY "assignments_admin_read" ON assignments
    FOR SELECT USING (
        public.is_admin_level() AND
        EXISTS (
            SELECT 1 FROM courses c
            WHERE c.id = assignments.course_id
            AND public.can_access_organization(c.organization_id)
        ) AND deleted_at IS NULL
    );

CREATE POLICY "assignments_enrolled_student_read" ON assignments
    FOR SELECT USING (
        public.user_enrolled_in_course(course_id) AND
        public.assignment_available_to_student(id) AND
        deleted_at IS NULL
    );

-- Enhanced assignment write policies
CREATE POLICY "assignments_instructor_manage" ON assignments
    FOR ALL USING (
        public.is_instructor_level() AND
        public.user_owns_course(course_id) AND
        (deleted_at IS NULL OR current_setting('request.method') = 'DELETE')
    );

CREATE POLICY "assignments_admin_manage" ON assignments
    FOR ALL USING (
        public.is_admin_level() AND
        EXISTS (
            SELECT 1 FROM courses c
            WHERE c.id = assignments.course_id
            AND public.can_access_organization(c.organization_id)
        )
    );

-- ====================================================================
-- PART 5: ENHANCED SUBMISSION POLICIES
-- ====================================================================

-- Drop existing submission policies
DROP POLICY IF EXISTS "Super admins can view all submissions" ON submissions;
DROP POLICY IF EXISTS "Course instructors can view submissions for their assignments" ON submissions;
DROP POLICY IF EXISTS "Students can view their own submissions" ON submissions;
DROP POLICY IF EXISTS "Students can create and update their own submissions" ON submissions;

-- Enhanced submission read policies
CREATE POLICY "submissions_super_admin_read" ON submissions
    FOR SELECT USING (public.is_super_admin());

CREATE POLICY "submissions_instructor_read" ON submissions
    FOR SELECT USING (
        public.is_instructor_level() AND
        EXISTS (
            SELECT 1 FROM assignments a
            JOIN courses c ON c.id = a.course_id
            WHERE a.id = submissions.assignment_id
            AND (c.instructor_id = auth.uid() OR public.can_access_organization(c.organization_id))
            AND a.deleted_at IS NULL
            AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "submissions_student_read_own" ON submissions
    FOR SELECT USING (student_id = auth.uid());

-- Enhanced submission write policies
CREATE POLICY "submissions_student_manage_own" ON submissions
    FOR ALL USING (
        student_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM assignments a
            JOIN courses c ON c.id = a.course_id
            JOIN enrollments e ON e.course_id = c.id
            WHERE a.id = submissions.assignment_id
            AND e.student_id = auth.uid()
            AND e.is_active = true
            AND a.deleted_at IS NULL
            AND c.deleted_at IS NULL
            AND c.is_active = true
            -- Check assignment availability for updates
            AND (
                current_setting('request.method') = 'SELECT' OR
                (a.available_until IS NULL OR a.available_until > now())
            )
        )
    );

CREATE POLICY "submissions_instructor_manage" ON submissions
    FOR ALL USING (
        public.is_instructor_level() AND
        EXISTS (
            SELECT 1 FROM assignments a
            JOIN courses c ON c.id = a.course_id
            WHERE a.id = submissions.assignment_id
            AND c.instructor_id = auth.uid()
            AND a.deleted_at IS NULL
            AND c.deleted_at IS NULL
        )
    );

-- ====================================================================
-- PART 6: ENHANCED GRADE POLICIES
-- ====================================================================

-- Drop existing grade policies
DROP POLICY IF EXISTS "Super admins can view all grades" ON grades;
DROP POLICY IF EXISTS "Course instructors can view grades for their assignments" ON grades;
DROP POLICY IF EXISTS "Students can view their own published grades" ON grades;
DROP POLICY IF EXISTS "Course instructors can manage grades for their assignments" ON grades;

-- Enhanced grade read policies
CREATE POLICY "grades_super_admin_read" ON grades
    FOR SELECT USING (public.is_super_admin());

CREATE POLICY "grades_instructor_read" ON grades
    FOR SELECT USING (
        public.is_instructor_level() AND
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN courses c ON c.id = a.course_id
            WHERE s.id = grades.submission_id
            AND (c.instructor_id = auth.uid() OR public.can_access_organization(c.organization_id))
            AND a.deleted_at IS NULL
            AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "grades_admin_read" ON grades
    FOR SELECT USING (
        public.is_admin_level() AND
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN courses c ON c.id = a.course_id
            WHERE s.id = grades.submission_id
            AND public.can_access_organization(c.organization_id)
            AND a.deleted_at IS NULL
            AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "grades_student_read_published" ON grades
    FOR SELECT USING (
        is_published = true AND
        EXISTS (
            SELECT 1 FROM submissions s
            WHERE s.id = grades.submission_id
            AND s.student_id = auth.uid()
        )
    );

-- Enhanced grade write policies
CREATE POLICY "grades_instructor_manage" ON grades
    FOR ALL USING (
        public.is_instructor_level() AND
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN courses c ON c.id = a.course_id
            WHERE s.id = grades.submission_id
            AND (c.instructor_id = auth.uid() OR public.can_access_organization(c.organization_id))
            AND a.deleted_at IS NULL
            AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "grades_admin_manage" ON grades
    FOR ALL USING (
        public.is_admin_level() AND
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN courses c ON c.id = a.course_id
            WHERE s.id = grades.submission_id
            AND public.can_access_organization(c.organization_id)
            AND a.deleted_at IS NULL
            AND c.deleted_at IS NULL
        )
    );

-- ====================================================================
-- PART 7: ADDITIONAL SECURITY CONSTRAINTS
-- ====================================================================

-- Prevent students from modifying graded submissions
CREATE OR REPLACE FUNCTION public.prevent_graded_submission_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if submission has been graded and user is a student
    IF TG_OP = 'UPDATE' AND OLD.student_id = auth.uid() AND
       NOT public.is_instructor_level() AND
       EXISTS (
           SELECT 1 FROM grades g
           WHERE g.submission_id = OLD.id
       ) THEN
        RAISE EXCEPTION 'Cannot modify graded submission';
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to prevent graded submission modifications
DROP TRIGGER IF EXISTS prevent_graded_submission_modification ON submissions;
CREATE TRIGGER prevent_graded_submission_modification
    BEFORE UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_graded_submission_modification();

-- Function to prevent enrollment in inactive courses
CREATE OR REPLACE FUNCTION public.validate_enrollment_course_active()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NOT EXISTS (
            SELECT 1 FROM courses c
            WHERE c.id = NEW.course_id
            AND c.is_active = true
            AND c.deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Cannot enroll in inactive or deleted course';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to validate enrollment course status
DROP TRIGGER IF EXISTS validate_enrollment_course_active ON enrollments;
CREATE TRIGGER validate_enrollment_course_active
    BEFORE INSERT OR UPDATE ON enrollments
    FOR EACH ROW
    EXECUTE FUNCTION validate_enrollment_course_active();

-- Function to prevent assignment creation in inactive courses
CREATE OR REPLACE FUNCTION public.validate_assignment_course_active()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NOT EXISTS (
            SELECT 1 FROM courses c
            WHERE c.id = NEW.course_id
            AND c.is_active = true
            AND c.deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Cannot create assignment in inactive or deleted course';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to validate assignment course status
DROP TRIGGER IF EXISTS validate_assignment_course_active ON assignments;
CREATE TRIGGER validate_assignment_course_active
    BEFORE INSERT OR UPDATE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION validate_assignment_course_active();

-- ====================================================================
-- PART 8: AUDIT AND LOGGING TRIGGERS
-- ====================================================================

-- Function to log sensitive operations
CREATE OR REPLACE FUNCTION public.log_educational_operations()
RETURNS TRIGGER AS $$
DECLARE
    operation_type text;
    table_name text;
    record_data jsonb;
BEGIN
    table_name := TG_TABLE_NAME;
    operation_type := TG_OP;
    
    -- Prepare record data
    CASE TG_OP
        WHEN 'INSERT' THEN record_data := to_jsonb(NEW);
        WHEN 'UPDATE' THEN record_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
        WHEN 'DELETE' THEN record_data := to_jsonb(OLD);
    END CASE;
    
    -- Log to audit_logs table if it exists
    BEGIN
        INSERT INTO audit_logs (
            actor_id,
            actor_organization_id,
            action,
            resource_type,
            resource_id,
            metadata,
            ip_address,
            user_agent,
            created_at
        ) VALUES (
            auth.uid(),
            public.get_user_organization_id(),
            operation_type || '_' || table_name,
            table_name,
            COALESCE(NEW.id, OLD.id),
            record_data,
            current_setting('request.headers', true)::json->>'x-forwarded-for',
            current_setting('request.headers', true)::json->>'user-agent',
            now()
        );
    EXCEPTION WHEN OTHERS THEN
        -- Fail silently if audit_logs table doesn't exist or has issues
        NULL;
    END;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for educational tables
DROP TRIGGER IF EXISTS audit_courses ON courses;
CREATE TRIGGER audit_courses
    AFTER INSERT OR UPDATE OR DELETE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION log_educational_operations();

DROP TRIGGER IF EXISTS audit_enrollments ON enrollments;
CREATE TRIGGER audit_enrollments
    AFTER INSERT OR UPDATE OR DELETE ON enrollments
    FOR EACH ROW
    EXECUTE FUNCTION log_educational_operations();

DROP TRIGGER IF EXISTS audit_assignments ON assignments;
CREATE TRIGGER audit_assignments
    AFTER INSERT OR UPDATE OR DELETE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION log_educational_operations();

DROP TRIGGER IF EXISTS audit_submissions ON submissions;
CREATE TRIGGER audit_submissions
    AFTER INSERT OR UPDATE OR DELETE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION log_educational_operations();

DROP TRIGGER IF EXISTS audit_grades ON grades;
CREATE TRIGGER audit_grades
    AFTER INSERT OR UPDATE OR DELETE ON grades
    FOR EACH ROW
    EXECUTE FUNCTION log_educational_operations();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.user_owns_course(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_enrolled_in_course(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assignment_available_to_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_assignment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_submission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_submission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_grade(UUID) TO authenticated;

COMMIT;