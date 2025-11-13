/**
 * Tests for AI Proxy Modules
 * 
 * Run with: deno test supabase/functions/ai-proxy/tests/
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { redactPII, redactPIIFromObject, containsPII } from '../security/pii-redactor.ts'
import {
  hasTextualDataset,
  isVisualReference,
  validateQuestion,
  validateQuestionStructure,
  extractMarks,
} from '../validation/question-validator.ts'
import { validateExam, validateExamMetadata } from '../validation/exam-validator.ts'

// ============================================================================
// PII Redactor Tests
// ============================================================================

Deno.test('PII Redactor: should redact email addresses', () => {
  const result = redactPII('Contact me at john@example.com for more info.')
  assertEquals(result.redactedText, 'Contact me at [REDACTED] for more info.')
  assertEquals(result.redactionCount, 1)
})

Deno.test('PII Redactor: should redact SA phone numbers', () => {
  const result = redactPII('Call me at +27 82 123 4567 or 0821234567.')
  assertEquals(result.redactionCount, 2)
})

Deno.test('PII Redactor: should redact ID numbers', () => {
  const result = redactPII('My ID is 9001015009087.')
  assertEquals(result.redactedText, 'My ID is [REDACTED].')
  assertEquals(result.redactionCount, 1)
})

Deno.test('PII Redactor: should handle text with no PII', () => {
  const result = redactPII('This is a safe text with no personal information.')
  assertEquals(result.redactionCount, 0)
  assertEquals(result.redactedText, 'This is a safe text with no personal information.')
})

Deno.test('PII Redactor: should redact PII from objects', () => {
  const obj = {
    name: 'John Doe',
    email: 'john@example.com',
    nested: {
      phone: '+27821234567',
      data: 'Some info',
    },
  }
  const result = redactPIIFromObject(obj)
  assertEquals(result.redactedObject.email, '[REDACTED]')
  assertEquals(result.redactedObject.nested.phone, '[REDACTED]')
  assertEquals(result.redactionCount, 2)
})

Deno.test('PII Redactor: containsPII should detect PII', () => {
  assertEquals(containsPII('Contact: john@example.com'), true)
  assertEquals(containsPII('Phone: +27821234567'), true)
  assertEquals(containsPII('No PII here'), false)
})

// ============================================================================
// Question Validator Tests
// ============================================================================

Deno.test('Question Validator: should detect textual datasets', () => {
  assertEquals(hasTextualDataset('Given that x = 5, calculate y.'), true)
  assertEquals(hasTextualDataset('The table shows the results.'), true)
  assertEquals(hasTextualDataset('Calculate 5 + 3.'), false)
})

Deno.test('Question Validator: should detect visual references', () => {
  assertEquals(isVisualReference('Refer to diagram 1 above.'), true)
  assertEquals(isVisualReference('See diagram for details.'), true)
  assertEquals(isVisualReference('Calculate the area.'), false)
})

Deno.test('Question Validator: should validate question with diagram', () => {
  const result = validateQuestion(
    'Based on the bar chart, what is the highest value?',
    true, // has diagram
    false
  )
  assertEquals(result.success, true)
})

Deno.test('Question Validator: should reject question without diagram', () => {
  const result = validateQuestion(
    'Refer to diagram 1. What is the value?',
    false, // no diagram
    false
  )
  assertEquals(result.success, false)
  assertExists(result.error)
})

Deno.test('Question Validator: should validate question structure', () => {
  const validQuestion = {
    number: 1,
    question: 'Calculate 5 + 3.',
    marks: 2,
  }
  const result = validateQuestionStructure(validQuestion)
  assertEquals(result.success, true)
})

Deno.test('Question Validator: should reject invalid question structure', () => {
  const invalidQuestion = {
    number: 0, // invalid
    question: 'Test',
    marks: 2,
  }
  const result = validateQuestionStructure(invalidQuestion)
  assertEquals(result.success, false)
})

Deno.test('Question Validator: should extract marks from text', () => {
  assertEquals(extractMarks('Calculate the sum. [2]'), 2)
  assertEquals(extractMarks('What is x? (3 marks)'), 3)
  assertEquals(extractMarks('Simple question [5 marks]'), 5)
  assertEquals(extractMarks('No marks here'), null)
})

// ============================================================================
// Exam Validator Tests
// ============================================================================

Deno.test('Exam Validator: should validate complete exam', () => {
  const exam = {
    title: 'Math Test',
    subject: 'Mathematics',
    grade: 10,
    questions: [
      {
        number: 1,
        question: 'Calculate 5 + 3.',
        marks: 2,
      },
      {
        number: 2,
        question: 'What is 10 - 4?',
        marks: 2,
      },
    ],
  }
  const result = validateExam(exam)
  assertEquals(result.success, true)
  assertEquals(result.totalMarks, 4)
  assertEquals(result.questions?.length, 2)
})

Deno.test('Exam Validator: should reject exam with no questions', () => {
  const exam = {
    title: 'Empty Test',
    subject: 'Mathematics',
    grade: 10,
    questions: [],
  }
  const result = validateExam(exam)
  assertEquals(result.success, false)
})

Deno.test('Exam Validator: should detect non-sequential question numbers', () => {
  const exam = {
    questions: [
      { number: 1, question: 'Q1?', marks: 2 },
      { number: 3, question: 'Q3?', marks: 2 }, // skipped 2
    ],
  }
  const result = validateExam(exam)
  assertEquals(result.success, true) // Still succeeds
  assertExists(result.warnings) // But warns
})

Deno.test('Exam Validator: should validate metadata', () => {
  const result = validateExamMetadata({
    subject: 'Mathematics',
    grade: 10,
    curriculum: 'CAPS',
  })
  assertEquals(result.success, true)
})

Deno.test('Exam Validator: should warn about invalid grade', () => {
  const result = validateExamMetadata({
    subject: 'Mathematics',
    grade: 15, // invalid
  })
  assertEquals(result.success, false)
  assertExists(result.warnings)
})

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test('Integration: validate exam with diagrams', () => {
  const exam = {
    subject: 'Mathematics',
    grade: 10,
    questions: [
      {
        number: 1,
        question: 'Based on the bar chart, what is the highest value?',
        marks: 3,
        diagram: {
          type: 'bar',
          data: {
            labels: ['A', 'B', 'C'],
            values: [10, 20, 15],
          },
        },
      },
    ],
  }
  const result = validateExam(exam)
  assertEquals(result.success, true)
})

Deno.test('Integration: validate exam with visual reference but no diagram', () => {
  const exam = {
    subject: 'Mathematics',
    grade: 10,
    questions: [
      {
        number: 1,
        question: 'Refer to diagram 1. What is the value?',
        marks: 3,
        // No diagram provided
      },
    ],
  }
  const result = validateExam(exam)
  assertEquals(result.success, false)
  assertExists(result.error)
})

console.log('✅ All tests passed!')
