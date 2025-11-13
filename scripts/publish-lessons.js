#!/usr/bin/env node

/**
 * Publish Lessons Script
 * 
 * This script updates lesson status to published so they show in Lessons Hub.
 * Run with: node scripts/publish-lessons.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function publishLessons() {
  console.log('📢 Publishing lessons...\n');

  try {
    // Update all lessons to published status
    const { data: updatedLessons, error: updateError } = await supabase
      .from('lessons')
      .update({
        status: 'published',
        is_public: true,
        is_featured: true,
        rating: 4.5
      })
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id, title, status, subject, is_featured');

    if (updateError) {
      console.error('❌ Error updating lessons:', updateError.message);
      return;
    }

    console.log(`✅ Updated ${updatedLessons?.length || 0} lessons to published status\n`);

    if (updatedLessons && updatedLessons.length > 0) {
      console.log('📋 Published lessons:');
      updatedLessons.forEach((lesson, index) => {
        console.log(`${index + 1}. ${lesson.title}`);
        console.log(`   Status: ${lesson.status} | Subject: ${lesson.subject} | Featured: ${lesson.is_featured}`);
        console.log('');
      });
    }

    // Verify the update
    const { data: verification, error: verifyError } = await supabase
      .rpc('verify_lessons_migration');

    if (!verifyError && verification && verification.length > 0) {
      const result = verification[0];
      console.log('📊 Updated Status Breakdown:');
      console.log(JSON.stringify(result.status_breakdown, null, 2));
    }

  } catch (error) {
    console.error('💥 Error publishing lessons:', error.message);
  }
}

// Run the script
publishLessons().then(() => {
  console.log('\n🏁 Lesson publishing complete!');
}).catch((error) => {
  console.error('💥 Publishing failed:', error);
  process.exit(1);
});