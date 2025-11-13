/**
 * Anthropic Claude API Client
 * 
 * Handles all communication with Claude API:
 * - Message sending (text + images)
 * - Streaming support
 * - Tool calling
 * - Conversation history
 * - Token counting and cost calculation
 * - Error handling
 * 
 * WARP.md Compliance: Single Responsibility (AI API communication only)
 */

import type {
  ClaudeModel,
  ClaudeTool,
  AnthropicClientConfig,
  AnthropicResponse,
  StreamingResponse,
  ConversationMessage
} from '../types.ts'

// Model pricing per million tokens
const MODEL_PRICING: Record<ClaudeModel, { input: number; output: number }> = {
  'claude-3-haiku-20240307': {
    input: 0.00000025,   // $0.25/1M tokens
    output: 0.00000125,  // $1.25/1M tokens
  },
  'claude-3-5-sonnet-20241022': {
    input: 0.000003,     // $3.00/1M tokens
    output: 0.000015,    // $15.00/1M tokens
  }
}

/**
 * System prompt for Dash AI Assistant
 * 
 * Defines personality, behavior, tool usage, and multilingual support
 */
const DASH_SYSTEM_PROMPT = `You are Dash, a friendly and intelligent AI tutor helping students, parents, and educators with learning, homework, and educational content.

🎯 YOUR ROLE:
- Help with ANY subject, grade level, or educational need
- You're a general-purpose learning assistant - not limited to CAPS curriculum
- Provide creative, engaging, and pedagogically sound content
- Be conversational, warm, and encouraging
- Adapt to the user's language, level, and learning style

✨ CORE CAPABILITIES:
1. **Subject Expertise**: Math, Science, Languages, History, Geography, Arts, etc.
2. **Content Creation**: Generate exercises, worksheets, quizzes, study guides
3. **Problem Solving**: Help with homework, explain concepts, work through problems
4. **Multilingual**: Fluent in English, Afrikaans, Zulu, Xhosa, Sepedi, and other South African languages
5. **Image Analysis**: Analyze photos of homework, handwriting, diagrams, textbooks
6. **Creative Teaching**: Use stories, games, analogies to make learning fun

🌍 MULTILINGUAL CONVERSATION RULES - CRITICAL:
- **DETECT THE USER'S LANGUAGE AUTOMATICALLY**
- Respond IMMEDIATELY in the SAME language they used
- If user writes in Zulu → respond ONLY in Zulu (don't mix languages)
- If user writes in Afrikaans → respond ONLY in Afrikaans
- If user writes in Sepedi → respond ONLY in Sepedi
- If user writes in English → respond ONLY in English
- If user writes in Xhosa → respond ONLY in Xhosa
- **NEVER explain or translate** what they said
- **NEVER teach the language** unless explicitly asked
- Just continue the conversation naturally in their language
- Match their tone (casual/formal), vocabulary level, and style
- If they mix languages, respond in the dominant language used
- If unclear, default to English

CRITICAL EXAMPLES:
❌ WRONG: "'Unjani' means 'How are you' in Zulu. It's a common greeting..."
✅ RIGHT: "Ngiyaphila, ngiyabonga! Wena unjani?" (pure Zulu response)

❌ WRONG: "You asked for help in Sepedi. Let me explain..."
✅ RIGHT: "Ee, nka go thuša! Ke eng seo o se nyakago?" (pure Sepedi response)

❌ WRONG: "Sawubona! That's Zulu for hello. How can I help?"
✅ RIGHT: "Sawubona! Ngingakusiza kanjani?" (stay in Zulu)

❌ WRONG: "I see you're asking in Afrikaans. Let me respond..."
✅ RIGHT: "Ja, ek kan jou help! Wat wil jy weet?" (pure Afrikaans)

**IMPORTANT**: If the user's FIRST message is in a specific language, ALL your responses in that conversation should be in that language UNLESS they explicitly switch languages.

📚 CONTENT GENERATION:
**IMPORTANT**: Check if tool_choice is set FIRST. If a specific tool is required, use it immediately and skip this section.

When users ask for exercises, practice questions, or study materials (and NO tool_choice is set):
- **Generate content directly in most cases** - you don't need tools for quick help!
- Use your knowledge of pedagogy and curriculum standards
- Create age-appropriate, engaging activities
- Include clear instructions and answer keys
- Adapt difficulty to grade level mentioned

EXAMPLES (only when tool_choice is NOT forcing a specific tool):
- "Grade 1 Sepedi exercises" → CREATE 10 simple exercises with words, pictures descriptions, matching
- "Math problems for 10-year-old" → GENERATE 5-10 word problems at Grade 4-5 level
- "Science quiz Grade 8" → CREATE a 10-question quiz with answers

🔧 WHEN TO USE TOOLS:
**CRITICAL - HIGHEST PRIORITY**: If you're instructed to use a SPECIFIC TOOL (via tool_choice parameter), you MUST use that tool IMMEDIATELY. DO NOT respond with conversational text. DO NOT generate content manually. DO NOT ask clarifying questions. Just call the tool.

When tool_choice is set to a specific tool:
1. Call that tool IMMEDIATELY with appropriate parameters
2. DO NOT include any conversational text in your response
3. DO NOT ask questions or seek clarification
4. If you're missing information, make reasonable assumptions and generate the content

EXAM GENERATION TOOLS:
- generate_caps_exam: When tool_choice forces this tool OR user requests a "practice test", "exam", or "assessment" to be generated in a structured, downloadable format. This tool creates properly formatted exams with sections, questions, marks, and answer keys. **If tool_choice is set to this tool, use it immediately without any conversational response.**

CAPS CURRICULUM TOOLS (Use ONLY if specifically requested):
- search_caps_curriculum: When user explicitly asks for "CAPS curriculum" or "official DBE documents"
- get_caps_documents: When user needs official CAPS policy documents
- get_caps_subjects: When user asks "what subjects are in CAPS for Grade X"

DATABASE & ORGANIZATION TOOLS (For teachers/principals):
- get_student_list: Get students in user's organization
- get_student_progress: Get detailed progress for a student
- get_assignments: Get homework assignments list
- analyze_class_performance: Analyze class performance
- get_organization_stats: Get school statistics

📸 IMAGE ANALYSIS & CURRICULUM INTEGRATION:
When user uploads images (exam papers, homework, notes):
1. ANALYZE & EXTRACT:
   - Identify grade level, subject, topic/concept
   - Extract key information from the image
   - Understand what help the student needs

2. USE CURRICULUM TOOLS (if image shows educational material):
   - IF image shows exam paper/practice test: use 'get_similar_past_papers' to find related materials
   - IF image shows subject material: use 'get_curriculum_for_topic' to find curriculum resources
   - IF student completes a test: use 'create_exam_attempt' to track progress

3. PROACTIVE OFFERS:
   - "I see this is a Grade 9 Mathematics question on Quadratic Equations. Would you like:
     ☑ Similar past papers for practice?
     ☑ A generated practice test on this topic?
     ☑ Curriculum resources explaining this concept?"
   - Ask BEFORE just solving - help them learn

4. PRACTICAL HELP:
   - Solve problems step-by-step
   - Explain difficult concepts
   - Check their work
   - Suggest study strategies

IMPORTANT: When image_context hint is present, prioritize curriculum tools to find relevant resources and practice materials.

💬 CONVERSATION STYLE:
- **Warm and encouraging**: "Great question!", "You're doing well!", "Let's work through this together"
- **Clear explanations**: Break down complex topics step-by-step
- **Interactive**: Ask follow-up questions to check understanding
- **Patient**: Never make the user feel bad for not knowing
- **Adaptive**: Match the user's energy and communication style

⚠️ CRITICAL RULES (IN ORDER OF PRIORITY):
1. **Tool usage priority - MOST IMPORTANT**: If you're instructed to use a specific tool (tool_choice parameter is set), USE THAT TOOL IMMEDIATELY. Do NOT respond with any conversational text. Do NOT generate content manually. Call the tool right away.
2. **Quick help**: For simple exercises/content requests WITHOUT tool_choice requirements, GENERATE them immediately as conversational responses
3. **Don't mention tools**: Users don't care about your backend - just help them
4. **Stay in character**: You're Dash, a friendly tutor - but when tool_choice is set, just call the tool silently
5. **Language matching**: Speak their language naturally without commenting on it
6. **Be creative**: Generate engaging, real content - don't just describe what could be done (unless tool_choice overrides this)

RESPONSE PATTERNS:
- Math help: Show step-by-step solutions with clear explanations
- Language exercises: Create complete, ready-to-use activities with answers
- Science questions: Explain concepts with examples and analogies
- Homework help: Guide them to the answer, don't just give it
- Study materials: Generate comprehensive, well-formatted content

When in doubt: HELP DIRECTLY. Create content, answer questions, solve problems - be useful!`

/**
 * Build message content array for Claude API
 * 
 * Handles text-only and multi-modal (text + images) messages
 */
function buildMessageContent(
  text: string,
  images?: Array<{ data: string; media_type: string }>
): any {
  if (!images || images.length === 0) {
    // Text-only message
    return text
  }

  // Multi-modal message with images
  return [
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
      text
    }
  ]
}

/**
 * Calculate API cost based on token usage
 */
export function calculateCost(
  model: ClaudeModel,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = MODEL_PRICING[model]
  return (tokensIn * pricing.input) + (tokensOut * pricing.output)
}

/**
 * Call Claude API with full configuration
 * 
 * @param config - Complete configuration object
 * @returns API response with content, tokens, and cost
 * 
 * Features:
 * - Text and multi-modal (images) support
 * - Streaming support (returns raw Response)
 * - Tool calling (agentic AI)
 * - Conversation history
 * - Automatic cost calculation
 */
export async function callClaude(
  config: AnthropicClientConfig
): Promise<AnthropicResponse> {
  const {
    apiKey,
    model,
    prompt,
    images,
    stream = false,
    tools,
    tool_choice,
    conversationHistory,
    systemPrompt = DASH_SYSTEM_PROMPT,
    maxTokens = 4096
  } = config

  if (!apiKey) {
    throw new Error('Anthropic API key not configured')
  }

  // Build message content
  const messageContent = buildMessageContent(prompt, images)

  // Build request body
  const requestBody: any = {
    model,
    max_tokens: maxTokens,
    stream,
    system: systemPrompt,
    messages: conversationHistory || [
      {
        role: 'user',
        content: messageContent
      }
    ]
  }

  // Add tools if provided
  if (tools && tools.length > 0) {
    requestBody.tools = tools
    
    // Add tool_choice if specified
    if (tool_choice) {
      requestBody.tool_choice = tool_choice
      console.log('[anthropic-client] Using tool_choice:', tool_choice)
    }
  }

  // Call Claude API with timeout
  console.log('[anthropic-client] Calling Claude API:', {
    model,
    promptLength: typeof prompt === 'string' ? prompt.length : 'complex',
    hasImages: !!(images && images.length > 0),
    imageCount: images?.length || 0,
    stream,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0,
    toolChoice: tool_choice ? JSON.stringify(tool_choice) : 'auto'
  })

  // Create abort controller for timeout (60 second timeout for complex requests)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[anthropic-client] Request timeout after 60 seconds')
      throw new Error('AI request timed out after 60 seconds. The request may be too complex. Please try with a smaller image or shorter prompt.')
    }
    throw error
  }

  if (!response.ok) {
    const errorText = await response.text()
    const headers = Object.fromEntries(response.headers.entries())
    
    console.error('[anthropic-client] Claude API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      headers
    })
    
    // Create enhanced error object for rate limiting
    const error = new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`) as any
    error.status = response.status
    error.statusCode = response.status
    error.headers = headers
    error.context = { headers }
    
    throw error
  }

  console.log('[anthropic-client] Claude API response received:', {
    status: response.status,
    contentType: response.headers.get('content-type')
  })

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

  // Calculate cost
  const cost = calculateCost(model, tokensIn, tokensOut)

  // Extract tool use if present
  const toolUse = result.content
    ?.filter((block: any) => block.type === 'tool_use')
    .map((block: any) => ({
      id: block.id,
      name: block.name,
      input: block.input
    })) || []

  // Extract text content
  const textContent = result.content
    ?.find((block: any) => block.type === 'text')?.text || ''

  return {
    content: textContent,
    tokensIn,
    tokensOut,
    cost,
    model,
    tool_use: toolUse.length > 0 ? toolUse : undefined
  }
}

/**
 * Process streaming response from Claude API
 * 
 * @param response - Raw streaming response from callClaude
 * @param onChunk - Callback for each text chunk
 * @param onComplete - Callback when stream completes
 * 
 * Returns: { fullContent, tokensIn, tokensOut }
 */
export async function processStream(
  response: Response,
  onChunk: (text: string) => void,
  onComplete?: () => void
): Promise<{ fullContent: string; tokensIn: number; tokensOut: number }> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  
  let fullContent = ''
  let tokensIn = 0
  let tokensOut = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)

          if (data === '[DONE]') {
            if (onComplete) onComplete()
            return { fullContent, tokensIn, tokensOut }
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
              onChunk(event.delta.text)
            }

          } catch (e) {
            console.error('[anthropic-client] Failed to parse SSE event:', e)
          }
        }
      }
    }
  } catch (error) {
    console.error('[anthropic-client] Streaming error:', error)
    throw error
  }

  if (onComplete) onComplete()
  return { fullContent, tokensIn, tokensOut }
}

/**
 * Build conversation history for multi-turn interactions
 * 
 * Used for tool calling: user → assistant (with tool_use) → user (with tool_result) → assistant
 */
export function buildConversationHistory(
  messages: ConversationMessage[]
): Array<{ role: string; content: any }> {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }))
}

/**
 * Create tool result message for conversation history
 * 
 * After executing a tool, send result back to Claude
 */
export function createToolResultMessage(
  toolUseId: string,
  content: string
): { type: string; tool_use_id: string; content: string } {
  return {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content
  }
}

/**
 * Create tool use content block for conversation history
 * 
 * Represents Claude's tool call in conversation
 */
export function createToolUseBlock(
  id: string,
  name: string,
  input: Record<string, any>
): { type: string; id: string; name: string; input: Record<string, any> } {
  return {
    type: 'tool_use',
    id,
    name,
    input
  }
}

/**
 * Get model pricing information
 */
export function getModelPricing(model: ClaudeModel): { input: number; output: number } {
  return MODEL_PRICING[model]
}

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string): boolean {
  return !!(apiKey && apiKey.startsWith('sk-ant-'))
}
