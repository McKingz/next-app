import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION') || 'southafricanorth';
const GOOGLE_CLOUD_TTS_API_KEY = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Types
interface TTSRequest {
  text: string;
  lang?: 'af' | 'zu' | 'xh' | 'st' | 'nso' | 'en';
  language?: 'af' | 'zu' | 'xh' | 'st' | 'nso' | 'en'; // Accept both param names
  voiceId?: string;
  voice_id?: string; // Accept both param names
  style?: 'friendly' | 'empathetic' | 'professional' | 'cheerful';
  rate?: number; // -50 to +50
  pitch?: number; // -50 to +50
  speaking_rate?: number; // Accept as alias for rate
  format?: 'mp3' | 'ogg' | 'wav';
}

// interface TTSResponse {
//   audioUrl: string;
//   provider: 'azure' | 'google' | 'device';
//   language: string;
//   cacheHit: boolean;
//   fallback?: 'device';
// }

// Language mapping
const LANG_MAP: Record<string, string> = {
  af: 'af-ZA',
  zu: 'zu-ZA',
  xh: 'xh-ZA',
  st: 'nso-ZA',
  nso: 'nso-ZA',
  en: 'en-ZA',
};

// Default Azure voices (verified Neural voices only)
// CRITICAL: Only use voices that actually exist in Azure catalog
const AZURE_VOICES: Record<string, string> = {
  // Native SA English - Verified ✅
  'en-ZA': 'en-ZA-LeahNeural',         // Female, South African English
  'en-ZA-male': 'en-ZA-LukeNeural',    // Male, South African English
  
  // Afrikaans - Verified ✅
  'af-ZA': 'af-ZA-AdriNeural',         // Female, warm, natural Afrikaans
  'af-ZA-male': 'af-ZA-WillemNeural',  // Male, warm Afrikaans
  
  // isiZulu - Verified ✅
  'zu-ZA': 'zu-ZA-ThandoNeural',       // Female, native isiZulu speaker
  'zu-ZA-male': 'zu-ZA-ThembaNeural',  // Male, native isiZulu speaker
  
  // isiXhosa - NOT AVAILABLE IN AZURE ❌
  // Fallback: Use multilingual South African English (understands Xhosa context)
  'xh-ZA': 'en-ZA-LeahNeural',         // FALLBACK - Best pronunciation approximation
  'xh-ZA-male': 'en-ZA-LukeNeural',    // FALLBACK - Male variant
  
  // Sepedi/Northern Sotho - NOT AVAILABLE IN AZURE ❌
  // Fallback: Use South African English
  'nso-ZA': 'en-ZA-LeahNeural',        // FALLBACK - Device TTS recommended
  'nso-ZA-male': 'en-ZA-LukeNeural',   // FALLBACK - Male variant
  
  // US English (for comparison/testing)
  'en-US': 'en-US-JennyNeural',        // Female, friendly US English
  'en-US-male': 'en-US-GuyNeural',     // Male, friendly US English
};

/**
 * Generate cache key for TTS request
 */
async function generateCacheKey(
  text: string,
  lang: string,
  voiceId: string,
  style: string,
  rate: number,
  pitch: number,
  provider: string
): Promise<string> {
  const data = `${text}|${lang}|${voiceId}|${style}|${rate}|${pitch}|${provider}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check TTS cache
 */
async function checkCache(hash: string): Promise<{ url: string; provider: string } | null> {
  try {
    const { data, error } = await supabase
      .from('tts_audio_cache')
      .select('storage_path, provider')
      .eq('hash', hash)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle cache misses gracefully

    if (error || !data) return null;

    // Update hit count and last used (fire and forget - don't block on cache update)
    supabase
      .from('tts_audio_cache')
      .select('hit_count')
      .eq('hash', hash)
      .maybeSingle()
      .then(({ data: cacheData }) => {
        if (cacheData) {
          return supabase
            .from('tts_audio_cache')
            .update({
              hit_count: (cacheData.hit_count || 0) + 1,
              last_used_at: new Date().toISOString(),
            })
            .eq('hash', hash);
        }
      })
      .catch(err => console.warn('[Cache] Failed to update hit count:', err));

    // Get signed URL
    const { data: urlData } = await supabase.storage
      .from('tts-cache')
      .createSignedUrl(data.storage_path, 3600); // 1 hour

    if (!urlData?.signedUrl) return null;

    return { url: urlData.signedUrl, provider: data.provider };
  } catch (error) {
    console.error('Cache check error:', error);
    return null;
  }
}

/**
 * Store audio in cache
 */
async function storeCache(
  hash: string,
  audioBlob: Blob,
  metadata: {
    text: string;
    lang: string;
    voiceId: string;
    provider: string;
    preschoolId: string;
    userId: string;
  }
): Promise<string> {
  const storagePath = `${metadata.preschoolId}/${hash}.mp3`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('tts-cache')
    .upload(storagePath, audioBlob, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(`Failed to upload audio: ${uploadError.message}`);
  }

  // Store metadata
  await supabase.from('tts_audio_cache').insert({
    hash,
    preschool_id: metadata.preschoolId,
    text: metadata.text.substring(0, 1000), // Truncate long text
    language_code: metadata.lang,
    voice_id: metadata.voiceId,
    provider: metadata.provider,
    storage_path: storagePath,
    size_bytes: audioBlob.size,
    created_by: metadata.userId,
  });

  // Get signed URL
  const { data: urlData } = await supabase.storage
    .from('tts-cache')
    .createSignedUrl(storagePath, 3600);

  return urlData?.signedUrl || '';
}

/**
 * Log usage for cost tracking
 */
async function logUsage(
  preschoolId: string,
  userId: string,
  lang: string,
  provider: string,
  charCount: number,
  latencyMs: number,
  success: boolean
) {
  try {
    // Cost estimates (per 1M characters)
    const costPer1M: Record<string, number> = {
      azure: 16.0,
      google: 16.0,
      device: 0,
    };

    const costEstimate = (charCount / 1_000_000) * (costPer1M[provider] || 0);

    await supabase.from('voice_usage_logs').insert({
      preschool_id: preschoolId,
      user_id: userId,
      service: 'tts',
      provider,
      language_code: lang,
      units: charCount,
      cost_estimate_usd: costEstimate,
      latency_ms: latencyMs,
      success,
    });
  } catch (error) {
    console.error('Usage logging error:', error);
  }
}

/**
 * Synthesize with Azure TTS
 */
async function synthesizeAzure(
  text: string,
  lang: string,
  voiceId?: string,
  style?: string,
  rate?: number,
  pitch?: number
): Promise<Blob> {
  if (!AZURE_SPEECH_KEY) {
    throw new Error('Azure Speech key not configured');
  }

  const voice = voiceId || AZURE_VOICES[lang] || AZURE_VOICES['en-US'];
  
  // Build SSML with style and prosody
  const ssml = `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
           xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${lang}">
      <voice name="${voice}">
        ${style ? `<mstts:express-as style="${style}">` : ''}
          <prosody rate="${rate || 0}%" pitch="${pitch || 0}%" volume="+10%">
            ${text}
          </prosody>
        ${style ? '</mstts:express-as>' : ''}
      </voice>
    </speak>
  `.trim();

  console.log(`[Azure TTS] Synthesizing: ${lang}, voice: ${voice}, style: ${style || 'none'}`);

  const response = await fetch(
    `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssml,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Azure TTS] Error: ${response.status} ${errorText}`);
    throw new Error(`Azure TTS failed: ${response.status}`);
  }

  return await response.blob();
}

/**
 * Synthesize with Google Cloud TTS (fallback for Xhosa)
 */
async function synthesizeGoogle(
  text: string,
  lang: string
): Promise<Blob> {
  if (!GOOGLE_CLOUD_TTS_API_KEY) {
    throw new Error('Google Cloud TTS API key not configured');
  }

  console.log(`[Google TTS] Synthesizing: ${lang}`);

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_CLOUD_TTS_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: lang,
          ssmlGender: 'MALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.9,
          pitch: -2.0,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Google TTS] Error: ${response.status} ${errorText}`);
    throw new Error(`Google TTS failed: ${response.status}`);
  }

  const result = await response.json();
  const audioContent = result.audioContent;

  // Decode base64 to blob
  const binaryString = atob(audioContent);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: 'audio/mpeg' });
}

/**
 * Main handler
 */
serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  const startTime = Date.now();

  try {
    // Validate JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user metadata
    const preschoolId = user.user_metadata?.preschool_id || 'unknown';
    const userId = user.id;

    // Parse request (handle both param names for compatibility)
    const request: TTSRequest = await req.json();
    const { text, lang, language, voiceId, voice_id, style, rate, pitch, speaking_rate } = request;

    // Use language param name OR lang param name
    const effectiveLang = language || lang;
    
    if (!text || !effectiveLang) {
      return new Response(JSON.stringify({ error: 'Missing required fields: text, language/lang' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const providerLang = LANG_MAP[effectiveLang] || 'en-US';
    const effectiveVoiceId = voice_id || voiceId || AZURE_VOICES[providerLang] || '';
    // Remove default style - let Azure use natural voice tone
    const effectiveStyle = style || undefined;
    // Slight speed increase for more responsive feel, neutral pitch
    const effectiveRate = speaking_rate ?? rate ?? 5;
    const effectivePitch = pitch ?? 0;
    
    // Log TTS request for debugging
    console.log(`[TTS Request] lang: ${effectiveLang} → ${providerLang}, voice: ${effectiveVoiceId}, style: ${effectiveStyle}, rate: ${effectiveRate}, pitch: ${effectivePitch}`);
    console.log(`[TTS Text] "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

    // Check cache
    const cacheKey = await generateCacheKey(
      text,
      providerLang,
      effectiveVoiceId,
      effectiveStyle,
      effectiveRate,
      effectivePitch,
      'azure'
    );

    const cached = await checkCache(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] ${cacheKey.substring(0, 8)}`);
      return new Response(
        JSON.stringify({
          audio_url: cached.url,
          provider: cached.provider,
          language: providerLang,
          cache_hit: true,
          content_hash: cacheKey,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log(`[Cache MISS] ${cacheKey.substring(0, 8)} - Synthesizing...`);

    let audioBlob: Blob;
    let provider: 'azure' | 'google' | 'device' = 'azure';

// Try Azure first for supported locales
    if (['af-ZA', 'zu-ZA', 'xh-ZA', 'en-ZA', 'en-US'].includes(providerLang) && AZURE_SPEECH_KEY) {
      try {
        audioBlob = await synthesizeAzure(text, providerLang, effectiveVoiceId, effectiveStyle, effectiveRate, effectivePitch);
        provider = 'azure';
      } catch (azureError) {
        console.error('[Azure TTS] Failed:', azureError);
        
        // Try Google fallback
        if (GOOGLE_CLOUD_TTS_API_KEY) {
          console.log('[Fallback] Trying Google TTS...');
          audioBlob = await synthesizeGoogle(text, providerLang);
          provider = 'google';
        } else {
          throw azureError;
        }
      }
    }
    // Use Google for xh-ZA (Xhosa)
    else if (providerLang === 'xh-ZA' && GOOGLE_CLOUD_TTS_API_KEY) {
      audioBlob = await synthesizeGoogle(text, providerLang);
      provider = 'google';
    }
    // Fallback to device TTS for unsupported languages
    else {
      console.log(`[Fallback] Language ${providerLang} not supported - instructing client to use device TTS`);
      
      await logUsage(preschoolId, userId, lang, 'device', text.length, Date.now() - startTime, true);
      
      return new Response(
        JSON.stringify({
          fallback: 'device',
          language: providerLang,
          provider: 'device',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Store in cache
    const audioUrl = await storeCache(cacheKey, audioBlob, {
      text,
      lang: providerLang,
      voiceId: effectiveVoiceId,
      provider,
      preschoolId,
      userId,
    });

    const latencyMs = Date.now() - startTime;

    // Log usage
    await logUsage(preschoolId, userId, lang, provider, text.length, latencyMs, true);

    console.log(`[Success] ${provider} TTS completed in ${latencyMs}ms`);

    return new Response(
      JSON.stringify({
        audio_url: audioUrl,
        provider,
        language: providerLang,
        cache_hit: false,
        content_hash: cacheKey,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('[Error]', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to synthesize speech',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
