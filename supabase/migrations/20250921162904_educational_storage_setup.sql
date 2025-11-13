-- Educational Storage Setup Migration
-- Date: 2025-09-21
-- Purpose: Set up storage buckets and RLS policies for educational file attachments
-- Includes: assignment-attachments, submission-files, grade-documents buckets

BEGIN;

-- ====================================================================
-- PART 1: CREATE STORAGE BUCKETS
-- ====================================================================

-- Assignment attachments bucket (for instructor-uploaded files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assignment-attachments',
  'assignment-attachments',
  FALSE, -- Private bucket
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/rtf',
    'application/vnd.oasis.opendocument.text',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.presentation',
    'text/javascript',
    'application/javascript',
    'text/html',
    'text/css',
    'text/x-python',
    'text/x-java-source',
    'text/x-c',
    'text/x-c++src',
    'application/json',
    'application/xml',
    'text/xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Student submission files bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submission-files',
  'submission-files',
  FALSE, -- Private bucket
  104857600, -- 100MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/rtf',
    'application/vnd.oasis.opendocument.text',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.presentation',
    'text/javascript',
    'application/javascript',
    'text/html',
    'text/css',
    'text/x-python',
    'text/x-java-source',
    'text/x-c',
    'text/x-c++src',
    'application/json',
    'application/xml',
    'text/xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Grade documents bucket (for grading rubrics, feedback files, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'grade-documents',
  'grade-documents',
  FALSE, -- Private bucket
  20971520, -- 20MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'application/json'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Course resources bucket (for syllabus, course materials)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-resources',
  'course-resources',
  FALSE, -- Private bucket
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/rtf',
    'application/vnd.oasis.opendocument.text',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'application/zip',
    'application/x-rar-compressed',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- PART 2: STORAGE RLS POLICIES
-- ====================================================================

-- Enable RLS on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- ASSIGNMENT ATTACHMENTS POLICIES
-- ====================================================================

-- Policy: Instructors and admins can upload assignment attachments
CREATE POLICY assignment_attachments_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assignment-attachments'
  AND (
    -- Instructors can upload to their organization's path
    (
      get_user_role() = 'instructor'
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    -- Admins can upload to their organization's path
    (
      get_user_role() = 'admin'
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    -- Super admins can upload anywhere
    get_user_role() = 'super_admin'
  )
);

-- Policy: Users can view assignment attachments from their organization
CREATE POLICY assignment_attachments_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND (
    -- Users can view files from their organization
    name LIKE get_user_organization_id()::text || '/%'
    OR
    -- Super admins can view all
    get_user_role() = 'super_admin'
  )
);

-- Policy: Instructors and admins can update their assignment attachments
CREATE POLICY assignment_attachments_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND (
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    get_user_role() = 'super_admin'
  )
);

-- Policy: Instructors and admins can delete their assignment attachments
CREATE POLICY assignment_attachments_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'assignment-attachments'
  AND (
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    get_user_role() = 'super_admin'
  )
);

-- ====================================================================
-- SUBMISSION FILES POLICIES
-- ====================================================================

-- Policy: Students can upload their own submission files
CREATE POLICY submission_files_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'submission-files'
  AND (
    -- Students can upload to their own path (org/student_id/...)
    (
      get_user_role() = 'student'
      AND name LIKE get_user_organization_id()::text || '/' || auth.uid()::text || '/%'
    )
    OR
    -- Instructors and admins can upload for students in their organization
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    -- Super admins can upload anywhere
    get_user_role() = 'super_admin'
  )
);

-- Policy: Users can view submission files based on role and enrollment
CREATE POLICY submission_files_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'submission-files'
  AND (
    -- Students can view their own files
    (
      get_user_role() = 'student'
      AND name LIKE get_user_organization_id()::text || '/' || auth.uid()::text || '/%'
    )
    OR
    -- Instructors and admins can view files from their organization
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    -- Super admins can view all
    get_user_role() = 'super_admin'
  )
);

-- Policy: Students can update their own submission files (before submission deadline)
CREATE POLICY submission_files_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'submission-files'
  AND (
    (
      get_user_role() = 'student'
      AND name LIKE get_user_organization_id()::text || '/' || auth.uid()::text || '/%'
    )
    OR
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    get_user_role() = 'super_admin'
  )
);

-- Policy: Students can delete their own submission files (before submission deadline)
CREATE POLICY submission_files_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'submission-files'
  AND (
    (
      get_user_role() = 'student'
      AND name LIKE get_user_organization_id()::text || '/' || auth.uid()::text || '/%'
    )
    OR
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    get_user_role() = 'super_admin'
  )
);

-- ====================================================================
-- GRADE DOCUMENTS POLICIES
-- ====================================================================

-- Policy: Instructors and admins can upload grade documents
CREATE POLICY grade_documents_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'grade-documents'
  AND (
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    get_user_role() = 'super_admin'
  )
);

-- Policy: Users can view grade documents based on role
CREATE POLICY grade_documents_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'grade-documents'
  AND (
    -- Students can view their own grade documents (files named with their user ID)
    (
      get_user_role() = 'student'
      AND name LIKE get_user_organization_id()::text || '%' || auth.uid()::text || '%'
    )
    OR
    -- Instructors and admins can view all from their organization
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    get_user_role() = 'super_admin'
  )
);

-- Policy: Instructors and admins can update grade documents
CREATE POLICY grade_documents_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'grade-documents'
  AND (
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    get_user_role() = 'super_admin'
  )
);

-- Policy: Instructors and admins can delete grade documents
CREATE POLICY grade_documents_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'grade-documents'
  AND (
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    get_user_role() = 'super_admin'
  )
);

-- ====================================================================
-- COURSE RESOURCES POLICIES
-- ====================================================================

-- Policy: Instructors and admins can upload course resources
CREATE POLICY course_resources_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-resources'
  AND (
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    get_user_role() = 'super_admin'
  )
);

-- Policy: Enrolled students, instructors, and admins can view course resources
CREATE POLICY course_resources_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'course-resources'
  AND (
    -- Users from same organization can view resources
    name LIKE get_user_organization_id()::text || '/%'
    OR
    get_user_role() = 'super_admin'
  )
);

-- Policy: Instructors and admins can update course resources
CREATE POLICY course_resources_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-resources'
  AND (
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    get_user_role() = 'super_admin'
  )
);

-- Policy: Instructors and admins can delete course resources
CREATE POLICY course_resources_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'course-resources'
  AND (
    (
      get_user_role() IN ('instructor', 'admin')
      AND name LIKE get_user_organization_id()::text || '/%'
    )
    OR
    get_user_role() = 'super_admin'
  )
);

COMMIT;
