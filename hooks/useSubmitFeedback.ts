/**
 * useSubmitFeedback Hook
 * 
 * TanStack Query v5 mutation for feedback submission.
 * Handles device metadata collection and screenshot upload.
 * 
 * Documentation Sources:
 * - TanStack Query v5: https://tanstack.com/query/v5/docs/framework/react/guides/mutations
 * - Expo Device: https://docs.expo.dev/versions/v53.0.0/sdk/device/
 * - Expo Application: https://docs.expo.dev/versions/v53.0.0/sdk/application/
 * 
 * WARP.md Compliance:
 * - TanStack Query v5 imports (@tanstack/react-query, not react-query)
 * - Query keys include preschoolId
 * - File size: ≤200 lines
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Platform, Dimensions } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Localization from 'expo-localization';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { submitFeedbackWithScreenshot } from '@/services/feedback.service';
import type {
  DeviceInfo,
  InsertFeedbackPayload,
} from '@/types/feedback.types';

// ============================================
// DEVICE METADATA COLLECTION
// ============================================

/**
 * Collect device metadata for debugging
 */
function collectDeviceMetadata(): DeviceInfo {
  const { width, height } = Dimensions.get('screen');
  
  return {
    // Device hardware
    brand: Device.brand || undefined,
    modelName: Device.modelName || undefined,
    deviceType: Device.deviceType ? String(Device.deviceType) : undefined,
    
    // Operating system
    osVersion: Device.osVersion || undefined,
    osInternalBuildId: Device.osInternalBuildId || undefined,
    platform: Platform.OS,
    
    // Application version
    appVersion: Constants.expoConfig?.version || undefined,
    nativeApplicationVersion: Application.nativeApplicationVersion || undefined,
    nativeBuildVersion: Application.nativeBuildVersion || undefined,
    
    // Localization
    locale: Localization.getLocales?.()?.[0]?.languageTag || 'en',
    timezone: Localization.getCalendars?.()?.[0]?.timeZone || 'UTC',
    
    // Screen dimensions
    screenWidth: width,
    screenHeight: height,
  };
}

// ============================================
// MUTATION INPUT/OUTPUT TYPES
// ============================================

export interface SubmitFeedbackInput {
  feedback_text: string;
  severity: 'bug' | 'feature' | 'improvement';
  screenshotUri?: string; // Optional local file URI
}

export interface SubmitFeedbackResult {
  feedbackId: string;
  success: boolean;
}

// ============================================
// HOOK: useSubmitFeedback
// ============================================

/**
 * TanStack Query mutation for submitting feedback
 * Automatically collects device metadata and handles screenshot upload
 */
export function useSubmitFeedback() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const supabase = assertSupabase();

  return useMutation<SubmitFeedbackResult, Error, SubmitFeedbackInput>({
    mutationKey: ['submitFeedback'],
    
    mutationFn: async (input: SubmitFeedbackInput) => {
      // Validation
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      if (!profile?.organization_id) {
        throw new Error('User has no preschool association');
      }

      // Collect device metadata
      const deviceInfo = collectDeviceMetadata();

      // Build insert payload
      const payload: InsertFeedbackPayload = {
        preschool_id: profile.organization_id,
        user_id: user.id,
        feedback_text: input.feedback_text.trim(),
        severity: input.severity,
        status: 'new',
        device_info: deviceInfo,
        app_version: deviceInfo.appVersion || null,
        platform: Platform.OS as 'android' | 'ios' | 'web',
      };

      // Submit feedback with optional screenshot
      const feedbackId = await submitFeedbackWithScreenshot(
        supabase,
        payload,
        input.screenshotUri
      );

      return {
        feedbackId,
        success: true,
      };
    },

    onSuccess: (data) => {
      // Invalidate feedback queries to refresh lists
      if (profile?.organization_id) {
        queryClient.invalidateQueries({
          queryKey: ['feedback', profile.organization_id],
        });
      }
      
      // Invalidate feedback counts
      queryClient.invalidateQueries({
        queryKey: ['feedbackCounts'],
      });

      // Log success in dev mode
      if (__DEV__) {
        console.log('[useSubmitFeedback] Success:', data.feedbackId);
      }
    },

    onError: (error) => {
      // Log error in dev mode
      if (__DEV__) {
        console.error('[useSubmitFeedback] Error:', error);
      }
    },

    // Retry configuration
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// ============================================
// QUERY KEY FACTORY
// ============================================

/**
 * Centralized query key factory for feedback queries
 * Ensures consistency across the app
 */
export const feedbackKeys = {
  all: ['feedback'] as const,
  lists: () => [...feedbackKeys.all, 'list'] as const,
  list: (preschoolId: string, filters?: any) =>
    [...feedbackKeys.lists(), preschoolId, filters] as const,
  details: () => [...feedbackKeys.all, 'detail'] as const,
  detail: (id: string) => [...feedbackKeys.details(), id] as const,
  counts: () => [...feedbackKeys.all, 'counts'] as const,
  countsByPreschool: (preschoolId: string) =>
    [...feedbackKeys.counts(), preschoolId] as const,
};
