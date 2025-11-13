#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

(async () => {
  try {
    if (!url || !key) {
      console.error('❌ Missing Supabase env (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY)');
      process.exit(2);
    }
    const s = createClient(url, key);
    const { data, error } = await s.rpc('search_caps_curriculum', {
      search_query: 'coal formation uses mining environment',
      search_grade: '4-6',
      search_subject: null,
      result_limit: 5,
    });
    if (error) {
      console.error('❌ RPC error:', error.message || error);
      process.exit(1);
    }
    console.log('✅ CAPS search results:');
    for (const r of data || []) {
      console.log(`- [${r.grade}] ${r.subject} • ${r.title} (rank=${r.relevance_rank?.toFixed?.(3) ?? 'n/a'})`);
      if (r.content_preview) console.log(`  preview: ${String(r.content_preview).slice(0,120).replace(/\s+/g,' ')}...`);
      console.log(`  url: ${r.file_url}`);
    }
    process.exit(0);
  } catch (e) {
    console.error('❌ Caught error:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
