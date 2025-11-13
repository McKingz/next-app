import { useState, useCallback } from 'react';
import { track } from '@/lib/analytics';

interface UsePullToRefreshOptions {
  /**
   * Function to call when refresh is triggered
   */
  onRefresh: () => Promise<void> | void;
  
  /**
   * Screen name for analytics tracking
   */
  screenName?: string;
  
  /**
   * Minimum refresh duration in milliseconds
   * Prevents refresh from completing too quickly
   */
  minDuration?: number;
  
  /**
   * Custom loading message to track
   */
  loadingMessage?: string;
}

interface UsePullToRefreshReturn {
  /**
   * Whether refresh is currently active
   */
  refreshing: boolean;
  
  /**
   * Function to trigger refresh manually
   */
  triggerRefresh: () => Promise<void>;
  
  /**
   * Refresh function to pass to RefreshControl
   */
  onRefreshHandler: () => void;
}

/**
 * Custom hook for consistent pull-to-refresh functionality across all screens
 * 
 * Features:
 * - Analytics tracking for all refresh events
 * - Minimum refresh duration to prevent jarring UX
 * - Error handling with proper cleanup
 * - Support for both async and sync refresh functions
 * 
 * @param options Configuration options for the hook
 * @returns Object with refreshing state and handlers
 */
export const usePullToRefresh = ({
  onRefresh,
  screenName = 'unknown_screen',
  minDuration = 800,
  loadingMessage = 'Refreshing content...'
}: UsePullToRefreshOptions): UsePullToRefreshReturn => {
  const [refreshing, setRefreshing] = useState(false);

  const triggerRefresh = useCallback(async () => {
    if (refreshing) return; // Prevent multiple simultaneous refreshes

    try {
      setRefreshing(true);
      
      // Track refresh start
      track('edudash.ui.pull_to_refresh_started', {
        screen: screenName,
        timestamp: new Date().toISOString(),
      });

      const startTime = Date.now();

      // Execute the refresh function
      await Promise.resolve(onRefresh());

      // Ensure minimum duration for better UX
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDuration - elapsed);
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      // Track successful refresh
      track('edudash.ui.pull_to_refresh_completed', {
        screen: screenName,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      // Track refresh error
      track('edudash.ui.pull_to_refresh_failed', {
        screen: screenName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });

      console.error(`Pull-to-refresh failed on ${screenName}:`, error);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, screenName, minDuration, refreshing]);

  const onRefreshHandler = useCallback(() => {
    // Fire and forget for RefreshControl
    triggerRefresh().catch(console.error);
  }, [triggerRefresh]);

  return {
    refreshing,
    triggerRefresh,
    onRefreshHandler,
  };
};

/**
 * Lightweight version of the hook for simple use cases
 * Uses default options with just the refresh function
 */
export const useSimplePullToRefresh = (
  onRefresh: () => Promise<void> | void,
  screenName?: string
) => {
  return usePullToRefresh({
    onRefresh,
    screenName,
  });
};

export default usePullToRefresh;