-- =============================================
-- SEED EXAM PAPERS
-- Sample past papers for testing
-- =============================================

-- Mathematics Grade 10 - 2024 Term 1
INSERT INTO exam_papers (
  title,
  subject,
  grade,
  year,
  term,
  paper_type,
  curriculum_code,
  topics,
  difficulty_level,
  questions,
  total_marks,
  time_allowed,
  language
) VALUES (
  'Grade 10 Mathematics - Term 1 Exam 2024',
  'Mathematics',
  'Grade 10',
  2024,
  'Term 1',
  'Paper 1',
  'CAPS_MATH_G10_T1_P1',
  ARRAY['Algebra', 'Functions', 'Number Patterns', 'Exponents'],
  'medium',
  '{
    "sections": [
      {
        "title": "Section A: Algebra",
        "marks": 30,
        "questions": [
          {
            "number": 1,
            "question": "Simplify: 3x + 5x - 2x",
            "marks": 2,
            "answer": "6x",
            "solution": "Combine like terms: 3x + 5x - 2x = (3 + 5 - 2)x = 6x"
          },
          {
            "number": 2,
            "question": "Solve for x: 2x + 5 = 13",
            "marks": 3,
            "answer": "x = 4",
            "solution": "2x + 5 = 13\\n2x = 8\\nx = 4"
          }
        ]
      }
    ]
  }'::jsonb,
  100,
  120,
  'en-ZA'
),
(
  'Grade 12 Life Sciences - Final Exam 2023',
  'Life Sciences',
  'Grade 12',
  2023,
  'Final',
  'Paper 1',
  'CAPS_LIFESCI_G12_FINAL_P1',
  ARRAY['Photosynthesis', 'Cellular Respiration', 'Genetics', 'Evolution'],
  'hard',
  '{
    "sections": [
      {
        "title": "Section A: Biochemistry",
        "marks": 40,
        "questions": [
          {
            "number": 1,
            "question": "Explain the process of photosynthesis, including the light-dependent and light-independent reactions.",
            "marks": 10,
            "answer": "Detailed explanation of photosynthesis process",
            "rubric": "Award marks for mentioning: light reactions, Calvin cycle, ATP, NADPH, glucose production"
          }
        ]
      }
    ]
  }'::jsonb,
  150,
  180,
  'en-ZA'
),
(
  'Grade 7 English - Term 2 Exam 2024',
  'English',
  'Grade 7',
  2024,
  'Term 2',
  'Paper 1',
  'CAPS_ENG_G7_T2_P1',
  ARRAY['Comprehension', 'Grammar', 'Vocabulary', 'Writing'],
  'easy',
  '{
    "sections": [
      {
        "title": "Section A: Reading Comprehension",
        "marks": 20,
        "questions": [
          {
            "number": 1,
            "question": "Read the passage and answer the questions that follow.",
            "marks": 10,
            "passage": "Sample passage about South African wildlife"
          }
        ]
      }
    ]
  }'::jsonb,
  80,
  90,
  'en-ZA'
);

-- Add Afrikaans exam
INSERT INTO exam_papers (
  title,
  subject,
  grade,
  year,
  term,
  curriculum_code,
  topics,
  difficulty_level,
  questions,
  total_marks,
  time_allowed,
  language
) VALUES (
  'Graad 10 Wiskunde - Kwartaal 1 Eksamen 2024',
  'Wiskunde',
  'Graad 10',
  2024,
  'Kwartaal 1',
  'CAPS_MATH_G10_T1_AF',
  ARRAY['Algebra', 'Funksies', 'Getalpatrone'],
  'medium',
  '{
    "sections": [
      {
        "title": "Afdeling A: Algebra",
        "punte": 30,
        "vrae": [
          {
            "nommer": 1,
            "vraag": "Vereenvoudig: 3x + 5x - 2x",
            "punte": 2,
            "antwoord": "6x"
          }
        ]
      }
    ]
  }'::jsonb,
  100,
  120,
  'af-ZA'
);
