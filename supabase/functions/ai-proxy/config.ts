/**
 * Configuration and Constants
 * 
 * Centralized environment variables and constants.
 */

export const config = {
  anthropic: {
    apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    apiUrl: 'https://api.anthropic.com/v1/messages',
  },
  openai: {
    apiKey: Deno.env.get('OPENAI_API_KEY'),
    apiUrl: 'https://api.openai.com/v1/chat/completions',
  },
  supabase: {
    url: Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  },
  cors: {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  },
  quotas: {
    default: {
      lesson_generation: 5,
      grading_assistance: 5,
      homework_help: 15,
      progress_analysis: 10,
      insights: 10,
      transcription: 20,
    },
    tier_limits: {
      free: {
        lesson_generation: 5,
        grading_assistance: 5,
        homework_help: 15,
      },
      basic: {
        lesson_generation: 20,
        grading_assistance: 20,
        homework_help: 50,
      },
      pro: {
        lesson_generation: 100,
        grading_assistance: 100,
        homework_help: 200,
      },
      enterprise: {
        lesson_generation: -1, // unlimited
        grading_assistance: -1,
        homework_help: -1,
      },
    },
  },
  models: {
    default: 'claude-3-5-sonnet-20241022',
    fallback: 'claude-3-5-sonnet-20240620',
    haiku: 'claude-3-5-haiku-20241022',
  },
  limits: {
    maxTokens: 8192,
    temperature: 1,
    topP: 1,
  },
} as const

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.anthropic.apiKey) {
    errors.push('Missing ANTHROPIC_API_KEY environment variable')
  }
  if (!config.supabase.url) {
    errors.push('Missing SUPABASE_URL environment variable')
  }
  if (!config.supabase.serviceRoleKey) {
    errors.push('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
