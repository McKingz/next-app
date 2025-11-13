/**
 * CAPS Curriculum Downloader
 * 
 * Downloads CAPS curriculum documents from DBE website and stores in database
 * Extracts text and creates searchable knowledge base for Dash AI
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Supabase client with service role (admin access)
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// =====================================================
// CAPS Document URLs (Curated List)
// =====================================================

interface CAPSDocument {
  url: string;
  grade: string;
  subject: string;
  type: 'curriculum' | 'exam' | 'exemplar' | 'guideline' | 'teaching_plan';
  title: string;
  year?: number;
  term?: number;
}

// Scraped LinkClick.aspx URLs - subject extracted from PDF filename after redirect
const BASE_URL = 'https://www.education.gov.za';

const CAPS_LINK_TICKETS: Array<{url: string; grade: string; phase: string}> = [
  // Foundation Phase (R-3) - Sample subset for testing
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=j7mNSYBjQX8%3d&tabid=571&portalid=0&mid=13003`, grade: 'R-3', phase: 'Foundation' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=xGwHzRgeMR4%3d&tabid=571&portalid=0&mid=1560`, grade: 'R-3', phase: 'Foundation' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=D86-onzL9kg%3d&tabid=571&portalid=0&mid=1560`, grade: 'R-3', phase: 'Foundation' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=dPcXTeG2f2k%3d&tabid=571&portalid=0&mid=1208`, grade: 'R-3', phase: 'Foundation' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=lMWj7htycnU%3d&tabid=571&portalid=0&mid=1562`, grade: 'R-3', phase: 'Foundation' },
  
  // Intermediate Phase (4-6)
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=AlKuZ-T5ZvQ%3d&tabid=572&portalid=0&mid=13087`, grade: '4-6', phase: 'Intermediate' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=H2w6zb4_CVs%3d&tabid=572&portalid=0&mid=1564`, grade: '4-6', phase: 'Intermediate' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=ze6JhhFYdCg%3d&tabid=572&portalid=0&mid=1564`, grade: '4-6', phase: 'Intermediate' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=dPcXTeG2f2k%3d&tabid=572&portalid=0&mid=1208`, grade: '4-6', phase: 'Intermediate' },
  
  // Senior Phase (7-9)
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=IEUmcVss3wg%3d&tabid=573&portalid=0&mid=13088`, grade: '7-9', phase: 'Senior' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=slLbge-bPMk%3d&tabid=573&portalid=0&mid=1569`, grade: '7-9', phase: 'Senior' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=5xCztldu-Kw%3d&tabid=573&portalid=0&mid=1569`, grade: '7-9', phase: 'Senior' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=dPcXTeG2f2k%3d&tabid=573&portalid=0&mid=1208`, grade: '7-9', phase: 'Senior' },
  
  // FET Phase (10-12) - Core subjects
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=mMkdIZmk3Ow%3d&tabid=570&portalid=0&mid=1555`, grade: '10-12', phase: 'FET' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=WtjOh8RBcU0%3d&tabid=570&portalid=0&mid=1555`, grade: '10-12', phase: 'FET' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=AKAkYh_nuTo%3d&tabid=570&portalid=0&mid=1555`, grade: '10-12', phase: 'FET' },
  { url: `${BASE_URL}/LinkClick.aspx?fileticket=dPcXTeG2f2k%3d&tabid=570&portalid=0&mid=1208`, grade: '10-12', phase: 'FET' },
];

const CAPS_DOCUMENTS: CAPSDocument[] = [
  // Will be populated dynamically from CAPS_LINK_TICKETS after redirect resolution
];

// =====================================================
// Helper Functions
// =====================================================

function extractSubjectFromFilename(filename: string): string {
  // Extract subject from PDF filename patterns
  // Examples: "CAPS FET _ MATHEMATICS _ GR 10-12.pdf", "IP ENGLISH HL GR 4-6.pdf"
  
  const cleaned = decodeURIComponent(filename)
    .replace(/\.pdf$/i, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Try to extract subject from common patterns
  const patterns = [
    /CAPS\s+(?:FET|IP|SP|FP)\s+_\s+([^_]+?)\s+_\s+GR/i,
    /(?:FET|IP|SP|FP)\s+([A-Z][^_\d]+?)\s+(?:GR|CAPS)/i,
    /CAPS\s+([A-Z][^\d]+?)\s+(?:GR|Grade)/i,
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return match[1].trim().replace(/\s+/g, ' ');
    }
  }
  
  // Fallback: take middle section if contains underscores
  const parts = cleaned.split('_').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[1];
  }
  
  return 'Unknown';
}

async function resolveRedirectUrl(linkClickUrl: string): Promise<{finalUrl: string; filename: string}> {
  const response = await fetch(linkClickUrl, { redirect: 'manual' });
  
  if (response.status === 302 || response.status === 301) {
    const location = response.headers.get('location');
    if (location) {
      const fullUrl = location.startsWith('http') ? location : BASE_URL + location;
      const filename = fullUrl.split('/').pop()?.split('?')[0] || 'unknown.pdf';
      return { finalUrl: fullUrl, filename };
    }
  }
  
  throw new Error('No redirect found');
}

// =====================================================
// Download and Process Functions
// =====================================================

async function downloadPDF(url: string): Promise<Buffer> {
  console.log(`  📥 Downloading PDF...`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; pages: number }> {
  console.log(`  📄 Extracting text from PDF...`);
  
  // pdf-parse is CommonJS - use require
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  
  return {
    text: data.text,
    pages: data.numpages
  };
}

async function uploadToStorage(
  buffer: Buffer,
  doc: CAPSDocument
): Promise<{ url: string; path: string }> {
  // Generate storage path
  const filename = `${doc.grade}/${doc.subject.replace(/\s+/g, '_')}/${doc.type}/${doc.title.replace(/\s+/g, '_')}.pdf`
    .toLowerCase();
  
  console.log(`  ☁️  Uploading to storage: ${filename}`);
  
  // Create bucket if it doesn't exist
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === 'caps-curriculum');
  
  if (!bucketExists) {
    console.log('  📦 Creating caps-curriculum bucket...');
    await supabase.storage.createBucket('caps-curriculum', {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['application/pdf']
    });
  }
  
  // Upload file
  const { data, error } = await supabase.storage
    .from('caps-curriculum')
    .upload(filename, buffer, {
      contentType: 'application/pdf',
      upsert: true
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('caps-curriculum')
    .getPublicUrl(filename);
  
  return {
    url: urlData.publicUrl,
    path: filename
  };
}

async function storeInDatabase(
  doc: CAPSDocument,
  storage: { url: string; path: string },
  extracted: { text: string; pages: number }
): Promise<void> {
  console.log(`  💾 Storing in database...`);
  
  const { error } = await supabase
    .from('caps_documents')
    .insert({
      document_type: doc.type,
      grade: doc.grade,
      subject: doc.subject,
      title: doc.title,
      year: doc.year,
      term: doc.term,
      content_text: extracted.text,
      file_url: storage.url,
      file_path: storage.path,
      file_size_bytes: extracted.text.length,
      page_count: extracted.pages,
      source_url: doc.url,
      language: 'en',
      metadata: {
        downloaded_at: new Date().toISOString(),
        source: 'dbe_website',
        word_count: extracted.text.split(/\s+/).length
      }
    });
  
  if (error) throw error;
}

// =====================================================
// Main Download Process
// =====================================================

async function downloadAllDocuments() {
  console.log('🚀 CAPS Curriculum Download Started\n');
  console.log(`📚 Total link tickets to resolve: ${CAPS_LINK_TICKETS.length}\n`);
  
  let successCount = 0;
  let failureCount = 0;
  const errors: Array<{ doc: string; error: string }> = [];
  
  for (let i = 0; i < CAPS_LINK_TICKETS.length; i++) {
    const ticket = CAPS_LINK_TICKETS[i];
    
    console.log(`\n[${i + 1}/${CAPS_LINK_TICKETS.length}] Processing: ${ticket.phase} Phase (Grade ${ticket.grade})`);
    
    try {
      // Step 1: Resolve redirect to get final PDF URL and filename
      console.log(`  🔗 Resolving redirect...`);
      const { finalUrl, filename } = await resolveRedirectUrl(ticket.url);
      const subject = extractSubjectFromFilename(filename);
      console.log(`  ✅ Subject detected: ${subject}`);
      console.log(`  📄 Filename: ${filename}`);
      
      const doc: CAPSDocument = {
        url: finalUrl,
        grade: ticket.grade,
        subject: subject,
        type: 'curriculum',
        title: `${subject} CAPS ${ticket.phase} Phase (Grade ${ticket.grade})`,
      };
      
      // Step 2: Download PDF
      const buffer = await downloadPDF(finalUrl);
      console.log(`  ✅ Downloaded (${(buffer.length / 1024).toFixed(1)} KB)`);
      
      // Step 3: Upload to storage
      const storage = await uploadToStorage(buffer, doc);
      console.log(`  ✅ Uploaded to storage`);
      
      // Step 4: Store metadata in database (text extraction deferred)
      await storeInDatabase(doc, storage, { text: '', pages: 0 });
      console.log(`  ✅ Stored metadata in database`);
      console.log(`  ℹ️  Text extraction will be done server-side`);
      
      successCount++;
      console.log(`  🎉 SUCCESS!`);
      
      // Be nice to DBE servers (rate limiting)
      if (i < CAPS_LINK_TICKETS.length - 1) {
        console.log(`  ⏳ Waiting 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      failureCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ FAILED: ${errorMsg}`);
      errors.push({ doc: `${ticket.phase} ${ticket.grade}`, error: errorMsg });
      
      // Continue with next document
      continue;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DOWNLOAD SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📚 Total: ${CAPS_LINK_TICKETS.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(({ doc, error }) => {
      console.log(`  - ${doc}: ${error}`);
    });
  }
  
  console.log('\n🎉 CAPS curriculum download complete!');
  console.log('💡 Dash can now access CAPS curriculum documents!');
}

// =====================================================
// Run
// =====================================================

if (require.main === module) {
  downloadAllDocuments()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { downloadAllDocuments, CAPS_DOCUMENTS };
