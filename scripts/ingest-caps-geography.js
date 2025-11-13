#!/usr/bin/env node
/**
 * Ingest CAPS Social Sciences Geography (Intermediate Phase 4-6)
 * - Scrapes DBE Intermediate CAPS page
 * - Resolves LinkClick redirects
 * - Filters for GEOGRAPHY documents
 * - Uploads to Supabase Storage and inserts caps_documents rows
 */

const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const BASE = 'https://www.education.gov.za';
const PAGE = '/Curriculum/CurriculumAssessmentPolicyStatements(CAPS)/CAPSIntermediate.aspx';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase admin env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function subjectFromFilename(name) {
  const s = name.toUpperCase();
  if (s.includes('GEOGRAPH')) return 'Social Sciences Geography';
  if (s.includes('SOCIAL') && s.includes('SCIENCE')) return 'Social Sciences';
  return 'Unknown';
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === 'caps-curriculum');
  if (!exists) {
    await supabase.storage.createBucket('caps-curriculum', { public: true, fileSizeLimit: 52428800, allowedMimeTypes: ['application/pdf'] });
  }
}

async function resolveLinkClick(url) {
  const res = await fetch(url, { redirect: 'manual' });
  const loc = res.headers.get('location');
  if (!loc) throw new Error('No redirect location');
  const finalUrl = loc.startsWith('http') ? loc : BASE + loc;
  const filename = finalUrl.split('/').pop()?.split('?')[0] || 'unknown.pdf';
  return { finalUrl, filename };
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadAndInsert({ buffer, filename, sourceUrl }) {
  const subject = subjectFromFilename(filename);
  if (/unknown/i.test(subject)) return false; // skip unknowns; ingest Social Sciences & Geography

  // Use decoded, normalized filename to avoid double-encoding in public URLs
  const cleanName = decodeURIComponent(filename).replace(/\s+/g, '_').toLowerCase();
  const storagePath = `4-6/${subject.toLowerCase().replace(/\s+/g, '_')}/curriculum/${cleanName}`;
  const { error: upErr } = await supabase.storage.from('caps-curriculum').upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });
  if (upErr) throw upErr;
  const { data: urlData } = supabase.storage.from('caps-curriculum').getPublicUrl(storagePath);
  const title = `${subject} CAPS Intermediate Phase (Grade 4-6)`;

  const { error: insErr } = await supabase.from('caps_documents').insert({
    document_type: 'curriculum',
    grade: '4-6',
    subject,
    title,
    content_text: '',
    file_url: urlData.publicUrl,
    file_path: storagePath,
    source_url: sourceUrl,
    language: 'en',
    metadata: { downloaded_at: new Date().toISOString(), source: 'dbe_website' }
  });
  if (insErr) throw insErr;
  return true;
}

(async function main() {
  try {
    await ensureBucket();
    const html = await (await fetch(BASE + PAGE)).text();
    const linkRegex = /href="(\/LinkClick\.aspx\?fileticket=[^"]+)"/g;
    const matches = [...html.matchAll(linkRegex)];
    let found = 0, inserted = 0;
    for (const m of matches) {
      const relative = m[1].replace(/&amp;/g, '&').replace(/&forcedownload=true/, '');
      const link = BASE + relative;
      try {
        const { finalUrl, filename } = await resolveLinkClick(link);
        if (!/geograph/i.test(filename) && !/social/i.test(filename)) continue; // pre-filter to reduce traffic
        found++;
        console.log(`Candidate: ${filename} -> ${finalUrl}`);
        const buf = await download(finalUrl);
        const ok = await uploadAndInsert({ buffer: buf, filename, sourceUrl: finalUrl });
        if (ok) {
          inserted++;
          console.log(`✓ Ingested: ${filename}`);
        } else {
          console.log(`✗ Skipped (subject not geography): ${filename}`);
        }
      } catch (e) {
        console.log(`✗ Error processing link: ${e.message || e}`);
      }
      if (inserted >= 3) break; // limit
    }
    console.log(`Done. Geography links found: ${found}, inserted: ${inserted}`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Failed:', e.message || e);
    process.exit(1);
  }
})();
