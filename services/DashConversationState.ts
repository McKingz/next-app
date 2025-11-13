/**
 * DashConversationState Service
 * 
 * Manages conversation state to prevent repetitive greetings and maintain context.
 * Ensures Dash behaves naturally by remembering what has been said in the conversation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConversationSession {
  sessionId: string;
  userId: string;
  userName?: string;
  startTime: number;
  lastInteractionTime: number;
  hasGreeted: boolean;
  topicsDiscussed: string[];
  actionsPerformed: string[];
  userPreferences: {
    formalityLevel?: 'casual' | 'professional';
    preferredLanguage?: string;
    preferredName?: string;
  };
}

const STORAGE_KEY_SESSION = '@dash_conversation_session';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export class DashConversationState {
  private static currentSession: ConversationSession | null = null;

  /**
   * Initialize or resume a conversation session
   */
  static async initializeSession(
    userId: string,
    profile?: { full_name?: string; first_name?: string; role?: string }
  ): Promise<void> {
    // Try to load existing session
    const sessionJson = await AsyncStorage.getItem(STORAGE_KEY_SESSION);
    
    if (sessionJson) {
      const savedSession: ConversationSession = JSON.parse(sessionJson);
      
      // Check if session is still valid (not timed out)
      const timeSinceLastInteraction = Date.now() - savedSession.lastInteractionTime;
      
      if (
        savedSession.userId === userId && 
        timeSinceLastInteraction < SESSION_TIMEOUT
      ) {
        // Resume existing session
        this.currentSession = {
          ...savedSession,
          lastInteractionTime: Date.now()
        };
        await this.persistSession();
        return;
      }
    }

    // Create new session
    const userName = this.extractFirstName(profile);
    
    this.currentSession = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      userName,
      startTime: Date.now(),
      lastInteractionTime: Date.now(),
      hasGreeted: false,
      topicsDiscussed: [],
      actionsPerformed: [],
      userPreferences: {}
    };

    await this.persistSession();
  }

  /**
   * Extract first name from profile
   */
  private static extractFirstName(profile?: { 
    full_name?: string; 
    first_name?: string; 
  }): string | undefined {
    if (profile?.first_name) {
      return profile.first_name;
    }
    
    if (profile?.full_name) {
      // Extract first name from full name
      const parts = profile.full_name.trim().split(/\s+/);
      return parts[0];
    }
    
    return undefined;
  }

  /**
   * Mark that Dash has greeted the user
   */
  static async markGreeted(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.hasGreeted = true;
      this.currentSession.lastInteractionTime = Date.now();
      await this.persistSession();
    }
  }

  /**
   * Check if Dash should greet the user
   */
  static shouldGreet(): boolean {
    if (!this.currentSession) {
      return true; // Default to greeting if no session
    }
    
    return !this.currentSession.hasGreeted;
  }

  /**
   * Get the user's preferred name for address
   */
  static getUserName(): string | undefined {
    return this.currentSession?.userPreferences.preferredName || 
           this.currentSession?.userName;
  }

  /**
   * Record a topic that was discussed
   */
  static async recordTopic(topic: string): Promise<void> {
    if (this.currentSession && !this.currentSession.topicsDiscussed.includes(topic)) {
      this.currentSession.topicsDiscussed.push(topic);
      this.currentSession.lastInteractionTime = Date.now();
      await this.persistSession();
    }
  }

  /**
   * Check if a topic has been discussed
   */
  static hasDiscussedTopic(topic: string): boolean {
    return this.currentSession?.topicsDiscussed.includes(topic) || false;
  }

  /**
   * Record an action that was performed
   */
  static async recordAction(action: string): Promise<void> {
    if (this.currentSession) {
      this.currentSession.actionsPerformed.push(action);
      this.currentSession.lastInteractionTime = Date.now();
      
      // Keep only last 20 actions
      if (this.currentSession.actionsPerformed.length > 20) {
        this.currentSession.actionsPerformed = 
          this.currentSession.actionsPerformed.slice(-20);
      }
      
      await this.persistSession();
    }
  }

  /**
   * Get recent actions
   */
  static getRecentActions(limit: number = 5): string[] {
    if (!this.currentSession) return [];
    return this.currentSession.actionsPerformed.slice(-limit);
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(preferences: {
    formalityLevel?: 'casual' | 'professional';
    preferredLanguage?: string;
    preferredName?: string;
  }): Promise<void> {
    if (this.currentSession) {
      this.currentSession.userPreferences = {
        ...this.currentSession.userPreferences,
        ...preferences
      };
      await this.persistSession();
    }
  }

  /**
   * Get user preferences
   */
  static getPreferences() {
    return this.currentSession?.userPreferences || {};
  }

  /**
   * Update last interaction time
   */
  static async touchSession(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.lastInteractionTime = Date.now();
      await this.persistSession();
    }
  }

  /**
   * Get conversation context for prompt injection
   */
  static getConversationContext(): string {
    if (!this.currentSession) {
      return '';
    }

    const userName = this.getUserName();
    const recentActions = this.getRecentActions(3);
    const recentTopics = this.currentSession.topicsDiscussed.slice(-3);

    let context = '\n## CONVERSATION CONTEXT\n\n';

    // User info
    if (userName) {
      context += `**User's Name:** ${userName}\n`;
      context += `**Note:** Address the user by their first name naturally in conversation.\n\n`;
    }

    // Greeting status
    if (this.currentSession.hasGreeted) {
      context += `**Greeting:** You have already greeted the user in this session. DO NOT greet again.\n\n`;
    } else {
      context += `**Greeting:** This is the start of the conversation. Greet the user warmly${userName ? ` using their name (${userName})` : ''}.\n\n`;
    }

    // Recent context
    if (recentTopics.length > 0) {
      context += `**Topics Discussed:** ${recentTopics.join(', ')}\n`;
    }

    if (recentActions.length > 0) {
      context += `**Recent Actions:** ${recentActions.join(', ')}\n`;
    }

    // Conversation guidelines
    context += `\n**Conversation Guidelines:**\n`;
    context += `- Be natural and context-aware\n`;
    context += `- Don't repeat information unnecessarily\n`;
    context += `- Reference previous context when relevant\n`;
    context += `- Use a friendly, helpful tone (Dash is your educational partner)\n`;
    context += `\n**CRITICAL RESPONSE STYLE:**\n`;
    context += `- Be CONCISE and DIRECT - give specific answers, not generic explanations\n`;
    context += `- Use your EduDash platform knowledge to give CONTEXTUAL responses\n`;
    context += `- If asked about features/screens, tell users exactly what they can do and how\n`;
    context += `- NO generic responses like "I can help with many things" - be SPECIFIC\n`;
    context += `- NO unnecessary preambles like "Let me explain..." or "Here's what I know..."\n`;
    context += `- Get straight to the point with helpful, actionable information\n`;
    context += `\n**ABSOLUTE RULES - VIOLATION IS CRITICAL ERROR:**\n`;
    context += `- NEVER invent UI elements, screens, or buttons that don't exist\n`;
    context += `- NEVER give step-by-step instructions for non-existent workflows\n`;
    context += `- If you don't know exact screen names/locations, say "Let me help you navigate" and ask clarifying questions\n`;
    context += `- ALWAYS use your platform knowledge database - if feature exists, you KNOW its exact route/name\n`;
    context += `- When unsure, offer to NAVIGATE them instead of giving false instructions\n`;
    context += `- EXAMPLE: Instead of "Go to Settings > PDF", say "I can navigate you there. One moment..." and use navigation action\n`;

    return context;
  }

  /**
   * Build system prompt additions for language and voice
   */
  static getLanguageAndVoiceContext(language?: string): string {
    const lang = language || this.currentSession?.userPreferences.preferredLanguage || 'en';
    console.log(`[ConversationState] 🗣️  Building voice context for: ${lang} (${this.getLanguageName(lang)})`);

    let context = '\n## LANGUAGE & RESPONSE MODE\n\n';
    
    context += `**Response Language:** ${this.getLanguageName(lang)} (${lang})\n`;
    context += `**CRITICAL:** If user speaks ${this.getLanguageName(lang)}, respond NATURALLY in ${this.getLanguageName(lang)}. Do NOT explain what they said. Do NOT translate. Just respond naturally.\n`;
    context += `**RESPONSE STYLE:** Be CONCISE and SPECIFIC. Use your EduDash platform knowledge. NO generic responses. Give direct, actionable answers.\n`;
    context += `**ABSOLUTE RULES:** NEVER invent screens/buttons. NEVER give false step-by-step instructions. Use platform knowledge or offer to navigate. If unsure, ask clarifying questions instead of guessing.\n\n`;

    // Language-specific natural response examples
    switch (lang) {
      case 'af':
        context += `**Example Response (Afrikaans):**\n`;
        context += `If user says "Hallo Dash", respond: "Hallo! Hoe gaan dit vandag?"\n`;
        context += `NOT: "'Hallo' is Afrikaans for hello. Let me explain..."\n\n`;
        break;
      case 'zu':
        context += `**Example Response (isiZulu):**\n`;
        context += `If user says "Unjani Dash?", respond: "Ngiyaphila, ngiyabonga! Wena unjani?"\n`;
        context += `NOT: "You asked 'How are you' in Zulu. Let me explain..."\n\n`;
        break;
      case 'xh':
        context += `**Example Response (isiXhosa):**\n`;
        context += `If user says "Molo Dash", respond: "Molo! Unjani namhlanje?"\n`;
        context += `NOT: "'Molo' means hello in Xhosa. Let me teach you..."\n\n`;
        break;
      case 'nso':
        context += `**Example Response (Sepedi):**\n`;
        context += `If user says "Thobela Dash", respond: "Thobela! O kae?"\n`;
        context += `NOT: "'Thobela' is a Sepedi greeting. Let me explain..."\n\n`;
        break;
      default:
        context += `**Example Response (English):**\n`;
        context += `If user says "Hi Dash", respond: "Hi! How can I help you today?"\n`;
        context += `Be conversational, not educational unless specifically teaching.\n\n`;
    }

    return context;
  }

  /**
   * Get language name from code
   */
  private static getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      en: 'English',
      af: 'Afrikaans',
      zu: 'isiZulu',
      xh: 'isiXhosa',
      st: 'Sesotho'
    };
    return languages[code] || 'English';
  }

  /**
   * End the current session
   */
  static async endSession(): Promise<void> {
    this.currentSession = null;
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_SESSION);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }

  /**
   * Persist session to storage
   */
  private static async persistSession(): Promise<void> {
    if (this.currentSession) {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY_SESSION, 
          JSON.stringify(this.currentSession)
        );
      } catch (error) {
        console.error('Failed to persist conversation session:', error);
      }
    }
  }

  /**
   * Get session statistics
   */
  static getSessionStats() {
    if (!this.currentSession) {
      return null;
    }

    const sessionDuration = Date.now() - this.currentSession.startTime;
    const minutesActive = Math.floor(sessionDuration / 60000);

    return {
      sessionId: this.currentSession.sessionId,
      duration: minutesActive,
      topicsCount: this.currentSession.topicsDiscussed.length,
      actionsCount: this.currentSession.actionsPerformed.length,
      hasGreeted: this.currentSession.hasGreeted
    };
  }
}
