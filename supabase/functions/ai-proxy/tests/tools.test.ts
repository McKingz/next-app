/**
 * Tests for Tool Modules
 * 
 * Run with: deno test supabase/functions/ai-proxy/tests/tools.test.ts
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import {
  validateChartData,
  validateMermaidData,
  validateSVGData,
  createSampleBarChart,
  createSampleLineChart,
  createSamplePieChart,
} from '../tools/diagram-generator.ts'
import {
  validateSections,
  calculateTotalMarks,
  isFoundationPhase,
  getActionVerbsPattern,
} from '../tools/exam-generator.ts'
import {
  validateQueryParams,
  getAvailableQueryTypes,
  hasQueryAccess,
} from '../tools/database-query.ts'
import { getToolsForRole, hasToolAccess } from '../tools/tool-registry.ts'

// ============================================================================
// Diagram Generator Tests
// ============================================================================

Deno.test('Diagram: validate valid chart data', () => {
  const data = {
    chartType: 'bar',
    data: [
      { name: 'Jan', value: 120 },
      { name: 'Feb', value: 150 },
    ]
  }
  const result = validateChartData(data)
  assertEquals(result.valid, true)
})

Deno.test('Diagram: reject chart without chartType', () => {
  const data = {
    data: [{ name: 'Jan', value: 120 }]
  }
  const result = validateChartData(data)
  assertEquals(result.valid, false)
  assertExists(result.error)
})

Deno.test('Diagram: reject invalid chartType', () => {
  const data = {
    chartType: 'invalid',
    data: [{ name: 'Jan', value: 120 }]
  }
  const result = validateChartData(data)
  assertEquals(result.valid, false)
})

Deno.test('Diagram: reject empty data array', () => {
  const data = {
    chartType: 'bar',
    data: []
  }
  const result = validateChartData(data)
  assertEquals(result.valid, false)
})

Deno.test('Diagram: reject data point without name', () => {
  const data = {
    chartType: 'bar',
    data: [{ value: 120 }]
  }
  const result = validateChartData(data)
  assertEquals(result.valid, false)
})

Deno.test('Diagram: reject data point with invalid value', () => {
  const data = {
    chartType: 'bar',
    data: [{ name: 'Jan', value: 'invalid' }]
  }
  const result = validateChartData(data)
  assertEquals(result.valid, false)
})

Deno.test('Diagram: validate valid Mermaid code', () => {
  const data = {
    mermaidCode: 'flowchart TD\nA-->B'
  }
  const result = validateMermaidData(data)
  assertEquals(result.valid, true)
})

Deno.test('Diagram: reject Mermaid without code', () => {
  const data = {}
  const result = validateMermaidData(data)
  assertEquals(result.valid, false)
})

Deno.test('Diagram: reject empty Mermaid code', () => {
  const data = {
    mermaidCode: '   '
  }
  const result = validateMermaidData(data)
  assertEquals(result.valid, false)
})

Deno.test('Diagram: reject invalid Mermaid syntax', () => {
  const data = {
    mermaidCode: 'invalid code here'
  }
  const result = validateMermaidData(data)
  assertEquals(result.valid, false)
})

Deno.test('Diagram: validate valid SVG', () => {
  const data = {
    svg: '<svg><circle cx="50" cy="50" r="40"/></svg>'
  }
  const result = validateSVGData(data)
  assertEquals(result.valid, true)
})

Deno.test('Diagram: reject SVG without tags', () => {
  const data = {
    svg: 'Not an SVG'
  }
  const result = validateSVGData(data)
  assertEquals(result.valid, false)
})

Deno.test('Diagram: create sample bar chart', () => {
  const chart = createSampleBarChart('Sales', [
    { name: 'Jan', value: 100 },
    { name: 'Feb', value: 150 },
  ])
  assertEquals(chart.type, 'chart')
  assertEquals(chart.chartType, 'bar')
  assertEquals(chart.data.length, 2)
})

Deno.test('Diagram: create sample line chart', () => {
  const chart = createSampleLineChart('Temperature', [
    { name: 'Mon', value: 25 },
    { name: 'Tue', value: 27 },
  ])
  assertEquals(chart.type, 'chart')
  assertEquals(chart.chartType, 'line')
})

Deno.test('Diagram: create sample pie chart', () => {
  const chart = createSamplePieChart('Market Share', [
    { name: 'Product A', value: 40 },
    { name: 'Product B', value: 60 },
  ])
  assertEquals(chart.type, 'chart')
  assertEquals(chart.chartType, 'pie')
})

// ============================================================================
// Exam Generator Tests
// ============================================================================

Deno.test('Exam: validate valid sections', () => {
  const sections = [
    {
      title: 'Section A',
      questions: [
        { id: 'q1', text: 'Question 1?', type: 'short_answer', marks: 2 }
      ]
    }
  ]
  const result = validateSections(sections)
  assertEquals(result.valid, true)
})

Deno.test('Exam: reject empty sections array', () => {
  const result = validateSections([])
  assertEquals(result.valid, false)
  assertExists(result.error)
})

Deno.test('Exam: reject section without title', () => {
  const sections = [
    {
      questions: [
        { id: 'q1', text: 'Question 1?', type: 'short_answer', marks: 2 }
      ]
    }
  ]
  const result = validateSections(sections)
  assertEquals(result.valid, false)
})

Deno.test('Exam: reject section without questions', () => {
  const sections = [
    {
      title: 'Section A',
      questions: []
    }
  ]
  const result = validateSections(sections)
  assertEquals(result.valid, false)
})

Deno.test('Exam: calculate total marks correctly', () => {
  const sections = [
    {
      title: 'Section A',
      questions: [
        { marks: 2 },
        { marks: 3 }
      ]
    },
    {
      title: 'Section B',
      questions: [
        { marks: 5 }
      ]
    }
  ]
  const total = calculateTotalMarks(sections)
  assertEquals(total, 10)
})

Deno.test('Exam: handle sections without questions in total marks', () => {
  const sections = [
    {
      title: 'Section A',
      questions: [{ marks: 5 }]
    },
    {
      title: 'Section B'
      // No questions
    }
  ]
  const total = calculateTotalMarks(sections)
  assertEquals(total, 5)
})

Deno.test('Exam: detect foundation phase grades', () => {
  // Test with underscores
  assertEquals(isFoundationPhase('grade_r'), true)
  assertEquals(isFoundationPhase('grade_1'), true)
  assertEquals(isFoundationPhase('grade_2'), true)
  assertEquals(isFoundationPhase('grade_3'), true)
  
  // Test with spaces
  assertEquals(isFoundationPhase('grade r'), true)
  assertEquals(isFoundationPhase('Grade 1'), true)
  
  // Test higher grades
  assertEquals(isFoundationPhase('grade_4'), false)
  assertEquals(isFoundationPhase('grade_10'), false)
})

Deno.test('Exam: get action verbs for foundation phase', () => {
  const pattern = getActionVerbsPattern(true)
  
  // Foundation phase verbs
  assertEquals(pattern.test('Count the apples'), true)
  assertEquals(pattern.test('Circle the correct answer'), true)
  assertEquals(pattern.test('Match the words'), true)
  assertEquals(pattern.test('Draw a picture'), true)
})

Deno.test('Exam: get action verbs for higher grades', () => {
  const pattern = getActionVerbsPattern(false)
  
  // Higher grade verbs
  assertEquals(pattern.test('Calculate the area'), true)
  assertEquals(pattern.test('Simplify the expression'), true)
  assertEquals(pattern.test('Evaluate the function'), true)
  assertEquals(pattern.test('Analyze the data'), true)
})

// ============================================================================
// Database Query Tests
// ============================================================================

Deno.test('Database: validate valid query params', () => {
  const result = validateQueryParams({
    query_type: 'list_students',
    limit: 20
  })
  assertEquals(result.valid, true)
})

Deno.test('Database: reject missing query_type', () => {
  const result = validateQueryParams({})
  assertEquals(result.valid, false)
  assertExists(result.error)
})

Deno.test('Database: reject invalid student_id type', () => {
  const result = validateQueryParams({
    query_type: 'get_student_progress',
    student_id: 123  // Should be string
  })
  assertEquals(result.valid, false)
})

Deno.test('Database: reject invalid limit', () => {
  const result = validateQueryParams({
    query_type: 'list_students',
    limit: 200  // Max is 100
  })
  assertEquals(result.valid, false)
})

Deno.test('Database: get available queries for org users', () => {
  const queries = getAvailableQueryTypes('teacher', true)
  assertEquals(queries.includes('list_students'), true)
  assertEquals(queries.includes('list_teachers'), true)
  assertEquals(queries.includes('list_classes'), true)
})

Deno.test('Database: get available queries for independent users', () => {
  const queries = getAvailableQueryTypes('parent', false)
  assertEquals(queries.includes('list_students'), true)
  assertEquals(queries.includes('list_teachers'), false) // Not available
  assertEquals(queries.includes('list_classes'), false) // Not available
})

Deno.test('Database: check query access for org users', () => {
  assertEquals(hasQueryAccess('list_students', true), true)
  assertEquals(hasQueryAccess('list_teachers', true), true)
  assertEquals(hasQueryAccess('list_classes', true), true)
})

Deno.test('Database: check query access for independent users', () => {
  assertEquals(hasQueryAccess('list_students', false), true)  // Personal filter allowed
  assertEquals(hasQueryAccess('list_teachers', false), false) // Org-only
  assertEquals(hasQueryAccess('list_classes', false), false)  // Org-only
})

// ============================================================================
// Tool Registry Tests
// ============================================================================

Deno.test('Registry: get tools for teacher role', () => {
  const tools = getToolsForRole('teacher', 'free')
  assertEquals(tools.length, 3) // query_database, generate_caps_exam, generate_diagram
  assertEquals(tools[0].name, 'query_database')
  assertEquals(tools[1].name, 'generate_caps_exam')
  assertEquals(tools[2].name, 'generate_diagram')
})

Deno.test('Registry: get tools for parent role', () => {
  const tools = getToolsForRole('parent', 'free')
  assertEquals(tools.length, 3) // Same as teacher
})

Deno.test('Registry: get tools for principal role', () => {
  const tools = getToolsForRole('principal', 'pro')
  assertEquals(tools.length, 3)
})

Deno.test('Registry: check tool access for teacher', () => {
  assertEquals(hasToolAccess('query_database', 'teacher', 'free'), true)
  assertEquals(hasToolAccess('generate_caps_exam', 'teacher', 'free'), true)
  assertEquals(hasToolAccess('generate_diagram', 'teacher', 'free'), true)
})

Deno.test('Registry: check tool access for invalid role', () => {
  assertEquals(hasToolAccess('query_database', 'student', 'free'), false)
  assertEquals(hasToolAccess('generate_caps_exam', 'student', 'free'), false)
})

console.log('✅ All tool tests passed!')
