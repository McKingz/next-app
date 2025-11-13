#!/usr/bin/env node

/**
 * Verify Lessons Migration Script
 * 
 * This script verifies the lessons table migration was successful.
 * Run with: node scripts/verify-lessons-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyMigration() {
  console.log('🔍 Verifying lessons table migration...\n');

  try {
    // Check the verification function
    const { data: verification, error: verifyError } = await supabase
      .rpc('verify_lessons_migration');

    if (verifyError) {
      console.error('❌ Error running verification:', verifyError.message);
    } else if (verification && verification.length > 0) {
      const result = verification[0];
      console.log('📊 Migration Verification Results:');
      console.log(`   Total lessons: ${result.total_lessons}`);
      console.log(`   Status breakdown: ${JSON.stringify(result.status_breakdown, null, 2)}`);
      console.log(`   Subject breakdown: ${JSON.stringify(result.subject_breakdown, null, 2)}`);
      console.log(`   Age group breakdown: ${JSON.stringify(result.age_group_breakdown, null, 2)}\n`);
    }

    // Test with sample query to see if the columns exist
    console.log('🧪 Testing sample queries...\n');

    // Test status column
    const { data: statusTest, error: statusError } = await supabase
      .from('lessons')
      .select('id, title, status')
      .limit(3);

    if (statusError) {
      console.error('❌ Status column test failed:', statusError.message);
    } else {
      console.log('✅ Status column working');
      if (statusTest && statusTest.length > 0) {
        console.log('   Sample statuses:', statusTest.map(l => l.status));
      }
    }

    // Test subject column  
    const { data: subjectTest, error: subjectError } = await supabase
      .from('lessons')
      .select('id, title, subject')
      .limit(3);

    if (subjectError) {
      console.error('❌ Subject column test failed:', subjectError.message);
    } else {
      console.log('✅ Subject column working');
      if (subjectTest && subjectTest.length > 0) {
        console.log('   Sample subjects:', subjectTest.map(l => l.subject));
      }
    }

    // Test age_group column
    const { data: ageTest, error: ageError } = await supabase
      .from('lessons')
      .select('id, title, age_group')  
      .limit(3);

    if (ageError) {
      console.error('❌ Age group column test failed:', ageError.message);
    } else {
      console.log('✅ Age group column working');
      if (ageTest && ageTest.length > 0) {
        console.log('   Sample age groups:', ageTest.map(l => l.age_group));
      }
    }

    // Test the queries that were failing before
    console.log('\n🎯 Testing the queries that were failing...\n');

    // Test status = active query
    const { data: activeTest, error: activeError } = await supabase
      .from('lessons')
      .select('*')
      .eq('status', 'published')
      .limit(2);

    if (activeError) {
      console.error('❌ Published lessons query failed:', activeError.message);
    } else {
      console.log(`✅ Published lessons query working (found ${activeTest?.length || 0} lessons)`);
    }

    // Test status != draft query  
    const { data: notDraftTest, error: notDraftError } = await supabase
      .from('lessons')
      .select('*')
      .neq('status', 'draft')
      .limit(2);

    if (notDraftError) {
      console.error('❌ Non-draft lessons query failed:', notDraftError.message);
    } else {
      console.log(`✅ Non-draft lessons query working (found ${notDraftTest?.length || 0} lessons)`);
    }

    // Show a sample lesson with all new columns
    console.log('\n📋 Sample lesson with new columns:');
    const { data: sampleLesson } = await supabase
      .from('lessons')
      .select('id, title, status, subject, age_group, is_featured, rating, short_description')
      .limit(1);

    if (sampleLesson && sampleLesson.length > 0) {
      const lesson = sampleLesson[0];
      console.log(`   Title: ${lesson.title}`);
      console.log(`   Status: ${lesson.status}`);
      console.log(`   Subject: ${lesson.subject}`);
      console.log(`   Age Group: ${lesson.age_group}`);
      console.log(`   Featured: ${lesson.is_featured}`);
      console.log(`   Rating: ${lesson.rating}`);
      console.log(`   Short Description: ${lesson.short_description?.substring(0, 100)}...`);
    }

  } catch (error) {
    console.error('💥 Verification failed:', error.message);
  }
}

// Run the verification
verifyMigration().then(() => {
  console.log('\n🏁 Migration verification complete!');
}).catch((error) => {
  console.error('💥 Verification failed:', error);
  process.exit(1);
});