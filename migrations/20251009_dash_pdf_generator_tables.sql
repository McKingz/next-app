-- ====================================================================
-- Dash PDF Generator Tables and Policies
-- Date: 2025-10-09
-- Description: User preferences, custom templates, and document history
-- ====================================================================

-- ====================================================================
-- TABLE: pdf_user_preferences
-- User-specific PDF generation preferences
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.pdf_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.profiles(preschool_id) ON DELETE CASCADE,
  default_theme TEXT CHECK (default_theme IN ('professional', 'colorful', 'minimalist')),
  default_font TEXT,
  default_layout JSONB DEFAULT '{}'::jsonb,
  default_branding JSONB DEFAULT '{}'::jsonb,
  header_html_safe TEXT,
  footer_html_safe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pdf_user_preferences_user_id_key UNIQUE (user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS pdf_user_preferences_user_id_idx ON public.pdf_user_preferences(user_id);
CREATE INDEX IF NOT EXISTS pdf_user_preferences_organization_id_idx ON public.pdf_user_preferences(organization_id);

-- RLS Policies
ALTER TABLE public.pdf_user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY pdf_user_preferences_select_own ON public.pdf_user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Organization admins can view preferences within their org
CREATE POLICY pdf_user_preferences_select_org_admin ON public.pdf_user_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('principal', 'principal_admin', 'super_admin')
        AND profiles.preschool_id = pdf_user_preferences.organization_id
    )
  );

-- Users can insert their own preferences
CREATE POLICY pdf_user_preferences_insert_own ON public.pdf_user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY pdf_user_preferences_update_own ON public.pdf_user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY pdf_user_preferences_delete_own ON public.pdf_user_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- ====================================================================
-- TABLE: pdf_custom_templates
-- User and organization custom PDF templates
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.pdf_custom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.profiles(preschool_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'report', 'letter', 'invoice', 'study_guide', 'lesson_plan',
    'progress_report', 'assessment', 'certificate', 'newsletter',
    'worksheet', 'general'
  )),
  template_html TEXT NOT NULL,
  input_schema JSONB DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  is_org_shared BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pdf_custom_templates_name_length CHECK (length(name) >= 3 AND length(name) <= 100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS pdf_custom_templates_owner_user_id_idx ON public.pdf_custom_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS pdf_custom_templates_organization_id_idx ON public.pdf_custom_templates(organization_id);
CREATE INDEX IF NOT EXISTS pdf_custom_templates_document_type_idx ON public.pdf_custom_templates(document_type);
CREATE INDEX IF NOT EXISTS pdf_custom_templates_org_doc_type_idx ON public.pdf_custom_templates(organization_id, document_type);
CREATE INDEX IF NOT EXISTS pdf_custom_templates_is_public_idx ON public.pdf_custom_templates(is_public) WHERE is_public = true;

-- RLS Policies
ALTER TABLE public.pdf_custom_templates ENABLE ROW LEVEL SECURITY;

-- Users can view their own templates
CREATE POLICY pdf_custom_templates_select_own ON public.pdf_custom_templates
  FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Users can view org-shared templates within their organization
CREATE POLICY pdf_custom_templates_select_org_shared ON public.pdf_custom_templates
  FOR SELECT
  USING (
    is_org_shared = true
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.preschool_id = pdf_custom_templates.organization_id
    )
  );

-- Users can view public templates
CREATE POLICY pdf_custom_templates_select_public ON public.pdf_custom_templates
  FOR SELECT
  USING (is_public = true);

-- Users can insert templates (own org)
CREATE POLICY pdf_custom_templates_insert ON public.pdf_custom_templates
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_user_id
    AND (
      organization_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.preschool_id = organization_id
      )
    )
  );

-- Users can update their own templates
CREATE POLICY pdf_custom_templates_update_own ON public.pdf_custom_templates
  FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Users can delete their own templates
CREATE POLICY pdf_custom_templates_delete_own ON public.pdf_custom_templates
  FOR DELETE
  USING (auth.uid() = owner_user_id);

-- ====================================================================
-- TABLE: pdf_documents (Optional - for history)
-- Track generated PDF documents
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.pdf_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.profiles(preschool_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'report', 'letter', 'invoice', 'study_guide', 'lesson_plan',
    'progress_report', 'assessment', 'certificate', 'newsletter',
    'worksheet', 'general'
  )),
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size_bytes BIGINT,
  page_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pdf_documents_title_length CHECK (length(title) >= 1 AND length(title) <= 200)
);

-- Indexes
CREATE INDEX IF NOT EXISTS pdf_documents_user_id_idx ON public.pdf_documents(user_id);
CREATE INDEX IF NOT EXISTS pdf_documents_organization_id_idx ON public.pdf_documents(organization_id);
CREATE INDEX IF NOT EXISTS pdf_documents_document_type_idx ON public.pdf_documents(document_type);
CREATE INDEX IF NOT EXISTS pdf_documents_created_at_idx ON public.pdf_documents(created_at DESC);

-- RLS Policies
ALTER TABLE public.pdf_documents ENABLE ROW LEVEL SECURITY;

-- Users can view their own documents
CREATE POLICY pdf_documents_select_own ON public.pdf_documents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Organization admins can view documents within their org
CREATE POLICY pdf_documents_select_org_admin ON public.pdf_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('principal', 'principal_admin', 'super_admin')
        AND profiles.preschool_id = pdf_documents.organization_id
    )
  );

-- Users can insert documents
CREATE POLICY pdf_documents_insert ON public.pdf_documents
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      organization_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.preschool_id = organization_id
      )
    )
  );

-- Users can update their own documents (metadata only)
CREATE POLICY pdf_documents_update_own ON public.pdf_documents
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY pdf_documents_delete_own ON public.pdf_documents
  FOR DELETE
  USING (auth.uid() = user_id);

-- ====================================================================
-- STORAGE BUCKET: generated-pdfs
-- Bucket for storing generated PDF files
-- ====================================================================

-- Create bucket if it doesn't exist (run this via Supabase dashboard or CLI)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-pdfs',
  'generated-pdfs',
  false, -- private
  10485760, -- 10MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for generated-pdfs bucket

-- Users can view their own PDFs
CREATE POLICY generated_pdfs_select_own ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'generated-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Organization members can view org PDFs (if path starts with org_id)
CREATE POLICY generated_pdfs_select_org ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'generated-pdfs'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.preschool_id::text = (storage.foldername(name))[1]
    )
  );

-- Users can upload to their own folder
CREATE POLICY generated_pdfs_insert_own ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-pdfs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.preschool_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Users can update their own files
CREATE POLICY generated_pdfs_update_own ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'generated-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'generated-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
CREATE POLICY generated_pdfs_delete_own ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'generated-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ====================================================================
-- TRIGGERS
-- ====================================================================

-- Updated timestamp trigger function (if not already exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to pdf_user_preferences
DROP TRIGGER IF EXISTS update_pdf_user_preferences_updated_at ON public.pdf_user_preferences;
CREATE TRIGGER update_pdf_user_preferences_updated_at
  BEFORE UPDATE ON public.pdf_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Apply trigger to pdf_custom_templates
DROP TRIGGER IF EXISTS update_pdf_custom_templates_updated_at ON public.pdf_custom_templates;
CREATE TRIGGER update_pdf_custom_templates_updated_at
  BEFORE UPDATE ON public.pdf_custom_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- GRANTS
-- ====================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_user_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_custom_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_documents TO authenticated;

-- Grant usage on sequences (if any were created)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ====================================================================
-- COMMENTS
-- ====================================================================

COMMENT ON TABLE public.pdf_user_preferences IS 'User-specific PDF generation preferences including theme, branding, and layout defaults';
COMMENT ON TABLE public.pdf_custom_templates IS 'Custom PDF templates created by users and shared within organizations';
COMMENT ON TABLE public.pdf_documents IS 'History and metadata for generated PDF documents';

COMMENT ON COLUMN public.pdf_user_preferences.default_branding IS 'JSONB containing logo_uri, primary_color, secondary_color, watermark_text, etc.';
COMMENT ON COLUMN public.pdf_custom_templates.template_html IS 'HTML template with {{variable}} placeholders for data substitution';
COMMENT ON COLUMN public.pdf_custom_templates.input_schema IS 'JSON schema defining required input fields for the template';
COMMENT ON COLUMN public.pdf_documents.metadata IS 'Additional metadata like generation options, source prompt, etc.';

-- ====================================================================
-- END OF MIGRATION
-- ====================================================================
