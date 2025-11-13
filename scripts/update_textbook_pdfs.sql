-- Update textbooks with actual PDF URLs from government and open sources
-- Run this via Supabase SQL Editor

-- DBE Rainbow Workbooks (Free Government Textbooks)
UPDATE textbooks 
SET pdf_url = 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20IP%20SOCIAL%20SCIENCES%20GR%204-6%20web.pdf'
WHERE title = 'DBE Rainbow Workbooks: Social Sciences - Grade 5' AND subject = 'Social Sciences';

UPDATE textbooks
SET pdf_url = 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20AFRIKAANS%20HUISTAAL%20GRAAD%205%20web.pdf'
WHERE title = 'DBE Afrikaans Huistaal Graad 5' AND subject = 'Afrikaans Huistaal';

UPDATE textbooks
SET pdf_url = 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20AFRIKAANS%20EAT%20GRAAD%205%20web.pdf'
WHERE title = 'DBE Afrikaans Eerste Addisionele Taal Graad 5' AND subject = 'Afrikaans EAT';

-- Siyavula Mathematics (Open Source - Creative Commons)
UPDATE textbooks
SET pdf_url = 'https://www.everythingmaths.co.za/grade-10/12-statistics/pspictures/summary.pdf'
WHERE title = 'Mathematics Grade 10' AND publisher = 'Siyavula';

UPDATE textbooks
SET pdf_url = 'https://www.everythingmaths.co.za/grade-11/pspictures/summary.pdf'
WHERE title = 'Mathematics Grade 11' AND publisher = 'Siyavula';

UPDATE textbooks
SET pdf_url = 'https://www.everythingmaths.co.za/grade-12/pspictures/summary.pdf'
WHERE title = 'Mathematics Grade 12' AND publisher = 'Siyavula';

-- Siyavula Physical Sciences (Open Source)
UPDATE textbooks
SET pdf_url = 'https://www.everythingscience.co.za/grade-10/pspictures/summary.pdf'
WHERE title = 'Physical Sciences Grade 10' AND publisher = 'Siyavula';

UPDATE textbooks
SET pdf_url = 'https://www.everythingscience.co.za/grade-11/pspictures/summary.pdf'
WHERE title = 'Physical Sciences Grade 11' AND publisher = 'Siyavula';

UPDATE textbooks
SET pdf_url = 'https://www.everythingscience.co.za/grade-12/pspictures/summary.pdf'
WHERE title = 'Physical Sciences Grade 12' AND publisher = 'Siyavula';

-- Verify updates
SELECT 
  title, 
  grade, 
  subject, 
  publisher,
  CASE 
    WHEN pdf_url IS NULL THEN '❌ Missing'
    ELSE '✅ Available'
  END as pdf_status,
  SUBSTRING(pdf_url, 1, 50) as pdf_preview
FROM textbooks
ORDER BY grade, subject;
