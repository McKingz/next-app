/*
 * DEPRECATED: Use @/lib/logger instead
 * 
 * This module now re-exports logger methods to maintain compatibility
 * while ensuring all logging goes through a single, consistent system.
 */

import { logger } from './logger';

export type LogFn = (...args: any[]) => void;

// Re-export logger methods for backward compatibility
export const log: LogFn = (message: string, ...args: any[]) => logger.info(message, ...args);
export const warn: LogFn = (message: string, ...args: any[]) => logger.warn(message, ...args);
export const debug: LogFn = (message: string, ...args: any[]) => logger.debug(message, ...args);
export const error: LogFn = (message: string, ...args: any[]) => logger.error(message, ...args);

// Optional: helper to safely stringify objects without throwing
export function safeJson(value: any, space: number = 2): string {
  try {
    return JSON.stringify(value, null, space);
  } catch {
    return String(value);
  }
}

// Re-export the main logger as default
export { logger as default } from './logger';
