import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { withTimeout, wait } from '@/lib/utils/async';
import { SubscriptionContext } from '@/contexts/SubscriptionContext';

// Realtime voice streaming hook (client-side scaffolding)
// - Streams audio chunks to a websocket endpoint if enabled
// - Emits partial transcript, final transcript, and assistant token events coming back from server
// - If not enabled or no backend, it safely no-ops and falls back to existing flow
//
// Usage:
// const realtime = useRealtimeVoice({ enabled, url, tokenProvider, onPartialTranscript, onFinalTranscript, onAssistantToken, onStatusChange })
// realtime.startStream()
// realtime.stopStream()
// realtime.cancel()
//
// Expected backend websocket messages (example):
// { type: 'partial_transcript', text: string }
// { type: 'final_transcript', text: string }
// { type: 'assistant_token', text: string }
// { type: 'done' }
//
// Audio: On web, we use MediaRecorder with 250ms timeslices and send ArrayBuffer chunks.
// Native support requires additional work; this hook will no-op on native platforms unless implemented.

export type RealtimeStatus = 'disconnected' | 'connecting' | 'streaming' | 'stopping' | 'finished' | 'error';

interface UseRealtimeVoiceOptions {
  enabled?: boolean;
  url?: string; // wss:// endpoint for streaming (OpenAI only)
  provider?: 'openai' | 'azure'; // default auto based on language
  tokenProvider?: () => Promise<string | null>; // return auth token or null
  timesliceMs?: number; // MediaRecorder timeslice
  language?: string; // 'en' | 'af' | 'zu' | 'xh' | 'nso'
  transcriptionModel?: string; // Must be 'whisper-1' for OpenAI Realtime API
  vadSilenceMs?: number; // default 700
  onPartialTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onAssistantToken?: (tok: string) => void;
  onStatusChange?: (status: RealtimeStatus) => void;
}

export function useRealtimeVoice(opts: UseRealtimeVoiceOptions = {}) {
  const {
    enabled = false,
    url = (process.env.EXPO_PUBLIC_DASH_STREAM_URL as string) || '',
    provider,
    tokenProvider,
    timesliceMs = 250,
    language,
    transcriptionModel = 'whisper-1',
    vadSilenceMs = 700,
    onPartialTranscript,
    onFinalTranscript,
    onAssistantToken,
    onStatusChange,
  } = opts;

  // Get subscription tier for OpenAI fallback gating
  const { tier: subscriptionTier } = useContext(SubscriptionContext);

  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const [muted, setMutedState] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const webrtcRef = useRef<{ stop: () => Promise<void>; isActive: () => boolean; updateTranscriptionConfig: (cfg: { language?: string; vadSilenceMs?: number; transcriptionModel?: string }) => void; setMuted: (m: boolean) => void } | null>(null);
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const isStoppingRef = useRef(false);
  const statusRef = useRef<RealtimeStatus>('disconnected');

  const setStatusSafe = useCallback((s: RealtimeStatus) => {
    statusRef.current = s; // Keep ref in sync
    setStatus(s);
    try { onStatusChange?.(s); } catch { /* Intentional: non-fatal */ }
  }, [onStatusChange]);

  const startStream = useCallback(async () => {
    if (!enabled) return false;
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    try {
      setStatusSafe('connecting');

      // Capability preflight gating before any provider attempts
      try {
        const { getVoiceCapabilities } = await import('@/lib/voice/capabilities');
        const caps = await getVoiceCapabilities({ language, tier: subscriptionTier });
        if (!caps.streamingAvailable) {
          console.log('[RealtimeVoice] ⚠️ Streaming not available:', caps.streamingReasons);
          setStatusSafe('error');
          return false;
        }
      } catch (e) {
        console.warn('[RealtimeVoice] Capability preflight failed (continuing cautiously):', e);
      }

      // Resolve URL + token
      let wsUrl = url;
      let token = ''; let region = '';

      // Android mic permission preflight
      try {
        const { Platform, PermissionsAndroid } = await import('react-native');
        if (Platform.OS === 'android') {
          const perm = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO as any;
          console.log('[RealtimeVoice] 🔍 Checking Android mic permission...');
          const already = await PermissionsAndroid.check(perm);
          console.log('[RealtimeVoice] ✅ Permission already granted:', already);
          if (!already) {
            console.log('[RealtimeVoice] 🔒 Requesting mic permission...');
            const res = await PermissionsAndroid.request(perm);
            console.log('[RealtimeVoice] 📋 Permission result:', res, 'GRANTED?', res === PermissionsAndroid.RESULTS.GRANTED);
            if (res !== PermissionsAndroid.RESULTS.GRANTED) {
              console.error('[RealtimeVoice] ❌ Android mic permission DENIED');
              setStatusSafe('error');
              return false;
            }
            console.log('[RealtimeVoice] ✅ Permission GRANTED after request');
          }
        }
      } catch (err) {
        console.error('[RealtimeVoice] ⚠️ Permission check error:', err);
      }

      // Decide provider - ALWAYS use Azure for SA indigenous languages (zu, xh, nso)
      // OpenAI Realtime API does NOT support these languages
      console.log('[RealtimeVoice] 🔍 Language routing debug:', {
        language,
        languageLower: (language || '').toLowerCase(),
      });
      const isIndigenousSALang = (language || '').toLowerCase().startsWith('zu') || (language || '').toLowerCase().startsWith('xh') || (language || '').toLowerCase().startsWith('nso');
      const isSALang = isIndigenousSALang || (language || '').toLowerCase().startsWith('af');
      
      // Force Azure for indigenous languages (zu, xh, nso) - OpenAI doesn't support them
      if (isIndigenousSALang) {
        console.log('[RealtimeVoice] 🌍 Indigenous SA language detected:', language, '- routing to Azure Speech');
      }
      const providerToUse: 'openai' | 'azure' = isIndigenousSALang ? 'azure' : (provider || (isSALang ? 'azure' : 'openai'));
      console.log('[RealtimeVoice] 🛣️ Provider decision:', { isIndigenousSALang, isSALang, provider, providerToUse });

      // Prefer caller tokenProvider; fallback to Edge Function token
      try { token = (await tokenProvider?.()) || ''; } catch { /* Intentional: non-fatal */ }

      if (providerToUse === 'azure') {
        try {
          const { getAzureSpeechToken } = await import('@/lib/voice/realtimeToken');
          const t = await getAzureSpeechToken();
          if (t?.token) token = token || t.token;
          if (t?.region) region = t.region;
        } catch (e) {
          console.warn('[RealtimeVoice] Failed to fetch Azure token:', e);
        }
        if (!token || !region) {
          console.warn('[RealtimeVoice] No Azure token/region available');
          setStatusSafe('error');
          return false;
        }
      }
      if (!wsUrl || !token) {
        try {
          const { getRealtimeToken } = await import('@/lib/voice/realtimeToken');
          const rt = await getRealtimeToken();
          if (rt?.url) wsUrl = wsUrl || rt.url;
          if (rt?.token) token = token || rt.token;
        } catch (e) {
          console.warn('[RealtimeVoice] Failed to fetch realtime token/url:', e);
        }
      }

      // Block OpenAI for indigenous languages even if provider explicitly requested
      if (providerToUse === 'openai' && isIndigenousSALang) {
        console.error('[RealtimeVoice] ❌ OpenAI Realtime does NOT support', language, '- use Azure Speech instead');
        setStatusSafe('error');
        return false;
      }
      
      if (providerToUse === 'openai' && !wsUrl) {
        console.warn('[RealtimeVoice] No websocket URL configured');
        setStatusSafe('error');
        return false;
      }

      if (providerToUse === 'azure') {
        try {
          console.log('[RealtimeVoice] 🎤 Starting Azure Speech session...');
          const { createAzureSpeechSession } = await import('@/lib/voice/azureProvider');
          const sess = createAzureSpeechSession();
          const started = await sess.start({ token, region, language, vadSilenceMs, onPartialTranscript, onFinalTranscript });
          if (started) {
            (webrtcRef as any).current = sess as any; // reuse ref for uniform stop path
            try { (webrtcRef as any).current.setMuted(muted); } catch { /* Intentional: non-fatal */ }
            setStatusSafe('streaming');
            return true;
          } else {
            console.error('[RealtimeVoice] ❌ Azure session start failed');
            setStatusSafe('error');
            return false;
          }
        } catch (e) {
          console.error('[RealtimeVoice] ❌ Azure provider error:', e);
          setStatusSafe('error');
          return false;
        }
      }

      // Use Claude + Deepgram streaming provider for all platforms
      try {
        console.log('[RealtimeVoice] 🎤 Starting Claude + Deepgram streaming session');
        const { createClaudeVoiceSession } = await import('@/lib/voice/claudeProvider');
        const sess = createClaudeVoiceSession();
        console.log('[RealtimeVoice] 🚀 Calling sess.start...');
        const started = await sess.start({
          language,
          onPartialTranscript,
          onFinalTranscript,
          onAssistantToken,
          systemPrompt: 'You are Dash, a helpful AI assistant for EduDash Pro. Keep responses concise and friendly for voice conversations (2-3 sentences max).',
        });
        console.log('[RealtimeVoice] 📋 sess.start result:', started);
        if (started) {
          webrtcRef.current = sess as any;
          console.log('[RealtimeVoice] ✅ Claude + Deepgram streaming started successfully');
          setStatusSafe('streaming');
          return true;
        } else {
          console.error('[RealtimeVoice] ❌ sess.start returned false');
        }
      } catch (e) {
        console.error('[RealtimeVoice] ❌ Claude streaming provider start failed:', e);
      }

      // Fallback to Azure Speech if Claude+Deepgram is unavailable
      // Note: Azure may fail on React Native (no Web Audio API)
      if (Platform.OS === 'web') {
        try {
          console.log('[RealtimeVoice] 🔁 Falling back to Azure Speech session (web only)...');
          const { createAzureSpeechSession } = await import('@/lib/voice/azureProvider');
          // Re-fetch token/region if missing
          if (!token || !region) {
            try {
              const { getAzureSpeechToken } = await import('@/lib/voice/realtimeToken');
              const t = await getAzureSpeechToken();
              if (t?.token) token = token || t.token;
              if (t?.region) region = region || t.region;
            } catch (e) {
              console.warn('[RealtimeVoice] Fallback getAzureSpeechToken failed:', e);
            }
          }
          const sessAzure = createAzureSpeechSession();
          const startedAzure = await sessAzure.start({ token, region, language, vadSilenceMs, onPartialTranscript, onFinalTranscript });
          if (startedAzure) {
            (webrtcRef as any).current = sessAzure as any;
            try { (webrtcRef as any).current.setMuted(muted); } catch { /* Intentional: non-fatal */ }
            setStatusSafe('streaming');
            return true;
          } else {
            console.error('[RealtimeVoice] ❌ Azure fallback session start failed');
          }
        } catch (e) {
          console.error('[RealtimeVoice] ❌ Azure fallback error:', e);
        }
      } else {
        console.log('[RealtimeVoice] 📱 Skipping Azure Speech (native platform - requires Web Audio API)');
      }

      // FINAL FALLBACK: OpenAI Realtime (Premium users only)
      // - Works on all platforms via WebRTC
      // - Only for non-indigenous languages (zu, xh, nso not supported by OpenAI)
      // - Gated to premium/pro/enterprise tiers ($18/hr cost)
      const isPremiumUser = ['premium', 'pro', 'enterprise'].includes(subscriptionTier);
      
      if (!isIndigenousSALang && isPremiumUser) {
        try {
          console.log('[RealtimeVoice] 🔁 FINAL FALLBACK: OpenAI Realtime (Premium tier)...');
          
          // Get OpenAI token
          let openaiToken = '';
          let openaiUrl = url;
          try {
            const { getRealtimeToken } = await import('@/lib/voice/realtimeToken');
            const rt = await getRealtimeToken();
            if (rt?.url) openaiUrl = rt.url;
            if (rt?.token) openaiToken = rt.token;
          } catch (e) {
            console.warn('[RealtimeVoice] Failed to fetch OpenAI token:', e);
          }
          
          if (openaiUrl && openaiToken) {
            const { createWebRTCSession } = await import('@/lib/voice/webrtcProvider');
            const sess = createWebRTCSession();
            const started = await sess.start({
              token: openaiToken,
              url: openaiUrl,
              language,
              transcriptionModel,
              vadSilenceMs,
              onPartialTranscript,
              onFinalTranscript,
              onAssistantToken,
            });
            
            if (started) {
              webrtcRef.current = sess as any;
              try { webrtcRef.current.setMuted?.(muted); } catch { /* Intentional: non-fatal */ }
              setStatusSafe('streaming');
              console.log('[RealtimeVoice] ✅ OpenAI Realtime fallback successful!');
              return true;
            } else {
              console.error('[RealtimeVoice] ❌ OpenAI fallback start failed');
            }
          } else {
            console.warn('[RealtimeVoice] ⚠️ OpenAI fallback skipped: missing token/url');
          }
        } catch (e) {
          console.error('[RealtimeVoice] ❌ OpenAI fallback error:', e);
        }
      } else if (!isIndigenousSALang && !isPremiumUser) {
        console.log('[RealtimeVoice] 🔒 OpenAI fallback skipped: requires premium subscription (current tier:', subscriptionTier, ')');
      } else {
        console.log('[RealtimeVoice] ⚠️ OpenAI fallback skipped: indigenous language not supported');
      }

      // If all providers failed, treat as error
      console.error('[RealtimeVoice] ❌ All voice providers failed');
      setStatusSafe('error');
      return false;
    } catch (e) {
      console.error('[RealtimeVoice] startStream failed:', e);
      setStatusSafe('error');
      return false;
    }
  }, [enabled, url, provider, language, transcriptionModel, vadSilenceMs, tokenProvider, timesliceMs, onPartialTranscript, onFinalTranscript, onAssistantToken, setStatusSafe]);

  const stopStream = useCallback(async () => {
    // Idempotent: if already stopping, return the in-flight promise
    if (isStoppingRef.current && stopPromiseRef.current) {
      console.log('[RealtimeVoice] Stop already in progress, returning existing promise');
      return stopPromiseRef.current;
    }

    // Mark as stopping to prevent concurrent calls
    isStoppingRef.current = true;
    console.log('[RealtimeVoice] Beginning idempotent stop sequence');
    
    const stopPromise = (async () => {
      try {
        // Step 1: Transition to stopping state
        setStatusSafe('stopping');
        
        // Step 2: Stop WebRTC provider with timeout (3 seconds)
        if (webrtcRef.current && webrtcRef.current.isActive()) {
          console.log('[RealtimeVoice] Stopping WebRTC provider...');
          await withTimeout(
            webrtcRef.current.stop(),
            3000,
            {
              fallback: undefined,
              onTimeout: () => console.warn('[RealtimeVoice] WebRTC stop timed out, continuing...')
            }
          );
          webrtcRef.current = null;
        }
        
        // Step 3: Stop MediaRecorder if active
        if (mediaRef.current && mediaRef.current.state !== 'inactive') {
          try {
            console.log('[RealtimeVoice] Stopping MediaRecorder...');
            mediaRef.current.stop();
            mediaRef.current = null;
          } catch (e) {
            console.warn('[RealtimeVoice] MediaRecorder stop error:', e);
          }
        }
        
        // Step 4: Stop all media tracks
        if (streamRef.current) {
          try {
            console.log('[RealtimeVoice] Stopping media tracks...');
            streamRef.current.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch (e) {
                console.warn('[RealtimeVoice] Track stop error:', e);
              }
            });
            streamRef.current = null;
          } catch (e) {
            console.warn('[RealtimeVoice] Stream getTracks error:', e);
          }
        }
        
        // Step 5: Send done signal and close WebSocket with timeout
        if (wsRef.current) {
          try {
            if (wsRef.current.readyState === WebSocket.OPEN) {
              console.log('[RealtimeVoice] Sending done signal to WebSocket...');
              wsRef.current.send(JSON.stringify({ type: 'done' }));
              // Brief wait for server to process
              await wait(100);
            }
            console.log('[RealtimeVoice] Closing WebSocket...');
            wsRef.current.close();
            wsRef.current = null;
          } catch (e) {
            console.warn('[RealtimeVoice] WebSocket close error:', e);
          }
        }
        
        // Step 6: Brief wait for UI smoothness before finalizing
        await wait(200);
        
        console.log('[RealtimeVoice] Stop sequence complete');
      } catch (error) {
        console.error('[RealtimeVoice] Stop error:', error);
      } finally {
        // Always transition to finished, even on error
        isStoppingRef.current = false;
        stopPromiseRef.current = null;
        setStatusSafe('finished');
      }
    })();

    // Store the promise for idempotency
    stopPromiseRef.current = stopPromise;
    return stopPromise;
  }, [setStatusSafe]);

  const cancel = useCallback(async () => {
    try { await webrtcRef.current?.stop(); webrtcRef.current = null; } catch { /* Intentional: non-fatal */ }
    try { mediaRef.current?.stop(); } catch { /* Intentional: non-fatal */ }
    try { streamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch { /* Intentional: non-fatal */ }
    try { wsRef.current?.close(); } catch { /* Intentional: non-fatal */ }
    setStatusSafe('disconnected');
  }, [setStatusSafe]);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(!!m);
    try { webrtcRef.current?.setMuted?.(!!m); } catch { /* Intentional: non-fatal */ }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(!muted);
  }, [muted, setMuted]);

  // Cleanup on unmount
  useEffect(() => () => {
    try { mediaRef.current?.stop(); } catch { /* Intentional: non-fatal */ }
    try { streamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch { /* Intentional: non-fatal */ }
    try { wsRef.current?.close(); } catch { /* Intentional: non-fatal */ }
  }, []);

  // React to language changes during an active stream
  useEffect(() => {
    if (status === 'streaming' && webrtcRef.current && (language || vadSilenceMs || transcriptionModel)) {
      try { webrtcRef.current.updateTranscriptionConfig({ language, vadSilenceMs, transcriptionModel }); } catch { /* Intentional: non-fatal */ }
    }
     
  }, [language, vadSilenceMs, transcriptionModel, status]);

  const setLanguage = useCallback((lang: string) => {
    try { webrtcRef.current?.updateTranscriptionConfig({ language: lang }); } catch { /* Intentional: non-fatal */ }
  }, []);

  return {
    enabled,
    status,
    statusRef, // Export ref for live status access
    muted,
    setMuted,
    toggleMute,
    startStream,
    stopStream,
    cancel,
    setLanguage,
  };
}
