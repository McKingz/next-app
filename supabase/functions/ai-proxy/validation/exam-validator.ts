/**
 * Exam Validator
 * 
 * Validates complete exams for structure, marks, and quality.
 */

import type { ExamQuestion, ExamValidationResult } from '../types.ts'
import { validateQuestion, validateQuestionStructure } from './question-validator.ts'

/**
 * Validate an entire exam
 */
export function validateExam(exam: {
  title?: string
  subject?: string
  grade?: string | number
  duration?: number
  totalMarks?: number
  questions: any[]
}): ExamValidationResult {
  // Validate basic structure
  if (!exam.questions || !Array.isArray(exam.questions)) {
    return { success: false, error: 'Exam must have a questions array.' }
  }
  
  if (exam.questions.length === 0) {
    return { success: false, error: 'Exam must have at least one question.' }
  }
  
  // Validate each question structure
  const validatedQuestions: ExamQuestion[] = []
  const warnings: string[] = []
  
  for (let i = 0; i < exam.questions.length; i++) {
    const question = exam.questions[i]
    
    // Check structure
    const structureResult = validateQuestionStructure(question)
    if (!structureResult.success) {
      return {
        success: false,
        error: `Question ${i + 1}: ${structureResult.error}`,
      }
    }
    
    // Check content quality
    const hasDiagram = !!(question.diagram && question.diagram.type && question.diagram.data)
    const hasImages = !!(question.images && question.images.length > 0)
    
    const contentResult = validateQuestion(question.question, hasDiagram, hasImages)
    if (!contentResult.success) {
      return {
        success: false,
        error: `Question ${question.number}: ${contentResult.error}`,
      }
    }
    
    if (contentResult.warnings) {
      warnings.push(...contentResult.warnings.map(w => `Question ${question.number}: ${w}`))
    }
    
    validatedQuestions.push(question)
  }
  
  // Validate question numbers are sequential
  const numbers = validatedQuestions.map(q => q.number).sort((a, b) => a - b)
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) {
      warnings.push(`Question numbers are not sequential. Expected ${i + 1}, got ${numbers[i]}.`)
      break
    }
  }
  
  // Calculate and validate total marks
  const calculatedTotal = validatedQuestions.reduce((sum, q) => sum + q.marks, 0)
  
  if (exam.totalMarks && exam.totalMarks !== calculatedTotal) {
    warnings.push(
      `Declared total marks (${exam.totalMarks}) doesn't match calculated total (${calculatedTotal}).`
    )
  }
  
  // Validate reasonable exam length
  if (validatedQuestions.length > 50) {
    warnings.push(`Exam has ${validatedQuestions.length} questions, which may be too many.`)
  }
  
  // Validate reasonable total marks
  if (calculatedTotal > 200) {
    warnings.push(`Total marks (${calculatedTotal}) seems unusually high.`)
  }
  if (calculatedTotal < 10) {
    warnings.push(`Total marks (${calculatedTotal}) seems unusually low.`)
  }
  
  return {
    success: true,
    questions: validatedQuestions,
    totalMarks: calculatedTotal,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Validate exam metadata
 */
export function validateExamMetadata(metadata: {
  subject?: string
  grade?: string | number
  curriculum?: string
  topic?: string
}): ExamValidationResult {
  const warnings: string[] = []
  
  // Validate subject
  if (!metadata.subject || metadata.subject.trim().length === 0) {
    warnings.push('Subject is missing or empty.')
  }
  
  // Validate grade
  if (metadata.grade === undefined || metadata.grade === null) {
    warnings.push('Grade is missing.')
  } else {
    const gradeNum = typeof metadata.grade === 'number' 
      ? metadata.grade 
      : parseInt(String(metadata.grade), 10)
    
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 12) {
      warnings.push(`Invalid grade: ${metadata.grade}. Expected 0-12 (R-12).`)
    }
  }
  
  // Validate curriculum (South African context)
  if (metadata.curriculum) {
    const validCurriculums = ['CAPS', 'IEB', 'Cambridge']
    if (!validCurriculums.includes(metadata.curriculum)) {
      warnings.push(
        `Unknown curriculum: ${metadata.curriculum}. Expected one of: ${validCurriculums.join(', ')}.`
      )
    }
  }
  
  return {
    success: warnings.length === 0,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Check if exam meets CAPS requirements
 */
export function validateCAPSCompliance(exam: {
  subject: string
  grade: string | number
  totalMarks?: number
  questions: ExamQuestion[]
}): ExamValidationResult {
  const warnings: string[] = []
  const gradeNum = typeof exam.grade === 'number' 
    ? exam.grade 
    : parseInt(String(exam.grade), 10)
  
  // CAPS-specific validations
  if (exam.subject === 'Mathematics' && gradeNum >= 10 && gradeNum <= 12) {
    // Senior phase maths exams typically 100-150 marks
    const total = exam.questions.reduce((sum, q) => sum + q.marks, 0)
    if (total < 50 || total > 200) {
      warnings.push(`CAPS Mathematics Grade ${gradeNum} exams typically have 100-150 marks. Current: ${total}.`)
    }
  }
  
  return {
    success: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
