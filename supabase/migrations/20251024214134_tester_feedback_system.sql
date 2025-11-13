-- ============================================
-- Tester Feedback System Migration
-- ============================================
-- Purpose: Enable internal testers to submit bug reports, feature requests,
-- and improvements with screenshots during AAB internal testing phase
--
-- Features:
-- - Multi-tenant RLS security (preschool_id isolation)
-- - Superadmin full access across all tenants
-- - Screenshot upload to private storage bucket
-- - Device metadata collection for debugging
-- - Status workflow (new -> reviewing -> resolved)
--
-- Documentation Sources:
-- - Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
-- - Supabase Storage: https://supabase.com/docs/guides/storage
-- - PostgreSQL Enums: https://www.postgresql.org/docs/current/datatype-enum.html
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

-- Severity classification for feedback
CREATE TYPE public.feedback_severity AS ENUM (
  'bug',         -- Defects, errors, crashes
  'feature',     -- Feature requests, enhancements
  'improvement'  -- UX/UI improvements, optimizations
);

-- Status workflow for feedback triage
CREATE TYPE public.feedback_status AS ENUM (
  'new',         -- Just submitted, not yet reviewed
  'reviewing',   -- Under investigation by dev team
  'resolved'     -- Addressed, closed
);

-- ============================================
-- TABLE: tester_feedback
-- ============================================

CREATE TABLE public.tester_feedback (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Multi-tenant isolation
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  
  -- User who submitted the feedback
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Feedback content
  feedback_text text NOT NULL CHECK (length(trim(feedback_text)) > 0),
  
  -- Optional screenshot stored in private bucket
  -- Path format: ${preschool_id}/${user_id}/${feedback_id}.jpg
  screenshot_path text,
  
  -- Device metadata for debugging (JSON)
  -- Example: {"brand":"Samsung","model":"Galaxy S21","osVersion":"13","appVersion":"1.0.2"}
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- App version at time of submission
  app_version text,
  
  -- Platform: android, ios, web
  platform text CHECK (platform IN ('android', 'ios', 'web')),
  
  -- Classification
  severity public.feedback_severity NOT NULL DEFAULT 'bug',
  
  -- Triage status
  status public.feedback_status NOT NULL DEFAULT 'new',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Index for preschool + time-based queries (most common)
CREATE INDEX idx_tester_feedback_preschool_created_at
ON public.tester_feedback (preschool_id, created_at DESC);

-- Index for status filtering (superadmin dashboard)
CREATE INDEX idx_tester_feedback_status
ON public.tester_feedback (status);

-- Index for user-specific queries
CREATE INDEX idx_tester_feedback_user
ON public.tester_feedback (user_id);

-- Composite index for severity + status filtering
CREATE INDEX idx_tester_feedback_severity_status
ON public.tester_feedback (severity, status);

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================

-- Reusable function for updated_at trigger (idempotent)
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply trigger to tester_feedback table
CREATE TRIGGER set_tester_feedback_updated_at
  BEFORE UPDATE ON public.tester_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on table
ALTER TABLE public.tester_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Superadmin has full access to all feedback across all tenants
CREATE POLICY superadmin_all_access
ON public.tester_feedback
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'superadmin'
  )
);

-- Policy: Users can SELECT feedback from their own preschool
CREATE POLICY tenant_users_select_own_preschool
ON public.tester_feedback
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.preschool_id = tester_feedback.preschool_id
  )
);

-- Policy: Users can INSERT feedback into their own preschool
CREATE POLICY owner_insert_own_preschool
ON public.tester_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.preschool_id = tester_feedback.preschool_id
  )
);

-- Policy: Users can UPDATE their own feedback ONLY while status is 'new'
-- (This allows attaching screenshot after initial submission)
CREATE POLICY owner_update_while_new
ON public.tester_feedback
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND status = 'new'
)
WITH CHECK (
  user_id = auth.uid()
);

-- ============================================
-- STORAGE BUCKET: feedback-screenshots
-- ============================================

-- Create private storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES: feedback-screenshots
-- ============================================

-- Policy: Users can upload screenshots to their own path
-- Path format: ${preschool_id}/${user_id}/${filename}
CREATE POLICY users_upload_own_screenshots
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'feedback-screenshots'
  AND (storage.foldername(name))[1] = (
    SELECT p.preschool_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can read their own screenshots
CREATE POLICY users_read_own_screenshots
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback-screenshots'
  AND (storage.foldername(name))[1] = (
    SELECT p.preschool_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Superadmin can read ALL screenshots in the bucket
CREATE POLICY superadmin_read_all_screenshots
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback-screenshots'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'superadmin'
  )
);

-- Policy: Users can delete their own screenshots (for re-upload)
CREATE POLICY users_delete_own_screenshots
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback-screenshots'
  AND (storage.foldername(name))[1] = (
    SELECT p.preschool_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- ============================================
-- COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE public.tester_feedback IS 'Internal tester feedback system for bug reports, feature requests, and improvements during AAB testing phase';
COMMENT ON COLUMN public.tester_feedback.feedback_text IS 'User-submitted feedback content (required, non-empty after trim)';
COMMENT ON COLUMN public.tester_feedback.screenshot_path IS 'Storage path to screenshot in feedback-screenshots bucket: ${preschool_id}/${user_id}/${id}.jpg';
COMMENT ON COLUMN public.tester_feedback.device_info IS 'Device metadata JSON for debugging: brand, model, osVersion, appVersion, etc.';
COMMENT ON COLUMN public.tester_feedback.severity IS 'Classification: bug (defect), feature (request), improvement (UX/UI)';
COMMENT ON COLUMN public.tester_feedback.status IS 'Triage workflow: new -> reviewing -> resolved';

-- ============================================
-- VERIFICATION QUERIES (Development Only)
-- ============================================
-- Uncomment to verify setup after migration:

-- Check enums created
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.feedback_severity'::regtype;
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.feedback_status'::regtype;

-- Check table structure
-- \d public.tester_feedback

-- Check RLS enabled
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'tester_feedback';

-- Check storage bucket created
-- SELECT * FROM storage.buckets WHERE id = 'feedback-screenshots';

-- Check policies
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'tester_feedback';

-- ============================================
-- ROLLBACK INSTRUCTIONS
-- ============================================
-- To rollback this migration (ONLY if absolutely necessary):
--
-- DROP POLICY IF EXISTS superadmin_read_all_screenshots ON storage.objects;
-- DROP POLICY IF EXISTS users_delete_own_screenshots ON storage.objects;
-- DROP POLICY IF EXISTS users_read_own_screenshots ON storage.objects;
-- DROP POLICY IF EXISTS users_upload_own_screenshots ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'feedback-screenshots';
-- DROP TRIGGER IF EXISTS set_tester_feedback_updated_at ON public.tester_feedback;
-- DROP POLICY IF EXISTS owner_update_while_new ON public.tester_feedback;
-- DROP POLICY IF EXISTS owner_insert_own_preschool ON public.tester_feedback;
-- DROP POLICY IF EXISTS tenant_users_select_own_preschool ON public.tester_feedback;
-- DROP POLICY IF EXISTS superadmin_all_access ON public.tester_feedback;
-- DROP INDEX IF EXISTS public.idx_tester_feedback_severity_status;
-- DROP INDEX IF EXISTS public.idx_tester_feedback_user;
-- DROP INDEX IF EXISTS public.idx_tester_feedback_status;
-- DROP INDEX IF EXISTS public.idx_tester_feedback_preschool_created_at;
-- DROP TABLE IF EXISTS public.tester_feedback CASCADE;
-- DROP TYPE IF EXISTS public.feedback_status CASCADE;
-- DROP TYPE IF EXISTS public.feedback_severity CASCADE;
-- DROP FUNCTION IF EXISTS public.set_current_timestamp_updated_at CASCADE;
