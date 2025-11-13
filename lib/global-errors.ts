/**
 * Global error handling setup
 * 
 * Captures unhandled JavaScript errors and routes them through our
 * logging system for consistent error reporting and monitoring.
 */

import { logger } from './logger';

/**
 * Install global error handler that captures unhandled errors
 * and routes them through our logging system
 */
export function installGlobalErrorHandler() {
  // React Native specific global error handling
  if (typeof global !== 'undefined' && (global as any).ErrorUtils) {
    const defaultHandler = (global as any).ErrorUtils.getGlobalHandler?.();
    (global as any).ErrorUtils.setGlobalHandler?.((error: any, isFatal: any) => {
      // Always log critical unhandled errors
      logger.forceError('Unhandled JavaScript error', {
        message: error?.message || String(error),
        stack: error?.stack || 'No stack trace available',
        isFatal: Boolean(isFatal),
        timestamp: new Date().toISOString(),
      });

      // Call the default handler to preserve existing behavior
      if (defaultHandler) {
        defaultHandler(error, isFatal);
      }
    });
  }

  // Web-only error handling (skip in React Native)
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('error', (event) => {
      logger.forceError('Unhandled window error', {
        message: event.error?.message || event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: new Date().toISOString(),
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      logger.forceError('Unhandled promise rejection', {
        reason: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: new Date().toISOString(),
      });
    });
  }
}

/**
 * Enhanced error boundary error handler
 */
export function handleComponentError(error: Error, errorInfo: { componentStack: string }) {
  logger.forceError('React component error', {
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async error wrapper that ensures errors are logged
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return ((...args: Parameters<T>) => {
    return Promise.resolve(fn(...args)).catch((error) => {
      logger.error(`Error in ${context || 'async operation'}`, {
        message: error?.message || String(error),
        stack: error?.stack,
        args: args.length > 0 ? '(args provided)' : '(no args)',
        timestamp: new Date().toISOString(),
      });
      throw error; // Re-throw to preserve error handling behavior
    });
  }) as T;
}

/**
 * Safe async operation that logs errors but doesn't throw
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.warn(`Safe async operation failed: ${context || 'unknown'}`, {
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    return fallback;
  }
}

export default installGlobalErrorHandler;