/**
 * Seed DBE Textbooks for E-Book Library
 * 
 * Seeds sample CAPS-approved textbooks for grades 4-12
 * Includes popular publishers: Oxford, Pearson, Via Afrika
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const textbooks = [
  // Grade 4
  {
    title: 'Oxford Successful English Home Language Grade 4 Learner\'s Book',
    grade: '4',
    subject: 'English',
    language: 'en',
    publisher: 'Oxford University Press',
    isbn: '9780199052578',
    publication_year: 2019,
    page_count: 220,
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    description: 'CAPS-aligned English Home Language textbook with reading, writing, and language activities',
    pdf_url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20FET%20_%20ENGLISH%20HL_GR%2010-12_WEB_31052015.pdf'
  },
  {
    title: 'Platinum Mathematics Grade 4 Learner\'s Book',
    grade: '4',
    subject: 'Mathematics',
    language: 'en',
    publisher: 'Pearson',
    isbn: '9780636143234',
    publication_year: 2020,
    page_count: 280,
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    description: 'Comprehensive mathematics textbook aligned with CAPS curriculum',
    pdf_url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20IP%20MATHEMATICS%20GR%204-6%20web.pdf'
  },
  {
    title: 'Via Afrika Mathematics Grade 4 Learner\'s Book',
    grade: '4',
    subject: 'Mathematics',
    language: 'en',
    publisher: 'Via Afrika',
    isbn: '9781415423059',
    publication_year: 2018,
    page_count: 264,
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    description: 'Engaging mathematics content with problem-solving activities',
    pdf_url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20IP%20MATHEMATICS%20GR%204-6%20web.pdf'
  },
  
  // Grade 5
  {
    title: 'Platinum English Home Language Grade 5 Learner\'s Book',
    grade: '5',
    subject: 'English',
    language: 'en',
    publisher: 'Pearson',
    isbn: '9780636143241',
    publication_year: 2020,
    page_count: 240,
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    description: 'Comprehensive English language textbook with integrated skills',
    pdf_url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20FET%20_%20ENGLISH%20HL_GR%2010-12_WEB_31052015.pdf'
  },
  {
    title: 'Oxford Successful English Home Language Grade 5 Learner\'s Book',
    grade: '5',
    subject: 'English',
    language: 'en',
    publisher: 'Oxford University Press',
    isbn: '9780199052585',
    publication_year: 2019,
    page_count: 236,
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    description: 'CAPS-compliant English textbook with reading and writing focus',
    pdf_url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20FET%20_%20ENGLISH%20HL_GR%2010-12_WEB_31052015.pdf'
  },
  {
    title: 'Platinum Social Sciences Grade 5 Learner\'s Book',
    grade: '5',
    subject: 'Geography',
    language: 'en',
    publisher: 'Pearson',
    isbn: '9780636143258',
    publication_year: 2019,
    page_count: 180,
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    description: 'Integrated History and Geography content with CAPS alignment',
    pdf_url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20IP%20SOCIAL%20SCIENCES%20GR%204-6%20web.pdf'
  },
  {
    title: 'Via Afrika Social Sciences Grade 5 Learner\'s Book',
    grade: '5',
    subject: 'Geography',
    language: 'en',
    publisher: 'Via Afrika',
    isbn: '9781415423066',
    publication_year: 2018,
    page_count: 164,
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    description: 'Comprehensive Geography coverage with maps and activities',
    pdf_url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20IP%20SOCIAL%20SCIENCES%20GR%204-6%20web.pdf'
  },
  {
    title: 'Oxford Successful Social Sciences Grade 5 Learner\'s Book',
    grade: '5',
    subject: 'Geography',
    language: 'en',
    publisher: 'Oxford University Press',
    isbn: '9780199052592',
    publication_year: 2020,
    page_count: 192,
    caps_approved: true,
    dbe_approved: true,
    format: 'hybrid',
    description: 'Modern CAPS-compliant Geography textbook with digital resources',
    pdf_url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20IP%20SOCIAL%20SCIENCES%20GR%204-6%20web.pdf'
  },
  {
    title: 'Platinum Mathematics Grade 5 Learner\'s Book',
    grade: '5',
    subject: 'Mathematics',
    language: 'en',
    publisher: 'Pearson',
    isbn: '9780636143265',
    publication_year: 2020,
    page_count: 280,
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    description: 'Comprehensive Grade 5 mathematics with problem-solving focus',
    pdf_url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20IP%20MATHEMATICS%20GR%204-6%20web.pdf'
  },
  
  // Grade 6
  {
    title: 'Via Afrika Mathematics Grade 6 Learner\'s Book',
    grade: '6',
    subject: 'Mathematics',
    language: 'en',
    publisher: 'Via Afrika',
    isbn: '9781415423073',
    publication_year: 2018,
    page_count: 272,
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    description: 'Grade 6 mathematics with clear explanations and exercises',
    pdf_url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20IP%20MATHEMATICS%20GR%204-6%20web.pdf'
  },
];

async function seedTextbooks() {
  console.log('🌱 Starting textbook seeding...\n');
  
  let successCount = 0;
  let errorCount = 0;

  for (const book of textbooks) {
    try {
      const { data, error } = await supabase
        .from('textbooks')
        .insert(book)
        .select()
        .single();

      if (error) {
        // Check if it's a duplicate
        if (error.code === '23505') {
          console.log(`⏭️  Skipped (already exists): ${book.title}`);
        } else {
          console.error(`❌ Error inserting ${book.title}:`, error.message);
          errorCount++;
        }
      } else {
        console.log(`✅ Seeded: ${book.title}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Exception for ${book.title}:`, err);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully seeded: ${successCount} textbooks`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount}`);
  }
  console.log('='.repeat(60));
  
  // Query and display summary
  const { data: summary } = await supabase
    .from('textbooks')
    .select('grade, subject, count')
    .order('grade');

  console.log('\n📊 Current textbook inventory:');
  if (summary) {
    const { count } = await supabase
      .from('textbooks')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total textbooks in database: ${count}`);
  }
}

seedTextbooks()
  .then(() => {
    console.log('\n✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  });
