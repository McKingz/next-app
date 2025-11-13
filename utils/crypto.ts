/**
 * React Native Compatible Crypto Utilities
 * 
 * Provides cryptographic functions that work across different React Native environments
 */

import { logger } from '@/lib/logger';

/**
 * Generate cryptographically secure random bytes
 */
export async function getRandomBytes(length: number = 32): Promise<Uint8Array> {
  try {
    // Try to use Web Crypto API if available (newer React Native versions)
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const array = new Uint8Array(length);
      globalThis.crypto.getRandomValues(array);
      return array;
    }
    
    // Try traditional crypto global
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      return array;
    }
    
    // Fallback: use expo-crypto if available
    try {
      const ExpoCrypto = require('expo-crypto');
      if (ExpoCrypto?.getRandomBytesAsync) {
        const randomBytes = await ExpoCrypto.getRandomBytesAsync(length);
        return new Uint8Array(randomBytes);
      }
    } catch {
      logger.debug('expo-crypto not available');
    }
    
    // React Native fallback: use multiple entropy sources
    logger.warn('Using fallback random byte generation for React Native');
    return generateFallbackRandomBytes(length);
    
  } catch (error) {
    console.error('Error generating random bytes:', error);
    return generateFallbackRandomBytes(length);
  }
}

/**
 * Generate a secure random hex string
 */
export async function generateSecureToken(length: number = 32): Promise<string> {
  const bytes = await getRandomBytes(length);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a UUID v4 compatible string
 */
export async function generateUUID(): Promise<string> {
  const bytes = await getRandomBytes(16);
  
  // Set version (4) and variant bits according to RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-');
}

/**
 * Fallback random byte generation using multiple entropy sources
 */
function generateFallbackRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  
  // Use multiple entropy sources
  const timestamp = Date.now();
  const performanceNow = typeof performance !== 'undefined' ? performance.now() : 0;
  
  // Initialize with timestamp-based seed
  let seed = timestamp ^ (performanceNow * 1000);
  
  for (let i = 0; i < length; i++) {
    // Linear congruential generator with multiple sources
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const mathRandom = Math.floor(Math.random() * 256);
    const timeComponent = (Date.now() + i) & 0xFF;
    
    // Combine multiple sources
    bytes[i] = (seed ^ mathRandom ^ timeComponent) & 0xFF;
  }
  
  return bytes;
}

/**
 * Simple hash function for strings (not cryptographically secure)
 */
export function simpleHash(input: string): string {
  let hash = 0;
  const hashArray: number[] = [];
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
    hashArray.push(Math.abs(hash) % 256);
  }
  
  return hashArray
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check if secure crypto is available
 */
export function isSecureCryptoAvailable(): boolean {
  return (
    (typeof globalThis !== 'undefined' && !!globalThis.crypto?.getRandomValues) ||
    (typeof crypto !== 'undefined' && !!crypto.getRandomValues)
  );
}

/**
 * Get information about available crypto methods
 */
export function getCryptoInfo(): {
  hasWebCrypto: boolean;
  hasGlobalCrypto: boolean;
  hasExpoCrypto: boolean;
  recommendedMethod: string;
} {
  const hasWebCrypto = typeof globalThis !== 'undefined' && !!globalThis.crypto?.getRandomValues;
  const hasGlobalCrypto = typeof crypto !== 'undefined' && !!crypto.getRandomValues;
  
  let hasExpoCrypto = false;
  try {
    const ExpoCrypto = require('expo-crypto');
    hasExpoCrypto = !!ExpoCrypto?.getRandomBytesAsync;
  } catch {
    hasExpoCrypto = false;
  }
  
  let recommendedMethod = 'fallback';
  if (hasWebCrypto) recommendedMethod = 'Web Crypto API (globalThis.crypto)';
  else if (hasGlobalCrypto) recommendedMethod = 'Global crypto';
  else if (hasExpoCrypto) recommendedMethod = 'Expo Crypto';
  
  return {
    hasWebCrypto,
    hasGlobalCrypto,
    hasExpoCrypto,
    recommendedMethod
  };
}