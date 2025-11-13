import AsyncStorage from '@react-native-async-storage/async-storage';
import { DashAIAssistant } from '@/services/dash-ai/DashAICompat';
import { voiceService } from '@/lib/voice/client';
import type { SupportedLanguage, VoicePreference } from '@/lib/voice/types';

const CACHE_KEY = '@dash_ai_cache.voice_preferences';
const VOICE_CHAT_PREFS_KEY = '@dash_voice_prefs';
const MIGRATION_FLAG = '@dash_ai_migrated_v1';

export type VoiceChatPrefs = {
  defaultLock: boolean;
  autoSpeak: boolean;
  autoSilenceMs: number; // when unlocked
  listenCapMs: number;   // hard cap when locked
};

const DEFAULT_CHAT_PREFS: VoiceChatPrefs = {
  defaultLock: false,
  autoSpeak: true,
  autoSilenceMs: 7000,
  listenCapMs: 15000,
};

// Map various legacy language codes to supported SA set
export function normalizeLanguageCode(input?: string): SupportedLanguage {
  const raw = (input || '').toLowerCase();
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('af')) return 'af';
  if (raw.startsWith('zu')) return 'zu';
  if (raw.startsWith('xh')) return 'xh';
  if (raw.startsWith('nso') || raw === 'st' || raw.includes('sotho')) return 'nso';
  // Default to English (SA)
  return 'en';
}

// Choose a reasonable provider voice per language and gender
export function resolveDefaultVoiceId(lang: SupportedLanguage, gender: 'male' | 'female' = 'female'): string {
  switch (lang) {
    case 'en':
      return gender === 'male' ? 'en-ZA-LukeNeural' : 'en-ZA-LeahNeural';
    case 'af':
      return gender === 'male' ? 'af-ZA-WillemNeural' : 'af-ZA-AdriNeural';
    case 'zu':
      return gender === 'male' ? 'zu-ZA-ThembaNeural' : 'zu-ZA-ThandoNeural';
    case 'xh':
      // Placeholder online voice IDs where premium not available
      return 'xh-ZA-Online';
    case 'nso':
      return 'nso-ZA-Online';
    default:
      return 'en-ZA-LeahNeural';
  }
}

export async function getVoicePrefs(): Promise<VoicePreference | null> {
  // Try server first
  const prefs = await voiceService.getPreferences();
  if (prefs) {
    try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(prefs)); } catch { /* Intentional: cache write failure is non-fatal */ }
    return prefs;
  }
  // Fallback to cache
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* Intentional: cache read failure is non-fatal */ }
  return null;
}

export async function setVoicePrefs(update: Partial<VoicePreference>): Promise<VoicePreference> {
  const merged = await voiceService.savePreferences(update);
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged)); } catch { /* Intentional: cache write failure is non-fatal */ }
  return merged;
}

export async function getVoiceChatPrefs(): Promise<VoiceChatPrefs> {
  try {
    const raw = await AsyncStorage.getItem(VOICE_CHAT_PREFS_KEY);
    if (raw) return { ...DEFAULT_CHAT_PREFS, ...(JSON.parse(raw) as VoiceChatPrefs) };
  } catch { /* Intentional: cache read failure returns defaults */ }
  return DEFAULT_CHAT_PREFS;
}

export async function setVoiceChatPrefs(prefs: Partial<VoiceChatPrefs>): Promise<void> {
  const current = await getVoiceChatPrefs();
  const next = { ...current, ...prefs };
  try { await AsyncStorage.setItem(VOICE_CHAT_PREFS_KEY, JSON.stringify(next)); } catch { /* Intentional: cache write failure is non-fatal */ }
}

export function getPersonality() {
  return DashAIAssistant.getInstance().getPersonality();
}

export async function setPersonality(partial: any) {
  const dash = DashAIAssistant.getInstance();
  await dash.savePersonality(partial);
}

// One-time migration of legacy keys into SSOT
export async function initAndMigrate(): Promise<void> {
  try {
    const already = await AsyncStorage.getItem(MIGRATION_FLAG);
    if (already === '1') return;

    // Read legacy voice UI keys
    const [vdl, vas, asMs, capMs] = await Promise.all([
      AsyncStorage.getItem('@voice_default_lock'),
      AsyncStorage.getItem('@voice_auto_speak'),
      AsyncStorage.getItem('@voice_auto_silence_ms'),
      AsyncStorage.getItem('@voice_listen_cap_ms'),
    ]);

    // Consolidate chat prefs
    const chatPrefs: VoiceChatPrefs = {
      defaultLock: vdl === 'true',
      autoSpeak: vas === null ? true : vas === 'true',
      autoSilenceMs: asMs && !Number.isNaN(Number(asMs)) ? Math.max(2000, Number(asMs)) : DEFAULT_CHAT_PREFS.autoSilenceMs,
      listenCapMs: capMs && !Number.isNaN(Number(capMs)) ? Math.max(5000, Number(capMs)) : DEFAULT_CHAT_PREFS.listenCapMs,
    };
    await setVoiceChatPrefs(chatPrefs);

    // Attempt to infer voice prefs from personality voice_settings backup
    let language: SupportedLanguage | undefined;
    let voiceId: string | undefined;
    let speaking_rate: number | undefined;
    let pitch: number | undefined;
    let volume: number | undefined;

    try {
      const backup = await AsyncStorage.getItem('@dash_ai_settings_backup');
      if (backup) {
        const parsed = JSON.parse(backup);
        language = normalizeLanguageCode(parsed?.preferredLanguage);
        speaking_rate = Number(parsed?.speechSpeed) || undefined;
        volume = Number(parsed?.speechVolume) || undefined;
      }
    } catch { /* Intentional: legacy backup read failure is non-fatal */ }

    // If we still have nothing, peek at personality in storage via DashAIAssistant
    try {
      const dash = DashAIAssistant.getInstance();
      const p = dash.getPersonality?.();
      if (p?.voice_settings) {
        language = language || normalizeLanguageCode(p.voice_settings.language);
        speaking_rate = speaking_rate ?? p.voice_settings.rate;
        pitch = pitch ?? p.voice_settings.pitch;
      }
    } catch { /* Intentional: personality read failure is non-fatal */ }

    // Resolve a default voice_id for the language
    const gender = 'female';
    if (language) voiceId = resolveDefaultVoiceId(language, gender);

    if (language) {
      // Persist to Supabase preferences (SSOT)
      await setVoicePrefs({
        language,
        voice_id: voiceId || resolveDefaultVoiceId(language),
        speaking_rate,
        pitch,
        volume,
      });
    }

    await AsyncStorage.setItem(MIGRATION_FLAG, '1');
  } catch (e) {
    // Migration is best-effort; non-fatal
    console.warn('[dashSettings] Migration warning:', e);
  }
}