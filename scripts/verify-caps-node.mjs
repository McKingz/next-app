#!/usr/bin/env node
/**
 * CAPS Integration Verification (Node.js compatible)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY not set in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('═══════════════════════════════════════════════');
console.log('   CAPS Integration Verification');
console.log('═══════════════════════════════════════════════\n');

async function verifyDatabase() {
  console.log('🗄️  1. Verifying Database Connection...\n');
  
  try {
    // Test if caps_curriculum table exists and has data
    const { data, error, count } = await supabase
      .from('caps_documents')
      .select('id, title, grade, subject', { count: 'exact' })
      .limit(3);
    
    if (error) {
      console.error('   ❌ Database query failed:', error.message);
      return false;
    }
    
    console.log(`   Total CAPS documents: ${count || 0}`);
    
    if (data && data.length > 0) {
      console.log('   Sample documents:');
      data.forEach(doc => {
        console.log(`     • ${doc.title} (Grade: ${doc.grade}, Subject: ${doc.subject})`);
      });
      console.log('   ✅ Database connection working\n');
      return true;
    } else {
      console.warn('   ⚠️  No documents found (database empty?)\n');
      return true; // Not a failure
    }
  } catch (error) {
    console.error('   ❌ Database connection failed:', error.message);
    return false;
  }
}

async function verifySearch() {
  console.log('🔍 2. Verifying Search Functionality...\n');
  
  try {
    const { data, error } = await supabase
      .from('caps_documents')
      .select('id, title, grade, subject')
      .ilike('title', '%Mathematics%')
      .limit(3);
    
    if (error) {
      console.error('   ❌ Search failed:', error.message);
      return false;
    }
    
    console.log(`   Search for "Mathematics" returned ${data?.length || 0} results`);
    if (data && data.length > 0) {
      console.log(`   Sample: ${data[0].title}`);
    }
    console.log('   ✅ Search working\n');
    return true;
  } catch (error) {
    console.error('   ❌ Search threw error:', error.message);
    return false;
  }
}

async function verifyGradeSubjects() {
  console.log('📚 3. Verifying Grade/Subject Queries...\n');
  
  try {
    const { data, error } = await supabase
      .from('caps_documents')
      .select('subject, grade')
      .eq('grade', '10-12')
      .limit(10);
    
    if (error) {
      console.error('   ❌ Grade query failed:', error.message);
      return false;
    }
    
    const subjects = [...new Set(data?.map(d => d.subject) || [])];
    console.log(`   Grade 10-12 subjects found: ${subjects.length}`);
    if (subjects.length > 0) {
      console.log(`   Subjects: ${subjects.join(', ')}`);
    }
    console.log('   ✅ Grade/subject queries working\n');
    return true;
  } catch (error) {
    console.error('   ❌ Query threw error:', error.message);
    return false;
  }
}

async function main() {
  const results = {
    database: await verifyDatabase(),
    search: await verifySearch(),
    gradeSubjects: await verifyGradeSubjects(),
  };
  
  console.log('═══════════════════════════════════════════════');
  console.log('   RESULTS');
  console.log('═══════════════════════════════════════════════\n');
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}`);
  });
  
  const allPassed = Object.values(results).every(v => v);
  
  console.log('\n═══════════════════════════════════════════════');
  if (allPassed) {
    console.log('   🎉 ALL CHECKS PASSED - Ready for testing!');
    console.log('═══════════════════════════════════════════════\n');
    console.log('Try these test prompts in Dash chat:');
    console.log('  • "Show me Grade 10 Mathematics CAPS documents"');
    console.log('  • "What subjects are available for grades 7-9?"');
    console.log('  • "Search CAPS for Physical Sciences"\n');
  } else {
    console.log('   ❌ SOME CHECKS FAILED - Fix issues before testing');
    console.log('═══════════════════════════════════════════════\n');
  }
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
