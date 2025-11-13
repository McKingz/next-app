/**
 * Debug helper for navigation issues
 * Helps identify why "Unmatched Route" errors occur
 */

import { router } from 'expo-router';

// Track navigation history for debugging
const navigationHistory: Array<{
  action: string;
  route: string;
  timestamp: number;
  stack: string;
}> = [];

function logNavigation(action: string, route: string) {
  if (__DEV__) {
    const entry = {
      action,
      route: String(route),
      timestamp: Date.now(),
      stack: new Error().stack?.split('\n').slice(0, 5).join('\n') || '',
    };
    
    navigationHistory.push(entry);
    
    // Keep only last 10 entries
    if (navigationHistory.length > 10) {
      navigationHistory.shift();
    }
    
    console.log(`[NavDebug] ${action}: ${route}`);
  }
}

export const debugRouter = {
  push(route: any) {
    logNavigation('PUSH', typeof route === 'object' ? JSON.stringify(route) : route);
    return router.push(route);
  },
  
  replace(route: any) {
    logNavigation('REPLACE', typeof route === 'object' ? JSON.stringify(route) : route);
    return router.replace(route);
  },
  
  back() {
    logNavigation('BACK', 'back()');
    return router.back();
  },
  
  canGoBack() {
    const canGo = router.canGoBack?.();
    logNavigation('CAN_GO_BACK', `${canGo}`);
    return canGo;
  },
  
  getHistory() {
    return [...navigationHistory];
  },
  
  clearHistory() {
    navigationHistory.length = 0;
  }
};

// Export function to get recent navigation history for debugging
export function getNavigationDebugInfo() {
  return {
    history: [...navigationHistory],
    canGoBack: router.canGoBack?.() ?? false,
    currentRoute: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
  };
}