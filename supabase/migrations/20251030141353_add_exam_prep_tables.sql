-- Migration: Add Exam Prep Tables
-- Description: Tables for CAPS exam preparation features (past papers, generated exams, user progress)
-- Author: EduDash Pro Team
-- Date: 2025-10-30

-- ============================================================================
-- TABLE: past_papers
-- Purpose: Store curated past CAPS exam papers and practice tests
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.past_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade TEXT NOT NULL CHECK (grade IN (
    'grade_r', 'grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6',
    'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12'
  )),
  subject TEXT NOT NULL,
  year INT,
  term INT CHECK (term BETWEEN 1 AND 4),
  paper_number INT CHECK (paper_number BETWEEN 1 AND 3),
  exam_type TEXT DEFAULT 'past_paper' CHECK (exam_type IN ('past_paper', 'mock_exam', 'practice_test')),
  title TEXT NOT NULL,
  description TEXT,
  total_marks INT,
  duration_minutes INT,
  file_url TEXT, -- Supabase Storage URL for PDF
  preview_url TEXT, -- Optional preview/thumbnail
  memo_file_url TEXT, -- Marking memorandum URL
  is_public BOOLEAN DEFAULT true,
  download_count INT DEFAULT 0,
  average_score NUMERIC(5,2), -- Track average performance if users submit scores
  tags TEXT[], -- e.g., ['algebra', 'geometry', 'trigonometry']
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_past_papers_grade_subject ON public.past_papers(grade, subject);
CREATE INDEX IF NOT EXISTS idx_past_papers_year_term ON public.past_papers(year, term);
CREATE INDEX IF NOT EXISTS idx_past_papers_public ON public.past_papers(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_past_papers_tags ON public.past_papers USING GIN(tags);

-- RLS Policies for past_papers (public read access)
ALTER TABLE public.past_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public papers are viewable by everyone"
  ON public.past_papers
  FOR SELECT
  USING (is_public = true);

CREATE POLICY "Authenticated users can view all papers"
  ON public.past_papers
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/teachers can insert/update/delete
CREATE POLICY "Only superadmin can manage past papers"
  ON public.past_papers
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'superadmin'
    )
  );

-- ============================================================================
-- TABLE: exam_generations
-- Purpose: Track AI-generated exam resources per user
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exam_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  subject TEXT NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN (
    'practice_test', 'revision_notes', 'study_guide', 'flashcards'
  )),
  prompt TEXT, -- The AI prompt used
  generated_content TEXT, -- The generated exam/notes/guide content (can be large)
  display_title TEXT, -- User-friendly title
  
  -- Metadata
  generation_duration_ms INT, -- How long it took to generate
  token_count INT, -- Number of tokens used
  model_used TEXT DEFAULT 'claude-3.5-sonnet',
  
  -- User interaction tracking
  viewed_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  user_rating INT CHECK (user_rating BETWEEN 1 AND 5),
  user_feedback TEXT,
  
  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_exam_generations_user ON public.exam_generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_generations_grade_subject ON public.exam_generations(grade, subject);
CREATE INDEX IF NOT EXISTS idx_exam_generations_status ON public.exam_generations(status);
CREATE INDEX IF NOT EXISTS idx_exam_generations_type ON public.exam_generations(exam_type);

-- RLS Policies for exam_generations (users can only see their own)
ALTER TABLE public.exam_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exam generations"
  ON public.exam_generations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exam generations"
  ON public.exam_generations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exam generations"
  ON public.exam_generations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exam generations"
  ON public.exam_generations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Superadmin can view all generations (for monitoring)
CREATE POLICY "Superadmin can view all exam generations"
  ON public.exam_generations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'superadmin'
    )
  );

-- ============================================================================
-- TABLE: exam_user_progress
-- Purpose: Track user attempts, scores, and progress on exams
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exam_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Reference to either a past paper or generated exam
  past_paper_id UUID REFERENCES public.past_papers(id) ON DELETE SET NULL,
  exam_generation_id UUID REFERENCES public.exam_generations(id) ON DELETE SET NULL,
  
  -- Exam details (denormalized for easier querying)
  grade TEXT NOT NULL,
  subject TEXT NOT NULL,
  exam_title TEXT,
  
  -- Attempt tracking
  attempt_number INT DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  time_spent_minutes INT,
  
  -- Scoring
  score_obtained NUMERIC(6,2),
  score_total NUMERIC(6,2),
  percentage NUMERIC(5,2),
  grade_achieved TEXT, -- e.g., 'A', 'B', 'C', etc.
  
  -- Detailed results (optional JSON for section-wise scores)
  section_scores JSONB,
  
  -- User notes and reflections
  user_notes TEXT,
  areas_to_improve TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CHECK ((past_paper_id IS NOT NULL) OR (exam_generation_id IS NOT NULL)),
  CHECK (percentage >= 0 AND percentage <= 100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exam_user_progress_user ON public.exam_user_progress(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_user_progress_past_paper ON public.exam_user_progress(past_paper_id);
CREATE INDEX IF NOT EXISTS idx_exam_user_progress_generation ON public.exam_user_progress(exam_generation_id);
CREATE INDEX IF NOT EXISTS idx_exam_user_progress_grade_subject ON public.exam_user_progress(grade, subject);

-- RLS Policies
ALTER TABLE public.exam_user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own progress"
  ON public.exam_user_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
  ON public.exam_user_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.exam_user_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress"
  ON public.exam_user_progress
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_exam_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all exam tables
CREATE TRIGGER update_past_papers_updated_at
  BEFORE UPDATE ON public.past_papers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_exam_updated_at();

CREATE TRIGGER update_exam_generations_updated_at
  BEFORE UPDATE ON public.exam_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_exam_updated_at();

CREATE TRIGGER update_exam_user_progress_updated_at
  BEFORE UPDATE ON public.exam_user_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_exam_updated_at();

-- ============================================================================
-- FUNCTION: Get user's exam statistics
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_exam_stats(p_user_id UUID)
RETURNS TABLE (
  total_exams_attempted INT,
  average_percentage NUMERIC,
  highest_score NUMERIC,
  exams_by_subject JSONB,
  recent_activity JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT AS total_exams_attempted,
    AVG(percentage)::NUMERIC(5,2) AS average_percentage,
    MAX(percentage)::NUMERIC(5,2) AS highest_score,
    jsonb_object_agg(
      subject,
      jsonb_build_object(
        'count', COUNT(*),
        'avg_percentage', AVG(percentage)
      )
    ) AS exams_by_subject,
    jsonb_agg(
      jsonb_build_object(
        'exam_title', exam_title,
        'percentage', percentage,
        'completed_at', completed_at
      )
      ORDER BY completed_at DESC
      LIMIT 5
    ) AS recent_activity
  FROM public.exam_user_progress
  WHERE user_id = p_user_id AND completed_at IS NOT NULL
  GROUP BY user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_exam_stats(UUID) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.past_papers IS 'Curated past CAPS exam papers and practice tests';
COMMENT ON TABLE public.exam_generations IS 'AI-generated exam resources (practice tests, revision notes, study guides, flashcards)';
COMMENT ON TABLE public.exam_user_progress IS 'User attempts, scores, and progress tracking for exams';
COMMENT ON FUNCTION public.get_user_exam_stats(UUID) IS 'Retrieve comprehensive exam statistics for a user';

-- ============================================================================
-- SEED DATA (Optional - uncomment to add sample past papers)
-- ============================================================================
/*
INSERT INTO public.past_papers (grade, subject, year, term, paper_number, title, description, total_marks, duration_minutes, is_public)
VALUES
  ('grade_9', 'Mathematics', 2024, 4, 1, 'Grade 9 Mathematics Term 4 Exam', 'Comprehensive end-of-year assessment covering all Term 4 topics', 75, 90, true),
  ('grade_12', 'Mathematics', 2023, 4, 1, 'Matric Mathematics Paper 1', 'NSC Final Examination Paper 1 (Algebra, Functions, Calculus)', 150, 180, true),
  ('grade_10', 'Life Sciences', 2024, 3, 1, 'Grade 10 Life Sciences Term 3', 'Mid-year assessment focusing on genetics and evolution', 100, 120, true);
*/