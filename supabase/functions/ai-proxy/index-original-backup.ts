/**
 * AI Proxy Edge Function
 * 
 * Secure proxy for AI requests with:
 * - Quota enforcement BEFORE calling AI
 * - PII redaction per WARP.md
 * - Usage logging and cost tracking
 * - Server-side only (no client AI keys)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AIProxyRequest {
  scope: 'teacher' | 'principal' | 'parent'
  service_type: 'lesson_generation' | 'grading_assistance' | 'homework_help' | 'progress_analysis' | 'insights' | 'transcription'
  payload: {
    prompt?: string
    context?: string
    audio_url?: string  // For transcription requests
    images?: Array<{
      data: string  // base64-encoded image
      media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    }>
    metadata?: Record<string, any>
  }
  stream?: boolean  // Enable Server-Sent Events streaming
  enable_tools?: boolean  // Enable agentic tool calling
  metadata?: {
    student_id?: string
    class_id?: string
    subject?: string
    role?: string  // User role for tool access control
    [key: string]: any
  }
}

// PII redaction patterns per WARP.md
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
  /\b(?:\+27|0)[6-9][0-9]{8}\b/g, // SA phone numbers
  /\b\d{13}\b/g, // SA ID numbers
]

function redactPII(text: string): { redactedText: string; redactionCount: number } {
  let redactedText = text
  let redactionCount = 0
  
  PII_PATTERNS.forEach(pattern => {
    const matches = redactedText.match(pattern)
    if (matches) {
      redactionCount += matches.length
      redactedText = redactedText.replace(pattern, '[REDACTED]')
    }
  })
  
  return { redactedText, redactionCount }
}

async function checkQuota(
  supabaseAdmin: any,
  userId: string,
  organizationId: string | null,  // Changed from preschoolId
  serviceType: string
): Promise<{ allowed: boolean; quotaInfo?: any; error?: string }> {
  try {
    // Get user's current usage for this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: usageData, error: usageError } = await supabaseAdmin
      .from('ai_usage_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('service_type', serviceType)
      .gte('created_at', startOfMonth.toISOString())
      .eq('status', 'success')

    if (usageError) {
      return { allowed: false, error: usageError.message }
    }

    const used = usageData?.length || 0
    
    // Default quotas by tier (from limits.ts)
    const defaultQuotas = {
      lesson_generation: 5,
      grading_assistance: 5,
      homework_help: 15
    }

    const limit = defaultQuotas[serviceType as keyof typeof defaultQuotas] || 5
    const remaining = Math.max(0, limit - used)

    if (remaining <= 0) {
      return {
        allowed: false,
        quotaInfo: {
          used,
          limit,
          remaining: 0,
          reset_at: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1).toISOString()
        }
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Quota check failed:', error)
    return { allowed: false, error: 'Quota service unavailable' }
  }
}

type ClaudeModel = 'claude-3-haiku-20240307' | 'claude-3-5-sonnet-20241022'
type SubscriptionTier = 'free' | 'starter' | 'basic' | 'premium' | 'pro' | 'enterprise'

// Model pricing per million tokens
const MODEL_PRICING = {
  'claude-3-haiku-20240307': {
    input: 0.00000025,   // $0.25/1M
    output: 0.00000125,  // $1.25/1M
  },
  'claude-3-5-sonnet-20241022': {
    input: 0.000003,     // $3.00/1M
    output: 0.000015,    // $15.00/1M
  }
}

// Tier-based model selection
function selectModelForTier(tier: SubscriptionTier, hasImages: boolean): ClaudeModel {
  // Vision requires Sonnet 3.5
  if (hasImages) {
    // Only Basic tier (R299) and above get vision
    if (['basic', 'premium', 'pro', 'enterprise'].includes(tier)) {
      return 'claude-3-5-sonnet-20241022'
    }
    throw new Error('Vision features require Basic subscription (R299) or higher')
  }
  
  // For text-only, use Haiku for lower tiers, Sonnet for premium
  if (['pro', 'enterprise'].includes(tier)) {
    return 'claude-3-5-sonnet-20241022'
  }
  
  return 'claude-3-haiku-20240307'
}

// Tool definitions (loaded from registry)
interface ClaudeTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

/**
 * Get available tools for a given role and tier
 * 
 * **IMPORTANT**: This is a simplified version for the Edge Function.
 * Full tool registry lives in services/dash-ai/DashToolRegistry.ts
 */
function getToolsForRole(role: string, tier: string): ClaudeTool[] {
  const tools: ClaudeTool[] = []
  
  // Database Query Tool - available to all authenticated users
  if (['parent', 'teacher', 'principal', 'superadmin'].includes(role)) {
    tools.push({
      name: 'query_database',
      description: 'Execute safe, read-only database queries to retrieve information about students, teachers, classes, assignments, and attendance. Use this when the user asks about their students, classes, or school data. All queries automatically respect tenant isolation and security policies.',
      input_schema: {
        type: 'object',
        properties: {
          query_type: {
            type: 'string',
            enum: ['list_students', 'list_teachers', 'list_classes', 'list_assignments', 'list_attendance', 'get_student_progress', 'get_class_summary'],
            description: 'Type of query to execute. Available queries: list_students (get all students), list_teachers (get all teachers), list_classes (get all classes), list_assignments (get recent assignments), list_attendance (get recent attendance), get_student_progress (detailed progress for one student), get_class_summary (comprehensive class statistics)'
          },
          student_id: {
            type: 'string',
            description: 'UUID of the student (required for get_student_progress)'
          },
          class_id: {
            type: 'string',
            description: 'UUID of the class (required for get_class_summary)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of rows to return (default: 20, max: 100)'
          }
        },
        required: ['query_type']
      }
    })
  }
  
  // Exam Generation Tool - available to parents and teachers
  if (['parent', 'teacher', 'principal'].includes(role)) {
    tools.push({
      name: 'generate_caps_exam',
      description: `Generate a structured, CAPS-aligned examination paper with interactive questions.

DIAGRAM SUPPORT:
You can now generate visual aids using diagrams!
For questions needing charts, flowcharts, or visual aids, include diagram data in the question.

CRITICAL RULES - Questions MUST:
1. Include ALL data inline as text OR use diagram field for visual aids
2. Use clear action verbs (Calculate, List, Identify, Rewrite, Complete, etc.)
3. For questions needing visuals: Add diagram data to the question object

WHEN TO USE DIAGRAMS:
? Bar/line/pie charts (data interpretation)
? Flowcharts (algorithms, processes)
? Geometric shapes (math, angles)
? Number lines (operations, fractions)

EXAMPLES WITH DIAGRAMS:
Chart question: Include diagram field with {type:"chart", data:{chartType:"bar", data:[{name:"Jan",value:120}]}}
Flowchart: Include diagram field with {type:"mermaid", data:"flowchart TD\\nA-->B"}

EXAMPLES WITHOUT DIAGRAMS:
? "Calculate the common difference: 2, 5, 8, 11, 14"
? "Rewrite in past tense: The children are playing"

Use diagrams to make CAPS questions more engaging and realistic!`,
      input_schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Exam title (e.g., "Grade 9 Mathematics Practice Examination 2025")'
          },
          grade: {
            type: 'string',
            enum: ['grade_r', 'grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6', 'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12'],
            description: 'Student grade level'
          },
          subject: {
            type: 'string',
            description: 'Subject name (e.g., Mathematics, Natural Sciences, English Home Language)'
          },
          language: {
            type: 'string',
            enum: ['en-ZA', 'af-ZA', 'zu-ZA', 'xh-ZA'],
            description: 'Language for exam content'
          },
          instructions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Exam instructions for students'
          },
          totalMarks: {
            type: 'number',
            description: 'Total marks for the exam'
          },
          sections: {
            type: 'array',
            description: 'Exam sections with questions',
            items: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Section title (e.g., "SECTION A: Algebra")'
                },
                questions: {
                  type: 'array',
                  description: 'Array of complete, structured questions',
                  items: {
                    type: 'object',
                    properties: {
                      id: {
                        type: 'string',
                        description: 'Unique question ID (e.g., "q-1", "q-2")'
                      },
                      text: {
                        type: 'string',
                        description: 'COMPLETE question text with: 1) Action verb 2) ALL data needed 3) Clear instruction. Example: "Calculate the common difference in this sequence: 2, 5, 8, 11, 14" NOT "Find the common difference in the sequence"'
                      },
                      type: {
                        type: 'string',
                        enum: ['multiple_choice', 'short_answer', 'essay', 'numeric'],
                        description: 'Question type'
                      },
                      marks: {
                        type: 'number',
                        description: 'Marks allocated for this question'
                      },
                      options: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Options for multiple choice questions (A, B, C, D)'
                      },
                      correctAnswer: {
                        type: 'string',
                        description: 'Correct answer for auto-grading (optional)'
                      }
                    },
                    required: ['id', 'text', 'type', 'marks']
                  }
                }
              },
              required: ['title', 'questions']
            }
          }
        },
        required: ['title', 'grade', 'subject', 'sections', 'totalMarks']
      }
    });
    
    // Diagram Generation Tool
    tools.push({
      name: 'generate_diagram',
      description: 'Generate a diagram, chart, or visual aid for exam questions. Use when a question requires visual representation (charts, flowcharts, shapes, number lines, etc.). Returns diagram data that will be embedded in the question.',
      input_schema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['chart', 'mermaid', 'svg'],
            description: 'Type of diagram: chart (bar/line/pie charts), mermaid (flowcharts/sequence diagrams), svg (custom SVG)'
          },
          data: {
            type: 'object',
            description: 'Diagram-specific data',
            properties: {
              chartType: {
                type: 'string',
                enum: ['bar', 'line', 'pie'],
                description: 'Type of chart (for type=chart)'
              },
              data: {
                type: 'array',
                description: 'Chart data points with name and value properties',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Label (e.g., "January", "Apple")' },
                    value: { type: 'number', description: 'Numeric value' }
                  },
                  required: ['name', 'value']
                }
              },
              xKey: { type: 'string', description: 'X-axis data key (default: name)' },
              yKey: { type: 'string', description: 'Y-axis data key (default: value)' },
              mermaidCode: { 
                type: 'string', 
                description: 'Mermaid diagram syntax (for type=mermaid). Example: "flowchart TD\\nA[Start] --> B{Decision}\\nB -->|Yes| C[End]"'
              },
              svg: {
                type: 'string',
                description: 'Raw SVG markup (for type=svg)'
              }
            }
          },
          title: {
            type: 'string',
            description: 'Diagram title/heading'
          },
          caption: {
            type: 'string',
            description: 'Optional caption explaining the diagram'
          }
        },
        required: ['type', 'data']
      }
    });
  }
  
  return tools;
}

/**
 * Execute a tool call
 * 
 * **Security**: All tool executions are RLS-protected via Supabase client
 */
async function executeTool(
  toolName: string,
  toolInput: Record<string, any>,
  context: {
    supabaseAdmin: any
    userId: string
    organizationId: string | null  // Changed from preschoolId
    role: string
    tier: string
    hasOrganization: boolean  // NEW: for independent user support
    isGuest: boolean  // NEW: for guest user detection
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  console.log(`[ai-proxy] Executing tool: ${toolName}`, toolInput)
  
  try {
    if (toolName === 'query_database') {
      return await executeQueryDatabaseTool(toolInput, context)
    }
    
    if (toolName === 'generate_caps_exam') {
      return await executeGenerateCapsExamTool(toolInput, context)
    }
    
    if (toolName === 'generate_diagram') {
      return await executeGenerateDiagramTool(toolInput, context)
    }
    
    return {
      success: false,
      error: `Unknown tool: ${toolName}`
    }
  } catch (error: any) {
    console.error(`[ai-proxy] Tool execution error:`, error)
    return {
      success: false,
      error: `Tool execution failed: ${error.message}`
    }
  }
}

/**
 * Execute CAPS exam generation tool
 * Validates and returns structured exam data
 */
async function executeGenerateCapsExamTool(
  input: Record<string, any>,
  context: { supabaseAdmin: any; userId: string; organizationId: string | null; hasOrganization: boolean; isGuest: boolean }
): Promise<{ success: boolean; data?: any; error?: string }> {
  console.log('[ai-proxy] Executing generate_caps_exam tool with input:', JSON.stringify(input, null, 2))
  
  // Validate required fields
  let { title, grade, subject, sections, totalMarks } = input
  
  if (!title || !grade || !subject || !sections) {
    const missing = [];
    if (!title) missing.push('title');
    if (!grade) missing.push('grade');
    if (!subject) missing.push('subject');
    if (!sections) missing.push('sections');
    console.error('[ai-proxy] Missing fields:', missing.join(', '));
    return {
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`
    }
  }
  
  // Calculate totalMarks if missing (sum from all questions)
  if (!totalMarks && Array.isArray(sections)) {
    totalMarks = sections.reduce((total: number, section: any) => {
      if (Array.isArray(section.questions)) {
        return total + section.questions.reduce((sectionTotal: number, q: any) => {
          return sectionTotal + (Number(q.marks) || 0);
        }, 0);
      }
      return total;
    }, 0);
    console.log(`[ai-proxy] Calculated totalMarks: ${totalMarks}`);
  }
  
  // Validate sections have questions
  if (!Array.isArray(sections) || sections.length === 0) {
    return {
      success: false,
      error: 'Exam must have at least one section with questions'
    }
  }
  
  // Detect grade level for age-appropriate validation
  const gradeStr = String(grade).toLowerCase();
  const isFoundationPhase = gradeStr.match(/\b(r|grade r|1|2|3|grade 1|grade 2|grade 3)\b/i);
  const minQuestionLength = isFoundationPhase ? 10 : 20; // Shorter questions allowed for young learners
  
  // Helper: detect if question provides textual dataset (so it's not visually dependent)
  const hasTextualDataset = (text: string): boolean => {
    const t = (text || '').toLowerCase();
    // Key-value pairs: "Jan: 120; Feb: 150; Mar: 180"
    const kvPattern = /([a-z][a-z\- ]{1,20})\s*[:=]\s*\d+(\.\d+)?\s*(;|,|\n)/g;
    let kvMatches = 0; let m;
    while ((m = kvPattern.exec(t)) !== null) kvMatches++;

    // Plain numeric series with separators: "2, 5, 8, 11, 14" or multi-line numbers
    const seriesPattern = /\b\d+(\.\d+)?\b\s*(,|;|\n)\s*\b\d+(\.\d+)?\b/;

    // Table-like rows inline: "Class A - 12; Class B - 15; Class C - 18"
    const dashPattern = /([a-z][a-z\- ]{1,20})\s*[-:]\s*\d+(\.\d+)?\s*(;|,|\n)/i;

    return kvMatches >= 2 || seriesPattern.test(t) || dashPattern.test(t);
  };

  const isVisualReference = (text: string): boolean => {
    const t = (text || '').toLowerCase();

    // Strong visual-only phrases that imply external image/figure
    const hardBan = [
      'refer to the diagram', 'see the diagram', 'diagram below', 'diagram above',
      'refer to the chart', 'see the chart', 'chart below', 'chart above',
      'see the picture', 'picture below', 'image below', 'image above', 'figure below', 'figure above', 
      'as shown in the figure', 'as shown in the diagram'
    ];
    if (hardBan.some(p => t.includes(p))) return true;

    // "table" is allowed ONLY if textual dataset is present
    if (t.includes('table')) {
      // words like "frequency table" without data should fail
      if (!hasTextualDataset(t)) return true;
    }

    // Generic words "diagram/image/chart/figure" alone should fail unless we can see textual data
    // NOTE: We'll allow these if a diagram object is provided in the question
    const genericVisual = /(diagram|picture|image|illustration|graph)/i;
    if (genericVisual.test(t) && !hasTextualDataset(t)) return true;

    return false; // considered text-only
  };

  // Validate questions are complete
  for (const section of sections) {
    if (!section.questions || section.questions.length === 0) {
      return {
        success: false,
        error: `Section \"${section.title}\" has no questions`
      }
    }
    
    for (const question of section.questions) {
      const qText: string = String(question.text || '').trim();

      // Check for vague questions without data (age-appropriate threshold)
      if (qText.length < minQuestionLength) {
        return {
          success: false,
          error: `Question "${qText}" is too short. Questions must be complete with all data.`
        }
      }
      
      // Disallow external visual references UNLESS a diagram is provided
      // If question has a diagram field, visual references are OK (the diagram IS the visual)
      const hasDiagram = question.diagram && question.diagram.type && question.diagram.data;
      if (isVisualReference(qText) && !hasDiagram) {
        return {
          success: false,
          error: `Question \"${qText.substring(0, 80)}...\" references visual content without providing a diagram. Either include a diagram field OR use TEXT-ONLY data (e.g., \"Monthly sales: Jan 120; Feb 150; Mar 180;\").`
        }
      }
      
      // Check for action verbs (age-appropriate - foundation phase uses simpler verbs)
      const actionVerbs = isFoundationPhase
        ? /\b(count|circle|match|choose|select|find|name|list|show|draw|color|colour|write|identify|point|tick|cross|trace|cut|paste|measure|sort|group|build|make|complete|fill|change|correct|rewrite)\b/i
        : /\b(calculate|compute|simplify|solve|list|identify|name|describe|explain|compare|choose|select|find|determine|evaluate|analyze|analyse|write|state|give|show|classify|match|order|arrange|label|prove|derive|expand|factorise|factorize|convert|graph|plot|sketch|measure|estimate|construct|complete|continue|extend|fill|rewrite|correct|edit|change|transform|translate|rephrase|paraphrase|summarize|summarise|underline|highlight|justify|define|discuss|outline|illustrate)\b/i;
      
      if (!actionVerbs.test(qText)) {
        const suggestionVerbs = isFoundationPhase 
          ? 'Count, Circle, Match, Choose, or Find'
          : 'Calculate, Simplify, Solve, List, or Identify';
        return {
          success: false,
          error: `Question "${qText.substring(0, 80)}..." missing clear action verb (e.g., ${suggestionVerbs})`
        }
      }
    }
  }
  
  // All validation passed - return structured exam
  const exam = {
    title,
    grade,
    subject,
    language: input.language || 'en-ZA',
    instructions: input.instructions || [],
    sections,
    totalMarks,
    hasMemo: false  // Can be enhanced later
  }
  
  console.log(`[ai-proxy] Generated exam: ${sections.length} sections, ${sections.reduce((sum: number, s: any) => sum + s.questions.length, 0)} questions, ${totalMarks} marks`)
  
  return {
    success: true,
    data: exam
  }
}

/**
 * Execute diagram generation tool
 */
async function executeGenerateDiagramTool(
  input: Record<string, any>,
  context: { supabaseAdmin: any; userId: string; organizationId: string | null; hasOrganization: boolean; isGuest: boolean }
): Promise<{ success: boolean; diagram?: any; error?: string }> {
  console.log('[ai-proxy] Executing generate_diagram tool with input:', JSON.stringify(input, null, 2))
  
  try {
    const { type, data, title, caption } = input;
    
    // Validate input
    if (!type || !data) {
      return {
        success: false,
        error: 'Missing required fields: type and data'
      };
    }
    
    // Prepare diagram data based on type
    let diagramData: any;
    
    if (type === 'chart') {
      // Validate chart data
      if (!data.chartType || !Array.isArray(data.data) || data.data.length === 0) {
        return {
          success: false,
          error: 'Chart requires chartType and non-empty data array'
        };
      }
      diagramData = {
        chartType: data.chartType,
        data: data.data,
        xKey: data.xKey || 'name',
        yKey: data.yKey || 'value'
      };
    } else if (type === 'mermaid') {
      // Validate mermaid code
      if (!data.mermaidCode || typeof data.mermaidCode !== 'string') {
        return {
          success: false,
          error: 'Mermaid diagram requires mermaidCode string'
        };
      }
      diagramData = data.mermaidCode;
    } else if (type === 'svg') {
      // Validate SVG
      if (!data.svg || typeof data.svg !== 'string') {
        return {
          success: false,
          error: 'SVG diagram requires svg markup string'
        };
      }
      diagramData = data.svg;
    } else {
      return {
        success: false,
        error: `Unsupported diagram type: ${type}`
      };
    }
    
    return {
      success: true,
      diagram: {
        type,
        data: diagramData,
        title,
        caption
      }
    };
  } catch (error) {
    console.error('[ai-proxy] generate_diagram error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error generating diagram'
    };
  }
}

/**
 * Execute database query tool
 */
async function executeQueryDatabaseTool(
  input: Record<string, any>,
  context: { supabaseAdmin: any; userId: string; organizationId: string | null; hasOrganization: boolean; isGuest: boolean }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const { query_type, student_id, class_id, limit = 20 } = input
  
  // Guest users cannot access data
  if (context.isGuest) {
    return {
      success: false,
      error: 'Guest users must sign up to access data'
    }
  }
  
  // Independent users (no organization) can only query their own data
  if (!context.hasOrganization && !context.organizationId) {
    // Allow personal data queries only
    console.log('[ai-proxy] Independent user query - filtering by userId only')
  }
  
  // Map query types to safe SQL (with RLS enforcement)
  // Organization-agnostic query definitions
  const queries: Record<string, { table: string; select: string; filter?: Record<string, any>; personalFilter?: boolean }> = {
    list_students: {
      table: 'students',
      select: 'id, first_name, last_name, grade, status, date_of_birth',
      filter: context.organizationId ? { organization_id: context.organizationId, status: 'active' } : undefined,
      personalFilter: true  // Can be filtered by userId for independent users
    },
    list_teachers: {
      table: 'profiles',
      select: 'id, full_name, email, role',
      filter: context.organizationId ? { organization_id: context.organizationId, role: 'teacher' } : undefined,
      personalFilter: false  // Org-only
    },
    list_classes: {
      table: 'classes',
      select: 'id, name, grade, teacher_id, student_count',
      filter: context.organizationId ? { organization_id: context.organizationId } : undefined,
      personalFilter: false  // Org-only
    },
    list_assignments: {
      table: 'assignments',
      select: 'id, title, subject, due_date, status, class_id',
      filter: context.organizationId ? { organization_id: context.organizationId } : undefined,
      personalFilter: true  // Can query personal assignments
    },
    list_attendance: {
      table: 'attendance',
      select: 'id, student_id, date, status',
      filter: context.organizationId ? { organization_id: context.organizationId } : undefined,
      personalFilter: true  // Can query personal attendance
    }
  }
  
  const queryDef = queries[query_type]
  if (!queryDef) {
    return {
      success: false,
      error: `Invalid query_type: ${query_type}`
    }
  }
  
  // Independent users: only allow personal queries
  if (!context.hasOrganization && !queryDef.personalFilter) {
    return {
      success: false,
      error: `Query '${query_type}' requires organization membership`
    }
  }
  
  try {
    let query = context.supabaseAdmin
      .from(queryDef.table)
      .select(queryDef.select)
    
    // Apply filters (organization or personal)
    if (queryDef.filter) {
      Object.entries(queryDef.filter).forEach(([key, value]) => {
        query = query.eq(key, value)
      })
    } else if (queryDef.personalFilter && !context.hasOrganization) {
      // Independent user: filter by userId for personal data
      query = query.eq('user_id', context.userId).is('organization_id', null)
    }
    
    // Apply student/class filters if provided
    if (student_id) {
      query = query.eq('id', student_id)
    }
    if (class_id) {
      query = query.eq('class_id', class_id)
    }
    
    // Apply limit
    query = query.limit(Math.min(limit, 100))
    
    const { data, error } = await query
    
    if (error) {
      console.error('[ai-proxy] Database query error:', error)
      return {
        success: false,
        error: `Database query failed: ${error.message}`
      }
    }
    
    return {
      success: true,
      data: {
        query_type,
        rows: data || [],
        row_count: data?.length || 0
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Query execution failed: ${error.message}`
    }
  }
}

async function callClaude(
  prompt: string,
  tier: SubscriptionTier,
  images?: Array<{ data: string; media_type: string }>,
  stream?: boolean,
  tools?: ClaudeTool[],
  conversationHistory?: Array<{ role: string; content: any }>
): Promise<{
  content: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  model: string;
  response?: Response;  // Raw response for streaming
  tool_use?: Array<{ id: string; name: string; input: Record<string, any> }>;  // Tool calls made by Claude
}> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured')
  }

  const hasImages = !!(images && images.length > 0)
  const model = selectModelForTier(tier, hasImages)
  
  // Build message content
  let messageContent: any
  if (hasImages) {
    // Multi-modal message with images
    messageContent = [
      ...images.map(img => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.media_type,
          data: img.data,
        }
      })),
      {
        type: 'text',
        text: prompt
      }
    ]
  } else {
    // Text-only message
    messageContent = prompt
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: stream || false,  // Enable streaming if requested
      tools: tools || undefined,  // Pass tools for Claude to use
      messages: conversationHistory || [
        {
          role: 'user',
          content: messageContent
        }
      ],
      system: `You are Dash, a smart colleague helping with EduDash Pro.

?? MULTILINGUAL CONVERSATION RULES:
- If user speaks Zulu ? respond naturally in Zulu
- If user speaks Afrikaans ? respond naturally in Afrikaans  
- If user speaks English ? respond naturally in English
- DO NOT explain what the user said or translate
- DO NOT teach language unless explicitly asked
- Just have a normal conversation in their language

EXAMPLES:
? BAD: "'Unjani' means 'How are you' in Zulu. It's a common greeting..."
? GOOD: "Ngiyaphila, ngiyabonga! Wena unjani?" (if they spoke Zulu)

? BAD: "You asked 'How are you' in Zulu. Let me explain the counting song 'Onjani desh'..."
? GOOD: "Ngiyaphila kahle, ngiyabonga ukubuza. Ungisiza kanjani namuhla?"

RESPONSE STYLE:
- Natural, conversational (like a smart colleague)
- Answer in 1-3 sentences for greetings
- Match the user's language WITHOUT commenting on it
- State facts only - if you don't know, say "I don't have that information"
- NO educational lectures unless teaching is requested

CRITICAL:
- NEVER make up data (student counts, assignments, etc)
- If you don't have specific data, say "I need to check the database"
- NO theatrical narration (*clears throat*, *smiles*, etc.)
- Focus on being helpful, not educational by default`
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${response.status} ${error}`)
  }
  
  // If streaming, return raw response for processing
  if (stream) {
    return {
      content: '',  // Will be streamed
      tokensIn: 0,  // Will be calculated after stream completes
      tokensOut: 0,
      cost: 0,
      model,
      response  // Pass through raw response
    }
  }

  // Non-streaming: parse full response
  const result = await response.json()
  
  const tokensIn = result.usage?.input_tokens || 0
  const tokensOut = result.usage?.output_tokens || 0
  
  // Calculate cost based on model
  const pricing = MODEL_PRICING[model]
  const cost = (tokensIn * pricing.input) + (tokensOut * pricing.output)
  
  // Extract tool use if present
  const toolUse = result.content?.filter((block: any) => block.type === 'tool_use')
    .map((block: any) => ({
      id: block.id,
      name: block.name,
      input: block.input
    })) || []
  
  // Extract text content
  const textContent = result.content?.find((block: any) => block.type === 'text')?.text || ''

  return {
    content: textContent,
    tokensIn,
    tokensOut,
    cost,
    model,
    tool_use: toolUse.length > 0 ? toolUse : undefined
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'method_not_allowed', message: 'Only POST requests allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Parse request
    const requestBody: AIProxyRequest = await req.json()
    const { scope, payload, metadata = {}, stream = false, enable_tools = false } = requestBody
    
    // Validate and normalize service_type with safe default
    const VALID_SERVICE_TYPES = [
      'lesson_generation',
      'homework_help',
      'grading_assistance',
      'general',
      'dash_conversation',
      'conversation'
    ]
    const rawServiceType = requestBody.service_type
    const service_type = rawServiceType && VALID_SERVICE_TYPES.includes(rawServiceType as string)
      ? rawServiceType
      : 'dash_conversation' // Safe default for Dash AI chat sessions

    // Validate request
    if (!scope || !service_type || !payload?.prompt) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'invalid_request',
            message: 'Missing required fields: scope, service_type, or payload.prompt'
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'unauthorized', message: 'Missing authorization header' }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user from token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'unauthorized', message: 'Invalid token' }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile for organization_id (or legacy preschool_id) and subscription tier
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('organization_id, preschool_id, subscription_tier, role')
      .eq('auth_user_id', user.id)
      .single()

    // Organization-agnostic: support both new and legacy fields
    const organizationId = profile?.organization_id || profile?.preschool_id || null
    const tier: SubscriptionTier = (profile?.subscription_tier?.toLowerCase() || 'free') as SubscriptionTier
    const role = profile?.role || metadata.role || scope  // Prefer profile role, fall back to metadata/scope
    const hasOrganization = !!organizationId
    const isGuest = !user.email_confirmed_at  // Guest users haven't confirmed email
    const startTime = Date.now()
    
    // Load available tools if requested
    let availableTools: ClaudeTool[] | undefined = undefined
    if (enable_tools) {
      availableTools = getToolsForRole(role, tier)
      console.log(`[ai-proxy] Loaded ${availableTools.length} tools for role=${role}, tier=${tier}`)
    }

    // Check quota before proceeding
    const quotaCheck = await checkQuota(supabaseAdmin, user.id, organizationId, service_type)

    if (!quotaCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'quota_exceeded',
            message: 'AI quota exceeded for this service',
            quota_info: quotaCheck.quotaInfo
          }
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '3600' // Try again in 1 hour
          } 
        }
      )
    }

    // Redact PII from prompt per WARP.md
    const { redactedText, redactionCount } = redactPII(payload.prompt)
    
    // Extract images if present
    const images = payload.images
    
    // Call Claude API
    try {
      const aiResult = await callClaude(redactedText, tier, images, stream, availableTools)
      
      // Handle streaming response
      if (stream && aiResult.response) {
        const encoder = new TextEncoder()
        let fullContent = ''
        let tokensIn = 0
        let tokensOut = 0
        
        const stream = new ReadableStream({
          async start(controller) {
            try {
              const reader = aiResult.response!.body!.getReader()
              const decoder = new TextDecoder()
              
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                
                const chunk = decoder.decode(value)
                const lines = chunk.split('\n').filter(line => line.trim())
                
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6)
                    
                    if (data === '[DONE]') {
                      // Send final event
                      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                      controller.close()
                      break
                    }
                    
                    try {
                      const event = JSON.parse(data)
                      
                      // Track tokens from usage events
                      if (event.type === 'message_start' && event.message?.usage) {
                        tokensIn = event.message.usage.input_tokens || 0
                      }
                      
                      if (event.type === 'message_delta' && event.usage) {
                        tokensOut = event.usage.output_tokens || 0
                      }
                      
                      // Extract content deltas
                      if (event.type === 'content_block_delta' && event.delta?.text) {
                        fullContent += event.delta.text
                        
                        // Forward chunk to client
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                          type: 'content_block_delta',
                          delta: { text: event.delta.text }
                        })}\n\n`))
                      }
                      
                    } catch (e) {
                      console.error('Failed to parse SSE event:', e)
                    }
                  }
                }
              }
              
              // Log streaming usage after completion
              const pricing = MODEL_PRICING[aiResult.model as ClaudeModel]
              const cost = (tokensIn * pricing.input) + (tokensOut * pricing.output)
              
              // Safe logging - never fail the request due to logging errors
              const { error: logError } = await supabaseAdmin
                .from('ai_usage_logs')
                .insert({
                  user_id: user.id,
                  preschool_id: organizationId,  // Legacy field
                  organization_id: organizationId,
                  service_type: service_type,
                  ai_model_used: aiResult.model,
                  status: 'success',
                  input_tokens: tokensIn,
                  output_tokens: tokensOut,
                  total_cost: cost,
                  processing_time_ms: Date.now() - startTime,
                  input_text: redactedText,
                  output_text: fullContent,
                  metadata: {
                    ...metadata,
                    scope,
                    tier,
                    streaming: true,
                    has_images: images && images.length > 0,
                    image_count: images?.length || 0,
                    redaction_count: redactionCount
                  }
                })
              
              if (logError) {
                console.error('[ai-proxy] Failed to log streaming usage:', logError)
              }
              
            } catch (error) {
              console.error('Streaming error:', error)
              controller.error(error)
            }
          }
        })
        
        return new Response(stream, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        })
      }
      
      // Log successful usage (safe - never fail request on logging errors)
      const { data: logData, error: logError } = await supabaseAdmin
        .from('ai_usage_logs')
        .insert({
          user_id: user.id,
          preschool_id: organizationId,  // Legacy field
          organization_id: organizationId,
tion_id: organizationId,
          service_type: service_type,
          ai_model_used: aiResult.model,
          status: 'success',
          input_tokens: aiResult.tokensIn,
          output_tokens: aiResult.tokensOut,
          total_cost: aiResult.cost,
          processing_time_ms: Date.now() - startTime,
          input_text: redactedText,
          output_text: aiResult.content,
          metadata: {
            ...metadata,
            scope,
            tier,
            has_images: images && images.length > 0,
            image_count: images?.length || 0,
            redaction_count: redactionCount,
            input_cost: aiResult.cost - (aiResult.tokensOut * MODEL_PRICING[aiResult.model as ClaudeModel].output),
            output_cost: aiResult.tokensOut * MODEL_PRICING[aiResult.model as ClaudeModel].output
          }
        })
        .select('id')
        .single()
      
      if (logError) {
        console.error('[ai-proxy] Failed to log usage:', logError)
      }

      const usageId = logData?.id || 'unknown'
      
      // Handle tool use if present
      if (aiResult.tool_use && aiResult.tool_use.length > 0) {
        console.log(`[ai-proxy] Claude requested ${aiResult.tool_use.length} tool calls`)
        
        // Execute tools
        const toolResults = await Promise.all(
          aiResult.tool_use.map(async (toolCall) => {
            const result = await executeTool(
              toolCall.name,
              toolCall.input,
              {
                supabaseAdmin,
                userId: user.id,
                organizationId,
                role,
                tier,
                hasOrganization,
                isGuest
              }
            )
            
            return {
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: result.success ? JSON.stringify(result.data) : `Error: ${result.error}`
            }
          })
        )
        
        // If any tool failed, ask Claude to fix and retry once (auto-heal)
        const toolHadError = toolResults.some((tr: any) => typeof tr.content === 'string' && tr.content.startsWith('Error:'))
        if (toolHadError) {
          console.warn('[ai-proxy] Tool returned error(s). Asking Claude to correct and retry tool call...')
          const errorSummary = toolResults
            .filter((tr: any) => typeof tr.content === 'string' && tr.content.startsWith('Error:'))
            .map((tr: any) => tr.content)
            .join(' | ')
          
          const retryInstruction = [
            'Your previous tool call returned validation errors.',
            `Errors: ${errorSummary}`,
            '',
            'Immediately call the generate_caps_exam tool AGAIN with corrected input that strictly follows these rules:',
            '- Do NOT reference images, diagrams, charts, tables, or figures. Use text-only descriptions.',
            '- If you need a chart/table, include the raw data explicitly in the question text (e.g., "Monthly sales: Jan 120; Feb 150; Mar 180;").',
            '- Every question must begin with a clear action verb and include ALL the information needed to answer.',
            '- Provide complete sections with questions and totalMarks. Ensure marks add up.',
            '- Return ONLY a tool call. Do not write any explanatory text.'
          ].join('\n')
          
          const retryResult = await callClaude(
            redactedText,
            tier,
            images,
            false,
            availableTools,
            [
              { role: 'user', content: redactedText },
              { role: 'assistant', content: [
                  ...(aiResult.content ? [{ type: 'text', text: aiResult.content }] : []),
                  ...aiResult.tool_use.map((tu: any) => ({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input }))
                ] 
              },
              { role: 'user', content: toolResults.map((tr: any) => ({ type: 'tool_result', tool_use_id: tr.tool_use_id, content: tr.content })) },
              { role: 'user', content: [{ type: 'text', text: retryInstruction }] }
            ]
          )
          
          if (retryResult.tool_use && retryResult.tool_use.length > 0) {
            console.log(`[ai-proxy] Retry produced ${retryResult.tool_use.length} tool call(s). Executing...`)
            const retryToolResults = await Promise.all(
              retryResult.tool_use.map(async (toolCall: any) => {
                const result = await executeTool(toolCall.name, toolCall.input, {
                  supabaseAdmin,
                  userId: user.id,
                  organizationId,
                  role,
                  tier,
                  hasOrganization,
                  isGuest
                })
                return {
                  type: 'tool_result',
                  tool_use_id: toolCall.id,
                  content: result.success ? JSON.stringify(result.data) : `Error: ${result.error}`
                }
              })
            )
            const retryHadError = retryToolResults.some((tr: any) => typeof tr.content === 'string' && tr.content.startsWith('Error:'))
            if (!retryHadError) {
              // Success after retry: request final response from Claude with successful results
              console.log('[ai-proxy] Retry succeeded. Getting final response...')
              const continuationAfterRetry = await callClaude(
                redactedText,
                tier,
                images,
                false,
                availableTools,
                [
                  { role: 'user', content: redactedText },
                  { role: 'assistant', content: [
                      ...(retryResult.content ? [{ type: 'text', text: retryResult.content }] : []),
                      ...retryResult.tool_use.map((tu: any) => ({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input }))
                    ]
                  },
                  { role: 'user', content: retryToolResults.map((tr: any) => ({ type: 'tool_result', tool_use_id: tr.tool_use_id, content: tr.content })) }
                ]
              )
              return new Response(
                JSON.stringify({
                  success: true,
                  content: continuationAfterRetry.content,
                  tool_use: retryResult.tool_use,
                  tool_results: retryToolResults,
                  usage: {
                    tokens_in: aiResult.tokensIn + retryResult.tokensIn + continuationAfterRetry.tokensIn,
                    tokens_out: aiResult.tokensOut + retryResult.tokensOut + continuationAfterRetry.tokensOut,
                    cost: aiResult.cost + retryResult.cost + continuationAfterRetry.cost,
                    usage_id: usageId
                  }
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            } else {
              console.warn('[ai-proxy] Retry still failed. Returning latest error to client.')
              return new Response(
                JSON.stringify({
                  success: true,
                  content: 'Sorry, I could not generate a valid exam without visual references. Please try again or change the request.',
                  tool_use: retryResult.tool_use,
                  tool_results: retryToolResults,
                  usage: {
                    tokens_in: aiResult.tokensIn + retryResult.tokensIn,
                    tokens_out: aiResult.tokensOut + retryResult.tokensOut,
                    cost: aiResult.cost + retryResult.cost,
                    usage_id: usageId
                  }
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          } else {
            console.log('[ai-proxy] Retry produced no tool call. Returning retry content.')
            return new Response(
              JSON.stringify({
                success: true,
                content: retryResult.content || 'The assistant did not produce a tool call. Please try again.',
                tool_use: aiResult.tool_use,
                tool_results: toolResults,
                usage: {
                  tokens_in: aiResult.tokensIn + retryResult.tokensIn,
                  tokens_out: aiResult.tokensOut + retryResult.tokensOut,
                  cost: aiResult.cost + retryResult.cost,
                  usage_id: usageId
                }
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
        
        console.log('[ai-proxy] Tool execution complete. Sending results back to Claude for final response...')
        
        // Multi-turn: Send tool results back to Claude to get final response
        const continuationResult = await callClaude(
          redactedText,
          tier,
          images,
          false, // No streaming for continuation
          availableTools,
          [
            {
              role: 'user',
              content: redactedText
            },
            {
              role: 'assistant',
              content: [
                ...(aiResult.content ? [{ type: 'text', text: aiResult.content }] : []),
                ...aiResult.tool_use.map((tu: any) => ({
                  type: 'tool_use',
                  id: tu.id,
                  name: tu.name,
                  input: tu.input
                }))
              ]
            },
            {
              role: 'user',
              content: toolResults.map((tr: any) => ({
                type: 'tool_result',
                tool_use_id: tr.tool_use_id,
                content: tr.content
              }))
            }
          ]
        )
        
        console.log('[ai-proxy] Received final response from Claude after tool use')
        
        // Log continuation usage (safe - never fail on logging errors)
        const { error: contLogError } = await supabaseAdmin
          .from('ai_usage_logs')
          .insert({
            user_id: user.id,
            preschool_id: organizationId,
            organization_id: organizationId,
            service_type: service_type,
            ai_model_used: continuationResult.model,
            status: 'success',
            input_tokens: continuationResult.tokensIn,
            output_tokens: continuationResult.tokensOut,
            total_cost: continuationResult.cost,
            processing_time_ms: Date.now() - startTime,
            input_text: 'Tool continuation',
            output_text: continuationResult.content,
            metadata: {
              ...metadata,
              scope,
              tier,
              continuation: true,
              tool_count: toolResults.length
            }
          })
        
        if (contLogError) {
          console.error('[ai-proxy] Failed to log continuation usage:', contLogError)
        }
        
        // Return final response with tool context
        return new Response(
          JSON.stringify({
            success: true,
            content: continuationResult.content,
            tool_use: aiResult.tool_use,
            tool_results: toolResults,
            usage: {
              tokens_in: aiResult.tokensIn + continuationResult.tokensIn,
              tokens_out: aiResult.tokensOut + continuationResult.tokensOut,
              cost: aiResult.cost + continuationResult.cost,
              usage_id: usageId
            }
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // No tool use - return normal response
      return new Response(
        JSON.stringify({
          success: true,
          content: aiResult.content,
          usage: {
            tokens_in: aiResult.tokensIn,
            tokens_out: aiResult.tokensOut,
            cost: aiResult.cost,
            usage_id: usageId
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (aiError) {
      // Log failed usage (safe - never fail on logging errors)
      const { error: logError } = await supabaseAdmin
        .from('ai_usage_logs')
        .insert({
          user_id: user.id,
          preschool_id: organizationId,
          organization_id: organizationId,
          service_type: service_type,
          ai_model_used: tier === 'free' || tier === 'starter' ? 'claude-3-haiku-20240307' : 'claude-3-5-sonnet-20241022',
          status: 'error',
          input_tokens: 0,
          output_tokens: 0,
          total_cost: 0,
          processing_time_ms: Date.now() - startTime,
          error_message: (aiError as Error).message,
          input_text: redactedText,
          metadata: {
            ...metadata,
            scope,
            error: (aiError as Error).message,
            redaction_count: redactionCount
          }
        })
      
      if (logError) {
        console.error('[ai-proxy] Failed to log error usage:', logError)
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'ai_service_error',
            message: 'AI service temporarily unavailable'
          }
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('AI Proxy Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'internal_error',
          message: 'Internal server error'
        }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
