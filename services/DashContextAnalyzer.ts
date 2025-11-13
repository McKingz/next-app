/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Dash Context Analyzer
 * 
 * Advanced context understanding and intent recognition system
 * for the enhanced Dash AI Assistant
 */

import { assertSupabase } from '@/lib/supabase';
import { getCurrentSession, getCurrentProfile } from '@/lib/sessionManager';
import type { DashUserProfile, DashMemoryItem, DashInsight } from './dash-ai/types';

export interface UserIntent {
  primary_intent: string;
  secondary_intents: string[];
  confidence: number;
  parameters: Record<string, any>;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  category: 'information' | 'action' | 'assistance' | 'automation';
}

export interface ContextData {
  current_screen?: string;
  recent_actions: string[];
  time_context: {
    hour: number;
    day_of_week: string;
    is_work_hours: boolean;
    academic_period?: string;
  };
  user_state: {
    role: string;
    mood?: 'positive' | 'neutral' | 'frustrated' | 'excited';
    stress_level?: 'low' | 'medium' | 'high';
    engagement_level?: 'low' | 'medium' | 'high';
  };
  app_context: {
    active_features: string[];
    recent_errors?: string[];
    performance_issues?: string[];
  };
  educational_context?: {
    current_subject?: string;
    grade_level?: string;
    activity_phase?: 'planning' | 'execution' | 'assessment' | 'review';
    members_present?: boolean;  // Generic: students, employees, athletes, etc.
    // Legacy support
    lesson_phase?: 'planning' | 'teaching' | 'assessment' | 'review';
    students_present?: boolean;
  };
}

export interface ProactiveOpportunity {
  id: string;
  type: 'suggestion' | 'reminder' | 'automation' | 'insight';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  actions: Array<{
    label: string;
    action: string;
    parameters?: any;
  }>;
  timing: {
    immediate: boolean;
    best_time?: number;
    expires_at?: number;
  };
  context_requirements: string[];
}

/**
 * Interface for DashContextAnalyzer
 */
export interface IDashContextAnalyzer {
  analyzeUserInput(input: string, conversationHistory: Array<{ role: string; content: string }>, currentContext?: ContextData): Promise<{ intent: UserIntent; context: ContextData; opportunities: ProactiveOpportunity[]; insights: DashInsight[] }>;
  persistContextSnapshot(context: ContextData): Promise<void>;
  loadLastContextSnapshot(): Promise<ContextData | null>;
  estimateEmotionalState(input: string, conversationHistory: Array<{ role: string; content: string }>): { mood: string; confidence: number; trend: 'stable' | 'improving' | 'declining' };
  computeStressLevel(input: string, conversationHistory: Array<{ role: string; content: string }>, recentErrors?: string[]): 'low' | 'medium' | 'high';
  blendContexts(current: ContextData, historical: ContextData | null): ContextData;
  getPredictedNextNeeds(context: ContextData, conversationHistory: Array<{ role: string; content: string }>): Array<{ need: string; confidence: number; reasoning: string }>;
  calculateEngagementScore(conversationHistory: Array<{ role: string; content: string }>, timeWindowMs?: number): { level: 'low' | 'medium' | 'high'; score: number };
  dispose(): void;
}

export class DashContextAnalyzer implements IDashContextAnalyzer {
  // Static getInstance method for singleton pattern
  static getInstance: () => DashContextAnalyzer;
  
  // ===== PHASE 1.4: AGENTIC ENHANCEMENTS =====
  private lastSnapshotTime: number = 0;
  private snapshotIntervalMs: number = 5 * 60 * 1000; // 5 minutes
  private emotionalHistory: Array<{ mood: string; timestamp: number }> = [];
  private errorHistory: Array<{ error: string; timestamp: number }> = [];
  private readonly MAX_HISTORY_SIZE = 20;
  
  // Sentiment lexicon for emotional state estimation
  private readonly sentimentLexicon = {
    positive: ['great', 'awesome', 'excellent', 'perfect', 'love', 'amazing', 'wonderful', 'fantastic', 'happy'],
    negative: ['frustrated', 'annoying', 'difficult', 'stuck', 'confused', 'hard', 'problem', 'issue', 'error'],
    urgent: ['urgent', 'asap', 'immediately', 'now', 'quickly', 'hurry', 'emergency', 'critical'],
    calm: ['thanks', 'ok', 'fine', 'understood', 'got it', 'clear']
  };
  
  // Intent recognition patterns
  private intentPatterns: Map<string, RegExp[]> = new Map([
    ['create_lesson', [
      /create.*lesson/i,
      /plan.*lesson/i,
      /new.*lesson/i,
      /lesson.*plan/i,
      /teach.*about/i
    ]],
    ['grade_assignment', [
      /grade.*assignment/i,
      /grade.*homework/i,
      /mark.*work/i,
      /assess.*student/i,
      /check.*answers/i
    ]],
    ['parent_communication', [
      /contact.*parent/i,
      /send.*message.*parent/i,
      /parent.*meeting/i,
      /update.*parent/i,
      /inform.*parent/i
    ]],
    ['member_progress', [  // Generic: student, employee, athlete progress
      /(student|member|employee|athlete).*progress/i,
      /track.*(student|member|employee|athlete)/i,
      /(student|member|employee|athlete).*performance/i,
      /how.*doing/i,
      /(student|member|employee|athlete).*report/i
    ]],
    ['homework_help', [
      /help.*homework/i,
      /homework.*help/i,
      /explain.*problem/i,
      /understand.*concept/i,
      /study.*help/i
    ]],
    ['schedule_task', [
      /schedule/i,
      /remind.*me/i,
      /set.*reminder/i,
      /don't forget/i,
      /later/i
    ]],
    ['data_analysis', [
      /analyze.*data/i,
      /show.*stats/i,
      /report.*on/i,
      /dashboard/i,
      /metrics/i
    ]],
    ['automate_task', [
      /automate/i,
      /automatically/i,
      /do.*for.*me/i,
      /handle.*this/i,
      /take.*care.*of/i
    ]],
    ['emergency_help', [
      /emergency/i,
      /urgent/i,
      /asap/i,
      /immediately/i,
      /crisis/i
    ]],
    ['workflow_optimization', [
      /optimize/i,
      /improve.*workflow/i,
      /more.*efficient/i,
      /streamline/i,
      /better.*way/i
    ]]
  ]);

  // Context understanding patterns
  private contextPatterns = {
    frustration: [/frustrated/i, /annoying/i, /difficult/i, /hard/i, /stuck/i],
    excitement: [/excited/i, /amazing/i, /great/i, /awesome/i, /love/i],
    urgency: [/urgent/i, /asap/i, /immediately/i, /now/i, /quickly/i],
    confusion: [/confused/i, /don't understand/i, /unclear/i, /help/i, /lost/i]
  };

  constructor() {
    // Constructor is now public for DI
  }

  /**
   * Analyze user input to determine intent and context
   */
  public async analyzeUserInput(
    input: string,
    conversationHistory: Array<{ role: string; content: string }>,
    currentContext?: ContextData
  ): Promise<{
    intent: UserIntent;
    context: ContextData;
    opportunities: ProactiveOpportunity[];
    insights: DashInsight[];
  }> {
    try {
      // Analyze intent
      const intent = await this.recognizeIntent(input, conversationHistory);
      
      // Gather context
      const context = await this.gatherContext(currentContext);
      
      // Find proactive opportunities
      const opportunities = await this.findProactiveOpportunities(intent, context, conversationHistory);
      
      // Generate insights
      const insights = await this.generateContextualInsights(intent, context, input);

      return {
        intent,
        context,
        opportunities,
        insights
      };
    } catch (error) {
      console.error('[DashContext] Analysis failed:', error);
      
      // Return fallback analysis
      return {
        intent: {
          primary_intent: 'general_assistance',
          secondary_intents: [],
          confidence: 0.5,
          parameters: {},
          urgency: 'medium',
          category: 'assistance'
        },
        context: await this.gatherContext(currentContext),
        opportunities: [],
        insights: []
      };
    }
  }

  /**
   * Recognize user intent from input
   */
  private async recognizeIntent(
    input: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<UserIntent> {
    const inputLower = input.toLowerCase();
    const scores: Array<{ intent: string; confidence: number; matches: string[] }> = [];

    // Pattern matching
    for (const [intent, patterns] of Array.from(this.intentPatterns.entries())) {
      const matches: string[] = [];
      let confidence = 0;

      for (const pattern of patterns) {
        const match = inputLower.match(pattern);
        if (match) {
          matches.push(match[0]);
          confidence += 0.3; // Base confidence for pattern match
        }
      }

      if (matches.length > 0) {
        scores.push({ intent, confidence, matches });
      }
    }

    // Context from conversation history
    const recentMessages = conversationHistory.slice(-3);
    for (const message of recentMessages) {
      if (message.role === 'user') {
        for (const [intent, patterns] of Array.from(this.intentPatterns.entries())) {
          const isRelated = patterns.some(pattern => pattern.test(message.content.toLowerCase()));
          if (isRelated) {
            const existingScore = scores.find(s => s.intent === intent);
            if (existingScore) {
              existingScore.confidence += 0.1; // Boost for conversation context
            } else {
              scores.push({ intent, confidence: 0.1, matches: ['context'] });
            }
          }
        }
      }
    }

    // Analyze emotional context
    const urgency = this.detectUrgency(input);
    const category = this.categorizeIntent(input);

    // Get the highest scoring intent
    scores.sort((a, b) => b.confidence - a.confidence);
    const topIntent = scores[0];

    if (!topIntent || topIntent.confidence < 0.2) {
      return {
        primary_intent: 'general_assistance',
        secondary_intents: scores.slice(1, 3).map(s => s.intent),
        confidence: 0.5,
        parameters: this.extractParameters(input),
        urgency,
        category
      };
    }

    return {
      primary_intent: topIntent.intent,
      secondary_intents: scores.slice(1, 3).map(s => s.intent),
      confidence: Math.min(topIntent.confidence, 1.0),
      parameters: this.extractParameters(input),
      urgency,
      category
    };
  }

  /**
   * Detect urgency level from input
   */
  private detectUrgency(input: string): 'low' | 'medium' | 'high' | 'urgent' {
    const inputLower = input.toLowerCase();
    
    if (this.contextPatterns.urgency.some(pattern => pattern.test(inputLower))) {
      return 'urgent';
    }
    
    if (inputLower.includes('important') || inputLower.includes('priority')) {
      return 'high';
    }
    
    if (inputLower.includes('when you can') || inputLower.includes('no rush')) {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Categorize intent type
   */
  private categorizeIntent(input: string): 'information' | 'action' | 'assistance' | 'automation' {
    const inputLower = input.toLowerCase();
    
    if (inputLower.includes('what') || inputLower.includes('how') || inputLower.includes('why') || inputLower.includes('show')) {
      return 'information';
    }
    
    if (inputLower.includes('do') || inputLower.includes('create') || inputLower.includes('make') || inputLower.includes('send')) {
      return 'action';
    }
    
    if (inputLower.includes('automate') || inputLower.includes('automatically') || inputLower.includes('schedule')) {
      return 'automation';
    }
    
    return 'assistance';
  }

  /**
   * Extract parameters from user input
   */
  private extractParameters(input: string): Record<string, any> {
    const parameters: Record<string, any> = {};
    
    // Extract common parameters
    const subjectMatch = input.match(/(?:about|on|for|in)\s+([A-Za-z]+)/i);
    if (subjectMatch) {
      parameters.subject = subjectMatch[1];
    }
    
    const gradeMatch = input.match(/grade\s+(\d+|[A-Z])/i);
    if (gradeMatch) {
      parameters.grade = gradeMatch[1];
    }
    
    const timeMatch = input.match(/(?:at|by|on|in)\s+(\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm)|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (timeMatch) {
      parameters.time = timeMatch[1];
    }
    
    // Generic member matching (students, employees, athletes, etc.)
    const memberMatch = input.match(/(student|member|employee|athlete)(?:s)?\s+([A-Za-z\s,]+)/i);
    if (memberMatch) {
      parameters.members = memberMatch[2].split(',').map(s => s.trim());
      parameters.memberType = memberMatch[1];  // Track what type of member
      // Legacy support
      if (memberMatch[1].toLowerCase() === 'student') {
        parameters.students = parameters.members;
      }
    }
    
    return parameters;
  }

  /**
   * Gather current context
   */
  private async gatherContext(existingContext?: ContextData): Promise<ContextData> {
    try {
      const profile = await getCurrentProfile();
      const now = new Date();
      
      const context: ContextData = {
        ...existingContext,
        recent_actions: existingContext?.recent_actions || [],
        time_context: {
          hour: now.getHours(),
          day_of_week: now.toLocaleDateString('en', { weekday: 'long' }),
          is_work_hours: now.getHours() >= 8 && now.getHours() <= 17,
          academic_period: this.getAcademicPeriod(now)
        },
        user_state: {
          role: profile?.role || 'unknown',
          ...existingContext?.user_state
        },
        app_context: {
          active_features: existingContext?.app_context?.active_features || [],
          ...existingContext?.app_context
        }
      };

      return context;
    } catch (error) {
      console.error('[DashContext] Failed to gather context:', error);
      return existingContext || {} as ContextData;
    }
  }

  /**
   * Get current academic period
   */
  private getAcademicPeriod(date: Date): string {
    const month = date.getMonth() + 1; // 0-based to 1-based
    
    if (month >= 1 && month <= 3) return 'Q1';
    if (month >= 4 && month <= 6) return 'Q2';
    if (month >= 7 && month <= 9) return 'Q3';
    return 'Q4';
  }

  /**
   * Find proactive opportunities
   */
  private async findProactiveOpportunities(
    intent: UserIntent,
    context: ContextData,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<ProactiveOpportunity[]> {
    const opportunities: ProactiveOpportunity[] = [];
    
    try {
      // Role-based opportunities (supports dynamic organization roles)
      const role = context.user_state.role;
      
      // Map to opportunity finder based on role type
      if (['teacher', 'professor', 'instructor', 'coach', 'trainer'].includes(role)) {
        opportunities.push(...await this.findEducatorOpportunities(intent, context));
      } else if (['principal', 'dean', 'director', 'manager', 'admin'].includes(role)) {
        opportunities.push(...await this.findLeaderOpportunities(intent, context));
      } else if (['parent', 'guardian'].includes(role)) {
        opportunities.push(...await this.findParentOpportunities(intent, context));
      } else if (['student', 'employee', 'athlete', 'member'].includes(role)) {
        opportunities.push(...await this.findMemberOpportunities(intent, context));
      }

      // Time-based opportunities
      opportunities.push(...this.findTimeBasedOpportunities(context));
      
      // Pattern-based opportunities
      opportunities.push(...this.findPatternOpportunities(conversationHistory, context));
      
    } catch (error) {
      console.error('[DashContext] Failed to find opportunities:', error);
    }
    
    return opportunities.sort((a, b) => {
      const priorityScore = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityScore[b.priority] - priorityScore[a.priority];
    });
  }

  /**
   * Find opportunities for educators (teachers, professors, coaches, trainers)
   */
  private async findEducatorOpportunities(intent: UserIntent, context: ContextData): Promise<ProactiveOpportunity[]> {
    const opportunities: ProactiveOpportunity[] = [];
    
    // If creating lessons, suggest curriculum alignment
    if (intent.primary_intent === 'create_lesson') {
      opportunities.push({
        id: 'curriculum_alignment',
        type: 'suggestion',
        priority: 'medium',
        title: 'Align with Curriculum Standards',
        description: 'Would you like me to ensure this lesson aligns with current curriculum standards?',
        actions: [
          { label: 'Yes, align', action: 'align_curriculum', parameters: { subject: intent.parameters.subject } },
          { label: 'Skip', action: 'continue', parameters: {} }
        ],
        timing: { immediate: true },
        context_requirements: ['lesson_planning']
      });
    }
    
    // If end of day, suggest tomorrow's prep
    if (context.time_context.hour >= 16 && context.time_context.is_work_hours) {
      opportunities.push({
        id: 'tomorrow_prep',
        type: 'reminder',
        priority: 'medium',
        title: 'Prepare for Tomorrow',
        description: "Before you go, would you like me to help prepare for tomorrow's lessons?",
        actions: [
          { label: 'Yes, help prep', action: 'prepare_tomorrow' },
          { label: 'Later', action: 'remind_later', parameters: { hours: 2 } }
        ],
        timing: { immediate: false, best_time: Date.now() + (30 * 60 * 1000) },
        context_requirements: ['work_hours_ending']
      });
    }
    
    return opportunities;
  }

  /**
   * Find opportunities for organization leaders (principals, deans, directors, managers)
   */
  private async findLeaderOpportunities(intent: UserIntent, context: ContextData): Promise<ProactiveOpportunity[]> {
    const opportunities: ProactiveOpportunity[] = [];
    
    // Morning briefing opportunity
    if (context.time_context.hour === 8 && context.time_context.day_of_week !== 'Saturday' && context.time_context.day_of_week !== 'Sunday') {
      opportunities.push({
        id: 'morning_briefing',
        type: 'insight',
        priority: 'high',
        title: 'Daily School Overview',
        description: 'Get your daily school metrics and important updates',
        actions: [
          { label: 'Show briefing', action: 'show_daily_briefing' },
          { label: 'Skip today', action: 'skip_briefing' }
        ],
        timing: { immediate: true },
        context_requirements: ['principal_role', 'work_hours']
      });
    }
    
    return opportunities;
  }

  /**
   * Find opportunities for parents
   */
  private async findParentOpportunities(intent: UserIntent, context: ContextData): Promise<ProactiveOpportunity[]> {
    const opportunities: ProactiveOpportunity[] = [];
    
    // Evening homework check
    if (context.time_context.hour >= 18 && context.time_context.hour <= 20) {
      opportunities.push({
        id: 'homework_check',
        type: 'reminder',
        priority: 'medium',
        title: 'Homework Time',
        description: 'Would you like me to help check if your child has completed their homework?',
        actions: [
          { label: 'Check homework', action: 'check_homework' },
          { label: 'Not tonight', action: 'skip_homework_check' }
        ],
        timing: { immediate: false, best_time: Date.now() + (15 * 60 * 1000) },
        context_requirements: ['parent_role', 'evening_hours']
      });
    }
    
    return opportunities;
  }

  /**
   * Find opportunities for members (students, employees, athletes, etc.)
   */
  private async findMemberOpportunities(intent: UserIntent, context: ContextData): Promise<ProactiveOpportunity[]> {
    const opportunities: ProactiveOpportunity[] = [];
    
    // Study break reminder
    if (intent.primary_intent === 'homework_help') {
      opportunities.push({
        id: 'study_break',
        type: 'suggestion',
        priority: 'low',
        title: 'Take a Study Break',
        description: "You've been working hard! Would you like to take a 10-minute break?",
        actions: [
          { label: 'Take break', action: 'schedule_break', parameters: { duration: 10 } },
          { label: 'Keep working', action: 'continue_studying' }
        ],
        timing: { immediate: false, best_time: Date.now() + (45 * 60 * 1000) },
        context_requirements: ['studying']
      });
    }
    
    return opportunities;
  }

  /**
   * Find time-based opportunities
   */
  private findTimeBasedOpportunities(context: ContextData): ProactiveOpportunity[] {
    const opportunities: ProactiveOpportunity[] = [];
    
    // End of week wrap-up
    if (context.time_context.day_of_week === 'Friday' && context.time_context.hour >= 15) {
      opportunities.push({
        id: 'week_wrapup',
        type: 'automation',
        priority: 'medium',
        title: 'Weekly Summary',
        description: 'Generate a summary of this week\'s activities and prepare for next week',
        actions: [
          { label: 'Generate summary', action: 'generate_weekly_summary' },
          { label: 'Skip this week', action: 'skip_summary' }
        ],
        timing: { immediate: false, expires_at: Date.now() + (2 * 60 * 60 * 1000) },
        context_requirements: ['end_of_week']
      });
    }
    
    return opportunities;
  }

  /**
   * Find pattern-based opportunities
   */
  private findPatternOpportunities(
    conversationHistory: Array<{ role: string; content: string }>,
    context: ContextData
  ): ProactiveOpportunity[] {
    const opportunities: ProactiveOpportunity[] = [];
    
    // Detect repetitive tasks
    const userMessages = conversationHistory.filter(m => m.role === 'user').slice(-10);
    const taskCounts = new Map<string, number>();
    
    for (const message of userMessages) {
      const content = message.content.toLowerCase();
      if (content.includes('create') && content.includes('lesson')) {
        taskCounts.set('lesson_creation', (taskCounts.get('lesson_creation') || 0) + 1);
      }
      if (content.includes('grade') || content.includes('mark')) {
        taskCounts.set('grading', (taskCounts.get('grading') || 0) + 1);
      }
    }
    
    // Suggest automation for repeated tasks
    for (const [task, count] of Array.from(taskCounts.entries())) {
      if (count >= 3) {
        opportunities.push({
          id: `automate_${task}`,
          type: 'automation',
          priority: 'medium',
          title: `Automate ${task.replace('_', ' ')}`,
          description: `I notice you often ${task.replace('_', ' ')}. Would you like me to automate parts of this process?`,
          actions: [
            { label: 'Set up automation', action: 'setup_automation', parameters: { task } },
            { label: 'Not now', action: 'dismiss_automation' }
          ],
          timing: { immediate: false, best_time: Date.now() + (5 * 60 * 1000) },
          context_requirements: ['repeated_pattern']
        });
      }
    }
    
    return opportunities;
  }

  /**
   * Generate contextual insights
   */
  private async generateContextualInsights(
    intent: UserIntent,
    context: ContextData,
    input: string
  ): Promise<DashInsight[]> {
    const insights: DashInsight[] = [];
    
    try {
      // Performance insight
      if (context.app_context.performance_issues?.length) {
        insights.push({
          id: `performance_${Date.now()}`,
          type: 'alert',
          title: 'Performance Issue Detected',
          description: 'The app is running slower than usual. This might affect your workflow.',
          confidence: 0.8,
          priority: 'medium',
          category: 'performance',
          data_sources: ['app_metrics'],
          created_at: Date.now(),
          actionable: true,
          suggested_actions: [
            'Restart the app',
            'Clear cache',
            'Check internet connection'
          ]
        });
      }
      
      // Usage pattern insight
      if (context.time_context.is_work_hours && context.user_state.role === 'teacher') {
        insights.push({
          id: `pattern_${Date.now()}`,
          type: 'pattern',
          title: 'Peak Usage Time',
          description: 'You\'re most productive during work hours. Consider scheduling complex tasks now.',
          confidence: 0.7,
          priority: 'low',
          category: 'productivity',
          data_sources: ['usage_patterns'],
          created_at: Date.now(),
          actionable: false
        });
      }
      
    } catch (error) {
      console.error('[DashContext] Failed to generate insights:', error);
    }
    
    return insights;
  }

  // ===== PHASE 1.4: NEW AGENTIC METHODS =====

  /**
   * Persist context snapshot to database for cross-session continuity
   */
  public async persistContextSnapshot(context: ContextData): Promise<void> {
    try {
      // Check if enough time has passed since last snapshot
      const now = Date.now();
      if (now - this.lastSnapshotTime < this.snapshotIntervalMs) {
        return; // Too soon, skip
      }

      const supabase = assertSupabase();
      const profile = await getCurrentProfile();
      if (!profile) return;

      // Feature flag check
      const agenticEnabled = process.env.EXPO_PUBLIC_AGENTIC_ENABLED === 'true';
      if (!agenticEnabled) return;

      await supabase.from('ai_context_snapshots').insert({
        preschool_id: profile.organization_id,
        user_id: profile.id,
        snapshot: context as any
      });

      this.lastSnapshotTime = now;
      console.log('[DashContext] Context snapshot persisted');
    } catch (error) {
      console.error('[DashContext] Failed to persist snapshot:', error);
    }
  }

  /**
   * Load last context snapshot and blend with current context
   */
  public async loadLastContextSnapshot(): Promise<ContextData | null> {
    try {
      const supabase = assertSupabase();
      const profile = await getCurrentProfile();
      if (!profile) return null;

      const { data, error } = await supabase
        .from('ai_context_snapshots')
        .select('snapshot, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      console.log('[DashContext] Loaded context snapshot from', new Date(data.created_at));
      return data.snapshot as ContextData;
    } catch (error) {
      console.error('[DashContext] Failed to load snapshot:', error);
      return null;
    }
  }

  /**
   * Enhanced emotional state estimation with trend analysis
   */
  public estimateEmotionalState(
    input: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): { mood: string; confidence: number; trend: 'improving' | 'stable' | 'declining' } {
    const text = input.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;
    let urgentScore = 0;

    // Analyze current input
    for (const word of this.sentimentLexicon.positive) {
      if (text.includes(word)) positiveScore++;
    }
    for (const word of this.sentimentLexicon.negative) {
      if (text.includes(word)) negativeScore++;
    }
    for (const word of this.sentimentLexicon.urgent) {
      if (text.includes(word)) urgentScore++;
    }

    // Determine mood
    let mood: string;
    let confidence: number;

    if (urgentScore > 0 && negativeScore > positiveScore) {
      mood = 'frustrated';
      confidence = Math.min(0.9, (urgentScore + negativeScore) / 5);
    } else if (positiveScore > negativeScore) {
      mood = positiveScore > 2 ? 'excited' : 'positive';
      confidence = Math.min(0.9, positiveScore / 4);
    } else if (negativeScore > positiveScore) {
      mood = 'frustrated';
      confidence = Math.min(0.9, negativeScore / 4);
    } else {
      mood = 'neutral';
      confidence = 0.6;
    }

    // Add to history
    this.emotionalHistory.push({ mood, timestamp: Date.now() });
    if (this.emotionalHistory.length > this.MAX_HISTORY_SIZE) {
      this.emotionalHistory.shift();
    }

    // Calculate trend
    const trend = this.calculateEmotionalTrend();

    return { mood, confidence, trend };
  }

  /**
   * Calculate emotional trend from history
   */
  private calculateEmotionalTrend(): 'improving' | 'stable' | 'declining' {
    if (this.emotionalHistory.length < 3) return 'stable';

    const moodScores: Record<string, number> = {
      excited: 2,
      positive: 1,
      neutral: 0,
      frustrated: -1
    };

    const recent = this.emotionalHistory.slice(-3);
    const scores = recent.map(h => moodScores[h.mood] || 0);
    const avgRecent = scores.reduce((a, b) => a + b, 0) / scores.length;

    const older = this.emotionalHistory.slice(-6, -3);
    if (older.length < 2) return 'stable';
    
    const olderScores = older.map(h => moodScores[h.mood] || 0);
    const avgOlder = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;

    if (avgRecent > avgOlder + 0.3) return 'improving';
    if (avgRecent < avgOlder - 0.3) return 'declining';
    return 'stable';
  }

  /**
   * Compute stress level from urgency patterns and error frequency
   */
  public computeStressLevel(
    input: string,
    conversationHistory: Array<{ role: string; content: string }>,
    recentErrors: string[] = []
  ): 'low' | 'medium' | 'high' {
    let stressScore = 0;

    // Check urgency keywords in recent messages
    const recentMessages = conversationHistory.slice(-5);
    for (const msg of recentMessages) {
      const text = msg.content.toLowerCase();
      for (const word of this.sentimentLexicon.urgent) {
        if (text.includes(word)) stressScore += 2;
      }
    }

    // Factor in error frequency
    stressScore += recentErrors.length * 3;

    // Add to error history
    for (const error of recentErrors) {
      this.errorHistory.push({ error, timestamp: Date.now() });
    }
    if (this.errorHistory.length > this.MAX_HISTORY_SIZE) {
      this.errorHistory = this.errorHistory.slice(-this.MAX_HISTORY_SIZE);
    }

    // Calculate level
    if (stressScore >= 10) return 'high';
    if (stressScore >= 5) return 'medium';
    return 'low';
  }

  /**
   * Blend historical context with current context for continuity
   */
  public blendContexts(current: ContextData, historical: ContextData | null): ContextData {
    if (!historical) return current;

    // Blend contexts, preferring current but filling gaps with historical
    return {
      ...current,
      user_state: {
        ...historical.user_state,
        ...current.user_state,
      },
      educational_context: {
        ...historical.educational_context,
        ...current.educational_context,
      },
      app_context: {
        ...historical.app_context,
        ...current.app_context,
        // Merge recent errors
        recent_errors: [
          ...(historical.app_context.recent_errors || []),
          ...(current.app_context.recent_errors || [])
        ].slice(-5) // Keep last 5
      },
      time_context: current.time_context, // Always use current time
      recent_actions: [
        ...(historical.recent_actions || []),
        ...(current.recent_actions || [])
      ].slice(-10) // Keep last 10
    };
  }

  /**
   * Predict next user needs based on context and patterns
   */
  public getPredictedNextNeeds(
    context: ContextData,
    conversationHistory: Array<{ role: string; content: string }>
  ): Array<{ need: string; confidence: number; reasoning: string }> {
    const predictions: Array<{ need: string; confidence: number; reasoning: string }> = [];

    // Feature flag check
    const predictiveEnabled = process.env.EXPO_PUBLIC_AGENTIC_PREDICTIVE === 'true';
    if (!predictiveEnabled) return predictions;

    const { time_context, user_state, educational_context, recent_actions } = context;
    const role = user_state.role;

    // Time-based predictions for educators (teachers, professors, coaches, trainers)
    const isEducator = ['teacher', 'professor', 'instructor', 'coach', 'trainer'].includes(role);
    
    if (isEducator && time_context.day_of_week === 'Monday' && time_context.hour < 10) {
      predictions.push({
        need: 'weekly_activity_planning',
        confidence: 0.75,
        reasoning: 'Monday morning is typically when educators plan the week ahead'
      });
    }

    if (isEducator && time_context.day_of_week === 'Friday' && time_context.hour > 14) {
      predictions.push({
        need: 'review_pending_assessments',
        confidence: 0.7,
        reasoning: 'Friday afternoon is common time for wrapping up assessments before the weekend'
      });
    }

    // Pattern-based predictions
    const recentTopics = recent_actions.filter(a => 
      a.includes('lesson') || a.includes('plan') || a.includes('activity')
    );
    const isPlanningPhase = educational_context?.activity_phase === 'planning' || 
                           educational_context?.lesson_phase === 'planning';
    
    if (recentTopics.length > 2 && isPlanningPhase) {
      predictions.push({
        need: 'create_similar_activity',
        confidence: 0.65,
        reasoning: 'Recent activity shows focus on planning, likely to continue'
      });
    }

    // Stress-based predictions
    if (user_state.stress_level === 'high') {
      predictions.push({
        need: 'quick_automation_suggestions',
        confidence: 0.6,
        reasoning: 'High stress detected, user may benefit from task automation'
      });
    }

    // Conversation pattern predictions
    const userMessages = conversationHistory.filter(m => m.role === 'user').slice(-5);
    const hasAssessmentQueries = userMessages.some(m => {
      const content = m.content.toLowerCase();
      return content.includes('grade') || content.includes('mark') || 
             content.includes('assess') || content.includes('evaluate');
    });
    
    if (hasAssessmentQueries && isEducator) {
      predictions.push({
        need: 'assessment_assistance',
        confidence: 0.8,
        reasoning: 'Recent conversation indicates assessment workflow in progress'
      });
    }

    // Log predictions in development
    if (predictions.length > 0 && process.env.EXPO_PUBLIC_DEBUG_MODE === 'true') {
      console.log('[DashContext] Predicted needs:', predictions);
    }

    return predictions.slice(0, 3); // Return top 3 predictions
  }

  /**
   * Get engagement score based on interaction patterns
   */
  public calculateEngagementScore(
    conversationHistory: Array<{ role: string; content: string }>,
    timeWindowMs: number = 30 * 60 * 1000 // 30 minutes
  ): { level: 'low' | 'medium' | 'high'; score: number } {
    const now = Date.now();
    const recentMessages = conversationHistory.filter(m => {
      // Assuming messages have timestamps; fallback if not
      return m.role === 'user';
    }).slice(-10);

    const messageCount = recentMessages.length;
    const avgLength = recentMessages.reduce((sum, m) => sum + m.content.length, 0) / Math.max(messageCount, 1);

    // Calculate engagement score (0-1)
    let score = 0;
    score += Math.min(messageCount / 10, 0.5); // Up to 0.5 for message frequency
    score += Math.min(avgLength / 200, 0.3); // Up to 0.3 for message depth
    score += recentMessages.some(m => m.content.includes('?')) ? 0.2 : 0; // +0.2 for asking questions

    const level = score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low';

    return { level, score };
  }

  /**
   * Dispose method for cleanup
   */
  public dispose(): void {
    this.emotionalHistory = [];
    this.errorHistory = [];
  }
}

// Backward compatibility: Export default instance
// Note: Prefer using DI container to resolve this service
let _defaultInstance: DashContextAnalyzer | null = null;

export function getDashContextAnalyzerInstance(): DashContextAnalyzer {
  if (!_defaultInstance) {
    _defaultInstance = new DashContextAnalyzer();
  }
  return _defaultInstance;
}

// Add static getInstance method to class
const DashContextAnalyzerInstance = getDashContextAnalyzerInstance();
DashContextAnalyzer.getInstance = function() {
  return DashContextAnalyzerInstance;
};

export default DashContextAnalyzerInstance;
