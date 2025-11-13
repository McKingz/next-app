/**
 * DashMemoryManager
 * 
 * Manages persistent memory storage, context cache, and interaction history
 * for the Dash AI Assistant.
 * 
 * Responsibilities:
 * - Store and retrieve memory items (preferences, facts, context)
 * - Manage context cache for quick access
 * - Track interaction history
 * - Handle message counts per conversation
 * - Clean up expired memory items
 * 
 * Extracted from DashAIAssistant.ts as part of Phase 4 modularization.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Types
export interface DashMemoryItem {
  id: string;
  type: 'preference' | 'fact' | 'context' | 'skill' | 'goal' | 'interaction' | 'relationship' | 'pattern' | 'insight' | 'episodic' | 'working' | 'semantic';
  key: string;
  value: any;
  confidence: number;
  created_at: number;
  updated_at: number;
  expires_at?: number;
  relatedEntities?: Array<{
    type: 'user' | 'student' | 'parent' | 'class' | 'subject';
    id: string;
    name: string;
  }>;
  embeddings?: number[];
  reinforcement_count?: number;
  emotional_weight?: number;
  retrieval_frequency?: number;
  tags?: string[];
  importance?: number;
  recency_score?: number;
  accessed_count?: number;
  text_embedding?: number[];
}

export interface InteractionRecord {
  timestamp: number;
  type: string;
  data: any;
}

// Dynamic SecureStore import for cross-platform compatibility
let SecureStore: any = null;
try {
  if (Platform.OS !== 'web') {
    SecureStore = require('expo-secure-store');
  }
} catch (e) {
  console.debug('[DashMemoryManager] SecureStore not available (web or unsupported platform)');
}

/**
 * Manages memory storage and context caching for Dash AI Assistant
 */
export class DashMemoryManager {
  private memory: Map<string, DashMemoryItem> = new Map();
  private contextCache: Map<string, any> = new Map();
  private interactionHistory: InteractionRecord[] = [];
  private messageCountByConversation: Map<string, number> = new Map();
  
  private isDisposed = false;
  
  // Storage keys
  private static readonly MEMORY_KEY = 'dash_memory';
  private static readonly MEMORY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly CONTEXT_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
  private static readonly INTERACTION_HISTORY_MAX_SIZE = 100;
  
  /**
   * Load persistent memory from storage
   */
  public async loadMemory(): Promise<void> {
    this.checkDisposed();
    try {
      const storage = SecureStore || AsyncStorage;
      const memoryData = await storage.getItem(DashMemoryManager.MEMORY_KEY);
      
      if (memoryData) {
        const memoryArray: DashMemoryItem[] = JSON.parse(memoryData);
        this.memory = new Map(memoryArray.map(item => [item.key, item]));
        
        // Clean expired items
        this.cleanExpiredMemory();
        
        console.log(`[DashMemoryManager] Loaded ${this.memory.size} memory items`);
      }
    } catch (error) {
      console.error('[DashMemoryManager] Failed to load memory:', error);
      throw error;
    }
  }
  
  /**
   * Save memory to persistent storage
   */
  public async saveMemory(): Promise<void> {
    this.checkDisposed();
    try {
      const storage = SecureStore || AsyncStorage;
      const memoryArray = Array.from(this.memory.values());
      await storage.setItem(DashMemoryManager.MEMORY_KEY, JSON.stringify(memoryArray));
    } catch (error) {
      console.error('[DashMemoryManager] Failed to save memory:', error);
      throw error;
    }
  }
  
  /**
   * Add a memory item
   */
  public async addMemoryItem(item: Omit<DashMemoryItem, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
    this.checkDisposed();
    try {
      const memoryItem: DashMemoryItem = {
        ...item,
        id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: Date.now(),
        updated_at: Date.now()
      };
      
      this.memory.set(memoryItem.key, memoryItem);
      await this.saveMemory();
    } catch (error) {
      console.error('[DashMemoryManager] Failed to add memory item:', error);
      throw error;
    }
  }
  
  /**
   * Get a specific memory item by key
   */
  public getMemoryItem(key: string): DashMemoryItem | null {
    this.checkDisposed();
    return this.memory.get(key) || null;
  }
  
  /**
   * Get all memory items
   */
  public getAllMemoryItems(): DashMemoryItem[] {
    this.checkDisposed();
    try {
      return Array.from(this.memory.values());
    } catch {
      return [];
    }
  }
  
  /**
   * Update memory based on interaction
   */
  public async updateMemory(userInput: string, response: any): Promise<void> {
    this.checkDisposed();
    try {
      const timestamp = Date.now();
      
      // Remember user preferences
      if (userInput.includes('prefer') || userInput.includes('like')) {
        const memoryItem: DashMemoryItem = {
          id: `pref_${timestamp}`,
          type: 'preference',
          key: `user_preference_${timestamp}`,
          value: userInput,
          confidence: 0.8,
          created_at: timestamp,
          updated_at: timestamp,
          expires_at: timestamp + (30 * 24 * 60 * 60 * 1000) // 30 days
        };
        this.memory.set(memoryItem.key, memoryItem);
      }
      
      // Remember context for future conversations
      const contextItem: DashMemoryItem = {
        id: `ctx_${timestamp}`,
        type: 'context',
        key: `conversation_context_${timestamp}`,
        value: {
          input: userInput,
          response: response.content,
          timestamp
        },
        confidence: 0.6,
        created_at: timestamp,
        updated_at: timestamp,
        expires_at: timestamp + (7 * 24 * 60 * 60 * 1000) // 7 days
      };
      this.memory.set(contextItem.key, contextItem);
      
      await this.saveMemory();
    } catch (error) {
      console.error('[DashMemoryManager] Failed to update memory:', error);
      throw error;
    }
  }
  
  /**
   * Clean expired memory items
   */
  public cleanExpiredMemory(): void {
    this.checkDisposed();
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.memory.forEach((item, key) => {
      if (item.expires_at && item.expires_at < now) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.memory.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`[DashMemoryManager] Cleaned ${keysToDelete.length} expired memory items`);
    }
  }
  
  /**
   * Clear all memory
   */
  public clearMemory(): void {
    this.checkDisposed();
    this.memory.clear();
    console.log('[DashMemoryManager] Memory cleared');
  }
  
  /**
   * Get context cache item
   */
  public getContextCache(key: string): any | null {
    this.checkDisposed();
    return this.contextCache.get(key) || null;
  }
  
  /**
   * Set context cache item
   */
  public setContextCache(key: string, value: any): void {
    this.checkDisposed();
    this.contextCache.set(key, value);
  }
  
  /**
   * Clear context cache
   */
  public clearContextCache(): void {
    this.checkDisposed();
    this.contextCache.clear();
  }
  
  /**
   * Add interaction to history
   */
  public addInteraction(type: string, data: any): void {
    this.checkDisposed();
    this.interactionHistory.push({
      timestamp: Date.now(),
      type,
      data
    });
    
    // Trim to max size
    if (this.interactionHistory.length > DashMemoryManager.INTERACTION_HISTORY_MAX_SIZE) {
      this.interactionHistory = this.interactionHistory.slice(-DashMemoryManager.INTERACTION_HISTORY_MAX_SIZE);
    }
  }
  
  /**
   * Get interaction history
   */
  public getInteractionHistory(): InteractionRecord[] {
    this.checkDisposed();
    return [...this.interactionHistory];
  }
  
  /**
   * Get message count for a conversation
   */
  public getMessageCount(conversationId: string): number {
    this.checkDisposed();
    return this.messageCountByConversation.get(conversationId) || 0;
  }
  
  /**
   * Increment message count for a conversation
   */
  public incrementMessageCount(conversationId: string): void {
    this.checkDisposed();
    const current = this.messageCountByConversation.get(conversationId) || 0;
    this.messageCountByConversation.set(conversationId, current + 1);
  }
  
  /**
   * Get recent memory items (last 24 hours)
   */
  public getRecentMemory(limit: number = 5): DashMemoryItem[] {
    this.checkDisposed();
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return Array.from(this.memory.values())
      .filter(item => item.created_at > dayAgo)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit);
  }
  
  /**
   * Clear all state (memory, cache, history, message counts)
   */
  public clearAllState(): void {
    console.log('[DashMemoryManager] Clearing all state...');
    this.memory.clear();
    this.contextCache.clear();
    this.interactionHistory = [];
    this.messageCountByConversation.clear();
    console.log('[DashMemoryManager] All state cleared');
  }
  
  /**
   * Dispose and clean up resources
   */
  public dispose(): void {
    console.log('[DashMemoryManager] Disposing...');
    this.clearAllState();
    this.isDisposed = true;
    console.log('[DashMemoryManager] Disposed');
  }
  
  /**
   * Check if instance has been disposed
   */
  private checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error('[DashMemoryManager] Cannot perform operation: instance has been disposed');
    }
  }
}
