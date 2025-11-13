/**
 * Seed DBE Textbooks for E-Books Library
 * 
 * This script populates the textbooks table with popular CAPS-approved textbooks
 * that can be accessed as e-books by parents and students.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const textbooks = [
  // Grade 4
  {
    title: 'Oxford Successful English Home Language Grade 4 Learner\'s Book',
    publisher: 'Oxford University Press',
    isbn: '9780199052561',
    grade: '4',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 220,
    publication_year: 2019,
    description: 'CAPS-aligned English Home Language textbook with comprehensive activities',
    pdf_url: 'https://example.com/books/oxford-english-g4.pdf', // Replace with actual URL
    is_active: true
  },
  {
    title: 'Platinum English Home Language Grade 4 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636143227',
    grade: '4',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 240,
    publication_year: 2020,
    description: 'Engaging English textbook with modern content',
    pdf_url: 'https://example.com/books/platinum-english-g4.pdf',
    is_active: true
  },
  {
    title: 'Via Afrika Mathematics Grade 4 Learner\'s Book',
    publisher: 'Via Afrika',
    isbn: '9781415423042',
    grade: '4',
    subject: 'Mathematics',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 264,
    publication_year: 2018,
    description: 'Comprehensive mathematics textbook with problem-solving focus',
    pdf_url: 'https://example.com/books/via-afrika-math-g4.pdf',
    is_active: true
  },
  
  // Grade 5
  {
    title: 'Oxford Successful English Home Language Grade 5 Learner\'s Book',
    publisher: 'Oxford University Press',
    isbn: '9780199052578',
    grade: '5',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 236,
    publication_year: 2019,
    description: 'Advanced English skills development',
    pdf_url: 'https://example.com/books/oxford-english-g5.pdf',
    is_active: true
  },
  {
    title: 'Platinum English Home Language Grade 5 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636143234',
    grade: '5',
    subject: 'English',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 256,
    publication_year: 2020,
    description: 'Modern approach to English language learning',
    pdf_url: 'https://example.com/books/platinum-english-g5.pdf',
    is_active: true
  },
  {
    title: 'Platinum Mathematics Grade 4 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636143210',
    grade: '4',
    subject: 'Mathematics',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 280,
    publication_year: 2020,
    description: 'Clear explanations with plenty of practice',
    pdf_url: 'https://example.com/books/platinum-math-g4.pdf',
    is_active: true
  },
  {
    title: 'Via Afrika Social Sciences Grade 5 Learner\'s Book',
    publisher: 'Via Afrika',
    isbn: '9781415423059',
    grade: '5',
    subject: 'Geography',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 164,
    publication_year: 2018,
    description: 'Integrated History and Geography',
    pdf_url: 'https://example.com/books/via-afrika-social-g5.pdf',
    is_active: true
  },
  {
    title: 'Platinum Social Sciences Grade 5 Learner\'s Book',
    publisher: 'Pearson',
    isbn: '9780636143234',
    grade: '5',
    subject: 'Geography',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 180,
    publication_year: 2019,
    description: 'CAPS-aligned Social Sciences with integrated History and Geography',
    pdf_url: 'https://example.com/books/platinum-social-g5.pdf',
    is_active: true
  },
  {
    title: 'Oxford Successful Social Sciences Grade 5 Learner\'s Book',
    publisher: 'Oxford University Press',
    isbn: '9780199052592',
    grade: '5',
    subject: 'Geography',
    language: 'en',
    caps_approved: true,
    dbe_approved: true,
    format: 'print',
    page_count: 192,
    publication_year: 2020,
    description: 'Modern CAPS-compliant textbook with digital resources',
    pdf_url: 'https://example.com/books/oxford-social-g5.pdf',
    is_active: true
  }
];

async function seedTextbooks() {
  console.log('🚀 Starting textbook seeding...\n');

  try {
    // Clear existing test data (optional - comment out if you want to keep existing)
    // const { error: deleteError } = await supabase
    //   .from('textbooks')
    //   .delete()
    //   .neq('id', '00000000-0000-0000-0000-000000000000');
    
    // if (deleteError) console.warn('Note: Could not clear existing data:', deleteError.message);

    // Insert textbooks
    let successCount = 0;
    let errorCount = 0;

    for (const book of textbooks) {
      const { data, error } = await supabase
        .from('textbooks')
        .insert(book)
        .select()
        .single();

      if (error) {
        console.error(`❌ Failed to seed: ${book.title}`);
        console.error(`   Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ Seeded: ${book.title} (${book.publisher})`);
        successCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   ✅ Successfully seeded: ${successCount} books`);
    console.log(`   ❌ Failed: ${errorCount} books`);
    console.log('='.repeat(60));

    if (successCount > 0) {
      console.log('\n✨ E-Books library is now populated!');
      console.log('📱 Parents can now access textbooks at /parent/ebooks');
      console.log('\n📝 Note: Replace the placeholder PDF URLs with actual DBE book URLs');
    }

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedTextbooks()
    .then(() => {
      console.log('\n✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedTextbooks };
