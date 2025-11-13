/**
 * DashCAPSKnowledge Service
 * 
 * Provides access to South African CAPS curriculum documents and exam resources.
 * Integrates with Supabase database containing official DBE materials.
 */

import { assertSupabase } from '../lib/supabase';

/**
 * Map individual grade to grade range in database
 */
function mapGradeToRange(grade: string): string {
  // Normalize whitespace and unicode dashes to simple hyphen
  const raw = String(grade || '').trim();
  const upper = raw.toUpperCase();
  const normalized = upper.replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, '');
  // Accept direct range inputs (R-3, 4-6, 7-9, 10-12)
  if (/^(R-3|4-6|7-9|10-12)$/.test(normalized)) {
    return normalized;
  }
  // Single grade to range mapping
  if (normalized === 'R' || /^(0|1|2|3)$/.test(normalized)) return 'R-3';
  if (/^[4-6]$/.test(normalized)) return '4-6';
  if (/^[7-9]$/.test(normalized)) return '7-9';
  if (/^(10|11|12)$/.test(normalized)) return '10-12';
  // Fallback: if someone typed like "GradeR-3" or "GRADEX-6" strip non [0-9R-] safely
  const cleaned = normalized.replace(/[^0-9R-]/g, '');
  if (/^(R-3|4-6|7-9|10-12)$/.test(cleaned)) return cleaned;
  return normalized;
}

/**
 * Normalize subject name to match database format
 */
function normalizeSubject(subject: string): string {
  const lower = String(subject || '').toLowerCase();
  
  // Use substrings that match common DB values via ILIKE
  if (lower.includes('math')) return 'math'; // matches 'Mathematics'
  if (lower.includes('english')) return 'english';
  if (lower.includes('afrikaans')) return 'afrikaans';
  if (lower.includes('physical')) return 'physical'; // Physical Sciences
  if (lower.includes('life science')) return 'life'; // Life Sciences
  if (lower.includes('life skills')) return 'life skills';
  if (lower.includes('social') || /\bss\b/.test(lower)) return 'social'; // Social Sciences / SS
  if (lower.includes('geograph') || lower === 'geo') return 'geograph'; // Geography within Social Sciences
  if (lower.includes('history')) return 'history';
  if (lower.includes('technology') || lower.includes('tech')) return 'tech';
  if (lower.includes('isindebele') || lower.includes('ndebele')) return 'ndebele';
  
  return lower; // fallback to lowercase subject string for ILIKE
}

export interface CAPSDocument {
  id: string;
  document_type: 'curriculum' | 'exam' | 'exemplar' | 'guideline';
  grade: string;
  subject: string;
  title: string;
  file_url: string;
  source_url?: string;
  year?: number;
  metadata?: Record<string, any>;
  page_hint?: number; // approximate page number for the match (if available)
}

export interface CAPSSearchResult {
  document: CAPSDocument;
  relevance_score?: number;
  excerpt?: string;
}

export interface CAPSSearchOptions {
  grade?: string;
  subject?: string;
  document_type?: string;
  limit?: number;
}

/**
 * Search CAPS curriculum documents by query and filters
 * 
 * @param query - Search query (topic, concept, learning outcome)
 * @param options - Filter options (grade, subject, type)
 * @returns Array of matching documents with relevance
 */
// Heuristic: pick a keyword from the query to search inside chunks
function extractKeyword(q: string): string | null {
  const words = String(q || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4)
    .sort((a, b) => b.length - a.length);
  return words[0] || null;
}

async function addPageHints(
  supabase: any,
  docs: CAPSSearchResult[],
  keyword: string | null
): Promise<CAPSSearchResult[]> {
  if (!keyword) return docs;
  try {
    for (const r of docs) {
      // Lookup nearest chunk containing the keyword
      const { data: chunk, error } = await supabase
        .from('caps_content_chunks')
        .select('page_number, chunk_index')
        .eq('document_id', r.document.id)
        .ilike('content', `%${keyword}%`)
        .order('chunk_index', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!error && chunk && chunk.page_number) {
        r.document.page_hint = chunk.page_number;
      }
    }
  } catch {
    // Non-fatal; ignore
  }
  return docs;
}

export async function searchCurriculum(
  query: string,
  options: CAPSSearchOptions = {}
): Promise<CAPSSearchResult[]> {
  const { grade, subject, document_type, limit = 10 } = options;

  try {
    const supabase = assertSupabase();

    // Augment query with subject synonyms to improve FTS hits
    const synonyms: string[] = [];
    if (subject) {
      const s = subject.toLowerCase();
      if (/(social|\bss\b)/i.test(s)) synonyms.push('"social sciences"', '"social science"', 'geography', 'history');
      if (/geograph/i.test(s)) synonyms.push('geography', '"social sciences"');
      if (/math/i.test(s)) synonyms.push('mathematics', 'math');
      if (/english/i.test(s)) synonyms.push('english');
    }
    const augmentedQuery = [query, ...synonyms].filter(Boolean).join(' ');

    // Map grade to range for equality in SQL function
    const gradeRange = grade ? mapGradeToRange(grade) : null;

    // Prefer SQL function for ranked full‑text search
    const { data, error } = await supabase.rpc('search_caps_curriculum', {
      search_query: augmentedQuery,
      search_grade: gradeRange, // null means no filter
      // search_subject uses equality in SQL; avoid passing fuzzy string to not over‑filter
      search_subject: null,
      result_limit: limit,
    });

    if (error) {
      console.warn('[DashCAPSKnowledge] RPC search_caps_curriculum failed, falling back to basic query:', error.message || error);
      // Fallback: basic filter on caps_documents
      let qb = supabase.from('caps_documents').select('*');
      if (gradeRange) qb = qb.eq('grade', gradeRange);
      if (subject) qb = qb.ilike('subject', `%${normalizeSubject(subject)}%`);
      if (document_type) qb = qb.eq('document_type', document_type);
      if (augmentedQuery) qb = qb.or(`title.ilike.%${augmentedQuery}%,subject.ilike.%${augmentedQuery}%`);
      qb = qb.limit(limit);
      const { data: basic, error: basicErr } = await qb;
      if (basicErr) throw basicErr;
      const mapped = (basic || []).map((doc: any) => ({
        document: {
          id: doc.id,
          document_type: doc.document_type,
          grade: doc.grade,
          subject: doc.subject,
          title: doc.title,
          file_url: doc.file_url,
          source_url: doc.source_url,
          year: doc.year,
          metadata: doc.metadata,
        },
        relevance_score: 1.0,
        excerpt: doc.preview || undefined,
      }));
      return await addPageHints(supabase, mapped, extractKeyword(augmentedQuery));
    }

    // Map RPC rows
    let mapped: CAPSSearchResult[] = (data || []).map((row: any) => ({
      document: {
        id: row.id,
        document_type: row.document_type,
        grade: row.grade,
        subject: row.subject,
        title: row.title,
        file_url: row.file_url,
      },
      relevance_score: typeof row.relevance_rank === 'number' ? row.relevance_rank : undefined,
      excerpt: row.content_preview || undefined,
    }));

    if (document_type) {
      mapped = mapped.filter(r => r.document.document_type === document_type);
    }

    return await addPageHints(supabase, mapped, extractKeyword(augmentedQuery));
  } catch (error) {
    console.error('[DashCAPSKnowledge] searchCurriculum failed:', error);
    return [];
  }
}

/**
 * Get CAPS documents by grade and subject
 */
export async function getDocumentsByGradeAndSubject(
  grade: string,
  subject: string
): Promise<CAPSDocument[]> {
  try {
    const gradeRange = mapGradeToRange(grade);
    const normalizedSubject = normalizeSubject(subject);
    
    const supabase = assertSupabase();
    const { data, error } = await supabase
      .from('caps_documents')
      .select('*')
      .eq('grade', gradeRange)
      .ilike('subject', `%${normalizedSubject}%`);

    if (error) throw error;

    return (data || []).map(doc => ({
      id: doc.id,
      document_type: doc.document_type,
      grade: doc.grade,
      subject: doc.subject,
      title: doc.title,
      file_url: doc.file_url,
      source_url: doc.source_url,
      year: doc.year,
      metadata: doc.metadata,
    }));
  } catch (error) {
    console.error('[DashCAPSKnowledge] getDocumentsByGradeAndSubject failed:', error);
    return [];
  }
}

/**
 * Get all available subjects for a grade
 */
export async function getSubjectsByGrade(grade: string): Promise<string[]> {
  try {
    const gradeRange = mapGradeToRange(grade);
    
    const supabase = assertSupabase();
    const { data, error } = await supabase
      .from('caps_documents')
      .select('subject')
      .eq('grade', gradeRange);

    if (error) throw error;

    // Deduplicate subjects
    const subjects = [...new Set((data || []).map(d => d.subject).filter(Boolean))];
    return subjects.sort();
  } catch (error) {
    console.error('[DashCAPSKnowledge] getSubjectsByGrade failed:', error);
    return [];
  }
}

/**
 * Get CAPS context for a user message
 * Detects curriculum-related intent and returns relevant documents
 */
export async function getCAPSContext(userMessage: string): Promise<{
  relevant: boolean;
  documents: CAPSSearchResult[];
  detected_grade?: string;
  detected_subject?: string;
}> {
  // Simple intent detection patterns
  const gradePatterns = [
    /grade\s*(r|[1-9]|1[0-2])/i,
    /\b([1-9]|1[0-2])th\s+grade/i,
    /year\s*([1-9]|1[0-2])/i,
  ];

  const subjectPatterns = {
    mathematics: /math|maths|mathematics|algebra|geometry|calculus/i,
    english: /english|language|reading|writing/i,
    science: /science|physics|chemistry|biology|life\s+science/i,
    afrikaans: /afrikaans/i,
    'social sciences': /history|geography|social\s+science/i,
  };

  const curriculumKeywords = /caps|curriculum|syllabus|lesson|learning\s+outcome|assessment|exam|test/i;

  // Detect grade
  let detectedGrade: string | undefined;
  for (const pattern of gradePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      detectedGrade = match[1].toUpperCase();
      break;
    }
  }

  // Detect subject
  let detectedSubject: string | undefined;
  for (const [subject, pattern] of Object.entries(subjectPatterns)) {
    if (pattern.test(userMessage)) {
      detectedSubject = subject;
      break;
    }
  }

  // Check if curriculum-related
  const isRelevant = curriculumKeywords.test(userMessage) || !!(detectedGrade || detectedSubject);

  if (!isRelevant) {
    return { relevant: false, documents: [] };
  }

  // Search for relevant documents
  const documents = await searchCurriculum(userMessage, {
    grade: detectedGrade,
    subject: detectedSubject,
    limit: 5,
  });

  return {
    relevant: true,
    documents,
    detected_grade: detectedGrade,
    detected_subject: detectedSubject,
  };
}

/**
 * Get exam questions by topic (placeholder - requires caps_exam_questions table)
 */
export async function getPastExamQuestions(
  grade: string,
  subject: string,
  topic?: string
): Promise<any[]> {
  // TODO: Implement once exam questions are ingested
  console.warn('[DashCAPSKnowledge] Exam questions not yet available');
  return [];
}

/**
 * Format CAPS document reference for citation
 */
export function formatCAPSReference(doc: CAPSDocument): string {
  const parts = [doc.subject, doc.grade];
  if (doc.year) parts.push(`(${doc.year})`);
  return `${parts.join(' ')} - ${doc.title}`;
}

export default {
  searchCurriculum,
  getDocumentsByGradeAndSubject,
  getSubjectsByGrade,
  getCAPSContext,
  getPastExamQuestions,
  formatCAPSReference,
};
