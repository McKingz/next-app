/**
 * DashAIMemoryFacade
 * 
 * Facade for memory and context management.
 * Delegates to DashMemoryService.
 */

import { DashMemoryService } from '../DashMemoryService';
import type { DashMemoryItem } from '../types';

export class DashAIMemoryFacade {
  constructor(private memoryService: DashMemoryService) {}

  /**
   * Add memory item
   */
  public async addMemoryItem(
    item: Omit<DashMemoryItem, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DashMemoryItem> {
    return this.memoryService.addMemoryItem(item);
  }

  /**
   * Get memory items (optionally filtered)
   */
  public getMemoryItems(filter?: {
    type?: DashMemoryItem['type'];
    tags?: string[];
    minConfidence?: number;
  }): DashMemoryItem[] {
    return this.memoryService.getMemoryItems(filter);
  }

  /**
   * Get relevant memories for a query
   */
  public getRelevantMemories(query: string, limit?: number): DashMemoryItem[] {
    return this.memoryService.getRelevantMemories(query, limit);
  }

  /**
   * Clear all memory
   */
  public async clearMemory(): Promise<void> {
    return this.memoryService.clearMemory();
  }

  /**
   * Redact PII from text
   */
  public redactPII(text: string): { redacted: string; hadPII: boolean } {
    return this.memoryService.redactPII(text);
  }

  /**
   * Dispose memory service resources
   */
  public dispose(): void {
    this.memoryService.dispose();
  }
}
