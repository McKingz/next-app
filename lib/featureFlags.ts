import { getPostHog } from '@/lib/posthogClient';

export interface FeatureFlags {
  // Core features
  ai_gateway_enabled: boolean;
  enterprise_tier_enabled: boolean;
  principal_hub_enabled: boolean;
  homework_v2_enabled: boolean;
  resource_portal_enabled: boolean;
  advanced_grading_enabled: boolean;
  contact_sales_enabled: boolean;
  
  // AI Features
  ai_lesson_generation: boolean;
  ai_homework_help: boolean;
  ai_grading_assistance: boolean;
  ai_stem_activities: boolean;
  ai_progress_analysis: boolean;
  ai_insights: boolean;
  ai_streaming_enabled: boolean;
  
  // Collaboration Features
  principal_meeting_rooms: boolean;
  real_time_whiteboard: boolean;
  meeting_recordings: boolean;
  
  // Analytics and Monitoring
  advanced_school_metrics: boolean;
  teacher_performance_analytics: boolean;
  parent_engagement_tracking: boolean;
  
  // Subscription Features
  stripe_billing_enabled: boolean;
  seat_management_enabled: boolean;
  enterprise_trials: boolean;
  
  // Platform Features
  android_only_mode: boolean;
  admob_test_ids: boolean;
  production_db_dev_mode: boolean;
  
  // Language Features
  enableMultilanguageSupport: boolean;
  
  // Parent Dashboard Features (NEW)
  parent_hub_enabled: boolean;
  whatsapp_integration: boolean;
  offline_homework: boolean;
  voice_notes: boolean;
  progress_tracking: boolean;
  in_app_messaging: boolean;
  school_announcements: boolean;
  parent_teacher_chat: boolean;
  homework_submissions_v2: boolean;
  push_notifications: boolean;
  multilingual_auto_translate: boolean;
  parent_engagement_metrics: boolean;
  
  // WhatsApp Specific Features
  whatsapp_opt_in: boolean;
  whatsapp_webhook: boolean;
  whatsapp_send_receive: boolean;
  
  // Offline Features
  offline_sync_engine: boolean;
  offline_media_storage: boolean;
  progressive_sync: boolean;
  
  // South African Localization
  sa_languages_support: boolean; // English, Afrikaans, isiZulu, Sesotho
  caps_curriculum_alignment: boolean;
  sa_payment_methods: boolean;
}

// Default feature flags - primarily controlled via PostHog but with env fallbacks
const AI_DEFAULT = (process.env.EXPO_PUBLIC_AI_ENABLED !== 'false') && (process.env.EXPO_PUBLIC_ENABLE_AI_FEATURES !== 'false')
const SA_TENANT_DEFAULT = process.env.EXPO_PUBLIC_COUNTRY === 'ZA' || process.env.EXPO_PUBLIC_SA_TENANT === 'true'
const TENANT_SLUG_DEFAULT = !!process.env.EXPO_PUBLIC_TENANT_SLUG
const DEFAULT_FLAGS: FeatureFlags = {
  // Core features
  ai_gateway_enabled: process.env.EXPO_PUBLIC_AI_GATEWAY_ENABLED === 'true',
  enterprise_tier_enabled: process.env.EXPO_PUBLIC_ENTERPRISE_TIER_ENABLED === 'true',
  principal_hub_enabled: process.env.EXPO_PUBLIC_PRINCIPAL_HUB_ENABLED === 'true',
  homework_v2_enabled: process.env.EXPO_PUBLIC_HOMEWORK_V2_ENABLED === 'true',
  resource_portal_enabled: process.env.EXPO_PUBLIC_RESOURCE_PORTAL_ENABLED === 'true',
  advanced_grading_enabled: process.env.EXPO_PUBLIC_ADVANCED_GRADING_ENABLED === 'true',
  contact_sales_enabled: process.env.EXPO_PUBLIC_CONTACT_SALES_ENABLED === 'true',
  
  // AI Features - default to enabled unless explicitly disabled via env
  ai_lesson_generation: AI_DEFAULT,
  ai_homework_help: AI_DEFAULT,
  ai_grading_assistance: AI_DEFAULT,
  ai_stem_activities: AI_DEFAULT,
  ai_progress_analysis: AI_DEFAULT,
  ai_insights: AI_DEFAULT,
  ai_streaming_enabled: false,
  
  // Collaboration Features
  principal_meeting_rooms: false,
  real_time_whiteboard: false,
  meeting_recordings: false,
  
  // Analytics and Monitoring - premium tier
  advanced_school_metrics: false,
  teacher_performance_analytics: false,
  parent_engagement_tracking: true, // basic tracking enabled
  
  // Subscription Features
  stripe_billing_enabled: false,
  seat_management_enabled: false,
  enterprise_trials: false,
  
  // Platform Features - honor project rules
  android_only_mode: process.env.EXPO_PUBLIC_PLATFORM_TESTING === 'android',
  admob_test_ids: process.env.EXPO_PUBLIC_ADMOB_TEST_IDS_ONLY === 'true',
  production_db_dev_mode: process.env.EXPO_PUBLIC_USE_PRODUCTION_DB_AS_DEV === 'true',
  
  // Language Features
  enableMultilanguageSupport: process.env.EXPO_PUBLIC_ENABLE_MULTILANGUAGE !== 'false',
  
  // Parent Dashboard Features (NEW) - Strategic Roadmap Implementation
  parent_hub_enabled: process.env.EXPO_PUBLIC_PARENT_HUB_ENABLED !== 'false', // enabled by default
  whatsapp_integration: false, // EMERGENCY KILL SWITCH - client credentials exposed
  offline_homework: process.env.EXPO_PUBLIC_OFFLINE_HOMEWORK !== 'false', // beta feature
  voice_notes: true, // core feature enabled
  progress_tracking: true, // core feature enabled
  in_app_messaging: true, // core feature enabled
  school_announcements: true, // core feature enabled
  parent_teacher_chat: true, // core communication feature
  homework_submissions_v2: process.env.EXPO_PUBLIC_HOMEWORK_V2_ENABLED === 'true',
  push_notifications: process.env.EXPO_PUBLIC_PUSH_NOTIFICATIONS !== 'false',
  multilingual_auto_translate: SA_TENANT_DEFAULT, // for SA multi-language support
  parent_engagement_metrics: true, // basic engagement tracking
  
  // WhatsApp Specific Features - SECURITY: DISABLED DUE TO CLIENT-SIDE SECRET EXPOSURE
  whatsapp_opt_in: false, // EMERGENCY KILL SWITCH - client credentials exposed
  whatsapp_webhook: false, // EMERGENCY KILL SWITCH - client credentials exposed
  whatsapp_send_receive: false, // EMERGENCY KILL SWITCH - client credentials exposed
  
  // Offline Features - Strategic "Offline-First" Architecture
  offline_sync_engine: process.env.EXPO_PUBLIC_OFFLINE_SYNC !== 'false', // core offline feature
  offline_media_storage: process.env.EXPO_PUBLIC_OFFLINE_MEDIA !== 'false',
  progressive_sync: process.env.EXPO_PUBLIC_PROGRESSIVE_SYNC !== 'false',
  
  // South African Localization - Strategic "SA-First" Approach
  sa_languages_support: SA_TENANT_DEFAULT, // English, Afrikaans, isiZulu, Sesotho
  caps_curriculum_alignment: SA_TENANT_DEFAULT, // CAPS = Curriculum and Assessment Policy Statement
  sa_payment_methods: SA_TENANT_DEFAULT, // EFT, Ozow, SnapScan
};

let cachedFlags: FeatureFlags | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get feature flags with PostHog integration and local caching
 */
export async function getFeatureFlags(userId?: string): Promise<FeatureFlags> {
  const now = Date.now();
  
  // Return cached flags if still fresh
  if (cachedFlags && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedFlags;
  }
  
  try {
    const posthog = getPostHog();
    
    if (!posthog || !userId) {
      // Fallback to environment defaults when PostHog unavailable or no user
      cachedFlags = { ...DEFAULT_FLAGS };
      lastFetchTime = now;
      return cachedFlags;
    }
    
    // Fetch flags from PostHog for this user
    // Note: PostHog React Native doesn't have getAllFlags, using getFeatureFlag for individual flags
    const flags: any = {}; // TODO: Implement individual flag fetching when needed
    
    // Merge PostHog flags with defaults, with PostHog taking precedence
    cachedFlags = {
      ...DEFAULT_FLAGS,
      // Map PostHog flags to our feature flag structure
      ai_gateway_enabled: flags.ai_gateway_enabled ?? DEFAULT_FLAGS.ai_gateway_enabled,
      enterprise_tier_enabled: flags.enterprise_tier ?? DEFAULT_FLAGS.enterprise_tier_enabled,
      principal_hub_enabled: flags.principal_hub ?? DEFAULT_FLAGS.principal_hub_enabled,
      homework_v2_enabled: flags.homework_v2 ?? DEFAULT_FLAGS.homework_v2_enabled,
      resource_portal_enabled: flags.resource_portal ?? DEFAULT_FLAGS.resource_portal_enabled,
      advanced_grading_enabled: flags.advanced_grading ?? DEFAULT_FLAGS.advanced_grading_enabled,
      contact_sales_enabled: flags.contact_sales ?? DEFAULT_FLAGS.contact_sales_enabled,
      
      // AI Features
      ai_lesson_generation: flags.ai_lesson_generation ?? DEFAULT_FLAGS.ai_lesson_generation,
      ai_homework_help: flags.ai_homework_help ?? DEFAULT_FLAGS.ai_homework_help,
      ai_grading_assistance: flags.ai_grading_assistance ?? DEFAULT_FLAGS.ai_grading_assistance,
      ai_stem_activities: flags.ai_stem_activities ?? DEFAULT_FLAGS.ai_stem_activities,
      ai_progress_analysis: flags.ai_progress_analysis ?? DEFAULT_FLAGS.ai_progress_analysis,
      ai_insights: flags.ai_insights ?? DEFAULT_FLAGS.ai_insights,
      ai_streaming_enabled: flags.ai_streaming ?? DEFAULT_FLAGS.ai_streaming_enabled,
      
      // Collaboration Features
      principal_meeting_rooms: flags.principal_meetings ?? DEFAULT_FLAGS.principal_meeting_rooms,
      real_time_whiteboard: flags.whiteboard ?? DEFAULT_FLAGS.real_time_whiteboard,
      meeting_recordings: flags.meeting_recordings ?? DEFAULT_FLAGS.meeting_recordings,
      
      // Analytics
      advanced_school_metrics: flags.advanced_metrics ?? DEFAULT_FLAGS.advanced_school_metrics,
      teacher_performance_analytics: flags.teacher_analytics ?? DEFAULT_FLAGS.teacher_performance_analytics,
      parent_engagement_tracking: flags.parent_engagement ?? DEFAULT_FLAGS.parent_engagement_tracking,
      
      // Billing
      stripe_billing_enabled: flags.stripe_billing ?? DEFAULT_FLAGS.stripe_billing_enabled,
      seat_management_enabled: flags.seat_management ?? DEFAULT_FLAGS.seat_management_enabled,
      enterprise_trials: flags.enterprise_trials ?? DEFAULT_FLAGS.enterprise_trials,
      
      // Platform - these should remain as env defaults
      android_only_mode: DEFAULT_FLAGS.android_only_mode,
      admob_test_ids: DEFAULT_FLAGS.admob_test_ids,
      production_db_dev_mode: DEFAULT_FLAGS.production_db_dev_mode,
      
      // Language - env default with PostHog override
      enableMultilanguageSupport: flags.multilanguage_support ?? DEFAULT_FLAGS.enableMultilanguageSupport,
    };
    
    lastFetchTime = now;
    return cachedFlags;
    
  } catch (error) {
    console.warn('Failed to fetch feature flags from PostHog, using defaults:', error);
    cachedFlags = { ...DEFAULT_FLAGS };
    lastFetchTime = now;
    return cachedFlags;
  }
}

/**
 * Check if a specific feature is enabled
 */
export async function isFeatureEnabled(
  flagName: keyof FeatureFlags, 
  userId?: string
): Promise<boolean> {
  const flags = await getFeatureFlags(userId);
  return flags[flagName];
}

/**
 * Force refresh feature flags cache
 */
export function invalidateFeatureFlagsCache(): void {
  cachedFlags = null;
  lastFetchTime = 0;
}

/**
 * Get feature flags synchronously (returns cached or defaults)
 */
export function getFeatureFlagsSync(): FeatureFlags {
  return cachedFlags || { ...DEFAULT_FLAGS };
}

/**
 * Identify user for feature flag targeting
 */
export function identifyUserForFlags(userId: string, properties?: Record<string, any>): void {
  try {
    const posthog = getPostHog();
    if (posthog) {
      posthog.identify(userId, properties);
      // Invalidate cache to fetch new flags for this user
      invalidateFeatureFlagsCache();
    }
  } catch (error) {
    console.warn('Failed to identify user for feature flags:', error);
  }
}
