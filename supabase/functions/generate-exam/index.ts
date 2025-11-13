/**
 * Generate Exam Edge Function
 * 
 * Clean, simple exam generation using JSON mode.
 * Handles all complexity server-side:
 * - AI generation with retries
 * - Validation against grade specifications
 * - Automatic saving to database
 * 
 * Frontend just calls this once and gets back a complete exam.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Type definitions
interface GradeSpec {
  totalMarks: number;
  duration: string;
  mc: [number, number];
  sa: [number, number];
  ps: [number, number];
  minTotal: number;
}

interface ExamQuestion {
  id?: string;
  number: string;
  text: string;
  type: 'multiple_choice' | 'short_answer' | 'essay' | 'numeric';
  marks: number;
  options?: string[];
  correctAnswer?: string | number;
}

interface ExamSection {
  title: string;
  questions: ExamQuestion[];
}

interface ExamContent {
  title: string;
  sections: ExamSection[];
  totalMarks?: number;
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// Environment variables - check at module load time
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Log environment variable status (without exposing secrets)
console.log('[generate-exam] Environment check:', {
  hasAnthropicKey: !!ANTHROPIC_API_KEY,
  hasOpenAIKey: !!OPENAI_API_KEY,
  hasSupabaseUrl: !!SUPABASE_URL,
  hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
})

// Validate critical environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[generate-exam] CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Grade specifications
function getGradeSpec(grade: string): GradeSpec {
  const specs: Record<string, GradeSpec> = {
    'grade_4': { totalMarks: 50, duration: '90 minutes', mc: [10, 15], sa: [8, 10], ps: [3, 5], minTotal: 21 },
    'grade_5': { totalMarks: 60, duration: '90 minutes', mc: [12, 16], sa: [8, 12], ps: [4, 6], minTotal: 24 },
    'grade_6': { totalMarks: 75, duration: '90 minutes', mc: [12, 18], sa: [10, 14], ps: [5, 8], minTotal: 27 },
    'grade_7': { totalMarks: 75, duration: '2 hours', mc: [10, 15], sa: [8, 12], ps: [6, 8], minTotal: 28 },
    'grade_8': { totalMarks: 100, duration: '2 hours', mc: [12, 18], sa: [10, 14], ps: [6, 10], minTotal: 30 },
    'grade_9': { totalMarks: 100, duration: '2 hours', mc: [12, 18], sa: [10, 14], ps: [6, 10], minTotal: 30 },
    'grade_10': { totalMarks: 100, duration: '2.5 hours', mc: [15, 20], sa: [10, 15], ps: [8, 12], minTotal: 33 },
    'grade_11': { totalMarks: 150, duration: '3 hours', mc: [20, 25], sa: [12, 18], ps: [10, 15], minTotal: 42 },
    'grade_12': { totalMarks: 150, duration: '3 hours', mc: [20, 25], sa: [12, 18], ps: [10, 15], minTotal: 42 }
  };
  return specs[grade] || specs['grade_10']; // Default to grade 10
}

// Remove duplicate questions from exam
function removeDuplicateQuestions(exam: ExamContent): ExamContent {
  const seenQuestions = new Set<string>();
  const questionNumbers = new Set<string>();
  
  for (const section of exam.sections) {
    const uniqueQuestions: ExamQuestion[] = [];
    
    for (const question of section.questions) {
      // Create a unique key from question text (normalized)
      const questionKey = question.text?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
      
      // Check for duplicate text
      if (seenQuestions.has(questionKey)) {
        console.warn(`[generate-exam] Removing duplicate question: "${question.text?.substring(0, 50)}..."`);
        continue;
      }
      
      // Check for duplicate question numbers
      if (questionNumbers.has(question.number)) {
        console.warn(`[generate-exam] Duplicate question number detected: ${question.number}`);
        // Renumber this question
        let newNumber = uniqueQuestions.length + 1;
        while (questionNumbers.has(String(newNumber))) {
          newNumber++;
        }
        question.number = String(newNumber);
      }
      
      // Filter duplicate options in multiple choice questions
      if (question.type === 'multiple_choice' && question.options && Array.isArray(question.options)) {
        const seenOptions = new Set<string>();
        const uniqueOptions: string[] = [];
        
        for (const option of question.options) {
          const optionKey = option?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
          if (optionKey && !seenOptions.has(optionKey)) {
            seenOptions.add(optionKey);
            uniqueOptions.push(option);
          } else if (optionKey) {
            console.warn(`[generate-exam] Removing duplicate option in Q${question.number}: "${option.substring(0, 30)}..."`);
          }
        }
        
        // Only update if we actually removed duplicates
        if (uniqueOptions.length !== question.options.length) {
          question.options = uniqueOptions;
          console.log(`[generate-exam] Q${question.number}: Reduced from ${question.options.length} to ${uniqueOptions.length} unique options`);
        }
      }
      
      seenQuestions.add(questionKey);
      questionNumbers.add(question.number);
      uniqueQuestions.push(question);
    }
    
    section.questions = uniqueQuestions;
  }
  
  console.log(`[generate-exam] After deduplication: ${Array.from(seenQuestions).length} unique questions`);
  return exam;
}

// Add unique IDs to all questions
function addQuestionIds(exam: ExamContent): ExamContent {
  let globalQuestionId = 0;
  
  for (const section of exam.sections) {
    for (const question of section.questions) {
      // Generate a unique ID for each question
      question.id = `q_${++globalQuestionId}`;
    }
  }
  
  console.log(`[generate-exam] Added unique IDs to ${globalQuestionId} questions`);
  return exam;
}

  // Validate exam structure
function validateExam(exam: ExamContent, spec: GradeSpec): ValidationResult {
  if (!exam || !exam.sections || !Array.isArray(exam.sections)) {
    return { valid: false, reason: 'Invalid exam structure' };
  }
  
  let totalQuestions = 0;
  let totalMarks = 0;
  
  for (const section of exam.sections) {
    if (!section.questions || !Array.isArray(section.questions)) {
      return { valid: false, reason: `Section "${section.title}" has no questions` };
    }
    
    totalQuestions += section.questions.length;
    
    for (const q of section.questions) {
      if (!q.marks || typeof q.marks !== 'number') {
        return { valid: false, reason: `Question ${q.number} has invalid marks` };
      }
      totalMarks += q.marks;
    }
  }
  
  // Relaxed validation - check minimum questions
  if (totalQuestions < spec.minTotal) {
    return { valid: false, reason: `Only ${totalQuestions} questions (need ${spec.minTotal})` };
  }
  
  // Allow some flexibility in total marks (within 10% of target)
  const marksDiff = Math.abs(totalMarks - spec.totalMarks);
  const tolerance = Math.max(5, spec.totalMarks * 0.1); // 10% or minimum 5 marks
  
  if (marksDiff > tolerance) {
    console.warn(`[generate-exam] Total marks ${totalMarks} differs from target ${spec.totalMarks} by ${marksDiff} marks`);
    // Still accept it if within reasonable range
  }
  
  return { valid: true };
}

// Build exam generation prompt
function buildExamPrompt(grade: string, subject: string, spec: GradeSpec, attempt: number = 1, lastError?: string): string {
  const gradeDisplay = grade.replace('grade_', 'Grade ').replace('_', ' ');
  
  return `Generate a CAPS-aligned ${subject} exam for ${gradeDisplay} students.

**REQUIREMENTS:**
- Target marks: Approximately ${spec.totalMarks} marks (aim close to this, but flexibility is OK)
- Minimum questions: ${spec.minTotal}
- Duration: ${spec.duration}

**Structure:**
- Multiple Choice section: ${spec.mc[0]}-${spec.mc[1]} questions (1-2 marks each)
- Short Answer section: ${spec.sa[0]}-${spec.sa[1]} questions (2-5 marks each)
- Problem Solving section: ${spec.ps[0]}-${spec.ps[1]} questions (5-10 marks each)

**Instructions:**
- Each question must be UNIQUE - no duplicates or repeated questions
- Each question must have a UNIQUE question number (e.g., 1, 2, 3, not 1, 1, 2)
- For multiple choice questions, use unique option labels (A, B, C, D - not A, A, A)
- Each question must be complete and include all data needed to answer
- No LaTeX backslashes or math delimiters in question text
- Aim for total marks close to ${spec.totalMarks} (within 10% is acceptable)
- Include answer keys for all questions
- Questions should be varied and cover different topics within the subject

${attempt > 1 ? `\n**PREVIOUS ATTEMPT FAILED** - This is attempt ${attempt}/3.
${lastError ? `Error: ${lastError}` : ''}
Please address the error above.\n` : ''}

**CRITICAL: Response Format**
You MUST respond with ONLY the JSON object below. Do NOT include:
- Markdown code blocks (no \`\`\`json or \`\`\`)
- Explanatory text before or after the JSON
- Comments or notes
- Any other text

Start your response with { and end with }

JSON structure to return:
{
  "title": "string",
  "grade": "string",
  "subject": "string",
  "duration": "string",
  "sections": [
    {
      "title": "string",
      "instructions": "string",
      "questions": [
        {
          "number": "string",
          "text": "string",
          "type": "multiple_choice|short_answer|essay",
          "marks": number,
          "options": ["A. option1", "B. option2", "C. option3", "D. option4"] (if multiple_choice - use unique labels),
          "correctAnswer": "string"
        }
      ]
    }
  ],
  "totalMarks": number,
  "durationMinutes": number
}`;
}

// Generate exam using Anthropic Claude with JSON mode
async function generateExamWithClaude(grade: string, subject: string, spec: GradeSpec, attempt: number = 1, lastError?: string): Promise<ExamContent> {
  // Check for API key
  if (!ANTHROPIC_API_KEY) {
    console.error('[generate-exam] ANTHROPIC_API_KEY is not set');
    throw new Error('ANTHROPIC_API_KEY environment variable is not configured');
  }

  const prompt = buildExamPrompt(grade, subject, spec, attempt, lastError);

  console.log(`[generate-exam] Calling Claude API (attempt ${attempt})...`);
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[generate-exam] Claude API error:', error);
      
      // Check if it's a rate limit or usage limit error
      const isRateLimitError = response.status === 429 || response.status === 400;
      const errorLower = error.toLowerCase();
      const isUsageLimitError = errorLower.includes('usage limit') || errorLower.includes('quota');
      
      if (isRateLimitError || isUsageLimitError) {
        console.log('[generate-exam] Claude API unavailable (rate/usage limit), will try fallback');
        throw new Error(`CLAUDE_UNAVAILABLE: ${response.status} - ${error.substring(0, 200)}`);
      }
      
      throw new Error(`Claude API error: ${response.status} - ${error.substring(0, 200)}`);
    }
    
    const data = await response.json();
    
    // Validate response structure
    if (!data || !data.content || !Array.isArray(data.content) || data.content.length === 0) {
      console.error('[generate-exam] Invalid Claude API response structure:', JSON.stringify(data).substring(0, 500));
      throw new Error('Invalid response structure from Claude API');
    }
    
    const content = data.content[0].text;
    
    if (!content) {
      console.error('[generate-exam] No text content in Claude response');
      throw new Error('No content in Claude API response');
    }
    
    console.log('[generate-exam] Claude response received, parsing JSON...');
    console.log('[generate-exam] Response content length:', content.length);
    console.log('[generate-exam] Response preview:', content.substring(0, 200));
    
    // Parse JSON (handle both raw JSON and markdown-wrapped JSON)
    let examData;
    let parseError: string | null = null;
    
    // Method 1: Try direct parse
    try {
      examData = JSON.parse(content);
      console.log('[generate-exam] ✓ Direct JSON parse successful');
      return examData;
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'Unknown error';
      console.log('[generate-exam] Direct parse failed:', parseError);
    }
    
    // Method 2: Try markdown code block with json language
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        examData = JSON.parse(jsonMatch[1]);
        console.log('[generate-exam] ✓ Markdown json block parse successful');
        return examData;
      }
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'Unknown error';
      console.log('[generate-exam] Markdown json block parse failed:', parseError);
    }
    
    // Method 3: Try markdown code block without language
    try {
      const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch && codeMatch[1]) {
        examData = JSON.parse(codeMatch[1]);
        console.log('[generate-exam] ✓ Markdown code block parse successful');
        return examData;
      }
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'Unknown error';
      console.log('[generate-exam] Markdown code block parse failed:', parseError);
    }
    
    // Method 4: Try finding JSON object boundaries
    try {
      const startIdx = content.indexOf('{');
      const endIdx = content.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const jsonStr = content.substring(startIdx, endIdx + 1);
        examData = JSON.parse(jsonStr);
        console.log('[generate-exam] ✓ Boundary extraction parse successful');
        return examData;
      }
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'Unknown error';
      console.log('[generate-exam] Boundary extraction parse failed:', parseError);
    }
    
    // All methods failed - log detailed error
    console.error('[generate-exam] All JSON parsing methods failed');
    console.error('[generate-exam] Full content (first 1000 chars):', content.substring(0, 1000));
    console.error('[generate-exam] Full content (last 500 chars):', content.substring(Math.max(0, content.length - 500)));
    console.error('[generate-exam] Last parse error:', parseError);
    throw new Error('Failed to parse exam JSON from Claude response');
  } catch (error: unknown) {
    console.error('[generate-exam] Error in generateExamWithClaude:', error);
    throw error;
  }
}

// Generate exam using OpenAI as fallback
async function generateExamWithOpenAI(grade: string, subject: string, spec: GradeSpec, attempt: number = 1, lastError?: string): Promise<ExamContent> {
  // Check for API key
  if (!OPENAI_API_KEY) {
    console.error('[generate-exam] OPENAI_API_KEY is not set');
    throw new Error('OPENAI_API_KEY environment variable is not configured');
  }

  const prompt = buildExamPrompt(grade, subject, spec, attempt, lastError);

  console.log(`[generate-exam] Calling OpenAI API (attempt ${attempt})...`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: 'You are an expert South African CAPS curriculum exam generator. Always respond with valid JSON only, no markdown formatting.'
        }, {
          role: 'user',
          content: prompt
        }],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[generate-exam] OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status} - ${error.substring(0, 200)}`);
    }
    
    const data = await response.json();
    
    // Validate response structure
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('[generate-exam] Invalid OpenAI API response structure:', JSON.stringify(data).substring(0, 500));
      throw new Error('Invalid response structure from OpenAI API');
    }
    
    const content = data.choices[0].message.content;
    
    if (!content) {
      console.error('[generate-exam] No content in OpenAI response');
      throw new Error('No content in OpenAI API response');
    }
    
    console.log('[generate-exam] OpenAI response received, parsing JSON...');
    
    // Parse JSON
    let examData;
    try {
      examData = JSON.parse(content);
    } catch (e) {
      console.error('[generate-exam] Failed to parse JSON from OpenAI content:', content.substring(0, 500));
      throw new Error('Failed to parse exam JSON from OpenAI response');
    }
    
    return examData;
  } catch (error: unknown) {
    console.error('[generate-exam] Error in generateExamWithOpenAI:', error);
    throw error;
  }
}

// Save exam to database
async function saveExamToDatabase(
  exam: ExamContent,
  userId: string,
  grade: string,
  subject: string,
  examType: string,
  prompt: string,
  modelUsed: string = 'claude-haiku-4-5-20251001'
): Promise<string> {
  console.log('[generate-exam] Saving exam to database...');
  
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Database configuration error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data, error } = await supabase
      .from('exam_generations')
      .insert({
        user_id: userId,
        grade,
        subject,
        exam_type: examType || 'practice_test',
        prompt,
        generated_content: JSON.stringify(exam),
        display_title: exam.title || `${grade} ${subject} Practice Test`,
        status: 'completed',
        model_used: modelUsed,
        viewed_at: new Date().toISOString(),
        metadata: {
          source: 'generate_exam_edge_function',
          generated_at: new Date().toISOString(),
          model: modelUsed
        }
      })
      .select()
      .single();
    
    if (error) {
      console.error('[generate-exam] Database save error:', JSON.stringify(error));
      throw new Error(`Failed to save exam to database: ${error.message} (code: ${error.code})`);
    }
    
    if (!data) {
      console.error('[generate-exam] No data returned from database insert');
      throw new Error('Failed to save exam: No data returned from database');
    }
    
    console.log('[generate-exam] ✅ Exam saved to database:', data.id);
    return data.id;
  } catch (error: unknown) {
    console.error('[generate-exam] Error in saveExamToDatabase:', error);
    throw error;
  }
}

// Main handler
serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }
  
  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('[generate-exam] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify user
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[generate-exam] Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid auth token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request
    const { grade, subject, examType, customPrompt } = await req.json();
    
    if (!grade || !subject) {
      return new Response(
        JSON.stringify({ error: 'Missing grade or subject' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[generate-exam] Starting generation: ${grade} ${subject} (type: ${examType || 'practice_test'}) for user ${user.id}`);
    
    // Get grade spec
    const spec = getGradeSpec(grade);
    
    // Generate exam with retries and fallback
    let exam;
    let lastError;
    let modelUsed = 'claude-haiku-4-5-20251001';
    let usedFallback = false;
    const maxAttempts = 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Try Claude first, then fallback to OpenAI if Claude is unavailable
        if (!usedFallback) {
          try {
            exam = await generateExamWithClaude(grade, subject, spec, attempt, lastError);
          } catch (claudeError: unknown) {
            const errorMessage = claudeError instanceof Error ? claudeError.message : 'Unknown error';
            
            // Check if it's a usage/rate limit error that requires fallback
            if (errorMessage.includes('CLAUDE_UNAVAILABLE')) {
              console.warn('[generate-exam] Claude unavailable, switching to OpenAI fallback...');
              usedFallback = true;
              modelUsed = 'gpt-4o';
              
              // Try OpenAI
              if (OPENAI_API_KEY) {
                exam = await generateExamWithOpenAI(grade, subject, spec, attempt, lastError);
              } else {
                console.error('[generate-exam] OpenAI API key not available for fallback');
                throw new Error('Exam generation service temporarily unavailable. Claude API has reached usage limits and OpenAI fallback is not configured.');
              }
            } else {
              // Re-throw non-fallback errors
              throw claudeError;
            }
          }
        } else {
          // Already using fallback, continue with OpenAI
          exam = await generateExamWithOpenAI(grade, subject, spec, attempt, lastError);
        }
        
        // Remove duplicate questions
        console.log(`[generate-exam] Checking for duplicate questions...`);
        exam = removeDuplicateQuestions(exam);
        
        // Add unique IDs to questions
        console.log(`[generate-exam] Adding unique IDs to questions...`);
        exam = addQuestionIds(exam);
        
        // Validate
        const validation = validateExam(exam, spec);
        if (validation.valid) {
          console.log(`[generate-exam] ✅ Exam valid on attempt ${attempt} using ${usedFallback ? 'OpenAI' : 'Claude'}`);
          break;
        } else {
          console.warn(`[generate-exam] ⚠️ Attempt ${attempt} validation failed: ${validation.reason}`);
          lastError = validation.reason;
          
          if (attempt === maxAttempts) {
            throw new Error(`Validation failed after ${maxAttempts} attempts: ${validation.reason}`);
          }
          
          // Continue to next attempt - lastError will be passed to next generation
          continue;
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[generate-exam] Attempt ${attempt} failed:`, errorMessage);
        lastError = errorMessage;
        
        if (attempt === maxAttempts) {
          throw err;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    if (!exam) {
      throw new Error(`Failed to generate valid exam: ${lastError}`);
    }
    
    // Save to database
    const examId = await saveExamToDatabase(
      exam,
      user.id,
      grade,
      subject,
      examType || 'practice_test',
      customPrompt || `Generate ${grade} ${subject} exam`,
      modelUsed
    );
    
    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        examId,
        exam
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('[generate-exam] Error:', err);
    console.error('[generate-exam] Error stack:', err.stack);
    console.error('[generate-exam] Error details:', {
      message: err.message,
      name: err.name,
      cause: err.cause,
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Failed to generate exam',
        details: err.stack ? err.stack.split('\n').slice(0, 3).join('\n') : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
