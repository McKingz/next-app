// ================================================
// Profile Settings React Query Hooks
// TanStack Query hooks for managing invoice notification preferences
// ================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ProfileSettingsService from '@/lib/services/profileSettingsService';
import type { 
  UpdateInvoiceNotificationPreferencesRequest,
  TestNotificationRequest 
} from '@/lib/types/profile';

// Query keys for consistent caching
const SETTINGS_KEYS = {
  notificationSettings: ['invoice-notification-settings'] as const,
  userRole: ['user-role'] as const,
  storageStatus: ['signature-storage-status'] as const,
};

// ================================================
// Notification Settings Hooks
// ================================================

/**
 * Hook to fetch current user's invoice notification settings and signature
 */
export function useInvoiceNotificationSettings() {
  return useQuery({
    queryKey: SETTINGS_KEYS.notificationSettings,
    queryFn: () => ProfileSettingsService.getInvoiceNotificationSettings(),
    staleTime: 60_000, // 1 minute
    retry: 2,
  });
}

/**
 * Hook to update invoice notification preferences
 */
export function useUpdateInvoiceNotificationSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (req: UpdateInvoiceNotificationPreferencesRequest) =>
      ProfileSettingsService.updateInvoiceNotificationPreferences(req),
    onSuccess: () => {
      // Invalidate and refetch settings
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.notificationSettings });
    },
    onError: (error) => {
      console.error('Failed to update notification preferences:', error);
    },
  });
}

// ================================================
// Signature Management Hooks
// ================================================

/**
 * Hook to upload a digital signature
 */
export function useSignatureUpload() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (uri: string) => ProfileSettingsService.uploadSignature(uri),
    onSuccess: () => {
      // Invalidate settings to refresh signature info
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.notificationSettings });
    },
    onError: (error) => {
      console.error('Failed to upload signature:', error);
    },
  });
}

/**
 * Hook to delete user's digital signature
 */
export function useSignatureDelete() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => ProfileSettingsService.deleteSignature(),
    onSuccess: () => {
      // Invalidate settings to refresh signature info
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.notificationSettings });
    },
    onError: (error) => {
      console.error('Failed to delete signature:', error);
    },
  });
}

// ================================================
// Test Notification Hook
// ================================================

/**
 * Hook to send test notifications
 */
export function useTestNotification() {
  return useMutation({
    mutationFn: (req: TestNotificationRequest) =>
      ProfileSettingsService.sendTestNotification(req),
    onError: (error) => {
      console.error('Failed to send test notification:', error);
    },
  });
}

// ================================================
// User Role Hook
// ================================================

/**
 * Hook to get current user's role for UI customization
 */
export function useUserRole() {
  return useQuery({
    queryKey: SETTINGS_KEYS.userRole,
    queryFn: () => ProfileSettingsService.getUserRole(),
    staleTime: 5 * 60_000, // 5 minutes - role doesn't change often
    retry: 1,
  });
}

// ================================================
// Storage Status Hook
// ================================================

/**
 * Hook to check signature storage availability
 */
export function useSignatureStorageStatus() {
  return useQuery({
    queryKey: SETTINGS_KEYS.storageStatus,
    queryFn: () => ProfileSettingsService.checkSignatureStorageStatus(),
    staleTime: 2 * 60_000, // 2 minutes
    retry: 1,
  });
}

// ================================================
// Utility Hooks
// ================================================

/**
 * Hook to get loading states for all settings operations
 */
export function useSettingsLoadingStates() {
  const settingsQuery = useInvoiceNotificationSettings();
  const roleQuery = useUserRole();
  const storageQuery = useSignatureStorageStatus();
  
  return {
    isLoadingSettings: settingsQuery.isLoading,
    isLoadingRole: roleQuery.isLoading,
    isLoadingStorage: storageQuery.isLoading,
    isLoadingAny: settingsQuery.isLoading || roleQuery.isLoading || storageQuery.isLoading,
  };
}

/**
 * Hook to get error states for all settings operations
 */
export function useSettingsErrorStates() {
  const settingsQuery = useInvoiceNotificationSettings();
  const roleQuery = useUserRole();
  const storageQuery = useSignatureStorageStatus();
  
  return {
    settingsError: settingsQuery.error,
    roleError: roleQuery.error,
    storageError: storageQuery.error,
    hasAnyError: !!(settingsQuery.error || roleQuery.error || storageQuery.error),
  };
}

// ================================================
// Optimistic Updates Helper
// ================================================

/**
 * Hook for optimistic updates to preferences
 */
export function useOptimisticPreferencesUpdate() {
  const queryClient = useQueryClient();
  const updateMutation = useUpdateInvoiceNotificationSettings();
  
  const updateWithOptimistic = (req: UpdateInvoiceNotificationPreferencesRequest) => {
    // Get current settings
    const currentData = queryClient.getQueryData(SETTINGS_KEYS.notificationSettings);
    
    if (currentData) {
      // Optimistically update the cache
      queryClient.setQueryData(SETTINGS_KEYS.notificationSettings, (old: any) => {
        if (!old) return old;
        
        return {
          ...old,
          preferences: {
            ...old.preferences,
            ...req.preferences,
            // Handle nested updates for events and channels
            ...(req.preferences.events && {
              events: {
                ...old.preferences.events,
                ...req.preferences.events,
              },
            }),
            ...(req.preferences.channels && {
              channels: {
                ...old.preferences.channels,
                ...req.preferences.channels,
              },
            }),
            ...(req.preferences.digest && {
              digest: {
                ...old.preferences.digest,
                ...req.preferences.digest,
              },
            }),
          },
        };
      });
    }
    
    // Perform the actual update
    return updateMutation.mutate(req, {
      onError: () => {
        // Revert optimistic update on error
        queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.notificationSettings });
      },
    });
  };
  
  return {
    updateWithOptimistic,
    ...updateMutation,
  };
}