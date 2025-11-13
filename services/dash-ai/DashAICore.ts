/**
 * DashAICore (Refactored with Facades)
 * 
 * Slim orchestrator for Dash AI Assistant using facade pattern.
 * All domain-specific operations delegated to facades.
 * 
 * Architecture:
 * DashAICore → Facades → Services
 */

import { DashVoiceService, type VoiceRecordingConfig } from './DashVoiceService';
import { DashMemoryService, type MemoryServiceConfig } from './DashMemoryService';
import { DashConversationManager, type ConversationManagerConfig } from './DashConversationManager';
import { DashTaskManager, type TaskManagerConfig } from './DashTaskManager';
import { DashAINavigator, type NavigatorConfig } from './DashAINavigator';
import { DashUserProfileManager, type UserProfileManagerConfig } from './DashUserProfileManager';
import { DashAIClient } from './DashAIClient';
import { DashPromptBuilder } from './DashPromptBuilder';

// Import facades
import {
  DashAIVoiceFacade,
  DashAIMemoryFacade,
  DashAIConversationFacade,
  DashAITaskFacade,
  DashAINavigationFacade,
} from './facades';

import type { DashMessage, DashPersonality } from './types';

/**
 * Default personality configuration
 */
const DEFAULT_PERSONALITY: DashPersonality = {
  name: 'Dash',
  greeting: "Hi! I'm Dash, your AI teaching assistant. How can I help you today?",
  personality_traits: ['helpful', 'encouraging', 'knowledgeable', 'patient', 'creative'],
  response_style: 'adaptive',
  expertise_areas: ['education', 'lesson planning', 'student assessment'],
  voice_settings: { rate: 0.8, pitch: 1.0, language: 'en-ZA' },
  role_specializations: {
    teacher: {
      greeting: "Hello! I'm Dash, your teaching assistant.",
      capabilities: ['lesson_planning', 'grading_assistance'],
      tone: 'encouraging and professional',
      proactive_behaviors: ['suggest_lesson_improvements'],
      task_categories: ['academic', 'administrative'],
    },
    principal: {
      greeting: "Good day! I'm Dash, here to help you lead your school.",
      capabilities: ['staff_management', 'budget_analysis'],
      tone: 'professional and strategic',
      proactive_behaviors: ['monitor_school_metrics'],
      task_categories: ['administrative', 'strategic'],
    },
    parent: {
      greeting: "Hi! I'm Dash, your family's education assistant.",
      capabilities: ['homework_assistance', 'progress_tracking'],
      tone: 'friendly and supportive',
      proactive_behaviors: ['remind_homework_deadlines'],
      task_categories: ['academic_support', 'communication'],
    },
    student: {
      greeting: "Hey! I'm Dash, your study buddy.",
      capabilities: ['homework_help', 'study_techniques'],
      tone: 'friendly and encouraging',
      proactive_behaviors: ['remind_study_sessions'],
      task_categories: ['academic', 'personal'],
    },
  },
  agentic_settings: {
    autonomy_level: 'medium',
    can_create_tasks: true,
    can_schedule_actions: true,
    can_access_data: true,
    can_send_notifications: false,
    requires_confirmation_for: ['send_external_emails', 'modify_grades'],
  },
};

export interface DashAICoreConfig {
  supabaseClient: any;
  currentUser?: {
    id: string;
    role: string;
    name?: string;
    email?: string;
    organizationId?: string;
    preschoolId?: string;
  };
  personality?: Partial<DashPersonality>;
}

/**
 * DashAICore - Slim orchestrator using facades
 */
export class DashAICore {
  private static instance: DashAICore | null = null;

  // Facades (public API)
  public voice!: DashAIVoiceFacade;
  public memory!: DashAIMemoryFacade;
  public conversation!: DashAIConversationFacade;
  public tasks!: DashAITaskFacade;
  public navigation!: DashAINavigationFacade;

  // Internal services
  private voiceService!: DashVoiceService;
  private memoryService!: DashMemoryService;
  private conversationManager!: DashConversationManager;
  private taskManager!: DashTaskManager;
  private navigator!: DashAINavigator;
  private profileManager!: DashUserProfileManager;
  private aiClient!: DashAIClient;
  private promptBuilder!: DashPromptBuilder;

  // Configuration
  private personality: DashPersonality;
  private supabaseClient: any;

  constructor(config: DashAICoreConfig) {
    this.supabaseClient = config.supabaseClient;
    this.personality = { ...DEFAULT_PERSONALITY, ...config.personality };
  }

  private initializeServices(config?: { supabaseClient?: any; currentUser?: any }) {
    if (config?.supabaseClient) {
      this.supabaseClient = config.supabaseClient;
    }

    // Initialize core services
    this.voiceService = new DashVoiceService({
      voiceSettings: this.personality.voice_settings,
      supabaseClient: this.supabaseClient,
    });

    this.memoryService = new DashMemoryService({
      supabaseClient: this.supabaseClient,
      userId: config?.currentUser?.id,
      organizationId: config?.currentUser?.organizationId,
    });

    this.conversationManager = new DashConversationManager({
      userId: config?.currentUser?.id || 'unknown',
      preschoolId: config?.currentUser?.preschoolId || 'unknown',
    });

    this.taskManager = new DashTaskManager({ userId: config?.currentUser?.id });
    this.navigator = new DashAINavigator({});
    this.profileManager = new DashUserProfileManager({ currentUser: config?.currentUser });

    this.aiClient = new DashAIClient({
      supabaseClient: this.supabaseClient,
      getUserProfile: () => this.profileManager.getUserProfile(),
    });

    this.promptBuilder = new DashPromptBuilder({
      personality: this.personality,
      getUserProfile: () => this.profileManager.getUserProfile(),
    });

    // Initialize facades
    this.voice = new DashAIVoiceFacade(this.voiceService);
    this.memory = new DashAIMemoryFacade(this.memoryService);
    this.conversation = new DashAIConversationFacade(this.conversationManager);
    this.tasks = new DashAITaskFacade(this.taskManager);
    this.navigation = new DashAINavigationFacade(this.navigator);
  }

  public static getInstance(): DashAICore | null {
    return DashAICore.instance;
  }

  public static setInstance(instance: DashAICore): void {
    DashAICore.instance = instance;
  }

  public async initialize(config?: { supabaseClient?: any; currentUser?: any }): Promise<void> {
    console.log('[DashAICore] Initializing...');

    try {
      if (!this.voiceService || config) {
        this.initializeServices(config);
      }

      await Promise.all([
        this.voiceService.initializeAudio(),
        this.memoryService.initialize(),
        this.conversationManager.initialize(),
        this.taskManager.initialize(),
        this.profileManager.initialize(),
      ]);

      console.log('[DashAICore] Initialization complete');
    } catch (error) {
      console.error('[DashAICore] Initialization failed:', error);
      throw error;
    }
  }

  // ==================== PROFILE & SETTINGS ====================

  public getUserProfile() {
    return this.profileManager.getUserProfile();
  }

  public async updateUserPreferences(preferences: Partial<any>): Promise<void> {
    return this.profileManager.updatePreferences(preferences);
  }

  public async setLanguage(language: string): Promise<void> {
    await this.profileManager.setLanguage(language);
    this.voiceService.updateConfig({
      voiceSettings: { ...this.personality.voice_settings, language },
      supabaseClient: this.supabaseClient,
    });
  }

  public getLanguage(): string | undefined {
    return this.profileManager.getLanguage();
  }

  public getPersonality(): DashPersonality {
    return this.personality;
  }

  public updatePersonality(personality: Partial<DashPersonality>): void {
    this.personality = { ...this.personality, ...personality };

    if (personality.voice_settings) {
      this.voiceService.updateConfig({
        voiceSettings: this.personality.voice_settings,
        supabaseClient: this.supabaseClient,
      });
    }

    if (this.promptBuilder) {
      this.promptBuilder.updatePersonality(this.personality);
    }
  }

  public async savePersonality(personality: Partial<DashPersonality>): Promise<void> {
    this.updatePersonality(personality);
  }

  public getPersonalizedGreeting(): string {
    return this.profileManager.getPersonalizedGreeting(this.personality);
  }

  // ==================== AI INTEGRATION ====================

  public async sendMessage(
    content: string,
    conversationId?: string,
    attachments?: any[],
    onStreamChunk?: (chunk: string) => void
  ): Promise<DashMessage> {
    const convId = conversationId || this.conversation.getCurrentConversationId();
    if (!convId) {
      throw new Error('No active conversation');
    }

    const userMessage: DashMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      content,
      timestamp: Date.now(),
      attachments,
    };

    await this.conversation.addMessageToConversation(convId, userMessage);

    const assistantMessage = await this.generateAIResponse(
      content,
      convId,
      attachments,
      onStreamChunk
    );

    await this.conversation.addMessageToConversation(convId, assistantMessage);

    return assistantMessage;
  }

  private async generateAIResponse(
    userInput: string,
    conversationId: string,
    attachments?: any[],
    onStreamChunk?: (chunk: string) => void
  ): Promise<DashMessage> {
    try {
      const conversation = await this.conversation.getConversation(conversationId);
      const recentMessages = conversation?.messages?.slice(-5) || [];

      const langDirective = this.promptBuilder.buildLanguageDirective();
      const shouldStream = typeof onStreamChunk === 'function';

      const response = await this.aiClient.callAIService({
        action: 'general_assistance',
        messages: this.promptBuilder.buildMessageHistory(recentMessages, userInput),
        context: `User role: ${this.getUserProfile()?.role || 'educator'}\n${langDirective}`,
        attachments,
        stream: shouldStream,
        onChunk: onStreamChunk,
      });

      return {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant',
        content: response.content || 'I apologize, but I encountered an issue processing your request.',
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[DashAICore] Failed to generate response:', error);
      return {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'assistant',
        content: "I'm sorry, I'm having trouble processing that right now. Could you please try again?",
        timestamp: Date.now(),
      };
    }
  }

  // ==================== LIFECYCLE ====================

  public dispose(): void {
    console.log('[DashAICore] Disposing...');
    this.voice.dispose();
    this.memory.dispose();
    this.conversation.dispose();
    this.tasks.dispose();
    this.profileManager.dispose();
    console.log('[DashAICore] Disposal complete');
  }
}

export default DashAICore;
