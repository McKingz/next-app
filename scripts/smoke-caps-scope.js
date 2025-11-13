#!/usr/bin/env node
/**
 * Smoke test: CAPS scope lookup with page hints
 * Usage: node scripts/smoke-caps-scope.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  if (!URL || !KEY) {
    console.error('Missing Supabase env: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(2);
  }
  const s = createClient(URL, KEY);

  const query = 'coal formation uses mining environment';
  const grade = '4-6';

  console.log(`🔎 CAPS smoke test: q="${query}", grade=${grade}`);
  const { data, error } = await s.rpc('search_caps_curriculum', {
    search_query: query,
    search_grade: grade,
    search_subject: null,
    result_limit: 5,
  });
  if (error) throw error;
  if (!data || data.length === 0) {
    console.log('⚠️  No CAPS documents found');
    process.exit(1);
  }

  // Use 'coal' as primary keyword for this scope
  const keyword = 'coal';

  for (const row of data.slice(0, 3)) {
    const { data: chunk } = await s
      .from('caps_content_chunks')
      .select('page_number, chunk_index')
      .eq('document_id', row.id)
      .ilike('content', `%${keyword}%`)
      .order('chunk_index', { ascending: true })
      .limit(1)
      .maybeSingle();

    let pageLabel = '—';
    if (chunk?.page_number) pageLabel = String(chunk.page_number);
    else if (typeof chunk?.chunk_index === 'number') pageLabel = `~${chunk.chunk_index + 1}`;

    console.log(`• ${row.subject} • ${row.title}`);
    console.log(`  page: ${pageLabel}  url: ${row.file_url}`);
  }

  console.log('✅ Smoke test complete');
}

main().catch(e => { console.error('❌ Smoke test failed:', e.message || e); process.exit(1); });
