-- =============================================
-- EduDash Pro: Operational Phase RLS Policies
-- Version: 3.0.0 - Schema Verified
-- Generated: 2025-01-09T15:00:00Z
-- Based on: Actual database schema inspection
-- =============================================

-- Enable RLS on operational tables
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.petty_cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STUDENTS TABLE POLICIES
-- Schema: preschool_id, parent_id, guardian_id
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "students_tenant_isolation" ON public.students;
DROP POLICY IF EXISTS "students_superadmin_access" ON public.students;
DROP POLICY IF EXISTS "students_principal_access" ON public.students;
DROP POLICY IF EXISTS "students_teacher_access" ON public.students;
DROP POLICY IF EXISTS "students_parent_access" ON public.students;

-- Superadmin: Full access with service role
CREATE POLICY "students_superadmin_access" ON public.students
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Principal: Access to all students in their preschool
CREATE POLICY "students_principal_access" ON public.students
  FOR ALL
  TO authenticated
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  )
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  );

-- Teacher: Access to students in their classes within preschool
CREATE POLICY "students_teacher_access" ON public.students
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
      AND u.role = 'teacher'
      AND u.preschool_id = students.preschool_id
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.teacher_id = u.id
        AND c.id = students.class_id
      )
    )
  );

-- Parent: Access only to their own children
CREATE POLICY "students_parent_access" ON public.students
  FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid() OR guardian_id = auth.uid()
  );

-- =============================================
-- PUSH NOTIFICATIONS TABLE POLICIES
-- Schema: recipient_user_id, preschool_id
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "push_notifications_superadmin_access" ON public.push_notifications;
DROP POLICY IF EXISTS "push_notifications_recipient_access" ON public.push_notifications;
DROP POLICY IF EXISTS "push_notifications_tenant_isolation" ON public.push_notifications;

-- Superadmin: Full access
CREATE POLICY "push_notifications_superadmin_access" ON public.push_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- User: Access only to their own notifications
CREATE POLICY "push_notifications_recipient_access" ON public.push_notifications
  FOR SELECT
  TO authenticated
  USING (recipient_user_id = auth.uid());

-- Tenant isolation for INSERT/UPDATE
CREATE POLICY "push_notifications_tenant_isolation" ON public.push_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid()
    )
  );

-- =============================================
-- HOMEWORK ASSIGNMENTS TABLE POLICIES
-- Schema: preschool_id, teacher_id, class_id
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "homework_assignments_superadmin_access" ON public.homework_assignments;
DROP POLICY IF EXISTS "homework_assignments_tenant_isolation" ON public.homework_assignments;
DROP POLICY IF EXISTS "homework_assignments_teacher_full_access" ON public.homework_assignments;
DROP POLICY IF EXISTS "homework_assignments_parent_read_access" ON public.homework_assignments;

-- Superadmin: Full access
CREATE POLICY "homework_assignments_superadmin_access" ON public.homework_assignments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Principal: Full access within preschool
CREATE POLICY "homework_assignments_tenant_isolation" ON public.homework_assignments
  FOR ALL
  TO authenticated
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  )
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  );

-- Teacher: Full access to assignments they created
CREATE POLICY "homework_assignments_teacher_full_access" ON public.homework_assignments
  FOR ALL
  TO authenticated
  USING (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'teacher'
      AND u.preschool_id = homework_assignments.preschool_id
    )
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'teacher'
      AND u.preschool_id = homework_assignments.preschool_id
    )
  );

-- Parent: Read access to assignments for their children's classes
CREATE POLICY "homework_assignments_parent_read_access" ON public.homework_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
      AND s.class_id = homework_assignments.class_id
      AND s.preschool_id = homework_assignments.preschool_id
    )
  );

-- =============================================
-- LESSONS TABLE POLICIES
-- Schema: preschool_id, teacher_id
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "lessons_superadmin_access" ON public.lessons;
DROP POLICY IF EXISTS "lessons_tenant_access" ON public.lessons;
DROP POLICY IF EXISTS "lessons_teacher_access" ON public.lessons;
DROP POLICY IF EXISTS "lessons_public_read" ON public.lessons;

-- Superadmin: Full access
CREATE POLICY "lessons_superadmin_access" ON public.lessons
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Principal: Full access within preschool
CREATE POLICY "lessons_tenant_access" ON public.lessons
  FOR ALL
  TO authenticated
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  )
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  );

-- Teacher: Full access to lessons they created within their preschool
CREATE POLICY "lessons_teacher_access" ON public.lessons
  FOR ALL
  TO authenticated
  USING (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'teacher'
      AND u.preschool_id = lessons.preschool_id
    )
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'teacher'
      AND u.preschool_id = lessons.preschool_id
    )
  );

-- Public lessons: Read access for authenticated users
CREATE POLICY "lessons_public_read" ON public.lessons
  FOR SELECT
  TO authenticated
  USING (is_public = true);

-- =============================================
-- AI USAGE LOGS TABLE POLICIES
-- Schema: organization_id, user_id, preschool_id
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "ai_usage_logs_superadmin_access" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_user_access" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_org_admin_access" ON public.ai_usage_logs;

-- Superadmin: Full access
CREATE POLICY "ai_usage_logs_superadmin_access" ON public.ai_usage_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- User: Access only to their own usage logs
CREATE POLICY "ai_usage_logs_user_access" ON public.ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Organization admin: Access to logs within their organization
CREATE POLICY "ai_usage_logs_org_admin_access" ON public.ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
    OR preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  );

-- =============================================
-- ATTENDANCE RECORDS TABLE POLICIES
-- Schema: preschool_id, student_id, class_id
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "attendance_records_superadmin_access" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_tenant_access" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_teacher_access" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_parent_access" ON public.attendance_records;

-- Superadmin: Full access
CREATE POLICY "attendance_records_superadmin_access" ON public.attendance_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Principal: Full access within preschool
CREATE POLICY "attendance_records_tenant_access" ON public.attendance_records
  FOR ALL
  TO authenticated
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  )
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  );

-- Teacher: Access to attendance for their classes
CREATE POLICY "attendance_records_teacher_access" ON public.attendance_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
      AND u.role = 'teacher'
      AND u.preschool_id = attendance_records.preschool_id
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.teacher_id = u.id
        AND c.id = attendance_records.class_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() 
      AND u.role = 'teacher'
      AND u.preschool_id = attendance_records.preschool_id
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.teacher_id = u.id
        AND c.id = attendance_records.class_id
      )
    )
  );

-- Parent: Read access to their children's attendance
CREATE POLICY "attendance_records_parent_access" ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = attendance_records.student_id
      AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
      AND s.preschool_id = attendance_records.preschool_id
    )
  );

-- =============================================
-- FINANCIAL TRANSACTIONS TABLE POLICIES
-- Schema: preschool_id, created_by, approved_by
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "financial_transactions_superadmin_access" ON public.financial_transactions;
DROP POLICY IF EXISTS "financial_transactions_tenant_access" ON public.financial_transactions;
DROP POLICY IF EXISTS "financial_transactions_creator_access" ON public.financial_transactions;

-- Superadmin: Full access
CREATE POLICY "financial_transactions_superadmin_access" ON public.financial_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Principal: Full access within preschool
CREATE POLICY "financial_transactions_tenant_access" ON public.financial_transactions
  FOR ALL
  TO authenticated
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  )
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  );

-- Staff: Access to transactions they created
CREATE POLICY "financial_transactions_creator_access" ON public.financial_transactions
  FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.preschool_id = financial_transactions.preschool_id
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.preschool_id = financial_transactions.preschool_id
    )
  );

-- =============================================
-- PETTY CASH TRANSACTIONS TABLE POLICIES
-- Schema: school_id, created_by, approved_by
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "petty_cash_transactions_superadmin_access" ON public.petty_cash_transactions;
DROP POLICY IF EXISTS "petty_cash_transactions_tenant_access" ON public.petty_cash_transactions;
DROP POLICY IF EXISTS "petty_cash_transactions_staff_access" ON public.petty_cash_transactions;

-- Superadmin: Full access
CREATE POLICY "petty_cash_transactions_superadmin_access" ON public.petty_cash_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Principal: Full access within school
CREATE POLICY "petty_cash_transactions_tenant_access" ON public.petty_cash_transactions
  FOR ALL
  TO authenticated
  USING (
    school_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  );

-- Staff: Access based on creator/approver role
CREATE POLICY "petty_cash_transactions_staff_access" ON public.petty_cash_transactions
  FOR ALL
  TO authenticated
  USING (
    (created_by = auth.uid() OR approved_by = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.preschool_id = petty_cash_transactions.school_id
      AND u.role IN ('teacher', 'preschool_admin')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.preschool_id = petty_cash_transactions.school_id
      AND u.role IN ('teacher', 'preschool_admin')
    )
  );

-- =============================================
-- INVOICES TABLE POLICIES
-- Schema: preschool_id, created_by, student_id
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "invoices_superadmin_access" ON public.invoices;
DROP POLICY IF EXISTS "invoices_tenant_access" ON public.invoices;
DROP POLICY IF EXISTS "invoices_creator_access" ON public.invoices;
DROP POLICY IF EXISTS "invoices_parent_access" ON public.invoices;

-- Superadmin: Full access
CREATE POLICY "invoices_superadmin_access" ON public.invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Principal: Full access within preschool
CREATE POLICY "invoices_tenant_access" ON public.invoices
  FOR ALL
  TO authenticated
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  )
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'preschool_admin')
    )
  );

-- Staff: Access to invoices they created
CREATE POLICY "invoices_creator_access" ON public.invoices
  FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.preschool_id = invoices.preschool_id
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.preschool_id = invoices.preschool_id
    )
  );

-- Parent: Read access to invoices for their children
CREATE POLICY "invoices_parent_access" ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = invoices.student_id
      AND (s.parent_id = auth.uid() OR s.guardian_id = auth.uid())
      AND s.preschool_id = invoices.preschool_id
    )
  );

-- =============================================
-- PERFORMANCE INDEXES
-- Note: Regular indexes (not CONCURRENT) for migration compatibility
-- =============================================

-- Tenant isolation indexes
CREATE INDEX IF NOT EXISTS idx_students_preschool_tenant 
ON public.students (preschool_id);

CREATE INDEX IF NOT EXISTS idx_push_notifications_preschool_tenant 
ON public.push_notifications (preschool_id);

CREATE INDEX IF NOT EXISTS idx_homework_assignments_preschool_tenant 
ON public.homework_assignments (preschool_id);

CREATE INDEX IF NOT EXISTS idx_lessons_preschool_tenant 
ON public.lessons (preschool_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_preschool_tenant 
ON public.ai_usage_logs (preschool_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_preschool_tenant 
ON public.attendance_records (preschool_id);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_preschool_tenant 
ON public.financial_transactions (preschool_id);

CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_school_tenant 
ON public.petty_cash_transactions (school_id);

CREATE INDEX IF NOT EXISTS idx_invoices_preschool_tenant 
ON public.invoices (preschool_id);

-- User-specific indexes
CREATE INDEX IF NOT EXISTS idx_students_parent_access 
ON public.students (parent_id) WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_guardian_access 
ON public.students (guardian_id) WHERE guardian_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_notifications_recipient 
ON public.push_notifications (recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_homework_assignments_teacher 
ON public.homework_assignments (teacher_id, preschool_id);

CREATE INDEX IF NOT EXISTS idx_lessons_teacher 
ON public.lessons (teacher_id, preschool_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user 
ON public.ai_usage_logs (user_id);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_students_preschool_class 
ON public.students (preschool_id, class_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_preschool_student 
ON public.attendance_records (preschool_id, student_id);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_preschool_created 
ON public.financial_transactions (preschool_id, created_by);

CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_school_created 
ON public.petty_cash_transactions (school_id, created_by);

CREATE INDEX IF NOT EXISTS idx_invoices_preschool_student 
ON public.invoices (preschool_id, student_id);

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

-- Add migration record
INSERT INTO public.config_kv (key, value, description, is_public) 
VALUES (
  'rls_operational_phase_deployed',
  to_jsonb(now()),
  'Operational phase RLS policies deployment timestamp - Schema Verified v3.0.0',
  false
) ON CONFLICT (key) DO UPDATE SET 
  value = to_jsonb(now()),
  updated_at = now();

-- Migration summary comment
COMMENT ON TABLE public.students IS 'RLS enabled - Operational phase v3.0.0 - Schema verified';
COMMENT ON TABLE public.push_notifications IS 'RLS enabled - Operational phase v3.0.0 - Schema verified';
COMMENT ON TABLE public.homework_assignments IS 'RLS enabled - Operational phase v3.0.0 - Schema verified';
COMMENT ON TABLE public.lessons IS 'RLS enabled - Operational phase v3.0.0 - Schema verified';
COMMENT ON TABLE public.ai_usage_logs IS 'RLS enabled - Operational phase v3.0.0 - Schema verified';
COMMENT ON TABLE public.attendance_records IS 'RLS enabled - Operational phase v3.0.0 - Schema verified';
COMMENT ON TABLE public.financial_transactions IS 'RLS enabled - Operational phase v3.0.0 - Schema verified';
COMMENT ON TABLE public.petty_cash_transactions IS 'RLS enabled - Operational phase v3.0.0 - Schema verified';
COMMENT ON TABLE public.invoices IS 'RLS enabled - Operational phase v3.0.0 - Schema verified';