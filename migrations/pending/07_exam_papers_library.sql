-- =============================================
-- EXAM PAPERS LIBRARY
-- Store past exam papers for AI-assisted study
-- =============================================

-- Exam papers table
CREATE TABLE IF NOT EXISTS exam_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metadata
  title TEXT NOT NULL,
  subject TEXT NOT NULL, -- e.g., Mathematics, Life Sciences, English
  grade TEXT NOT NULL, -- e.g., Grade 4, Grade 12
  year INTEGER NOT NULL, -- e.g., 2023, 2024
  term TEXT, -- e.g., Term 1, Term 2, Final
  paper_type TEXT, -- e.g., Paper 1, Paper 2, Practical
  
  -- CAPS Alignment
  curriculum_code TEXT, -- e.g., CAPS_MATH_G10_P1
  topics TEXT[], -- Array of topics covered
  difficulty_level TEXT, -- easy, medium, hard
  
  -- Content
  questions JSONB NOT NULL, -- Structured questions with answers
  total_marks INTEGER NOT NULL,
  time_allowed INTEGER, -- in minutes
  
  -- Files
  pdf_url TEXT, -- Link to original PDF
  memo_pdf_url TEXT, -- Memorandum PDF
  
  -- Language
  language TEXT DEFAULT 'en-ZA', -- en-ZA, af-ZA, zu-ZA, xh-ZA
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Search optimization (using trigger instead of generated column for array handling)
  search_vector tsvector
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_papers_subject ON exam_papers(subject);
CREATE INDEX IF NOT EXISTS idx_exam_papers_grade ON exam_papers(grade);
CREATE INDEX IF NOT EXISTS idx_exam_papers_year ON exam_papers(year);
CREATE INDEX IF NOT EXISTS idx_exam_papers_search ON exam_papers USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_exam_papers_topics ON exam_papers USING gin(topics);

-- Enable RLS
ALTER TABLE exam_papers ENABLE ROW LEVEL SECURITY;

-- Policies: Everyone can read exam papers
CREATE POLICY "Anyone can view exam papers"
  ON exam_papers FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Only admins can manage exam papers"
  ON exam_papers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin', 'principal')
    )
  );

-- User exam attempts (track student practice)
CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_paper_id UUID NOT NULL REFERENCES exam_papers(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  
  -- Attempt data
  answers JSONB NOT NULL, -- User's answers
  score INTEGER,
  total_marks INTEGER NOT NULL,
  percentage NUMERIC(5,2),
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_taken INTEGER, -- in seconds
  
  -- AI Feedback
  ai_feedback JSONB, -- Detailed feedback from Dash AI
  strengths TEXT[],
  areas_to_improve TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_paper_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_completed ON exam_attempts(completed_at) WHERE completed_at IS NOT NULL;

-- Enable RLS
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own attempts"
  ON exam_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own attempts"
  ON exam_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own attempts"
  ON exam_attempts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Parents can view their children's attempts
CREATE POLICY "Parents can view children attempts"
  ON exam_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = exam_attempts.student_id
      AND students.parent_id = (
        SELECT id FROM profiles WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Function to calculate exam score
CREATE OR REPLACE FUNCTION calculate_exam_score(attempt_id UUID)
RETURNS JSONB AS $$
DECLARE
  exam_data JSONB;
  user_answers JSONB;
  total_score INTEGER := 0;
  total_possible INTEGER;
  result JSONB;
BEGIN
  -- Get exam paper and user answers
  SELECT 
    ep.questions,
    ea.answers,
    ep.total_marks
  INTO exam_data, user_answers, total_possible
  FROM exam_attempts ea
  JOIN exam_papers ep ON ea.exam_paper_id = ep.id
  WHERE ea.id = attempt_id;
  
  -- Update the attempt with score
  UPDATE exam_attempts
  SET 
    score = total_score,
    total_marks = total_possible,
    percentage = ROUND((total_score::NUMERIC / total_possible::NUMERIC) * 100, 2),
    updated_at = NOW()
  WHERE id = attempt_id;
  
  RETURN jsonb_build_object(
    'score', total_score,
    'total_marks', total_possible,
    'percentage', ROUND((total_score::NUMERIC / total_possible::NUMERIC) * 100, 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to update search_vector
CREATE OR REPLACE FUNCTION update_exam_papers_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.subject, '') || ' ' ||
    coalesce(NEW.grade, '') || ' ' ||
    coalesce(array_to_string(NEW.topics, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search_vector updates
DROP TRIGGER IF EXISTS exam_papers_search_vector_update ON exam_papers;
CREATE TRIGGER exam_papers_search_vector_update
  BEFORE INSERT OR UPDATE ON exam_papers
  FOR EACH ROW
  EXECUTE FUNCTION update_exam_papers_search_vector();

-- Function to search exam papers
CREATE OR REPLACE FUNCTION search_exam_papers(
  search_query TEXT,
  filter_subject TEXT DEFAULT NULL,
  filter_grade TEXT DEFAULT NULL,
  filter_year INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  subject TEXT,
  grade TEXT,
  year INTEGER,
  topics TEXT[],
  total_marks INTEGER,
  language TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ep.id,
    ep.title,
    ep.subject,
    ep.grade,
    ep.year,
    ep.topics,
    ep.total_marks,
    ep.language,
    ts_rank(ep.search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM exam_papers ep
  WHERE 
    (search_query IS NULL OR ep.search_vector @@ websearch_to_tsquery('english', search_query))
    AND (filter_subject IS NULL OR ep.subject = filter_subject)
    AND (filter_grade IS NULL OR ep.grade = filter_grade)
    AND (filter_year IS NULL OR ep.year = filter_year)
  ORDER BY rank DESC, ep.year DESC, ep.title;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE exam_papers IS 'Library of past exam papers for AI-assisted study';
COMMENT ON TABLE exam_attempts IS 'Track student practice attempts on exam papers';
COMMENT ON FUNCTION search_exam_papers IS 'Full-text search for exam papers with filters';
