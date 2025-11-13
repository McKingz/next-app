#!/usr/bin/env tsx
/**
 * CAPS URL Scraper
 * 
 * Extracts current CAPS document URLs from DBE website by phase
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.education.gov.za';

const PHASE_PAGES = [
  { phase: 'Foundation', grade: 'R-3', url: '/Curriculum/CurriculumAssessmentPolicyStatements(CAPS)/CAPSFoundation.aspx' },
  { phase: 'Intermediate', grade: '4-6', url: '/Curriculum/CurriculumAssessmentPolicyStatements(CAPS)/CAPSIntermediate.aspx' },
  { phase: 'Senior', grade: '7-9', url: '/Curriculum/CurriculumAssessmentPolicyStatements(CAPS)/CAPSSenior.aspx' },
  { phase: 'FET', grade: '10-12', url: '/Curriculum/CurriculumAssessmentPolicyStatements(CAPS)/CAPSFET.aspx' },
];

interface CAPSDocument {
  url: string;
  grade: string;
  subject: string;
  phase: string;
  type: string;
  title: string;
}

async function scrapePage(phase: typeof PHASE_PAGES[0]): Promise<CAPSDocument[]> {
  console.log(`\n📖 Scraping ${phase.phase} Phase (Grades ${phase.grade})...`);
  
  const response = await fetch(BASE_URL + phase.url);
  const html = await response.text();
  
  // Extract LinkClick.aspx URLs with subject context
  const linkRegex = /href="(\/LinkClick\.aspx\?fileticket=[^"]+)"/g;
  const matches = [...html.matchAll(linkRegex)];
  
  console.log(`  Found ${matches.length} download links`);
  
  const documents: CAPSDocument[] = [];
  const seen = new Set<string>();
  
  for (const match of matches) {
    const relativeUrl = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&forcedownload=true/, ''); // Remove force download flag
    
    const fullUrl = BASE_URL + relativeUrl;
    
    // Skip duplicates (forcedownload variants)
    if (seen.has(relativeUrl)) continue;
    seen.add(relativeUrl);
    
    // Extract subject from surrounding HTML context
    const contextStart = Math.max(0, match.index! - 500);
    const contextEnd = Math.min(html.length, match.index! + 200);
    const context = html.substring(contextStart, contextEnd);
    
    // Try to extract subject name from nearby text
    const subjectMatch = context.match(/>([^<>]+)<\/[^>]*>\s*<[^>]*href="\/LinkClick/i);
    const subject = subjectMatch?.[1]?.trim() || 'Unknown';
    
    documents.push({
      url: fullUrl,
      grade: phase.grade,
      subject: subject,
      phase: phase.phase,
      type: 'curriculum',
      title: `${subject} CAPS ${phase.phase} Phase (Grade ${phase.grade})`,
    });
  }
  
  console.log(`  ✓ Extracted ${documents.length} documents`);
  return documents;
}

async function main() {
  console.log('🔍 CAPS URL Scraper\n');
  console.log('Extracting current CAPS document URLs from DBE website...\n');
  
  const allDocuments: CAPSDocument[] = [];
  
  for (const phase of PHASE_PAGES) {
    try {
      const docs = await scrapePage(phase);
      allDocuments.push(...docs);
      
      // Be nice to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ❌ Error scraping ${phase.phase}:`, error);
    }
  }
  
  // Output TypeScript array format
  console.log('\n' + '='.repeat(70));
  console.log(`📊 Total documents found: ${allDocuments.length}`);
  console.log('='.repeat(70));
  
  console.log('\n// Generated CAPS_DOCUMENTS array:');
  console.log('const CAPS_DOCUMENTS: CAPSDocument[] = [');
  
  allDocuments.forEach((doc, i) => {
    console.log(`  {`);
    console.log(`    url: '${doc.url}',`);
    console.log(`    grade: '${doc.grade}',`);
    console.log(`    subject: '${doc.subject}',`);
    console.log(`    phase: '${doc.phase}',`);
    console.log(`    type: 'curriculum',`);
    console.log(`    title: '${doc.title}',`);
    console.log(`  }${i < allDocuments.length - 1 ? ',' : ''}`);
  });
  
  console.log('];');
  console.log('\n✨ Done! Copy the array above into your download script.\n');
}

main().catch(console.error);
