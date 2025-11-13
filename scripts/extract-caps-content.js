const { createClient } = require('@supabase/supabase-js');
const pdfParseMod = require('pdf-parse');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_TOKEN || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function chunkText(text, maxChars = 1200) {
  const paragraphs = String(text).split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  let idx = 0;
  for (const p of paragraphs) {
    if ((buf + '\n\n' + p).length > maxChars && buf) {
      chunks.push({ index: idx++, content: buf.trim() });
      buf = p;
    } else {
      buf = buf ? buf + '\n\n' + p : p;
    }
  }
  if (buf) chunks.push({ index: idx++, content: buf.trim() });
  return chunks;
}

async function fetchPDFFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function processOne(doc) {
  const started = Date.now();
  console.log(`\n• Processing: ${doc.title} [${doc.grade} • ${doc.subject}]`);
  const buffer = await fetchPDFFromUrl(doc.file_url);
  console.log(`  - Downloaded ${(buffer.length/1024).toFixed(1)} KB`);
  let text, pages;
  if (pdfParseMod && typeof pdfParseMod.PDFParse === 'function') {
    const parser = new pdfParseMod.PDFParse({ data: buffer });
    const result = await parser.getText();
    if (parser.destroy) try { await parser.destroy(); } catch {}
    text = result.text || '';
    pages = result.numpages || 0;
  } else {
    const parseFn = pdfParseMod && pdfParseMod.default ? pdfParseMod.default : pdfParseMod;
    const parsed = await (typeof parseFn === 'function' ? parseFn(buffer) : Promise.reject(new Error('pdf-parse function not available')));
    text = parsed.text || '';
    pages = parsed.numpages || 0;
  }
  console.log(`  - Parsed ${pages || 0} pages, ${text.split(/\s+/).length} words`);

  // Update caps_documents
  const meta = {
    ...(doc.metadata || {}),
    extracted_at: new Date().toISOString(),
    extractor: 'pdf-parse',
    word_count: text.split(/\s+/).filter(Boolean).length,
  };
  const { error: updErr } = await supabaseAdmin
    .from('caps_documents')
    .update({ content_text: text, page_count: pages || null, metadata: meta })
    .eq('id', doc.id);
  if (updErr) throw updErr;
  console.log('  - Updated caps_documents');

  // Create chunks (idempotent: delete existing chunks for doc first)
  await supabaseAdmin.from('caps_content_chunks').delete().eq('document_id', doc.id);
  const chunks = chunkText(text, 1400);
  if (chunks.length) {
    const totalLen = text.length || 1;
    let cumulative = 0;
    const payload = chunks.map(c => {
      const startLen = cumulative;
      cumulative += c.content.length;
      const page_number = pages ? Math.min(Math.max(1, Math.floor((startLen / totalLen) * pages) + 1), pages) : null;
      const heading = c.content.split(/\n/)[0]?.slice(0, 180) || null;
      return {
        document_id: doc.id,
        chunk_index: c.index,
        chunk_type: null,
        heading,
        content: c.content,
        word_count: c.content.split(/\s+/).filter(Boolean).length,
        page_number,
      };
    });
    // Insert in batches to avoid payload limits
    const batchSize = 50;
    for (let i = 0; i < payload.length; i += batchSize) {
      const slice = payload.slice(i, i + batchSize);
      const { error: insErr } = await supabaseAdmin.from('caps_content_chunks').insert(slice);
      if (insErr) throw insErr;
      await sleep(100);
    }
    console.log(`  - Inserted ${payload.length} chunks`);
  } else {
    console.log('  - No chunks generated (text too small)');
  }

  console.log(`  ✓ Done in ${((Date.now()-started)/1000).toFixed(1)}s`);
}

async function main() {
  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5;

  // Pull candidates where content_text is null/empty or page_count missing
  const { data, error } = await supabaseAdmin
    .from('caps_documents')
    .select('id,title,grade,subject,file_url,metadata,content_text,page_count,created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  const candidates = (data || []).filter(d => !d.content_text || d.content_text.length < 10 || !d.page_count || d.page_count === 0).slice(0, limit);
  if (!candidates.length) {
    console.log('No documents require extraction.');
    return;
  }

  console.log(`Found ${candidates.length} documents to extract (showing up to ${limit}).`);
  for (const doc of candidates) {
    try {
      await processOne(doc);
    } catch (e) {
      console.error('  ✗ Failed:', e.message || e);
    }
  }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
