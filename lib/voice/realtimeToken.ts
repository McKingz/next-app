import { assertSupabase } from '@/lib/supabase';

export interface RealtimeTokenResponse {
  token: string;
  url: string;
  expiresIn?: number;
}

/**
 * Fetch Azure Speech authorization token and region from Edge Function
 */
export async function getAzureSpeechToken(): Promise<AzureSpeechTokenResponse | null> {
  try {
    const supabase = assertSupabase();
    const { data, error } = await (supabase as any).functions.invoke('azure-speech-token');
    if (error) {
      console.warn('[AzureSpeechToken] Failed to fetch token:', error);
      console.warn('[AzureSpeechToken] Hint: Check if azure-speech-token function is deployed and AZURE_SPEECH_KEY/AZURE_SPEECH_REGION secrets are set');
      return null;
    }
    if (data?.error) {
      console.warn('[AzureSpeechToken] Edge Function returned error:', data.error, data.details || '');
      console.warn('[AzureSpeechToken] Hint: Check if AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are configured in Supabase secrets');
      return null;
    }
    if (!data?.token || !data?.region) {
      console.warn('[AzureSpeechToken] Missing token/region in response:', data);
      return null;
    }
    return { token: data.token, region: data.region, expiresIn: data.expiresIn };
  } catch (e) {
    console.warn('[AzureSpeechToken] invoke error:', e);
    return null;
  }
}

export interface AzureSpeechTokenResponse {
  token: string;
  region: string;
  expiresIn?: number;
}

/**
 * Fetch an ephemeral realtime provider token and WS URL from Edge Function.
 * Never exposes provider secrets client-side.
 */
export async function getRealtimeToken(): Promise<RealtimeTokenResponse | null> {
  try {
    const supabase = assertSupabase();
    const { data, error } = await (supabase as any).functions.invoke('openai-realtime-token');
    if (error) {
      console.warn('[RealtimeToken] Failed to fetch token:', error);
      return null;
    }
    if (!data?.token || !data?.url) {
      console.warn('[RealtimeToken] Missing token/url in response');
      return null;
    }
    return { token: data.token, url: data.url, expiresIn: data.expiresIn };
  } catch (e) {
    console.warn('[RealtimeToken] invoke error:', e);
    return null;
  }
}