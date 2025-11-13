/**
 * Production-safe logging utility
 * 
 * This module provides logging functions that automatically handle
 * development vs production environments, ensuring sensitive debugging
 * information is never exposed to users in production builds.
 */

const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;
const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

/**
 * Log levels for controlling output
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Current log level (can be configured via environment)
 */
const currentLogLevel = isDevelopment 
  ? LogLevel.DEBUG 
  : isTest 
    ? LogLevel.WARN 
    : LogLevel.NONE;

/**
 * Production-safe logger that only outputs in development
 */
export const logger = {
  /**
   * Debug logging - only shown in development
   */
  debug: (message: string, ...args: any[]) => {
    if (currentLogLevel <= LogLevel.DEBUG && isDevelopment) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info logging - only shown in development
   */
  info: (message: string, ...args: any[]) => {
    if (currentLogLevel <= LogLevel.INFO && isDevelopment) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Log alias for info (for compatibility)
   */
  log: (message: string, ...args: any[]) => {
    if (currentLogLevel <= LogLevel.INFO && isDevelopment) {
      console.log(`[LOG] ${message}`, ...args);
    }
  },

  /**
   * Warning logging - shown in development and tests
   */
  warn: (message: string, ...args: any[]) => {
    if (currentLogLevel <= LogLevel.WARN && (isDevelopment || isTest)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  /**
   * Error logging - shown in development and tests
   * In production, errors should be handled gracefully without logging
   */
  error: (message: string, ...args: any[]) => {
    if (currentLogLevel <= LogLevel.ERROR && (isDevelopment || isTest)) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },

  /**
   * Force logging even in production (use sparingly for critical errors)
   * This should only be used for errors that need to be reported to crash analytics
   */
  forceError: (message: string, ...args: any[]) => {
    console.error(`[CRITICAL] ${message}`, ...args);
    
    // Also report to Sentry if available
    try {
      // Lazy import to avoid circular dependencies
      import('./monitoring').then(({ reportError }) => {
        const error = args[0] instanceof Error ? args[0] : new Error(message);
        const context = args.length > 1 ? { additionalData: args.slice(1) } : undefined;
        reportError(error, context);
      }).catch(() => {
        // Monitoring not available, ignore
      });
    } catch {
      // Silently fail if monitoring is not available
    }
  },
};

/**
 * Safe error handler that shows user-friendly messages in production
 */
export const handleError = (error: any, userMessage?: string): string => {
  if (isDevelopment || isTest) {
    // Development: show detailed error information
    logger.error('Error occurred:', error);
    return error?.message || 'An error occurred';
  } else {
    // Production: show user-friendly message and optionally report to analytics
    const safeMessage = userMessage || 'Something went wrong. Please try again.';
    
    // TODO: Report to crash analytics (Sentry, Crashlytics, etc.)
    // crashlytics().recordError(error);
    
    return safeMessage;
  }
};

/**
 * Development-only assertion
 */
export const devAssert = (condition: boolean, message: string) => {
  if (isDevelopment && !condition) {
    throw new Error(`[DEV ASSERTION FAILED] ${message}`);
  }
};

/**
 * Development-only performance timing
 */
export const perfTimer = {
  start: (label: string): (() => void) | undefined => {
    if (!isDevelopment) return undefined;
    
    const startTime = performance.now();
    console.time(label);
    
    return () => {
      const endTime = performance.now();
      console.timeEnd(label);
      logger.debug(`Performance: ${label} took ${endTime - startTime}ms`);
    };
  }
};

export default logger;