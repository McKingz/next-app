/**
 * DashMemoryService
 * 
 * Manages persistent memory, context building, and data privacy for Dash AI:
 * - Persistent storage (AsyncStorage + Supabase sync)
 * - Memory item lifecycle (create, update, expire, evict)
 * - Context assembly for AI prompts
 * - PII redaction utilities
 * - Tenant isolation (respects preschool_id for RLS)
 * 
 * Design principles:
 * - Privacy-first: PII redaction before any AI calls
 * - Tenant-scoped: all memory items respect organization boundaries
 * - Efficient: in-memory cache with periodic persistence
 * - Expirable: automatic cleanup of stale memory
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { DashMemoryItem, DashMessage } from './types';

// Dynamically import SecureStore for cross-platform compatibility
let SecureStore: any = null;
try {
  if (Platform.OS !== 'web') {
    SecureStore = require('expo-secure-store');
  }
} catch (e) {
  console.debug('[DashMemory] SecureStore import failed (web or unsupported platform)', e);
}

/**
 * Memory service configuration
 */
export interface MemoryServiceConfig {
  /** Storage key prefix for memory items */
  storageKey?: string;
  /** Whether to use SecureStore (iOS/Android) or AsyncStorage (Web) */
  useSecureStorage?: boolean;
  /** Supabase client for remote sync (optional) */
  supabaseClient?: any;
  /** User ID for tenant isolation */
  userId?: string;
  /** Organization/preschool ID for multi-tenant filtering */
  organizationId?: string;
}

/**
 * PII detection patterns
 */
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  phone: /\b(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  idNumber: /\b\d{13}\b/g, // South African ID number
};

/**
 * DashMemoryService
 * Manages persistent memory and context for Dash AI
 */
export class DashMemoryService {
  private config: MemoryServiceConfig;
  private memory: Map<string, DashMemoryItem> = new Map();
  private isDirty = false;
  private persistTimer: NodeJS.Timeout | null = null;

  constructor(config: MemoryServiceConfig = {}) {
    this.config = {
      storageKey: config.storageKey || 'dash_memory',
      useSecureStorage: config.useSecureStorage ?? true,
      ...config,
    };
  }

  /**
   * Initialize and load memory from storage
   */
  public async initialize(): Promise<void> {
    try {
      await this.loadMemory();
      console.log(`[DashMemory] Initialized with ${this.memory.size} memory items`);

      // Start periodic persistence (every 30 seconds if dirty)
      this.persistTimer = setInterval(() => {
        if (this.isDirty) {
          this.saveMemory().catch((err) =>
            console.error('[DashMemory] Auto-save failed:', err)
          );
        }
      }, 30000) as any;
    } catch (error) {
      console.error('[DashMemory] Initialization failed:', error);
    }
  }

  /**
   * Load memory from persistent storage
   */
  private async loadMemory(): Promise<void> {
    try {
      const storage = this.getStorage();
      const memoryData = await storage.getItem(this.config.storageKey!);

      if (memoryData) {
        const memoryArray: DashMemoryItem[] = JSON.parse(memoryData);
        this.memory = new Map(memoryArray.map((item) => [item.key, item]));

        // Clean expired items
        this.cleanExpiredMemory();

        console.log(`[DashMemory] Loaded ${this.memory.size} memory items`);
      }
    } catch (error) {
      console.error('[DashMemory] Failed to load memory:', error);
    }
  }

  /**
   * Save memory to persistent storage
   */
  public async saveMemory(): Promise<void> {
    try {
      const storage = this.getStorage();
      const memoryArray = Array.from(this.memory.values());
      await storage.setItem(this.config.storageKey!, JSON.stringify(memoryArray));
      this.isDirty = false;
    } catch (error) {
      console.error('[DashMemory] Failed to save memory:', error);
    }
  }

  /**
   * Get storage backend (SecureStore or AsyncStorage)
   */
  private getStorage(): any {
    return this.config.useSecureStorage && SecureStore
      ? SecureStore
      : AsyncStorage;
  }

  /**
   * Add or update a memory item
   */
  public async addMemoryItem(
    item: Omit<DashMemoryItem, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DashMemoryItem> {
    try {
      const existingItem = this.memory.get(item.key);

      const memoryItem: DashMemoryItem = existingItem
        ? {
            ...existingItem,
            ...item,
            updated_at: Date.now(),
            reinforcement_count: (existingItem.reinforcement_count || 0) + 1,
            accessed_count: (existingItem.accessed_count || 0) + 1,
          }
        : {
            ...item,
            id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: Date.now(),
            updated_at: Date.now(),
            reinforcement_count: 1,
            accessed_count: 1,
          };

      this.memory.set(memoryItem.key, memoryItem);
      this.isDirty = true;

      // Optionally sync to Supabase (if configured)
      if (this.config.supabaseClient && this.config.organizationId) {
        await this.syncMemoryToSupabase(memoryItem);
      }

      return memoryItem;
    } catch (error) {
      console.error('[DashMemory] Failed to add memory item:', error);
      throw error;
    }
  }

  /**
   * Get a memory item by key
   */
  public getMemoryItem(key: string): DashMemoryItem | undefined {
    const item = this.memory.get(key);
    if (item) {
      // Update access count and timestamp
      item.accessed_count = (item.accessed_count || 0) + 1;
      item.retrieval_frequency = (item.retrieval_frequency || 0) + 1;
      this.isDirty = true;
    }
    return item;
  }

  /**
   * Get all memory items (optionally filtered)
   */
  public getMemoryItems(filter?: {
    type?: DashMemoryItem['type'];
    tags?: string[];
    minConfidence?: number;
  }): DashMemoryItem[] {
    let items = Array.from(this.memory.values());

    if (filter) {
      if (filter.type) {
        items = items.filter((item) => item.type === filter.type);
      }
      if (filter.tags && filter.tags.length > 0) {
        items = items.filter(
          (item) =>
            item.tags &&
            filter.tags!.some((tag) => item.tags!.includes(tag))
        );
      }
      if (filter.minConfidence !== undefined) {
        items = items.filter((item) => item.confidence >= filter.minConfidence!);
      }
    }

    return items.sort((a, b) => b.updated_at - a.updated_at);
  }

  /**
   * Remove a memory item
   */
  public removeMemoryItem(key: string): boolean {
    const deleted = this.memory.delete(key);
    if (deleted) {
      this.isDirty = true;
    }
    return deleted;
  }

  /**
   * Clear all memory
   */
  public async clearMemory(): Promise<void> {
    try {
      this.memory.clear();
      this.isDirty = true;
      await this.saveMemory();
      console.log('[DashMemory] All memory cleared');
    } catch (error) {
      console.error('[DashMemory] Failed to clear memory:', error);
    }
  }

  /**
   * Clean expired memory items
   */
  public cleanExpiredMemory(): number {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.memory.forEach((item, key) => {
      if (item.expires_at && item.expires_at < now) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.memory.delete(key));

    if (keysToDelete.length > 0) {
      this.isDirty = true;
      console.log(`[DashMemory] Cleaned ${keysToDelete.length} expired items`);
    }

    return keysToDelete.length;
  }

  /**
   * Build conversation context from recent memory and messages
   */
  public buildConversationContext(
    messages: DashMessage[],
    currentIntent?: string
  ): string {
    if (!messages || messages.length === 0) {
      return 'New conversation';
    }

    const recentMessages = messages.slice(-5);
    const topics = new Set<string>();

    for (const message of recentMessages) {
      if (message.type === 'user') {
        const intent = this.quickIntentDetection(message.content);
        topics.add(intent);
      }
    }

    const topicsList = Array.from(topics).join(', ');
    return `Recent topics: ${topicsList}${currentIntent ? `. Current: ${currentIntent}` : ''}`;
  }

  /**
   * Quick intent detection for context building
   */
  private quickIntentDetection(text: string): string {
    const lower = text.toLowerCase();

    if (lower.includes('lesson') || lower.includes('teach'))
      return 'lesson_planning';
    if (lower.includes('worksheet') || lower.includes('activity'))
      return 'worksheet_creation';
    if (lower.includes('student') || lower.includes('grade'))
      return 'student_management';
    if (lower.includes('parent') || lower.includes('message'))
      return 'communication';
    if (lower.includes('report') || lower.includes('data')) return 'reporting';
    if (lower.includes('help') || lower.includes('how')) return 'help_request';

    return 'general';
  }

  /**
   * Update memory based on user interaction
   */
  public async updateMemoryFromInteraction(
    userInput: string,
    assistantResponse: string,
    confidence: number = 0.8
  ): Promise<void> {
    try {
      const timestamp = Date.now();

      // Remember user preferences
      if (userInput.includes('prefer') || userInput.includes('like')) {
        await this.addMemoryItem({
          type: 'preference',
          key: `user_preference_${timestamp}`,
          value: userInput,
          confidence: 0.8,
          expires_at: timestamp + 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }

      // Remember context for future conversations
      await this.addMemoryItem({
        type: 'context',
        key: `conversation_context_${timestamp}`,
        value: {
          input: userInput,
          response: assistantResponse,
          timestamp,
        },
        confidence: 0.6,
        expires_at: timestamp + 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    } catch (error) {
      console.error('[DashMemory] Failed to update memory from interaction:', error);
    }
  }

  /**
   * Get recent relevant memories for AI context
   */
  public getRelevantMemories(
    query: string,
    limit: number = 5
  ): DashMemoryItem[] {
    const queryLower = query.toLowerCase();
    const relevantMemories: Array<{ item: DashMemoryItem; score: number }> = [];

    for (const item of this.memory.values()) {
      // Skip expired items
      if (item.expires_at && item.expires_at < Date.now()) continue;

      // Calculate relevance score
      let score = 0;

      // Boost based on confidence
      score += item.confidence * 10;

      // Boost based on recency
      const ageHours = (Date.now() - item.updated_at) / (1000 * 60 * 60);
      score += Math.max(0, 10 - ageHours / 24); // Decay over 10 days

      // Boost based on reinforcement
      score += (item.reinforcement_count || 0) * 2;

      // Boost based on importance
      score += (item.importance || 0) * 20;

      // Boost if value matches query keywords
      const valueStr = JSON.stringify(item.value).toLowerCase();
      if (valueStr.includes(queryLower)) {
        score += 50;
      }

      // Boost if tags match query
      if (item.tags) {
        for (const tag of item.tags) {
          if (queryLower.includes(tag.toLowerCase())) {
            score += 10;
          }
        }
      }

      relevantMemories.push({ item, score });
    }

    // Sort by score and return top N
    return relevantMemories
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.item);
  }

  /**
   * Redact PII from text before sending to AI services
   * IMPORTANT: Always use this before AI calls to protect user privacy
   */
  public redactPII(text: string): { redacted: string; hadPII: boolean } {
    let redacted = text;
    let hadPII = false;

    // Email addresses
    if (PII_PATTERNS.email.test(redacted)) {
      redacted = redacted.replace(PII_PATTERNS.email, '[EMAIL_REDACTED]');
      hadPII = true;
    }

    // Phone numbers
    if (PII_PATTERNS.phone.test(redacted)) {
      redacted = redacted.replace(PII_PATTERNS.phone, '[PHONE_REDACTED]');
      hadPII = true;
    }

    // SSN/ID numbers
    if (PII_PATTERNS.ssn.test(redacted)) {
      redacted = redacted.replace(PII_PATTERNS.ssn, '[ID_REDACTED]');
      hadPII = true;
    }
    if (PII_PATTERNS.idNumber.test(redacted)) {
      redacted = redacted.replace(PII_PATTERNS.idNumber, '[ID_REDACTED]');
      hadPII = true;
    }

    // Credit card numbers
    if (PII_PATTERNS.creditCard.test(redacted)) {
      redacted = redacted.replace(
        PII_PATTERNS.creditCard,
        '[CARD_REDACTED]'
      );
      hadPII = true;
    }

    if (hadPII) {
      console.log('[DashMemory] PII detected and redacted from text');
    }

    return { redacted, hadPII };
  }

  /**
   * Sync memory item to Supabase (optional remote persistence)
   */
  private async syncMemoryToSupabase(item: DashMemoryItem): Promise<void> {
    try {
      if (!this.config.supabaseClient || !this.config.organizationId) {
        return;
      }

      // Store in ai_usage_logs or a dedicated memory table
      const { error } = await this.config.supabaseClient
        .from('ai_memory') // Assumes table exists
        .upsert(
          {
            id: item.id,
            organization_id: this.config.organizationId,
            user_id: this.config.userId,
            type: item.type,
            key: item.key,
            value: item.value,
            confidence: item.confidence,
            tags: item.tags,
            created_at: new Date(item.created_at).toISOString(),
            updated_at: new Date(item.updated_at).toISOString(),
            expires_at: item.expires_at
              ? new Date(item.expires_at).toISOString()
              : null,
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.warn('[DashMemory] Supabase sync failed:', error.message);
      }
    } catch (error) {
      console.error('[DashMemory] Supabase sync error:', error);
    }
  }

  /**
   * Get memory statistics
   */
  public getMemoryStats(): {
    totalItems: number;
    byType: Record<string, number>;
    avgConfidence: number;
    expiredCount: number;
  } {
    const stats = {
      totalItems: this.memory.size,
      byType: {} as Record<string, number>,
      avgConfidence: 0,
      expiredCount: 0,
    };

    let totalConfidence = 0;
    const now = Date.now();

    for (const item of this.memory.values()) {
      // Count by type
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;

      // Sum confidence
      totalConfidence += item.confidence;

      // Count expired
      if (item.expires_at && item.expires_at < now) {
        stats.expiredCount++;
      }
    }

    stats.avgConfidence =
      stats.totalItems > 0 ? totalConfidence / stats.totalItems : 0;

    return stats;
  }

  /**
   * Dispose and clean up resources
   */
  public dispose(): void {
    console.log('[DashMemory] Disposing DashMemoryService...');

    // Stop persistence timer
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }

    // Save any pending changes
    if (this.isDirty) {
      this.saveMemory().catch((err) =>
        console.error('[DashMemory] Final save failed:', err)
      );
    }

    console.log('[DashMemory] Disposal complete');
  }
}

export default DashMemoryService;
