/**
 * DashContextBuilder
 * 
 * Builds AI context from user profile, memory, and conversation history.
 * Manages personality settings and user preferences.
 * 
 * Responsibilities:
 * - Load and persist user profiles
 * - Manage personality settings
 * - Build personalized AI context
 * - Handle user preferences
 * 
 * Extracted from DashAIAssistant.ts as part of Phase 4.6 modularization.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { DashMemoryManager } from './DashMemoryManager';
import { getCurrentProfile } from '@/lib/sessionManager';
import { container, TOKENS } from '@/lib/di/providers/default';

// Dynamic SecureStore import for cross-platform compatibility
let SecureStore: any = null;
try {
  if (Platform.OS !== 'web') {
    SecureStore = require('expo-secure-store');
  }
} catch (e) {
  console.debug('[DashContextBuilder] SecureStore not available');
}

// Types
export interface DashUserProfile {
  userId: string;
  role: 'teacher' | 'principal' | 'parent' | 'student' | 'admin';
  name: string;
  preferences: {
    communication_style: 'formal' | 'casual' | 'friendly';
    notification_frequency: 'immediate' | 'daily_digest' | 'weekly_summary';
    preferred_subjects?: string[];
    working_hours?: {
      start: string;
      end: string;
      timezone: string;
    };
    task_management_style: 'detailed' | 'summary' | 'minimal';
    ai_autonomy_level: 'high' | 'medium' | 'low';
  };
  context: {
    current_classes?: string[];
    current_students?: string[];
    current_subjects?: string[];
    organization_id?: string;
    grade_levels?: string[];
    responsibilities?: string[];
  };
  goals: {
    short_term: DashGoal[];
    long_term: DashGoal[];
    completed: DashGoal[];
  };
  interaction_patterns: {
    most_active_times: string[];
    preferred_task_types: string[];
    common_requests: Array<{
      pattern: string;
      frequency: number;
      last_used: number;
    }>;
    success_metrics: Record<string, number>;
  };
  memory_preferences: {
    remember_personal_details: boolean;
    remember_work_patterns: boolean;
    remember_preferences: boolean;
    auto_suggest_tasks: boolean;
    proactive_reminders: boolean;
  };
}

export interface DashGoal {
  id: string;
  title: string;
  description: string;
  category: 'academic' | 'administrative' | 'personal' | 'professional_development';
  priority: 'low' | 'medium' | 'high';
  target_date?: number;
  progress: number;
  metrics: Array<{
    name: string;
    target: number;
    current: number;
    unit: string;
  }>;
  related_tasks: string[];
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  created_at: number;
  updated_at: number;
}

export interface DashPersonality {
  name: string;
  greeting: string;
  personality_traits: string[];
  response_style: 'formal' | 'casual' | 'encouraging' | 'professional' | 'adaptive';
  expertise_areas: string[];
  voice_settings: {
    rate: number;
    pitch: number;
    language: string;
    voice?: string;
  };
  role_specializations: {
    [role: string]: {
      greeting: string;
      capabilities: string[];
      tone: string;
      proactive_behaviors: string[];
      task_categories: string[];
    };
  };
  agentic_settings: {
    autonomy_level: 'low' | 'medium' | 'high';
    can_create_tasks: boolean;
    can_schedule_actions: boolean;
    can_access_data: boolean;
    can_send_notifications: boolean;
    requires_confirmation_for: string[];
  };
}

export const DEFAULT_PERSONALITY: DashPersonality = {
  name: 'Dash',
  greeting: "Hello I am Dash. How can I assist you today?",
  personality_traits: [
    'helpful',
    'intelligent',
    'efficient',
    'proactive',
    'adaptable',
    'clear',
    'reliable'
  ],
  response_style: 'adaptive',
  expertise_areas: [
    'general assistance',
    'task automation',
    'data analysis',
    'workflow optimization',
    'information retrieval',
    'problem solving',
    'productivity tools',
    'communication',
    'decision support',
    'system management'
  ],
  voice_settings: {
    rate: 1.0,
    pitch: 1.0,
    language: 'en-ZA',
    voice: 'male'
  },
  role_specializations: {
    user: {
      greeting: "Hello I am Dash. How can I assist you today?",
      capabilities: [
        'general_assistance',
        'task_management',
        'content_creation',
        'organization',
        'communication',
        'analysis',
        'planning',
        'automation',
        'research',
        'documentation'
      ],
      tone: 'friendly and helpful',
      proactive_behaviors: [
        'suggest_improvements',
        'remind_deadlines',
        'flag_concerns',
        'recommend_resources'
      ],
      task_categories: ['general', 'organization', 'communication']
    },
    teacher: {
      greeting: "Hello I am Dash. How can I assist you today?",
      capabilities: [
        'content_creation',
        'organization',
        'communication',
        'analysis',
        'planning',
        'automation',
        'research',
        'documentation'
      ],
      tone: 'professional and supportive',
      proactive_behaviors: [
        'suggest_improvements',
        'remind_deadlines',
        'flag_concerns',
        'recommend_resources'
      ],
      task_categories: ['content', 'planning', 'communication']
    },
    principal: {
      greeting: "Hello I am Dash. How can I assist you today?",
      capabilities: [
        'management',
        'analytics',
        'reporting',
        'communication',
        'planning',
        'optimization',
        'decision_support',
        'compliance'
      ],
      tone: 'professional and strategic',
      proactive_behaviors: [
        'monitor_metrics',
        'suggest_strategies',
        'flag_concerns',
        'track_goals'
      ],
      task_categories: ['management', 'strategic', 'operational']
    },
    parent: {
      greeting: "Hello I am Dash. How can I assist you today?",
      capabilities: [
        'information',
        'organization',
        'communication',
        'planning',
        'research',
        'assistance',
        'reminders',
        'guidance'
      ],
      tone: 'friendly and helpful',
      proactive_behaviors: [
        'remind_deadlines',
        'suggest_activities',
        'flag_updates',
        'recommend_actions'
      ],
      task_categories: ['organization', 'communication', 'personal']
    }
  },
  agentic_settings: {
    autonomy_level: 'medium',
    can_create_tasks: true,
    can_schedule_actions: true,
    can_access_data: true,
    can_send_notifications: false,
    requires_confirmation_for: [
      'send_external_emails',
      'modify_grades',
      'delete_important_data',
      'share_personal_information'
    ]
  }
};

/**
 * Manages AI context building and user profile/personality
 */
export class DashContextBuilder {
  private userProfile: DashUserProfile | null = null;
  private personality: DashPersonality = DEFAULT_PERSONALITY;
  private isDisposed = false;
  
  // Storage keys
  private static readonly PERSONALITY_KEY = 'dash_personality';
  private static readonly USER_PROFILE_KEY = 'dash_user_profile';
  
  constructor(private memoryManager: DashMemoryManager) {}
  
  /**
   * Load user context for personalization (organization-aware)
   */
  public async loadUserContext(): Promise<void> {
    this.checkDisposed();
    try {
      const profile = await getCurrentProfile();
      if (profile) {
        // Get organization type from profile
        const orgType = (profile as any).organization_type || 'preschool';
        const userName = (profile as any).first_name || (profile as any).display_name;
        
        // Update personality based on organization and role
        this.personality = {
          ...this.personality,
          greeting: this.getPersonalizedGreeting(profile.role, orgType, userName),
          expertise_areas: this.getExpertiseAreasForRole(profile.role, orgType)
        };
      }
    } catch (error) {
      console.error('[DashContextBuilder] Failed to load user context:', error);
    }
  }
  
  /**
   * Get personalized greeting based on organization type and role
   * Uses dynamic organization configuration system
   */
  private getPersonalizedGreeting(role: string, organizationType: string = 'preschool', userName?: string): string {
    try {
      const org = container.resolve(TOKENS.organization);
      const dynamicGreeting = org.getGreeting(organizationType, role, userName);
      if (dynamicGreeting) return dynamicGreeting;
    } catch (error) {
      console.warn('[DashContextBuilder] Failed to get dynamic greeting, using fallback:', error);
    }
    
    // Fallback to default greetings
    switch (role?.toLowerCase()) {
      case 'teacher':
      case 'professor':
      case 'instructor':
      case 'coach':
      case 'trainer':
        return "Hello I am Dash. How can I assist you today?";
      case 'principal':
      case 'dean':
      case 'director':
      case 'manager':
        return "Hello I am Dash. How can I assist you today?";
      case 'parent':
      case 'guardian':
        return "Hello I am Dash. How can I assist you today?";
      default:
        return DEFAULT_PERSONALITY.greeting;
    }
  }
  
  /**
   * Get expertise areas based on organization type and role
   * Uses dynamic organization configuration system
   */
  private getExpertiseAreasForRole(role: string, organizationType: string = 'preschool'): string[] {
    try {
      const org = container.resolve(TOKENS.organization);
      const capabilities = org.getCapabilities(organizationType, role);
      if (capabilities.length > 0) {
        const orgName = org.mapTerm('organization' as any, organizationType);
        const memberName = org.mapTerm('member' as any, organizationType);
        const baseAreas = [orgName, `${memberName} support`];
        return [...baseAreas, ...capabilities];
      }
    } catch (error) {
      console.warn('[DashContextBuilder] Failed to get dynamic expertise areas, using fallback:', error);
    }
    
    // Fallback to default areas
    const baseAreas = ['organization support', 'member support'];
    
    switch (role?.toLowerCase()) {
      case 'teacher':
      case 'professor':
      case 'instructor':
      case 'coach':
      case 'trainer':
        return [...baseAreas, 'planning', 'assessment', 'content creation'];
      case 'principal':
      case 'dean':
      case 'director':
      case 'manager':
        return [...baseAreas, 'administration', 'staff management', 'analytics'];
      case 'parent':
      case 'guardian':
        return [...baseAreas, 'progress tracking', 'communication'];
      default:
        return DEFAULT_PERSONALITY.expertise_areas;
    }
  }
  
  /**
   * Load personality settings
   */
  public async loadPersonality(): Promise<void> {
    this.checkDisposed();
    try {
      const storage = SecureStore || AsyncStorage;
      const personalityData = await storage.getItem(DashContextBuilder.PERSONALITY_KEY);
      
      if (personalityData) {
        const savedPersonality = JSON.parse(personalityData);
        this.personality = { ...DEFAULT_PERSONALITY, ...savedPersonality };
      }
    } catch (error) {
      console.error('[DashContextBuilder] Failed to load personality:', error);
    }
  }
  
  /**
   * Save personality settings
   */
  public async savePersonality(personality: Partial<DashPersonality>): Promise<void> {
    this.checkDisposed();
    try {
      this.personality = { ...this.personality, ...personality };
      
      const storage = SecureStore || AsyncStorage;
      await storage.setItem(DashContextBuilder.PERSONALITY_KEY, JSON.stringify(this.personality));
    } catch (error) {
      console.error('[DashContextBuilder] Failed to save personality:', error);
    }
  }
  
  /**
   * Get current personality
   */
  public getPersonality(): DashPersonality {
    this.checkDisposed();
    return this.personality;
  }
  
  /**
   * Load user profile
   */
  public async loadUserProfile(): Promise<void> {
    this.checkDisposed();
    try {
      const storage = SecureStore || AsyncStorage;
      const profileData = await storage.getItem(DashContextBuilder.USER_PROFILE_KEY);
      
      if (profileData) {
        this.userProfile = JSON.parse(profileData);
        console.log(`[DashContextBuilder] Loaded user profile for ${this.userProfile?.role || 'unknown'}`);
      } else {
        // Create basic profile from current user
        const currentProfile = await getCurrentProfile();
        if (currentProfile) {
          this.userProfile = {
            userId: currentProfile.id,
            role: currentProfile.role as any,
            name: (currentProfile as any).first_name || 'User',
            preferences: {
              communication_style: 'friendly',
              notification_frequency: 'daily_digest',
              task_management_style: 'summary',
              ai_autonomy_level: 'medium'
            },
            context: {
              organization_id: currentProfile.organization_id || undefined
            },
            goals: {
              short_term: [],
              long_term: [],
              completed: []
            },
            interaction_patterns: {
              most_active_times: [],
              preferred_task_types: [],
              common_requests: [],
              success_metrics: {}
            },
            memory_preferences: {
              remember_personal_details: true,
              remember_work_patterns: true,
              remember_preferences: true,
              auto_suggest_tasks: true,
              proactive_reminders: true
            }
          };
          await this.saveUserProfile();
        }
      }
    } catch (error) {
      console.error('[DashContextBuilder] Failed to load user profile:', error);
    }
  }
  
  /**
   * Save user profile
   */
  private async saveUserProfile(): Promise<void> {
    if (!this.userProfile) return;
    
    try {
      const storage = SecureStore || AsyncStorage;
      await storage.setItem(DashContextBuilder.USER_PROFILE_KEY, JSON.stringify(this.userProfile));
    } catch (error) {
      console.error('[DashContextBuilder] Failed to save user profile:', error);
    }
  }
  
  /**
   * Get user profile
   */
  public getUserProfile(): DashUserProfile | null {
    this.checkDisposed();
    return this.userProfile;
  }
  
  /**
   * Update user preferences
   */
  public async updateUserPreferences(preferences: Partial<DashUserProfile['preferences']>): Promise<void> {
    this.checkDisposed();
    if (!this.userProfile) return;
    
    this.userProfile.preferences = {
      ...this.userProfile.preferences,
      ...preferences
    };
    
    await this.saveUserProfile();
  }
  
  /**
   * Build AI context from user profile and memory
   */
  public async buildContext(conversationId?: string): Promise<string> {
    this.checkDisposed();
    try {
      const contextParts: string[] = [];
      
      // User profile context
      if (this.userProfile) {
        contextParts.push(`User: ${this.userProfile.name} (${this.userProfile.role})`);
        contextParts.push(`Preferences: ${this.userProfile.preferences.communication_style} communication`);
        
        if (this.userProfile.context.current_subjects?.length) {
          contextParts.push(`Subjects: ${this.userProfile.context.current_subjects.join(', ')}`);
        }
      }
      
      // Memory context (recent interactions)
      const recentMemories = this.memoryManager.getAllMemoryItems()
        .filter(item => item.created_at > Date.now() - (24 * 60 * 60 * 1000))
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 5);
      
      if (recentMemories.length > 0) {
        contextParts.push(`Recent context: ${recentMemories.map(m => m.key).join(', ')}`);
      }
      
      // Personality context
      contextParts.push(`Style: ${this.personality.response_style}`);
      
      return contextParts.join('\n');
    } catch (error) {
      console.error('[DashContextBuilder] Failed to build context:', error);
      return '';
    }
  }
  
  /**
   * Check if instance is disposed
   */
  private checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error('[DashContextBuilder] Instance has been disposed');
    }
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    this.isDisposed = true;
    this.userProfile = null;
    console.log('[DashContextBuilder] Disposed');
  }
}
