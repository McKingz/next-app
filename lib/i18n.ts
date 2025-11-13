/**
 * Internationalization (i18n) Configuration
 * 
 * Comprehensive multilanguage support for the EduDash platform
 * Supporting educational content in multiple languages
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
// Import expo-localization with fallback
let getLocales: () => Array<{ languageCode: string; [key: string]: any }> = () => [{ languageCode: 'en' }];
try {
  const expoLocalization = require('expo-localization');
  getLocales = expoLocalization.getLocales;
} catch {
  console.warn('expo-localization not available, using fallback');
}
// Feature flags integration (fallback if not available)
let getFeatureFlagsSync: () => any = () => ({ enableMultilanguageSupport: true });
try {
  const featureFlags = require('@/lib/featureFlags');
  if (featureFlags.getFeatureFlagsSync) {
    getFeatureFlagsSync = featureFlags.getFeatureFlagsSync;
  }
} catch {
  console.debug('[i18n] Feature flags not available, using defaults');
}

// Only load English eagerly to reduce bundle size
// Other languages are lazy-loaded on demand
const en = require('../locales/en/common.json');
const enWhatsApp = (() => {
  try { return require('../locales/en/whatsapp.json'); } catch { return {}; }
})();

// Mark when i18n has been optimized
const OPTIMIZED_I18N = true;

// Supported languages for educational content
export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', nativeName: 'English', rtl: false },
  es: { name: 'Spanish', nativeName: 'Español', rtl: false },
  fr: { name: 'French', nativeName: 'Français', rtl: false },
  pt: { name: 'Portuguese', nativeName: 'Português', rtl: false },
  de: { name: 'German', nativeName: 'Deutsch', rtl: false },
  // South African languages (Active)
  af: { name: 'Afrikaans', nativeName: 'Afrikaans', rtl: false },
  zu: { name: 'Zulu', nativeName: 'IsiZulu', rtl: false },
  st: { name: 'Sepedi', nativeName: 'Sepedi', rtl: false },
} as const;

// South African languages coming soon
export const COMING_SOON_LANGUAGES = {
  xh: { name: 'Xhosa', nativeName: 'IsiXhosa', rtl: false },
  tn: { name: 'Tswana', nativeName: 'Setswana', rtl: false },
  ss: { name: 'Swati', nativeName: 'SiSwati', rtl: false },
  nr: { name: 'Ndebele', nativeName: 'IsiNdebele', rtl: false },
  ve: { name: 'Venda', nativeName: 'Tshivenda', rtl: false },
  ts: { name: 'Tsonga', nativeName: 'Xitsonga', rtl: false },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Eager resources (English only)
const baseResources: Record<string, any> = {
  en: { common: en, whatsapp: enWhatsApp },
};

// Synchronous loaders for all languages - bundled at build time
const LANGUAGE_LOADERS: Record<SupportedLanguage, () => any> = {
  en: () => ({ common: require('../locales/en/common.json') }),
  es: () => ({ common: require('../locales/es/common.json') }),
  fr: () => ({ common: require('../locales/fr/common.json') }),
  pt: () => ({ common: require('../locales/pt/common.json') }),
  de: () => ({ common: require('../locales/de/common.json') }),
  af: () => ({ common: require('../locales/af/common.json') }),
  zu: () => ({ common: require('../locales/zu/common.json') }),
  st: () => ({ common: require('../locales/st/common.json') }),
};

// Detect user's preferred language
function detectLanguage(): string {
  try {
    const flags = getFeatureFlagsSync();
    
    // Check if multilanguage feature is enabled (default to true if flag doesn't exist)
    const multilangEnabled = flags.enableMultilanguageSupport !== false;
    if (!multilangEnabled) {
      return 'en'; // Default to English if feature is disabled
    }

    // First check persisted language
    try {
      // Use a synchronous-ish access pattern; in RN this is async, so we use a fallback
      const persisted = (global as any).__EDUDASH_LANG__ as string | undefined;
      if (persisted && persisted in SUPPORTED_LANGUAGES) {
        return persisted;
      }
    } catch { /* Intentional: non-fatal */ }

    // Get device locale
    const locales = getLocales();
    const deviceLanguage = locales[0]?.languageCode || 'en';
    
    // Check if we support this language
    if (deviceLanguage in SUPPORTED_LANGUAGES) {
      return deviceLanguage;
    }
    
    // Fallback to English
    return 'en';
  } catch {
    // Fallback to English on any error
    return 'en';
  }
}

// Initialize i18n with English only
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: baseResources,
      lng: detectLanguage(),
      fallbackLng: 'en',
      defaultNS: 'common',
      ns: ['common', 'whatsapp'],
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
      debug: process.env.NODE_ENV === 'development',
      returnObjects: true,
      keySeparator: '.',
      pluralSeparator: '_',
      saveMissing: process.env.NODE_ENV === 'development',
    });
}

/**
 * Lazy load language resources if not loaded yet
 */
export const lazyLoadLanguage = async (language: SupportedLanguage) => {
  if (!SUPPORTED_LANGUAGES[language]) return;
  if ((i18n.options?.resources as any)?.[language]) return; // already added
  try {
    // Synchronous load - no await needed
    const bundle = LANGUAGE_LOADERS[language]();
    // Add as resource bundle
    Object.keys(bundle).forEach((ns) => {
      i18n.addResourceBundle(language, ns, (bundle as any)[ns], true, true);
    });
  } catch (e) {
    console.warn(`[i18n] Failed to lazy-load language: ${language}`, e);
  }
};

/**
 * Get the current language
 */
export const getCurrentLanguage = (): SupportedLanguage => {
  return (i18n.language as SupportedLanguage) || 'en';
};

/**
 * Get language information
 */
export const getLanguageInfo = (lang: SupportedLanguage) => {
  return SUPPORTED_LANGUAGES[lang];
};

/**
 * Check if language is RTL (Right-to-Left)
 */
export const isRTL = (lang?: SupportedLanguage): boolean => {
  const language = lang || getCurrentLanguage();
  return SUPPORTED_LANGUAGES[language]?.rtl || false;
};

/**
 * Change language dynamically (lazy loads resources first)
 */
export const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
  try {
    await lazyLoadLanguage(language);
    await i18n.changeLanguage(language);

    // Persist language selection
    try {
      const { storage } = await import('@/lib/storage');
      await storage.setItem('@edudash_language', language);
      if (__DEV__) console.log('[i18n] Persisted language:', language);
    } catch (e) {
      console.warn('[i18n] Failed to persist language', e);
    }
    
    // Track language change (if analytics available)
    try {
      const { track } = await import('@/lib/analytics');
      track('edudash.language.changed', {
        from: i18n.language,
        to: language,
        timestamp: new Date().toISOString(),
      });
    } catch {
      console.debug('[i18n] Analytics not available for language tracking');
    }

    // Best-effort: sync Dash user context (only if authenticated)
    try {
      const { assertSupabase } = await import('@/lib/supabase');
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { syncDashContext } = await import('@/lib/agent/dashContextSync');
        await syncDashContext({ language });
      }
    } catch (e) {
      console.debug('[i18n] dash-context-sync skipped:', e);
    }
  } catch (error) {
    console.error('Failed to change language:', error);
  }
};

/**
 * Get available languages
 */
export const getAvailableLanguages = (): Array<{
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  rtl: boolean;
}> => {
  return Object.entries(SUPPORTED_LANGUAGES)
    .map(([code, info]) => ({
      code: code as SupportedLanguage,
      ...info,
    }))
    .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by English name
};

/**
 * Get coming soon languages
 */
export const getComingSoonLanguages = (): Array<{
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
  comingSoon: true;
}> => {
  return Object.entries(COMING_SOON_LANGUAGES)
    .map(([code, info]) => ({
      code,
      ...info,
      comingSoon: true as const,
    }))
    .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by English name
};

/**
 * Translation key validation (development only)
 */
export const validateTranslationKey = (key: string, namespace = 'common'): boolean => {
  if (!__DEV__) return true;
  return i18n.exists(key, { ns: namespace });
};

export default i18n;
