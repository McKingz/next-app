/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Dash AI WhatsApp Integration Service
 * 
 * Enhanced WhatsApp integration that uses Dash AI to guide users through
 * onboarding, provide contextual assistance, and improve connection flow
 */

import { assertSupabase } from '@/lib/supabase';
import { getCurrentProfile } from '@/lib/sessionManager';
import type { IDashAIAssistant } from './dash-ai/DashAICompat';
import { getAssistant } from './core/getAssistant';
import { router } from 'expo-router';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WhatsAppUser {
  id: string;
  phone_e164: string;
  name?: string;
  role?: 'teacher' | 'principal' | 'parent' | 'student';
  preschool_id?: string;
  connection_status: 'pending' | 'verified' | 'linked' | 'onboarded';
  onboarding_step?: 'phone_verification' | 'role_selection' | 'school_linking' | 'profile_setup' | 'completed';
  conversation_id?: string;
  joined_via: 'qr_code' | 'invitation_link' | 'manual_setup' | 'referral';
  metadata?: {
    invited_by?: string;
    referral_code?: string;
    initial_interest?: string;
    onboarding_started_at?: string;
    first_interaction_type?: string;
  };
}

export interface DashWhatsAppMessage {
  id: string;
  type: 'welcome' | 'onboarding' | 'help' | 'notification' | 'reminder' | 'educational';
  content: string;
  quick_replies?: Array<{
    id: string;
    title: string;
    action: string;
    payload?: any;
  }>;
  attachments?: Array<{
    type: 'image' | 'document' | 'link';
    url: string;
    caption?: string;
  }>;
  metadata?: {
    conversation_id?: string;
    user_context?: any;
    followup_required?: boolean;
    expires_at?: number;
  };
}

export interface WhatsAppOnboardingFlow {
  userId: string;
  currentStep: 'welcome' | 'phone_verification' | 'role_selection' | 'school_connection' | 'dash_introduction' | 'completed';
  progress: number; // 0-100
  data: {
    phone_verified?: boolean;
    role_selected?: string;
    school_linked?: boolean;
    dash_introduced?: boolean;
    preferences_set?: boolean;
  };
  started_at: number;
  completed_at?: number;
  abandoned_at?: number;
}

/**
 * Interface for DashWhatsAppIntegration
 */
export interface IDashWhatsAppIntegration {
  initialize(): Promise<void>;
  generateConnectionQRCode(invitedBy?: string): string;
  handleIncomingConnection(phone: string, connectionData?: any): Promise<{ success: boolean; onboardingFlow?: WhatsAppOnboardingFlow; error?: string }>;
  createOnboardingFlow(phone: string, initialContext?: any): Promise<WhatsAppOnboardingFlow>;
  processIncomingMessage(phone: string, message: string, messageType?: string): Promise<void>;
  createSmartInviteLink(inviterRole: string, schoolId: string): string;
  createRoleBasedShortcuts(userRole: string, phone: string): Promise<DashWhatsAppMessage[]>;
  handleQuickReply(phone: string, action: string, payload?: any): Promise<void>;
  getActiveOnboardingFlows(): WhatsAppOnboardingFlow[];
  completeOnboarding(userId: string): Promise<void>;
  cleanup(): void;
  dispose(): void;
}

export class DashWhatsAppIntegration implements IDashWhatsAppIntegration {
  // Static getInstance method for singleton pattern
  static getInstance: () => DashWhatsAppIntegration;
  
  private dashInstance: IDashAIAssistant | null = null;
  private activeOnboardingFlows: Map<string, WhatsAppOnboardingFlow> = new Map();

  constructor() {
    // Constructor is now public for DI
  }

  /**
   * Initialize the WhatsApp integration with Dash AI
   */
  public async initialize(): Promise<void> {
    try {
      console.log('[DashWhatsApp] Initializing WhatsApp integration...');
      
      // Initialize Dash AI instance
      this.dashInstance = await getAssistant();
      
      // Load any active onboarding flows
      await this.loadActiveOnboardingFlows();
      
      console.log('[DashWhatsApp] WhatsApp integration initialized');
    } catch (error) {
      console.error('[DashWhatsApp] Failed to initialize:', error);
    }
  }

  /**
   * Generate QR code for easy WhatsApp connection
   */
  public generateConnectionQRCode(invitedBy?: string): string {
    const baseUrl = process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://edudashpro.app';
    const referralCode = `ref_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const connectionData = {
      action: 'connect_whatsapp',
      referral_code: referralCode,
      invited_by: invitedBy,
      timestamp: Date.now()
    };
    
    const encodedData = btoa(JSON.stringify(connectionData));
    return `${baseUrl}/whatsapp-connect?data=${encodedData}`;
  }

  /**
   * Handle incoming WhatsApp connection from QR code or link
   */
  public async handleIncomingConnection(
    phone: string,
    connectionData?: any
  ): Promise<{ success: boolean; onboardingFlow?: WhatsAppOnboardingFlow; error?: string }> {
    try {
      console.log('[DashWhatsApp] Handling incoming connection for:', phone);
      
      // Create onboarding flow
      const onboardingFlow: WhatsAppOnboardingFlow = {
        userId: `whatsapp_${phone.replace(/\D/g, '')}`,
        currentStep: 'welcome',
        progress: 0,
        data: {},
        started_at: Date.now()
      };
      
      this.activeOnboardingFlows.set(onboardingFlow.userId, onboardingFlow);
      
      // Send welcome message via Dash
      await this.sendDashWelcomeMessage(phone, connectionData);
      
      return { success: true, onboardingFlow };
    } catch (error) {
      console.error('[DashWhatsApp] Failed to handle connection:', error);
      return { success: false, error: `Connection failed: ${error}` };
    }
  }

  /**
   * Send personalized welcome message via Dash AI
   */
  private async sendDashWelcomeMessage(phone: string, connectionData?: any): Promise<void> {
    try {
      if (!this.dashInstance) return;
      
      // Create a new conversation for this WhatsApp user
      const conversationId = await this.dashInstance.startNewConversation('WhatsApp Onboarding');
      
      // Determine context from connection data
      const context = this.analyzeConnectionContext(connectionData);
      
      // Generate personalized welcome message
      const welcomePrompt = `Generate a warm, welcoming WhatsApp message for a new user connecting to EduDash Pro. 
      Context: ${JSON.stringify(context)}
      Include: brief introduction, what they can expect, and next steps.
      Tone: friendly and professional, max 160 characters for WhatsApp.`;
      
      const response = await this.dashInstance.sendMessage(welcomePrompt, undefined, conversationId);
      
      // Send the message via WhatsApp (would integrate with WhatsApp Business API)
      await this.sendWhatsAppMessage(phone, {
        id: 'welcome',
        type: 'welcome',
        content: response.content,
        quick_replies: [
          { id: 'get_started', title: '🚀 Get Started', action: 'start_onboarding' },
          { id: 'learn_more', title: '📖 Learn More', action: 'show_features' },
          { id: 'contact_support', title: '💬 Need Help?', action: 'contact_support' }
        ],
        metadata: {
          conversation_id: conversationId,
          followup_required: true
        }
      });
      
    } catch (error) {
      console.error('[DashWhatsApp] Failed to send welcome message:', error);
    }
  }

  /**
   * Analyze connection context to personalize onboarding
   */
  private analyzeConnectionContext(connectionData?: any): any {
    return {
      source: connectionData?.invited_by ? 'referral' : 'direct',
      referrer_role: connectionData?.invited_by || null,
      connection_method: connectionData?.action === 'connect_whatsapp' ? 'qr_code' : 'manual',
      timestamp: connectionData?.timestamp || Date.now(),
      initial_interest: connectionData?.interest || 'general'
    };
  }

  /**
   * Send WhatsApp message (integrates with WhatsApp Business API)
   */
  private async sendWhatsAppMessage(phone: string, message: DashWhatsAppMessage): Promise<void> {
    try {
      // This would integrate with your WhatsApp Business API
      // For now, simulate the message sending
      console.log(`[DashWhatsApp] Sending message to ${phone}:`, message.content);
      
      // Call WhatsApp function
      const { data, error } = await assertSupabase().functions.invoke('whatsapp-send', {
        body: {
          to: phone,
          type: 'text',
          text: { body: message.content },
          quick_replies: message.quick_replies
        }
      });
      
      if (error) {
        console.error('[DashWhatsApp] Failed to send WhatsApp message:', error);
      } else {
        console.log('[DashWhatsApp] Message sent successfully');
      }
    } catch (error) {
      console.error('[DashWhatsApp] WhatsApp message error:', error);
    }
  }

  /**
   * Create intelligent onboarding flow with Dash AI
   */
  public async createOnboardingFlow(phone: string, initialContext?: any): Promise<WhatsAppOnboardingFlow> {
    const userId = `whatsapp_${phone.replace(/\D/g, '')}`;
    
    const onboardingFlow: WhatsAppOnboardingFlow = {
      userId,
      currentStep: 'welcome',
      progress: 0,
      data: {},
      started_at: Date.now()
    };
    
    this.activeOnboardingFlows.set(userId, onboardingFlow);
    
    // Create Dash conversation for this onboarding
    if (this.dashInstance) {
      const conversationId = await this.dashInstance.startNewConversation(`WhatsApp User ${phone}`);
      
      // Send contextual onboarding messages
      await this.sendOnboardingStep(phone, onboardingFlow, initialContext);
    }
    
    return onboardingFlow;
  }

  /**
   * Send step-by-step onboarding with Dash AI
   */
  private async sendOnboardingStep(
    phone: string, 
    flow: WhatsAppOnboardingFlow, 
    context?: any
  ): Promise<void> {
    if (!this.dashInstance) return;
    
    try {
      let message: DashWhatsAppMessage;
      
      switch (flow.currentStep) {
        case 'welcome':
          message = await this.generateWelcomeStep(phone, context);
          break;
          
        case 'role_selection':
          message = await this.generateRoleSelectionStep(phone);
          break;
          
        case 'school_connection':
          message = await this.generateSchoolConnectionStep(phone, flow.data.role_selected);
          break;
          
        case 'dash_introduction':
          message = await this.generateDashIntroductionStep(phone, flow.data.role_selected);
          break;
          
        case 'completed':
          message = await this.generateCompletionStep(phone, flow);
          break;
          
        default:
          return;
      }
      
      await this.sendWhatsAppMessage(phone, message);
      
    } catch (error) {
      console.error('[DashWhatsApp] Failed to send onboarding step:', error);
    }
  }

  /**
   * Generate welcome step with Dash AI
   */
  private async generateWelcomeStep(phone: string, context?: any): Promise<DashWhatsAppMessage> {
    const welcomePrompt = `Create a welcoming WhatsApp message for a new EduDash Pro user. 
    Context: ${JSON.stringify(context)}
    Include: warm greeting, brief app overview, role selection prompt.
    Tone: friendly, professional. Max 200 characters.`;
    
    const response = await this.dashInstance?.sendMessage(welcomePrompt) || { content: "Welcome to EduDash Pro! 🎓" };
    
    return {
      id: 'welcome_step',
      type: 'onboarding',
      content: response.content,
      quick_replies: [
        { id: 'teacher', title: '👩‍🏫 Teacher', action: 'select_role', payload: { role: 'teacher' } },
        { id: 'principal', title: '🏫 Principal', action: 'select_role', payload: { role: 'principal' } },
        { id: 'parent', title: '👨‍👩‍👧‍👦 Parent', action: 'select_role', payload: { role: 'parent' } },
        { id: 'student', title: '🎒 Student', action: 'select_role', payload: { role: 'student' } }
      ]
    };
  }

  /**
   * Generate role selection step
   */
  private async generateRoleSelectionStep(phone: string): Promise<DashWhatsAppMessage> {
    return {
      id: 'role_selection',
      type: 'onboarding',
      content: "Great choice! Now let's connect you to your school. Please share your school's name or select from nearby schools:",
      quick_replies: [
        { id: 'find_school', title: '🔍 Find My School', action: 'find_school' },
        { id: 'enter_code', title: '🔑 Enter School Code', action: 'enter_school_code' },
        { id: 'need_help', title: '❓ Need Help', action: 'contact_support' }
      ]
    };
  }

  /**
   * Generate school connection step
   */
  private async generateSchoolConnectionStep(phone: string, role?: string): Promise<DashWhatsAppMessage> {
    const roleSpecificContent = this.getRoleSpecificContent(role);
    
    return {
      id: 'school_connection',
      type: 'onboarding',
      content: `Perfect! As a ${role}, ${roleSpecificContent.description}. Let's complete your setup:`,
      quick_replies: [
        { id: 'complete_profile', title: '✅ Complete Setup', action: 'complete_profile' },
        { id: 'learn_features', title: '📚 Learn Features', action: 'show_features' },
        { id: 'meet_dash', title: '🤖 Meet Dash AI', action: 'introduce_dash' }
      ]
    };
  }

  /**
   * Generate Dash AI introduction step
   */
  private async generateDashIntroductionStep(phone: string, role?: string): Promise<DashWhatsAppMessage> {
    const dashCapabilities = this.getDashCapabilitiesForRole(role);
    
    return {
      id: 'dash_introduction',
      type: 'onboarding',
      content: `Meet Dash! 🤖 I can help you with: ${dashCapabilities.join(', ')}. Ready to start?`,
      quick_replies: [
        { id: 'try_dash', title: '🚀 Try Dash Now', action: 'start_dash_conversation' },
        { id: 'dashboard', title: '📊 Open Dashboard', action: 'open_dashboard' },
        { id: 'complete_later', title: '⏰ Complete Later', action: 'save_progress' }
      ]
    };
  }

  /**
   * Generate completion step
   */
  private async generateCompletionStep(phone: string, flow: WhatsAppOnboardingFlow): Promise<DashWhatsAppMessage> {
    return {
      id: 'completion',
      type: 'onboarding',
      content: `🎉 Welcome to EduDash Pro! You're all set up. You can now access your dashboard, chat with Dash AI, and manage your educational activities. What would you like to do first?`,
      quick_replies: [
        { id: 'open_app', title: '📱 Open App', action: 'open_main_app' },
        { id: 'chat_dash', title: '💬 Chat with Dash', action: 'start_dash_chat' },
        { id: 'explore', title: '🔍 Explore Features', action: 'feature_tour' }
      ]
    };
  }

  /**
   * Get role-specific content
   */
  private getRoleSpecificContent(role?: string): { description: string; features: string[] } {
    switch (role) {
      case 'teacher':
        return {
          description: "you'll have access to lesson planning, student management, and AI-assisted grading",
          features: ['Lesson Planning', 'AI Grading', 'Student Progress', 'Parent Communication']
        };
      case 'principal':
        return {
          description: "you'll have access to school management, staff coordination, and analytics dashboard",
          features: ['School Dashboard', 'Staff Management', 'Financial Reports', 'Analytics']
        };
      case 'parent':
        return {
          description: "you'll have access to your child's progress, homework help, and school communication",
          features: ['Child Progress', 'Homework Help', 'School Messages', 'Event Calendar']
        };
      case 'student':
        return {
          description: "you'll have access to homework help, study tools, and progress tracking",
          features: ['Homework Help', 'Study Tools', 'Progress Tracking', 'Learning Games']
        };
      default:
        return {
          description: "you'll have access to all the educational tools you need",
          features: ['Dashboard Access', 'AI Assistant', 'Progress Tracking', 'Communication']
        };
    }
  }

  /**
   * Get Dash capabilities for specific role
   */
  private getDashCapabilitiesForRole(role?: string): string[] {
    switch (role) {
      case 'teacher':
        return ['lesson planning', 'grading assistance', 'student insights'];
      case 'principal':
        return ['school analytics', 'staff coordination', 'strategic planning'];
      case 'parent':
        return ['homework help', 'progress tracking', 'school communication'];
      case 'student':
        return ['study assistance', 'concept explanation', 'motivation support'];
      default:
        return ['educational assistance', 'task automation', 'progress tracking'];
    }
  }

  /**
   * Process WhatsApp message and respond with Dash AI
   */
  public async processIncomingMessage(
    phone: string,
    message: string,
    messageType: 'text' | 'image' | 'document' = 'text'
  ): Promise<void> {
    try {
      // Find or create user record
      let whatsappUser = await this.findWhatsAppUser(phone);
      
      if (!whatsappUser) {
        // New user - start onboarding
        whatsappUser = await this.createWhatsAppUser(phone);
        await this.handleIncomingConnection(phone);
        return;
      }
      
      // Get or create Dash conversation for this user
      let conversationId = whatsappUser.conversation_id;
      if (!conversationId && this.dashInstance) {
        conversationId = await this.dashInstance.startNewConversation(`WhatsApp: ${phone}`);
        await this.updateWhatsAppUser(whatsappUser.id, { conversation_id: conversationId });
      }
      
      // Process message with Dash AI
      if (this.dashInstance && conversationId) {
        const response = await this.dashInstance.sendMessage(message, undefined, conversationId);
        
        // Send response back via WhatsApp
        await this.sendWhatsAppMessage(phone, {
          id: `response_${Date.now()}`,
          type: 'help',
          content: response.content,
          quick_replies: response.metadata?.suggested_actions?.slice(0, 3).map((action, index) => ({
            id: `action_${index}`,
            title: action.length > 20 ? action.substring(0, 17) + '...' : action,
            action: 'execute_suggestion',
            payload: { suggestion: action }
          })),
          metadata: {
            conversation_id: conversationId,
            user_context: { role: whatsappUser.role, phone }
          }
        });
      }
      
    } catch (error) {
      console.error('[DashWhatsApp] Failed to process message:', error);
      
      // Send fallback message
      await this.sendWhatsAppMessage(phone, {
        id: 'error_fallback',
        type: 'help',
        content: "I'm having trouble processing that message. Could you please try again or contact support?"
      });
    }
  }

  /**
   * Find WhatsApp user in database
   */
  private async findWhatsAppUser(phone: string): Promise<WhatsAppUser | null> {
    try {
      const { data, error } = await assertSupabase()
        .from('whatsapp_contacts')
        .select('*')
        .eq('phone_e164', phone)
        .maybeSingle();
      
      if (error || !data) return null;
      
      return {
        id: data.id,
        phone_e164: data.phone_e164,
        role: data.contact_type || undefined,
        preschool_id: data.preschool_id,
        connection_status: data.consent_status === 'opted_in' ? 'verified' : 'pending',
        joined_via: 'manual_setup' // Would be determined from metadata
      };
    } catch (error) {
      console.error('[DashWhatsApp] Failed to find user:', error);
      return null;
    }
  }

  /**
   * Create new WhatsApp user
   */
  private async createWhatsAppUser(phone: string): Promise<WhatsAppUser> {
    const userId = `whatsapp_${phone.replace(/\D/g, '')}`;
    
    const whatsappUser: WhatsAppUser = {
      id: userId,
      phone_e164: phone,
      connection_status: 'pending',
      onboarding_step: 'phone_verification',
      joined_via: 'manual_setup',
      metadata: {
        onboarding_started_at: new Date().toISOString(),
        first_interaction_type: 'whatsapp_message'
      }
    };
    
    // Store in local cache for now (would be saved to database when user completes onboarding)
    await AsyncStorage.setItem(`whatsapp_user_${userId}`, JSON.stringify(whatsappUser));
    
    return whatsappUser;
  }

  /**
   * Update WhatsApp user data
   */
  private async updateWhatsAppUser(userId: string, updates: Partial<WhatsAppUser>): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(`whatsapp_user_${userId}`);
      if (stored) {
        const user = JSON.parse(stored);
        const updated = { ...user, ...updates };
        await AsyncStorage.setItem(`whatsapp_user_${userId}`, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('[DashWhatsApp] Failed to update user:', error);
    }
  }

  /**
   * Load active onboarding flows
   */
  private async loadActiveOnboardingFlows(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const onboardingKeys = keys.filter(key => key.startsWith('whatsapp_onboarding_'));
      
      for (const key of onboardingKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const flow: WhatsAppOnboardingFlow = JSON.parse(data);
          this.activeOnboardingFlows.set(flow.userId, flow);
        }
      }
      
      console.log(`[DashWhatsApp] Loaded ${this.activeOnboardingFlows.size} active onboarding flows`);
    } catch (error) {
      console.error('[DashWhatsApp] Failed to load onboarding flows:', error);
    }
  }

  /**
   * Create smart WhatsApp invite link
   */
  public createSmartInviteLink(inviterRole: string, schoolId: string): string {
    const baseUrl = process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://edudashpro.app';
    const inviteCode = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const inviteData = {
      action: 'smart_invite',
      inviter_role: inviterRole,
      school_id: schoolId,
      invite_code: inviteCode,
      created_at: Date.now()
    };
    
    const encodedData = btoa(JSON.stringify(inviteData));
    const whatsappMessage = encodeURIComponent(
      `🎓 You're invited to join EduDash Pro! \n\n` +
      `Click here to get started: ${baseUrl}/invite?data=${encodedData}\n\n` +
      `Or download the app and use code: ${inviteCode}`
    );
    
    return `https://wa.me/?text=${whatsappMessage}`;
  }

  /**
   * Handle role-based WhatsApp shortcuts via Dash
   */
  public async createRoleBasedShortcuts(userRole: string, phone: string): Promise<DashWhatsAppMessage[]> {
    const shortcuts: DashWhatsAppMessage[] = [];
    
    try {
      switch (userRole) {
        case 'teacher':
          shortcuts.push({
            id: 'teacher_shortcuts',
            type: 'educational',
            content: "Quick teacher actions via WhatsApp:",
            quick_replies: [
              { id: 'create_lesson', title: '📝 Plan Lesson', action: 'create_lesson_via_whatsapp' },
              { id: 'check_grades', title: '📊 Check Grades', action: 'view_grades_summary' },
              { id: 'parent_updates', title: '📧 Send Updates', action: 'compose_parent_message' },
              { id: 'ask_dash', title: '🤖 Ask Dash', action: 'start_dash_conversation' }
            ]
          });
          break;
          
        case 'principal':
          shortcuts.push({
            id: 'principal_shortcuts',
            type: 'educational',
            content: "Principal dashboard shortcuts:",
            quick_replies: [
              { id: 'daily_metrics', title: '📈 Daily Report', action: 'send_daily_metrics' },
              { id: 'staff_updates', title: '👥 Staff Status', action: 'staff_summary' },
              { id: 'financial_summary', title: '💰 Finances', action: 'financial_overview' },
              { id: 'dash_insights', title: '🧠 AI Insights', action: 'get_ai_insights' }
            ]
          });
          break;
          
        case 'parent':
          shortcuts.push({
            id: 'parent_shortcuts',
            type: 'educational',
            content: "Parent helper shortcuts:",
            quick_replies: [
              { id: 'homework_help', title: '📚 Homework Help', action: 'start_homework_session' },
              { id: 'child_progress', title: '📊 Child Progress', action: 'view_child_progress' },
              { id: 'school_messages', title: '💬 School Messages', action: 'check_messages' },
              { id: 'ask_dash', title: '🤖 Ask Dash', action: 'parent_dash_chat' }
            ]
          });
          break;
          
        case 'student':
          shortcuts.push({
            id: 'student_shortcuts',
            type: 'educational',
            content: "Student study shortcuts:",
            quick_replies: [
              { id: 'homework_help', title: '📝 Homework Help', action: 'homework_assistance' },
              { id: 'study_buddy', title: '🤖 Study with Dash', action: 'study_session' },
              { id: 'my_progress', title: '📈 My Progress', action: 'view_my_progress' },
              { id: 'study_tips', title: '💡 Study Tips', action: 'get_study_tips' }
            ]
          });
          break;
      }
      
      return shortcuts;
    } catch (error) {
      console.error('[DashWhatsApp] Failed to create shortcuts:', error);
      return [];
    }
  }

  /**
   * Handle WhatsApp quick reply actions
   */
  public async handleQuickReply(
    phone: string,
    action: string,
    payload?: any
  ): Promise<void> {
    try {
      switch (action) {
        case 'select_role':
          await this.handleRoleSelection(phone, payload.role);
          break;
          
        case 'start_dash_conversation':
          await this.startDashConversation(phone, payload);
          break;
          
        case 'open_dashboard':
          await this.sendDashboardLink(phone, payload);
          break;
          
        case 'homework_assistance':
          await this.startHomeworkSession(phone);
          break;
          
        case 'create_lesson_via_whatsapp':
          await this.initiateWhatsAppLessonCreation(phone);
          break;
          
        case 'send_daily_metrics':
          await this.sendDailyMetricsViaWhatsApp(phone);
          break;
          
        default:
          console.log(`[DashWhatsApp] Unhandled action: ${action}`);
      }
    } catch (error) {
      console.error('[DashWhatsApp] Failed to handle quick reply:', error);
    }
  }

  /**
   * Handle role selection and continue onboarding
   */
  private async handleRoleSelection(phone: string, role: string): Promise<void> {
    const userId = `whatsapp_${phone.replace(/\D/g, '')}`;
    const flow = this.activeOnboardingFlows.get(userId);
    
    if (flow) {
      flow.data.role_selected = role;
      flow.currentStep = 'school_connection';
      flow.progress = 33;
      
      await this.sendOnboardingStep(phone, flow);
    }
  }

  /**
   * Start Dash conversation via WhatsApp
   */
  private async startDashConversation(phone: string, context?: any): Promise<void> {
    if (!this.dashInstance) return;
    
    try {
      const conversationId = await this.dashInstance.startNewConversation(`WhatsApp Chat: ${phone}`);
      
      // Send initial Dash greeting
      const greeting = await this.dashInstance.sendMessage(
        "A user from WhatsApp wants to chat. Provide a warm, helpful greeting and ask how you can assist them today.",
        undefined,
        conversationId
      );
      
      await this.sendWhatsAppMessage(phone, {
        id: 'dash_greeting',
        type: 'help',
        content: greeting.content,
        quick_replies: [
          { id: 'lesson_help', title: '📚 Lesson Help', action: 'lesson_assistance' },
          { id: 'student_help', title: '👨‍🎓 Student Help', action: 'student_assistance' },
          { id: 'general_help', title: '❓ General Help', action: 'general_assistance' }
        ]
      });
      
    } catch (error) {
      console.error('[DashWhatsApp] Failed to start Dash conversation:', error);
    }
  }

  /**
   * Send dashboard access link
   */
  private async sendDashboardLink(phone: string, context?: any): Promise<void> {
    const deepLink = `${process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://edudashpro.app'}/dashboard`;
    
    await this.sendWhatsAppMessage(phone, {
      id: 'dashboard_link',
      type: 'notification',
      content: `🚀 Access your EduDash Pro dashboard: ${deepLink}`,
      attachments: [{
        type: 'link',
        url: deepLink,
        caption: 'Open EduDash Pro Dashboard'
      }]
    });
  }

  /**
   * Start homework session via WhatsApp
   */
  private async startHomeworkSession(phone: string): Promise<void> {
    await this.sendWhatsAppMessage(phone, {
      id: 'homework_session',
      type: 'educational',
      content: "📚 Homework Helper activated! Send me your question or take a photo of the problem, and I'll help you solve it step by step.",
      quick_replies: [
        { id: 'math_help', title: '🔢 Math', action: 'subject_help', payload: { subject: 'math' } },
        { id: 'english_help', title: '📖 English', action: 'subject_help', payload: { subject: 'english' } },
        { id: 'science_help', title: '🔬 Science', action: 'subject_help', payload: { subject: 'science' } },
        { id: 'other_subject', title: '📝 Other Subject', action: 'custom_subject_help' }
      ]
    });
  }

  /**
   * Initiate lesson creation via WhatsApp
   */
  private async initiateWhatsAppLessonCreation(phone: string): Promise<void> {
    if (!this.dashInstance) return;
    
    try {
      const lessonPrompt = "A teacher wants to create a lesson via WhatsApp. Ask them for the subject, grade level, and topic, then offer to create a lesson plan.";
      const response = await this.dashInstance.sendMessage(lessonPrompt);
      
      await this.sendWhatsAppMessage(phone, {
        id: 'lesson_creation',
        type: 'educational',
        content: response.content,
        quick_replies: [
          { id: 'math_lesson', title: '🔢 Math', action: 'create_lesson', payload: { subject: 'math' } },
          { id: 'english_lesson', title: '📖 English', action: 'create_lesson', payload: { subject: 'english' } },
          { id: 'science_lesson', title: '🔬 Science', action: 'create_lesson', payload: { subject: 'science' } },
          { id: 'custom_lesson', title: '✏️ Custom', action: 'custom_lesson' }
        ]
      });
    } catch (error) {
      console.error('[DashWhatsApp] Failed to initiate lesson creation:', error);
    }
  }

  /**
   * Send daily metrics via WhatsApp for principals
   */
  private async sendDailyMetricsViaWhatsApp(phone: string): Promise<void> {
    try {
      // This would integrate with your analytics service
      const metrics = {
        total_students: 145,
        present_today: 132,
        attendance_rate: '91%',
        active_teachers: 12,
        pending_tasks: 3
      };
      
      const metricsMessage = `📊 Daily School Report\n\n` +
        `👨‍🎓 Students: ${metrics.total_students} (${metrics.present_today} present)\n` +
        `📈 Attendance: ${metrics.attendance_rate}\n` +
        `👩‍🏫 Active Teachers: ${metrics.active_teachers}\n` +
        `⏰ Pending Tasks: ${metrics.pending_tasks}`;
      
      await this.sendWhatsAppMessage(phone, {
        id: 'daily_metrics',
        type: 'notification',
        content: metricsMessage,
        quick_replies: [
          { id: 'detailed_report', title: '📋 Full Report', action: 'open_detailed_dashboard' },
          { id: 'urgent_tasks', title: '🚨 Urgent Tasks', action: 'show_urgent_tasks' },
          { id: 'staff_status', title: '👥 Staff Status', action: 'check_staff_status' }
        ]
      });
    } catch (error) {
      console.error('[DashWhatsApp] Failed to send metrics:', error);
    }
  }

  /**
   * Get active onboarding flows
   */
  public getActiveOnboardingFlows(): WhatsAppOnboardingFlow[] {
    return Array.from(this.activeOnboardingFlows.values());
  }

  /**
   * Complete onboarding flow
   */
  public async completeOnboarding(userId: string): Promise<void> {
    const flow = this.activeOnboardingFlows.get(userId);
    if (flow) {
      flow.currentStep = 'completed';
      flow.progress = 100;
      flow.completed_at = Date.now();
      
      // Clean up from active flows
      this.activeOnboardingFlows.delete(userId);
      await AsyncStorage.removeItem(`whatsapp_onboarding_${userId}`);
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.activeOnboardingFlows.clear();
    if (this.dashInstance) {
      this.dashInstance.cleanup();
    }
  }

  /**
   * Dispose method for cleanup
   */
  public dispose(): void {
    this.cleanup();
  }
}

// Backward compatibility: Export singleton instance
// TODO: Remove once all call sites migrated to DI
import { container, TOKENS } from '../lib/di/providers/default';
export const DashWhatsAppIntegrationInstance = (() => {
  try {
    return container.resolve(TOKENS.dashWhatsApp);
  } catch {
    // Fallback during initialization
    return new DashWhatsAppIntegration();
  }
})();

// Add static getInstance method to class
DashWhatsAppIntegration.getInstance = function() {
  return DashWhatsAppIntegrationInstance;
};

export default DashWhatsAppIntegrationInstance;
