-- Educational Workflow Functions and Triggers
-- Date: 2025-09-21
-- Purpose: Utility functions and triggers for educational workflows
-- Includes: grade calculations, late penalties, statistics, enrollment limits, audit trails

BEGIN;

-- ====================================================================
-- PART 1: GRADE CALCULATION FUNCTIONS
-- ====================================================================

-- Function to calculate percentage from points
CREATE OR REPLACE FUNCTION public.calculate_grade_percentage(
    points_earned DECIMAL(8,2),
    points_possible DECIMAL(8,2)
)
RETURNS DECIMAL(5,2)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE 
        WHEN points_possible <= 0 THEN 0.00
        ELSE ROUND((points_earned / points_possible * 100.0)::DECIMAL(5,2), 2)
    END;
$$;

-- Function to convert percentage to letter grade
CREATE OR REPLACE FUNCTION public.percentage_to_letter_grade(
    percentage DECIMAL(5,2),
    use_plus_minus BOOLEAN DEFAULT true
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN use_plus_minus THEN
            CASE 
                WHEN percentage >= 97 THEN 'A+'
                WHEN percentage >= 93 THEN 'A'
                WHEN percentage >= 90 THEN 'A-'
                WHEN percentage >= 87 THEN 'B+'
                WHEN percentage >= 83 THEN 'B'
                WHEN percentage >= 80 THEN 'B-'
                WHEN percentage >= 77 THEN 'C+'
                WHEN percentage >= 73 THEN 'C'
                WHEN percentage >= 70 THEN 'C-'
                WHEN percentage >= 67 THEN 'D+'
                WHEN percentage >= 63 THEN 'D'
                WHEN percentage >= 60 THEN 'D-'
                ELSE 'F'
            END
        ELSE
            CASE
                WHEN percentage >= 90 THEN 'A'
                WHEN percentage >= 80 THEN 'B'
                WHEN percentage >= 70 THEN 'C'
                WHEN percentage >= 60 THEN 'D'
                ELSE 'F'
            END
    END;
$$;

-- Function to apply late penalty to grade
CREATE OR REPLACE FUNCTION public.apply_late_penalty(
    original_points DECIMAL(8,2),
    penalty_percent DECIMAL(5,2),
    is_late BOOLEAN
)
RETURNS DECIMAL(8,2)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN NOT is_late OR penalty_percent <= 0 THEN original_points
        ELSE GREATEST(0.00, original_points - (original_points * penalty_percent / 100.0))
    END;
$$;

-- Function to get letter grade GPA points
CREATE OR REPLACE FUNCTION public.letter_grade_to_gpa(letter_grade TEXT)
RETURNS DECIMAL(3,2)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE UPPER(letter_grade)
        WHEN 'A+' THEN 4.00
        WHEN 'A' THEN 4.00
        WHEN 'A-' THEN 3.70
        WHEN 'B+' THEN 3.30
        WHEN 'B' THEN 3.00
        WHEN 'B-' THEN 2.70
        WHEN 'C+' THEN 2.30
        WHEN 'C' THEN 2.00
        WHEN 'C-' THEN 1.70
        WHEN 'D+' THEN 1.30
        WHEN 'D' THEN 1.00
        WHEN 'D-' THEN 0.70
        WHEN 'F' THEN 0.00
        WHEN 'PASS' THEN 4.00
        WHEN 'FAIL' THEN 0.00
        ELSE 0.00
    END;
$$;

-- ====================================================================
-- PART 2: COURSE STATISTICS FUNCTIONS
-- ====================================================================

-- Function to get course enrollment statistics
CREATE OR REPLACE FUNCTION public.get_course_enrollment_stats(course_id UUID)
RETURNS TABLE (
    total_enrolled INTEGER,
    active_enrolled INTEGER,
    inactive_enrolled INTEGER,
    enrollment_rate DECIMAL(5,2),
    max_students INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        COUNT(*)::INTEGER as total_enrolled,
        COUNT(*) FILTER (WHERE e.is_active = true)::INTEGER as active_enrolled,
        COUNT(*) FILTER (WHERE e.is_active = false)::INTEGER as inactive_enrolled,
        CASE 
            WHEN c.max_students IS NULL OR c.max_students = 0 THEN 0.00
            ELSE ROUND((COUNT(*) FILTER (WHERE e.is_active = true)::DECIMAL / c.max_students * 100), 2)
        END as enrollment_rate,
        COALESCE(c.max_students, 0) as max_students
    FROM enrollments e
    RIGHT JOIN courses c ON c.id = course_id
    WHERE e.course_id = course_id OR e.course_id IS NULL
    GROUP BY c.max_students;
$$;

-- Function to get course grade statistics
CREATE OR REPLACE FUNCTION public.get_course_grade_stats(course_id UUID)
RETURNS TABLE (
    total_assignments INTEGER,
    total_submissions INTEGER,
    total_grades INTEGER,
    average_grade DECIMAL(5,2),
    median_grade DECIMAL(5,2),
    grade_distribution JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    percentiles DECIMAL[];
    grade_dist JSONB;
BEGIN
    -- Get basic counts and average
    SELECT 
        COUNT(DISTINCT a.id)::INTEGER,
        COUNT(DISTINCT s.id)::INTEGER,
        COUNT(g.id)::INTEGER,
        ROUND(AVG(g.percentage), 2)
    INTO total_assignments, total_submissions, total_grades, average_grade
    FROM assignments a
    LEFT JOIN submissions s ON s.assignment_id = a.id AND NOT s.is_draft
    LEFT JOIN grades g ON g.submission_id = s.id
    WHERE a.course_id = get_course_grade_stats.course_id
    AND a.deleted_at IS NULL;
    
    -- Get median grade
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY g.percentage)
    INTO median_grade
    FROM assignments a
    JOIN submissions s ON s.assignment_id = a.id AND NOT s.is_draft
    JOIN grades g ON g.submission_id = s.id
    WHERE a.course_id = get_course_grade_stats.course_id
    AND a.deleted_at IS NULL;
    
    -- Get grade distribution
    SELECT jsonb_object_agg(
        CASE 
            WHEN g.percentage >= 90 THEN 'A'
            WHEN g.percentage >= 80 THEN 'B'
            WHEN g.percentage >= 70 THEN 'C'
            WHEN g.percentage >= 60 THEN 'D'
            ELSE 'F'
        END,
        count
    )
    INTO grade_dist
    FROM (
        SELECT 
            CASE 
                WHEN g.percentage >= 90 THEN 'A'
                WHEN g.percentage >= 80 THEN 'B'
                WHEN g.percentage >= 70 THEN 'C'
                WHEN g.percentage >= 60 THEN 'D'
                ELSE 'F'
            END,
            COUNT(*)::INTEGER as count
        FROM assignments a
        JOIN submissions s ON s.assignment_id = a.id AND NOT s.is_draft
        JOIN grades g ON g.submission_id = s.id
        WHERE a.course_id = get_course_grade_stats.course_id
        AND a.deleted_at IS NULL
        GROUP BY 1
    ) grade_counts;
    
    grade_distribution := COALESCE(grade_dist, '{}'::jsonb);
    
    RETURN QUERY SELECT 
        COALESCE(get_course_grade_stats.total_assignments, 0),
        COALESCE(get_course_grade_stats.total_submissions, 0),
        COALESCE(get_course_grade_stats.total_grades, 0),
        COALESCE(get_course_grade_stats.average_grade, 0.00),
        COALESCE(get_course_grade_stats.median_grade, 0.00),
        get_course_grade_stats.grade_distribution;
END;
$$;

-- Function to get student progress in a course
CREATE OR REPLACE FUNCTION public.get_student_course_progress(
    course_id UUID,
    student_id UUID
)
RETURNS TABLE (
    total_assignments INTEGER,
    submitted_assignments INTEGER,
    graded_assignments INTEGER,
    current_grade DECIMAL(5,2),
    completion_rate DECIMAL(5,2),
    on_time_rate DECIMAL(5,2)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        COUNT(DISTINCT a.id)::INTEGER as total_assignments,
        COUNT(DISTINCT s.id) FILTER (WHERE NOT s.is_draft)::INTEGER as submitted_assignments,
        COUNT(DISTINCT g.id)::INTEGER as graded_assignments,
        COALESCE(ROUND(AVG(g.percentage), 2), 0.00) as current_grade,
        CASE 
            WHEN COUNT(DISTINCT a.id) = 0 THEN 0.00
            ELSE ROUND((COUNT(DISTINCT s.id) FILTER (WHERE NOT s.is_draft)::DECIMAL / COUNT(DISTINCT a.id) * 100), 2)
        END as completion_rate,
        CASE 
            WHEN COUNT(DISTINCT s.id) FILTER (WHERE NOT s.is_draft) = 0 THEN 100.00
            ELSE ROUND((COUNT(DISTINCT s.id) FILTER (WHERE NOT s.is_draft AND NOT s.is_late)::DECIMAL / 
                       COUNT(DISTINCT s.id) FILTER (WHERE NOT s.is_draft) * 100), 2)
        END as on_time_rate
    FROM assignments a
    LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = get_student_course_progress.student_id
    LEFT JOIN grades g ON g.submission_id = s.id AND g.is_published = true
    WHERE a.course_id = get_student_course_progress.course_id
    AND a.deleted_at IS NULL;
$$;

-- ====================================================================
-- PART 3: ENROLLMENT MANAGEMENT FUNCTIONS
-- ====================================================================

-- Function to check if course enrollment limit is reached
CREATE OR REPLACE FUNCTION public.is_course_enrollment_full(course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT CASE
        WHEN c.max_students IS NULL THEN false
        WHEN c.max_students <= 0 THEN false
        ELSE (
            SELECT COUNT(*) 
            FROM enrollments e 
            WHERE e.course_id = is_course_enrollment_full.course_id 
            AND e.is_active = true
        ) >= c.max_students
    END
    FROM courses c 
    WHERE c.id = is_course_enrollment_full.course_id;
$$;

-- Function to get available enrollment slots
CREATE OR REPLACE FUNCTION public.get_available_enrollment_slots(course_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT CASE
        WHEN c.max_students IS NULL THEN 999999
        WHEN c.max_students <= 0 THEN 999999
        ELSE GREATEST(0, c.max_students - (
            SELECT COUNT(*) 
            FROM enrollments e 
            WHERE e.course_id = get_available_enrollment_slots.course_id 
            AND e.is_active = true
        )::INTEGER)
    END
    FROM courses c 
    WHERE c.id = get_available_enrollment_slots.course_id;
$$;

-- Function to validate join code
CREATE OR REPLACE FUNCTION public.validate_course_join_code(
    course_id UUID,
    provided_join_code TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = validate_course_join_code.course_id
        AND c.join_code = provided_join_code
        AND c.is_active = true
        AND c.deleted_at IS NULL
        AND (c.join_code_expires_at IS NULL OR c.join_code_expires_at > now())
    );
$$;

-- ====================================================================
-- PART 4: ASSIGNMENT AND SUBMISSION WORKFLOW FUNCTIONS
-- ====================================================================

-- Function to check if assignment accepts submissions
CREATE OR REPLACE FUNCTION public.assignment_accepts_submissions(assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM assignments a
        JOIN courses c ON c.id = a.course_id
        WHERE a.id = assignment_accepts_submissions.assignment_id
        AND a.deleted_at IS NULL
        AND c.is_active = true
        AND c.deleted_at IS NULL
        AND (a.available_from IS NULL OR a.available_from <= now())
        AND (a.available_until IS NULL OR a.available_until > now() OR a.allow_late_submissions = true)
    );
$$;

-- Function to get submission attempt count for a student
CREATE OR REPLACE FUNCTION public.get_submission_attempt_count(
    assignment_id UUID,
    student_id UUID
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COUNT(*)::INTEGER
    FROM submissions s
    WHERE s.assignment_id = get_submission_attempt_count.assignment_id
    AND s.student_id = get_submission_attempt_count.student_id;
$$;

-- Function to check if student can submit (attempt limits)
CREATE OR REPLACE FUNCTION public.can_student_submit(
    assignment_id UUID,
    student_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT CASE
        WHEN NOT public.assignment_accepts_submissions(can_student_submit.assignment_id) THEN false
        WHEN a.max_attempts <= 0 THEN true
        ELSE public.get_submission_attempt_count(can_student_submit.assignment_id, can_student_submit.student_id) < a.max_attempts
    END
    FROM assignments a
    WHERE a.id = can_student_submit.assignment_id;
$$;

-- Function to determine if submission is late
CREATE OR REPLACE FUNCTION public.is_submission_late(
    assignment_id UUID,
    submission_time TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT CASE
        WHEN a.due_at IS NULL THEN false
        ELSE submission_time > a.due_at
    END
    FROM assignments a
    WHERE a.id = is_submission_late.assignment_id;
$$;

-- ====================================================================
-- PART 5: NOTIFICATION TRIGGER FUNCTIONS
-- ====================================================================

-- Function to send enrollment notifications
CREATE OR REPLACE FUNCTION public.notify_enrollment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    course_title TEXT;
    instructor_id UUID;
    student_name TEXT;
    notification_data JSONB;
BEGIN
    -- Get course and student information
    SELECT c.title, c.instructor_id
    INTO course_title, instructor_id
    FROM courses c
    WHERE c.id = COALESCE(NEW.course_id, OLD.course_id);
    
    SELECT p.first_name || ' ' || p.last_name
    INTO student_name
    FROM profiles p
    WHERE p.id = COALESCE(NEW.student_id, OLD.student_id);
    
    -- Prepare notification data
    notification_data := jsonb_build_object(
        'course_id', COALESCE(NEW.course_id, OLD.course_id),
        'course_title', course_title,
        'student_id', COALESCE(NEW.student_id, OLD.student_id),
        'student_name', student_name,
        'enrollment_id', COALESCE(NEW.id, OLD.id)
    );
    
    -- Handle different operations
    IF TG_OP = 'INSERT' THEN
        -- Student enrolled - notify instructor
        BEGIN
            INSERT INTO push_notifications (
                recipient_user_id,
                title,
                body,
                data,
                type,
                preschool_id
            ) VALUES (
                instructor_id,
                'New Student Enrollment',
                student_name || ' enrolled in ' || course_title,
                notification_data,
                'enrollment_new',
                public.get_user_organization_id()
            );
        EXCEPTION WHEN OTHERS THEN
            -- Ignore notification failures
            NULL;
        END;
        
    ELSIF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
        -- Student dropped - notify instructor
        BEGIN
            INSERT INTO push_notifications (
                recipient_user_id,
                title,
                body,
                data,
                type,
                preschool_id
            ) VALUES (
                instructor_id,
                'Student Dropped Course',
                student_name || ' dropped from ' || course_title,
                notification_data,
                'enrollment_dropped',
                public.get_user_organization_id()
            );
        EXCEPTION WHEN OTHERS THEN
            -- Ignore notification failures
            NULL;
        END;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to send assignment notifications
CREATE OR REPLACE FUNCTION public.notify_assignment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    course_title TEXT;
    notification_data JSONB;
    enrolled_students UUID[];
    student_id UUID;
BEGIN
    -- Get course information
    SELECT c.title INTO course_title
    FROM courses c
    WHERE c.id = COALESCE(NEW.course_id, OLD.course_id);
    
    -- Get enrolled students
    SELECT array_agg(e.student_id)
    INTO enrolled_students
    FROM enrollments e
    WHERE e.course_id = COALESCE(NEW.course_id, OLD.course_id)
    AND e.is_active = true;
    
    -- Prepare notification data
    notification_data := jsonb_build_object(
        'assignment_id', COALESCE(NEW.id, OLD.id),
        'assignment_title', COALESCE(NEW.title, OLD.title),
        'course_id', COALESCE(NEW.course_id, OLD.course_id),
        'course_title', course_title,
        'due_at', COALESCE(NEW.due_at, OLD.due_at)
    );
    
    -- Handle new assignment creation
    IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
        -- Notify all enrolled students about new assignment
        FOREACH student_id IN ARRAY enrolled_students
        LOOP
            BEGIN
                INSERT INTO push_notifications (
                    recipient_user_id,
                    title,
                    body,
                    data,
                    type,
                    preschool_id
                ) VALUES (
                    student_id,
                    'New Assignment: ' || NEW.title,
                    'New assignment posted in ' || course_title,
                    notification_data,
                    'assignment_new',
                    public.get_user_organization_id()
                );
            EXCEPTION WHEN OTHERS THEN
                -- Continue with other notifications even if one fails
                CONTINUE;
            END;
        END LOOP;
        
    -- Handle due date changes
    ELSIF TG_OP = 'UPDATE' AND OLD.due_at IS DISTINCT FROM NEW.due_at AND NEW.deleted_at IS NULL THEN
        -- Notify students about due date change
        FOREACH student_id IN ARRAY enrolled_students
        LOOP
            BEGIN
                INSERT INTO push_notifications (
                    recipient_user_id,
                    title,
                    body,
                    data,
                    type,
                    preschool_id
                ) VALUES (
                    student_id,
                    'Assignment Due Date Changed',
                    'Due date updated for "' || NEW.title || '" in ' || course_title,
                    notification_data,
                    'assignment_due_changed',
                    public.get_user_organization_id()
                );
            EXCEPTION WHEN OTHERS THEN
                CONTINUE;
            END;
        END LOOP;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to send grade notifications
CREATE OR REPLACE FUNCTION public.notify_grade_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    assignment_title TEXT;
    course_title TEXT;
    student_id UUID;
    notification_data JSONB;
BEGIN
    -- Only notify when grade is published for the first time
    IF TG_OP = 'UPDATE' AND OLD.is_published = false AND NEW.is_published = true THEN
        
        -- Get assignment and course information
        SELECT 
            a.title,
            c.title,
            s.student_id
        INTO assignment_title, course_title, student_id
        FROM grades g
        JOIN submissions s ON s.id = g.submission_id
        JOIN assignments a ON a.id = s.assignment_id
        JOIN courses c ON c.id = a.course_id
        WHERE g.id = NEW.id;
        
        -- Prepare notification data
        notification_data := jsonb_build_object(
            'grade_id', NEW.id,
            'submission_id', NEW.submission_id,
            'assignment_title', assignment_title,
            'course_title', course_title,
            'points_earned', NEW.points_earned,
            'points_possible', NEW.points_possible,
            'percentage', NEW.percentage,
            'letter_grade', NEW.letter_grade
        );
        
        -- Send notification to student
        BEGIN
            INSERT INTO push_notifications (
                recipient_user_id,
                title,
                body,
                data,
                type,
                preschool_id
            ) VALUES (
                student_id,
                'Grade Published',
                'Your grade for "' || assignment_title || '" is now available',
                notification_data,
                'grade_published',
                public.get_user_organization_id()
            );
        EXCEPTION WHEN OTHERS THEN
            -- Ignore notification failures
            NULL;
        END;
    END IF;
    
    RETURN NEW;
END;
$$;

-- ====================================================================
-- PART 6: CREATE WORKFLOW TRIGGERS
-- ====================================================================

-- Enrollment change notifications
DROP TRIGGER IF EXISTS notify_enrollment_change ON enrollments;
CREATE TRIGGER notify_enrollment_change
    AFTER INSERT OR UPDATE ON enrollments
    FOR EACH ROW
    EXECUTE FUNCTION notify_enrollment_change();

-- Assignment change notifications  
DROP TRIGGER IF EXISTS notify_assignment_changes ON assignments;
CREATE TRIGGER notify_assignment_changes
    AFTER INSERT OR UPDATE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION notify_assignment_changes();

-- Grade publication notifications
DROP TRIGGER IF EXISTS notify_grade_published ON grades;
CREATE TRIGGER notify_grade_published
    AFTER UPDATE ON grades
    FOR EACH ROW
    EXECUTE FUNCTION notify_grade_published();

-- Auto-update grade percentage when points change
DROP TRIGGER IF EXISTS auto_update_grade_percentage ON grades;
CREATE TRIGGER auto_update_grade_percentage
    BEFORE INSERT OR UPDATE ON grades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Prevent enrollment when course is full
CREATE OR REPLACE FUNCTION public.check_enrollment_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_active = false AND NEW.is_active = true) THEN
        IF public.is_course_enrollment_full(NEW.course_id) THEN
            RAISE EXCEPTION 'Course enrollment capacity reached. Cannot enroll additional students.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_enrollment_capacity ON enrollments;
CREATE TRIGGER check_enrollment_capacity
    BEFORE INSERT OR UPDATE ON enrollments
    FOR EACH ROW
    EXECUTE FUNCTION check_enrollment_capacity();

-- ====================================================================
-- PART 7: GRADE CALCULATION TRIGGERS
-- ====================================================================

-- Auto-calculate letter grade when percentage changes
CREATE OR REPLACE FUNCTION public.auto_calculate_letter_grade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Auto-calculate letter grade if not provided
    IF NEW.letter_grade IS NULL OR NEW.letter_grade = '' THEN
        NEW.letter_grade := public.percentage_to_letter_grade(NEW.percentage);
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_calculate_letter_grade ON grades;
CREATE TRIGGER auto_calculate_letter_grade
    BEFORE INSERT OR UPDATE ON grades
    FOR EACH ROW
    EXECUTE FUNCTION auto_calculate_letter_grade();

-- Auto-apply late penalty when grading late submissions
CREATE OR REPLACE FUNCTION public.auto_apply_late_penalty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    assignment_late_penalty DECIMAL(5,2);
    submission_is_late BOOLEAN;
    adjusted_points DECIMAL(8,2);
BEGIN
    -- Get assignment late penalty and check if submission is late
    SELECT 
        a.late_penalty_percent,
        s.is_late
    INTO assignment_late_penalty, submission_is_late
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    WHERE s.id = NEW.submission_id;
    
    -- Apply late penalty if applicable
    IF submission_is_late AND assignment_late_penalty > 0 THEN
        adjusted_points := public.apply_late_penalty(
            NEW.points_earned, 
            assignment_late_penalty, 
            true
        );
        
        -- Update points if penalty was applied
        IF adjusted_points != NEW.points_earned THEN
            NEW.points_earned := adjusted_points;
            
            -- Add note about late penalty in feedback
            IF NEW.feedback IS NULL THEN
                NEW.feedback := 'Late penalty applied: -' || assignment_late_penalty || '%';
            ELSE
                NEW.feedback := NEW.feedback || E'\n\nLate penalty applied: -' || assignment_late_penalty || '%';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_apply_late_penalty ON grades;
CREATE TRIGGER auto_apply_late_penalty
    BEFORE INSERT OR UPDATE ON grades
    FOR EACH ROW
    EXECUTE FUNCTION auto_apply_late_penalty();

-- ====================================================================
-- PART 8: GRANT PERMISSIONS
-- ====================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.calculate_grade_percentage(DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.percentage_to_letter_grade(DECIMAL, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_late_penalty(DECIMAL, DECIMAL, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.letter_grade_to_gpa(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_enrollment_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_grade_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_course_progress(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_course_enrollment_full(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_enrollment_slots(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_course_join_code(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assignment_accepts_submissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_attempt_count(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_student_submit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_submission_late(UUID, TIMESTAMPTZ) TO authenticated;

COMMIT;