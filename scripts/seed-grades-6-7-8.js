/**
 * CAPS Seeding: English & Mathematics Grade 6-7, Life Orientation Grade 8
 * 
 * Extends the curriculum database with:
 * - English HL Grade 6-7 topics
 * - Mathematics Grade 6-7 topics
 * - Life Orientation Grade 8 topics (Senior Phase)
 * - Textbooks and complete chapter structures
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
// ENGLISH HOME LANGUAGE GRADE 6-7 TOPICS
// =====================================================

const englishTopicsGrade6 = [
  {
    grade: '6',
    subject: 'English',
    topic_code: 'ENG-G6-T1',
    topic_title: 'Reading Comprehension: Literary Analysis',
    description: 'Analyzing literary texts, identifying themes, and understanding author\'s purpose',
    content_outline: 'Read and analyze fiction and non-fiction texts. Identify themes, mood, and tone. Understand author\'s purpose and point of view. Make inferences and draw conclusions. Compare different texts.',
    learning_outcomes: ['Analyze literary texts', 'Identify themes and tone', 'Understand author\'s purpose', 'Compare texts'],
    skills_to_develop: ['Literary analysis', 'Critical thinking', 'Textual comparison', 'Inference'],
    knowledge_areas: ['Literary elements', 'Author\'s craft', 'Text structure', 'Theme analysis'],
    suggested_time_hours: 12,
    cognitive_level: 'analysis',
    term: 1,
    caps_document_reference: 'CAPS English HL Grade 4-6, p16-28'
  },
  {
    grade: '6',
    subject: 'English',
    topic_code: 'ENG-G6-T2',
    topic_title: 'Writing: Expository and Argumentative',
    description: 'Writing to inform and persuade with structured arguments',
    content_outline: 'Plan and write expository texts. Develop argumentative essays. Use evidence and examples. Structure introduction, body, and conclusion. Use transitions and linking words. Edit for clarity and coherence.',
    learning_outcomes: ['Write expository texts', 'Construct arguments', 'Use evidence effectively', 'Structure essays logically'],
    skills_to_develop: ['Expository writing', 'Argumentation', 'Organization', 'Evidence use'],
    knowledge_areas: ['Essay structure', 'Argument development', 'Evidence and examples', 'Academic writing'],
    suggested_time_hours: 10,
    cognitive_level: 'evaluation',
    term: 2,
    caps_document_reference: 'CAPS English HL Grade 4-6, p32-42'
  },
  {
    grade: '6',
    subject: 'English',
    topic_code: 'ENG-G6-T3',
    topic_title: 'Grammar: Advanced Sentence Structure',
    description: 'Complex and compound-complex sentences, active and passive voice',
    content_outline: 'Construct complex and compound-complex sentences. Use active and passive voice appropriately. Apply advanced punctuation (semicolons, colons, dashes). Understand sentence variety for style.',
    learning_outcomes: ['Write complex sentences', 'Use voice correctly', 'Apply advanced punctuation', 'Vary sentence structure'],
    skills_to_develop: ['Advanced grammar', 'Stylistic writing', 'Sentence variety', 'Punctuation mastery'],
    knowledge_areas: ['Sentence types', 'Voice', 'Advanced punctuation', 'Writing style'],
    suggested_time_hours: 8,
    cognitive_level: 'application',
    term: 3,
    caps_document_reference: 'CAPS English HL Grade 4-6, p46-54'
  },
  {
    grade: '6',
    subject: 'English',
    topic_code: 'ENG-G6-T4',
    topic_title: 'Literature: Novel Study and Analysis',
    description: 'In-depth study of a novel, character development, and plot analysis',
    content_outline: 'Read and analyze a complete novel. Study character development and motivation. Analyze plot structure and conflict. Understand setting and its impact. Discuss themes and moral lessons.',
    learning_outcomes: ['Analyze novels', 'Study character development', 'Understand plot structure', 'Identify themes'],
    skills_to_develop: ['Literary analysis', 'Character study', 'Plot analysis', 'Theme identification'],
    knowledge_areas: ['Novel structure', 'Character analysis', 'Plot elements', 'Literary themes'],
    suggested_time_hours: 10,
    cognitive_level: 'analysis',
    term: 4,
    caps_document_reference: 'CAPS English HL Grade 4-6, p58-68'
  }
];

const englishTopicsGrade7 = [
  {
    grade: '7',
    subject: 'English',
    topic_code: 'ENG-G7-T1',
    topic_title: 'Reading: Critical Analysis and Evaluation',
    description: 'Critical reading, evaluating arguments, and analyzing media texts',
    content_outline: 'Read critically and evaluate texts. Analyze arguments and identify bias. Evaluate credibility of sources. Understand persuasive techniques in media. Compare multiple perspectives on issues.',
    learning_outcomes: ['Read critically', 'Evaluate arguments', 'Identify bias', 'Analyze media texts'],
    skills_to_develop: ['Critical reading', 'Evaluation', 'Media literacy', 'Bias detection'],
    knowledge_areas: ['Critical analysis', 'Argumentation', 'Media techniques', 'Source evaluation'],
    suggested_time_hours: 12,
    cognitive_level: 'evaluation',
    term: 1,
    caps_document_reference: 'CAPS English HL Grade 7-9, p18-30'
  },
  {
    grade: '7',
    subject: 'English',
    topic_code: 'ENG-G7-T2',
    topic_title: 'Writing: Research and Essay Writing',
    description: 'Research skills, academic writing, and essay composition',
    content_outline: 'Conduct research using multiple sources. Take notes and organize information. Write academic essays with proper citations. Develop thesis statements. Use formal academic language. Revise and edit for academic standards.',
    learning_outcomes: ['Conduct research', 'Write academic essays', 'Cite sources', 'Use formal language'],
    skills_to_develop: ['Research skills', 'Academic writing', 'Citation', 'Formal language'],
    knowledge_areas: ['Research methods', 'Essay writing', 'Academic conventions', 'Citation formats'],
    suggested_time_hours: 14,
    cognitive_level: 'synthesis',
    term: 2,
    caps_document_reference: 'CAPS English HL Grade 7-9, p34-46'
  },
  {
    grade: '7',
    subject: 'English',
    topic_code: 'ENG-G7-T3',
    topic_title: 'Grammar: Language Conventions and Style',
    description: 'Advanced grammar, style, and language use',
    content_outline: 'Master complex grammar rules. Understand stylistic choices. Use figurative language effectively. Apply formal and informal registers. Understand language change and variation.',
    learning_outcomes: ['Master grammar conventions', 'Use style effectively', 'Apply registers appropriately', 'Understand language variation'],
    skills_to_develop: ['Grammar mastery', 'Stylistic awareness', 'Register use', 'Language analysis'],
    knowledge_areas: ['Grammar rules', 'Style', 'Register', 'Language variation'],
    suggested_time_hours: 8,
    cognitive_level: 'application',
    term: 3,
    caps_document_reference: 'CAPS English HL Grade 7-9, p50-58'
  },
  {
    grade: '7',
    subject: 'English',
    topic_code: 'ENG-G7-T4',
    topic_title: 'Literature: Drama and Shakespeare',
    description: 'Study of dramatic texts, Shakespeare, and performance',
    content_outline: 'Read and analyze dramatic texts. Study Shakespeare\'s language and themes. Understand dramatic structure and conventions. Analyze character and dialogue. Discuss performance aspects.',
    learning_outcomes: ['Analyze dramatic texts', 'Understand Shakespeare', 'Study dramatic structure', 'Analyze character'],
    skills_to_develop: ['Drama analysis', 'Shakespearean language', 'Performance understanding', 'Character analysis'],
    knowledge_areas: ['Dramatic structure', 'Shakespeare', 'Performance elements', 'Dramatic conventions'],
    suggested_time_hours: 12,
    cognitive_level: 'analysis',
    term: 4,
    caps_document_reference: 'CAPS English HL Grade 7-9, p62-74'
  }
];

// =====================================================
// MATHEMATICS GRADE 6-7 TOPICS
// =====================================================

const mathTopicsGrade6 = [
  {
    grade: '6',
    subject: 'Mathematics',
    topic_code: 'MATH-G6-T1',
    topic_title: 'Numbers and Operations: Integers',
    description: 'Working with positive and negative integers',
    content_outline: 'Understand integers and number line. Add and subtract integers. Multiply and divide integers. Order and compare integers. Solve integer word problems.',
    learning_outcomes: ['Work with integers', 'Perform integer operations', 'Solve integer problems', 'Understand number line'],
    skills_to_develop: ['Integer operations', 'Number sense', 'Problem solving'],
    knowledge_areas: ['Integers', 'Operations', 'Number line', 'Word problems'],
    suggested_time_hours: 12,
    cognitive_level: 'application',
    term: 1,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p22-32'
  },
  {
    grade: '6',
    subject: 'Mathematics',
    topic_code: 'MATH-G6-T2',
    topic_title: 'Fractions, Decimals, and Percentages',
    description: 'Conversions and operations with fractions, decimals, and percentages',
    content_outline: 'Convert between fractions, decimals, and percentages. Perform operations with decimals. Calculate percentages. Solve problems involving discounts, interest, and ratios. Understand proportions.',
    learning_outcomes: ['Convert between forms', 'Calculate with decimals', 'Work with percentages', 'Solve proportion problems'],
    skills_to_develop: ['Conversion skills', 'Decimal operations', 'Percentage calculations', 'Proportional reasoning'],
    knowledge_areas: ['Fractions', 'Decimals', 'Percentages', 'Proportions'],
    suggested_time_hours: 14,
    cognitive_level: 'application',
    term: 2,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p38-54'
  },
  {
    grade: '6',
    subject: 'Mathematics',
    topic_code: 'MATH-G6-T3',
    topic_title: 'Algebra: Expressions and Equations',
    description: 'Introduction to algebraic thinking and equations',
    content_outline: 'Understand variables and expressions. Simplify algebraic expressions. Solve simple linear equations. Use algebra to solve word problems. Understand order of operations with algebra.',
    learning_outcomes: ['Work with expressions', 'Solve equations', 'Use algebra for problems', 'Apply order of operations'],
    skills_to_develop: ['Algebraic thinking', 'Equation solving', 'Problem solving', 'Abstract reasoning'],
    knowledge_areas: ['Algebra basics', 'Expressions', 'Equations', 'Problem solving'],
    suggested_time_hours: 10,
    cognitive_level: 'application',
    term: 2,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p68-78'
  },
  {
    grade: '6',
    subject: 'Mathematics',
    topic_code: 'MATH-G6-T4',
    topic_title: 'Geometry: Properties and Constructions',
    description: 'Geometric properties, constructions, and angle relationships',
    content_outline: 'Study properties of triangles and quadrilaterals. Construct geometric figures using compass and ruler. Understand angle relationships. Calculate angles in polygons. Understand congruence and similarity.',
    learning_outcomes: ['Identify geometric properties', 'Construct figures', 'Calculate angles', 'Understand congruence'],
    skills_to_develop: ['Geometric reasoning', 'Construction skills', 'Angle calculation', 'Spatial awareness'],
    knowledge_areas: ['Geometry', 'Constructions', 'Angles', 'Congruence'],
    suggested_time_hours: 10,
    cognitive_level: 'application',
    term: 3,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p88-102'
  },
  {
    grade: '6',
    subject: 'Mathematics',
    topic_code: 'MATH-G6-T5',
    topic_title: 'Data Handling: Statistics and Probability',
    description: 'Data collection, analysis, and probability concepts',
    content_outline: 'Collect and organize data. Calculate mean, median, mode, and range. Draw and interpret graphs. Understand probability as fractions. Conduct probability experiments.',
    learning_outcomes: ['Analyze data', 'Calculate statistics', 'Interpret graphs', 'Understand probability'],
    skills_to_develop: ['Data analysis', 'Statistical thinking', 'Graphing', 'Probability reasoning'],
    knowledge_areas: ['Statistics', 'Graphs', 'Probability', 'Data interpretation'],
    suggested_time_hours: 8,
    cognitive_level: 'analysis',
    term: 4,
    caps_document_reference: 'CAPS Mathematics Grade 4-6, p106-116'
  }
];

const mathTopicsGrade7 = [
  {
    grade: '7',
    subject: 'Mathematics',
    topic_code: 'MATH-G7-T1',
    topic_title: 'Rational Numbers',
    description: 'Operations with fractions, decimals, and rational numbers',
    content_outline: 'Work with rational numbers. Perform all operations with fractions. Calculate with decimals to 3 places. Understand rational number properties. Solve complex word problems.',
    learning_outcomes: ['Master rational numbers', 'Perform operations fluently', 'Solve complex problems', 'Understand number properties'],
    skills_to_develop: ['Rational number fluency', 'Problem solving', 'Number sense'],
    knowledge_areas: ['Rational numbers', 'Operations', 'Properties', 'Applications'],
    suggested_time_hours: 14,
    cognitive_level: 'application',
    term: 1,
    caps_document_reference: 'CAPS Mathematics Grade 7-9, p24-38'
  },
  {
    grade: '7',
    subject: 'Mathematics',
    topic_code: 'MATH-G7-T2',
    topic_title: 'Algebra: Linear Equations',
    description: 'Solving and graphing linear equations',
    content_outline: 'Solve linear equations in one variable. Understand inequalities. Graph linear equations on Cartesian plane. Use algebra in real-world contexts. Solve systems of simple equations.',
    learning_outcomes: ['Solve linear equations', 'Graph equations', 'Work with inequalities', 'Apply algebra'],
    skills_to_develop: ['Algebraic manipulation', 'Graphing', 'Problem solving', 'Abstract reasoning'],
    knowledge_areas: ['Linear equations', 'Graphs', 'Inequalities', 'Applications'],
    suggested_time_hours: 12,
    cognitive_level: 'application',
    term: 2,
    caps_document_reference: 'CAPS Mathematics Grade 7-9, p44-58'
  },
  {
    grade: '7',
    subject: 'Mathematics',
    topic_code: 'MATH-G7-T3',
    topic_title: 'Geometry: Triangles and Circles',
    description: 'Properties of triangles, circles, and geometric theorems',
    content_outline: 'Study triangle properties and congruence. Understand circle properties. Apply Pythagoras theorem. Calculate perimeter and area of complex shapes. Understand geometric proofs.',
    learning_outcomes: ['Apply triangle theorems', 'Work with circles', 'Use Pythagoras', 'Calculate complex areas'],
    skills_to_develop: ['Geometric reasoning', 'Theorem application', 'Problem solving', 'Spatial reasoning'],
    knowledge_areas: ['Triangles', 'Circles', 'Pythagoras', 'Geometric proofs'],
    suggested_time_hours: 12,
    cognitive_level: 'application',
    term: 3,
    caps_document_reference: 'CAPS Mathematics Grade 7-9, p66-82'
  },
  {
    grade: '7',
    subject: 'Mathematics',
    topic_code: 'MATH-G7-T4',
    topic_title: 'Data Handling: Advanced Statistics',
    description: 'Statistical analysis, probability, and data interpretation',
    content_outline: 'Collect and organize complex data sets. Calculate measures of central tendency and spread. Draw and interpret various graph types. Understand probability calculations. Make predictions from data.',
    learning_outcomes: ['Analyze complex data', 'Calculate statistics', 'Interpret various graphs', 'Apply probability'],
    skills_to_develop: ['Statistical analysis', 'Data interpretation', 'Probability reasoning', 'Prediction'],
    knowledge_areas: ['Statistics', 'Probability', 'Data analysis', 'Graphing'],
    suggested_time_hours: 10,
    cognitive_level: 'analysis',
    term: 4,
    caps_document_reference: 'CAPS Mathematics Grade 7-9, p88-100'
  }
];

// =====================================================
// LIFE ORIENTATION GRADE 8 TOPICS
// =====================================================

const lifeOrientationTopicsGrade8 = [
  {
    grade: '8',
    subject: 'Life Orientation',
    topic_code: 'LO-G8-T1',
    topic_title: 'Personal Development and Health',
    description: 'Personal well-being, health, and lifestyle choices',
    content_outline: 'Understand adolescent development. Make healthy lifestyle choices. Understand nutrition and fitness. Manage stress and emotions. Build self-esteem and self-awareness.',
    learning_outcomes: ['Understand development', 'Make healthy choices', 'Manage stress', 'Build self-esteem'],
    skills_to_develop: ['Self-awareness', 'Health management', 'Emotional regulation', 'Decision making'],
    knowledge_areas: ['Adolescent development', 'Health', 'Nutrition', 'Emotional well-being'],
    suggested_time_hours: 6,
    cognitive_level: 'application',
    term: 1,
    caps_document_reference: 'CAPS Life Orientation Grade 7-9, p12-22'
  },
  {
    grade: '8',
    subject: 'Life Orientation',
    topic_code: 'LO-G8-T2',
    topic_title: 'Social and Emotional Development',
    description: 'Relationships, peer pressure, and social skills',
    content_outline: 'Build positive relationships. Understand peer pressure and how to respond. Develop communication skills. Understand diversity and respect. Manage conflict constructively.',
    learning_outcomes: ['Build relationships', 'Resist peer pressure', 'Communicate effectively', 'Respect diversity'],
    skills_to_develop: ['Relationship skills', 'Communication', 'Conflict resolution', 'Social awareness'],
    knowledge_areas: ['Relationships', 'Peer pressure', 'Communication', 'Diversity'],
    suggested_time_hours: 6,
    cognitive_level: 'application',
    term: 2,
    caps_document_reference: 'CAPS Life Orientation Grade 7-9, p26-36'
  },
  {
    grade: '8',
    subject: 'Life Orientation',
    topic_code: 'LO-G8-T3',
    topic_title: 'Rights, Responsibilities, and Democracy',
    description: 'Understanding rights, citizenship, and democratic participation',
    content_outline: 'Understand human rights and children\'s rights. Know responsibilities as citizens. Understand democracy in South Africa. Participate in democratic processes. Understand social justice issues.',
    learning_outcomes: ['Know rights', 'Understand citizenship', 'Participate democratically', 'Recognize social justice'],
    skills_to_develop: ['Civic awareness', 'Critical thinking', 'Participation', 'Social responsibility'],
    knowledge_areas: ['Human rights', 'Democracy', 'Citizenship', 'Social justice'],
    suggested_time_hours: 6,
    cognitive_level: 'comprehension',
    term: 3,
    caps_document_reference: 'CAPS Life Orientation Grade 7-9, p40-48'
  },
  {
    grade: '8',
    subject: 'Life Orientation',
    topic_code: 'LO-G8-T4',
    topic_title: 'Career and Career Choices',
    description: 'Career exploration, subject choices, and planning',
    content_outline: 'Explore different careers and occupations. Understand subject choices for Grade 10. Identify personal interests and strengths. Understand career paths and requirements. Plan for the future.',
    learning_outcomes: ['Explore careers', 'Understand subject choices', 'Identify strengths', 'Plan future'],
    skills_to_develop: ['Career awareness', 'Self-reflection', 'Planning', 'Decision making'],
    knowledge_areas: ['Careers', 'Subject choices', 'Personal strengths', 'Future planning'],
    suggested_time_hours: 6,
    cognitive_level: 'application',
    term: 4,
    caps_document_reference: 'CAPS Life Orientation Grade 7-9, p52-60'
  },
  {
    grade: '8',
    subject: 'Life Orientation',
    topic_code: 'LO-G8-T5',
    topic_title: 'Physical Education and Recreation',
    description: 'Physical fitness, sports, and recreational activities',
    content_outline: 'Participate in physical activities. Understand fitness components. Learn sports skills and rules. Understand importance of exercise. Develop positive attitudes towards physical activity.',
    learning_outcomes: ['Participate in sports', 'Understand fitness', 'Learn sports skills', 'Value exercise'],
    skills_to_develop: ['Physical skills', 'Teamwork', 'Fitness awareness', 'Sportsmanship'],
    knowledge_areas: ['Physical fitness', 'Sports', 'Recreation', 'Health'],
    suggested_time_hours: 8,
    cognitive_level: 'application',
    term: 1,
    caps_document_reference: 'CAPS Life Orientation Grade 7-9, p64-74'
  }
];

// =====================================================
// TEXTBOOKS
// =====================================================

const englishTextbooks = [
  {
    title: 'Platinum English Home Language Grade 6 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636144125',
    edition: 'CAPS Edition',
    publication_year: 2020,
    grade: '6',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 268,
    authors: ['L. Rademeyer', 'M. van Wyk'],
    description: 'Advanced English HL with literary analysis and essay writing'
  },
  {
    title: 'Platinum English Home Language Grade 7 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636144132',
    edition: 'CAPS Edition',
    publication_year: 2020,
    grade: '7',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 284,
    authors: ['L. Rademeyer', 'M. van Wyk'],
    description: 'Senior Phase English with critical reading and research skills'
  },
  {
    title: 'Oxford Successful English Home Language Grade 6 Learner\'s Book',
    publisher: 'Oxford University Press',
    isbn: '9780199056019',
    edition: 'CAPS Edition',
    publication_year: 2019,
    grade: '6',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'hybrid',
    page_count: 248,
    authors: ['K. Botha', 'S. Meyer'],
    description: 'Comprehensive English with novel studies'
  },
  {
    title: 'Oxford Successful English Home Language Grade 7 Learner\'s Book',
    publisher: 'Oxford University Press',
    isbn: '9780199056026',
    edition: 'CAPS Edition',
    publication_year: 2019,
    grade: '7',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'hybrid',
    page_count: 264,
    authors: ['K. Botha', 'S. Meyer'],
    description: 'Advanced English with drama and Shakespeare studies'
  }
];

const mathTextbooks = [
  {
    title: 'Platinum Mathematics Grade 6 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636144279',
    edition: 'CAPS Edition',
    publication_year: 2020,
    grade: '6',
    subject: 'Mathematics',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 312,
    authors: ['M. de Villiers', 'C. Jugmohan'],
    description: 'Advanced Mathematics with algebra and geometry'
  },
  {
    title: 'Platinum Mathematics Grade 7 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636144286',
    edition: 'CAPS Edition',
    publication_year: 2020,
    grade: '7',
    subject: 'Mathematics',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 328,
    authors: ['M. de Villiers', 'C. Jugmohan'],
    description: 'Senior Phase Mathematics with linear equations'
  },
  {
    title: 'Via Afrika Mathematics Grade 6 Learner\'s Book',
    publisher: 'Via Afrika',
    isbn: '9781415423721',
    edition: 'CAPS Edition',
    publication_year: 2018,
    grade: '6',
    subject: 'Mathematics',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 294,
    authors: ['A. Bowie', 'M. Scheiber'],
    description: 'Structured Mathematics with problem-solving focus'
  },
  {
    title: 'Via Afrika Mathematics Grade 7 Learner\'s Book',
    publisher: 'Via Afrika',
    isbn: '9781415423738',
    edition: 'CAPS Edition',
    publication_year: 2018,
    grade: '7',
    subject: 'Mathematics',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 308,
    authors: ['A. Bowie', 'M. Scheiber'],
    description: 'Comprehensive Mathematics with algebraic thinking'
  }
];

const loTextbooks = [
  {
    title: 'Platinum Life Orientation Grade 8 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636145016',
    edition: 'CAPS Edition',
    publication_year: 2019,
    grade: '8',
    subject: 'Life Orientation',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 184,
    authors: ['J. van Heerden', 'T. Moodley'],
    description: 'Comprehensive Life Orientation covering personal, social, and citizenship education'
  },
  {
    title: 'Oxford Successful Life Orientation Grade 8 Learner\'s Book',
    publisher: 'Oxford University Press',
    isbn: '9780199057238',
    edition: 'CAPS Edition',
    publication_year: 2019,
    grade: '8',
    subject: 'Life Orientation',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'hybrid',
    page_count: 176,
    authors: ['S. Burger', 'M. Steyn'],
    description: 'Engaging Life Orientation with activities and real-world applications'
  }
];

// =====================================================
// CHAPTER STRUCTURES
// =====================================================

const platinumEnglishG6Chapters = [
  { chapter_number: 1, title: 'Literary Analysis and Comprehension', page_start: 6, page_end: 32, content_type: 'chapter', key_concepts: ['Theme', 'Character analysis', 'Plot'], activities_included: true, estimated_duration_minutes: 420 },
  { chapter_number: 2, title: 'Expository Writing', page_start: 33, page_end: 58, content_type: 'chapter', key_concepts: ['Essay structure', 'Evidence', 'Organization'], activities_included: true, estimated_duration_minutes: 380 },
  { chapter_number: 3, title: 'Advanced Grammar and Sentence Structure', page_start: 59, page_end: 84, content_type: 'chapter', key_concepts: ['Complex sentences', 'Voice', 'Punctuation'], activities_included: true, estimated_duration_minutes: 340 },
  { chapter_number: 4, title: 'Poetry Analysis', page_start: 85, page_end: 108, content_type: 'chapter', key_concepts: ['Poetic devices', 'Imagery', 'Theme'], activities_included: true, estimated_duration_minutes: 300 },
  { chapter_number: 5, title: 'Novel Study', page_start: 109, page_end: 142, content_type: 'chapter', key_concepts: ['Character', 'Plot', 'Setting', 'Theme'], activities_included: true, estimated_duration_minutes: 480 },
  { chapter_number: 6, title: 'Argumentative Writing', page_start: 143, page_end: 170, content_type: 'chapter', key_concepts: ['Arguments', 'Evidence', 'Persuasion'], activities_included: true, estimated_duration_minutes: 380 },
  { chapter_number: 7, title: 'Media and Visual Literacy', page_start: 171, page_end: 194, content_type: 'chapter', key_concepts: ['Media analysis', 'Visual texts', 'Persuasive techniques'], activities_included: true, estimated_duration_minutes: 320 },
  { chapter_number: 8, title: 'Oral Communication and Presentations', page_start: 195, page_end: 218, content_type: 'chapter', key_concepts: ['Public speaking', 'Presentations', 'Listening skills'], activities_included: true, estimated_duration_minutes: 300 },
  { chapter_number: 9, title: 'Language Study and Vocabulary', page_start: 219, page_end: 242, content_type: 'chapter', key_concepts: ['Vocabulary', 'Word formation', 'Language use'], activities_included: true, estimated_duration_minutes: 280 },
  { chapter_number: 10, title: 'Review and Assessment', page_start: 243, page_end: 268, content_type: 'assessment', key_concepts: ['Cumulative review'], activities_included: true, exercises_included: true, estimated_duration_minutes: 360 }
];

const platinumMathG6Chapters = [
  { chapter_number: 1, title: 'Integers and Number Operations', page_start: 6, page_end: 34, content_type: 'chapter', key_concepts: ['Integers', 'Operations', 'Number line'], activities_included: true, estimated_duration_minutes: 420 },
  { chapter_number: 2, title: 'Fractions, Decimals, and Percentages', page_start: 35, page_end: 68, content_type: 'chapter', key_concepts: ['Conversions', 'Operations', 'Percentages'], activities_included: true, exercises_included: true, estimated_duration_minutes: 520 },
  { chapter_number: 3, title: 'Introduction to Algebra', page_start: 69, page_end: 98, content_type: 'chapter', key_concepts: ['Variables', 'Expressions', 'Equations'], activities_included: true, estimated_duration_minutes: 440 },
  { chapter_number: 4, title: 'Ratio and Proportion', page_start: 99, page_end: 124, content_type: 'chapter', key_concepts: ['Ratios', 'Proportions', 'Applications'], activities_included: true, estimated_duration_minutes: 380 },
  { chapter_number: 5, title: 'Geometry: Properties and Constructions', page_start: 125, page_end: 158, content_type: 'chapter', key_concepts: ['Triangles', 'Quadrilaterals', 'Constructions'], activities_included: true, estimated_duration_minutes: 460 },
  { chapter_number: 6, title: 'Measurement and Conversion', page_start: 159, page_end: 186, content_type: 'chapter', key_concepts: ['Metric units', 'Conversion', 'Area', 'Volume'], activities_included: true, estimated_duration_minutes: 400 },
  { chapter_number: 7, title: 'Angles and Polygons', page_start: 187, page_end: 214, content_type: 'chapter', key_concepts: ['Angles', 'Polygons', 'Angle calculations'], activities_included: true, estimated_duration_minutes: 380 },
  { chapter_number: 8, title: 'Data Handling and Statistics', page_start: 215, page_end: 246, content_type: 'chapter', key_concepts: ['Mean', 'Median', 'Mode', 'Graphs'], activities_included: true, estimated_duration_minutes: 420 },
  { chapter_number: 9, title: 'Probability', page_start: 247, page_end: 272, content_type: 'chapter', key_concepts: ['Probability', 'Experiments', 'Predictions'], activities_included: true, estimated_duration_minutes: 340 },
  { chapter_number: 10, title: 'Patterns and Functions', page_start: 273, page_end: 294, content_type: 'chapter', key_concepts: ['Number patterns', 'Sequences', 'Functions'], activities_included: true, estimated_duration_minutes: 300 },
  { chapter_number: 11, title: 'Review and Problem Solving', page_start: 295, page_end: 312, content_type: 'assessment', key_concepts: ['Cumulative review'], exercises_included: true, estimated_duration_minutes: 280 }
];

const platinumLOG8Chapters = [
  { chapter_number: 1, title: 'Personal Development and Well-being', page_start: 6, page_end: 28, content_type: 'chapter', key_concepts: ['Adolescent development', 'Health', 'Self-esteem'], activities_included: true, estimated_duration_minutes: 240 },
  { chapter_number: 2, title: 'Social and Emotional Skills', page_start: 29, page_end: 52, content_type: 'chapter', key_concepts: ['Relationships', 'Peer pressure', 'Communication'], activities_included: true, estimated_duration_minutes: 260 },
  { chapter_number: 3, title: 'Health and Nutrition', page_start: 53, page_end: 74, content_type: 'chapter', key_concepts: ['Nutrition', 'Fitness', 'Healthy choices'], activities_included: true, estimated_duration_minutes: 220 },
  { chapter_number: 4, title: 'Rights and Responsibilities', page_start: 75, page_end: 98, content_type: 'chapter', key_concepts: ['Human rights', 'Democracy', 'Citizenship'], activities_included: true, estimated_duration_minutes: 240 },
  { chapter_number: 5, title: 'Social Justice and Diversity', page_start: 99, page_end: 120, content_type: 'chapter', key_concepts: ['Diversity', 'Respect', 'Social justice'], activities_included: true, estimated_duration_minutes: 220 },
  { chapter_number: 6, title: 'Career Planning and Subject Choices', page_start: 121, page_end: 144, content_type: 'chapter', key_concepts: ['Careers', 'Subject choices', 'Planning'], activities_included: true, estimated_duration_minutes: 240 },
  { chapter_number: 7, title: 'Physical Education and Sports', page_start: 145, page_end: 166, content_type: 'chapter', key_concepts: ['Physical fitness', 'Sports', 'Teamwork'], activities_included: true, estimated_duration_minutes: 280 },
  { chapter_number: 8, title: 'Review and Reflection', page_start: 167, page_end: 184, content_type: 'assessment', key_concepts: ['Personal reflection', 'Goal setting'], activities_included: true, estimated_duration_minutes: 200 }
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
  console.log('🚀 Starting CAPS Seeding: Grades 6-7 English & Math, Grade 8 LO\n');
  console.log('='.repeat(70));

  // ENGLISH TOPICS
  console.log('\n📚 SEEDING ENGLISH TOPICS\n');
  console.log('Grade 6 English Topics:');
  for (const topic of englishTopicsGrade6) await seedTopic(topic);
  console.log('\nGrade 7 English Topics:');
  for (const topic of englishTopicsGrade7) await seedTopic(topic);

  // MATHEMATICS TOPICS
  console.log('\n\n📐 SEEDING MATHEMATICS TOPICS\n');
  console.log('Grade 6 Mathematics Topics:');
  for (const topic of mathTopicsGrade6) await seedTopic(topic);
  console.log('\nGrade 7 Mathematics Topics:');
  for (const topic of mathTopicsGrade7) await seedTopic(topic);

  // LIFE ORIENTATION TOPICS
  console.log('\n\n🌟 SEEDING LIFE ORIENTATION TOPICS\n');
  console.log('Grade 8 Life Orientation Topics:');
  for (const topic of lifeOrientationTopicsGrade8) await seedTopic(topic);

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

  console.log('\nLife Orientation Textbooks:');
  const loBooks = [];
  for (const book of loTextbooks) {
    const result = await seedTextbook(book);
    if (result) loBooks.push(result);
  }

  // CHAPTER STRUCTURES
  console.log('\n\n📑 SEEDING CHAPTER STRUCTURES\n');
  
  const platinumEngG6 = engBooks.find(b => b.title.includes('Platinum') && b.grade === '6');
  if (platinumEngG6) {
    console.log(`\nPlatinum English Grade 6 Chapters:`);
    for (const ch of platinumEnglishG6Chapters) await seedChapter(ch, platinumEngG6.id);
  }

  const platinumMathG6 = mathBooks.find(b => b.title.includes('Platinum') && b.grade === '6');
  if (platinumMathG6) {
    console.log(`\nPlatinum Mathematics Grade 6 Chapters:`);
    for (const ch of platinumMathG6Chapters) await seedChapter(ch, platinumMathG6.id);
  }

  const platinumLOG8 = loBooks.find(b => b.title.includes('Platinum') && b.grade === '8');
  if (platinumLOG8) {
    console.log(`\nPlatinum Life Orientation Grade 8 Chapters:`);
    for (const ch of platinumLOG8Chapters) await seedChapter(ch, platinumLOG8.id);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ SEEDING COMPLETE!\n');
  console.log('Seeded:');
  console.log(`  - ${englishTopicsGrade6.length + englishTopicsGrade7.length} English CAPS topics (Grades 6-7)`);
  console.log(`  - ${mathTopicsGrade6.length + mathTopicsGrade7.length} Mathematics CAPS topics (Grades 6-7)`);
  console.log(`  - ${lifeOrientationTopicsGrade8.length} Life Orientation CAPS topics (Grade 8)`);
  console.log(`  - ${englishTextbooks.length} English textbooks`);
  console.log(`  - ${mathTextbooks.length} Mathematics textbooks`);
  console.log(`  - ${loTextbooks.length} Life Orientation textbooks`);
  console.log(`  - ${platinumEnglishG6Chapters.length + platinumMathG6Chapters.length + platinumLOG8Chapters.length} chapter structures`);
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
