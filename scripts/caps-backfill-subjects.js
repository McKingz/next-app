const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

(async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE) { console.error('Missing SUPABASE_URL or service key'); process.exit(1); }
  const sb = createClient(SUPABASE_URL, SERVICE);

  const { data: docs, error } = await sb
    .from('caps_documents')
    .select('id,title,subject,grade,content_text,file_path')
    .or('subject.ilike.Unknown,subject.is.null')
    .limit(1000);
  if (error) { console.error(error); process.exit(2); }
  if (!docs || docs.length === 0) { console.log('No Unknown subjects to backfill.'); process.exit(0); }

  const subjectRules = [
    // Home Language (HL)
    { re: /afrikaans\s+huistaal|afrikaanse?\s+huistaal|kabv\s+afrikaans|kabv\s+afrikaanse?/i, subject: 'AFRIKAANS HOME LANGUAGE' },
    { re: /english\s+(home\s+language|hl)|home\s+english|english\s+hl/i, subject: 'ENGLISH HOME LANGUAGE' },
    { re: /isizulu\s+(hl|home\s+language)|isi\s*zulu\s+(hl|home\s+language)/i, subject: 'isiZulu' },
    { re: /isixhosa\s+(hl|home\s+language)|isi\s*xhosa\s+(hl|home\s+language)/i, subject: 'isiXhosa' },

    // First Additional Language (FAL)
    { re: /afrikaans\s+(fal|first\s+additional\s+language)|eerste\s+addisionele\s+taal\s+afrikaans/i, subject: 'AFRIKAANS FAL' },
    { re: /english\s+(fal|first\s+additional\s+language)/i, subject: 'ENGLISH FAL' },

    // Core subjects
    { re: /mathematical\s+literacy|maths\s+lit/i, subject: 'MATHEMATICAL LITERACY' },
    { re: /mathematics|maths|wiskunde/i, subject: 'MATHEMATICS' },
    { re: /life\s+sciences|lewenswetenskappe/i, subject: 'LIFE SCIENCES' },
    { re: /physical\s+sciences|fisiese\s+wetenskappe/i, subject: 'PHYSICAL SCIENCES' },
    { re: /natural\s+sciences|natuurwetenskappe/i, subject: 'NATURAL SCIENCES' },
    { re: /social\s+sciences|sosiale\s+wetenskappe/i, subject: 'SOCIAL SCIENCES' },
    { re: /geography|aardrykskunde/i, subject: 'GEOGRAPHY' },
    { re: /history|geskiedenis/i, subject: 'HISTORY' },
    { re: /technology|tegnologie/i, subject: 'TECHNOLOGY' },
    { re: /life\s+orientation|lewensorientering/i, subject: 'LIFE ORIENTATION' },
    { re: /creative\s+arts|kreatiewe\s+kunste/i, subject: 'CREATIVE ARTS' },
    { re: /economics|ekonomie/i, subject: 'ECONOMICS' },
    { re: /business\s+studies|besigheidstudies/i, subject: 'BUSINESS STUDIES' },
    { re: /accounting|rekeningkunde/i, subject: 'ACCOUNTING' },

    // Language-only general
    { re: /isizulu|zulu/i, subject: 'isiZulu' },
    { re: /isixhosa|xhosa/i, subject: 'isiXhosa' },
    { re: /isindebele|ndebele/i, subject: 'isiNdebele' },
  ];
  const gradeRules = [
    { re: /grade\s*r\s*[-–]?\s*3|graad\s*r\s*[-–]?\s*3|foundation\s*phase/i, grade: 'R-3' },
    { re: /grade\s*4\s*[-–]?\s*6|graad\s*4\s*[-–]?\s*6|intermediate\s*phase/i, grade: '4-6' },
    { re: /grade\s*7\s*[-–]?\s*9|graad\s*7\s*[-–]?\s*9|senior\s*phase/i, grade: '7-9' },
    { re: /grade\s*1?0\s*[-–]?\s*12|graad\s*1?0\s*[-–]?\s*12|fet\s*phase/i, grade: '10-12' },
  ];

  const updates = [];
  for (const d of docs) {
    const hay = [d.title, d.file_path, d.content_text].filter(Boolean).join(' \n ').slice(0, 100000);

    // Prefer file_path tokens when available
    const path = (d.file_path || '').toLowerCase();
    let subject = d.subject && d.subject.toLowerCase() !== 'unknown' ? d.subject : undefined;
    if (!subject) {
      if (path.includes('/english_hl/')) subject = 'ENGLISH HOME LANGUAGE';
      else if (path.includes('/afrikaans_home_language/')) subject = 'AFRIKAANS HOME LANGUAGE';
      else if (path.includes('/math') || path.includes('/wiskunde')) subject = 'MATHEMATICS';
      else if (path.includes('/isizulu') || path.includes('/zulu')) subject = 'isiZulu';
      else if (path.includes('/isixhosa') || path.includes('/xhosa')) subject = 'isiXhosa';
    }

    // Fallback to content/title heuristics
    for (const r of subjectRules) { if (!subject && r.re.test(hay)) subject = r.subject; }

    let grade = d.grade;
    for (const r of gradeRules) { if (!grade && r.re.test(hay)) grade = r.grade; }

    // As a last resort, mark as GENERAL if folder path suggests unknown
    if (!subject && path.includes('/unknown/')) subject = 'GENERAL';

    if (subject || grade) updates.push({ id: d.id, subject, grade });
  }

  if (updates.length === 0) { console.log('No candidates inferred.'); process.exit(0); }
  console.log(`Updating ${updates.length} documents...`);

  // Update rows individually to avoid nulling required columns
  for (const u of updates) {
    const payload = {};
    if (u.subject) payload.subject = u.subject;
    if (u.grade) payload.grade = u.grade;
    if (Object.keys(payload).length === 0) continue;
    const { error: upErr } = await sb.from('caps_documents').update(payload).eq('id', u.id);
    if (upErr) { console.error('Update error:', upErr); process.exit(3); }
  }
  console.log('Backfill complete.');
})();
