/**
 * DashAICompat
 *
 * Backward-compatibility layer to bridge existing imports that reference the old monolith
 * `DashAIAssistant` and `IDashAIAssistant` to the new modular architecture based on DashAICore.
 *
 * This file exposes:
 * - interface IDashAIAssistant (minimal surface used across codebase)
 * - class DashAIAssistant: thin facade delegating to DashAICore
 */

import DashAICore, { type DashAICoreConfig } from './DashAICore';
import type { TranscriptionResult } from './DashVoiceService';
import type {
  DashMessage,
  DashReminder,
  DashTask,
  DashConversation,
} from './types';
import { assertSupabase } from '@/lib/supabase';
import { getCurrentSession } from '@/lib/sessionManager';

// Re-export types for backward compatibility
export type {
  DashMessage,
  DashConversation,
  DashReminder,
  DashTask,
} from './types';

export interface IDashAIAssistant {
  initialize(config?: { supabaseClient?: any; currentUser?: any }): Promise<void>;
  dispose(): void;
  cleanup(): void;

  // Voice
  startRecording(): Promise<void>;
  stopRecording(): Promise<string>;
  isCurrentlyRecording(): boolean;
  transcribeAudio(audioUri: string, userId?: string): Promise<TranscriptionResult>;
  speakText(text: string): Promise<void>;
  stopSpeaking(): Promise<void>;

  // Conversations & Messages
  startNewConversation(title?: string): Promise<string>;
  getCurrentConversationId(): string | null;
  setCurrentConversationId(id: string): void;
  getConversation(conversationId: string): Promise<DashConversation | null>;
  getAllConversations(): Promise<DashConversation[]>;
  deleteConversation(conversationId: string): Promise<void>;
  addMessageToConversation(conversationId: string, message: DashMessage): Promise<void>;
  sendMessage(content: string, conversationId?: string, attachments?: any[], onStreamChunk?: (chunk: string) => void): Promise<DashMessage>;

  // Tasks & Reminders
  createTask(title: string, description: string, type?: DashTask['type'], assignedTo?: string): Promise<DashTask>;
  getActiveTasks(): DashTask[];
  createReminder(title: string, message: string, triggerAt: number, priority?: DashReminder['priority']): Promise<DashReminder>;
  getActiveReminders(): DashReminder[];

  // Navigation
  navigateToScreen(route: string, params?: Record<string, any>): Promise<{ success: boolean; screen?: string; error?: string }>;
  navigateByVoice(command: string): Promise<{ success: boolean; screen?: string; error?: string }>;
  openLessonGeneratorFromContext(userInput: string, aiResponse: string): void;

  // Preferences & Personality
  setLanguage(language: string): Promise<void>;
  getLanguage(): string | undefined;
  getPersonality(): any;
  savePersonality(partial: any): Promise<void>;
  exportConversation(conversationId: string): Promise<string>;

  // Voice response
  speakResponse(
    message: DashMessage,
    callbacks?: {
      onStart?: () => void;
      onDone?: () => void;
      onStopped?: () => void;
      onError?: (error: any) => void;
    }
  ): Promise<void>;

  // Convenience shim used in some legacy hooks/components
  sendPreparedVoiceMessage(input: { text?: string; audioUri?: string }): Promise<void>;

  // Screen context (for tools); optional for backward compatibility
  getCurrentScreenContext?: () => { screen: string; capabilities: string[]; suggestions: string[] };
}

export class DashAIAssistant implements IDashAIAssistant {
  private static instance: DashAIAssistant | null = null;
  private core: DashAICore;

  constructor(config: DashAICoreConfig) {
    this.core = new DashAICore(config);
    DashAICore.setInstance(this.core);
  }
  
  public static getInstance(): DashAIAssistant {
    if (!DashAIAssistant.instance) {
      // Create with default config - will be properly initialized later
      DashAIAssistant.instance = new DashAIAssistant({
        supabaseClient: null as any, // Will be set on initialize
      });
    }
    return DashAIAssistant.instance;
  }
  
  public static setInstance(instance: DashAIAssistant): void {
    DashAIAssistant.instance = instance;
  }

  async initialize(config?: { supabaseClient?: any; currentUser?: any }): Promise<void> {
    // Auto-get Supabase client and current user if not provided
    const initConfig = config || {};
    if (!initConfig.supabaseClient) {
      try {
        initConfig.supabaseClient = assertSupabase();
      } catch (e) {
        console.warn('[DashAICompat] Failed to get Supabase client');
      }
    }
    if (!initConfig.currentUser) {
      try {
        const session = await getCurrentSession();
        if (session) {
          // Fetch preschool_id from profile for tenant isolation
          let preschoolId: string | undefined;
          try {
            const { data: profile } = await initConfig.supabaseClient
              .from('profiles')
              .select('preschool_id')
              .eq('id', session.user_id)
              .single();
            preschoolId = profile?.preschool_id;
          } catch (profileError) {
            console.warn('[DashAICompat] Failed to fetch preschool_id from profile:', profileError);
          }

          initConfig.currentUser = {
            id: session.user_id,
            role: session.role || 'teacher',
            name: undefined, // Not available in session
            email: session.email,
            organizationId: session.organization_id,
            preschoolId, // REQUIRED for tenant isolation
          };
        }
      } catch (e) {
        console.warn('[DashAICompat] Failed to get current user session');
      }
    }
    return this.core.initialize(initConfig); 
  }
  dispose(): void { return this.core.dispose(); }
  cleanup(): void { return this.core.dispose(); } // Alias for dispose

  // Voice - delegate to facade
  async startRecording(): Promise<void> { return this.core.voice.startRecording(); }
  async stopRecording(): Promise<string> { return this.core.voice.stopRecording(); }
  isCurrentlyRecording(): boolean { return this.core.voice.isCurrentlyRecording(); }
  async transcribeAudio(audioUri: string, userId?: string): Promise<TranscriptionResult> { return this.core.voice.transcribeAudio(audioUri, userId); }
  async speakText(text: string): Promise<void> { return this.core.voice.speakText(text); }
  async stopSpeaking(): Promise<void> { return this.core.voice.stopSpeaking(); }

  // Conversations - delegate to facade
  async startNewConversation(title?: string): Promise<string> { return this.core.conversation.startNewConversation(title); }
  getCurrentConversationId(): string | null { return this.core.conversation.getCurrentConversationId(); }
  setCurrentConversationId(id: string): void { return this.core.conversation.setCurrentConversationId(id); }
  async getConversation(conversationId: string): Promise<DashConversation | null> { return this.core.conversation.getConversation(conversationId); }
  async getAllConversations(): Promise<DashConversation[]> { return this.core.conversation.getAllConversations(); }
  async deleteConversation(conversationId: string): Promise<void> { return this.core.conversation.deleteConversation(conversationId); }
  async addMessageToConversation(conversationId: string, message: DashMessage): Promise<void> { return this.core.conversation.addMessageToConversation(conversationId, message); }
  
  async sendMessage(
    content: string, 
    conversationId?: string, 
    attachments?: any[],
    onStreamChunk?: (chunk: string) => void
  ): Promise<DashMessage> {
    // Delegate to DashAICore which now handles AI calls
    return this.core.sendMessage(content, conversationId, attachments, onStreamChunk);
  }

  // Tasks & Reminders - delegate to facade
  async createTask(title: string, description: string, type?: DashTask['type'], assignedTo?: string): Promise<DashTask> {
    return this.core.tasks.createTask(title, description, type, assignedTo);
  }
  getActiveTasks(): DashTask[] { return this.core.tasks.getActiveTasks(); }
  async createReminder(title: string, message: string, triggerAt: number, priority?: DashReminder['priority']): Promise<DashReminder> {
    return this.core.tasks.createReminder(title, message, triggerAt, priority);
  }
  getActiveReminders(): DashReminder[] { return this.core.tasks.getActiveReminders(); }

  // Navigation - delegate to facade
  async navigateToScreen(route: string, params?: Record<string, any>) { return this.core.navigation.navigateToScreen(route, params); }
  async navigateByVoice(command: string) { return this.core.navigation.navigateByVoice(command); }
  openLessonGeneratorFromContext(userInput: string, aiResponse: string): void {
    // Legacy method - now uses navigator's openLessonGenerator
    console.warn('[DashAICompat] openLessonGeneratorFromContext is deprecated');
  }

  // Preferences
  async setLanguage(language: string): Promise<void> { return this.core.setLanguage(language); }
  getLanguage(): string | undefined { return this.core.getLanguage(); }
  getPersonality(): any { return this.core.getPersonality(); }
  async savePersonality(partial: any): Promise<void> { return this.core.savePersonality(partial); }
  async exportConversation(conversationId: string): Promise<string> { return this.core.conversation.exportConversation(conversationId); }

  // Screen context (simple default for tools)
  getCurrentScreenContext(): { screen: string; capabilities: string[]; suggestions: string[] } {
    return {
      screen: 'dashboard',
      capabilities: [
        'navigate',
        'open_caps_documents',
        'compose_message',
        'export_pdf',
      ],
      suggestions: [
        'Create a lesson plan',
        'Generate a worksheet',
        'Check assignments',
        'Open CAPS documents',
      ],
    };
  }
  
  /**
   * Speak response (TTS wrapper)
   * @param message Message to speak (only assistant messages are spoken)
   * @param callbacks Optional callbacks for speech events
   */
  async speakResponse(
    message: DashMessage,
    callbacks?: {
      onStart?: () => void;
      onDone?: () => void;
      onStopped?: () => void;
      onError?: (error: any) => void;
    }
  ): Promise<void> {
    // Only speak assistant messages
    if (message.type !== 'assistant') {
      console.log('[DashAICompat] Ignoring non-assistant message for TTS');
      return;
    }
    
    // Extract text content
    const text = message.content;
    if (!text || text.trim().length === 0) {
      console.warn('[DashAICompat] No content to speak');
      callbacks?.onError?.('No content to speak');
      return;
    }
    
    // Language override if provided in metadata
    const langOverride = (message as any)?.metadata?.detected_language as string | undefined;
    
    // Delegate to core.voice speakText with callbacks and language override
    return this.core.voice.speakText(text, callbacks, langOverride ? { language: langOverride } : undefined);
  }

  // Convenience shim
  async sendPreparedVoiceMessage(input: { text?: string; audioUri?: string }): Promise<void> {
    if (input.audioUri) {
      const result = await this.core.voice.transcribeAudio(input.audioUri);
      if (result?.transcript) await this.core.voice.speakText(result.transcript);
      return;
    }
    if (input.text) {
      await this.core.voice.speakText(input.text);
      return;
    }
  }
}

export default DashAIAssistant;
