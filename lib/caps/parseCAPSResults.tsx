/**
 * CAPS Tool Result Parser
 * 
 * Extracts and renders CAPS curriculum documents from tool results
 */

import React from 'react';
import { View } from 'react-native';
import CAPSSearchResults from '../../components/caps/CAPSSearchResults';
import { CAPSDocument } from '../../components/caps/CAPSDocumentCard';

export interface CAPSToolResult {
  tool_name: string;
  result: {
    success: boolean;
    found?: boolean;
    query?: string;
    count?: number;
    documents?: CAPSDocument[];
    subjects?: string[];
    grade?: string;
  };
}

/**
 * Check if message metadata contains CAPS tool results
 */
export function hasCAPSResults(metadata?: any): boolean {
  if (!metadata || !metadata.tool_results) return false;
  
  const toolResults = Array.isArray(metadata.tool_results) 
    ? metadata.tool_results 
    : [metadata.tool_results];

  return toolResults.some((tr: any) => 
    tr.tool_name && (
      tr.tool_name === 'search_caps_curriculum' ||
      tr.tool_name === 'get_caps_subjects' ||
      tr.tool_name === 'get_caps_document' ||
      tr.tool_name === 'get_caps_documents'
    )
  );
}

/**
 * Extract CAPS documents from tool results
 */
export function extractCAPSDocuments(metadata?: any): CAPSDocument[] {
  if (!metadata || !metadata.tool_results) return [];
  
  const toolResults = Array.isArray(metadata.tool_results) 
    ? metadata.tool_results 
    : [metadata.tool_results];

  const documents: CAPSDocument[] = [];

  for (const tr of toolResults) {
    if ((tr.tool_name === 'search_caps_curriculum' || tr.tool_name === 'get_caps_documents') && tr.result?.documents) {
      documents.push(...tr.result.documents);
    }
  }

  return documents;
}

/**
 * Render CAPS results component from metadata
 */
export function renderCAPSResults(metadata?: any): React.ReactNode {
  if (!hasCAPSResults(metadata)) return null;

  const documents = extractCAPSDocuments(metadata);
  
  if (documents.length === 0) return null;

  const searchResult = metadata.tool_results?.find(
    (tr: any) => tr.tool_name === 'search_caps_curriculum'
  );

  return (
    <View style={{ marginVertical: 8 }}>
      <CAPSSearchResults
        query={searchResult?.result?.query}
        count={searchResult?.result?.count || documents.length}
        documents={documents}
        maxDisplay={3}
      />
    </View>
  );
}

/**
 * Parse subjects list from tool results
 */
export function extractCAPSSubjects(metadata?: any): { grade?: string; subjects: string[] } | null {
  if (!metadata || !metadata.tool_results) return null;
  
  const toolResults = Array.isArray(metadata.tool_results) 
    ? metadata.tool_results 
    : [metadata.tool_results];

  const subjectResult = toolResults.find((tr: any) => tr.tool_name === 'get_caps_subjects');
  
  if (subjectResult && subjectResult.result?.subjects) {
    return {
      grade: subjectResult.result.grade,
      subjects: subjectResult.result.subjects
    };
  }

  return null;
}
