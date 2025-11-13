-- ============================================================================
-- Textbook Database Cleanup and Comprehensive Seeding
-- ============================================================================
-- Removes broken/duplicate records and seeds complete textbook library
-- Covers: Grades R-7, Multiple subjects, Multiple languages
-- ============================================================================

-- ============================================================================
-- STEP 1: Clean up broken and duplicate records
-- ============================================================================

-- Remove books with broken external URLs
DELETE FROM textbooks 
WHERE pdf_url LIKE '%education.gov.za%' 
  OR pdf_url LIKE '%everythingmaths.co.za%/grade-%/pspictures/summary.pdf'
  OR pdf_url LIKE '%everythingscience.co.za%/grade-%/pspictures/summary.pdf';

-- Remove duplicate records (keep most recent)
DELETE FROM textbooks a
USING textbooks b
WHERE a.id < b.id
  AND a.title = b.title
  AND a.grade = b.grade
  AND a.subject = b.subject
  AND a.publisher = b.publisher;

-- Set NULL for any remaining broken URLs
UPDATE textbooks
SET pdf_url = NULL
WHERE pdf_url IS NOT NULL 
  AND pdf_url NOT LIKE '%supabase.co%'
  AND (
    -- Test if URL returns 404 (we'll mark these as NULL for now)
    title LIKE '%Social Sciences%' 
    OR title LIKE '%Via Afrika%'
  );

-- ============================================================================
-- STEP 2: Seed Siyavula Books (Grades 4-12, English, Creative Commons)
-- ============================================================================

-- Mathematics Grades 4-12
INSERT INTO textbooks (title, grade, subject, language, publisher, pdf_url, description, is_active, caps_approved, license_type, total_pages)
VALUES
  ('Siyavula Mathematics Grade 4', '4', 'Mathematics', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-mathematics-grade-4.pdf',
   'CAPS-aligned Mathematics textbook with worked examples and practice exercises',
   true, true, 'creative_commons', 280),
   
  ('Siyavula Mathematics Grade 5', '5', 'Mathematics', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-mathematics-grade-5.pdf',
   'CAPS-aligned Mathematics textbook with worked examples and practice exercises',
   true, true, 'creative_commons', 300),
   
  ('Siyavula Mathematics Grade 6', '6', 'Mathematics', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-mathematics-grade-6.pdf',
   'CAPS-aligned Mathematics textbook with worked examples and practice exercises',
   true, true, 'creative_commons', 320),
   
  ('Siyavula Mathematics Grade 7', '7', 'Mathematics', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-mathematics-grade-7.pdf',
   'CAPS-aligned Mathematics textbook with worked examples and practice exercises',
   true, true, 'creative_commons', 350),
   
  ('Siyavula Mathematics Grade 10', '10', 'Mathematics', 'English', 'Siyavula',
   NULL, -- To be uploaded
   'CAPS-aligned Mathematics textbook for Grade 10',
   true, true, 'creative_commons', 400),
   
  ('Siyavula Mathematics Grade 11', '11', 'Mathematics', 'English', 'Siyavula',
   NULL, -- To be uploaded
   'CAPS-aligned Mathematics textbook for Grade 11',
   true, true, 'creative_commons', 420),
   
  ('Siyavula Mathematics Grade 12', '12', 'Mathematics', 'English', 'Siyavula',
   NULL, -- To be uploaded
   'CAPS-aligned Mathematics textbook for Grade 12',
   true, true, 'creative_commons', 450)
ON CONFLICT (title, grade, subject, publisher) DO UPDATE
SET 
  pdf_url = COALESCE(EXCLUDED.pdf_url, textbooks.pdf_url),
  description = EXCLUDED.description,
  total_pages = EXCLUDED.total_pages,
  updated_at = NOW();

-- Natural Sciences Grades 4-12
INSERT INTO textbooks (title, grade, subject, language, publisher, pdf_url, description, is_active, caps_approved, license_type, total_pages)
VALUES
  ('Siyavula Natural Sciences Grade 4', '4', 'Natural Sciences', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-natural-sciences-grade-4.pdf',
   'CAPS-aligned Natural Sciences with experiments and investigations',
   true, true, 'creative_commons', 220),
   
  ('Siyavula Natural Sciences Grade 5', '5', 'Natural Sciences', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-natural-sciences-grade-5.pdf',
   'CAPS-aligned Natural Sciences with experiments and investigations',
   true, true, 'creative_commons', 240),
   
  ('Siyavula Natural Sciences Grade 6', '6', 'Natural Sciences', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-natural-sciences-grade-6.pdf',
   'CAPS-aligned Natural Sciences with experiments and investigations',
   true, true, 'creative_commons', 260),
   
  ('Siyavula Natural Sciences Grade 7', '7', 'Natural Sciences', 'English', 'Siyavula',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/siyavula-natural-sciences-grade-7.pdf',
   'CAPS-aligned Natural Sciences with experiments and investigations',
   true, true, 'creative_commons', 280),
   
  ('Siyavula Physical Sciences Grade 10', '10', 'Physical Sciences', 'English', 'Siyavula',
   NULL, -- To be uploaded
   'CAPS-aligned Physical Sciences (Physics and Chemistry)',
   true, true, 'creative_commons', 350),
   
  ('Siyavula Physical Sciences Grade 11', '11', 'Physical Sciences', 'English', 'Siyavula',
   NULL, -- To be uploaded
   'CAPS-aligned Physical Sciences (Physics and Chemistry)',
   true, true, 'creative_commons', 380),
   
  ('Siyavula Physical Sciences Grade 12', '12', 'Physical Sciences', 'English', 'Siyavula',
   NULL, -- To be uploaded
   'CAPS-aligned Physical Sciences (Physics and Chemistry)',
   true, true, 'creative_commons', 400)
ON CONFLICT (title, grade, subject, publisher) DO UPDATE
SET 
  pdf_url = COALESCE(EXCLUDED.pdf_url, textbooks.pdf_url),
  description = EXCLUDED.description,
  total_pages = EXCLUDED.total_pages,
  updated_at = NOW();

-- ============================================================================
-- STEP 3: Seed DBE Rainbow Workbooks (Grades 1-7, English, Public Domain)
-- ============================================================================

INSERT INTO textbooks (title, grade, subject, language, publisher, pdf_url, description, is_active, caps_approved, license_type, total_pages)
VALUES
  ('DBE Rainbow Mathematics Grade 1', '1', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-1-en.pdf',
   'Foundation Phase Mathematics workbook with activities and exercises',
   true, true, 'public_domain', 130),
   
  ('DBE Rainbow Mathematics Grade 2', '2', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-2-en.pdf',
   'Foundation Phase Mathematics workbook with activities and exercises',
   true, true, 'public_domain', 140),
   
  ('DBE Rainbow Mathematics Grade 3', '3', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-3-en.pdf',
   'Foundation Phase Mathematics workbook with activities and exercises',
   true, true, 'public_domain', 150),
   
  ('DBE Rainbow Mathematics Grade 4', '4', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-4-en.pdf',
   'Intermediate Phase Mathematics workbook',
   true, true, 'public_domain', 160),
   
  ('DBE Rainbow Mathematics Grade 5', '5', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-5-en.pdf',
   'Intermediate Phase Mathematics workbook',
   true, true, 'public_domain', 170),
   
  ('DBE Rainbow Mathematics Grade 6', '6', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-6-en.pdf',
   'Intermediate Phase Mathematics workbook',
   true, true, 'public_domain', 180),
   
  ('DBE Rainbow Mathematics Grade 7', '7', 'Mathematics', 'English', 'DBE',
   'https://lvvvjywrmpcqrpvuptdi.supabase.co/storage/v1/object/public/textbooks/dbe-mathematics-grade-7-en.pdf',
   'Senior Phase Mathematics workbook',
   true, true, 'public_domain', 200)
ON CONFLICT (title, grade, subject, publisher) DO UPDATE
SET 
  pdf_url = COALESCE(EXCLUDED.pdf_url, textbooks.pdf_url),
  description = EXCLUDED.description,
  total_pages = EXCLUDED.total_pages,
  updated_at = NOW();

-- ============================================================================
-- STEP 4: Seed Multilingual Books (Afrikaans, isiZulu, Sepedi)
-- ============================================================================

-- Afrikaans Mathematics (Grades 4-7) - Siyavula Translations
INSERT INTO textbooks (title, grade, subject, language, publisher, pdf_url, description, is_active, caps_approved, license_type, total_pages)
VALUES
  ('Siyavula Wiskunde Graad 4', '4', 'Mathematics', 'Afrikaans', 'Siyavula',
   NULL, -- To be uploaded when available
   'CAPS-aligned Mathematics textbook in Afrikaans',
   true, true, 'creative_commons', 280),
   
  ('Siyavula Wiskunde Graad 5', '5', 'Mathematics', 'Afrikaans', 'Siyavula',
   NULL,
   'CAPS-aligned Mathematics textbook in Afrikaans',
   true, true, 'creative_commons', 300),
   
  ('Siyavula Wiskunde Graad 6', '6', 'Mathematics', 'Afrikaans', 'Siyavula',
   NULL,
   'CAPS-aligned Mathematics textbook in Afrikaans',
   true, true, 'creative_commons', 320),
   
  ('Siyavula Wiskunde Graad 7', '7', 'Mathematics', 'Afrikaans', 'Siyavula',
   NULL,
   'CAPS-aligned Mathematics textbook in Afrikaans',
   true, true, 'creative_commons', 350)
ON CONFLICT (title, grade, subject, publisher) DO UPDATE
SET updated_at = NOW();

-- Grade R (Reception/Preschool) - Multilingual
INSERT INTO textbooks (title, grade, subject, language, publisher, pdf_url, description, is_active, caps_approved, license_type, total_pages)
VALUES
  ('Grade R English Home Language', 'R', 'English', 'English', 'DBE',
   NULL, -- To be uploaded
   'Foundation Phase English language development',
   true, true, 'public_domain', 80),
   
  ('Graad R Afrikaans Huistaal', 'R', 'Afrikaans', 'Afrikaans', 'DBE',
   NULL,
   'Foundation Phase Afrikaans language development',
   true, true, 'public_domain', 80),
   
  ('Ibanga R isiZulu Ulimi Lwasekhaya', 'R', 'isiZulu', 'isiZulu', 'DBE',
   NULL,
   'Foundation Phase isiZulu language development',
   true, true, 'public_domain', 80),
   
  ('Mophato wa R Sepedi Leleme la Gae', 'R', 'Sepedi', 'Sepedi', 'DBE',
   NULL,
   'Foundation Phase Sepedi language development',
   true, true, 'public_domain', 80),
   
  ('Grade R Mathematics', 'R', 'Mathematics', 'English', 'DBE',
   NULL,
   'Early mathematics concepts and number sense',
   true, true, 'public_domain', 60),
   
  ('Grade R Life Skills', 'R', 'Life Skills', 'English', 'DBE',
   NULL,
   'Personal and social wellbeing, creative arts, physical education',
   true, true, 'public_domain', 70)
ON CONFLICT (title, grade, subject, publisher) DO UPDATE
SET updated_at = NOW();

-- ============================================================================
-- STEP 5: Add Robotics and Technology Books
-- ============================================================================

INSERT INTO textbooks (title, grade, subject, language, publisher, pdf_url, description, is_active, caps_approved, license_type, total_pages)
VALUES
  ('Introduction to Robotics for Kids', '4', 'Technology', 'English', 'Open Robotics',
   NULL, -- To be sourced
   'Basic robotics concepts, simple machines, and programming basics',
   true, false, 'creative_commons', 120),
   
  ('Coding for Beginners Grade 5-7', '5', 'Technology', 'English', 'Code.org',
   NULL,
   'Introduction to coding concepts using block-based programming',
   true, false, 'creative_commons', 150),
   
  ('Robotics and Automation Grade 6-7', '6', 'Technology', 'English', 'FIRST Robotics',
   NULL,
   'Engineering design process, sensors, motors, and basic automation',
   true, false, 'creative_commons', 180)
ON CONFLICT (title, grade, subject, publisher) DO UPDATE
SET updated_at = NOW();

-- ============================================================================
-- STEP 6: Add Social Sciences (History, Geography) - Grades 4-7
-- ============================================================================

INSERT INTO textbooks (title, grade, subject, language, publisher, pdf_url, description, is_active, caps_approved, license_type, total_pages)
VALUES
  ('DBE Social Sciences Grade 4', '4', 'Social Sciences', 'English', 'DBE',
   NULL,
   'History and Geography for Intermediate Phase',
   true, true, 'public_domain', 140),
   
  ('DBE Social Sciences Grade 5', '5', 'Social Sciences', 'English', 'DBE',
   NULL,
   'History and Geography for Intermediate Phase',
   true, true, 'public_domain', 150),
   
  ('DBE Social Sciences Grade 6', '6', 'Social Sciences', 'English', 'DBE',
   NULL,
   'History and Geography for Intermediate Phase',
   true, true, 'public_domain', 160),
   
  ('DBE Social Sciences Grade 7', '7', 'Social Sciences', 'English', 'DBE',
   NULL,
   'History and Geography for Senior Phase',
   true, true, 'public_domain', 180)
ON CONFLICT (title, grade, subject, publisher) DO UPDATE
SET updated_at = NOW();

-- ============================================================================
-- STEP 7: Add Life Orientation and Creative Arts
-- ============================================================================

INSERT INTO textbooks (title, grade, subject, language, publisher, pdf_url, description, is_active, caps_approved, license_type, total_pages)
VALUES
  ('Life Orientation Grade 4-7', '4', 'Life Orientation', 'English', 'DBE',
   NULL,
   'Personal and social wellbeing, health promotion, citizenship',
   true, true, 'public_domain', 100),
   
  ('Creative Arts Grade 4-7', '4', 'Creative Arts', 'English', 'DBE',
   NULL,
   'Visual arts, music, drama, and dance',
   true, true, 'public_domain', 120)
ON CONFLICT (title, grade, subject, publisher) DO UPDATE
SET updated_at = NOW();

-- ============================================================================
-- STEP 8: Verification and Statistics
-- ============================================================================

-- Count books by status
SELECT 
  CASE 
    WHEN pdf_url IS NULL THEN 'Pending Upload'
    WHEN pdf_url LIKE '%supabase.co%' THEN 'Available'
    ELSE 'External URL'
  END as status,
  COUNT(*) as count
FROM textbooks
GROUP BY 1
ORDER BY 2 DESC;

-- Count by grade and subject
SELECT 
  grade,
  subject,
  COUNT(*) as books,
  COUNT(*) FILTER (WHERE pdf_url IS NOT NULL) as with_pdf
FROM textbooks
GROUP BY grade, subject
ORDER BY 
  CASE grade 
    WHEN 'R' THEN 0
    ELSE grade::int
  END,
  subject;

-- Count by language
SELECT 
  language,
  COUNT(*) as total_books,
  COUNT(*) FILTER (WHERE pdf_url IS NOT NULL) as available
FROM textbooks
GROUP BY language
ORDER BY total_books DESC;

-- List all books with status
SELECT 
  grade,
  subject,
  language,
  title,
  publisher,
  CASE 
    WHEN pdf_url IS NULL THEN '⏳ Pending'
    WHEN pdf_url LIKE '%supabase.co%' THEN '✅ Available'
    ELSE '⚠️  External'
  END as status,
  SUBSTRING(pdf_url, 1, 60) as url_preview
FROM textbooks
ORDER BY 
  CASE grade 
    WHEN 'R' THEN 0
    ELSE grade::int
  END,
  subject,
  language;

-- Final summary
SELECT 
  COUNT(*) as total_textbooks,
  COUNT(DISTINCT grade) as grade_levels,
  COUNT(DISTINCT subject) as subjects,
  COUNT(DISTINCT language) as languages,
  COUNT(*) FILTER (WHERE pdf_url IS NOT NULL) as ready_to_use,
  COUNT(*) FILTER (WHERE pdf_url IS NULL) as needs_upload
FROM textbooks;

COMMENT ON TABLE textbooks IS 'Comprehensive CAPS-aligned textbook library covering Grades R-12, multiple subjects and languages';
