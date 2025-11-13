import { assertSupabase } from '@/lib/supabase'

export type DashContextTraits = Record<string, unknown>

export async function syncDashContext(params: { language?: string; traits?: DashContextTraits; sessionId?: string }) {
  try {
    const supabase = assertSupabase()
    const body = {
      detected_language: params.language || null,
      traits: params.traits || {},
      session_id: params.sessionId || undefined,
    }
    const { data, error } = await supabase.functions.invoke('dash-context-sync', { body })
    if (error) throw error
    return data
  } catch (e) {
    // Non-fatal: context sync best-effort
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[dashContextSync] failed:', e)
    return null
  }
}
