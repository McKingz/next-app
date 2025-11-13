/**
 * Offline Cache Service
 * 
 * Provides persistent caching of dashboard data using AsyncStorage
 * for fast startup and offline viewing capabilities.
 * 
 * Designed with Principal -> Teacher -> Parent hierarchy in mind:
 * - Principals see school-wide cached data
 * - Teachers see class-specific cached data 
 * - Parents see student-specific cached data
 */

let AsyncStorage: any;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; }
catch { AsyncStorage = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, getAllKeys: async () => [], multiRemove: async () => {} }; }
import { track } from '@/lib/analytics';

// Cache keys for different data types
const CACHE_KEYS = {
  PRINCIPAL_DASHBOARD: 'principal_dashboard_',
  TEACHER_DASHBOARD: 'teacher_dashboard_',
  PARENT_DASHBOARD: 'parent_dashboard_',
  SCHOOL_METRICS: 'school_metrics_',
  CLASS_DATA: 'class_data_',
  STUDENT_DATA: 'student_data_',
  ACTIVITY_FEED: 'activity_feed_',
  MEETING_ROOMS: 'meeting_rooms_',
  ASSIGNMENTS: 'assignments_',
  ANNOUNCEMENTS: 'announcements_',
} as const;

// Cache expiry times (in milliseconds)
const CACHE_EXPIRY = {
  DASHBOARD_DATA: 5 * 60 * 1000, // 5 minutes
  METRICS: 10 * 60 * 1000, // 10 minutes
  ACTIVITY_FEED: 2 * 60 * 1000, // 2 minutes
  STATIC_DATA: 60 * 60 * 1000, // 1 hour
} as const;
void CACHE_EXPIRY;

interface CacheItem<T> {
  data: T;
  timestamp: number;
  userId: string;
  schoolId?: string;
  version: string;
}

interface CacheMetadata {
  key: string;
  size: number;
  lastAccessed: number;
  hitCount: number;
}

class OfflineCacheService {
  private readonly version = '1.0.0';
  private readonly maxCacheSize = 10 * 1024 * 1024; // 10MB
  private cacheMetrics: Map<string, CacheMetadata> = new Map();

  /**
   * Store data in cache with expiry and metadata
   */
  async set<T>(
    keyPrefix: string,
    identifier: string,
    data: T,
    userId: string,
    schoolId?: string
  ): Promise<void> {
    try {
      const fullKey = `${keyPrefix}${identifier}`;
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        userId,
        schoolId,
        version: this.version,
      };

      const serialized = JSON.stringify(cacheItem);
      await AsyncStorage.setItem(fullKey, serialized);

      // Update metadata
      this.updateCacheMetadata(fullKey, serialized.length);

      // Clean up if cache is getting too large
      await this.cleanupIfNeeded();

      track('cache.data_stored', {
        key: keyPrefix,
        size: serialized.length,
        userId,
        schoolId,
      });
    } catch (error) {
      console.error('Failed to cache data:', error);
      track('cache.storage_error', {
        key: keyPrefix,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get data from cache if valid and not expired
   */
  async get<T>(
    keyPrefix: string,
    identifier: string,
    userId: string,
    customExpiry?: number
  ): Promise<T | null> {
    try {
      const fullKey = `${keyPrefix}${identifier}`;
      const cached = await AsyncStorage.getItem(fullKey);

      if (!cached) {
        return null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(cached);

      // Check version compatibility
      if (cacheItem.version !== this.version) {
        await this.remove(keyPrefix, identifier);
        return null;
      }

      // Check user ownership
      if (cacheItem.userId !== userId) {
        await this.remove(keyPrefix, identifier);
        return null;
      }

      // Check expiry
      const expiry = customExpiry || this.getDefaultExpiry(keyPrefix);
      const isExpired = Date.now() - cacheItem.timestamp > expiry;

      if (isExpired) {
        await this.remove(keyPrefix, identifier);
        return null;
      }

      // Update metadata for cache hit
      this.recordCacheHit(fullKey);

      track('cache.data_retrieved', {
        key: keyPrefix,
        age: Date.now() - cacheItem.timestamp,
        userId,
        schoolId: cacheItem.schoolId,
      });

      return cacheItem.data;
    } catch (error) {
      console.error('Failed to retrieve cached data:', error);
      return null;
    }
  }

  /**
   * Remove specific cache entry
   */
  async remove(keyPrefix: string, identifier: string): Promise<void> {
    try {
      const fullKey = `${keyPrefix}${identifier}`;
      await AsyncStorage.removeItem(fullKey);
      this.cacheMetrics.delete(fullKey);
    } catch (error) {
      console.error('Failed to remove cached data:', error);
    }
  }

  /**
   * Clear all cache for a specific user
   */
  async clearUserCache(userId: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const userKeys = [];

      // Check each key to see if it belongs to this user
      for (const key of allKeys) {
        if (this.isCacheKey(key)) {
          const cached = await AsyncStorage.getItem(key);
          if (cached) {
            const cacheItem: CacheItem<any> = JSON.parse(cached);
            if (cacheItem.userId === userId) {
              userKeys.push(key);
            }
          }
        }
      }

      // Remove all user keys
      if (userKeys.length > 0) {
        await AsyncStorage.multiRemove(userKeys);
        userKeys.forEach(key => this.cacheMetrics.delete(key));
      }

      track('cache.user_cleared', {
        userId,
        keysCleared: userKeys.length,
      });
    } catch (error) {
      console.error('Failed to clear user cache:', error);
    }
  }

  /**
   * Clear all cache for a specific school (Principal action)
   */
  async clearSchoolCache(schoolId: string, userId: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const schoolKeys = [];

      // Check each key to see if it belongs to this school
      for (const key of allKeys) {
        if (this.isCacheKey(key)) {
          const cached = await AsyncStorage.getItem(key);
          if (cached) {
            const cacheItem: CacheItem<any> = JSON.parse(cached);
            if (cacheItem.schoolId === schoolId) {
              schoolKeys.push(key);
            }
          }
        }
      }

      // Remove all school keys
      if (schoolKeys.length > 0) {
        await AsyncStorage.multiRemove(schoolKeys);
        schoolKeys.forEach(key => this.cacheMetrics.delete(key));
      }

      track('cache.school_cleared', {
        schoolId,
        userId,
        keysCleared: schoolKeys.length,
      });
    } catch (error) {
      console.error('Failed to clear school cache:', error);
    }
  }

  /**
   * Get cache statistics for debugging/monitoring
   */
  async getCacheStats(): Promise<{
    totalSize: number;
    entryCount: number;
    oldestEntry: number;
    newestEntry: number;
    hitRate: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((key: string) => this.isCacheKey(key));
      
      let totalSize = 0;
      let oldestTimestamp = Date.now();
      let newestTimestamp = 0;
      let totalHits = 0;
      let totalAccesses = 0;

      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          totalSize += cached.length;
          const cacheItem: CacheItem<any> = JSON.parse(cached);
          oldestTimestamp = Math.min(oldestTimestamp, cacheItem.timestamp);
          newestTimestamp = Math.max(newestTimestamp, cacheItem.timestamp);
        }

        const metadata = this.cacheMetrics.get(key);
        if (metadata) {
          totalHits += metadata.hitCount;
          totalAccesses += metadata.hitCount + 1; // +1 for initial store
        }
      }

      return {
        totalSize,
        entryCount: cacheKeys.length,
        oldestEntry: oldestTimestamp,
        newestEntry: newestTimestamp,
        hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalSize: 0,
        entryCount: 0,
        oldestEntry: 0,
        newestEntry: 0,
        hitRate: 0,
      };
    }
  }

  /**
   * Principal Dashboard specific caching methods
   */
  async cachePrincipalDashboard(
    userId: string,
    schoolId: string,
    data: any
  ): Promise<void> {
    await this.set(
      CACHE_KEYS.PRINCIPAL_DASHBOARD,
      `${schoolId}_${userId}`,
      data,
      userId,
      schoolId
    );
  }

  async getPrincipalDashboard(
    userId: string,
    schoolId: string
  ): Promise<any | null> {
    return this.get(
      CACHE_KEYS.PRINCIPAL_DASHBOARD,
      `${schoolId}_${userId}`,
      userId,
      CACHE_EXPIRY.DASHBOARD_DATA
    );
  }

  /**
   * Teacher Dashboard specific caching methods
   */
  async cacheTeacherDashboard(
    userId: string,
    schoolId: string,
    data: any
  ): Promise<void> {
    await this.set(
      CACHE_KEYS.TEACHER_DASHBOARD,
      `${schoolId}_${userId}`,
      data,
      userId,
      schoolId
    );
  }

  async getTeacherDashboard(
    userId: string,
    schoolId: string
  ): Promise<any | null> {
    return this.get(
      CACHE_KEYS.TEACHER_DASHBOARD,
      `${schoolId}_${userId}`,
      userId,
      CACHE_EXPIRY.DASHBOARD_DATA
    );
  }

  /**
   * Parent Dashboard specific caching methods
   */
  async cacheParentDashboard(
    userId: string,
    data: any
  ): Promise<void> {
    await this.set(
      CACHE_KEYS.PARENT_DASHBOARD,
      userId,
      data,
      userId,
      undefined
    );
  }

  async getParentDashboard(userId: string): Promise<any | null> {
    return this.get(
      CACHE_KEYS.PARENT_DASHBOARD,
      userId,
      userId,
      CACHE_EXPIRY.DASHBOARD_DATA
    );
  }

  /**
   * Activity Feed caching (school-wide for Principal, class-specific for Teacher)
   */
  async cacheActivityFeed(
    schoolId: string,
    userId: string,
    activities: any[],
    scope: 'school' | 'class' = 'school'
  ): Promise<void> {
    const identifier = scope === 'school' ? schoolId : `${schoolId}_${userId}`;
    await this.set(
      CACHE_KEYS.ACTIVITY_FEED,
      identifier,
      activities,
      userId,
      schoolId
    );
  }

  async getActivityFeed(
    schoolId: string,
    userId: string,
    scope: 'school' | 'class' = 'school'
  ): Promise<any[] | null> {
    const identifier = scope === 'school' ? schoolId : `${schoolId}_${userId}`;
    return this.get(
      CACHE_KEYS.ACTIVITY_FEED,
      identifier,
      userId,
      CACHE_EXPIRY.ACTIVITY_FEED
    );
  }

  // Private helper methods
  private isCacheKey(key: string): boolean {
    return Object.values(CACHE_KEYS).some(prefix => key.startsWith(prefix));
  }

  private getDefaultExpiry(keyPrefix: string): number {
    if (keyPrefix.includes('dashboard')) return CACHE_EXPIRY.DASHBOARD_DATA;
    if (keyPrefix.includes('metrics')) return CACHE_EXPIRY.METRICS;
    if (keyPrefix.includes('activity')) return CACHE_EXPIRY.ACTIVITY_FEED;
    return CACHE_EXPIRY.STATIC_DATA;
  }

  private updateCacheMetadata(key: string, size: number): void {
    this.cacheMetrics.set(key, {
      key,
      size,
      lastAccessed: Date.now(),
      hitCount: 0,
    });
  }

  private recordCacheHit(key: string): void {
    const metadata = this.cacheMetrics.get(key);
    if (metadata) {
      metadata.hitCount++;
      metadata.lastAccessed = Date.now();
    }
  }

  private async cleanupIfNeeded(): Promise<void> {
    const stats = await this.getCacheStats();
    
    if (stats.totalSize > this.maxCacheSize) {
      // Remove least recently used entries
      const sortedKeys = Array.from(this.cacheMetrics.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
        .slice(0, Math.floor(this.cacheMetrics.size * 0.3)) // Remove oldest 30%
        .map(([key]) => key);

      await AsyncStorage.multiRemove(sortedKeys);
      sortedKeys.forEach(key => this.cacheMetrics.delete(key));

      track('cache.cleanup_performed', {
        removedKeys: sortedKeys.length,
        newSize: stats.totalSize,
      });
    }
  }
}

export const offlineCacheService = new OfflineCacheService();
export default offlineCacheService;
