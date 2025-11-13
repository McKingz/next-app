/**
 * Question Validator
 * 
 * Validates individual exam questions for quality and completeness.
 */

import type { ValidationResult } from '../types.ts'

/**
 * Keywords that indicate textual data/information is provided
 */
const TEXTUAL_DATA_KEYWORDS = [
  'given that',
  'according to',
  'based on',
  'using the following',
  'the table shows',
  'the data shows',
  'information:',
  'data:',
  'values:',
  'results:',
  'observations:',
]

/**
 * Keywords that reference external visual content (not allowed without diagram)
 */
const EXTERNAL_VISUAL_REFERENCES = [
  'refer to diagram',
  'see diagram',
  'look at the diagram',
  'in the diagram above',
  'shown in the diagram',
  'as illustrated',
  'as shown',
]

/**
 * Check if question text contains textual dataset
 */
export function hasTextualDataset(text: string): boolean {
  const lowerText = text.toLowerCase()
  return TEXTUAL_DATA_KEYWORDS.some(keyword => lowerText.includes(keyword))
}

/**
 * Check if question references visual content that's not provided
 */
export function isVisualReference(text: string): boolean {
  const lowerText = text.toLowerCase()
  
  // Check for external references (always bad)
  if (EXTERNAL_VISUAL_REFERENCES.some(ref => lowerText.includes(ref))) {
    return true
  }
  
  // If it's just mentioning types of charts/graphs, that's OK if diagram is provided
  // This is checked by the caller using hasDiagram flag
  return false
}

/**
 * Validate a single question
 */
export function validateQuestion(
  questionText: string,
  hasDiagram: boolean,
  hasImages: boolean
): ValidationResult {
  const lowerText = questionText.toLowerCase()
  
  // Check for external visual references
  if (isVisualReference(questionText)) {
    if (!hasDiagram && !hasImages) {
      return {
        success: false,
        error: 'Question references visual content without providing a diagram or image.',
      }
    }
  }
  
  // Check for chart/graph mentions - these are OK if diagram provided
  const mentionsChart = /\b(bar chart|pie chart|line graph|histogram|scatter plot)\b/i.test(questionText)
  if (mentionsChart && !hasDiagram) {
    return {
      success: false,
      error: 'Question mentions chart/graph type but no diagram is provided.',
    }
  }
  
  // Warn if question is very short (might be incomplete)
  if (questionText.trim().length < 20) {
    return {
      success: true,
      warnings: ['Question text is very short - may be incomplete.'],
    }
  }
  
  // Warn if question doesn't end with punctuation
  if (!/[.?!]$/.test(questionText.trim())) {
    return {
      success: true,
      warnings: ['Question text should end with punctuation.'],
    }
  }
  
  return { success: true }
}

/**
 * Validate question has required fields
 */
export function validateQuestionStructure(question: any): ValidationResult {
  if (!question) {
    return { success: false, error: 'Question is null or undefined.' }
  }
  
  if (typeof question.number !== 'number' || question.number < 1) {
    return { success: false, error: 'Question must have a valid number (positive integer).' }
  }
  
  if (!question.question || typeof question.question !== 'string') {
    return { success: false, error: 'Question must have a text field.' }
  }
  
  if (typeof question.marks !== 'number' || question.marks < 1) {
    return { success: false, error: 'Question must have valid marks (positive integer).' }
  }
  
  // Validate diagram if present
  if (question.diagram) {
    if (!question.diagram.type) {
      return { success: false, error: 'Diagram must have a type field.' }
    }
    
    const validDiagramTypes = ['bar', 'line', 'pie', 'mermaid', 'svg', 'image']
    if (!validDiagramTypes.includes(question.diagram.type)) {
      return {
        success: false,
        error: `Invalid diagram type "${question.diagram.type}". Must be one of: ${validDiagramTypes.join(', ')}.`,
      }
    }
    
    if (!question.diagram.data) {
      return { success: false, error: 'Diagram must have data field.' }
    }
  }
  
  return { success: true }
}

/**
 * Extract marks from question text (e.g., "[2]" or "(3 marks)")
 */
export function extractMarks(questionText: string): number | null {
  // Match patterns like [2], (3), [4 marks], (5 marks)
  const patterns = [
    /\[(\d+)\s*(?:marks?)?\]/i,
    /\((\d+)\s*(?:marks?)?\)/i,
  ]
  
  for (const pattern of patterns) {
    const match = questionText.match(pattern)
    if (match) {
      return parseInt(match[1], 10)
    }
  }
  
  return null
}
