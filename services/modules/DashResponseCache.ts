/**
 * DashResponseCache - Simple response caching for AI responses
 * Helps reduce API calls and improve response time
 */

interface CacheEntry {
  response: string;
  timestamp: number;
  hits: number;
}

interface CacheContext {
  role?: string;
  language?: string;
  [key: string]: any;
}

export class DashResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize = 100;
  private readonly ttlMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate cache key from input and context
   */
  private getCacheKey(input: string, context?: CacheContext): string {
    const normalizedInput = input.toLowerCase().trim();
    const contextKey = context
      ? `${context.role || ''}_${context.language || ''}`
      : '';
    return `${normalizedInput}::${contextKey}`;
  }

  /**
   * Get cached response if available and not expired
   */
  getCachedResponse(input: string, context?: CacheContext): string | null {
    const key = this.getCacheKey(input, context);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    entry.hits++;
    return entry.response;
  }

  /**
   * Cache a response
   */
  cacheResponse(input: string, response: string, context?: CacheContext): void {
    const key = this.getCacheKey(input, context);

    // Check size limit
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Clear all cached responses
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// Export singleton instance
const responseCache = new DashResponseCache();
export default responseCache;
