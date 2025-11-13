import { logger } from '@/lib/logger';
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import * as Updates from 'expo-updates';
import { AppState } from 'react-native';
import { trackOTAUpdateCheck, trackOTAUpdateFetch, trackOTAUpdateApply, trackOTAError } from '@/lib/otaObservability';

// Types for update state
export interface UpdateState {
  isDownloading: boolean;
  isUpdateDownloaded: boolean;
  updateError: string | null;
  lastCheckTime: Date | null;
}

export interface UpdatesContextValue extends UpdateState {
  checkForUpdates: () => Promise<boolean>;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  dismissError: () => void;
}

// Context
const UpdatesContext = createContext<UpdatesContextValue | undefined>(undefined);

// Provider component
interface UpdatesProviderProps {
  children: ReactNode;
}

export function UpdatesProvider({ children }: UpdatesProviderProps) {
  const [state, setState] = useState<UpdateState>({
    isDownloading: false,
    isUpdateDownloaded: false,
    updateError: null,
    lastCheckTime: null,
  });

  // Update state helper
  const updateState = (partial: Partial<UpdateState>) => {
    setState(prev => ({ ...prev, ...partial }));
  };

  // Check for updates manually
  const checkForUpdates = async (): Promise<boolean> => {
    if (!Updates.isEnabled) {
      logger.info('[Updates] Updates are disabled - skipping check');
      return false;
    }
    
    logger.info('[Updates] Manual update check initiated');

    try {
      updateState({ isDownloading: true, updateError: null });
      logger.info('[Updates] Checking for updates...');
      
      const update = await Updates.checkForUpdateAsync();
      logger.info('[Updates] Update check result:', { isAvailable: update.isAvailable, manifest: update.manifest?.id });
      
      // Track update check
      trackOTAUpdateCheck(update);
      
      if (update.isAvailable) {
        logger.info('[Updates] Update available, starting download...');
        // Start downloading
        const result = await Updates.fetchUpdateAsync();
        logger.info('[Updates] Update downloaded:', { isNew: result.isNew });
        
        // Track update fetch
        trackOTAUpdateFetch(result);
        // Download complete - this will also trigger the UPDATE_DOWNLOADED event
        updateState({ isDownloading: false, isUpdateDownloaded: true });
        return true;
      } else {
        logger.info('[Updates] No update available');
        updateState({ isDownloading: false, lastCheckTime: new Date() });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check for updates';
      logger.warn('[Updates] Update check failed:', errorMessage, error);
      
      // Track error
      if (error instanceof Error) {
        trackOTAError('check', error);
      }
      
      // Don't show error for common network issues in dev
      const shouldShowError = !__DEV__ || !errorMessage.includes('rejected');
      
      updateState({ 
        isDownloading: false, 
        updateError: shouldShowError ? errorMessage : null,
        lastCheckTime: new Date()
      });
      return false;
    }
  };

  // Apply the downloaded update
  const applyUpdate = async () => {
    try {
      // Track before applying (since app will restart)
      trackOTAUpdateApply();
      
      await Updates.reloadAsync();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to apply update';
      updateState({ updateError: errorMessage });
      
      // Track error
      if (error instanceof Error) {
        trackOTAError('apply', error);
      }
      
      if (__DEV__) {
        logger.warn('Update apply failed:', errorMessage);
      }
    }
  };

  // Dismiss the update banner (user chose "Later")
  const dismissUpdate = () => {
    updateState({ isUpdateDownloaded: false });
  };

  // Dismiss error messages
  const dismissError = () => {
    updateState({ updateError: null });
  };

  // Background update checking
  const backgroundCheck = useCallback(async () => {
    if (!Updates.isEnabled) {
      logger.info('[Updates] Updates disabled - skipping background check');
      return;
    }

    try {
      logger.info('[Updates] Background check for updates...');
      const update = await Updates.checkForUpdateAsync();
      logger.info('[Updates] Background check result:', { isAvailable: update.isAvailable });
      
      // Track background update check
      trackOTAUpdateCheck(update);
      
      if (update.isAvailable) {
        logger.info('[Updates] Background update available, downloading...');
        updateState({ isDownloading: true, updateError: null });
        const result = await Updates.fetchUpdateAsync();
        logger.info('[Updates] Background update downloaded:', { isNew: result.isNew });
        
        // Track background update fetch
        trackOTAUpdateFetch(result);
        updateState({ 
          isDownloading: false, 
          isUpdateDownloaded: true,
          lastCheckTime: new Date()
        });
      } else {
        logger.info('[Updates] No background update available');
        updateState({ 
          isDownloading: false, 
          lastCheckTime: new Date()
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Background update check failed';
      logger.warn('[Updates] Background update check failed:', errorMessage);
      
      // Don't set error state for background checks to avoid spam
      updateState({ 
        isDownloading: false,
        lastCheckTime: new Date()
      });
    }
  }, []);

  // Set up background checking on app state changes
  useEffect(() => {
    if (!Updates.isEnabled) {
      logger.info('[Updates] Updates disabled - skipping background setup');
      return;
    }

    // Skip automatic background checks in development (but allow preview/production)
    const environment = process.env.EXPO_PUBLIC_ENVIRONMENT;
    const enableOTAUpdates = process.env.EXPO_PUBLIC_ENABLE_OTA_UPDATES === 'true';
    
    if (__DEV__ && environment === 'development' && !enableOTAUpdates) {
      logger.info('[Updates] Skipping automatic background checks in development');
      return;
    }
    
    logger.info(`[Updates] Environment: ${environment}, OTA enabled: ${enableOTAUpdates}, DEV: ${__DEV__}`);

    // Initial background check (only in production)
    backgroundCheck();
    
    // Check on app state changes
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        backgroundCheck();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [backgroundCheck]);

  const contextValue: UpdatesContextValue = {
    ...state,
    checkForUpdates,
    applyUpdate,
    dismissUpdate,
    dismissError,
  };

  return (
    <UpdatesContext.Provider value={contextValue}>
      {children}
    </UpdatesContext.Provider>
  );
}

// Hook to use the updates context
export function useUpdates() {
  const context = useContext(UpdatesContext);
  if (context === undefined) {
    throw new Error('useUpdates must be used within an UpdatesProvider');
  }
  return context;
}