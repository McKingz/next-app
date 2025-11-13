const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase env. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function printCounts() {
  const tables = [
    'caps_documents',
    'caps_content_chunks',
    'caps_exam_questions',
    'caps_exam_patterns',
    'dash_curriculum_memory',
  ];
  console.log('📊 CAPS table counts:');
  for (const t of tables) {
    try {
      const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`  • ${t}: error (${error.message})`);
      } else {
        console.log(`  • ${t}: ${count || 0}`);
      }
    } catch (e) {
      console.log(`  • ${t}: error (${e.message})`);
    }
  }
}

function preview(text = '', n = 500) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n) + '…' : clean;
}

async function printSampleDocuments() {
  console.log('\n📄 Sample CAPS documents with content preview:');
  const { data, error } = await supabase
    .from('caps_documents')
    .select('id,title,grade,subject,document_type,file_url,content_text')
    .limit(2);
  if (error) {
    console.error('  ❌ caps_documents query failed:', error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.log('  ⚠️ No documents found.');
    return;
  }
  for (const d of data) {
    console.log(`  • ${d.title} [${d.grade} • ${d.subject}] (${d.document_type})`);
    if (d.file_url) console.log(`    URL: ${d.file_url}`);
    console.log(`    Content preview: ${preview(d.content_text, 500)}`);
  }
}

async function printSampleChunks() {
  console.log('\n🔎 Sample CAPS content chunks:');
  const { data, error } = await supabase
    .from('caps_content_chunks')
    .select('document_id,chunk_index,heading,content')
    .limit(2);
  if (error) {
    console.error('  ❌ caps_content_chunks query failed:', error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.log('  ⚠️ No chunks found.');
    return;
  }
  for (const c of data) {
    console.log(`  • #${c.chunk_index} ${c.heading || ''}`);
    console.log(`    ${preview(c.content, 300)}`);
  }
}

(async function main() {
  await printCounts();
  await printSampleDocuments();
  await printSampleChunks();
  console.log('\n✅ CAPS content verification complete.');
})();
