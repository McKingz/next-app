#!/usr/bin/env node
/**
 * CAPS Database Seeding Verification Script
 * 
 * Comprehensive check to verify all CAPS content is properly seeded
 * Usage: node scripts/verify-caps-seeding.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get Supabase credentials
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Formatting helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function section(title) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${title}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

function status(ok) {
  return ok ? `${colors.green}✅${colors.reset}` : `${colors.red}❌${colors.reset}`;
}

function warning() {
  return `${colors.yellow}⚠️${colors.reset}`;
}

// Verification functions
async function checkTableExists(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    return !error;
  } catch (e) {
    return false;
  }
}

async function getTableCount(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.error(`  Error counting ${tableName}:`, e.message);
    return 0;
  }
}

async function verifyTableExistence() {
  section('1️⃣  CHECKING TABLE EXISTENCE');
  
  const tables = [
    'caps_documents',
    'caps_content_chunks',
    'caps_exam_questions',
    'caps_exam_patterns',
    'dash_curriculum_memory'
  ];
  
  let allExist = true;
  
  for (const table of tables) {
    const exists = await checkTableExists(table);
    console.log(`  ${status(exists)} ${table}`);
    if (!exists) allExist = false;
  }
  
  return allExist;
}

async function verifyRecordCounts() {
  section('2️⃣  TOTAL RECORD COUNTS');
  
  const tables = [
    'caps_documents',
    'caps_content_chunks',
    'caps_exam_questions',
    'caps_exam_patterns',
    'dash_curriculum_memory'
  ];
  
  const counts = {};
  
  for (const table of tables) {
    const count = await getTableCount(table);
    counts[table] = count;
    
    const statusIcon = count === 0 ? warning() : count < 10 ? warning() : status(true);
    const statusText = count === 0 ? 'EMPTY' : count < 10 ? 'LOW DATA' : 'GOOD';
    
    console.log(`  ${statusIcon} ${table.padEnd(30)} ${String(count).padStart(6)} records  [${statusText}]`);
  }
  
  return counts;
}

async function verifyDocumentsByType() {
  section('3️⃣  CAPS DOCUMENTS BY TYPE');
  
  const { data, error } = await supabase.rpc('get_caps_documents_by_type', {}, { count: 'exact' });
  
  if (error) {
    // Fallback if RPC doesn't exist
    const { data: docs, error: err } = await supabase
      .from('caps_documents')
      .select('document_type, content_text, page_count');
    
    if (err || !docs) {
      console.log(`  ${warning()} Could not fetch document types`);
      return;
    }
    
    const typeStats = {};
    docs.forEach(doc => {
      if (!typeStats[doc.document_type]) {
        typeStats[doc.document_type] = { count: 0, totalLength: 0, totalPages: 0 };
      }
      typeStats[doc.document_type].count++;
      typeStats[doc.document_type].totalLength += doc.content_text?.length || 0;
      typeStats[doc.document_type].totalPages += doc.page_count || 0;
    });
    
    console.log('  Type'.padEnd(20) + 'Count'.padStart(8) + 'Avg Content'.padStart(15) + 'Avg Pages'.padStart(12));
    console.log('  ' + '-'.repeat(54));
    
    Object.entries(typeStats).forEach(([type, stats]) => {
      const avgContent = Math.round(stats.totalLength / stats.count);
      const avgPages = (stats.totalPages / stats.count).toFixed(1);
      console.log(
        `  ${type.padEnd(20)}${String(stats.count).padStart(8)}${String(avgContent).padStart(15)}${String(avgPages).padStart(12)}`
      );
    });
    
    return;
  }
  
  console.log('  Type'.padEnd(20) + 'Count'.padStart(8));
  console.log('  ' + '-'.repeat(28));
  data.forEach(row => {
    console.log(`  ${row.document_type.padEnd(20)}${String(row.count).padStart(8)}`);
  });
}

async function verifyCoverageByGrade() {
  section('4️⃣  CURRICULUM COVERAGE BY GRADE');
  
  const { data, error } = await supabase
    .from('caps_documents')
    .select('grade, subject, document_type');
  
  if (error || !data) {
    console.log(`  ${warning()} Could not fetch grade coverage`);
    return;
  }
  
  const gradeStats = {};
  data.forEach(doc => {
    if (!gradeStats[doc.grade]) {
      gradeStats[doc.grade] = {
        subjects: new Set(),
        total: 0,
        curriculum: 0,
        exams: 0
      };
    }
    gradeStats[doc.grade].subjects.add(doc.subject);
    gradeStats[doc.grade].total++;
    if (doc.document_type === 'curriculum') gradeStats[doc.grade].curriculum++;
    if (doc.document_type === 'exam') gradeStats[doc.grade].exams++;
  });
  
  console.log('  Grade'.padEnd(8) + 'Subjects'.padStart(10) + 'Total'.padStart(10) + 'Curriculum'.padStart(12) + 'Exams'.padStart(10));
  console.log('  ' + '-'.repeat(50));
  
  const sortedGrades = Object.keys(gradeStats).sort((a, b) => {
    if (a === 'R') return -1;
    if (b === 'R') return 1;
    return parseInt(a) - parseInt(b);
  });
  
  sortedGrades.forEach(grade => {
    const stats = gradeStats[grade];
    console.log(
      `  ${grade.padEnd(8)}${String(stats.subjects.size).padStart(10)}` +
      `${String(stats.total).padStart(10)}${String(stats.curriculum).padStart(12)}` +
      `${String(stats.exams).padStart(10)}`
    );
  });
}

async function verifyCoverageBySubject() {
  section('5️⃣  DOCUMENT COVERAGE BY SUBJECT');
  
  const { data, error } = await supabase
    .from('caps_documents')
    .select('subject, grade, document_type');
  
  if (error || !data) {
    console.log(`  ${warning()} Could not fetch subject coverage`);
    return;
  }
  
  const subjectStats = {};
  data.forEach(doc => {
    if (!subjectStats[doc.subject]) {
      subjectStats[doc.subject] = {
        total: 0,
        grades: new Set(),
        types: new Set()
      };
    }
    subjectStats[doc.subject].total++;
    subjectStats[doc.subject].grades.add(doc.grade);
    subjectStats[doc.subject].types.add(doc.document_type);
  });
  
  console.log('  Subject'.padEnd(25) + 'Docs'.padStart(8) + 'Grades'.padStart(10) + 'Types'.padStart(8));
  console.log('  ' + '-'.repeat(51));
  
  const sortedSubjects = Object.entries(subjectStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15);
  
  sortedSubjects.forEach(([subject, stats]) => {
    console.log(
      `  ${subject.substring(0, 24).padEnd(25)}${String(stats.total).padStart(8)}` +
      `${String(stats.grades.size).padStart(10)}${String(stats.types.size).padStart(8)}`
    );
  });
}

async function verifyContentQuality() {
  section('6️⃣  CONTENT QUALITY CHECKS');
  
  const checks = [
    {
      name: 'Documents with empty content',
      query: supabase.from('caps_documents').select('id', { count: 'exact', head: true })
        .or('content_text.is.null,content_text.eq.')
    },
    {
      name: 'Documents with short content (<100 chars)',
      async: async () => {
        const { data } = await supabase.from('caps_documents').select('content_text');
        return data?.filter(d => (d.content_text?.length || 0) < 100).length || 0;
      }
    },
    {
      name: 'Documents with no file_url',
      query: supabase.from('caps_documents').select('id', { count: 'exact', head: true })
        .or('file_url.is.null,file_url.eq.')
    },
    {
      name: 'Documents with no subject',
      query: supabase.from('caps_documents').select('id', { count: 'exact', head: true })
        .or('subject.is.null,subject.eq.')
    },
    {
      name: 'Documents with no grade',
      query: supabase.from('caps_documents').select('id', { count: 'exact', head: true })
        .or('grade.is.null,grade.eq.')
    }
  ];
  
  for (const check of checks) {
    let count;
    if (check.query) {
      const { count: c, error } = await check.query;
      count = error ? -1 : (c || 0);
    } else if (check.async) {
      count = await check.async();
    }
    
    const statusIcon = count === 0 ? status(true) : count === -1 ? warning() : warning();
    const statusText = count === 0 ? 'PASS' : count === -1 ? 'ERROR' : 'ISSUES FOUND';
    
    console.log(`  ${statusIcon} ${check.name.padEnd(40)} ${String(count).padStart(5)} [${statusText}]`);
  }
}

async function verifyExamQuestions() {
  section('7️⃣  EXAM QUESTIONS BANK');
  
  const { data, error } = await supabase
    .from('caps_exam_questions')
    .select('grade, subject, marks, year');
  
  if (error || !data || data.length === 0) {
    console.log(`  ${warning()} No exam questions found or error fetching`);
    return;
  }
  
  const questionStats = {};
  data.forEach(q => {
    const key = `${q.grade}-${q.subject}`;
    if (!questionStats[key]) {
      questionStats[key] = {
        grade: q.grade,
        subject: q.subject,
        count: 0,
        totalMarks: 0,
        years: new Set()
      };
    }
    questionStats[key].count++;
    questionStats[key].totalMarks += q.marks || 0;
    if (q.year) questionStats[key].years.add(q.year);
  });
  
  console.log('  Grade'.padEnd(8) + 'Subject'.padEnd(25) + 'Questions'.padStart(10) + 'Avg Marks'.padStart(12) + 'Years'.padStart(8));
  console.log('  ' + '-'.repeat(63));
  
  const sorted = Object.values(questionStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  sorted.forEach(stats => {
    const avgMarks = (stats.totalMarks / stats.count).toFixed(1);
    console.log(
      `  ${stats.grade.padEnd(8)}${stats.subject.substring(0, 24).padEnd(25)}` +
      `${String(stats.count).padStart(10)}${String(avgMarks).padStart(12)}` +
      `${String(stats.years.size).padStart(8)}`
    );
  });
}

async function verifyContentChunks() {
  section('8️⃣  CONTENT CHUNKS STATUS');
  
  const { data: chunks } = await supabase
    .from('caps_content_chunks')
    .select('document_id, content');
  
  const { data: docs } = await supabase
    .from('caps_documents')
    .select('id, document_type');
  
  if (!chunks || !docs) {
    console.log(`  ${warning()} Could not fetch chunk data`);
    return;
  }
  
  const chunkStats = {};
  const docTypes = {};
  
  docs.forEach(doc => {
    docTypes[doc.id] = doc.document_type;
  });
  
  chunks.forEach(chunk => {
    const type = docTypes[chunk.document_id] || 'unknown';
    if (!chunkStats[type]) {
      chunkStats[type] = {
        docs: new Set(),
        chunks: 0,
        totalSize: 0
      };
    }
    chunkStats[type].docs.add(chunk.document_id);
    chunkStats[type].chunks++;
    chunkStats[type].totalSize += chunk.content?.length || 0;
  });
  
  console.log('  Type'.padEnd(20) + 'Docs'.padStart(8) + 'Chunks'.padStart(10) + 'Avg Size'.padStart(12) + 'Per Doc'.padStart(10));
  console.log('  ' + '-'.repeat(60));
  
  Object.entries(chunkStats).forEach(([type, stats]) => {
    const avgSize = Math.round(stats.totalSize / stats.chunks);
    const perDoc = (stats.chunks / stats.docs.size).toFixed(1);
    console.log(
      `  ${type.padEnd(20)}${String(stats.docs.size).padStart(8)}` +
      `${String(stats.chunks).padStart(10)}${String(avgSize).padStart(12)}` +
      `${String(perDoc).padStart(10)}`
    );
  });
}

async function verifyRecentActivity() {
  section('9️⃣  RECENT ACTIVITY');
  
  const tables = [
    { name: 'caps_documents', label: 'Most recent document added' },
    { name: 'caps_content_chunks', label: 'Most recent chunk added' },
    { name: 'caps_exam_questions', label: 'Most recent question added' }
  ];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table.name)
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error || !data || data.length === 0) {
      console.log(`  ${warning()} ${table.label}: No data`);
    } else {
      const date = new Date(data[0].created_at);
      const formatted = date.toISOString().replace('T', ' ').substring(0, 19);
      const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  ${status(true)} ${table.label}: ${formatted} (${daysAgo} days ago)`);
    }
  }
}

async function showSampleDocuments() {
  section('🔟 SAMPLE DOCUMENTS');
  
  const { data, error } = await supabase
    .from('caps_documents')
    .select('title, grade, subject, document_type, content_text')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error || !data || data.length === 0) {
    console.log(`  ${warning()} No documents found`);
    return;
  }
  
  data.forEach((doc, idx) => {
    const titlePreview = doc.title?.substring(0, 50) || 'Untitled';
    const contentLength = doc.content_text?.length || 0;
    console.log(`  ${idx + 1}. ${titlePreview}`);
    console.log(`     Grade: ${doc.grade} | Subject: ${doc.subject} | Type: ${doc.document_type}`);
    console.log(`     Content: ${contentLength.toLocaleString()} characters\n`);
  });
}

async function calculateCompletenessScore() {
  section('📊 OVERALL COMPLETENESS SCORE');
  
  const docCount = await getTableCount('caps_documents');
  const chunkCount = await getTableCount('caps_content_chunks');
  const questionCount = await getTableCount('caps_exam_questions');
  
  const { data: grades } = await supabase
    .from('caps_documents')
    .select('grade');
  const gradeCoverage = new Set(grades?.map(g => g.grade)).size || 0;
  
  const { data: subjects } = await supabase
    .from('caps_documents')
    .select('subject');
  const subjectCoverage = new Set(subjects?.map(s => s.subject)).size || 0;
  
  console.log(`  📄 Documents:       ${docCount.toLocaleString()}`);
  console.log(`  🔎 Content chunks:  ${chunkCount.toLocaleString()}`);
  console.log(`  ❓ Exam questions:  ${questionCount.toLocaleString()}`);
  console.log(`  📚 Grades covered:  ${gradeCoverage}`);
  console.log(`  📖 Subjects:        ${subjectCoverage}`);
  console.log('');
  
  let overallStatus;
  let statusIcon;
  if (docCount >= 100 && chunkCount >= 500) {
    overallStatus = 'EXCELLENT - Database is well populated';
    statusIcon = status(true);
  } else if (docCount >= 50 && chunkCount >= 200) {
    overallStatus = 'GOOD - Sufficient data for most use cases';
    statusIcon = status(true);
  } else if (docCount >= 20 && chunkCount >= 50) {
    overallStatus = 'PARTIAL - More content needed';
    statusIcon = warning();
  } else {
    overallStatus = 'INSUFFICIENT - Database needs seeding';
    statusIcon = status(false);
  }
  
  console.log(`  ${statusIcon} Overall Status: ${overallStatus}`);
  
  return {
    docCount,
    chunkCount,
    questionCount,
    gradeCoverage,
    subjectCoverage,
    overallStatus
  };
}

// Main execution
async function main() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        CAPS DATABASE SEEDING VERIFICATION REPORT           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  
  try {
    const tablesExist = await verifyTableExistence();
    if (!tablesExist) {
      console.log(`\n${colors.red}❌ Some required tables are missing!${colors.reset}`);
      console.log('Run the CAPS migration first: 20251019204500_caps_curriculum_memory_bank.sql');
      process.exit(1);
    }
    
    const counts = await verifyRecordCounts();
    await verifyDocumentsByType();
    await verifyCoverageByGrade();
    await verifyCoverageBySubject();
    await verifyContentQuality();
    await verifyExamQuestions();
    await verifyContentChunks();
    await verifyRecentActivity();
    await showSampleDocuments();
    const score = await calculateCompletenessScore();
    
    section('✅ VERIFICATION COMPLETE');
    
    console.log(`${colors.bright}Summary:${colors.reset}`);
    console.log(`  • All required tables exist: ${status(tablesExist)}`);
    console.log(`  • Total documents: ${counts.caps_documents}`);
    console.log(`  • Content chunks: ${counts.caps_content_chunks}`);
    console.log(`  • Status: ${score.overallStatus}`);
    console.log('');
    
    // Exit code based on completeness
    if (counts.caps_documents === 0) {
      console.log(`${colors.yellow}⚠️  Database appears to be empty. Run seeding scripts.${colors.reset}`);
      process.exit(2);
    }
    
    console.log(`${colors.green}✅ Verification completed successfully${colors.reset}\n`);
    process.exit(0);
    
  } catch (error) {
    console.error(`\n${colors.red}❌ Verification failed:${colors.reset}`, error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the verification
if (require.main === module) {
  main();
}

module.exports = { main };
