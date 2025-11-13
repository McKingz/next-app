-- =====================================================
-- Textbook Page Mapping System for CAPS Curriculum
-- =====================================================
-- Links specific textbook pages to CAPS learning objectives
-- Enables accurate generation of practice exams from lesson plans

-- =====================================================
-- 1. CAPS Topics/Learning Objectives
-- =====================================================

CREATE TABLE IF NOT EXISTS caps_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- CAPS Classification
  grade VARCHAR(10) NOT NULL,  -- 'R', '1'-'12', '4-6', '10-12'
  subject VARCHAR(100) NOT NULL,
  topic_code VARCHAR(50),  -- e.g., 'SS-G5-T1' (Social Sciences Grade 5 Topic 1)
  
  -- Topic Details
  topic_title VARCHAR(255) NOT NULL,
  description TEXT,
  specific_aims TEXT[],
  learning_outcomes TEXT[],
  assessment_standards TEXT[],
  
  -- Content Specification
  content_outline TEXT NOT NULL,  -- What students should learn
  skills_to_develop TEXT[],
  knowledge_areas TEXT[],
  
  -- Teaching Guidance
  suggested_time_hours INTEGER,  -- Recommended teaching time
  prerequisites TEXT[],  -- Topics that should be covered first
  cognitive_level VARCHAR(50),  -- 'knowledge', 'comprehension', 'application', 'analysis'
  
  -- Metadata
  term INTEGER CHECK (term BETWEEN 1 AND 4),
  caps_document_reference VARCHAR(255),  -- Reference to official CAPS doc
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(grade, subject, topic_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_caps_topics_grade_subject ON caps_topics(grade, subject);
CREATE INDEX IF NOT EXISTS idx_caps_topics_term ON caps_topics(term);
CREATE INDEX IF NOT EXISTS idx_caps_topics_code ON caps_topics(topic_code);

-- Full-text search on topic content
CREATE INDEX IF NOT EXISTS idx_caps_topics_search ON caps_topics 
USING gin(to_tsvector('english', topic_title || ' ' || content_outline));

-- =====================================================
-- 2. Textbooks Registry
-- =====================================================

CREATE TABLE IF NOT EXISTS textbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Textbook Identification
  title VARCHAR(255) NOT NULL,
  publisher VARCHAR(100) NOT NULL,
  isbn VARCHAR(20),
  edition VARCHAR(50),
  publication_year INTEGER,
  
  -- Classification
  grade VARCHAR(10) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  
  -- Approval Status
  caps_approved BOOLEAN DEFAULT false,
  dbe_approved BOOLEAN DEFAULT false,
  approval_date DATE,
  
  -- Physical/Digital
  format VARCHAR(20) CHECK (format IN ('print', 'digital', 'hybrid')),
  page_count INTEGER,
  
  -- References
  cover_image_url TEXT,
  pdf_url TEXT,  -- If digital copy available
  publisher_website TEXT,
  
  -- Metadata
  authors TEXT[],
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Tracking
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(isbn, edition)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_textbooks_grade_subject ON textbooks(grade, subject);
CREATE INDEX IF NOT EXISTS idx_textbooks_publisher ON textbooks(publisher);
CREATE INDEX IF NOT EXISTS idx_textbooks_isbn ON textbooks(isbn);
CREATE INDEX IF NOT EXISTS idx_textbooks_active ON textbooks(is_active) WHERE is_active = true;

-- =====================================================
-- 3. Textbook Content Structure
-- =====================================================

CREATE TABLE IF NOT EXISTS textbook_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  textbook_id UUID NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
  
  -- Content Hierarchy
  chapter_number INTEGER,
  section_number INTEGER,
  subsection_number INTEGER,
  
  -- Content Details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content_type VARCHAR(50) CHECK (content_type IN (
    'chapter',
    'section',
    'subsection',
    'activity',
    'exercise',
    'example',
    'revision',
    'assessment'
  )),
  
  -- Page Range
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  
  -- Content Summary
  key_concepts TEXT[],
  activities_included BOOLEAN DEFAULT false,
  exercises_included BOOLEAN DEFAULT false,
  
  -- Navigation
  parent_id UUID REFERENCES textbook_content(id),  -- For hierarchical structure
  sequence_order INTEGER,
  
  -- Metadata
  estimated_duration_minutes INTEGER,
  difficulty_level VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CHECK (page_end >= page_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_textbook_content_book ON textbook_content(textbook_id);
CREATE INDEX IF NOT EXISTS idx_textbook_content_pages ON textbook_content(textbook_id, page_start, page_end);
CREATE INDEX IF NOT EXISTS idx_textbook_content_type ON textbook_content(content_type);
CREATE INDEX IF NOT EXISTS idx_textbook_content_parent ON textbook_content(parent_id);

-- =====================================================
-- 4. Mapping Junction Table (THE KEY TABLE)
-- =====================================================

CREATE TABLE IF NOT EXISTS caps_textbook_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- The Link
  caps_topic_id UUID NOT NULL REFERENCES caps_topics(id) ON DELETE CASCADE,
  textbook_content_id UUID NOT NULL REFERENCES textbook_content(id) ON DELETE CASCADE,
  
  -- Mapping Details
  coverage_percentage INTEGER CHECK (coverage_percentage BETWEEN 1 AND 100),  -- How much of the topic is covered
  is_primary_reference BOOLEAN DEFAULT false,  -- Is this the main textbook reference for this topic?
  
  -- Quality Indicators
  alignment_score INTEGER CHECK (alignment_score BETWEEN 1 AND 5),  -- How well aligned (1=poor, 5=excellent)
  verified_by UUID REFERENCES auth.users(id),  -- Who verified this mapping
  verification_date TIMESTAMP,
  verification_notes TEXT,
  
  -- Specific Page References
  key_pages INTEGER[],  -- Most important pages for this topic (e.g., {74, 75, 76})
  diagram_pages INTEGER[],  -- Pages with important diagrams
  example_pages INTEGER[],  -- Pages with worked examples
  exercise_pages INTEGER[],  -- Pages with practice exercises
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'approved', 'outdated')),
  
  -- Metadata
  mapping_notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Prevent duplicate mappings
  UNIQUE(caps_topic_id, textbook_content_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mapping_caps_topic ON caps_textbook_mapping(caps_topic_id);
CREATE INDEX IF NOT EXISTS idx_mapping_textbook_content ON caps_textbook_mapping(textbook_content_id);
CREATE INDEX IF NOT EXISTS idx_mapping_status ON caps_textbook_mapping(status);
CREATE INDEX IF NOT EXISTS idx_mapping_verified ON caps_textbook_mapping(verification_date) WHERE status = 'verified';

-- =====================================================
-- 5. Helper Functions
-- =====================================================

-- Function to find CAPS topics by textbook page number
CREATE OR REPLACE FUNCTION find_caps_topics_by_page(
  p_textbook_id UUID,
  p_page_number INTEGER
)
RETURNS TABLE (
  topic_id UUID,
  topic_code VARCHAR,
  topic_title VARCHAR,
  content_outline TEXT,
  page_start INTEGER,
  page_end INTEGER,
  alignment_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.id,
    ct.topic_code,
    ct.topic_title,
    ct.content_outline,
    tc.page_start,
    tc.page_end,
    ctm.alignment_score
  FROM caps_topics ct
  JOIN caps_textbook_mapping ctm ON ct.id = ctm.caps_topic_id
  JOIN textbook_content tc ON ctm.textbook_content_id = tc.id
  WHERE tc.textbook_id = p_textbook_id
    AND p_page_number BETWEEN tc.page_start AND tc.page_end
    AND ctm.status IN ('verified', 'approved')
  ORDER BY ctm.alignment_score DESC, tc.page_start;
END;
$$ LANGUAGE plpgsql;

-- Function to get textbook pages for a CAPS topic
CREATE OR REPLACE FUNCTION get_textbook_pages_for_topic(
  p_caps_topic_id UUID,
  p_grade VARCHAR DEFAULT NULL,
  p_subject VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  textbook_title VARCHAR,
  textbook_publisher VARCHAR,
  chapter_title VARCHAR,
  page_start INTEGER,
  page_end INTEGER,
  key_pages INTEGER[],
  alignment_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.title,
    t.publisher,
    tc.title,
    tc.page_start,
    tc.page_end,
    ctm.key_pages,
    ctm.alignment_score
  FROM caps_textbook_mapping ctm
  JOIN textbook_content tc ON ctm.textbook_content_id = tc.id
  JOIN textbooks t ON tc.textbook_id = t.id
  WHERE ctm.caps_topic_id = p_caps_topic_id
    AND (p_grade IS NULL OR t.grade = p_grade)
    AND (p_subject IS NULL OR t.subject = p_subject)
    AND ctm.status IN ('verified', 'approved')
    AND t.is_active = true
  ORDER BY ctm.alignment_score DESC, t.publication_year DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Row Level Security (RLS)
-- =====================================================

ALTER TABLE caps_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbook_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE caps_textbook_mapping ENABLE ROW LEVEL SECURITY;

-- Public read access for all users (curriculum is public knowledge)
CREATE POLICY "Allow public read on caps_topics" ON caps_topics
  FOR SELECT USING (true);

CREATE POLICY "Allow public read on textbooks" ON textbooks
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read on textbook_content" ON textbook_content
  FOR SELECT USING (true);

CREATE POLICY "Allow public read on verified mappings" ON caps_textbook_mapping
  FOR SELECT USING (status IN ('verified', 'approved'));

-- Write access only for authenticated users with proper roles
CREATE POLICY "Allow insert for teachers and admins" ON caps_topics
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('teacher', 'principal', 'superadmin')
  );

CREATE POLICY "Allow update for teachers and admins" ON caps_topics
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('teacher', 'principal', 'superadmin')
  );

-- Similar policies for other tables (textbooks, textbook_content, mappings)
CREATE POLICY "Allow insert for admins on textbooks" ON textbooks
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('principal', 'superadmin')
  );

CREATE POLICY "Allow insert for admins on mapping" ON caps_textbook_mapping
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('teacher', 'principal', 'superadmin')
  );

-- =====================================================
-- 7. Triggers for automatic timestamps
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_caps_topics_updated_at BEFORE UPDATE ON caps_topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_textbooks_updated_at BEFORE UPDATE ON textbooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_textbook_content_updated_at BEFORE UPDATE ON textbook_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_caps_textbook_mapping_updated_at BEFORE UPDATE ON caps_textbook_mapping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. Sample Data Comments
-- =====================================================

COMMENT ON TABLE caps_topics IS 'CAPS learning objectives and topic specifications from official curriculum';
COMMENT ON TABLE textbooks IS 'Registry of CAPS-approved textbooks used in South African schools';
COMMENT ON TABLE textbook_content IS 'Chapter/section structure of textbooks with page ranges';
COMMENT ON TABLE caps_textbook_mapping IS 'Junction table linking CAPS topics to specific textbook pages - requires manual mapping by subject matter experts';

COMMENT ON FUNCTION find_caps_topics_by_page IS 'Find CAPS topics covered on a specific textbook page - used when analyzing lesson plans';
COMMENT ON FUNCTION get_textbook_pages_for_topic IS 'Get all textbook references for a CAPS topic - used when generating study materials';

-- =====================================================
-- 9. Example Usage for AI Tools
-- =====================================================

/*
-- Example 1: Find topics for lesson plan pages
SELECT * FROM find_caps_topics_by_page(
  'textbook-uuid-here',  -- Geography Grade 5 textbook
  74  -- Page number from lesson plan
);

-- Example 2: Get all textbook references for a topic
SELECT * FROM get_textbook_pages_for_topic(
  'caps-topic-uuid-here',  -- "Coal Formation" topic
  '5',  -- Grade
  'Geography'  -- Subject
);

-- Example 3: Query for exam generation
SELECT 
  ct.topic_title,
  ct.content_outline,
  ct.learning_outcomes,
  ctm.key_pages,
  t.title as textbook_title
FROM caps_topics ct
JOIN caps_textbook_mapping ctm ON ct.id = ctm.caps_topic_id
JOIN textbook_content tc ON ctm.textbook_content_id = tc.id
JOIN textbooks t ON tc.textbook_id = t.id
WHERE ct.grade = '5'
  AND ct.subject = 'Geography'
  AND 74 = ANY(ctm.key_pages)  -- Page 74 is a key page
  AND ctm.status = 'verified';
*/
