/**
 * CAPS Textbook Mapping Seeding Utilities
 * 
 * 4-Step Process:
 * 1. Seed CAPS Topics (from official curriculum docs)
 * 2. Seed Textbooks (metadata about books)
 * 3. Seed Textbook Content (chapter structure with page ranges)
 * 4. Create Mappings (manual SME process via admin UI)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  console.error('\nMake sure .env file contains these variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// STEP 1: Seed CAPS Topics
// =====================================================

async function seedCAPSTopic(topicData) {
  const { data, error } = await supabase
    .from('caps_topics')
    .insert({
      grade: topicData.grade,
      subject: topicData.subject,
      topic_code: topicData.topic_code,
      topic_title: topicData.topic_title,
      description: topicData.description,
      specific_aims: topicData.specific_aims || [],
      learning_outcomes: topicData.learning_outcomes || [],
      assessment_standards: topicData.assessment_standards || [],
      content_outline: topicData.content_outline,
      skills_to_develop: topicData.skills_to_develop || [],
      knowledge_areas: topicData.knowledge_areas || [],
      suggested_time_hours: topicData.suggested_time_hours,
      prerequisites: topicData.prerequisites || [],
      cognitive_level: topicData.cognitive_level || 'comprehension',
      term: topicData.term,
      caps_document_reference: topicData.caps_document_reference
    })
    .select()
    .single();

  if (error) {
    console.error('Error seeding CAPS topic:', error);
    return null;
  }

  console.log(`✅ Seeded CAPS topic: ${data.topic_code} - ${data.topic_title}`);
  return data;
}

// Example: Geography Grade 5 Topics from uploaded lesson plan
async function seedGeographyGrade5Topics() {
  console.log('\n📚 Seeding Geography Grade 5 Topics...\n');

  const topics = [
    {
      grade: '5',
      subject: 'Geography',
      topic_code: 'GEO-G5-T1',
      topic_title: 'Coal as a Natural Resource',
      description: 'Understanding coal formation, mining, and uses in South Africa',
      content_outline: 'How coal is formed over millions of years from plants and trees. Types of coal mining (underground and opencast). Uses of coal in South Africa (electricity generation). Environmental impact of coal mining.',
      learning_outcomes: [
        'Explain how coal is formed from organic matter',
        'Describe different types of coal mining',
        'Identify major uses of coal in South Africa',
        'Discuss environmental impacts of coal mining'
      ],
      skills_to_develop: ['Critical thinking', 'Map reading', 'Environmental awareness'],
      knowledge_areas: ['Natural resources', 'Energy sources', 'Environmental impact'],
      suggested_time_hours: 4,
      cognitive_level: 'comprehension',
      term: 3,
      caps_document_reference: 'CAPS Geography Grade 4-6, p74-76'
    },
    {
      grade: '5',
      subject: 'Geography',
      topic_code: 'GEO-G5-T2',
      topic_title: 'Weather Patterns and Climate',
      description: 'Understanding weather elements, measurement, and patterns in South Africa',
      content_outline: 'Elements of weather (temperature, rainfall, wind). Weather measurement instruments. Reading weather maps and symbols. Seasonal weather patterns in South Africa.',
      learning_outcomes: [
        'Identify and describe weather elements',
        'Explain how weather is measured',
        'Read and interpret weather maps',
        'Describe seasonal patterns in different regions'
      ],
      skills_to_develop: ['Data interpretation', 'Map reading', 'Scientific observation'],
      knowledge_areas: ['Meteorology', 'Climate zones', 'Geographic patterns'],
      suggested_time_hours: 5,
      cognitive_level: 'application',
      term: 3,
      caps_document_reference: 'CAPS Geography Grade 4-6, p78-82'
    },
    {
      grade: '5',
      subject: 'Geography',
      topic_code: 'GEO-G5-T3',
      topic_title: 'Mining in South Africa',
      description: 'Overview of mining industry, types of minerals, and economic impact',
      content_outline: 'Types of minerals mined in South Africa (gold, diamonds, platinum, coal). Major mining regions. Economic importance of mining. Social and environmental impacts.',
      learning_outcomes: [
        'Identify major minerals mined in South Africa',
        'Locate mining regions on a map',
        'Explain the economic importance of mining',
        'Discuss social and environmental impacts'
      ],
      skills_to_develop: ['Economic awareness', 'Map skills', 'Critical analysis'],
      knowledge_areas: ['Economic geography', 'Natural resources', 'Sustainability'],
      suggested_time_hours: 6,
      cognitive_level: 'analysis',
      term: 3,
      caps_document_reference: 'CAPS Geography Grade 4-6, p74-82'
    }
  ];

  for (const topic of topics) {
    await seedCAPSTopic(topic);
  }

  console.log('\n✅ Geography Grade 5 topics seeded!\n');
}

// =====================================================
// STEP 2: Seed Textbooks
// =====================================================

async function seedTextbook(textbookData) {
  const { data, error } = await supabase
    .from('textbooks')
    .insert({
      title: textbookData.title,
      publisher: textbookData.publisher,
      isbn: textbookData.isbn,
      edition: textbookData.edition,
      publication_year: textbookData.publication_year,
      grade: textbookData.grade,
      subject: textbookData.subject,
      language: textbookData.language || 'en',
      caps_approved: textbookData.caps_approved !== false,
      dbe_approved: textbookData.dbe_approved !== false,
      format: textbookData.format || 'print',
      page_count: textbookData.page_count,
      authors: textbookData.authors || [],
      description: textbookData.description
    })
    .select()
    .single();

  if (error) {
    console.error('Error seeding textbook:', error);
    return null;
  }

  console.log(`✅ Seeded textbook: ${data.title} (${data.publisher})`);
  return data;
}

// Example: Popular Geography Grade 5 textbooks
async function seedGeographyGrade5Textbooks() {
  console.log('\n📖 Seeding Geography Grade 5 Textbooks...\n');

  const textbooks = [
    {
      title: 'Platinum Social Sciences Grade 5 Learner\'s Book',
      publisher: 'Pearson',
      isbn: '9780636143234',
      edition: 'CAPS Edition',
      publication_year: 2019,
      grade: '5',
      subject: 'Geography',
      language: 'en',
      caps_approved: true,
      dbe_approved: true,
      format: 'print',
      page_count: 180,
      authors: ['M. Clitheroe', 'L. Dilley', 'B. Ebersöhn'],
      description: 'CAPS-aligned Social Sciences textbook with integrated History and Geography'
    },
    {
      title: 'Via Afrika Social Sciences Grade 5 Learner\'s Book',
      publisher: 'Via Afrika',
      isbn: '9781415423059',
      edition: 'CAPS Edition',
      publication_year: 2018,
      grade: '5',
      subject: 'Geography',
      language: 'en',
      caps_approved: true,
      dbe_approved: true,
      format: 'print',
      page_count: 164,
      authors: ['B. Schumann', 'M. van Eeden'],
      description: 'Comprehensive Geography coverage with activities and assessments'
    },
    {
      title: 'Oxford Successful Social Sciences Grade 5 Learner\'s Book',
      publisher: 'Oxford University Press',
      isbn: '9780199052578',
      edition: 'CAPS Edition',
      publication_year: 2020,
      grade: '5',
      subject: 'Geography',
      language: 'en',
      caps_approved: true,
      dbe_approved: true,
      format: 'hybrid',
      page_count: 192,
      authors: ['S. Burger', 'M. Steyn', 'K. Heese'],
      description: 'Modern CAPS-compliant textbook with digital resources'
    }
  ];

  const seededTextbooks = [];
  for (const textbook of textbooks) {
    const result = await seedTextbook(textbook);
    if (result) seededTextbooks.push(result);
  }

  console.log('\n✅ Geography Grade 5 textbooks seeded!\n');
  return seededTextbooks;
}

// =====================================================
// STEP 3: Seed Textbook Content (Chapter Structure)
// =====================================================

async function seedTextbookContent(contentData) {
  const { data, error } = await supabase
    .from('textbook_content')
    .insert({
      textbook_id: contentData.textbook_id,
      chapter_number: contentData.chapter_number,
      section_number: contentData.section_number,
      title: contentData.title,
      description: contentData.description,
      content_type: contentData.content_type || 'chapter',
      page_start: contentData.page_start,
      page_end: contentData.page_end,
      key_concepts: contentData.key_concepts || [],
      activities_included: contentData.activities_included || false,
      exercises_included: contentData.exercises_included || false,
      estimated_duration_minutes: contentData.estimated_duration_minutes
    })
    .select()
    .single();

  if (error) {
    console.error('Error seeding textbook content:', error);
    return null;
  }

  console.log(`✅ Seeded content: Ch${data.chapter_number} - ${data.title} (pp. ${data.page_start}-${data.page_end})`);
  return data;
}

// Example: Chapter structure for Platinum Grade 5
async function seedPlatinumGrade5ChapterStructure(textbookId) {
  console.log('\n📑 Seeding Platinum Grade 5 Chapter Structure...\n');

  const chapters = [
    {
      textbook_id: textbookId,
      chapter_number: 1,
      title: 'Map Skills and Symbols',
      description: 'Introduction to map reading, symbols, and compass directions',
      content_type: 'chapter',
      page_start: 6,
      page_end: 22,
      key_concepts: ['Map symbols', 'Compass directions', 'Scale'],
      activities_included: true,
      estimated_duration_minutes: 240
    },
    {
      textbook_id: textbookId,
      chapter_number: 2,
      title: 'Natural Resources of South Africa',
      description: 'Understanding renewable and non-renewable resources',
      content_type: 'chapter',
      page_start: 23,
      page_end: 45,
      key_concepts: ['Renewable resources', 'Non-renewable resources', 'Conservation'],
      activities_included: true,
      estimated_duration_minutes: 300
    },
    {
      textbook_id: textbookId,
      chapter_number: 3,
      title: 'Coal: Formation, Mining, and Uses',
      description: 'Detailed study of coal as an energy resource',
      content_type: 'chapter',
      page_start: 74,
      page_end: 82,
      key_concepts: ['Coal formation', 'Mining methods', 'Power generation', 'Environmental impact'],
      activities_included: true,
      exercises_included: true,
      estimated_duration_minutes: 240
    },
    {
      textbook_id: textbookId,
      chapter_number: 4,
      title: 'Weather and Climate in South Africa',
      description: 'Weather elements, measurement, and seasonal patterns',
      content_type: 'chapter',
      page_start: 83,
      page_end: 110,
      key_concepts: ['Temperature', 'Rainfall', 'Wind', 'Weather maps', 'Climate zones'],
      activities_included: true,
      exercises_included: true,
      estimated_duration_minutes: 360
    }
  ];

  for (const chapter of chapters) {
    await seedTextbookContent(chapter);
  }

  console.log('\n✅ Platinum Grade 5 chapter structure seeded!\n');
}

// =====================================================
// STEP 4: Create Sample Mappings (for demonstration)
// =====================================================

async function createSampleMapping(mappingData) {
  const { data, error } = await supabase
    .from('caps_textbook_mapping')
    .insert({
      caps_topic_id: mappingData.caps_topic_id,
      textbook_content_id: mappingData.textbook_content_id,
      coverage_percentage: mappingData.coverage_percentage || 100,
      is_primary_reference: mappingData.is_primary_reference !== false,
      alignment_score: mappingData.alignment_score || 5,
      key_pages: mappingData.key_pages || [],
      diagram_pages: mappingData.diagram_pages || [],
      example_pages: mappingData.example_pages || [],
      exercise_pages: mappingData.exercise_pages || [],
      status: mappingData.status || 'verified',
      mapping_notes: mappingData.mapping_notes,
      created_by: mappingData.created_by
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating mapping:', error);
    return null;
  }

  console.log(`✅ Created mapping: Topic ${mappingData.caps_topic_id.substring(0, 8)}... → Content ${mappingData.textbook_content_id.substring(0, 8)}...`);
  return data;
}

// =====================================================
// MAIN SEEDING FUNCTION
// =====================================================

async function runFullSeedingProcess() {
  console.log('🚀 Starting CAPS Textbook Mapping Seeding Process\n');
  console.log('=' .repeat(60));

  // Step 1: Seed CAPS Topics
  await seedGeographyGrade5Topics();

  // Step 2: Seed Textbooks
  const textbooks = await seedGeographyGrade5Textbooks();
  const platinumTextbook = textbooks.find(t => t.title.includes('Platinum'));

  if (!platinumTextbook) {
    console.error('❌ Platinum textbook not found');
    return;
  }

  // Step 3: Seed Chapter Structure
  await seedPlatinumGrade5ChapterStructure(platinumTextbook.id);

  console.log('\n' + '='.repeat(60));
  console.log('✅ SEEDING COMPLETE!\n');
  console.log('Next Steps:');
  console.log('1. Navigate to /admin/caps-mapping in your browser');
  console.log('2. Select Grade 5 and Geography');
  console.log('3. Manually create mappings by clicking topics and textbook sections');
  console.log('4. For each mapping, specify:');
  console.log('   - Key pages (e.g., "74, 75, 76")');
  console.log('   - Coverage percentage (1-100)');
  console.log('   - Alignment score (1-5)');
  console.log('   - Whether it\'s the primary reference');
  console.log('\nExample mapping:');
  console.log('  CAPS Topic: GEO-G5-T1 (Coal as a Natural Resource)');
  console.log('  Textbook: Platinum Grade 5, Chapter 3');
  console.log('  Key Pages: 74, 75, 76, 78');
  console.log('  Coverage: 100%, Alignment: 5/5');
}

// Export functions for use in other scripts
module.exports = {
  seedCAPSTopic,
  seedTextbook,
  seedTextbookContent,
  createSampleMapping,
  seedGeographyGrade5Topics,
  seedGeographyGrade5Textbooks,
  seedPlatinumGrade5ChapterStructure,
  runFullSeedingProcess
};

// Run if called directly
if (require.main === module) {
  runFullSeedingProcess()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}
