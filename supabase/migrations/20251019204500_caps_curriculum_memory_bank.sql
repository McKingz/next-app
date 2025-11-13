-- =====================================================
-- CAPS Curriculum Memory Bank for Dash AI
-- =====================================================
-- Creates comprehensive knowledge base for South African curriculum
-- Includes curriculum documents, past papers, and semantic memory

-- Enable pgvector extension for semantic search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 1. CAPS Documents Storage
-- =====================================================

-- Main curriculum documents table
CREATE TABLE IF NOT EXISTS caps_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Document identification
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
    'curriculum',      -- CAPS curriculum documents
    'exam',           -- Past examination papers
    'exemplar',       -- Exemplar papers
    'guideline',      -- Assessment guidelines
    'teaching_plan',  -- Annual teaching plans
    'memorandum',     -- Marking memos
    'policy'          -- Education policies
  )),
  
  -- Classification
  grade VARCHAR(10) NOT NULL,  -- 'R', '1'-'12'
  subject VARCHAR(100) NOT NULL,
  topic VARCHAR(255),
  section VARCHAR(255),
  year INTEGER,  -- For past papers/exams
  term INTEGER CHECK (term BETWEEN 1 AND 4),
  
  -- Content
  title VARCHAR(500) NOT NULL,
  description TEXT,
  content_text TEXT NOT NULL,  -- Full extracted text
  
  -- Storage references
  file_url TEXT NOT NULL,      -- Supabase Storage public URL
  file_path TEXT NOT NULL,     -- Storage path
  file_size_bytes BIGINT,
  page_count INTEGER,
  
  -- Search and categorization
  keywords TEXT[],
  learning_outcomes TEXT[],
  assessment_standards TEXT[],
  
  -- Metadata
  source_url TEXT,  -- Original DBE URL
  language VARCHAR(10) DEFAULT 'en',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_date DATE
);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_caps_docs_type ON caps_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_caps_docs_grade ON caps_documents(grade);
CREATE INDEX IF NOT EXISTS idx_caps_docs_subject ON caps_documents(subject);
CREATE INDEX IF NOT EXISTS idx_caps_docs_year ON caps_documents(year);
CREATE INDEX IF NOT EXISTS idx_caps_docs_grade_subject ON caps_documents(grade, subject);

-- Full-text search index (PostgreSQL built-in)
CREATE INDEX IF NOT EXISTS idx_caps_docs_search ON caps_documents 
USING gin(to_tsvector('english', content_text));

-- Keyword search
CREATE INDEX IF NOT EXISTS idx_caps_docs_keywords ON caps_documents USING gin(keywords);

-- =====================================================
-- 2. CAPS Content Chunks (for detailed search)
-- =====================================================

-- Break documents into searchable chunks
CREATE TABLE IF NOT EXISTS caps_content_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES caps_documents(id) ON DELETE CASCADE,
  
  -- Chunk identification
  chunk_index INTEGER NOT NULL,
  chunk_type VARCHAR(50),  -- 'introduction', 'topic', 'assessment', 'example'
  
  -- Content
  heading VARCHAR(500),
  content TEXT NOT NULL,
  
  -- For semantic search (vector embeddings)
  embedding VECTOR(1536),  -- OpenAI ada-002 dimension
  
  -- References
  page_number INTEGER,
  
  -- Metadata
  word_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(document_id, chunk_index)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chunks_document ON caps_content_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_type ON caps_content_chunks(chunk_type);

-- Vector similarity search index (only create if using pgvector)
-- Uncomment when ready for semantic search
-- CREATE INDEX idx_chunks_embedding ON caps_content_chunks 
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =====================================================
-- 3. Exam Questions Bank
-- =====================================================

-- Extracted questions from past papers
CREATE TABLE IF NOT EXISTS caps_exam_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES caps_documents(id) ON DELETE CASCADE,
  
  -- Question identification
  question_number VARCHAR(20) NOT NULL,
  sub_question VARCHAR(10),  -- e.g., '1.1', '2.a'
  
  -- Content
  question_text TEXT NOT NULL,
  marks INTEGER NOT NULL,
  difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard', 'challenging')),
  
  -- Classification
  grade VARCHAR(10) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  topic VARCHAR(255),
  subtopic VARCHAR(255),
  year INTEGER NOT NULL,
  paper_number INTEGER,
  
  -- Question metadata
  question_type VARCHAR(50),  -- 'multiple_choice', 'short_answer', 'essay', 'calculation', 'diagram'
  cognitive_level VARCHAR(50), -- 'knowledge', 'comprehension', 'application', 'analysis', 'evaluation'
  
  -- Answer information
  answer_text TEXT,
  marking_guideline TEXT,
  common_errors JSONB,  -- Common mistakes students make
  
  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_date TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exam_q_grade_subject ON caps_exam_questions(grade, subject);
CREATE INDEX IF NOT EXISTS idx_exam_q_year ON caps_exam_questions(year);
CREATE INDEX IF NOT EXISTS idx_exam_q_topic ON caps_exam_questions(topic);
CREATE INDEX IF NOT EXISTS idx_exam_q_difficulty ON caps_exam_questions(difficulty);

-- =====================================================
-- 4. Exam Pattern Analysis
-- =====================================================

-- Track patterns in exam questions over years
CREATE TABLE IF NOT EXISTS caps_exam_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Classification
  grade VARCHAR(10) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  
  -- Pattern metrics
  frequency_score FLOAT NOT NULL,  -- How often topic appears (0-1)
  average_marks FLOAT,
  difficulty_trend VARCHAR(20),  -- 'increasing', 'stable', 'decreasing'
  
  -- Appearance history
  years_appeared INTEGER[],
  last_appeared_year INTEGER,
  years_analyzed INTEGER NOT NULL,
  
  -- Predictions
  likelihood_next_year FLOAT,  -- Predicted probability (0-1)
  recommended_study_priority VARCHAR(20),  -- 'high', 'medium', 'low'
  
  -- Analysis metadata
  analysis_date TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  
  UNIQUE(grade, subject, topic)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patterns_grade_subject ON caps_exam_patterns(grade, subject);
CREATE INDEX IF NOT EXISTS idx_patterns_priority ON caps_exam_patterns(recommended_study_priority);

-- =====================================================
-- 5. Dash Memory Bank (Context & Insights)
-- =====================================================

-- Store Dash's learnings and insights about curriculum
CREATE TABLE IF NOT EXISTS dash_curriculum_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Memory type
  memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN (
    'curriculum_insight',     -- Insights about curriculum
    'teaching_tip',          -- Teaching strategies
    'common_misconception',  -- Common student errors
    'assessment_note',       -- Assessment guidance
    'connection',            -- Links between topics
    'resource_link'          -- Additional resources
  )),
  
  -- Context
  grade VARCHAR(10),
  subject VARCHAR(100),
  topic VARCHAR(255),
  
  -- Content
  title VARCHAR(500),
  content TEXT NOT NULL,
  
  -- Relevance
  usefulness_score FLOAT DEFAULT 0.5,  -- How useful (0-1)
  times_referenced INTEGER DEFAULT 0,
  last_referenced TIMESTAMP,
  
  -- Source
  source VARCHAR(100),  -- 'caps_analysis', 'teacher_feedback', 'dash_learning'
  verified BOOLEAN DEFAULT false,
  
  -- Relationships
  related_document_ids UUID[],
  related_questions UUID[],
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memory_type ON dash_curriculum_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_grade_subject ON dash_curriculum_memory(grade, subject);
CREATE INDEX IF NOT EXISTS idx_memory_topic ON dash_curriculum_memory(topic);
CREATE INDEX IF NOT EXISTS idx_memory_usefulness ON dash_curriculum_memory(usefulness_score DESC);

-- =====================================================
-- 6. Views for Easy Access
-- =====================================================

-- View: Latest curriculum documents
CREATE OR REPLACE VIEW caps_curriculum_latest AS
SELECT 
  d.id,
  d.grade,
  d.subject,
  d.title,
  d.file_url,
  d.published_date,
  LEFT(d.content_text, 500) as preview
FROM caps_documents d
WHERE d.document_type = 'curriculum'
ORDER BY d.grade, d.subject;

-- View: Recent past papers by subject
CREATE OR REPLACE VIEW caps_recent_exams AS
SELECT 
  d.id,
  d.grade,
  d.subject,
  d.year,
  d.title,
  d.file_url,
  COUNT(q.id) as question_count
FROM caps_documents d
LEFT JOIN caps_exam_questions q ON d.id = q.document_id
WHERE d.document_type = 'exam'
  AND d.year >= EXTRACT(YEAR FROM NOW()) - 5
GROUP BY d.id, d.grade, d.subject, d.year, d.title, d.file_url
ORDER BY d.year DESC, d.grade, d.subject;

-- View: High-priority exam topics
CREATE OR REPLACE VIEW caps_priority_topics AS
SELECT 
  grade,
  subject,
  topic,
  frequency_score,
  likelihood_next_year,
  recommended_study_priority,
  years_appeared
FROM caps_exam_patterns
WHERE recommended_study_priority IN ('high', 'medium')
  AND likelihood_next_year > 0.5
ORDER BY grade, subject, likelihood_next_year DESC;

-- =====================================================
-- 7. Functions for Smart Search
-- =====================================================

-- Simple text search function
CREATE OR REPLACE FUNCTION search_caps_curriculum(
  search_query TEXT,
  search_grade VARCHAR DEFAULT NULL,
  search_subject VARCHAR DEFAULT NULL,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  grade VARCHAR,
  subject VARCHAR,
  document_type VARCHAR,
  content_preview TEXT,
  file_url TEXT,
  relevance_rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.grade,
    d.subject,
    d.document_type,
    LEFT(d.content_text, 300) as content_preview,
    d.file_url,
    ts_rank(
      to_tsvector('english', d.content_text),
      plainto_tsquery('english', search_query)
    ) as relevance_rank
  FROM caps_documents d
  WHERE 
    to_tsvector('english', d.content_text) @@ plainto_tsquery('english', search_query)
    AND (search_grade IS NULL OR d.grade = search_grade)
    AND (search_subject IS NULL OR d.subject = search_subject)
  ORDER BY relevance_rank DESC
  LIMIT result_limit;
END;
$$;

-- Get exam questions by topic
CREATE OR REPLACE FUNCTION get_exam_questions_by_topic(
  topic_name VARCHAR,
  question_grade VARCHAR,
  question_subject VARCHAR,
  difficulty_level VARCHAR DEFAULT NULL,
  years_back INTEGER DEFAULT 5,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  question_number VARCHAR,
  question_text TEXT,
  marks INTEGER,
  difficulty VARCHAR,
  year INTEGER,
  topic VARCHAR,
  marking_guideline TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  min_year INTEGER;
BEGIN
  min_year := EXTRACT(YEAR FROM NOW()) - years_back;
  
  RETURN QUERY
  SELECT
    q.id,
    q.question_number,
    q.question_text,
    q.marks,
    q.difficulty,
    q.year,
    q.topic,
    q.marking_guideline
  FROM caps_exam_questions q
  WHERE 
    q.grade = question_grade
    AND q.subject = question_subject
    AND q.topic ILIKE '%' || topic_name || '%'
    AND q.year >= min_year
    AND (difficulty_level IS NULL OR q.difficulty = difficulty_level)
  ORDER BY q.year DESC, q.question_number
  LIMIT result_limit;
END;
$$;

-- =====================================================
-- 8. Row Level Security (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE caps_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE caps_content_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE caps_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE caps_exam_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE dash_curriculum_memory ENABLE ROW LEVEL SECURITY;

-- Public read access (CAPS is public curriculum)
DROP POLICY IF EXISTS "CAPS documents are publicly readable" ON caps_documents;
CREATE POLICY "CAPS documents are publicly readable"
  ON caps_documents FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "CAPS chunks are publicly readable" ON caps_content_chunks;
CREATE POLICY "CAPS chunks are publicly readable"
  ON caps_content_chunks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "CAPS questions are publicly readable" ON caps_exam_questions;
CREATE POLICY "CAPS questions are publicly readable"
  ON caps_exam_questions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "CAPS patterns are publicly readable" ON caps_exam_patterns;
CREATE POLICY "CAPS patterns are publicly readable"
  ON caps_exam_patterns FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Dash memory is publicly readable" ON dash_curriculum_memory;
CREATE POLICY "Dash memory is publicly readable"
  ON dash_curriculum_memory FOR SELECT
  USING (true);

-- Insert/Update only for authenticated service role
-- (Your admin tools will use service role key)

-- =====================================================
-- 9. Initial Data / Metadata
-- =====================================================

-- Insert metadata about CAPS system (idempotent - skip if already exists)
INSERT INTO dash_curriculum_memory (
  memory_type,
  title,
  content,
  source,
  verified,
  usefulness_score
) 
SELECT
  'curriculum_insight',
  'CAPS Curriculum System Initialized',
  'CAPS (Curriculum and Assessment Policy Statement) is South Africa''s national curriculum framework. It provides detailed subject specifications for Grades R-12, including learning objectives, assessment standards, and teaching plans. This database contains curriculum documents, past examination papers, and extracted questions to support curriculum-aligned teaching and learning.',
  'dash_learning',
  true,
  1.0
WHERE NOT EXISTS (
  SELECT 1 FROM dash_curriculum_memory 
  WHERE title = 'CAPS Curriculum System Initialized'
);

-- Create storage bucket policy reference
COMMENT ON TABLE caps_documents IS 'Stores metadata and content for CAPS curriculum documents. Files are stored in Supabase Storage bucket: caps-curriculum';

COMMENT ON TABLE caps_exam_questions IS 'Extracted questions from past examination papers for practice and analysis';

COMMENT ON TABLE caps_exam_patterns IS 'Analysis of examination patterns to predict likely topics and guide study priorities';

COMMENT ON TABLE dash_curriculum_memory IS 'Dash AI''s learned insights and teaching notes about the curriculum';

-- =====================================================
-- Success message
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ CAPS Curriculum Memory Bank created successfully!';
  RAISE NOTICE '📚 Tables: caps_documents, caps_content_chunks, caps_exam_questions, caps_exam_patterns, dash_curriculum_memory';
  RAISE NOTICE '🔍 Functions: search_caps_curriculum(), get_exam_questions_by_topic()';
  RAISE NOTICE '📊 Views: caps_curriculum_latest, caps_recent_exams, caps_priority_topics';
  RAISE NOTICE '🎯 Ready for CAPS content ingestion!';
END $$;
