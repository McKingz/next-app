// AIService adapter via Supabase Edge Function ai-proxy
import type { AIService } from '../types';
import { assertSupabase } from '@/lib/supabase';

export class AIProxyAdapter implements AIService {
  async ask(prompt: string, context?: Record<string, unknown>): Promise<string> {
    const client = assertSupabase();
    const { data, error } = await client.functions.invoke('ai-proxy', {
      body: {
        scope: 'teacher',
        service_type: 'dash_conversation', // Use valid service_type per DB constraint
        payload: { prompt, context },
      },
    });
    if (error) throw new Error(error.message || 'AI proxy error');
    // Support both {content} and full response shapes
    const content = (data?.content ?? data?.message ?? '').toString();
    return content;
  }
}
