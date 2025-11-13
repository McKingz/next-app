// Shared AI Enablement Utility
// Fixes the inconsistency mentioned in MISSING.md where different components
// use conflicting conditions to determine AI feature availability

import { getAppConfiguration } from '../config';

/**
 * Central source of truth for AI enablement logic
 * Uses permissive logic (enabled unless explicitly 'false') for consistency
 * @returns boolean indicating if AI features are enabled
 */
export function isAIEnabled(): boolean {
  return getAppConfiguration().isAIEnabled;
}

/**
 * Helper function to get optional environment variable with default
 */
function getEnvBoolean(key: string, defaultValue: boolean = true): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() !== 'false' && value !== '0';
}

/**
 * Check if specific AI features are enabled
 */
export const AIFeatureFlags = {
  lessonGeneration: () => isAIEnabled() && getEnvBoolean('EXPO_PUBLIC_AI_LESSON_GENERATION_ENABLED'),
  homeworkGrading: () => isAIEnabled() && getEnvBoolean('EXPO_PUBLIC_AI_HOMEWORK_GRADING_ENABLED'),
  homeworkHelp: () => isAIEnabled() && getEnvBoolean('EXPO_PUBLIC_AI_HOMEWORK_HELP_ENABLED'),
  stemActivities: () => isAIEnabled() && getEnvBoolean('EXPO_PUBLIC_AI_STEM_ACTIVITIES_ENABLED'),
  progressAnalysis: () => isAIEnabled() && getEnvBoolean('EXPO_PUBLIC_AI_PROGRESS_ANALYSIS_ENABLED'),
  insights: () => isAIEnabled() && getEnvBoolean('EXPO_PUBLIC_AI_INSIGHTS_ENABLED'),
  contentModeration: () => isAIEnabled() && getEnvBoolean('EXPO_PUBLIC_AI_CONTENT_MODERATION_ENABLED'),
  streaming: () => isAIEnabled() && getEnvBoolean('EXPO_PUBLIC_AI_STREAMING_ENABLED'),
} as const;

/**
 * Get AI feature status for debugging/admin purposes
 */
export function getAIFeatureStatus() {
  return {
    mainAI: isAIEnabled(),
    lessonGeneration: AIFeatureFlags.lessonGeneration(),
    homeworkGrading: AIFeatureFlags.homeworkGrading(),
    homeworkHelp: AIFeatureFlags.homeworkHelp(),
    stemActivities: AIFeatureFlags.stemActivities(),
    progressAnalysis: AIFeatureFlags.progressAnalysis(),
    insights: AIFeatureFlags.insights(),
    contentModeration: AIFeatureFlags.contentModeration(),
    streaming: AIFeatureFlags.streaming(),
  };
}

// For backward compatibility with existing code
export const AI_ENABLED = isAIEnabled();