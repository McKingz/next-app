-- Official DBE Past Exam Papers
-- Source: Department of Basic Education (education.gov.za)
-- Downloaded: 2025-11-01T22:54:07.195Z

-- Insert official exam papers

-- Mathematics Paper 1 - November 2024
INSERT INTO exam_papers (
  title,
  subject,
  grade,
  year,
  term,
  paper_type,
  curriculum_code,
  language,
  topics,
  total_marks,
  time_allowed,
  difficulty_level,
  pdf_url,
  memo_pdf_url,
  questions
) VALUES (
  'Mathematics Paper 1 - November 2024',
  'Mathematics',
  'Grade 12',
  2024,
  'Term 4',
  'Paper 1',
  'CAPS-MATH-G12',
  'en-ZA',
  ARRAY['Algebra', 'Functions', 'Calculus', 'Sequences and Series'],
  150,
  180,
  'official',
  './exam-papers-official/2024/mathematics/Mathematics_P1_Nov2024_Eng.pdf',
  './exam-papers-official/2024/mathematics/Mathematics_P1_Nov2024_Memo.pdf',
  '{"source":"DBE","exam_type":"NSC","paper_number":1,"sections":[{"section":"A","title":"Multiple Choice","marks":20,"questions":10},{"section":"B","title":"Short Questions","marks":50,"questions":8},{"section":"C","title":"Long Questions","marks":80,"questions":4}],"download_date":"2025-11-01T22:54:07.195Z","verified":true,"description":"Official DBE NSC examination paper for Mathematics Grade 12, 2024."}'::jsonb
);

-- Mathematics Paper 2 - November 2024
INSERT INTO exam_papers (
  title,
  subject,
  grade,
  year,
  term,
  paper_type,
  curriculum_code,
  language,
  topics,
  total_marks,
  time_allowed,
  difficulty_level,
  pdf_url,
  memo_pdf_url,
  questions
) VALUES (
  'Mathematics Paper 2 - November 2024',
  'Mathematics',
  'Grade 12',
  2024,
  'Term 4',
  'Paper 2',
  'CAPS-MATH-G12',
  'en-ZA',
  ARRAY['Statistics', 'Probability', 'Analytical Geometry', 'Trigonometry', 'Euclidean Geometry'],
  150,
  180,
  'official',
  './exam-papers-official/2024/mathematics/Mathematics_P2_Nov2024_Eng.pdf',
  './exam-papers-official/2024/mathematics/Mathematics_P2_Nov2024_Memo.pdf',
  '{"source":"DBE","exam_type":"NSC","paper_number":2,"sections":[{"section":"A","title":"Statistics and Probability","marks":60,"questions":6},{"section":"B","title":"Geometry","marks":90,"questions":6}],"download_date":"2025-11-01T22:54:07.195Z","verified":true,"description":"Official DBE NSC examination paper for Mathematics Grade 12, 2024."}'::jsonb
);

-- Life Sciences Paper 1 - November 2024
INSERT INTO exam_papers (
  title,
  subject,
  grade,
  year,
  term,
  paper_type,
  curriculum_code,
  language,
  topics,
  total_marks,
  time_allowed,
  difficulty_level,
  pdf_url,
  memo_pdf_url,
  questions
) VALUES (
  'Life Sciences Paper 1 - November 2024',
  'Life Sciences',
  'Grade 12',
  2024,
  'Term 4',
  'Paper 1',
  'CAPS-LIFESC-G12',
  'en-ZA',
  ARRAY['Cell Biology', 'DNA and Protein Synthesis', 'Genetics', 'Meiosis', 'Evolution'],
  150,
  150,
  'official',
  './exam-papers-official/2024/life-sciences/LifeSciences_P1_Nov2024_Eng.pdf',
  './exam-papers-official/2024/life-sciences/LifeSciences_P1_Nov2024_Memo.pdf',
  '{"source":"DBE","exam_type":"NSC","paper_number":1,"sections":[{"section":"A","title":"Multiple Choice","marks":40,"questions":20},{"section":"B","title":"Structured Questions","marks":110,"questions":8}],"download_date":"2025-11-01T22:54:07.195Z","verified":true,"description":"Official DBE NSC examination paper for Life Sciences Grade 12, 2024."}'::jsonb
);

-- Life Sciences Paper 2 - November 2024
INSERT INTO exam_papers (
  title,
  subject,
  grade,
  year,
  term,
  paper_type,
  curriculum_code,
  language,
  topics,
  total_marks,
  time_allowed,
  difficulty_level,
  pdf_url,
  memo_pdf_url,
  questions
) VALUES (
  'Life Sciences Paper 2 - November 2024',
  'Life Sciences',
  'Grade 12',
  2024,
  'Term 4',
  'Paper 2',
  'CAPS-LIFESC-G12',
  'en-ZA',
  ARRAY['Human Systems', 'Excretion', 'Reproductive Systems', 'Ecosystems', 'Population Ecology'],
  150,
  150,
  'official',
  './exam-papers-official/2024/life-sciences/LifeSciences_P2_Nov2024_Eng.pdf',
  './exam-papers-official/2024/life-sciences/LifeSciences_P2_Nov2024_Memo.pdf',
  '{"source":"DBE","exam_type":"NSC","paper_number":2,"sections":[{"section":"A","title":"Multiple Choice","marks":40,"questions":20},{"section":"B","title":"Structured Questions","marks":110,"questions":8}],"download_date":"2025-11-01T22:54:07.195Z","verified":true,"description":"Official DBE NSC examination paper for Life Sciences Grade 12, 2024."}'::jsonb
);

-- English Home Language Paper 1 - November 2024
INSERT INTO exam_papers (
  title,
  subject,
  grade,
  year,
  term,
  paper_type,
  curriculum_code,
  language,
  topics,
  total_marks,
  time_allowed,
  difficulty_level,
  pdf_url,
  memo_pdf_url,
  questions
) VALUES (
  'English Home Language Paper 1 - November 2024',
  'English Home Language',
  'Grade 12',
  2024,
  'Term 4',
  'Paper 1',
  'CAPS-ENG-G12',
  'en-ZA',
  ARRAY['Comprehension', 'Summary Writing', 'Language Structures'],
  80,
  180,
  'official',
  './exam-papers-official/2024/english/English_HL_P1_Nov2024.pdf',
  './exam-papers-official/2024/english/English_HL_P1_Nov2024_Memo.pdf',
  '{"source":"DBE","exam_type":"NSC","paper_number":1,"sections":[{"section":"A","title":"Comprehension","marks":30,"questions":1},{"section":"B","title":"Summary","marks":10,"questions":1},{"section":"C","title":"Language Structures","marks":40,"questions":1}],"download_date":"2025-11-01T22:54:07.195Z","verified":true,"description":"Official DBE NSC examination paper for English Home Language Grade 12, 2024."}'::jsonb
);

-- Afrikaans Huistaal Vraestel 1 - November 2024
INSERT INTO exam_papers (
  title,
  subject,
  grade,
  year,
  term,
  paper_type,
  curriculum_code,
  language,
  topics,
  total_marks,
  time_allowed,
  difficulty_level,
  pdf_url,
  memo_pdf_url,
  questions
) VALUES (
  'Afrikaans Huistaal Vraestel 1 - November 2024',
  'Afrikaans Huistaal',
  'Grade 12',
  2024,
  'Term 4',
  'Paper 1',
  'CAPS-AFR-G12',
  'af-ZA',
  ARRAY['Begrip', 'Opsomming', 'Taalstrukture'],
  80,
  180,
  'official',
  './exam-papers-official/2024/afrikaans/Afrikaans_HT_V1_Nov2024.pdf',
  './exam-papers-official/2024/afrikaans/Afrikaans_HT_V1_Nov2024_Memo.pdf',
  '{"source":"DBE","exam_type":"NSC","paper_number":1,"sections":[{"section":"A","title":"Begrip","marks":30,"questions":1},{"section":"B","title":"Opsomming","marks":10,"questions":1},{"section":"C","title":"Taalstrukture","marks":40,"questions":1}],"download_date":"2025-11-01T22:54:07.195Z","verified":true,"description":"Official DBE NSC examination paper for Afrikaans Huistaal Grade 12, 2024."}'::jsonb
);

-- Mathematics Paper 1 - November 2023
INSERT INTO exam_papers (
  title,
  subject,
  grade,
  year,
  term,
  paper_type,
  curriculum_code,
  language,
  topics,
  total_marks,
  time_allowed,
  difficulty_level,
  pdf_url,
  memo_pdf_url,
  questions
) VALUES (
  'Mathematics Paper 1 - November 2023',
  'Mathematics',
  'Grade 12',
  2023,
  'Term 4',
  'Paper 1',
  'CAPS-MATH-G12',
  'en-ZA',
  ARRAY['Algebra', 'Functions', 'Calculus', 'Sequences and Series'],
  150,
  180,
  'official',
  './exam-papers-official/2023/mathematics/Mathematics_P1_Nov2023_Eng.pdf',
  './exam-papers-official/2023/mathematics/Mathematics_P1_Nov2023_Memo.pdf',
  '{"source":"DBE","exam_type":"NSC","paper_number":1,"sections":[],"download_date":"2025-11-01T22:54:07.195Z","verified":true,"description":"Official DBE NSC examination paper for Mathematics Grade 12, 2023."}'::jsonb
);

-- Life Sciences Paper 1 - November 2023
INSERT INTO exam_papers (
  title,
  subject,
  grade,
  year,
  term,
  paper_type,
  curriculum_code,
  language,
  topics,
  total_marks,
  time_allowed,
  difficulty_level,
  pdf_url,
  memo_pdf_url,
  questions
) VALUES (
  'Life Sciences Paper 1 - November 2023',
  'Life Sciences',
  'Grade 12',
  2023,
  'Term 4',
  'Paper 1',
  'CAPS-LIFESC-G12',
  'en-ZA',
  ARRAY['Cell Biology', 'DNA', 'Genetics', 'Evolution'],
  150,
  150,
  'official',
  './exam-papers-official/2023/life-sciences/LifeSciences_P1_Nov2023_Eng.pdf',
  './exam-papers-official/2023/life-sciences/LifeSciences_P1_Nov2023_Memo.pdf',
  '{"source":"DBE","exam_type":"NSC","paper_number":1,"sections":[],"download_date":"2025-11-01T22:54:07.195Z","verified":true,"description":"Official DBE NSC examination paper for Life Sciences Grade 12, 2023."}'::jsonb
);

-- Create indexes for official papers
CREATE INDEX IF NOT EXISTS idx_exam_papers_difficulty ON exam_papers(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_exam_papers_year_subject ON exam_papers(year, subject);
CREATE INDEX IF NOT EXISTS idx_exam_papers_grade_year ON exam_papers(CAST(SUBSTRING(grade FROM '\\d+') AS INTEGER), year);
