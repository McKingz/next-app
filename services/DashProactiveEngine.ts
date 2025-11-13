/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * DashProactiveEngine - Elite Proactive Intelligence System
 * 
 * Anticipates user needs and offers contextual suggestions before they ask.
 * Combines time-based patterns, role-specific workflows, emotional context,
 * and usage analytics to deliver high-value proactive interventions.
 * 
 * @module services/DashProactiveEngine
 * @since Phase 1.6
 */

import { assertSupabase } from '@/lib/supabase';
import { getCurrentProfile, type UserProfile } from '@/lib/sessionManager';
import decisionEngine, { type ActionCandidate, type Decision } from './DashDecisionEngine';
import { DashContextAnalyzer } from './DashContextAnalyzer';
import type { AutonomyLevel } from './dash-ai/types';

// ===== PROACTIVE TYPES =====

export interface ProactiveSuggestion {
  id: string;
  type: 'reminder' | 'suggestion' | 'insight' | 'automation' | 'warning';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  reasoning: string;
  actions: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary' | 'dismiss';
    actionData?: Record<string, any>;
  }>;
  triggeredBy: 'time' | 'pattern' | 'context' | 'event' | 'manual';
  expiresAt?: number;
  dismissible: boolean;
  metadata?: Record<string, any>;
}

export interface ProactiveRule {
  id: string;
  name: string;
  roles: Array<'teacher' | 'principal' | 'parent' | 'student'>;
  triggers: {
    timePattern?: {
      hour?: number;
      dayOfWeek?: number;
      datePattern?: string;
    };
    contextConditions?: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan';
      value: any;
    }>;
    eventTriggers?: string[];
  };
  cooldownMinutes: number;
  maxDailyOccurrences: number;
  enabled: boolean;
}

// ===== PROACTIVE ENGINE =====

export interface IDashProactiveEngine {
  checkForSuggestions(userRole: string, context: any): Promise<any[]>;
  dismissSuggestion(suggestionId: string): void;
  dispose(): void;
}

export class DashProactiveEngine implements IDashProactiveEngine {
  private lastTriggerTimes: Map<string, number> = new Map();
  private dailyOccurrences: Map<string, number> = new Map();
  private dismissedSuggestions: Set<string> = new Set();

  // Built-in proactive rules
  private readonly rules: ProactiveRule[] = [
    {
      id: 'teacher_morning_planning',
      name: 'Morning Lesson Planning Prompt',
      roles: ['teacher'],
      triggers: {
        timePattern: { hour: 7 },
        contextConditions: [
          { field: 'day_of_week', operator: 'lessThan', value: 5 } // Weekdays only
        ]
      },
      cooldownMinutes: 1440, // Once per day
      maxDailyOccurrences: 1,
      enabled: true
    },
    {
      id: 'teacher_grading_reminder',
      name: 'Grading Assistance',
      roles: ['teacher'],
      triggers: {
        timePattern: { hour: 15 },
        contextConditions: [
          { field: 'pending_assignments', operator: 'greaterThan', value: 0 }
        ]
      },
      cooldownMinutes: 360,
      maxDailyOccurrences: 2,
      enabled: true
    },
    {
      id: 'parent_homework_check',
      name: 'Evening Homework Check',
      roles: ['parent'],
      triggers: {
        timePattern: { hour: 18 }
      },
      cooldownMinutes: 1440,
      maxDailyOccurrences: 1,
      enabled: true
    },
    {
      id: 'principal_morning_briefing',
      name: 'Morning Dashboard Review',
      roles: ['principal'],
      triggers: {
        timePattern: { hour: 8 }
      },
      cooldownMinutes: 1440,
      maxDailyOccurrences: 1,
      enabled: true
    },
    {
      id: 'student_study_break',
      name: 'Study Break Reminder',
      roles: ['student'],
      triggers: {
        contextConditions: [
          { field: 'study_duration_minutes', operator: 'greaterThan', value: 45 }
        ]
      },
      cooldownMinutes: 60,
      maxDailyOccurrences: 8,
      enabled: true
    },
    {
      id: 'weekend_planning',
      name: 'Weekly Planning Assistant',
      roles: ['teacher', 'principal'],
      triggers: {
        timePattern: { hour: 15, dayOfWeek: 5 } // Friday 3 PM
      },
      cooldownMinutes: 10080, // Once per week
      maxDailyOccurrences: 1,
      enabled: true
    }
  ];

  constructor() {
    this.resetDailyCounters();
  }

  /**
   * Main entry point: Check for proactive suggestions
   */
  public async checkForSuggestions(
    userRole: string,
    context: {
      autonomyLevel: AutonomyLevel;
      currentScreen?: string;
      recentActivity?: any[];
      timeContext?: { hour: number; dayOfWeek: number };
    }
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    // Only suggest if autonomy allows
    if (context.autonomyLevel === 'observer') return [];

    const profile = await getCurrentProfile();
    if (!profile) return [];

    // Check time-based rules
    const timeSuggestions = await this.checkTimeBasedRules(userRole as any, context);
    suggestions.push(...timeSuggestions);

    // Check pattern-based opportunities
    const patternSuggestions = await this.checkPatternOpportunities(userRole, context);
    suggestions.push(...patternSuggestions);

    // Check context-aware suggestions
    const contextSuggestions = await this.checkContextualOpportunities(userRole, context);
    suggestions.push(...contextSuggestions);

    // Filter duplicates and sort by priority
    const filtered = this.deduplicateAndPrioritize(suggestions);

    // Log to telemetry
    await this.logProactiveEvents(filtered, profile);

    return filtered;
  }

  /**
   * Check time-based proactive rules
   */
  private async checkTimeBasedRules(
    userRole: 'teacher' | 'principal' | 'parent' | 'student',
    context: any
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    const now = Date.now();
    const currentHour = context.timeContext?.hour ?? new Date().getHours();
    const currentDay = context.timeContext?.dayOfWeek ?? new Date().getDay();

    for (const rule of this.rules) {
      // Skip if rule doesn't apply to this role
      if (!rule.roles.includes(userRole)) continue;
      if (!rule.enabled) continue;

      // Check cooldown
      const lastTrigger = this.lastTriggerTimes.get(rule.id) ?? 0;
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (now - lastTrigger < cooldownMs) continue;

      // Check daily occurrences
      const occurrences = this.dailyOccurrences.get(rule.id) ?? 0;
      if (occurrences >= rule.maxDailyOccurrences) continue;

      // Check time pattern with ±1 hour flexibility
      if (rule.triggers.timePattern) {
        const { hour, dayOfWeek } = rule.triggers.timePattern;
        // Allow ±1 hour window for more flexible matching
        if (hour !== undefined) {
          const hourDiff = Math.abs(currentHour - hour);
          if (hourDiff > 1) continue; // Skip if more than 1 hour away
        }
        if (dayOfWeek !== undefined && currentDay !== dayOfWeek) continue;
      }

      // Check context conditions
      if (rule.triggers.contextConditions) {
        const conditionsMet = rule.triggers.contextConditions.every(cond =>
          this.evaluateCondition(cond, context)
        );
        if (!conditionsMet) continue;
      }

      // Generate suggestion for this rule
      const suggestion = this.generateSuggestionFromRule(rule, userRole, context);
      if (suggestion) {
        suggestions.push(suggestion);
        this.lastTriggerTimes.set(rule.id, now);
        this.dailyOccurrences.set(rule.id, occurrences + 1);
      }
    }

    return suggestions;
  }

  /**
   * Evaluate a context condition
   */
  private evaluateCondition(
    condition: { field: string; operator: string; value: any },
    context: any
  ): boolean {
    const fieldValue = this.getNestedValue(context, condition.field);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'greaterThan':
        return Number(fieldValue) > Number(condition.value);
      case 'lessThan':
        return Number(fieldValue) < Number(condition.value);
      default:
        return false;
    }
  }

  /**
   * Get nested object value by dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Generate suggestion from rule template
   */
  private generateSuggestionFromRule(
    rule: ProactiveRule,
    userRole: string,
    context: any
  ): ProactiveSuggestion | null {
    const templates: Record<string, Partial<ProactiveSuggestion>> = {
      teacher_morning_planning: {
        type: 'suggestion',
        priority: 'medium',
        title: 'Morning Planning',
        message: "Good morning! Ready to plan today's lessons? I can help align them with curriculum standards and suggest engaging activities.",
        actions: [
          { id: 'plan_lessons', label: 'Plan Lessons', type: 'primary' },
          { id: 'view_schedule', label: 'View Schedule', type: 'secondary' },
          { id: 'dismiss', label: 'Not Now', type: 'dismiss' }
        ]
      },
      teacher_grading_reminder: {
        type: 'reminder',
        priority: 'medium',
        title: 'Grading Assistant',
        message: 'You have pending assignments to grade. Would you like AI-powered grading assistance to save time?',
        actions: [
          { id: 'start_grading', label: 'Start Grading', type: 'primary' },
          { id: 'view_assignments', label: 'View All', type: 'secondary' },
          { id: 'dismiss', label: 'Later', type: 'dismiss' }
        ]
      },
      parent_homework_check: {
        type: 'reminder',
        priority: 'medium',
        title: 'Homework Time',
        message: "It's homework time! Would you like help checking your child's assignments or explaining any concepts?",
        actions: [
          { id: 'check_homework', label: 'Check Homework', type: 'primary' },
          { id: 'skip', label: 'Skip Tonight', type: 'dismiss' }
        ]
      },
      principal_morning_briefing: {
        type: 'insight',
        priority: 'high',
        title: 'Morning Briefing',
        message: 'Your daily briefing is ready: school metrics, urgent issues, and scheduled meetings.',
        actions: [
          { id: 'view_briefing', label: 'View Briefing', type: 'primary' },
          { id: 'dismiss', label: 'Later', type: 'dismiss' }
        ]
      },
      student_study_break: {
        type: 'suggestion',
        priority: 'low',
        title: 'Take a Break',
        message: "You've been studying for a while. Take a 10-minute break to recharge!",
        actions: [
          { id: 'take_break', label: 'Take Break', type: 'primary', actionData: { duration: 10 } },
          { id: 'continue', label: 'Keep Studying', type: 'dismiss' }
        ]
      },
      weekend_planning: {
        type: 'suggestion',
        priority: 'medium',
        title: 'Weekly Planning',
        message: 'End-of-week wrap-up: Generate a summary and prepare for next week?',
        actions: [
          { id: 'generate_summary', label: 'Generate Summary', type: 'primary' },
          { id: 'skip', label: 'Skip This Week', type: 'dismiss' }
        ]
      }
    };

    const template = templates[rule.id];
    if (!template) return null;

    return {
      id: `proactive_${rule.id}_${Date.now()}`,
      triggeredBy: 'time',
      reasoning: `Triggered by rule: ${rule.name}`,
      dismissible: true,
      expiresAt: Date.now() + (2 * 60 * 60 * 1000), // 2 hours
      ...template
    } as ProactiveSuggestion;
  }

  /**
   * Check for pattern-based opportunities
   */
  private async checkPatternOpportunities(
    userRole: string,
    context: any
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    // Analyze recent activity for repetitive tasks
    if (context.recentActivity?.length >= 3) {
      const repeatTasks = this.detectRepetitiveTasks(context.recentActivity);
      
      if (repeatTasks.length > 0) {
        suggestions.push({
          id: `pattern_automation_${Date.now()}`,
          type: 'automation',
          priority: 'medium',
          title: 'Automation Opportunity',
          message: `I notice you frequently ${repeatTasks[0]}. Would you like to automate this?`,
          reasoning: 'Detected repetitive task pattern in recent activity',
          actions: [
            { id: 'setup_automation', label: 'Set Up Automation', type: 'primary' },
            { id: 'not_now', label: 'Not Now', type: 'dismiss' }
          ],
          triggeredBy: 'pattern',
          dismissible: true
        });
      }
    }

    return suggestions;
  }

  /**
   * Detect repetitive tasks from activity log
   */
  private detectRepetitiveTasks(activities: any[]): string[] {
    const taskCounts = new Map<string, number>();
    
    for (const activity of activities) {
      const taskType = activity.type || activity.action;
      if (taskType) {
        taskCounts.set(taskType, (taskCounts.get(taskType) || 0) + 1);
      }
    }

    return Array.from(taskCounts.entries())
      .filter(([_, count]) => count >= 3)
      .map(([task]) => task);
  }

  /**
   * Check contextual opportunities based on current state
   */
  private async checkContextualOpportunities(
    userRole: string,
    context: any
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    // Screen-specific suggestions
    if (context.currentScreen === 'students') {
      suggestions.push({
        id: `context_student_insight_${Date.now()}`,
        type: 'insight',
        priority: 'low',
        title: 'Student Performance Insight',
        message: 'I can analyze student performance trends. Would you like to see insights?',
        reasoning: 'User viewing student list - relevant opportunity',
        actions: [
          { id: 'view_insights', label: 'View Insights', type: 'primary' },
          { id: 'dismiss', label: 'Maybe Later', type: 'dismiss' }
        ],
        triggeredBy: 'context',
        dismissible: true,
        expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
      });
    }
    
    // ALWAYS provide at least one general helpful suggestion based on role
    // Only add if no other suggestions were generated
    if (suggestions.length === 0) {
      const generalSuggestions = this.getGeneralSuggestionsByRole(userRole);
      if (generalSuggestions) {
        suggestions.push(generalSuggestions);
      }
    }

    return suggestions;
  }
  
  /**
   * Get general helpful suggestions based on user role
   */
  private getGeneralSuggestionsByRole(userRole: string): ProactiveSuggestion | null {
    const suggestionId = `general_${userRole}_${Date.now()}`;
    
    // Avoid repeating the same general suggestion too frequently
    const lastGeneral = Array.from(this.lastTriggerTimes.keys())
      .find(k => k.startsWith(`general_${userRole}`));
    if (lastGeneral) {
      const lastTime = this.lastTriggerTimes.get(lastGeneral) || 0;
      // Only show general suggestions once per hour
      if (Date.now() - lastTime < 60 * 60 * 1000) return null;
    }
    
    this.lastTriggerTimes.set(suggestionId, Date.now());
    
    const suggestions: Record<string, Partial<ProactiveSuggestion>> = {
      teacher: {
        type: 'suggestion',
        priority: 'low',
        title: 'Lesson Planning Help',
        message: "Need help planning lessons or creating assessments? I'm here to assist with curriculum alignment and engaging activities.",
        actions: [
          { id: 'plan_lesson', label: 'Plan Lesson', type: 'primary' },
          { id: 'create_assessment', label: 'Create Assessment', type: 'secondary' },
          { id: 'dismiss', label: 'Not Now', type: 'dismiss' }
        ]
      },
      principal: {
        type: 'insight',
        priority: 'low',
        title: 'School Insights',
        message: 'I can provide insights on school performance, attendance trends, or help with administrative tasks.',
        actions: [
          { id: 'view_metrics', label: 'View Metrics', type: 'primary' },
          { id: 'generate_report', label: 'Generate Report', type: 'secondary' },
          { id: 'dismiss', label: 'Later', type: 'dismiss' }
        ]
      },
      parent: {
        type: 'suggestion',
        priority: 'low',
        title: 'Child Progress',
        message: "Want to check your child's progress or upcoming assignments? I can help you stay connected with their learning.",
        actions: [
          { id: 'view_progress', label: 'View Progress', type: 'primary' },
          { id: 'check_homework', label: 'Check Homework', type: 'secondary' },
          { id: 'dismiss', label: 'Not Now', type: 'dismiss' }
        ]
      }
    };
    
    const template = suggestions[userRole];
    if (!template) return null;
    
    return {
      id: suggestionId,
      triggeredBy: 'context',
      reasoning: 'General helpful suggestion for current role',
      dismissible: true,
      expiresAt: Date.now() + (30 * 60 * 1000), // 30 minutes
      ...template
    } as ProactiveSuggestion;
  }

  /**
   * Deduplicate and prioritize suggestions
   */
  private deduplicateAndPrioritize(suggestions: ProactiveSuggestion[]): ProactiveSuggestion[] {
    // Remove dismissed suggestions
    const active = suggestions.filter(s => !this.dismissedSuggestions.has(s.id));

    // Remove expired
    const now = Date.now();
    const valid = active.filter(s => !s.expiresAt || s.expiresAt > now);

    // Deduplicate by type+title
    const seen = new Set<string>();
    const unique = valid.filter(s => {
      const key = `${s.type}_${s.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    unique.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Limit to top 3
    return unique.slice(0, 3);
  }

  /**
   * Mark suggestion as dismissed
   */
  public dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestions.add(suggestionId);
  }

  /**
   * Execute suggestion action using decision engine
   */
  public async executeSuggestionAction(
    suggestion: ProactiveSuggestion,
    actionId: string,
    context: { autonomyLevel: AutonomyLevel; userRole: string }
  ): Promise<Decision | null> {
    const action = suggestion.actions.find(a => a.id === actionId);
    if (!action) return null;

    // Dismiss action
    if (action.type === 'dismiss') {
      this.dismissSuggestion(suggestion.id);
      return null;
    }

    // Create action candidate
    const candidate: ActionCandidate = {
      id: `action_${actionId}_${Date.now()}`,
      type: suggestion.type === 'automation' ? 'automation' : 'task',
      action: actionId,
      description: action.label,
      parameters: action.actionData,
      tags: [suggestion.priority]
    };

    // Use decision engine to evaluate and execute
    const decision = await decisionEngine.decide(candidate, context);

    return decision;
  }

  /**
   * Log proactive events to telemetry
   */
  private async logProactiveEvents(
    suggestions: ProactiveSuggestion[],
    profile: UserProfile
  ): Promise<void> {
    try {
      const agenticEnabled = process.env.EXPO_PUBLIC_AGENTIC_ENABLED === 'true';
      if (!agenticEnabled || suggestions.length === 0) return;

      const supabase = assertSupabase();

      await supabase.from('ai_events').insert({
        preschool_id: profile.organization_id,
        user_id: profile.id,
        event_type: 'ai.agent.proactive_offer_shown',
        event_data: {
          count: suggestions.length,
          suggestions: suggestions.map(s => ({
            id: s.id,
            type: s.type,
            priority: s.priority,
            title: s.title,
            triggeredBy: s.triggeredBy
          }))
        }
      });
    } catch (error) {
      console.error('[ProactiveEngine] Failed to log events:', error);
    }
  }

  /**
   * Reset daily counters (call at midnight)
   */
  private resetDailyCounters(): void {
    this.dailyOccurrences.clear();
    
    // Schedule next reset at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    setTimeout(() => {
      this.resetDailyCounters();
    }, msUntilMidnight);
  }

  /**
   * Get statistics for monitoring
   */
  public getStats(): {
    totalRules: number;
    activeRules: number;
    triggeredToday: number;
    dismissedToday: number;
  } {
    return {
      totalRules: this.rules.length,
      activeRules: this.rules.filter(r => r.enabled).length,
      triggeredToday: Array.from(this.dailyOccurrences.values()).reduce((a, b) => a + b, 0),
      dismissedToday: this.dismissedSuggestions.size
    };
  }

  dispose(): void {
    this.lastTriggerTimes.clear();
    this.dailyOccurrences.clear();
    this.dismissedSuggestions.clear();
  }
}

// Backward compatibility: Export default instance
// Note: Prefer using DI container to resolve this service
let _defaultInstance: DashProactiveEngine | null = null;

export function getDashProactiveEngineInstance(): DashProactiveEngine {
  if (!_defaultInstance) {
    _defaultInstance = new DashProactiveEngine();
  }
  return _defaultInstance;
}

export default getDashProactiveEngineInstance();
