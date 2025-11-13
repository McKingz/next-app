/**
 * Web State Persistence Utility
 * 
 * Handles state persistence for web platform to maintain dashboard state
 * when navigating away and returning to the application
 */

import { Platform } from 'react-native';

interface PersistedState {
  dashboardData: any;
  navigationState: any;
  userPreferences: any;
  lastUpdated: number;
}

const WEB_STATE_KEY = 'edudash_web_state';
const STATE_EXPIRY_TIME = 1000 * 60 * 30; // 30 minutes

class WebStatePersistence {
  private isWeb = Platform.OS === 'web';
  private storage = typeof window !== 'undefined' ? window.sessionStorage : null;

  /**
   * Save state to web session storage
   */
  async saveState(key: string, data: any): Promise<void> {
    if (!this.isWeb || !this.storage) return;

    try {
      const existingState = await this.loadAllState();
      const newState = {
        ...existingState,
        [key]: {
          data,
          lastUpdated: Date.now(),
        },
      };

      this.storage.setItem(WEB_STATE_KEY, JSON.stringify(newState));
      console.log(`[WebState] Saved state for key: ${key}`);
    } catch (error) {
      console.warn('[WebState] Failed to save state:', error);
    }
  }

  /**
   * Load state from web session storage
   */
  async loadState(key: string): Promise<any | null> {
    if (!this.isWeb || !this.storage) return null;

    try {
      const allState = await this.loadAllState();
      const stateEntry = allState[key];

      if (!stateEntry) return null;

      // Check if state has expired
      const age = Date.now() - stateEntry.lastUpdated;
      if (age > STATE_EXPIRY_TIME) {
        console.log(`[WebState] State expired for key: ${key}`);
        await this.removeState(key);
        return null;
      }

      console.log(`[WebState] Loaded state for key: ${key}`);
      return stateEntry.data;
    } catch (error) {
      console.warn('[WebState] Failed to load state:', error);
      return null;
    }
  }

  /**
   * Load all persisted state
   */
  private async loadAllState(): Promise<Record<string, any>> {
    if (!this.isWeb || !this.storage) return {};

    try {
      const stored = this.storage.getItem(WEB_STATE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('[WebState] Failed to parse stored state:', error);
      return {};
    }
  }

  /**
   * Remove specific state
   */
  async removeState(key: string): Promise<void> {
    if (!this.isWeb || !this.storage) return;

    try {
      const allState = await this.loadAllState();
      delete allState[key];
      this.storage.setItem(WEB_STATE_KEY, JSON.stringify(allState));
      console.log(`[WebState] Removed state for key: ${key}`);
    } catch (error) {
      console.warn('[WebState] Failed to remove state:', error);
    }
  }

  /**
   * Clear all persisted state
   */
  async clearAllState(): Promise<void> {
    if (!this.isWeb || !this.storage) return;

    try {
      this.storage.removeItem(WEB_STATE_KEY);
      console.log('[WebState] Cleared all persisted state');
    } catch (error) {
      console.warn('[WebState] Failed to clear state:', error);
    }
  }

  /**
   * Save dashboard data specifically
   */
  async saveDashboardState(userId: string, role: string, dashboardData: any): Promise<void> {
    const key = `dashboard_${userId}_${role}`;
    await this.saveState(key, dashboardData);
  }

  /**
   * Load dashboard data specifically
   */
  async loadDashboardState(userId: string, role: string): Promise<any | null> {
    const key = `dashboard_${userId}_${role}`;
    return await this.loadState(key);
  }

  /**
   * Save navigation state
   */
  async saveNavigationState(navigationState: any): Promise<void> {
    await this.saveState('navigation', navigationState);
  }

  /**
   * Load navigation state
   */
  async loadNavigationState(): Promise<any | null> {
    return await this.loadState('navigation');
  }

  /**
   * Save user preferences (theme, settings, etc.)
   */
  async saveUserPreferences(preferences: any): Promise<void> {
    await this.saveState('user_preferences', preferences);
  }

  /**
   * Load user preferences
   */
  async loadUserPreferences(): Promise<any | null> {
    return await this.loadState('user_preferences');
  }

  /**
   * Initialize state persistence for the current session
   */
  async initializeForSession(userId: string, role: string): Promise<void> {
    if (!this.isWeb) return;

    console.log(`[WebState] Initializing for session: ${userId} (${role})`);
    
    // Set up cleanup on beforeunload
    if (typeof window !== 'undefined') {
      const handleBeforeUnload = () => {
        console.log('[WebState] Page unloading, state will be preserved');
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      
      // Clean up old expired states periodically
      this.cleanupExpiredStates();
    }
  }

  /**
   * Clean up expired states
   */
  private async cleanupExpiredStates(): Promise<void> {
    try {
      const allState = await this.loadAllState();
      const now = Date.now();
      let hasExpired = false;

      for (const [key, stateEntry] of Object.entries(allState)) {
        if (typeof stateEntry === 'object' && stateEntry && 'lastUpdated' in stateEntry) {
          const age = now - (stateEntry as any).lastUpdated;
          if (age > STATE_EXPIRY_TIME) {
            delete allState[key];
            hasExpired = true;
          }
        }
      }

      if (hasExpired && this.storage) {
        this.storage.setItem(WEB_STATE_KEY, JSON.stringify(allState));
        console.log('[WebState] Cleaned up expired states');
      }
    } catch (error) {
      console.warn('[WebState] Failed to cleanup expired states:', error);
    }
  }

  /**
   * Get state statistics for debugging
   */
  async getStateStats(): Promise<{
    totalKeys: number;
    totalSize: number;
    oldestEntry: number;
    newestEntry: number;
  }> {
    const allState = await this.loadAllState();
    const keys = Object.keys(allState);
    const now = Date.now();
    
    let oldestEntry = now;
    let newestEntry = 0;
    
    for (const stateEntry of Object.values(allState)) {
      if (typeof stateEntry === 'object' && stateEntry && 'lastUpdated' in stateEntry) {
        const timestamp = (stateEntry as any).lastUpdated;
        if (timestamp < oldestEntry) oldestEntry = timestamp;
        if (timestamp > newestEntry) newestEntry = timestamp;
      }
    }

    const totalSize = this.storage?.getItem(WEB_STATE_KEY)?.length || 0;

    return {
      totalKeys: keys.length,
      totalSize,
      oldestEntry: oldestEntry === now ? 0 : oldestEntry,
      newestEntry,
    };
  }
}

// Export singleton instance
export const webStatePersistence = new WebStatePersistence();

// Export helper hooks for React components
export function useWebStatePersistence() {
  return {
    saveState: webStatePersistence.saveState.bind(webStatePersistence),
    loadState: webStatePersistence.loadState.bind(webStatePersistence),
    saveDashboardState: webStatePersistence.saveDashboardState.bind(webStatePersistence),
    loadDashboardState: webStatePersistence.loadDashboardState.bind(webStatePersistence),
    saveNavigationState: webStatePersistence.saveNavigationState.bind(webStatePersistence),
    loadNavigationState: webStatePersistence.loadNavigationState.bind(webStatePersistence),
    clearAllState: webStatePersistence.clearAllState.bind(webStatePersistence),
  };
}