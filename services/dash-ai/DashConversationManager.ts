/**
 * DashConversationManager
 * 
 * Manages conversation history, message persistence, and context windows:
 * - Create/read/update/delete conversations
 * - Add messages to conversations
 * - Build context windows for AI prompts
 * - Export conversation history
 * - Conversation summaries and tagging
 * 
 * Design principles:
 * - Server-backed storage via Supabase with RLS tenant isolation
 * - Efficient in-memory caching
 * - Context window management (avoid token limits)
 * - Message deduplication
 * - Fallback to AsyncStorage for current conversation pointer only
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DashConversation, DashMessage } from './types';
import { DashConversationService } from './DashConversationService';

/**
 * Conversation manager configuration
 */
export interface ConversationManagerConfig {
  /** User ID (required for Supabase operations) */
  userId: string;
  /** Preschool ID (required for tenant isolation) */
  preschoolId: string;
  /** Storage key for current conversation pointer */
  currentConversationKey?: string;
  /** Maximum messages to keep in context window */
  maxContextMessages?: number;
}

/**
 * DashConversationManager
 * Handles all conversation and message history operations with Supabase backend
 */
export class DashConversationManager {
  private config: ConversationManagerConfig;
  private currentConversationId: string | null = null;
  private service: DashConversationService;

  constructor(config: ConversationManagerConfig) {
    if (!config.userId || !config.preschoolId) {
      throw new Error('[DashConversationManager] userId and preschoolId are required');
    }

    this.config = {
      userId: config.userId,
      preschoolId: config.preschoolId,
      currentConversationKey:
        config.currentConversationKey || '@dash_ai_current_conversation_id',
      maxContextMessages: config.maxContextMessages || 10,
    };

    // Initialize Supabase service with tenant context
    this.service = new DashConversationService(config.userId, config.preschoolId);
  }

  /**
   * Initialize and load current conversation pointer
   */
  public async initialize(): Promise<void> {
    try {
      const storedId = await AsyncStorage.getItem(
        this.config.currentConversationKey!
      );
      if (storedId) {
        this.currentConversationId = storedId;
        console.log(`[DashConversation] Resumed conversation: ${storedId}`);
      }
    } catch (error) {
      console.error('[DashConversation] Initialization failed:', error);
    }
  }

  /**
   * Start a new conversation
   */
  public async startNewConversation(title?: string): Promise<string> {
    const conversationId = `dash_conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentConversationId = conversationId;

    const conversationTitle = title || `Conversation ${new Date().toLocaleDateString()}`;

    // Create conversation in Supabase with tenant isolation
    await this.service.createConversation(conversationId, conversationTitle);

    // Store current conversation pointer in AsyncStorage
    try {
      await AsyncStorage.setItem(
        this.config.currentConversationKey!,
        conversationId
      );
    } catch {}
    
    console.log(`[DashConversation] Started new conversation: ${conversationId}`);
    return conversationId;
  }

  /**
   * Get conversation by ID
   */
  public async getConversation(
    conversationId: string
  ): Promise<DashConversation | null> {
    return await this.service.getConversation(conversationId);
  }

  /**
   * Get all conversations (filtered by preschool_id via RLS)
   */
  public async getAllConversations(): Promise<DashConversation[]> {
    return await this.service.getAllConversations();
  }


  /**
   * Add message to conversation
   */
  public async addMessageToConversation(
    conversationId: string,
    message: DashMessage
  ): Promise<void> {
    await this.service.addMessageToConversation(conversationId, message);
    
    // Update current conversation pointer in AsyncStorage
    try {
      await AsyncStorage.setItem(
        this.config.currentConversationKey!,
        conversationId
      );
    } catch {}
  }

  /**
   * Build context window from conversation (most recent N messages)
   */
  public async buildContextWindow(
    conversationId: string,
    maxMessages?: number
  ): Promise<DashMessage[]> {
    const limit = maxMessages || this.config.maxContextMessages || 10;
    return await this.service.getRecentMessages(conversationId, limit);
  }


  /**
   * Delete conversation
   */
  public async deleteConversation(conversationId: string): Promise<void> {
    await this.service.deleteConversation(conversationId);
    
    // If deleting the current conversation, clear current pointer
    const currentId = await AsyncStorage.getItem(
      this.config.currentConversationKey!
    );
    if (currentId === conversationId) {
      await AsyncStorage.removeItem(this.config.currentConversationKey!);
      this.currentConversationId = null;
    }
  }

  /**
   * Get current conversation ID
   */
  public getCurrentConversationId(): string | null {
    return this.currentConversationId;
  }

  /**
   * Set current conversation ID
   */
  public setCurrentConversationId(conversationId: string): void {
    this.currentConversationId = conversationId;
    // Persist pointer so canvas resumes the last chat
    try {
      AsyncStorage.setItem(this.config.currentConversationKey!, conversationId);
    } catch {}
  }

  /**
   * Export conversation as text
   */
  public async exportConversation(conversationId: string): Promise<string> {
    try {
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      let exportText = `Dash AI Assistant Conversation\n`;
      exportText += `Title: ${conversation.title}\n`;
      exportText += `Date: ${new Date(conversation.created_at).toLocaleDateString()}\n`;
      exportText += `\n${'='.repeat(50)}\n\n`;

      for (const message of conversation.messages) {
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        const sender = message.type === 'user' ? 'You' : 'Dash';
        exportText += `[${timestamp}] ${sender}: ${message.content}\n\n`;
      }

      return exportText;
    } catch (error) {
      console.error('[DashConversation] Failed to export conversation:', error);
      throw error;
    }
  }

  /**
   * Update conversation title
   */
  public async updateConversationTitle(
    conversationId: string,
    title: string
  ): Promise<void> {
    await this.service.updateConversationTitle(conversationId, title);
  }

  /**
   * Generate conversation summary
   */
  public async generateConversationSummary(
    conversationId: string
  ): Promise<string> {
    try {
      const conversation = await this.getConversation(conversationId);
      if (!conversation || conversation.messages.length === 0) {
        return 'Empty conversation';
      }

      // Simple summary: first user message + message count
      const firstUserMsg = conversation.messages.find((m) => m.type === 'user');
      const userMsgCount = conversation.messages.filter(
        (m) => m.type === 'user'
      ).length;
      const assistantMsgCount = conversation.messages.filter(
        (m) => m.type === 'assistant'
      ).length;

      const summary = firstUserMsg
        ? `"${firstUserMsg.content.slice(0, 60)}..." (${userMsgCount} messages)`
        : `${userMsgCount + assistantMsgCount} messages`;

      return summary;
    } catch (error) {
      console.error(
        '[DashConversation] Failed to generate summary:',
        error
      );
      return 'Conversation summary unavailable';
    }
  }

  /**
   * Trim conversation to keep only recent messages (storage optimization)
   */
  public async trimConversation(
    conversationId: string,
    maxMessages: number
  ): Promise<void> {
    await this.service.trimConversation(conversationId, maxMessages);
  }

  /**
   * Dispose and clean up resources
   */
  public dispose(): void {
    console.log('[DashConversation] Disposing DashConversationManager...');
    this.currentConversationId = null;
    console.log('[DashConversation] Disposal complete');
  }
}

export default DashConversationManager;
