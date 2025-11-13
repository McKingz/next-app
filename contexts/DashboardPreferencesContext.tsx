import { logger } from '@/lib/logger';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DashboardLayoutType = 'classic' | 'enhanced';

interface DashboardPreferences {
  layout: DashboardLayoutType;
  autoRefresh: boolean;
  showQuickActions: boolean;
  compactMode: boolean;
  animationsEnabled: boolean;
}

interface DashboardPreferencesContextType {
  preferences: DashboardPreferences;
  setLayout: (layout: DashboardLayoutType) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setShowQuickActions: (enabled: boolean) => void;
  setCompactMode: (enabled: boolean) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  resetToDefaults: () => void;
  isLoading: boolean;
}

const defaultPreferences: DashboardPreferences = {
  layout: 'classic',
  autoRefresh: true,
  showQuickActions: true,
  compactMode: false,
  animationsEnabled: true,
};

const DashboardPreferencesContext = createContext<DashboardPreferencesContextType | null>(null);

export const useDashboardPreferences = () => {
  const context = useContext(DashboardPreferencesContext);
  if (!context) {
    throw new Error('useDashboardPreferences must be used within a DashboardPreferencesProvider');
  }
  return context;
};

interface DashboardPreferencesProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = '@dashboard_preferences';

export const DashboardPreferencesProvider: React.FC<DashboardPreferencesProviderProps> = ({ children }) => {
  const [preferences, setPreferences] = useState<DashboardPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from storage on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DashboardPreferences;
        setPreferences({ ...defaultPreferences, ...parsed });
        logger.info('📋 Dashboard preferences loaded:', parsed);
      } else {
        logger.info('📋 No stored dashboard preferences, using defaults');
      }
    } catch (error) {
      console.error('Failed to load dashboard preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async (newPreferences: DashboardPreferences) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
      logger.info('💾 Dashboard preferences saved:', newPreferences);
    } catch (error) {
      console.error('Failed to save dashboard preferences:', error);
    }
  };

  const updatePreferences = (updates: Partial<DashboardPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const setLayout = (layout: DashboardLayoutType) => {
    updatePreferences({ layout });
  };

  const setAutoRefresh = (autoRefresh: boolean) => {
    updatePreferences({ autoRefresh });
  };

  const setShowQuickActions = (showQuickActions: boolean) => {
    updatePreferences({ showQuickActions });
  };

  const setCompactMode = (compactMode: boolean) => {
    updatePreferences({ compactMode });
  };

  const setAnimationsEnabled = (animationsEnabled: boolean) => {
    updatePreferences({ animationsEnabled });
  };

  const resetToDefaults = async () => {
    setPreferences(defaultPreferences);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      logger.info('🔄 Dashboard preferences reset to defaults');
    } catch (error) {
      console.error('Failed to reset dashboard preferences:', error);
    }
  };

  const contextValue: DashboardPreferencesContextType = {
    preferences,
    setLayout,
    setAutoRefresh,
    setShowQuickActions,
    setCompactMode,
    setAnimationsEnabled,
    resetToDefaults,
    isLoading,
  };

  return (
    <DashboardPreferencesContext.Provider value={contextValue}>
      {children}
    </DashboardPreferencesContext.Provider>
  );
};