/**
 * DashAIConversationFacade
 * 
 * Facade for conversation and message management.
 * Delegates to DashConversationManager.
 */

import { DashConversationManager } from '../DashConversationManager';
import type { DashMessage, DashConversation } from '../types';

export class DashAIConversationFacade {
  constructor(private conversationManager: DashConversationManager) {}

  /**
   * Start new conversation
   */
  public async startNewConversation(title?: string): Promise<string> {
    return this.conversationManager.startNewConversation(title);
  }

  /**
   * Get conversation by ID
   */
  public async getConversation(conversationId: string): Promise<DashConversation | null> {
    return this.conversationManager.getConversation(conversationId);
  }

  /**
   * Get all conversations
   */
  public async getAllConversations(): Promise<DashConversation[]> {
    return this.conversationManager.getAllConversations();
  }

  /**
   * Delete conversation
   */
  public async deleteConversation(conversationId: string): Promise<void> {
    return this.conversationManager.deleteConversation(conversationId);
  }

  /**
   * Get current conversation ID
   */
  public getCurrentConversationId(): string | null {
    return this.conversationManager.getCurrentConversationId();
  }

  /**
   * Set current conversation ID
   */
  public setCurrentConversationId(conversationId: string): void {
    this.conversationManager.setCurrentConversationId(conversationId);
  }

  /**
   * Add message to conversation
   */
  public async addMessageToConversation(
    conversationId: string,
    message: DashMessage
  ): Promise<void> {
    return this.conversationManager.addMessageToConversation(conversationId, message);
  }

  /**
   * Export conversation as text
   */
  public async exportConversation(conversationId: string): Promise<string> {
    return this.conversationManager.exportConversation(conversationId);
  }

  /**
   * Dispose conversation manager resources
   */
  public dispose(): void {
    this.conversationManager.dispose();
  }
}
