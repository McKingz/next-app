-- ============================================
-- TEXTBOOKS SCHEMA
-- ============================================
-- Purpose: Store CAPS-aligned textbooks with content for AI-powered exam generation
-- Date: 2025-11-12
-- Features: Full-text search, chapter/page tracking, PDF storage

-- ============================================
-- PART 1: Core Textbooks Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.textbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Information
  title TEXT NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('R', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12')),
  subject TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'English',
  
  -- Publishing Details
  publisher TEXT,
  isbn TEXT UNIQUE,
  publication_year INTEGER,
  edition TEXT,
  
  -- Content URLs
  pdf_url TEXT, -- Supabase Storage URL
  cover_url TEXT, -- Cover image URL
  
  -- Metadata
  total_pages INTEGER,
  file_size_mb NUMERIC(10, 2),
  description TEXT,
  
  -- CAPS Compliance
  caps_approved BOOLEAN DEFAULT true,
  caps_topics TEXT[], -- Array of CAPS topics covered
  
  -- Availability
  is_active BOOLEAN DEFAULT true,
  is_free BOOLEAN DEFAULT false, -- DBE/Siyavula books
  
  -- License/Access
  license_type TEXT DEFAULT 'standard' CHECK (license_type IN ('open_source', 'creative_commons', 'standard', 'premium')),
  requires_subscription BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_textbooks_grade_subject ON public.textbooks(grade, subject);
CREATE INDEX IF NOT EXISTS idx_textbooks_publisher ON public.textbooks(publisher);
CREATE INDEX IF NOT EXISTS idx_textbooks_active ON public.textbooks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_textbooks_free ON public.textbooks(is_free) WHERE is_free = true;
CREATE INDEX IF NOT EXISTS idx_textbooks_caps_topics ON public.textbooks USING gin(caps_topics);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_textbooks_search ON public.textbooks USING gin(
  to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || subject)
);

COMMENT ON TABLE public.textbooks IS 'CAPS-aligned textbooks for grades R-12';

-- ============================================
-- PART 2: Textbook Chapters
-- ============================================

CREATE TABLE IF NOT EXISTS public.textbook_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id UUID NOT NULL REFERENCES public.textbooks(id) ON DELETE CASCADE,
  
  -- Chapter Info
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  
  -- Page Range
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  
  -- Content
  content_text TEXT, -- Extracted text from PDF
  summary TEXT, -- AI-generated summary
  
  -- CAPS Alignment
  caps_topics TEXT[], -- Specific topics covered in this chapter
  learning_outcomes TEXT[],
  
  -- Metadata
  difficulty_level TEXT CHECK (difficulty_level IN ('foundation', 'intermediate', 'advanced')),
  estimated_reading_time_minutes INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(textbook_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_chapters_textbook ON public.textbook_chapters(textbook_id);
CREATE INDEX IF NOT EXISTS idx_chapters_pages ON public.textbook_chapters(page_start, page_end);
CREATE INDEX IF NOT EXISTS idx_chapters_topics ON public.textbook_chapters USING gin(caps_topics);

-- Full-text search on chapter content
CREATE INDEX IF NOT EXISTS idx_chapters_content_search ON public.textbook_chapters USING gin(
  to_tsvector('english', title || ' ' || COALESCE(content_text, '') || ' ' || COALESCE(summary, ''))
);

COMMENT ON TABLE public.textbook_chapters IS 'Chapters within textbooks with extracted content';

-- ============================================
-- PART 3: Textbook Pages (Detailed Content)
-- ============================================

CREATE TABLE IF NOT EXISTS public.textbook_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id UUID NOT NULL REFERENCES public.textbooks(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.textbook_chapters(id) ON DELETE SET NULL,
  
  -- Page Info
  page_number INTEGER NOT NULL,
  
  -- Content
  content_text TEXT, -- OCR/extracted text
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'diagram', 'table', 'mixed', 'exercises')),
  
  -- Visual Elements
  has_diagrams BOOLEAN DEFAULT false,
  has_tables BOOLEAN DEFAULT false,
  has_exercises BOOLEAN DEFAULT false,
  diagram_urls TEXT[], -- URLs to extracted diagram images
  
  -- Exercise Detection
  exercise_numbers INTEGER[], -- e.g., [1, 2, 3] for exercises on this page
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(textbook_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_pages_textbook ON public.textbook_pages(textbook_id);
CREATE INDEX IF NOT EXISTS idx_pages_chapter ON public.textbook_pages(chapter_id);
CREATE INDEX IF NOT EXISTS idx_pages_number ON public.textbook_pages(page_number);
CREATE INDEX IF NOT EXISTS idx_pages_exercises ON public.textbook_pages(has_exercises) WHERE has_exercises = true;

-- Full-text search on page content
CREATE INDEX IF NOT EXISTS idx_pages_content_search ON public.textbook_pages USING gin(
  to_tsvector('english', COALESCE(content_text, ''))
);

COMMENT ON TABLE public.textbook_pages IS 'Individual pages with extracted content and metadata';

-- ============================================
-- PART 4: User Bookmarks
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  textbook_id UUID NOT NULL REFERENCES public.textbooks(id) ON DELETE CASCADE,
  
  -- Bookmark Details
  page_number INTEGER,
  chapter_id UUID REFERENCES public.textbook_chapters(id) ON DELETE CASCADE,
  note TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, textbook_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.user_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_textbook ON public.user_bookmarks(textbook_id);

COMMENT ON TABLE public.user_bookmarks IS 'User bookmarks for textbooks and pages';

-- ============================================
-- PART 5: Reading Progress Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS public.reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  textbook_id UUID NOT NULL REFERENCES public.textbooks(id) ON DELETE CASCADE,
  
  -- Progress
  current_page INTEGER DEFAULT 1,
  total_pages_read INTEGER DEFAULT 0,
  progress_percentage NUMERIC(5, 2) DEFAULT 0.00,
  
  -- Reading Stats
  last_read_at TIMESTAMPTZ,
  total_reading_time_minutes INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, textbook_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON public.reading_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_textbook ON public.reading_progress(textbook_id);

COMMENT ON TABLE public.reading_progress IS 'Track user reading progress across textbooks';

-- ============================================
-- PART 6: Auto-Update Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_textbooks_updated_at
  BEFORE UPDATE ON public.textbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at
  BEFORE UPDATE ON public.textbook_chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pages_updated_at
  BEFORE UPDATE ON public.textbook_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_progress_updated_at
  BEFORE UPDATE ON public.reading_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 7: RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.textbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.textbook_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.textbook_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

-- Textbooks: Everyone can read active books
CREATE POLICY "Anyone can read active textbooks"
  ON public.textbooks FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- Chapters: Everyone can read chapters of active books
CREATE POLICY "Anyone can read chapters"
  ON public.textbook_chapters FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.textbooks
      WHERE id = textbook_chapters.textbook_id AND is_active = true
    )
  );

-- Pages: Everyone can read pages of active books
CREATE POLICY "Anyone can read pages"
  ON public.textbook_pages FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.textbooks
      WHERE id = textbook_pages.textbook_id AND is_active = true
    )
  );

-- Bookmarks: Users can manage their own bookmarks
CREATE POLICY "Users can manage own bookmarks"
  ON public.user_bookmarks FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Reading Progress: Users can manage their own progress
CREATE POLICY "Users can manage own reading progress"
  ON public.reading_progress FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role has full access to all tables
CREATE POLICY "Service role full access to textbooks"
  ON public.textbooks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to chapters"
  ON public.textbook_chapters FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to pages"
  ON public.textbook_pages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- PART 8: Helper Functions
-- ============================================

-- Function to search textbooks by query
CREATE OR REPLACE FUNCTION search_textbooks(
  search_query TEXT,
  search_grade TEXT DEFAULT NULL,
  search_subject TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  grade TEXT,
  subject TEXT,
  publisher TEXT,
  cover_url TEXT,
  total_pages INTEGER,
  is_free BOOLEAN,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.grade,
    t.subject,
    t.publisher,
    t.cover_url,
    t.total_pages,
    t.is_free,
    ts_rank(
      to_tsvector('english', t.title || ' ' || COALESCE(t.description, '') || ' ' || t.subject),
      plainto_tsquery('english', search_query)
    ) AS rank
  FROM public.textbooks t
  WHERE
    t.is_active = true
    AND (search_grade IS NULL OR t.grade = search_grade)
    AND (search_subject IS NULL OR t.subject = search_subject)
    AND (
      to_tsvector('english', t.title || ' ' || COALESCE(t.description, '') || ' ' || t.subject)
      @@ plainto_tsquery('english', search_query)
    )
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get page content for AI exam generation
CREATE OR REPLACE FUNCTION get_textbook_content(
  p_textbook_id UUID,
  p_page_start INTEGER,
  p_page_end INTEGER
)
RETURNS TABLE (
  page_number INTEGER,
  content_text TEXT,
  has_exercises BOOLEAN,
  chapter_title TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.page_number,
    p.content_text,
    p.has_exercises,
    c.title AS chapter_title
  FROM public.textbook_pages p
  LEFT JOIN public.textbook_chapters c ON p.chapter_id = c.id
  WHERE
    p.textbook_id = p_textbook_id
    AND p.page_number BETWEEN p_page_start AND p_page_end
  ORDER BY p.page_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_textbooks(TEXT, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_textbook_content(UUID, INTEGER, INTEGER) TO authenticated, anon;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Textbooks schema created successfully!';
  RAISE NOTICE '📚 Tables: textbooks, textbook_chapters, textbook_pages, user_bookmarks, reading_progress';
  RAISE NOTICE '🔍 Full-text search enabled on all content tables';
  RAISE NOTICE '🔒 RLS policies applied - users can read all active books';
  RAISE NOTICE '📖 Helper functions: search_textbooks(), get_textbook_content()';
END $$;
