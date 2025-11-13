/**
 * Type Definitions: Tester Feedback System
 * 
 * Zod schemas and TypeScript types for the internal tester feedback feature.
 * Enables bug reports, feature requests, and improvements during AAB testing.
 * 
 * Documentation Sources:
 * - Zod: https://zod.dev/
 * - TypeScript 5.8: https://www.typescriptlang.org/docs/handbook/intro.html
 * - Supabase JS v2: https://supabase.com/docs/reference/javascript/introduction
 */

import { z } from 'zod';

// ============================================
// ENUMS (matches database enums)
// ============================================

export const FeedbackSeveritySchema = z.enum(['bug', 'feature', 'improvement']);
export type FeedbackSeverity = z.infer<typeof FeedbackSeveritySchema>;

export const FeedbackStatusSchema = z.enum(['new', 'reviewing', 'resolved']);
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;

export const FeedbackPlatformSchema = z.enum(['android', 'ios', 'web']);
export type FeedbackPlatform = z.infer<typeof FeedbackPlatformSchema>;

// ============================================
// DEVICE INFO SCHEMA
// ============================================

/**
 * Device metadata collected at submission time for debugging
 */
export const DeviceInfoSchema = z.object({
  // Device hardware
  brand: z.string().optional(),
  modelName: z.string().optional(),
  deviceType: z.string().optional(), // 'PHONE' | 'TABLET' | 'DESKTOP'
  
  // Operating system
  osVersion: z.string().optional(),
  osInternalBuildId: z.string().optional(),
  platform: z.string().optional(), // 'android' | 'ios' | 'web'
  
  // Application version
  appVersion: z.string().optional(),
  nativeApplicationVersion: z.string().optional(),
  nativeBuildVersion: z.string().optional(),
  
  // Localization
  locale: z.string().optional(),
  timezone: z.string().optional(),
  
  // Additional context
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
});

export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

// ============================================
// DATABASE RECORD SCHEMA (full row)
// ============================================

export const TesterFeedbackSchema = z.object({
  id: z.string().uuid(),
  preschool_id: z.string().uuid(),
  user_id: z.string().uuid(),
  feedback_text: z.string().min(1).trim(),
  screenshot_path: z.string().nullable(),
  device_info: DeviceInfoSchema,
  app_version: z.string().nullable(),
  platform: FeedbackPlatformSchema.nullable(),
  severity: FeedbackSeveritySchema,
  status: FeedbackStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type TesterFeedback = z.infer<typeof TesterFeedbackSchema>;

// ============================================
// SUBMISSION PAYLOAD SCHEMAS
// ============================================

/**
 * Client submission payload (before database insertion)
 * Used in feedback form submission
 */
export const SubmitFeedbackSchema = z.object({
  feedback_text: z.string()
    .min(10, 'Feedback must be at least 10 characters')
    .max(5000, 'Feedback must be less than 5000 characters')
    .trim()
    .refine((val) => val.length > 0, 'Feedback cannot be empty'),
  
  severity: FeedbackSeveritySchema.default('bug'),
  
  // Device metadata (auto-collected)
  device_info: DeviceInfoSchema.default({}),
  app_version: z.string().optional(),
  platform: FeedbackPlatformSchema.optional(),
  
  // Screenshot (optional, will be uploaded separately)
  has_screenshot: z.boolean().default(false),
});

export type SubmitFeedbackPayload = z.infer<typeof SubmitFeedbackSchema>;

/**
 * Database insertion payload (with IDs)
 */
export const InsertFeedbackSchema = SubmitFeedbackSchema.extend({
  preschool_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: FeedbackStatusSchema.default('new'),
}).omit({ has_screenshot: true });

export type InsertFeedbackPayload = z.infer<typeof InsertFeedbackSchema>;

// ============================================
// UPDATE SCHEMAS
// ============================================

/**
 * Superadmin status update
 */
export const UpdateFeedbackStatusSchema = z.object({
  id: z.string().uuid(),
  status: FeedbackStatusSchema,
});

export type UpdateFeedbackStatusPayload = z.infer<typeof UpdateFeedbackStatusSchema>;

/**
 * User screenshot attachment (only while status = 'new')
 */
export const AttachScreenshotSchema = z.object({
  id: z.string().uuid(),
  screenshot_path: z.string(),
});

export type AttachScreenshotPayload = z.infer<typeof AttachScreenshotSchema>;

// ============================================
// QUERY FILTER SCHEMAS
// ============================================

/**
 * Superadmin dashboard filters
 */
export const FeedbackFiltersSchema = z.object({
  preschool_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  severity: FeedbackSeveritySchema.optional(),
  status: FeedbackStatusSchema.optional(),
  platform: FeedbackPlatformSchema.optional(),
  search: z.string().optional(), // Search in feedback_text
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
}).default({});

export type FeedbackFilters = z.infer<typeof FeedbackFiltersSchema>;

// ============================================
// AGGREGATION SCHEMAS
// ============================================

/**
 * Status count for dashboard badges
 */
export const FeedbackCountsSchema = z.object({
  new: z.number().int().nonnegative(),
  reviewing: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type FeedbackCounts = z.infer<typeof FeedbackCountsSchema>;

/**
 * Severity distribution
 */
export const SeverityDistributionSchema = z.object({
  bug: z.number().int().nonnegative(),
  feature: z.number().int().nonnegative(),
  improvement: z.number().int().nonnegative(),
});

export type SeverityDistribution = z.infer<typeof SeverityDistributionSchema>;

// ============================================
// STORAGE SCHEMAS
// ============================================

/**
 * Screenshot upload response
 */
export const ScreenshotUploadResponseSchema = z.object({
  path: z.string(),
  fullPath: z.string(),
  id: z.string().uuid(),
});

export type ScreenshotUploadResponse = z.infer<typeof ScreenshotUploadResponseSchema>;

// ============================================
// API RESPONSE SCHEMAS
// ============================================

/**
 * Success response for feedback submission
 */
export const FeedbackSubmissionResponseSchema = z.object({
  success: z.boolean(),
  feedback_id: z.string().uuid(),
  message: z.string(),
});

export type FeedbackSubmissionResponse = z.infer<typeof FeedbackSubmissionResponseSchema>;

/**
 * Error response
 */
export const FeedbackErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});

export type FeedbackErrorResponse = z.infer<typeof FeedbackErrorResponseSchema>;

// ============================================
// TYPE GUARDS
// ============================================

export const isFeedbackSeverity = (value: unknown): value is FeedbackSeverity => {
  return FeedbackSeveritySchema.safeParse(value).success;
};

export const isFeedbackStatus = (value: unknown): value is FeedbackStatus => {
  return FeedbackStatusSchema.safeParse(value).success;
};

export const isFeedbackPlatform = (value: unknown): value is FeedbackPlatform => {
  return FeedbackPlatformSchema.safeParse(value).success;
};

// ============================================
// CONSTANTS
// ============================================

export const FEEDBACK_SEVERITY_LABELS: Record<FeedbackSeverity, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  improvement: 'Improvement',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  reviewing: 'Under Review',
  resolved: 'Resolved',
};

export const FEEDBACK_STATUS_COLORS: Record<FeedbackStatus, string> = {
  new: '#FF6B6B',      // Red for new/urgent
  reviewing: '#FFA500', // Orange for in progress
  resolved: '#4CAF50',  // Green for completed
};

export const FEEDBACK_SEVERITY_ICONS: Record<FeedbackSeverity, string> = {
  bug: '🐛',
  feature: '✨',
  improvement: '🔧',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate storage path for screenshot
 * Format: ${preschool_id}/${user_id}/${feedback_id}.jpg
 */
export const generateScreenshotPath = (
  preschoolId: string,
  userId: string,
  feedbackId: string
): string => {
  return `${preschoolId}/${userId}/${feedbackId}.jpg`;
};

/**
 * Parse storage path to extract IDs
 */
export const parseScreenshotPath = (path: string): {
  preschoolId: string;
  userId: string;
  feedbackId: string;
} | null => {
  const parts = path.split('/');
  if (parts.length !== 3) return null;
  
  const [preschoolId, userId, filenamePart] = parts;
  const feedbackId = filenamePart.replace('.jpg', '');
  
  return { preschoolId, userId, feedbackId };
};

/**
 * Validate feedback text (client-side pre-check)
 */
export const validateFeedbackText = (text: string): {
  valid: boolean;
  error?: string;
} => {
  const trimmed = text.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Feedback cannot be empty' };
  }
  
  if (trimmed.length < 10) {
    return { valid: false, error: 'Feedback must be at least 10 characters' };
  }
  
  if (trimmed.length > 5000) {
    return { valid: false, error: 'Feedback must be less than 5000 characters' };
  }
  
  return { valid: true };
};
