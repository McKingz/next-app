-- =============================================
-- Add Document Columns to Teachers Table
-- Better design: Add documents to existing teachers table
-- instead of creating separate teacher_documents table
-- =============================================

BEGIN;

-- 1) Add document columns to teachers table
ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS cv_file_path text,
ADD COLUMN IF NOT EXISTS cv_file_name text,
ADD COLUMN IF NOT EXISTS cv_mime_type text,
ADD COLUMN IF NOT EXISTS cv_file_size integer,
ADD COLUMN IF NOT EXISTS cv_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS cv_uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

ADD COLUMN IF NOT EXISTS qualifications_file_path text,
ADD COLUMN IF NOT EXISTS qualifications_file_name text,
ADD COLUMN IF NOT EXISTS qualifications_mime_type text,
ADD COLUMN IF NOT EXISTS qualifications_file_size integer,
ADD COLUMN IF NOT EXISTS qualifications_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS qualifications_uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

ADD COLUMN IF NOT EXISTS id_copy_file_path text,
ADD COLUMN IF NOT EXISTS id_copy_file_name text,
ADD COLUMN IF NOT EXISTS id_copy_mime_type text,
ADD COLUMN IF NOT EXISTS id_copy_file_size integer,
ADD COLUMN IF NOT EXISTS id_copy_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS id_copy_uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

ADD COLUMN IF NOT EXISTS contracts_file_path text,
ADD COLUMN IF NOT EXISTS contracts_file_name text,
ADD COLUMN IF NOT EXISTS contracts_mime_type text,
ADD COLUMN IF NOT EXISTS contracts_file_size integer,
ADD COLUMN IF NOT EXISTS contracts_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS contracts_uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) Add file size constraints
ALTER TABLE public.teachers
ADD CONSTRAINT teachers_cv_file_size_check CHECK (
  cv_file_size IS NULL OR (cv_file_size > 0 AND cv_file_size <= 52428800)
),
ADD CONSTRAINT teachers_qualifications_file_size_check CHECK (
  qualifications_file_size IS NULL OR (qualifications_file_size > 0 AND qualifications_file_size <= 52428800)
),
ADD CONSTRAINT teachers_id_copy_file_size_check CHECK (
  id_copy_file_size IS NULL OR (id_copy_file_size > 0 AND id_copy_file_size <= 52428800)
),
ADD CONSTRAINT teachers_contracts_file_size_check CHECK (
  contracts_file_size IS NULL OR (contracts_file_size > 0 AND contracts_file_size <= 52428800)
);

-- 3) Add indexes for document queries
CREATE INDEX IF NOT EXISTS idx_teachers_cv_uploaded ON public.teachers(cv_uploaded_at) WHERE cv_file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teachers_qualifications_uploaded ON public.teachers(qualifications_uploaded_at) WHERE qualifications_file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teachers_id_copy_uploaded ON public.teachers(id_copy_uploaded_at) WHERE id_copy_file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teachers_contracts_uploaded ON public.teachers(contracts_uploaded_at) WHERE contracts_file_path IS NOT NULL;

-- 4) Update the teachers sync function to preserve document data
CREATE OR REPLACE FUNCTION public.sync_teacher_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preschool_id uuid;
  v_full_name text;
  existing_cv_path text;
  existing_cv_name text;
  existing_cv_mime text;
  existing_cv_size integer;
  existing_cv_at timestamptz;
  existing_cv_by uuid;
  existing_qualifications_path text;
  existing_qualifications_name text;
  existing_qualifications_mime text;
  existing_qualifications_size integer;
  existing_qualifications_at timestamptz;
  existing_qualifications_by uuid;
  existing_id_copy_path text;
  existing_id_copy_name text;
  existing_id_copy_mime text;
  existing_id_copy_size integer;
  existing_id_copy_at timestamptz;
  existing_id_copy_by uuid;
  existing_contracts_path text;
  existing_contracts_name text;
  existing_contracts_mime text;
  existing_contracts_size integer;
  existing_contracts_at timestamptz;
  existing_contracts_by uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Store existing document data before deletion
    SELECT
      cv_file_path, cv_file_name, cv_mime_type, cv_file_size, cv_uploaded_at, cv_uploaded_by,
      qualifications_file_path, qualifications_file_name, qualifications_mime_type, qualifications_file_size, qualifications_uploaded_at, qualifications_uploaded_by,
      id_copy_file_path, id_copy_file_name, id_copy_mime_type, id_copy_file_size, id_copy_uploaded_at, id_copy_uploaded_by,
      contracts_file_path, contracts_file_name, contracts_mime_type, contracts_file_size, contracts_uploaded_at, contracts_uploaded_by
    INTO
      existing_cv_path, existing_cv_name, existing_cv_mime, existing_cv_size, existing_cv_at, existing_cv_by,
      existing_qualifications_path, existing_qualifications_name, existing_qualifications_mime, existing_qualifications_size, existing_qualifications_at, existing_qualifications_by,
      existing_id_copy_path, existing_id_copy_name, existing_id_copy_mime, existing_id_copy_size, existing_id_copy_at, existing_id_copy_by,
      existing_contracts_path, existing_contracts_name, existing_contracts_mime, existing_contracts_size, existing_contracts_at, existing_contracts_by
    FROM public.teachers
    WHERE user_id = OLD.id;

    -- Delete teacher row
    DELETE FROM public.teachers WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Get preschool_id from organization_membership if available
  SELECT organization_id INTO v_preschool_id
  FROM public.organization_members
  WHERE user_id = NEW.id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Get full name from profiles or users table
  SELECT COALESCE(
    TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))),
    TRIM(NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'name',
    NEW.email
  ) INTO v_full_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = NEW.id;

  -- Store existing document data for INSERT/UPDATE
  IF TG_OP = 'UPDATE' THEN
    SELECT
      cv_file_path, cv_file_name, cv_mime_type, cv_file_size, cv_uploaded_at, cv_uploaded_by,
      qualifications_file_path, qualifications_file_name, qualifications_mime_type, qualifications_file_size, qualifications_uploaded_at, qualifications_uploaded_by,
      id_copy_file_path, id_copy_file_name, id_copy_mime_type, id_copy_file_size, id_copy_uploaded_at, id_copy_uploaded_by,
      contracts_file_path, contracts_file_name, contracts_mime_type, contracts_file_size, contracts_uploaded_at, contracts_uploaded_by
    INTO
      existing_cv_path, existing_cv_name, existing_cv_mime, existing_cv_size, existing_cv_at, existing_cv_by,
      existing_qualifications_path, existing_qualifications_name, existing_qualifications_mime, existing_qualifications_size, existing_qualifications_at, existing_qualifications_by,
      existing_id_copy_path, existing_id_copy_name, existing_id_copy_mime, existing_id_copy_size, existing_id_copy_at, existing_id_copy_by,
      existing_contracts_path, existing_contracts_name, existing_contracts_mime, existing_contracts_size, existing_contracts_at, existing_contracts_by
    FROM public.teachers
    WHERE user_id = NEW.id;
  END IF;

  -- Insert or update teacher row with preserved document data
  INSERT INTO public.teachers (
    user_id,
    auth_user_id,
    preschool_id,
    full_name,
    email,
    role,
    is_active,
    cv_file_path,
    cv_file_name,
    cv_mime_type,
    cv_file_size,
    cv_uploaded_at,
    cv_uploaded_by,
    qualifications_file_path,
    qualifications_file_name,
    qualifications_mime_type,
    qualifications_file_size,
    qualifications_uploaded_at,
    qualifications_uploaded_by,
    id_copy_file_path,
    id_copy_file_name,
    id_copy_mime_type,
    id_copy_file_size,
    id_copy_uploaded_at,
    id_copy_uploaded_by,
    contracts_file_path,
    contracts_file_name,
    contracts_mime_type,
    contracts_file_size,
    contracts_uploaded_at,
    contracts_uploaded_by
  ) VALUES (
    NEW.id,
    NEW.id,
    v_preschool_id,
    v_full_name,
    NEW.email,
    'teacher',
    COALESCE(NEW.raw_user_meta_data->>'is_active', 'true')::boolean,
    COALESCE(existing_cv_path, NULL),
    COALESCE(existing_cv_name, NULL),
    COALESCE(existing_cv_mime, NULL),
    COALESCE(existing_cv_size, NULL),
    COALESCE(existing_cv_at, NULL),
    COALESCE(existing_cv_by, NULL),
    COALESCE(existing_qualifications_path, NULL),
    COALESCE(existing_qualifications_name, NULL),
    COALESCE(existing_qualifications_mime, NULL),
    COALESCE(existing_qualifications_size, NULL),
    COALESCE(existing_qualifications_at, NULL),
    COALESCE(existing_qualifications_by, NULL),
    COALESCE(existing_id_copy_path, NULL),
    COALESCE(existing_id_copy_name, NULL),
    COALESCE(existing_id_copy_mime, NULL),
    COALESCE(existing_id_copy_size, NULL),
    COALESCE(existing_id_copy_at, NULL),
    COALESCE(existing_id_copy_by, NULL),
    COALESCE(existing_contracts_path, NULL),
    COALESCE(existing_contracts_name, NULL),
    COALESCE(existing_contracts_mime, NULL),
    COALESCE(existing_contracts_size, NULL),
    COALESCE(existing_contracts_at, NULL),
    COALESCE(existing_contracts_by, NULL)
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    preschool_id = EXCLUDED.preschool_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 5) Update RLS policies to allow document access
CREATE POLICY teachers_documents_select ON public.teachers
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users u_principal, public.users u_teacher
    WHERE u_principal.id = auth.uid()
      AND u_teacher.id = user_id
      AND u_principal.role IN ('principal', 'principal_admin', 'admin', 'superadmin')
      AND u_principal.preschool_id = u_teacher.preschool_id
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
);

-- Allow document updates for teachers and principals
CREATE POLICY teachers_documents_update ON public.teachers
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users u_principal, public.users u_teacher
    WHERE u_principal.id = auth.uid()
      AND u_teacher.id = user_id
      AND u_principal.role IN ('principal', 'principal_admin', 'admin', 'superadmin')
      AND u_principal.preschool_id = u_teacher.preschool_id
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
);

-- Storage bucket for teacher documents (keep this for file storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'teacher-documents',
  'teacher-documents',
  false,
  52428800, -- 50MB
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Success message
SELECT 'Teacher Documents Columns Added to Teachers Table Successfully' AS status;
