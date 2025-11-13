/**
 * DashAIClient
 * 
 * Handles all AI service communication via Supabase Edge Functions.
 * Extracted from DashAICore for file size compliance (WARP.md).
 * 
 * Supports:
 * - Non-streaming HTTP requests
 * - SSE streaming (web)
 * - WebSocket streaming (React Native - Phase 2)
 * 
 * References:
 * - Supabase JS v2: https://supabase.com/docs/reference/javascript/introduction
 * - Fetch API: https://developer.mozilla.org/docs/Web/API/Fetch_API
 * - React Native 0.79 WebSocket: https://reactnative.dev/docs/0.79/network#websocket-support
 */

// Global declarations for React Native environment
// Reference: https://reactnative.dev/docs/javascript-environment
declare const __DEV__: boolean;

/**
 * AI service call parameters
 */
export interface AIServiceParams {
  action?: string;
  messages?: Array<{ role: string; content: string }>;
  content?: string;
  userInput?: string;
  context?: string;
  attachments?: any[];
  stream?: boolean;
  onChunk?: (chunk: string) => void;
}

/**
 * AI service response
 */
export interface AIServiceResponse {
  content: string;
  metadata?: {
    usage?: {
      tokens_in?: number;
      tokens_out?: number;
      cost?: number;
    };
    tool_results?: any[];
  };
  error?: string;
}

/**
 * User profile for scope determination
 */
export interface UserProfile {
  role?: string;
}

/**
 * DashAIClient configuration
 */
export interface DashAIClientConfig {
  supabaseClient: any;
  getUserProfile: () => UserProfile | undefined;
}

/**
 * DashAIClient
 * 
 * Handles AI service communication via ai-proxy Edge Function.
 */
export class DashAIClient {
  private supabaseClient: any;
  private getUserProfile: () => UserProfile | undefined;
  
  constructor(config: DashAIClientConfig) {
    this.supabaseClient = config.supabaseClient;
    this.getUserProfile = config.getUserProfile;
  }
  
  /**
   * Call AI service with tool support (non-streaming)
   * 
   * References:
   * - Supabase Functions invoke: https://supabase.com/docs/reference/javascript/invoke
   */
  public async callAIService(params: AIServiceParams): Promise<AIServiceResponse> {
    try {
      // Tools enabled - Dash can now autonomously call tools like Claude Sonnet 4.5
      const ENABLE_TOOLS = true;
      
      if (__DEV__) {
        console.log('[DashAIClient] Calling AI service:', {
          action: params.action,
          streaming: params.stream || false,
          toolsEnabled: ENABLE_TOOLS,
        });
      }
      
      // If streaming requested, use streaming endpoint
      if (params.stream && params.onChunk) {
        // Build prompt from messages and delegate to streaming path
        const messagesArr = Array.isArray(params.messages) ? params.messages : [];
        const promptText = messagesArr.length > 0
          ? messagesArr.map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content || ''}`).join('\n')
          : String(params.content || params.userInput || '');
        return await this.callAIServiceStreaming({ promptText, context: params.context || undefined }, params.onChunk);
      }
      
      // Non-streaming call to ai-proxy
      const messagesArr = Array.isArray(params.messages) ? params.messages : [];
      const promptText = messagesArr.length > 0
        ? messagesArr.map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content || ''}`).join('\n')
        : String(params.content || params.userInput || '');
      const role = (this.getUserProfile()?.role || 'teacher').toString().toLowerCase();
      const scope: 'teacher' | 'principal' | 'parent' = (['teacher', 'principal', 'parent'].includes(role) ? role : 'teacher') as any;
      const { data, error } = await this.supabaseClient.functions.invoke('ai-proxy', {
        body: {
          scope,
          service_type: 'dash_conversation',
          payload: {
            prompt: promptText,
            context: params.context || undefined,
          },
          stream: false,
          enable_tools: ENABLE_TOOLS,
          metadata: {
            role: scope
          }
        },
      });
      
      if (error) {
        console.error('[DashAIClient] AI service error:', error);
        throw error;
      }
      
      // Handle response with potential tool use
      const assistantContent = data?.content || '';
      const toolResults = data?.tool_results || [];

      if (__DEV__ && toolResults.length > 0) {
        console.log('[DashAIClient] Tool calls executed:', toolResults.length);
      }

      if (!data?.success) {
        return { content: assistantContent };
      }
      
      return { 
        content: data.content, 
        metadata: { 
          usage: data.usage,
          tool_results: toolResults
        } 
      };
    } catch (error) {
      console.error('[DashAIClient] AI service call failed:', error);
      return {
        content: 'I apologize, but I encountered an issue. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Call AI service with streaming support (SSE)
   * 
   * Note: Streaming is not fully supported on React Native due to fetch limitations.
   * For Phase 0, we fall back to parsing full response.
   * 
   * TODO (Phase 2): Implement WebSocket streaming for React Native
   * See: docs/features/DASH_AI_STREAMING_UPGRADE_PLAN.md
   * 
   * References:
   * - Supabase auth getSession: https://supabase.com/docs/reference/javascript/auth-getsession
   * - Fetch streaming: https://developer.mozilla.org/docs/Web/API/Streams_API/Using_readable_streams
   */
  private async callAIServiceStreaming(params: any, onChunk: (chunk: string) => void): Promise<AIServiceResponse> {
    // Feature flag: Use WebSocket streaming on React Native when enabled
    // Reference: https://reactnative.dev/docs/0.79/platform-specific-code
    const useWebSocket = process.env.EXPO_PUBLIC_USE_WEBSOCKET_STREAMING === 'true';
    
    if (useWebSocket) {
      try {
        return await this.callAIServiceStreamingWS(params, onChunk);
      } catch (error) {
        console.warn('[DashAIClient] WebSocket streaming failed, falling back to SSE:', error);
        // Fall through to SSE implementation below
      }
    }

    // Performance instrumentation (Phase 2)
    // References:
    // - Sentry Performance: https://docs.sentry.io/platforms/react-native/performance/
    // - PostHog Events: https://posthog.com/docs/libraries/react-native
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let tokenCount = 0;

    try {
      const { data: sessionData } = await this.supabaseClient.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No auth session for streaming');
      }
      
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');
      }
      
      const url = `${supabaseUrl}/functions/v1/ai-proxy`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          scope: (['teacher','principal','parent'].includes((this.getUserProfile()?.role || 'teacher').toString().toLowerCase())
            ? (this.getUserProfile()?.role || 'teacher').toString().toLowerCase()
            : 'teacher'),
          service_type: 'dash_conversation',
          payload: {
            prompt: params.promptText,
            context: params.context || undefined,
          },
          stream: true,
          enable_tools: true,
          metadata: {
            role: (['teacher','principal','parent'].includes((this.getUserProfile()?.role || 'teacher').toString().toLowerCase())
              ? (this.getUserProfile()?.role || 'teacher').toString().toLowerCase()
              : 'teacher')
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Streaming failed: ${response.status}`);
      }
      
      // React Native fetch doesn't support streaming ReadableStream
      // Fall back to reading the entire response and parsing SSE format
      if (!response.body || typeof response.body.getReader !== 'function') {
        console.warn('[DashAIClient] Streaming not supported in this environment, parsing SSE from full response');
        const sseText = await response.text();
        
        // Parse SSE format to extract content_block_delta text chunks
        let accumulated = '';
        const lines = sseText.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                // Capture first token time
                if (firstTokenTime === null) {
                  firstTokenTime = Date.now();
                }
                tokenCount++;
                accumulated += parsed.delta.text;
                onChunk(parsed.delta.text); // Send only the clean text
              }
            } catch {
              console.warn('[DashAIClient] Failed to parse SSE line:', line.substring(0, 100));
            }
          }
        }
        
        if (__DEV__) {
          console.log('[DashAIClient] SSE fallback parsed, accumulated length:', accumulated.length);
        }
        
        // Emit performance metrics (production only)
        // Reference: https://posthog.com/docs/libraries/react-native
        if (!__DEV__ && firstTokenTime !== null) {
          const totalDuration = Date.now() - startTime;
          const firstTokenLatency = firstTokenTime - startTime;
          
          // PostHog event tracking
          try {
            // Note: PostHog instance should be imported and initialized
            // For now, we log the metrics. Integration with PostHog will be done separately.
            console.log('[DashAIClient] Performance metrics:', {
              first_token_ms: firstTokenLatency,
              total_duration_ms: totalDuration,
              token_count: tokenCount,
              platform: 'react-native',
            });
          } catch (error) {
            console.error('[DashAIClient] Failed to emit metrics:', error);
          }
        }
        
        return {
          content: accumulated || 'No content extracted from SSE stream',
          metadata: {},
        };
      }
      
      // Parse SSE stream (web environment)
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                // Capture first token time
                if (firstTokenTime === null) {
                  firstTokenTime = Date.now();
                }
                tokenCount++;
                accumulated += parsed.delta.text;
                onChunk(parsed.delta.text);
              }
            } catch (e) {
              console.warn('[DashAIClient] Failed to parse SSE chunk:', e);
            }
          }
        }
      }
      
      // Emit performance metrics (production only)
      if (!__DEV__ && firstTokenTime !== null) {
        const totalDuration = Date.now() - startTime;
        const firstTokenLatency = firstTokenTime - startTime;
        
        try {
          console.log('[DashAIClient] Performance metrics:', {
            first_token_ms: firstTokenLatency,
            total_duration_ms: totalDuration,
            token_count: tokenCount,
            platform: 'web',
          });
        } catch (error) {
          console.error('[DashAIClient] Failed to emit metrics:', error);
        }
      }

      return {
        content: accumulated,
        metadata: {},
      };
    } catch (error) {
      console.error('[DashAIClient] Streaming failed:', error);
      throw error;
    }
  }

  /**
   * Call AI service with WebSocket streaming (React Native)
   * 
   * Feature flag controlled: EXPO_PUBLIC_USE_WEBSOCKET_STREAMING=true
   * 
   * References:
   * - React Native WebSocket (0.79): https://reactnative.dev/docs/0.79/network#websocket-support
   * - Supabase auth getSession: https://supabase.com/docs/reference/javascript/auth-getsession
   */
  private async callAIServiceStreamingWS(params: any, onChunk: (chunk: string) => void): Promise<AIServiceResponse> {
    // Performance instrumentation
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let tokenCount = 0;

    // Get auth token before creating Promise
    const { data: sessionData } = await this.supabaseClient.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    
    if (!accessToken) {
      throw new Error('No auth session for WebSocket streaming');
    }
    
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');
    }

    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL
        const wsUrl = `${supabaseUrl.replace('https', 'wss')}/functions/v1/ai-proxy-ws`;
        
        // Create WebSocket connection
        // Reference: https://reactnative.dev/docs/0.79/network#websocket-support
        const ws = new WebSocket(wsUrl);
        let accumulated = '';
        let hasError = false;
        
        ws.onopen = () => {
          // Send request payload
          const payload = {
            scope: (['teacher','principal','parent'].includes((this.getUserProfile()?.role || 'teacher').toString().toLowerCase())
              ? (this.getUserProfile()?.role || 'teacher').toString().toLowerCase()
              : 'teacher'),
            service_type: 'dash_conversation',
            payload: {
              prompt: params.promptText,
              context: params.context || undefined,
            },
            enable_tools: true,
            metadata: {
              role: (['teacher','principal','parent'].includes((this.getUserProfile()?.role || 'teacher').toString().toLowerCase())
                ? (this.getUserProfile()?.role || 'teacher').toString().toLowerCase()
                : 'teacher')
            }
          };
          
          ws.send(JSON.stringify(payload));
        };
        
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            
            if (msg.type === 'start') {
              // Stream started
              if (__DEV__) {
                console.log('[DashAIClient] WebSocket stream started');
              }
            } else if (msg.type === 'delta' && msg.text) {
              // Capture first token time
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
              }
              tokenCount++;
              accumulated += msg.text;
              onChunk(msg.text);
            } else if (msg.type === 'done') {
              // Stream completed
              ws.close();
              
              // Emit performance metrics (production only)
              if (!__DEV__ && firstTokenTime !== null) {
                const totalDuration = Date.now() - startTime;
                const firstTokenLatency = firstTokenTime - startTime;
                
                try {
                  console.log('[DashAIClient] Performance metrics (WS):', {
                    first_token_ms: firstTokenLatency,
                    total_duration_ms: totalDuration,
                    token_count: tokenCount,
                    platform: 'react-native-ws',
                  });
                } catch (error) {
                  console.error('[DashAIClient] Failed to emit metrics:', error);
                }
              }
              
              resolve({
                content: accumulated || 'No content received from WebSocket stream',
                metadata: {},
              });
            } else if (msg.type === 'error') {
              hasError = true;
              reject(new Error(msg.message || 'WebSocket streaming error'));
            } else if (msg.type === 'cancelled') {
              hasError = true;
              reject(new Error('Stream cancelled'));
            }
          } catch (e) {
            console.error('[DashAIClient] Failed to parse WebSocket message:', e);
          }
        };
        
        ws.onerror = (error) => {
          if (!hasError) {
            hasError = true;
            console.error('[DashAIClient] WebSocket error:', error);
            reject(new Error('WebSocket connection error'));
          }
        };
        
        ws.onclose = (event) => {
          if (__DEV__) {
            console.log('[DashAIClient] WebSocket closed:', event.code, event.reason);
          }
          if (!hasError && accumulated.length === 0) {
            reject(new Error('WebSocket closed without receiving data'));
          }
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default DashAIClient;
