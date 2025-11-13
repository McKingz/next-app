/**
 * Browser Visibility Handler for Authentication State
 * 
 * Handles authentication state refresh when browser tab regains focus
 * to prevent loading states after tab switching/minimizing.
 */

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

export interface VisibilityHandlerOptions {
  onVisibilityChange?: (isVisible: boolean) => void;
  onSessionRefresh?: () => Promise<void>;
  refreshDelay?: number; // ms delay before refreshing
}

class VisibilityHandler {
  private options: VisibilityHandlerOptions;
  private refreshTimeout?: ReturnType<typeof setTimeout>;
  private lastVisibilityChange = Date.now();

  constructor(options: VisibilityHandlerOptions = {}) {
    this.options = {
      refreshDelay: 500, // 500ms delay to avoid rapid refreshes
      ...options,
    };
    
    this.initialize();
  }

  private initialize() {
    // Only initialize on web platforms
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    // Handle page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Handle window focus events as backup
    window.addEventListener('focus', this.handleWindowFocus);
    window.addEventListener('blur', this.handleWindowBlur);

    // Handle browser back/forward navigation
    window.addEventListener('pageshow', this.handlePageShow);
  }

  private handleVisibilityChange = () => {
    const isVisible = !document.hidden;
    const now = Date.now();
    
    // Track visibility changes for analytics
    track('app.visibility_change', {
      is_visible: isVisible,
      time_since_last_change: now - this.lastVisibilityChange,
      timestamp: new Date().toISOString(),
    });

    this.lastVisibilityChange = now;

    // Call the visibility change callback
    this.options.onVisibilityChange?.(isVisible);

    // If becoming visible and we have a session refresh handler
    if (isVisible && this.options.onSessionRefresh) {
      this.scheduleSessionRefresh();
    }
  };

  private handleWindowFocus = () => {
    // Secondary handler for window focus (some browsers don't fire visibilitychange reliably)
    if (this.options.onSessionRefresh) {
      this.scheduleSessionRefresh();
    }
  };

  private handleWindowBlur = () => {
    // Clear any pending refresh when window loses focus
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }
  };

  private handlePageShow = (event: unknown) => {
    // Handle browser back/forward navigation (web-only). We avoid DOM types in RN tsconfig.
    const e = event as { persisted?: boolean } | null;
    if (e?.persisted && this.options.onSessionRefresh) {
      this.scheduleSessionRefresh();
    }
  };

  private scheduleSessionRefresh = () => {
    // Clear existing timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    // Schedule refresh with delay to avoid rapid successive calls
    this.refreshTimeout = setTimeout(async () => {
      try {
        await this.options.onSessionRefresh?.();
      } catch (error) {
        console.error('Session refresh failed on visibility change:', error);
      }
    }, this.options.refreshDelay);
  };

  /**
   * Check if session is still valid
   */
  public async validateSession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await assertSupabase().auth.getSession();
      return !error && !!session;
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  }

  /**
   * Force refresh the authentication session
   */
  public async refreshSession(): Promise<void> {
    try {
      const { error } = await assertSupabase().auth.refreshSession();
      if (error) {
        throw error;
      }
      
      track('auth.session_refreshed', {
        trigger: 'visibility_handler',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to refresh session:', error);
      throw error;
    }
  }

  /**
   * Clean up event listeners
   */
  public destroy() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleWindowFocus);
      window.removeEventListener('blur', this.handleWindowBlur);
      window.removeEventListener('pageshow', this.handlePageShow);
    }
  }
}

// Singleton instance
let visibilityHandlerInstance: VisibilityHandler | null = null;

/**
 * Initialize the visibility handler with authentication refresh
 */
export function initializeVisibilityHandler(options: VisibilityHandlerOptions): VisibilityHandler {
  // Clean up existing instance
  if (visibilityHandlerInstance) {
    visibilityHandlerInstance.destroy();
  }

  visibilityHandlerInstance = new VisibilityHandler(options);
  return visibilityHandlerInstance;
}

/**
 * Get the current visibility handler instance
 */
export function getVisibilityHandler(): VisibilityHandler | null {
  return visibilityHandlerInstance;
}

/**
 * Clean up the visibility handler
 */
export function destroyVisibilityHandler(): void {
  if (visibilityHandlerInstance) {
    visibilityHandlerInstance.destroy();
    visibilityHandlerInstance = null;
  }
}