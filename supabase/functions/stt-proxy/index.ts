import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Env
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY'); // Primary STT provider (best SA language support)
const AZURE_SPEECH_KEY = Deno.env.get('AZURE_SPEECH_KEY');
const AZURE_SPEECH_REGION = Deno.env.get('AZURE_SPEECH_REGION') || 'southafricanorth';
const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface STTRequest {
  storage_path?: string;      // Supabase storage path (preferred)
  audio_url?: string;         // External URL (optional)
  audio_base64?: string;      // Direct base64 payload (fallback)
  language?: string;          // BCP-47 (e.g., en-ZA)
  format?: string;            // 'm4a' | 'wav' | 'mp3'
  candidate_languages?: string[]; // e.g., ["af-ZA","zu-ZA","xh-ZA","nso-ZA","en-ZA","en-US"]
}

interface STTResponse {
  text: string;
  language: string;   // BCP-47, e.g. "zu-ZA"
  confidence?: number;
  provider: 'openai-whisper' | 'azure' | 'deepgram';
}

function mapToAzureLocale(code: string | undefined): string {
  const b = String(code || '').toLowerCase();
  if (b.startsWith('af')) return 'af-ZA';
  if (b.startsWith('zu')) return 'zu-ZA';
  if (b.startsWith('xh')) return 'xh-ZA';
  if (b.startsWith('nso') || b.startsWith('st')) return 'en-ZA'; // fallback; Azure Sepedi limited in REST
  if (b.startsWith('en-us')) return 'en-US';
  if (b.startsWith('en')) return 'en-ZA';
  return 'en-ZA';
}

async function signedUrlFor(storagePath: string): Promise<string> {
  // Infer bucket by prefix or default 'voice-notes'
  let bucket = 'voice-notes';
  if (storagePath.includes('homework-submissions')) bucket = 'homework-submissions';
  if (storagePath.includes('message-media')) bucket = 'message-media';
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) throw new Error(`Signed URL error for ${storagePath}: ${error?.message}`);
  return data.signedUrl;
}

async function detectWithDeepgram(url: string): Promise<{ language?: string; }> {
  if (!DEEPGRAM_API_KEY) return {};
  const res = await fetch('https://api.deepgram.com/v1/listen', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, options: { model: 'nova-2', smart_format: true, detect_language: true } }),
  });
  if (!res.ok) return {};
  const json = await res.json().catch(() => ({}));
  const detected = json?.results?.channels?.[0]?.detected_language as string | undefined;
  return { language: detected };
}

async function whisperTranscribe(url: string, locale: string): Promise<STTResponse> {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
  
  // Fetch audio file
  const audio = await fetch(url);
  if (!audio.ok) throw new Error(`Audio fetch failed: ${audio.status}`);
  const audioBlob = await audio.blob();
  
  return await whisperTranscribeDirect(audioBlob, locale);
}

async function whisperTranscribeDirect(audioBlob: Blob, locale: string): Promise<STTResponse> {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
  
  // Map BCP-47 locale to Whisper 2-letter language codes
  const whisperLangMap: Record<string, string> = {
    'en-ZA': 'en', 'en-US': 'en', 'en': 'en',
    'af-ZA': 'af', 'af': 'af',
    'zu-ZA': 'zu', 'zu': 'zu',
    'xh-ZA': 'xh', 'xh': 'xh',
    'nso-ZA': 'st', 'st': 'st', // Whisper uses 'st' for Sotho languages
  };
  const whisperLang = whisperLangMap[locale] || 'en';
  
  // Create form data for OpenAI Whisper API
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.m4a');
  formData.append('model', 'whisper-1');
  formData.append('language', whisperLang);
  
  console.log(`[STT] Transcribing with OpenAI Whisper: lang=${whisperLang}, size=${audioBlob.size} bytes`);
  
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });
  
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Whisper STT error: ${res.status} ${t}`);
  }
  
  const j = await res.json();
  const text = j?.text || '';
  
  console.log(`[STT] Whisper transcribed: "${text.substring(0, 100)}..."`);
  
  return { text, language: locale, provider: 'openai-whisper' };
}

async function azureTranscribe(url: string, locale: string): Promise<STTResponse> {
  if (!AZURE_SPEECH_KEY) throw new Error('Azure Speech not configured');
  const audio = await fetch(url);
  if (!audio.ok) throw new Error(`Audio fetch failed: ${audio.status}`);
  const buf = await audio.arrayBuffer();
  const res = await fetch(`https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
      'Content-Type': 'audio/wav', // Accepts multiple formats; wav works broadly
    },
    body: buf,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Azure STT error: ${res.status} ${t}`);
  }
  const j = await res.json().catch(() => ({}));
  const text = j?.DisplayText || '';
  const conf = j?.NBest?.[0]?.Confidence as number | undefined;
  return { text, language: locale, confidence: conf, provider: 'azure' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }
  try {
    const auth = req.headers.get('authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    const { data: { user }, error: authError } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    
    // Get preschool_id from JWT or user metadata
    const preschoolId = user.user_metadata?.preschool_id || user.app_metadata?.preschool_id;
    if (!preschoolId) {
      return new Response(JSON.stringify({ error: 'No preschool_id found' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Handle both JSON (storage_path/audio_url) and FormData (direct file upload)
    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    console.log('[STT] Content-Type:', contentType);
    let body: STTRequest = {};
    let audioFile: Blob | null = null;
    let language = 'en-ZA';
    
    // Try FormData first (React Native default)
    try {
      const formData = await req.formData();
      const maybeFile = formData.get('audio');
      language = (formData.get('language') as string) || 'en-ZA';
      
      if (maybeFile && typeof maybeFile !== 'string') {
        audioFile = maybeFile as Blob;
        console.log(`[STT] FormData: Received audio file ${audioFile.size} bytes, language: ${language}`);
      }
    } catch (formError) {
      // FormData parsing failed, try JSON
      console.log('[STT] FormData parse failed, trying JSON:', (formError as Error).message);
      try {
        const text = await req.text();
        body = JSON.parse(text);
        console.log('[STT] JSON parsed successfully');
        
        // Handle base64 audio
        if (body.audio_base64) {
          const binStr = atob(body.audio_base64);
          const bytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
          const mime = body.format === 'wav' ? 'audio/wav' : body.format === 'mp3' ? 'audio/mpeg' : 'audio/m4a';
          audioFile = new Blob([bytes.buffer], { type: mime });
          language = body.language || 'en-ZA';
          console.log(`[STT] JSON: Decoded base64 audio ${bytes.length} bytes`);
        } else if (!body.storage_path && !body.audio_url) {
          return new Response(JSON.stringify({ error: 'storage_path, audio_url or audio_base64 required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      } catch (jsonError) {
        console.error('[STT] Both FormData and JSON parsing failed');
        return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }
    
    if (!audioFile && !body.storage_path && !body.audio_url) {
      return new Response(JSON.stringify({ error: 'No audio source provided' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Estimate audio duration (assume ~30 seconds average, will refine after transcription)
    const estimatedDurationMinutes = 0.5; // 30 seconds default
    
    // Check usage limits BEFORE processing
    const { data: limitCheck, error: limitError } = await supabase.rpc('check_voice_usage_limit', {
      p_user_id: user.id,
      p_preschool_id: preschoolId,
      p_service: 'stt',
      p_estimated_units: estimatedDurationMinutes
    });
    
    if (limitError) {
      console.error('[STT] Usage limit check failed:', limitError);
      // Allow request to proceed if check fails (fail-open for better UX)
    } else if (limitCheck && !limitCheck.allowed) {
      console.warn('[STT] Usage limit exceeded:', limitCheck.reason);
      return new Response(
        JSON.stringify({ 
          error: 'Usage limit exceeded', 
          details: limitCheck.reason,
          tier: limitCheck.tier,
          quota_remaining: limitCheck.quota_remaining,
          fallback_available: true // Client should fallback to device STT
        }), 
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-Quota-Tier': limitCheck.tier || 'free'
          } 
        }
      );
    }
    
    const startTime = Date.now();
    let audioUrl: string | null = null;
    let azureLocale = mapToAzureLocale(language);
    
    // Get audio URL (either from storage or direct upload)
    if (audioFile) {
      // Direct file upload - create temporary blob URL
      // For Whisper, we'll pass the blob directly
      console.log(`[STT] Using direct file upload, language: ${azureLocale}`);
    } else {
      // Storage path or external URL
      audioUrl = body.audio_url || await signedUrlFor(body.storage_path!);
      
      // Step 1: Detect language quickly (Deepgram). If unavailable, default to en-ZA.
      const detectionResult = await detectWithDeepgram(audioUrl);
      let detected = detectionResult.language || 'en-US';
      console.log(`[STT] Deepgram detected language: ${detected}, candidates: ${JSON.stringify(body.candidate_languages || [])}`);
      
      // If candidates provided, prefer the closest candidate; else map to Azure locale
      if (Array.isArray(body.candidate_languages) && body.candidate_languages.length) {
        const lower = detected.toLowerCase();
        const match = body.candidate_languages.find(c => lower.startsWith(c.toLowerCase().slice(0, 2)) || lower === c.toLowerCase());
        const beforeMatch = detected;
        detected = match || detected;
        console.log(`[STT] Language match: ${beforeMatch} → ${detected}`);
      }
      azureLocale = mapToAzureLocale(detected);
      console.log(`[STT] Final Azure locale: ${azureLocale}`);
    }

    // Step 2: Transcribe with OpenAI Whisper (primary - best SA language support)
    if (OPENAI_API_KEY) {
      try {
        const out = audioFile 
          ? await whisperTranscribeDirect(audioFile, azureLocale)
          : await whisperTranscribe(audioUrl!, azureLocale);
        const latencyMs = Date.now() - startTime;
        
        // Calculate actual duration (estimate from text length or use actual duration if available)
        const actualDurationMinutes = out.duration ? out.duration / 60 : estimatedDurationMinutes;
        const costUsd = actualDurationMinutes * 0.006; // $0.006 per minute for Whisper
        
        // Record usage asynchronously (don't block response)
        supabase.rpc('record_voice_usage', {
          p_user_id: user.id,
          p_preschool_id: preschoolId,
          p_service: 'stt',
          p_units: actualDurationMinutes,
          p_cost_usd: costUsd,
          p_provider: 'openai-whisper',
          p_language: azureLocale
        }).then(() => {
          if (__DEV__) console.log('[STT] Usage recorded successfully');
        }).catch(err => {
          console.error('[STT] Failed to record usage:', err);
        });
        
        // Return transcription with quota info in headers
        return new Response(JSON.stringify(out), { 
          headers: { 
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Origin': '*',
            'X-Latency-Ms': String(latencyMs),
            'X-Cost-Usd': String(costUsd.toFixed(6)),
            'X-Quota-Tier': limitCheck?.tier || 'unknown'
          } 
        });
      } catch (e) {
        console.warn(`[STT] OpenAI Whisper failed, trying Azure fallback: ${e}`);
        // fallback to Azure or Deepgram
      }
    }
    
    // Step 3: Fallback to Azure if Whisper unavailable
    if (AZURE_SPEECH_KEY) {
      try {
        const out = await azureTranscribe(audioUrl, azureLocale);
        return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      } catch (e) {
        console.warn(`[STT] Azure failed, trying Deepgram fallback: ${e}`);
        // fallback to Deepgram's raw transcript if available
      }
    }

    // Final fallback: return Deepgram transcript (re-run for text if needed)
    if (!DEEPGRAM_API_KEY) throw new Error('No STT provider configured');
    const dg = await fetch('https://api.deepgram.com/v1/listen', {
      method: 'POST',
      headers: { 'Authorization': `Token ${DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: audioUrl, options: { model: 'nova-2', smart_format: true, detect_language: true } }),
    });
    if (!dg.ok) throw new Error(`Deepgram STT error: ${dg.status}`);
    const j = await dg.json();
    const text = j?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const lang = j?.results?.channels?.[0]?.detected_language || azureLocale;
    const conf = j?.results?.channels?.[0]?.alternatives?.[0]?.confidence as number | undefined;
    return new Response(JSON.stringify({ text, language: mapToAzureLocale(lang), confidence: conf, provider: 'deepgram' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to transcribe', details: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
