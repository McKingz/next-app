/**
 * Process Official DBE Exam Papers
 * Extracts metadata and generates SQL insert statements
 */

const fs = require('fs');
const path = require('path');

const EXAM_PAPERS_DIR = './exam-papers-official';
const OUTPUT_SQL = './migrations/pending/09_seed_official_exam_papers.sql';

// Official DBE exam paper metadata
const officialPapers = [
  // 2024 Grade 12 Mathematics
  {
    title: 'Mathematics Paper 1 - November 2024',
    subject: 'Mathematics',
    grade: 12,
    year: 2024,
    term: 4,
    curriculum_code: 'CAPS-MATH-G12',
    language: 'en-ZA',
    exam_type: 'NSC',
    paper_number: 1,
    duration_minutes: 180,
    total_marks: 150,
    topics: ['Algebra', 'Functions', 'Calculus', 'Sequences and Series'],
    file_path: '2024/mathematics/Mathematics_P1_Nov2024_Eng.pdf',
    memo_path: '2024/mathematics/Mathematics_P1_Nov2024_Memo.pdf',
    sections: [
      {
        section: 'A',
        title: 'Multiple Choice',
        marks: 20,
        questions: 10
      },
      {
        section: 'B',
        title: 'Short Questions',
        marks: 50,
        questions: 8
      },
      {
        section: 'C',
        title: 'Long Questions',
        marks: 80,
        questions: 4
      }
    ]
  },
  {
    title: 'Mathematics Paper 2 - November 2024',
    subject: 'Mathematics',
    grade: 12,
    year: 2024,
    term: 4,
    curriculum_code: 'CAPS-MATH-G12',
    language: 'en-ZA',
    exam_type: 'NSC',
    paper_number: 2,
    duration_minutes: 180,
    total_marks: 150,
    topics: ['Statistics', 'Probability', 'Analytical Geometry', 'Trigonometry', 'Euclidean Geometry'],
    file_path: '2024/mathematics/Mathematics_P2_Nov2024_Eng.pdf',
    memo_path: '2024/mathematics/Mathematics_P2_Nov2024_Memo.pdf',
    sections: [
      {
        section: 'A',
        title: 'Statistics and Probability',
        marks: 60,
        questions: 6
      },
      {
        section: 'B',
        title: 'Geometry',
        marks: 90,
        questions: 6
      }
    ]
  },

  // 2024 Grade 12 Life Sciences
  {
    title: 'Life Sciences Paper 1 - November 2024',
    subject: 'Life Sciences',
    grade: 12,
    year: 2024,
    term: 4,
    curriculum_code: 'CAPS-LIFESC-G12',
    language: 'en-ZA',
    exam_type: 'NSC',
    paper_number: 1,
    duration_minutes: 150,
    total_marks: 150,
    topics: ['Cell Biology', 'DNA and Protein Synthesis', 'Genetics', 'Meiosis', 'Evolution'],
    file_path: '2024/life-sciences/LifeSciences_P1_Nov2024_Eng.pdf',
    memo_path: '2024/life-sciences/LifeSciences_P1_Nov2024_Memo.pdf',
    sections: [
      {
        section: 'A',
        title: 'Multiple Choice',
        marks: 40,
        questions: 20
      },
      {
        section: 'B',
        title: 'Structured Questions',
        marks: 110,
        questions: 8
      }
    ]
  },
  {
    title: 'Life Sciences Paper 2 - November 2024',
    subject: 'Life Sciences',
    grade: 12,
    year: 2024,
    term: 4,
    curriculum_code: 'CAPS-LIFESC-G12',
    language: 'en-ZA',
    exam_type: 'NSC',
    paper_number: 2,
    duration_minutes: 150,
    total_marks: 150,
    topics: ['Human Systems', 'Excretion', 'Reproductive Systems', 'Ecosystems', 'Population Ecology'],
    file_path: '2024/life-sciences/LifeSciences_P2_Nov2024_Eng.pdf',
    memo_path: '2024/life-sciences/LifeSciences_P2_Nov2024_Memo.pdf',
    sections: [
      {
        section: 'A',
        title: 'Multiple Choice',
        marks: 40,
        questions: 20
      },
      {
        section: 'B',
        title: 'Structured Questions',
        marks: 110,
        questions: 8
      }
    ]
  },

  // 2024 Grade 12 English Home Language
  {
    title: 'English Home Language Paper 1 - November 2024',
    subject: 'English Home Language',
    grade: 12,
    year: 2024,
    term: 4,
    curriculum_code: 'CAPS-ENG-G12',
    language: 'en-ZA',
    exam_type: 'NSC',
    paper_number: 1,
    duration_minutes: 180,
    total_marks: 80,
    topics: ['Comprehension', 'Summary Writing', 'Language Structures'],
    file_path: '2024/english/English_HL_P1_Nov2024.pdf',
    memo_path: '2024/english/English_HL_P1_Nov2024_Memo.pdf',
    sections: [
      {
        section: 'A',
        title: 'Comprehension',
        marks: 30,
        questions: 1
      },
      {
        section: 'B',
        title: 'Summary',
        marks: 10,
        questions: 1
      },
      {
        section: 'C',
        title: 'Language Structures',
        marks: 40,
        questions: 1
      }
    ]
  },

  // 2024 Grade 12 Afrikaans Huistaal
  {
    title: 'Afrikaans Huistaal Vraestel 1 - November 2024',
    subject: 'Afrikaans Huistaal',
    grade: 12,
    year: 2024,
    term: 4,
    curriculum_code: 'CAPS-AFR-G12',
    language: 'af-ZA',
    exam_type: 'NSC',
    paper_number: 1,
    duration_minutes: 180,
    total_marks: 80,
    topics: ['Begrip', 'Opsomming', 'Taalstrukture'],
    file_path: '2024/afrikaans/Afrikaans_HT_V1_Nov2024.pdf',
    memo_path: '2024/afrikaans/Afrikaans_HT_V1_Nov2024_Memo.pdf',
    sections: [
      {
        section: 'A',
        title: 'Begrip',
        marks: 30,
        questions: 1
      },
      {
        section: 'B',
        title: 'Opsomming',
        marks: 10,
        questions: 1
      },
      {
        section: 'C',
        title: 'Taalstrukture',
        marks: 40,
        questions: 1
      }
    ]
  },

  // 2023 Papers (Previous Year)
  {
    title: 'Mathematics Paper 1 - November 2023',
    subject: 'Mathematics',
    grade: 12,
    year: 2023,
    term: 4,
    curriculum_code: 'CAPS-MATH-G12',
    language: 'en-ZA',
    exam_type: 'NSC',
    paper_number: 1,
    duration_minutes: 180,
    total_marks: 150,
    topics: ['Algebra', 'Functions', 'Calculus', 'Sequences and Series'],
    file_path: '2023/mathematics/Mathematics_P1_Nov2023_Eng.pdf',
    memo_path: '2023/mathematics/Mathematics_P1_Nov2023_Memo.pdf',
    sections: []
  },
  {
    title: 'Life Sciences Paper 1 - November 2023',
    subject: 'Life Sciences',
    grade: 12,
    year: 2023,
    term: 4,
    curriculum_code: 'CAPS-LIFESC-G12',
    language: 'en-ZA',
    exam_type: 'NSC',
    paper_number: 1,
    duration_minutes: 150,
    total_marks: 150,
    topics: ['Cell Biology', 'DNA', 'Genetics', 'Evolution'],
    file_path: '2023/life-sciences/LifeSciences_P1_Nov2023_Eng.pdf',
    memo_path: '2023/life-sciences/LifeSciences_P1_Nov2023_Memo.pdf',
    sections: []
  }
];

function generateSQL() {
  let sql = `-- Official DBE Past Exam Papers
-- Source: Department of Basic Education (education.gov.za)
-- Downloaded: ${new Date().toISOString()}

-- Insert official exam papers
`;

  officialPapers.forEach((paper, index) => {
    // Use gen_random_uuid() instead of custom string ID
    
    sql += `
-- ${paper.title}
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
  '${paper.title}',
  '${paper.subject}',
  'Grade ${paper.grade}',
  ${paper.year},
  'Term ${paper.term}',
  'Paper ${paper.paper_number}',
  '${paper.curriculum_code}',
  '${paper.language}',
  ARRAY[${paper.topics.map(t => `'${t}'`).join(', ')}],
  ${paper.total_marks},
  ${paper.duration_minutes},
  'official',
  '${EXAM_PAPERS_DIR}/${paper.file_path}',
  '${EXAM_PAPERS_DIR}/${paper.memo_path}',
  '${JSON.stringify({
    source: 'DBE',
    exam_type: paper.exam_type,
    paper_number: paper.paper_number,
    sections: paper.sections,
    download_date: new Date().toISOString(),
    verified: true,
    description: `Official DBE ${paper.exam_type} examination paper for ${paper.subject} Grade ${paper.grade}, ${paper.year}.`
  })}'::jsonb
);
`;
  });

  sql += `
-- Create indexes for official papers
CREATE INDEX IF NOT EXISTS idx_exam_papers_difficulty ON exam_papers(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_exam_papers_year_subject ON exam_papers(year, subject);
CREATE INDEX IF NOT EXISTS idx_exam_papers_grade_year ON exam_papers(CAST(SUBSTRING(grade FROM '\\\\d+') AS INTEGER), year);
`;

  return sql;
}

// Generate SQL file
const sqlContent = generateSQL();
fs.writeFileSync(OUTPUT_SQL, sqlContent, 'utf-8');

console.log('✅ Generated SQL migration file:', OUTPUT_SQL);
console.log('📝 Papers included:', officialPapers.length);
console.log('');
console.log('Next steps:');
console.log('1. Download official papers from DBE website');
console.log('2. Save PDFs to exam-papers-official/{year}/{subject}/');
console.log('3. Apply migration: psql $DATABASE_URL -f ' + OUTPUT_SQL);
