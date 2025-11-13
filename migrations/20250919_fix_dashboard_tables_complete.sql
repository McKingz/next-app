-- Fix Dashboard Tables Complete Migration
-- Date: 2025-09-19
-- Purpose: Fix all missing tables and columns causing 406 errors in dashboards
-- WARP.md Compliance: Add missing tables and fix schema issues

BEGIN;

-- ============================================================================
-- PART 1: FIX PRESCHOOLS TABLE SCHEMA
-- ============================================================================

-- Add missing columns to preschools table
DO $fix_preschools$
BEGIN
  -- Add max_students column (aliased as capacity)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'preschools' AND column_name = 'max_students' AND table_schema = 'public'
  ) THEN
    -- Use existing max_students or create it
    ALTER TABLE public.preschools ADD COLUMN max_students integer DEFAULT 50;
    RAISE NOTICE 'Added max_students column to preschools table';
  END IF;

  -- Add settings JSONB column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'preschools' AND column_name = 'settings' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.preschools ADD COLUMN settings jsonb DEFAULT '{}';
    RAISE NOTICE 'Added settings column to preschools table';
  END IF;

  -- Ensure phone column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'preschools' AND column_name = 'phone' AND table_schema = 'public'
  ) THEN
    -- Use existing phone or create it
    ALTER TABLE public.preschools ADD COLUMN phone text;
    RAISE NOTICE 'Added phone column to preschools table';
  END IF;

  -- Add other missing columns that might be needed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'preschools' AND column_name = 'capacity' AND table_schema = 'public'
  ) THEN
    -- Add capacity as an alias/computed column
    ALTER TABLE public.preschools ADD COLUMN capacity integer;
    -- Set capacity equal to max_students
    UPDATE public.preschools SET capacity = max_students WHERE max_students IS NOT NULL;
    RAISE NOTICE 'Added capacity column to preschools table';
  END IF;

END
$fix_preschools$;

-- ============================================================================
-- PART 2: CREATE WHATSAPP_CONTACTS TABLE IF MISSING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  phone_number text NOT NULL,
  whatsapp_id text,
  contact_type text DEFAULT 'parent' CHECK (contact_type IN ('parent', 'teacher', 'admin', 'other')),
  is_active boolean DEFAULT TRUE,
  notes text,
  tags text [],
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure unique phone per preschool
  UNIQUE (preschool_id, phone_number)
);

-- Add indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_contacts_preschool_id
ON public.whatsapp_contacts (preschool_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_contacts_user_id
ON public.whatsapp_contacts (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_contacts_phone
ON public.whatsapp_contacts (phone_number);

-- ============================================================================
-- PART 3: CREATE OTHER MISSING TABLES FOR DASHBOARD
-- ============================================================================

-- Create students table if missing (needed for dashboard counts)
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  student_number text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  grade_level text,
  class_id uuid REFERENCES classes (id) ON DELETE SET NULL,
  parent_ids uuid [],
  emergency_contacts jsonb DEFAULT '[]',
  medical_info jsonb DEFAULT '{}',
  enrollment_date date DEFAULT current_date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'withdrawn')),
  is_active boolean DEFAULT TRUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create teachers table if missing (for dashboard counts)
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,
  employee_number text,
  department text,
  subjects text [],
  qualifications jsonb DEFAULT '{}',
  hire_date date DEFAULT current_date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  is_active boolean DEFAULT TRUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (user_id, preschool_id)
);

-- Create attendance_records table if missing
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes (id) ON DELETE SET NULL,
  attendance_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  check_in_time timestamptz,
  check_out_time timestamptz,
  notes text,
  recorded_by uuid REFERENCES users (id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (student_id, attendance_date)
);

-- Create applications table if missing (for admissions)
CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,
  parent_id uuid REFERENCES users (id) ON DELETE SET NULL,
  child_first_name text NOT NULL,
  child_last_name text NOT NULL,
  child_date_of_birth date,
  grade_level text,
  application_date date DEFAULT current_date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'waitlisted')),
  documents jsonb DEFAULT '[]',
  notes text,
  reviewed_by uuid REFERENCES users (id),
  reviewed_at timestamptz,
  is_active boolean DEFAULT TRUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PART 4: ADD INDEXES FOR PERFORMANCE
-- ============================================================================

-- Students indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_preschool_id
ON public.students (preschool_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_class_id
ON public.students (class_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_active
ON public.students (preschool_id, is_active) WHERE is_active = TRUE;

-- Teachers indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teachers_preschool_id
ON public.teachers (preschool_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teachers_user_id
ON public.teachers (user_id);

-- Attendance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_preschool_date
ON public.attendance_records (preschool_id, attendance_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_student_date
ON public.attendance_records (student_id, attendance_date DESC);

-- Applications indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_preschool_id
ON public.applications (preschool_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_status
ON public.applications (preschool_id, status);

-- ============================================================================
-- PART 5: ENABLE RLS AND CREATE POLICIES FOR ALL TABLES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschools ENABLE ROW LEVEL SECURITY;

-- Preschools RLS policies
DROP POLICY IF EXISTS preschools_tenant_isolation ON public.preschools;
CREATE POLICY preschools_tenant_isolation
ON public.preschools FOR ALL
USING (
  id = (
    SELECT preschool_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.auth_user_id = auth.uid()
      AND u.role = 'super_admin'
  )
);

-- WhatsApp contacts RLS policies
DROP POLICY IF EXISTS whatsapp_contacts_tenant_isolation ON public.whatsapp_contacts;
CREATE POLICY whatsapp_contacts_tenant_isolation
ON public.whatsapp_contacts FOR ALL
USING (
  preschool_id = (
    SELECT preschool_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
  )
);

-- Students RLS policies
DROP POLICY IF EXISTS students_tenant_isolation ON public.students;
CREATE POLICY students_tenant_isolation
ON public.students FOR ALL
USING (
  preschool_id = (
    SELECT preschool_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
  )
);

-- Teachers RLS policies
DROP POLICY IF EXISTS teachers_tenant_isolation ON public.teachers;
CREATE POLICY teachers_tenant_isolation
ON public.teachers FOR ALL
USING (
  preschool_id = (
    SELECT preschool_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
  )
);

-- Attendance RLS policies
DROP POLICY IF EXISTS attendance_tenant_isolation ON public.attendance_records;
CREATE POLICY attendance_tenant_isolation
ON public.attendance_records FOR ALL
USING (
  preschool_id = (
    SELECT preschool_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
  )
);

-- Applications RLS policies
DROP POLICY IF EXISTS applications_tenant_isolation ON public.applications;
CREATE POLICY applications_tenant_isolation
ON public.applications FOR ALL
USING (
  preschool_id = (
    SELECT preschool_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
  )
);

-- ============================================================================
-- PART 6: CREATE DASHBOARD DATA FUNCTIONS
-- ============================================================================

-- Function to get principal dashboard data
CREATE OR REPLACE FUNCTION public.get_principal_dashboard_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  user_preschool_id uuid;
  student_count integer;
  teacher_count integer;
  class_count integer;
  application_count integer;
  attendance_count integer;
  preschool_info json;
BEGIN
  -- Get current user's preschool
  SELECT preschool_id INTO user_preschool_id
  FROM public.users 
  WHERE auth_user_id = auth.uid();

  IF user_preschool_id IS NULL THEN
    RETURN json_build_object('error', 'User not associated with any preschool');
  END IF;

  -- Get counts
  SELECT COUNT(*) INTO student_count
  FROM public.students 
  WHERE preschool_id = user_preschool_id AND is_active = true;

  SELECT COUNT(*) INTO teacher_count
  FROM public.teachers 
  WHERE preschool_id = user_preschool_id AND is_active = true;

  SELECT COUNT(*) INTO class_count
  FROM public.classes 
  WHERE preschool_id = user_preschool_id AND is_active = true;

  SELECT COUNT(*) INTO application_count
  FROM public.applications 
  WHERE preschool_id = user_preschool_id AND status = 'pending';

  SELECT COUNT(*) INTO attendance_count
  FROM public.attendance_records 
  WHERE preschool_id = user_preschool_id 
  AND attendance_date = CURRENT_DATE;

  -- Get preschool info
  SELECT json_build_object(
    'id', id,
    'name', name,
    'phone', phone,
    'max_students', max_students,
    'capacity', capacity,
    'settings', settings
  ) INTO preschool_info
  FROM public.preschools 
  WHERE id = user_preschool_id;

  -- Build result
  result := json_build_object(
    'preschool', preschool_info,
    'students_count', student_count,
    'teachers_count', teacher_count,
    'classes_count', class_count,
    'applications_count', application_count,
    'attendance_count', attendance_count,
    'generated_at', now()
  );

  RETURN result;
END;
$$;

-- ============================================================================
-- PART 7: GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions on all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT SELECT, UPDATE ON public.preschools TO authenticated;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION public.get_principal_dashboard_data() TO authenticated;

-- ============================================================================
-- PART 8: INSERT SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert a sample preschool if none exists for testing
DO $sample_data$
DECLARE
  sample_preschool_id uuid;
BEGIN
  -- Check if preschool exists
  SELECT id INTO sample_preschool_id
  FROM public.preschools 
  WHERE id = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1'::uuid;

  IF sample_preschool_id IS NULL THEN
    INSERT INTO public.preschools (
      id,
      name,
      email,
      phone,
      max_students,
      capacity,
      settings,
      is_active
    ) VALUES (
      'ba79097c-1b93-4b48-bcbe-df73878ab4d1'::uuid,
      'Sample Preschool',
      'admin@samplepreschool.com',
      '+27123456789',
      100,
      100,
      '{"timezone": "Africa/Johannesburg", "language": "en"}',
      true
    );
    RAISE NOTICE 'Created sample preschool for testing';
  ELSE
    -- Update existing preschool with missing data
    UPDATE public.preschools SET
      phone = COALESCE(phone, '+27123456789'),
      max_students = COALESCE(max_students, 100),
      capacity = COALESCE(capacity, max_students, 100),
      settings = COALESCE(settings, '{"timezone": "Africa/Johannesburg", "language": "en"}')
    WHERE id = sample_preschool_id;
    RAISE NOTICE 'Updated existing sample preschool';
  END IF;
END
$sample_data$;

-- ============================================================================
-- PART 9: LOGGING AND VERIFICATION
-- ============================================================================

-- Log completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'dashboard_tables_fixed_20250919',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::text,
    'tables_created', ARRAY[
      'whatsapp_contacts',
      'students',
      'teachers',
      'attendance_records',
      'applications'
    ],
    'columns_added', ARRAY[
      'preschools.max_students',
      'preschools.settings',
      'preschools.phone',
      'preschools.capacity'
    ],
    'functions_created', ARRAY[
      'get_principal_dashboard_data'
    ]
  ),
  'Dashboard tables and schema fix completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'DASHBOARD TABLES AND SCHEMA FIXED' AS status;

COMMIT;
