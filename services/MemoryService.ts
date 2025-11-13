/**
 * MemoryService - Semantic memory management with vector embeddings
 * Connects to Supabase ai_memories table for persistent, searchable memory
 */

import { assertSupabase } from '@/lib/supabase';
import { getCurrentProfile } from '@/lib/sessionManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MemoryInput {
  type: 'preference' | 'fact' | 'context' | 'skill' | 'goal' | 
        'interaction' | 'relationship' | 'pattern' | 'insight' | 
        'episodic' | 'working' | 'semantic';
  content: any;
  importance?: number; // 1-10
  relatedEntities?: Array<{
    type: string;
    id: string;
    name: string;
  }>;
}

export interface Memory {
  id: string;
  memory_type: string;
  content: any;
  importance: number;
  similarity?: number;
  created_at: string;
  accessed_count: number;
}

/**
 * MemoryService interface for dependency injection
 */
export interface IMemoryService {
  initialize(): Promise<void>;
  upsertMemory(input: MemoryInput): Promise<Memory | null>;
  retrieveRelevant(query: string, topK?: number, minSimilarity?: number): Promise<Memory[]>;
  snapshotContext(context: any): Promise<void>;
  recordAccess(memoryId: string): Promise<void>;
  getCachedMemories(): Memory[];
  dispose(): void;
}

class MemoryServiceClass implements IMemoryService {
  private memoryCache: Map<string, Memory> = new Map();
  private readonly CACHE_KEY = '@dash_memory_cache';

  /**
   * Initialize and load cached memories
   */
  async initialize(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const memories = JSON.parse(cached);
        memories.forEach((m: Memory) => this.memoryCache.set(m.id, m));
      }
    } catch (error) {
      console.error('[MemoryService] Failed to load cache:', error);
    }
  }

  /**
   * Store a new memory with embedding
   */
  async upsertMemory(input: MemoryInput): Promise<Memory | null> {
    try {
      const supabase = assertSupabase();
      const profile = await getCurrentProfile();
      if (!profile) throw new Error('No user profile');

      // Generate embedding via Edge Function
      const { data: embeddingResult, error: embedError } = await supabase
        .functions.invoke('ai-gateway', {
          body: {
            action: 'embed_text',
            text: JSON.stringify(input.content)
          }
        });

      if (embedError) {
        console.error('[MemoryService] Embedding failed:', embedError);
        // Continue without embedding - still useful for structured queries
      }

      // Insert into database
      const { data, error } = await supabase
        .from('ai_memories')
        .insert({
          preschool_id: (profile as any).organization_id,
          user_id: profile.id,
          memory_type: input.type,
          content: input.content,
          text_embedding: embeddingResult?.vector,
          importance: input.importance || 5
        })
        .select()
        .single();

      if (error) throw error;

      // Cache locally
      this.memoryCache.set(data.id, data);
      await this.saveCache();

      console.log(`[MemoryService] Stored ${input.type} memory:`, data.id);
      return data;
    } catch (error) {
      console.error('[MemoryService] Failed to store memory:', error);
      return null;
    }
  }

  /**
   * Retrieve semantically similar memories
   */
  async retrieveRelevant(
    query: string,
    topK: number = 8,
    minSimilarity: number = 0.7
  ): Promise<Memory[]> {
    try {
      const supabase = assertSupabase();
      const profile = await getCurrentProfile();
      if (!profile) return [];

      // Generate query embedding
      const { data: embeddingResult, error: embedError } = await supabase
        .functions.invoke('ai-gateway', {
          body: {
            action: 'embed_text',
            text: query
          }
        });

      if (embedError || !embeddingResult?.vector) {
        console.warn('[MemoryService] Using fallback text search');
        return this.fallbackTextSearch(query, topK);
      }

      // Search using vector similarity (requires RPC function)
      const { data, error } = await supabase
        .rpc('search_ai_memories', {
          query_embedding: embeddingResult.vector,
          match_count: topK,
          min_similarity: minSimilarity,
          preschool_id: (profile as any).organization_id,
          user_id: profile.id
        });

      if (error) {
        console.error('[MemoryService] Vector search failed:', error);
        return this.fallbackTextSearch(query, topK);
      }

      return data || [];
    } catch (error) {
      console.error('[MemoryService] Retrieval failed:', error);
      return this.fallbackTextSearch(query, topK);
    }
  }

  /**
   * Fallback text search when embeddings unavailable
   */
  private async fallbackTextSearch(query: string, limit: number): Promise<Memory[]> {
    try {
      const supabase = assertSupabase();
      const profile = await getCurrentProfile();
      if (!profile) return [];

      const { data, error } = await supabase
        .from('ai_memories')
        .select('*')
        .eq('preschool_id', (profile as any).organization_id)
        .eq('user_id', profile.id)
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Simple keyword matching
      const queryLower = query.toLowerCase();
      return data
        .filter(m => {
          const contentStr = JSON.stringify(m.content).toLowerCase();
          return queryLower.split(' ').some(word => contentStr.includes(word));
        })
        .slice(0, limit);
    } catch (error) {
      console.error('[MemoryService] Fallback search failed:', error);
      return [];
    }
  }

  /**
   * Store a context snapshot for continuity
   */
  async snapshotContext(context: any): Promise<void> {
    try {
      const supabase = assertSupabase();
      const profile = await getCurrentProfile();
      if (!profile) return;

      await supabase
        .from('ai_context_snapshots')
        .insert({
          preschool_id: (profile as any).organization_id,
          user_id: profile.id,
          snapshot: context
        });

      console.log('[MemoryService] Context snapshot saved');
    } catch (error) {
      console.error('[MemoryService] Snapshot failed:', error);
    }
  }

  /**
   * Record memory access to update recency
   */
  async recordAccess(memoryId: string): Promise<void> {
    try {
      const supabase = assertSupabase();
      
      await supabase
        .from('ai_memories')
        .update({ 
          accessed_count: (supabase as any).sql`accessed_count + 1`
        })
        .eq('id', memoryId);
    } catch (error) {
      console.error('[MemoryService] Access recording failed:', error);
    }
  }

  /**
   * Save cache to AsyncStorage
   */
  private async saveCache(): Promise<void> {
    try {
      const memories = Array.from(this.memoryCache.values())
        .slice(-100); // Keep only recent 100
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(memories));
    } catch (error) {
      console.error('[MemoryService] Cache save failed:', error);
    }
  }

  /**
   * Get cached memories for offline use
   */
  getCachedMemories(): Memory[] {
    return Array.from(this.memoryCache.values());
  }

  /**
   * Dispose method for cleanup
   */
  dispose(): void {
    this.memoryCache.clear();
  }
}

// Export service for DI registration
export { MemoryServiceClass };

// Backward compatibility: Export singleton instance
// TODO: Remove once all call sites migrated to DI
import { container, TOKENS } from '../lib/di/providers/default';
export const MemoryService = (() => {
  try {
    return container.resolve(TOKENS.memory);
  } catch {
    // Fallback during initialization
    return new MemoryServiceClass();
  }
})();
