#!/usr/bin/env node

/**
 * Fix Lesson Ownership Script
 * 
 * This script checks lesson ownership and fixes teacher associations.
 * Run with: node scripts/fix-lesson-ownership.js
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

async function fixLessonOwnership() {
  console.log('🔍 Checking lesson ownership...\n');

  try {
    // Get all lessons with teacher info
    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, title, teacher_id, preschool_id, is_ai_generated')
      .order('created_at', { ascending: false });

    if (lessonsError) {
      console.error('❌ Error fetching lessons:', lessonsError.message);
      return;
    }

    console.log(`📊 Found ${lessons?.length || 0} total lessons\n`);

    // Group by teacher_id
    const lessonsByTeacher = {};
    lessons?.forEach(lesson => {
      const teacherId = lesson.teacher_id || 'unknown';
      if (!lessonsByTeacher[teacherId]) {
        lessonsByTeacher[teacherId] = [];
      }
      lessonsByTeacher[teacherId].push(lesson);
    });

    console.log('📋 Lessons by teacher:');
    Object.entries(lessonsByTeacher).forEach(([teacherId, teacherLessons]) => {
      console.log(`\nTeacher ID: ${teacherId}`);
      console.log(`  Lesson count: ${teacherLessons.length}`);
      console.log(`  AI Generated: ${teacherLessons.filter(l => l.is_ai_generated).length}`);
      teacherLessons.slice(0, 3).forEach(lesson => {
        console.log(`  - ${lesson.title.substring(0, 50)}...`);
      });
    });

    // Get active teachers to reassign lessons to
    const { data: teachers, error: teachersError } = await supabase
      .from('users')
      .select('id, email, role, preschool_id')
      .eq('role', 'teacher')
      .not('preschool_id', 'is', null)
      .limit(5);

    if (teachersError) {
      console.error('❌ Error fetching teachers:', teachersError.message);
      return;
    }

    console.log('\n📋 Available teachers:');
    teachers?.forEach((teacher, index) => {
      console.log(`${index + 1}. ${teacher.email} (${teacher.id})`);
      console.log(`   Preschool: ${teacher.preschool_id}`);
    });

    // If you want to reassign all lessons to a specific teacher, uncomment below:
    /*
    if (teachers && teachers.length > 0) {
      const targetTeacher = teachers[0]; // First teacher
      console.log(`\n🔄 Reassigning all lessons to ${targetTeacher.email}...`);
      
      const { data: updated, error: updateError } = await supabase
        .from('lessons')
        .update({ 
          teacher_id: targetTeacher.id,
          preschool_id: targetTeacher.preschool_id 
        })
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select('id');
        
      if (updateError) {
        console.error('❌ Error updating lessons:', updateError.message);
      } else {
        console.log(`✅ Updated ${updated?.length || 0} lessons`);
      }
    }
    */

    // Check if lessons have is_ai_generated flag set
    const aiGeneratedCount = lessons?.filter(l => l.is_ai_generated).length || 0;
    console.log(`\n📊 AI Generated lessons: ${aiGeneratedCount}`);
    
    if (aiGeneratedCount === 0) {
      console.log('\n🔧 Setting is_ai_generated flag for all lessons...');
      
      const { data: updated, error: updateError } = await supabase
        .from('lessons')
        .update({ is_ai_generated: true })
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select('id');
        
      if (updateError) {
        console.error('❌ Error updating is_ai_generated:', updateError.message);
      } else {
        console.log(`✅ Updated ${updated?.length || 0} lessons with AI flag`);
      }
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

// Run the script
fixLessonOwnership().then(() => {
  console.log('\n🏁 Ownership check complete!');
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});