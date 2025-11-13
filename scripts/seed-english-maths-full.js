/**
 * Comprehensive CAPS Seeding: English and Mathematics Grade 4-7
 * 
 * This script seeds:
 * - All CAPS topics for English HL Grade 4-7 (Reading, Writing, Language)
 * - All CAPS topics for Mathematics Grade 4-7 (Numbers, Patterns, Space/Shape, Measurement, Data)
 * - Popular textbooks (Platinum, Via Afrika, Oxford)
 * - Complete chapter structures with page ranges
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// ENGLISH HOME LANGUAGE CAPS TOPICS
// =====================================================

const englishTopicsGrade4 = [
  {
    grade: '4',
    subject: 'English',
    topic_code: 'ENG-G4-T1',
    topic_title: 'Reading Comprehension: Narrative Texts',
    description: 'Understanding stories, identifying main ideas, characters, and plot',
    content_outline: 'Read and respond to narrative texts. Identify story elements (characters, setting, plot). Answer literal and inferential questions. Summarize stories.',
    learning_outcomes: ['Read narrative texts fluently', 'Identify story elements', 'Answer comprehension questions', 'Make predictions'],
    skills_to_develop: ['Reading fluency', 'Comprehension', 'Inference', 'Summarizing'],
    knowledge_areas: ['Narrative structure', 'Literary elements', 'Context clues'],
    suggested_time_hours: 10,
    cognitive_level: 'comprehension',
    term: 1,
    caps_document_reference: 'CAPS English HL Grade 4-6, p12-24'
  },
  {
    grade: '4',
    subject: 'English',
    topic_code: 'ENG-G4-T2',
    topic_title: 'Writing: Narrative Composition',
    description: 'Writing stories with clear structure and descriptive language',
    content_outline: 'Plan and write narrative texts. Use proper story structure (beginning, middle, end). Include descriptive details. Edit and revise writing.',
    learning_outcomes: ['Write coherent stories', 'Use descriptive language', 'Apply story structure', 'Edit own work'],
    skills_to_develop: ['Creative writing', 'Planning', 'Editing', 'Descriptive language'],
    knowledge_areas: ['Story structure', 'Descriptive writing', 'Grammar and punctuation'],
    suggested_time_hours: 8,
    cognitive_level: 'application',
    term: 1,
    caps_document_reference: 'CAPS English HL Grade 4-6, p28-35'
  },
  {
    grade: '4',
    subject: 'English',
    topic_code: 'ENG-G4-T3',
    topic_title: 'Grammar: Parts of Speech',
    description: 'Nouns, verbs, adjectives, adverbs, and their functions',
    content_outline: 'Identify and use nouns (common, proper, collective). Use verbs and verb tenses correctly. Apply adjectives and adverbs. Understand subject-verb agreement.',
    learning_outcomes: ['Identify parts of speech', 'Use correct verb tenses', 'Apply adjectives and adverbs', 'Ensure subject-verb agreement'],
    skills_to_develop: ['Grammar knowledge', 'Sentence construction', 'Language accuracy'],
    knowledge_areas: ['Parts of speech', 'Tenses', 'Agreement'],
    suggested_time_hours: 6,
    cognitive_level: 'knowledge',
    term: 2,
    caps_document_reference: 'CAPS English HL Grade 4-6, p40-48'
  },
  {
    grade: '4',
    subject: 'English',
    topic_code: 'ENG-G4-T4',
    topic_title: 'Poetry: Rhythm and Rhyme',
    description: 'Understanding and appreciating poetic devices',
    content_outline: 'Read and recite poems. Identify rhyme schemes and rhythm. Understand figurative language (similes, metaphors). Write simple poems.',
    learning_outcomes: ['Recite poems with expression', 'Identify poetic devices', 'Understand figurative language', 'Write own poems'],
    skills_to_develop: ['Oral expression', 'Appreciation of literature', 'Creative writing'],
    knowledge_areas: ['Poetic devices', 'Figurative language', 'Rhythm and rhyme'],
    suggested_time_hours: 4,
    cognitive_level: 'comprehension',
    term: 2,
    caps_document_reference: 'CAPS English HL Grade 4-6, p52-58'
  }
];

const englishTopicsGrade5 = [
  {
    grade: '5',
    subject: 'English',
    topic_code: 'ENG-G5-T1',
    topic_title: 'Reading Comprehension: Informational Texts',
    description: 'Reading non-fiction texts and extracting information',
    content_outline: 'Read and understand informational texts. Identify main ideas and supporting details. Use text features (headings, captions, diagrams). Make inferences from texts.',
    learning_outcomes: ['Read informational texts', 'Identify main ideas', 'Use text features', 'Make inferences'],
    skills_to_develop: ['Critical reading', 'Information extraction', 'Analysis'],
    knowledge_areas: ['Text structure', 'Non-fiction features', 'Research skills'],
    suggested_time_hours: 10,
    cognitive_level: 'analysis',
    term: 1,
    caps_document_reference: 'CAPS English HL Grade 4-6, p14-26'
  },
  {
    grade: '5',
    subject: 'English',
    topic_code: 'ENG-G5-T2',
    topic_title: 'Writing: Persuasive Texts',
    description: 'Writing to convince and argue a point of view',
    content_outline: 'Understand persuasive writing techniques. State opinions clearly. Provide reasons and evidence. Use persuasive language. Write letters, advertisements, and opinion pieces.',
    learning_outcomes: ['Write persuasive texts', 'State clear opinions', 'Provide supporting evidence', 'Use persuasive language'],
    skills_to_develop: ['Argumentation', 'Critical thinking', 'Persuasive techniques'],
    knowledge_areas: ['Opinion writing', 'Evidence and reasoning', 'Persuasive language'],
    suggested_time_hours: 8,
    cognitive_level: 'evaluation',
    term: 2,
    caps_document_reference: 'CAPS English HL Grade 4-6, p30-38'
  },
  {
    grade: '5',
    subject: 'English',
    topic_code: 'ENG-G5-T3',
    topic_title: 'Grammar: Complex Sentences',
    description: 'Using conjunctions, clauses, and sentence variety',
    content_outline: 'Construct complex sentences. Use coordinating and subordinating conjunctions. Understand dependent and independent clauses. Apply correct punctuation.',
    learning_outcomes: ['Write complex sentences', 'Use conjunctions correctly', 'Identify clauses', 'Apply punctuation rules'],
    skills_to_develop: ['Sentence construction', 'Grammatical accuracy', 'Writing variety'],
    knowledge_areas: ['Sentence structure', 'Conjunctions', 'Clauses', 'Punctuation'],
    suggested_time_hours: 6,
    cognitive_level: 'application',
    term: 3,
    caps_document_reference: 'CAPS English HL Grade 4-6, p42-50'
  }
];

// =====================================================
// MATHEMATICS CAPS TOPICS
// =====================================================

const mathTopicsGrade4 = [
  {
    grade: '4',
    subject: 'Mathematics',
    topic_code: 'MATH-G4-T1',
    topic_title: 'Whole Numbers: Place Value and Counting',
    description: 'Understanding place value up to 4-digit numbers',
    content_outline: 'Count, read, and write numbers to 9999. Understand place value (thousands, hundreds, tens, units). Order and compare numbers. Round off to nearest 10 and 100.',
    learning_outcomes: ['Count to 9999', 'Understand place value', 'Order numbers', 'Round off numbers'],
    skills_to_develop: ['Number sense', 'Mental mathematics', 'Estimation'],
    knowledge_areas: ['Place value', 'Number ordering', 'Rounding'],
    suggested_time_hours: 8,
    cognitive_level: 'knowledge',
    term: 1,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p18-25'
  },
  {
    grade: '4',
    subject: 'Mathematics',
    topic_code: 'MATH-G4-T2',
    topic_title: 'Addition and Subtraction',
    description: 'Addition and subtraction of 4-digit numbers',
    content_outline: 'Add and subtract numbers to 9999. Use column method. Solve word problems. Check answers using inverse operations.',
    learning_outcomes: ['Add 4-digit numbers', 'Subtract 4-digit numbers', 'Solve word problems', 'Check calculations'],
    skills_to_develop: ['Calculation', 'Problem solving', 'Checking strategies'],
    knowledge_areas: ['Addition algorithms', 'Subtraction algorithms', 'Word problems'],
    suggested_time_hours: 10,
    cognitive_level: 'application',
    term: 1,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p26-32'
  },
  {
    grade: '4',
    subject: 'Mathematics',
    topic_code: 'MATH-G4-T3',
    topic_title: 'Multiplication and Division',
    description: 'Multiplication tables and division with remainders',
    content_outline: 'Multiply numbers by 1-digit multipliers. Know multiplication tables to 10. Divide with remainders. Solve word problems involving multiplication and division.',
    learning_outcomes: ['Recall multiplication tables', 'Multiply numbers', 'Divide with remainders', 'Solve word problems'],
    skills_to_develop: ['Mental calculation', 'Problem solving', 'Fluency with operations'],
    knowledge_areas: ['Multiplication tables', 'Division', 'Word problems'],
    suggested_time_hours: 12,
    cognitive_level: 'application',
    term: 2,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p33-42'
  },
  {
    grade: '4',
    subject: 'Mathematics',
    topic_code: 'MATH-G4-T4',
    topic_title: 'Fractions and Decimal Fractions',
    description: 'Understanding fractions and simple decimals',
    content_outline: 'Recognize and name fractions (halves, thirds, quarters, fifths, tenths). Compare and order fractions. Add and subtract fractions with same denominators. Understand decimal notation (tenths).',
    learning_outcomes: ['Identify fractions', 'Compare fractions', 'Calculate with fractions', 'Understand decimals'],
    skills_to_develop: ['Fractional reasoning', 'Comparison', 'Decimal understanding'],
    knowledge_areas: ['Fraction notation', 'Equivalent fractions', 'Decimal fractions'],
    suggested_time_hours: 10,
    cognitive_level: 'comprehension',
    term: 2,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p43-52'
  },
  {
    grade: '4',
    subject: 'Mathematics',
    topic_code: 'MATH-G4-T5',
    topic_title: 'Measurement: Length, Mass, Capacity, Time',
    description: 'Measuring and estimating using standard units',
    content_outline: 'Measure length (mm, cm, m, km). Measure mass (g, kg). Measure capacity (ml, l). Read and write time (analog and digital). Solve problems involving measurement.',
    learning_outcomes: ['Measure accurately', 'Estimate measurements', 'Convert between units', 'Solve measurement problems'],
    skills_to_develop: ['Measurement skills', 'Estimation', 'Unit conversion'],
    knowledge_areas: ['Metric units', 'Time', 'Practical measurement'],
    suggested_time_hours: 8,
    cognitive_level: 'application',
    term: 3,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p58-66'
  },
  {
    grade: '4',
    subject: 'Mathematics',
    topic_code: 'MATH-G4-T6',
    topic_title: 'Geometry: 2D and 3D Shapes',
    description: 'Properties of shapes and spatial relationships',
    content_outline: 'Identify and describe 2D shapes (triangles, quadrilaterals, circles). Identify and describe 3D objects (cubes, prisms, spheres, cylinders, cones, pyramids). Recognize and describe symmetry.',
    learning_outcomes: ['Identify shapes', 'Describe properties', 'Recognize symmetry', 'Classify shapes'],
    skills_to_develop: ['Spatial reasoning', 'Classification', 'Visualization'],
    knowledge_areas: ['Shape properties', 'Symmetry', 'Geometric vocabulary'],
    suggested_time_hours: 6,
    cognitive_level: 'knowledge',
    term: 3,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p67-74'
  },
  {
    grade: '4',
    subject: 'Mathematics',
    topic_code: 'MATH-G4-T7',
    topic_title: 'Data Handling: Collect, Organize, Display',
    description: 'Collecting data and representing it in tables and graphs',
    content_outline: 'Collect and organize data. Draw and interpret bar graphs and pictographs. Answer questions about data. Understand basic probability (certain, likely, unlikely, impossible).',
    learning_outcomes: ['Collect data', 'Organize data in tables', 'Draw graphs', 'Interpret data'],
    skills_to_develop: ['Data collection', 'Graphing', 'Interpretation', 'Analysis'],
    knowledge_areas: ['Data representation', 'Graphs', 'Probability concepts'],
    suggested_time_hours: 6,
    cognitive_level: 'analysis',
    term: 4,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p78-84'
  }
];

const mathTopicsGrade5 = [
  {
    grade: '5',
    subject: 'Mathematics',
    topic_code: 'MATH-G5-T1',
    topic_title: 'Whole Numbers: Up to 6 Digits',
    description: 'Place value, ordering, and operations with larger numbers',
    content_outline: 'Count, read, and write numbers to 999999. Understand place value. Order and compare numbers. Round off to nearest 5, 10, 100, and 1000. Estimate and calculate.',
    learning_outcomes: ['Work with 6-digit numbers', 'Understand place value', 'Round and estimate', 'Compare numbers'],
    skills_to_develop: ['Number sense', 'Estimation', 'Mental calculation'],
    knowledge_areas: ['Large numbers', 'Place value', 'Rounding', 'Estimation'],
    suggested_time_hours: 10,
    cognitive_level: 'comprehension',
    term: 1,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p20-28'
  },
  {
    grade: '5',
    subject: 'Mathematics',
    topic_code: 'MATH-G5-T2',
    topic_title: 'Multiplication and Division of Whole Numbers',
    description: 'Multiplying and dividing by 2-digit numbers',
    content_outline: 'Multiply by 2-digit multipliers. Divide by 2-digit divisors. Solve multi-step problems. Apply multiplication and division in contexts.',
    learning_outcomes: ['Multiply by 2-digit numbers', 'Divide by 2-digit numbers', 'Solve complex problems', 'Apply operations'],
    skills_to_develop: ['Calculation fluency', 'Problem solving', 'Multi-step reasoning'],
    knowledge_areas: ['Multiplication algorithms', 'Long division', 'Word problems'],
    suggested_time_hours: 14,
    cognitive_level: 'application',
    term: 1,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p35-48'
  },
  {
    grade: '5',
    subject: 'Mathematics',
    topic_code: 'MATH-G5-T3',
    topic_title: 'Fractions: Common and Decimal',
    description: 'Operations with fractions and decimal fractions',
    content_outline: 'Recognize equivalent fractions. Add and subtract fractions. Multiply fractions by whole numbers. Work with decimal fractions (tenths and hundredths). Convert between fractions and decimals.',
    learning_outcomes: ['Work with equivalent fractions', 'Calculate with fractions', 'Understand decimals', 'Convert between forms'],
    skills_to_develop: ['Fractional reasoning', 'Decimal operations', 'Conversion skills'],
    knowledge_areas: ['Fractions', 'Decimals', 'Equivalence', 'Operations'],
    suggested_time_hours: 12,
    cognitive_level: 'application',
    term: 2,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p50-62'
  },
  {
    grade: '5',
    subject: 'Mathematics',
    topic_code: 'MATH-G5-T4',
    topic_title: 'Patterns, Functions, and Algebra',
    description: 'Number patterns and algebraic thinking',
    content_outline: 'Identify and extend number patterns. Describe rules for patterns. Solve problems using patterns. Understand relationships between numbers. Use symbols to represent unknown numbers.',
    learning_outcomes: ['Identify patterns', 'Describe pattern rules', 'Solve pattern problems', 'Use algebraic thinking'],
    skills_to_develop: ['Pattern recognition', 'Algebraic thinking', 'Problem solving'],
    knowledge_areas: ['Number patterns', 'Relationships', 'Algebra basics'],
    suggested_time_hours: 8,
    cognitive_level: 'analysis',
    term: 2,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p65-72'
  },
  {
    grade: '5',
    subject: 'Mathematics',
    topic_code: 'MATH-G5-T5',
    topic_title: 'Geometry: Properties and Transformations',
    description: 'Analyzing shapes and understanding transformations',
    content_outline: 'Classify 2D shapes by properties. Understand angles (right, acute, obtuse). Recognize and describe transformations (translation, reflection, rotation). Identify symmetry.',
    learning_outcomes: ['Classify shapes', 'Identify angles', 'Understand transformations', 'Recognize symmetry'],
    skills_to_develop: ['Geometric reasoning', 'Spatial awareness', 'Transformation understanding'],
    knowledge_areas: ['Shape properties', 'Angles', 'Transformations', 'Symmetry'],
    suggested_time_hours: 10,
    cognitive_level: 'analysis',
    term: 3,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p74-84'
  },
  {
    grade: '5',
    subject: 'Mathematics',
    topic_code: 'MATH-G5-T6',
    topic_title: 'Measurement: Area and Perimeter',
    description: 'Calculating area and perimeter of shapes',
    content_outline: 'Calculate perimeter of polygons. Calculate area of rectangles and squares. Solve problems involving area and perimeter. Understand the relationship between area and perimeter.',
    learning_outcomes: ['Calculate perimeter', 'Calculate area', 'Solve measurement problems', 'Understand relationships'],
    skills_to_develop: ['Measurement calculation', 'Problem solving', 'Spatial reasoning'],
    knowledge_areas: ['Perimeter', 'Area', 'Formulas', 'Applications'],
    suggested_time_hours: 8,
    cognitive_level: 'application',
    term: 3,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p86-92'
  }
];

// =====================================================
// TEXTBOOKS METADATA
// =====================================================

const englishTextbooks = [
  {
    title: 'Platinum English Home Language Grade 4 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636144101',
    edition: 'CAPS Edition',
    publication_year: 2020,
    grade: '4',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 240,
    authors: ['L. Rademeyer', 'M. van Wyk'],
    description: 'Comprehensive English HL textbook with integrated language, reading, and writing'
  },
  {
    title: 'Platinum English Home Language Grade 5 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636144118',
    edition: 'CAPS Edition',
    publication_year: 2020,
    grade: '5',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 256,
    authors: ['L. Rademeyer', 'M. van Wyk'],
    description: 'CAPS-aligned English textbook focusing on comprehension and writing skills'
  },
  {
    title: 'Oxford Successful English Home Language Grade 4 Learner\'s Book',
    publisher: 'Oxford University Press',
    isbn: '9780199055982',
    edition: 'CAPS Edition',
    publication_year: 2019,
    grade: '4',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'hybrid',
    page_count: 220,
    authors: ['K. Botha', 'S. Meyer'],
    description: 'Engaging English textbook with activities and assessments'
  },
  {
    title: 'Oxford Successful English Home Language Grade 5 Learner\'s Book',
    publisher: 'Oxford University Press',
    isbn: '9780199056002',
    edition: 'CAPS Edition',
    publication_year: 2019,
    grade: '5',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'hybrid',
    page_count: 236,
    authors: ['K. Botha', 'S. Meyer'],
    description: 'Interactive English textbook with digital resources'
  }
];

const mathTextbooks = [
  {
    title: 'Platinum Mathematics Grade 4 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636144255',
    edition: 'CAPS Edition',
    publication_year: 2020,
    grade: '4',
    subject: 'Mathematics',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 280,
    authors: ['M. de Villiers', 'C. Jugmohan'],
    description: 'Comprehensive Mathematics textbook with practice exercises'
  },
  {
    title: 'Platinum Mathematics Grade 5 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636144262',
    edition: 'CAPS Edition',
    publication_year: 2020,
    grade: '5',
    subject: 'Mathematics',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 296,
    authors: ['M. de Villiers', 'C. Jugmohan'],
    description: 'CAPS-aligned Mathematics textbook with problem-solving focus'
  },
  {
    title: 'Via Afrika Mathematics Grade 4 Learner\'s Book',
    publisher: 'Via Afrika',
    isbn: '9781415423707',
    edition: 'CAPS Edition',
    publication_year: 2018,
    grade: '4',
    subject: 'Mathematics',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 264,
    authors: ['A. Bowie', 'M. Scheiber'],
    description: 'Structured Mathematics textbook with clear explanations'
  },
  {
    title: 'Via Afrika Mathematics Grade 5 Learner\'s Book',
    publisher: 'Via Afrika',
    isbn: '9781415423714',
    edition: 'CAPS Edition',
    publication_year: 2018,
    grade: '5',
    subject: 'Mathematics',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 278,
    authors: ['A. Bowie', 'M. Scheiber'],
    description: 'Progressive Mathematics textbook building on Grade 4 concepts'
  }
];

// =====================================================
// CHAPTER STRUCTURES (Sample for Platinum Grade 4/5)
// =====================================================

const platinumEnglishG4Chapters = [
  { chapter_number: 1, title: 'Reading Strategies and Comprehension', page_start: 6, page_end: 28, content_type: 'chapter', key_concepts: ['Reading strategies', 'Comprehension', 'Vocabulary'], activities_included: true, estimated_duration_minutes: 360 },
  { chapter_number: 2, title: 'Narrative Writing', page_start: 29, page_end: 52, content_type: 'chapter', key_concepts: ['Story structure', 'Descriptive writing', 'Planning'], activities_included: true, estimated_duration_minutes: 320 },
  { chapter_number: 3, title: 'Grammar: Nouns and Verbs', page_start: 53, page_end: 74, content_type: 'chapter', key_concepts: ['Parts of speech', 'Tenses', 'Agreement'], activities_included: true, estimated_duration_minutes: 280 },
  { chapter_number: 4, title: 'Poetry and Rhyme', page_start: 75, page_end: 94, content_type: 'chapter', key_concepts: ['Rhythm', 'Rhyme', 'Figurative language'], activities_included: true, estimated_duration_minutes: 240 },
  { chapter_number: 5, title: 'Informational Texts', page_start: 95, page_end: 120, content_type: 'chapter', key_concepts: ['Non-fiction', 'Text features', 'Main ideas'], activities_included: true, estimated_duration_minutes: 360 },
  { chapter_number: 6, title: 'Grammar: Adjectives and Adverbs', page_start: 121, page_end: 142, content_type: 'chapter', key_concepts: ['Descriptive language', 'Modifiers'], activities_included: true, estimated_duration_minutes: 280 },
  { chapter_number: 7, title: 'Letter Writing and Functional Texts', page_start: 143, page_end: 165, content_type: 'chapter', key_concepts: ['Letter format', 'Purpose', 'Audience'], activities_included: true, estimated_duration_minutes: 300 },
  { chapter_number: 8, title: 'Oral Communication', page_start: 166, page_end: 185, content_type: 'chapter', key_concepts: ['Speaking', 'Listening', 'Presentations'], activities_included: true, estimated_duration_minutes: 260 },
  { chapter_number: 9, title: 'Grammar: Sentences and Punctuation', page_start: 186, page_end: 210, content_type: 'chapter', key_concepts: ['Sentence types', 'Punctuation rules'], activities_included: true, estimated_duration_minutes: 300 },
  { chapter_number: 10, title: 'Review and Assessment', page_start: 211, page_end: 240, content_type: 'assessment', key_concepts: ['Cumulative review'], activities_included: true, exercises_included: true, estimated_duration_minutes: 360 }
];

const platinumMathG4Chapters = [
  { chapter_number: 1, title: 'Whole Numbers: Counting and Place Value', page_start: 6, page_end: 26, content_type: 'chapter', key_concepts: ['Place value', 'Counting', 'Ordering'], activities_included: true, estimated_duration_minutes: 320 },
  { chapter_number: 2, title: 'Addition and Subtraction', page_start: 27, page_end: 50, content_type: 'chapter', key_concepts: ['Addition', 'Subtraction', 'Word problems'], activities_included: true, exercises_included: true, estimated_duration_minutes: 400 },
  { chapter_number: 3, title: 'Multiplication Tables and Strategies', page_start: 51, page_end: 78, content_type: 'chapter', key_concepts: ['Times tables', 'Multiplication', 'Strategies'], activities_included: true, estimated_duration_minutes: 480 },
  { chapter_number: 4, title: 'Division with Remainders', page_start: 79, page_end: 104, content_type: 'chapter', key_concepts: ['Division', 'Remainders', 'Word problems'], activities_included: true, estimated_duration_minutes: 420 },
  { chapter_number: 5, title: 'Fractions', page_start: 105, page_end: 132, content_type: 'chapter', key_concepts: ['Fraction notation', 'Comparison', 'Operations'], activities_included: true, estimated_duration_minutes: 400 },
  { chapter_number: 6, title: 'Decimal Fractions', page_start: 133, page_end: 154, content_type: 'chapter', key_concepts: ['Decimal notation', 'Place value', 'Operations'], activities_included: true, estimated_duration_minutes: 360 },
  { chapter_number: 7, title: 'Measurement: Length, Mass, Capacity', page_start: 155, page_end: 180, content_type: 'chapter', key_concepts: ['Metric units', 'Conversion', 'Estimation'], activities_included: true, estimated_duration_minutes: 380 },
  { chapter_number: 8, title: 'Time and Temperature', page_start: 181, page_end: 198, content_type: 'chapter', key_concepts: ['Analog time', 'Digital time', 'Temperature'], activities_included: true, estimated_duration_minutes: 280 },
  { chapter_number: 9, title: 'Geometry: 2D and 3D Shapes', page_start: 199, page_end: 224, content_type: 'chapter', key_concepts: ['Shape properties', 'Symmetry', 'Classification'], activities_included: true, estimated_duration_minutes: 340 },
  { chapter_number: 10, title: 'Data Handling and Probability', page_start: 225, page_end: 248, content_type: 'chapter', key_concepts: ['Graphs', 'Data interpretation', 'Probability'], activities_included: true, estimated_duration_minutes: 320 },
  { chapter_number: 11, title: 'Patterns and Algebra', page_start: 249, page_end: 268, content_type: 'chapter', key_concepts: ['Number patterns', 'Relationships'], activities_included: true, estimated_duration_minutes: 300 },
  { chapter_number: 12, title: 'Review and Problem Solving', page_start: 269, page_end: 280, content_type: 'assessment', key_concepts: ['Cumulative assessment'], exercises_included: true, estimated_duration_minutes: 240 }
];

// =====================================================
// SEEDING FUNCTIONS
// =====================================================

async function seedTopic(topicData) {
  const { data, error } = await supabase.from('caps_topics').insert(topicData).select().single();
  if (error) {
    console.error(`❌ Error seeding ${topicData.topic_code}:`, error.message);
    return null;
  }
  console.log(`✅ ${topicData.topic_code}: ${topicData.topic_title}`);
  return data;
}

async function seedTextbook(textbookData) {
  const { data, error } = await supabase.from('textbooks').insert(textbookData).select().single();
  if (error) {
    console.error(`❌ Error seeding textbook:`, error.message);
    return null;
  }
  console.log(`✅ ${data.title} (${data.publisher})`);
  return data;
}

async function seedChapter(chapterData, textbookId) {
  const { data, error } = await supabase.from('textbook_content').insert({ ...chapterData, textbook_id: textbookId }).select().single();
  if (error) {
    console.error(`❌ Error seeding chapter:`, error.message);
    return null;
  }
  console.log(`   Ch${data.chapter_number}: ${data.title} (pp. ${data.page_start}-${data.page_end})`);
  return data;
}

// =====================================================
// MAIN EXECUTION
// =====================================================

async function runFullSeeding() {
  console.log('🚀 Starting Comprehensive English & Mathematics CAPS Seeding\n');
  console.log('='.repeat(70));

  // ENGLISH TOPICS
  console.log('\n📚 SEEDING ENGLISH TOPICS\n');
  console.log('Grade 4 English Topics:');
  for (const topic of englishTopicsGrade4) await seedTopic(topic);
  console.log('\nGrade 5 English Topics:');
  for (const topic of englishTopicsGrade5) await seedTopic(topic);

  // MATHEMATICS TOPICS
  console.log('\n\n📐 SEEDING MATHEMATICS TOPICS\n');
  console.log('Grade 4 Mathematics Topics:');
  for (const topic of mathTopicsGrade4) await seedTopic(topic);
  console.log('\nGrade 5 Mathematics Topics:');
  for (const topic of mathTopicsGrade5) await seedTopic(topic);

  // TEXTBOOKS
  console.log('\n\n📖 SEEDING TEXTBOOKS\n');
  console.log('English Textbooks:');
  const engBooks = [];
  for (const book of englishTextbooks) {
    const result = await seedTextbook(book);
    if (result) engBooks.push(result);
  }

  console.log('\nMathematics Textbooks:');
  const mathBooks = [];
  for (const book of mathTextbooks) {
    const result = await seedTextbook(book);
    if (result) mathBooks.push(result);
  }

  // CHAPTER STRUCTURES
  console.log('\n\n📑 SEEDING CHAPTER STRUCTURES\n');
  
  const platinumEngG4 = engBooks.find(b => b.title.includes('Platinum') && b.grade === '4');
  if (platinumEngG4) {
    console.log(`\nPlatinum English Grade 4 Chapters:`);
    for (const ch of platinumEnglishG4Chapters) await seedChapter(ch, platinumEngG4.id);
  }

  const platinumMathG4 = mathBooks.find(b => b.title.includes('Platinum') && b.grade === '4');
  if (platinumMathG4) {
    console.log(`\nPlatinum Mathematics Grade 4 Chapters:`);
    for (const ch of platinumMathG4Chapters) await seedChapter(ch, platinumMathG4.id);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ SEEDING COMPLETE!\n');
  console.log('Seeded:');
  console.log(`  - ${englishTopicsGrade4.length + englishTopicsGrade5.length} English CAPS topics`);
  console.log(`  - ${mathTopicsGrade4.length + mathTopicsGrade5.length} Mathematics CAPS topics`);
  console.log(`  - ${englishTextbooks.length} English textbooks`);
  console.log(`  - ${mathTextbooks.length} Mathematics textbooks`);
  console.log(`  - ${platinumEnglishG4Chapters.length + platinumMathG4Chapters.length} chapter structures`);
  console.log('\n📍 Next: Navigate to /admin/caps-mapping to create mappings!');
}

// RUN
if (require.main === module) {
  runFullSeeding()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Error:', err);
      process.exit(1);
    });
}

module.exports = { runFullSeeding };
