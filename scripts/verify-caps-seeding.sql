-- =====================================================
-- CAPS Database Seeding Verification Script
-- =====================================================
-- Comprehensive check to verify all CAPS content is properly seeded
-- Run this against your Supabase database to verify seeding

\echo '========================================='
\echo '📊 CAPS DATABASE VERIFICATION REPORT'
\echo '========================================='
\echo ''

-- =====================================================
-- 1. TABLE EXISTENCE CHECK
-- =====================================================
\echo '1️⃣  CHECKING TABLE EXISTENCE...'
\echo ''

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'caps_documents') 
    THEN '✅ caps_documents'
    ELSE '❌ caps_documents MISSING'
  END as table_check
UNION ALL
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'caps_content_chunks') 
    THEN '✅ caps_content_chunks'
    ELSE '❌ caps_content_chunks MISSING'
  END
UNION ALL
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'caps_exam_questions') 
    THEN '✅ caps_exam_questions'
    ELSE '❌ caps_exam_questions MISSING'
  END
UNION ALL
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'caps_exam_patterns') 
    THEN '✅ caps_exam_patterns'
    ELSE '❌ caps_exam_patterns MISSING'
  END
UNION ALL
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dash_curriculum_memory') 
    THEN '✅ dash_curriculum_memory'
    ELSE '❌ dash_curriculum_memory MISSING'
  END;

\echo ''
\echo '========================================='
\echo ''

-- =====================================================
-- 2. RECORD COUNTS
-- =====================================================
\echo '2️⃣  TOTAL RECORD COUNTS...'
\echo ''

WITH counts AS (
  SELECT 
    'caps_documents' as table_name,
    COUNT(*) as record_count
  FROM caps_documents
  UNION ALL
  SELECT 
    'caps_content_chunks',
    COUNT(*)
  FROM caps_content_chunks
  UNION ALL
  SELECT 
    'caps_exam_questions',
    COUNT(*)
  FROM caps_exam_questions
  UNION ALL
  SELECT 
    'caps_exam_patterns',
    COUNT(*)
  FROM caps_exam_patterns
  UNION ALL
  SELECT 
    'dash_curriculum_memory',
    COUNT(*)
  FROM dash_curriculum_memory
)
SELECT 
  table_name,
  record_count,
  CASE 
    WHEN record_count = 0 THEN '⚠️  EMPTY'
    WHEN record_count < 10 THEN '⚠️  LOW DATA'
    ELSE '✅ GOOD'
  END as status
FROM counts
ORDER BY table_name;

\echo ''
\echo '========================================='
\echo ''

-- =====================================================
-- 3. CAPS DOCUMENTS BY TYPE
-- =====================================================
\echo '3️⃣  CAPS DOCUMENTS BY TYPE...'
\echo ''

SELECT 
  document_type,
  COUNT(*) as count,
  ROUND(AVG(LENGTH(content_text))::NUMERIC, 0) as avg_content_length,
  ROUND(AVG(page_count)::NUMERIC, 1) as avg_pages
FROM caps_documents
GROUP BY document_type
ORDER BY count DESC;

\echo ''
\echo '========================================='
\echo ''

-- =====================================================
-- 4. COVERAGE BY GRADE AND SUBJECT
-- =====================================================
\echo '4️⃣  CURRICULUM COVERAGE BY GRADE...'
\echo ''

SELECT 
  grade,
  COUNT(DISTINCT subject) as subjects_covered,
  COUNT(*) as total_documents,
  COUNT(DISTINCT CASE WHEN document_type = 'curriculum' THEN subject END) as curriculum_docs,
  COUNT(DISTINCT CASE WHEN document_type = 'exam' THEN subject END) as exam_docs
FROM caps_documents
GROUP BY grade
ORDER BY 
  CASE 
    WHEN grade = 'R' THEN 0
    ELSE grade::INTEGER
  END;

\echo ''
\echo '========================================='
\echo ''

-- =====================================================
-- 5. COVERAGE BY SUBJECT
-- =====================================================
\echo '5️⃣  DOCUMENT COVERAGE BY SUBJECT...'
\echo ''

SELECT 
  subject,
  COUNT(*) as total_docs,
  COUNT(DISTINCT grade) as grades_covered,
  MIN(grade) as grade_from,
  MAX(grade) as grade_to,
  COUNT(DISTINCT document_type) as doc_types
FROM caps_documents
GROUP BY subject
ORDER BY total_docs DESC
LIMIT 15;

\echo ''
\echo '========================================='
\echo ''

-- =====================================================
-- 6. CONTENT QUALITY CHECKS
-- =====================================================
\echo '6️⃣  CONTENT QUALITY CHECKS...'
\echo ''

SELECT 
  'Documents with empty content' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 0 THEN '✅' ELSE '⚠️' END as status
FROM caps_documents
WHERE content_text IS NULL OR LENGTH(TRIM(content_text)) < 100
UNION ALL
SELECT 
  'Documents with no file_url',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅' ELSE '⚠️' END
FROM caps_documents
WHERE file_url IS NULL OR file_url = ''
UNION ALL
SELECT 
  'Documents with no subject',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅' ELSE '⚠️' END
FROM caps_documents
WHERE subject IS NULL OR subject = ''
UNION ALL
SELECT 
  'Documents with no grade',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅' ELSE '⚠️' END
FROM caps_documents
WHERE grade IS NULL OR grade = '';

\echo ''
\echo '========================================='
\echo ''

-- =====================================================
-- 7. EXAM QUESTIONS ANALYSIS
-- =====================================================
\echo '7️⃣  EXAM QUESTIONS BANK...'
\echo ''

SELECT 
  grade,
  subject,
  COUNT(*) as question_count,
  ROUND(AVG(marks)::NUMERIC, 1) as avg_marks,
  COUNT(DISTINCT year) as years_covered
FROM caps_exam_questions
GROUP BY grade, subject
ORDER BY question_count DESC
LIMIT 10;

\echo ''
\echo '========================================='
\echo ''

-- =====================================================
-- 8. CONTENT CHUNKS ANALYSIS
-- =====================================================
\echo '8️⃣  CONTENT CHUNKS STATUS...'
\echo ''

SELECT 
  cd.document_type,
  COUNT(DISTINCT cc.document_id) as docs_with_chunks,
  COUNT(cc.id) as total_chunks,
  ROUND(AVG(LENGTH(cc.content))::NUMERIC, 0) as avg_chunk_size,
  ROUND(COUNT(cc.id)::NUMERIC / NULLIF(COUNT(DISTINCT cc.document_id), 0), 1) as avg_chunks_per_doc
FROM caps_content_chunks cc
JOIN caps_documents cd ON cc.document_id = cd.id
GROUP BY cd.document_type
ORDER BY total_chunks DESC;

\echo ''
\echo '========================================='
\echo ''

-- =====================================================
-- 9. RECENT UPDATES CHECK
-- =====================================================
\echo '9️⃣  RECENT ACTIVITY...'
\echo ''

SELECT 
  'Most recent document added' as activity,
  TO_CHAR(MAX(created_at), 'YYYY-MM-DD HH24:MI:SS') as timestamp
FROM caps_documents
UNION ALL
SELECT 
  'Most recent chunk added',
  TO_CHAR(MAX(created_at), 'YYYY-MM-DD HH24:MI:SS')
FROM caps_content_chunks
UNION ALL
SELECT 
  'Most recent question added',
  TO_CHAR(MAX(created_at), 'YYYY-MM-DD HH24:MI:SS')
FROM caps_exam_questions;

\echo ''
\echo '========================================='
\echo ''

-- =====================================================
-- 10. SAMPLE DATA PREVIEW
-- =====================================================
\echo '🔟 SAMPLE DOCUMENTS...'
\echo ''

SELECT 
  LEFT(title, 60) as title,
  grade,
  subject,
  document_type,
  LENGTH(content_text) as content_length
FROM caps_documents
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '========================================='
\echo ''

-- =====================================================
-- 11. COMPLETENESS SCORE
-- =====================================================
\echo '📊 OVERALL COMPLETENESS SCORE...'
\echo ''

WITH metrics AS (
  SELECT 
    (SELECT COUNT(*) FROM caps_documents) as doc_count,
    (SELECT COUNT(*) FROM caps_content_chunks) as chunk_count,
    (SELECT COUNT(*) FROM caps_exam_questions) as question_count,
    (SELECT COUNT(DISTINCT grade) FROM caps_documents) as grade_coverage,
    (SELECT COUNT(DISTINCT subject) FROM caps_documents) as subject_coverage
)
SELECT 
  doc_count as documents,
  chunk_count as chunks,
  question_count as questions,
  grade_coverage as grades_covered,
  subject_coverage as subjects_covered,
  CASE 
    WHEN doc_count >= 100 AND chunk_count >= 500 THEN '✅ EXCELLENT'
    WHEN doc_count >= 50 AND chunk_count >= 200 THEN '👍 GOOD'
    WHEN doc_count >= 20 AND chunk_count >= 50 THEN '⚠️  PARTIAL'
    ELSE '❌ INSUFFICIENT'
  END as overall_status
FROM metrics;

\echo ''
\echo '========================================='
\echo '✅ VERIFICATION COMPLETE'
\echo '========================================='
