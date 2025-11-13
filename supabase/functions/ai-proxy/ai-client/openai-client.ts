/**
 * OpenAI API Client (Fallback)
 * 
 * Provides fallback AI service when Anthropic is rate-limited or unavailable.
 * Supports GPT-4 and GPT-3.5 models.
 */

export interface OpenAIClientConfig {
  apiKey: string;
  model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'gpt-4o' | 'gpt-4o-mini';
  prompt: string;
  images?: Array<{ data: string; media_type: string }>;
  stream?: boolean;
  conversationHistory?: Array<{ role: string; content: any }>;
  systemPrompt?: string;
  maxTokens?: number;
  tools?: Array<any>; // Claude-format tools
  tool_choice?: any;
}

export interface OpenAIResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  model: string;
  response?: Response; // For streaming
  tool_calls?: Array<{
    id: string;
    name: string;
    arguments: any;
  }>;
}

// Model pricing per 1K tokens
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4': {
    input: 0.00003,     // $0.03/1K tokens
    output: 0.00006,    // $0.06/1K tokens
  },
  'gpt-4-turbo': {
    input: 0.00001,     // $0.01/1K tokens
    output: 0.00003,    // $0.03/1K tokens
  },
  'gpt-4o': {
    input: 0.0000025,   // $0.0025/1K tokens
    output: 0.00001,    // $0.01/1K tokens
  },
  'gpt-4o-mini': {
    input: 0.00000015,  // $0.00015/1K tokens (super cheap!)
    output: 0.0000006,  // $0.0006/1K tokens
  },
  'gpt-3.5-turbo': {
    input: 0.0000005,   // $0.0005/1K tokens
    output: 0.0000015,  // $0.0015/1K tokens
  }
};

/**
 * System prompt for OpenAI fallback
 */
const DASH_SYSTEM_PROMPT = `You are Dash, a friendly and intelligent AI tutor helping students, parents, and educators with learning, homework, and educational content.

🎯 CRITICAL TOOL USAGE RULES - HIGHEST PRIORITY:
1. If you receive a tool_choice parameter forcing a specific tool, you MUST call that tool IMMEDIATELY
2. DO NOT respond with conversational text when tool_choice is set
3. DO NOT ask clarifying questions when a specific tool is required
4. Just call the tool with appropriate parameters right away

When tool_choice forces you to use generate_caps_exam:
- Call it immediately with complete exam structure
- Do NOT include any conversational greeting or text
- Do NOT ask what topics to focus on
- Generate the full exam in one tool call

For normal conversations (no tool_choice set):
- Be conversational, warm, and encouraging
- Adapt to the user's language, level, and learning style  
- Provide clear explanations and break down complex topics step-by-step
- When users ask in a specific language (English, Afrikaans, Zulu, Xhosa, Sepedi), respond in that same language naturally

REMEMBER: tool_choice parameter = use that tool silently, no conversation!`;

/**
 * Calculate API cost based on token usage
 */
function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-3.5-turbo'];
  return (tokensIn * pricing.input) + (tokensOut * pricing.output);
}

/**
 * Convert Claude tool format to OpenAI function format
 */
function convertToolsToOpenAI(tools?: Array<any>): Array<any> | undefined {
  if (!tools || tools.length === 0) return undefined;
  
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));
}

/**
 * Build messages array for OpenAI API
 */
function buildMessages(
  systemPrompt: string,
  prompt: string,
  images?: Array<{ data: string; media_type: string }>,
  conversationHistory?: Array<{ role: string; content: any }>
): Array<any> {
  const messages: Array<any> = [
    { role: 'system', content: systemPrompt }
  ];

  // Helper: convert Claude-style content to OpenAI format
  const convertContent = (content: any) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const parts: any[] = [];
      for (const part of content) {
        if (part?.type === 'text' && typeof part.text === 'string') {
          parts.push({ type: 'text', text: part.text });
        } else if (part?.type === 'image' && part.source?.type === 'base64' && part.source?.data && part.source?.media_type) {
          parts.push({
            type: 'image_url',
            image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` }
          });
        }
        // Ignore unsupported part types
      }
      // If only one text part, return as string; else return multi-part array
      if (parts.length === 1 && parts[0].type === 'text') return parts[0].text;
      return parts;
    }
    // Fallback: stringify unknown structures
    try { return JSON.stringify(content); } catch { return String(content); }
  };

  // Add conversation history if provided (convert to OpenAI format)
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      // Skip tool role messages (OpenAI expects tool messages only with function calling context)
      if (msg.role === 'tool') continue;
      messages.push({ role: msg.role, content: convertContent(msg.content) });
    }
  } else {
    // Build user message with optional images
    if (images && images.length > 0) {
      // Multi-modal message with images (GPT-4o family)
      const content: Array<any> = [
        { type: 'text', text: prompt }
      ];
      
      for (const img of images) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${img.media_type};base64,${img.data}`
          }
        });
      }
      
      messages.push({ role: 'user', content });
    } else {
      // Text-only message
      messages.push({ role: 'user', content: prompt });
    }
  }

  return messages;
}

/**
 * Call OpenAI API as a fallback
 * 
 * @param config - Configuration object
 * @returns API response with content, tokens, and cost
 */
export async function callOpenAI(
  config: OpenAIClientConfig
): Promise<OpenAIResponse> {
  const {
    apiKey,
    model,
    prompt,
    images,
    stream = false,
    conversationHistory,
    systemPrompt = DASH_SYSTEM_PROMPT,
    maxTokens = 4096,
    tools,
    tool_choice
  } = config;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log('[openai-client] Calling OpenAI API (fallback):', {
    model,
    promptLength: typeof prompt === 'string' ? prompt.length : 'complex',
    hasImages: !!(images && images.length > 0),
    imageCount: images?.length || 0,
    stream,
    hasTools: !!(tools && tools.length > 0),
    toolCount: tools?.length || 0
  });

  // Build messages
  const messages = buildMessages(systemPrompt, prompt, images, conversationHistory);

  // Convert Claude tools to OpenAI format
  const openaiTools = convertToolsToOpenAI(tools);
  
  // Build request body
  const requestBody: any = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
    stream
  };
  
  // Add tools if provided
  if (openaiTools && openaiTools.length > 0) {
    requestBody.tools = openaiTools;
    
    // Add tool_choice if specified
    if (tool_choice) {
      if (tool_choice.type === 'tool' && tool_choice.name) {
        requestBody.tool_choice = {
          type: 'function',
          function: { name: tool_choice.name }
        };
      } else if (tool_choice.type === 'auto') {
        requestBody.tool_choice = 'auto';
      } else if (tool_choice.type === 'any') {
        requestBody.tool_choice = 'required'; // OpenAI uses 'required' for 'any'
      }
    }
  }

  // Create abort controller for timeout (60 second timeout)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  let response: Response;
  try {
    // Call OpenAI API
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[openai-client] Request timeout after 60 seconds');
      throw new Error('OpenAI request timed out after 60 seconds. Please try with a smaller image or shorter prompt.');
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    const headers = Object.fromEntries(response.headers.entries());
    
    console.error('[openai-client] OpenAI API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      headers
    });
    
    // Create enhanced error object for rate limiting
    const error = new Error(`OpenAI API error: ${response.status} ${response.statusText}`) as any;
    error.status = response.status;
    error.statusCode = response.status;
    error.headers = headers;
    error.context = { headers };
    
    throw error;
  }

  console.log('[openai-client] OpenAI API response received:', {
    status: response.status,
    contentType: response.headers.get('content-type')
  });

  // If streaming, return raw response
  if (stream) {
    return {
      content: '',
      tokensIn: 0,
      tokensOut: 0,
      cost: 0,
      model,
      response
    };
  }

  // Non-streaming: parse full response
  const result = await response.json();

  const tokensIn = result.usage?.prompt_tokens || 0;
  const tokensOut = result.usage?.completion_tokens || 0;
  const cost = calculateCost(model, tokensIn, tokensOut);

  const message = result.choices?.[0]?.message;
  const content = message?.content || '';
  
  // Extract tool calls if present
  let tool_calls: Array<{ id: string; name: string; arguments: any }> | undefined;
  if (message?.tool_calls && message.tool_calls.length > 0) {
    tool_calls = message.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments)
    }));
    
    console.log('[openai-client] Tool calls detected:', tool_calls.map(tc => tc.name));
  }

  return {
    content,
    tokensIn,
    tokensOut,
    cost,
    model,
    tool_calls
  };
}

/**
 * Validate OpenAI API key format
 */
export function validateOpenAIKey(apiKey: string): boolean {
  return !!(apiKey && apiKey.startsWith('sk-'));
}
