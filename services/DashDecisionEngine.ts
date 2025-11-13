/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * DashDecisionEngine - Elite AI Decision-Making System
 * 
 * Centralized decision engine with explainability, risk assessment,
 * and autonomy-aware execution. Every decision is logged, scored,
 * and traceable for audit and learning.
 * 
 * @module services/DashDecisionEngine
 * @since Phase 1.5
 */

import { assertSupabase } from '@/lib/supabase';
import { getCurrentProfile } from '@/lib/sessionManager';
import type {
  AutonomyLevel,
  RiskLevel,
  DecisionRecord,
  DashTask
} from './dash-ai/types';

// ===== DECISION ENGINE TYPES =====

export interface ActionCandidate {
  id: string;
  type: 'task' | 'suggestion' | 'automation' | 'intervention';
  action: string;
  description: string;
  parameters?: Record<string, any>;
  requiredPermissions?: string[];
  estimatedDuration?: number; // milliseconds
  tags?: string[];
}

export interface DecisionScore {
  confidence: number; // 0-1, model certainty
  risk: RiskLevel; // low/medium/high
  priority: number; // 0-10
  urgency: number; // 0-10
  feasibility: number; // 0-1, can we actually do this?
  userBenefit: number; // 0-10, expected value to user
}

export interface DecisionRationale {
  reasoning: string; // Human-readable explanation
  factors: Array<{ factor: string; weight: number; score: number }>;
  alternatives: string[]; // What else was considered
  risks: string[]; // What could go wrong
  mitigations: string[]; // How we'll handle failures
}

export interface ExecutionPlan {
  shouldExecute: boolean;
  requiresApproval: boolean;
  approvalMessage?: string;
  executionStrategy: 'immediate' | 'scheduled' | 'queued' | 'blocked';
  fallbackActions?: string[];
  monitoringRequired: boolean;
}

export interface Decision {
  id: string;
  candidate: ActionCandidate;
  score: DecisionScore;
  rationale: DecisionRationale;
  plan: ExecutionPlan;
  timestamp: number;
  action: any; // DashAction from DecisionRecord
  risk: RiskLevel;
  confidence: number;
  requiresApproval: boolean;
  createdAt: number;
  context: Record<string, any>;
}

// ===== DECISION ENGINE =====

/**
 * DashDecisionEngine interface for dependency injection
 */
export interface IDashDecisionEngine {
  decide(candidate: ActionCandidate, context: any): Promise<Decision>;
  getDecisionHistory(): Decision[];
  getRecentDecisions(limit?: number): Decision[];
  getDecisionStats(): any;
  dispose(): void;
}

export class DashDecisionEngine implements IDashDecisionEngine {
  private decisionHistory: Decision[] = [];
  private readonly MAX_HISTORY = 100;

  // Risk thresholds for autonomy levels
  private readonly autonomyRiskMatrix: Record<
    AutonomyLevel,
    { maxAutoRisk: RiskLevel; requiresApprovalAbove: RiskLevel }
  > = {
    observer: { maxAutoRisk: 'low', requiresApprovalAbove: 'low' },
    assistant: { maxAutoRisk: 'low', requiresApprovalAbove: 'low' },
    partner: { maxAutoRisk: 'medium', requiresApprovalAbove: 'medium' },
    autonomous: { maxAutoRisk: 'high', requiresApprovalAbove: 'high' }
  };

  // Risk scoring weights
  private readonly riskFactors = {
    dataModification: 0.3,
    userImpact: 0.25,
    reversibility: 0.2,
    cost: 0.15,
    compliance: 0.1
  };

  /**
   * Core decision-making method: Evaluate action and determine execution plan
   */
  public async decide(
    candidate: ActionCandidate,
    context: {
      autonomyLevel: AutonomyLevel;
      userRole: string;
      conversationContext?: any;
      recentActions?: string[];
    }
  ): Promise<Decision> {
    const score = this.scoreAction(candidate, context);
    const rationale = this.generateRationale(candidate, score, context);
    const plan = this.createExecutionPlan(score, context.autonomyLevel);

    const decision: Decision = {
      id: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      candidate,
      score,
      rationale,
      plan,
      timestamp: Date.now(),
      action: {
        id: candidate.id,
        type: candidate.type,
        description: candidate.description,
        parameters: candidate.parameters || {},
        estimated_duration: candidate.estimatedDuration
      },
      risk: score.risk,
      confidence: score.confidence,
      requiresApproval: plan.requiresApproval,
      createdAt: Date.now(),
      context: {}
    };

    // Add to history
    this.decisionHistory.push(decision);
    if (this.decisionHistory.length > this.MAX_HISTORY) {
      this.decisionHistory.shift();
    }

    // Log to database
    await this.logDecision(decision);

    return decision;
  }

  /**
   * Score an action candidate across multiple dimensions
   */
  private scoreAction(
    candidate: ActionCandidate,
    context: { userRole: string; recentActions?: string[] }
  ): DecisionScore {
    // Confidence: Based on pattern matching and historical success
    const confidence = this.calculateConfidence(candidate, context);

    // Risk: Assess potential harm or unintended consequences
    const risk = this.assessRisk(candidate, context);

    // Priority: How important is this action?
    const priority = this.calculatePriority(candidate, context);

    // Urgency: How time-sensitive is this?
    const urgency = this.calculateUrgency(candidate, context);

    // Feasibility: Can we actually do this right now?
    const feasibility = this.assessFeasibility(candidate, context);

    // User Benefit: Expected value to the user
    const userBenefit = this.estimateUserBenefit(candidate, context);

    return { confidence, risk, priority, urgency, feasibility, userBenefit };
  }

  /**
   * Calculate confidence score based on action familiarity and success rate
   */
  private calculateConfidence(
    candidate: ActionCandidate,
    context: { recentActions?: string[] }
  ): number {
    let confidence = 0.5; // Baseline

    // Boost for common actions
    const commonActions = ['create', 'read', 'update', 'list', 'search', 'help'];
    if (commonActions.some(a => candidate.action.toLowerCase().includes(a))) {
      confidence += 0.2;
    }

    // Boost if we've done this recently and successfully
    if (context.recentActions?.includes(candidate.action)) {
      confidence += 0.15;
    }

    // Penalize complex or risky actions
    if (candidate.type === 'automation' || candidate.type === 'intervention') {
      confidence -= 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Assess risk level with nuanced scoring
   */
  private assessRisk(
    candidate: ActionCandidate,
    context: { userRole: string }
  ): RiskLevel {
    let riskScore = 0;

    // Data modification risk
    const destructiveActions = ['delete', 'remove', 'drop', 'clear', 'reset', 'archive'];
    if (destructiveActions.some(a => candidate.action.toLowerCase().includes(a))) {
      riskScore += this.riskFactors.dataModification;
    }

    // User impact risk
    const highImpactTypes = ['automation', 'intervention'];
    if (highImpactTypes.includes(candidate.type)) {
      riskScore += this.riskFactors.userImpact;
    }

    // Reversibility risk
    if (!candidate.tags?.includes('reversible')) {
      riskScore += this.riskFactors.reversibility * 0.5;
    }

    // Role-based risk adjustment
    if (context.userRole === 'parent' && candidate.action.includes('admin')) {
      riskScore += 0.2; // Elevated risk for parents doing admin tasks
    }

    // Map numeric score to risk level
    if (riskScore < 0.3) return 'low';
    if (riskScore < 0.6) return 'medium';
    return 'high';
  }

  /**
   * Calculate action priority (0-10)
   */
  private calculatePriority(candidate: ActionCandidate, context: any): number {
    let priority = 5; // Baseline

    if (candidate.tags?.includes('urgent')) priority += 3;
    if (candidate.tags?.includes('important')) priority += 2;
    if (candidate.type === 'intervention') priority += 2;
    if (candidate.tags?.includes('low-priority')) priority -= 2;

    return Math.max(0, Math.min(10, priority));
  }

  /**
   * Calculate urgency score (0-10)
   */
  private calculateUrgency(candidate: ActionCandidate, context: any): number {
    let urgency = 5; // Baseline

    if (candidate.tags?.includes('asap')) urgency = 10;
    if (candidate.tags?.includes('urgent')) urgency = 8;
    if (candidate.tags?.includes('time-sensitive')) urgency += 2;
    if (candidate.type === 'suggestion') urgency -= 1;

    return Math.max(0, Math.min(10, urgency));
  }

  /**
   * Assess feasibility (0-1)
   */
  private assessFeasibility(candidate: ActionCandidate, context: any): number {
    let feasibility = 1.0; // Assume feasible unless proven otherwise

    // Check required permissions
    if (candidate.requiredPermissions?.length) {
      feasibility -= 0.1 * candidate.requiredPermissions.length;
    }

    // Check estimated duration
    if (candidate.estimatedDuration && candidate.estimatedDuration > 5000) {
      feasibility -= 0.1; // Long-running tasks slightly less feasible
    }

    return Math.max(0, Math.min(1, feasibility));
  }

  /**
   * Estimate user benefit (0-10)
   */
  private estimateUserBenefit(candidate: ActionCandidate, context: any): number {
    let benefit = 5; // Baseline

    if (candidate.type === 'automation') benefit += 3;
    if (candidate.tags?.includes('productivity')) benefit += 2;
    if (candidate.tags?.includes('time-saving')) benefit += 2;
    if (candidate.tags?.includes('quality-improvement')) benefit += 1;

    return Math.max(0, Math.min(10, benefit));
  }

  /**
   * Generate human-readable rationale
   */
  private generateRationale(
    candidate: ActionCandidate,
    score: DecisionScore,
    context: any
  ): DecisionRationale {
    const reasoning = this.buildReasoningNarrative(candidate, score, context);
    const factors = this.extractDecisionFactors(score);
    const alternatives = this.suggestAlternatives(candidate);
    const risks = this.identifyRisks(candidate, score);
    const mitigations = this.planMitigations(risks);

    return { reasoning, factors, alternatives, risks, mitigations };
  }

  /**
   * Build narrative explanation of decision
   */
  private buildReasoningNarrative(
    candidate: ActionCandidate,
    score: DecisionScore,
    context: any
  ): string {
    const confidenceDesc =
      score.confidence > 0.8 ? 'highly confident' :
      score.confidence > 0.6 ? 'moderately confident' : 'cautiously optimistic';

    const riskDesc = score.risk === 'low' ? 'minimal risk' :
      score.risk === 'medium' ? 'moderate risk' : 'elevated risk';

    const benefitDesc =
      score.userBenefit > 7 ? 'significant benefit' :
      score.userBenefit > 4 ? 'moderate benefit' : 'modest benefit';

    return `I'm ${confidenceDesc} that ${candidate.description.toLowerCase()} would provide ${benefitDesc} with ${riskDesc}. ` +
      `Priority: ${score.priority}/10, Urgency: ${score.urgency}/10. ` +
      `This action is ${score.feasibility > 0.8 ? 'readily feasible' : 'feasible with preparation'}.`;
  }

  /**
   * Extract weighted decision factors
   */
  private extractDecisionFactors(score: DecisionScore): Array<{ factor: string; weight: number; score: number }> {
    return [
      { factor: 'Confidence', weight: 0.25, score: score.confidence * 10 },
      { factor: 'User Benefit', weight: 0.25, score: score.userBenefit },
      { factor: 'Priority', weight: 0.2, score: score.priority },
      { factor: 'Feasibility', weight: 0.15, score: score.feasibility * 10 },
      { factor: 'Urgency', weight: 0.15, score: score.urgency }
    ];
  }

  /**
   * Suggest alternative actions
   */
  private suggestAlternatives(candidate: ActionCandidate): string[] {
    const alternatives: string[] = [];

    if (candidate.type === 'automation') {
      alternatives.push('Manual step-by-step guidance instead of full automation');
    }
    if (candidate.action.includes('create')) {
      alternatives.push('Use existing template or copy from previous work');
    }
    alternatives.push('Defer action and revisit later');
    alternatives.push('Ask user for more context before proceeding');

    return alternatives.slice(0, 3); // Top 3 alternatives
  }

  /**
   * Identify potential risks
   */
  private identifyRisks(candidate: ActionCandidate, score: DecisionScore): string[] {
    const risks: string[] = [];

    if (score.risk === 'high') {
      risks.push('Potential for unintended data modification');
      risks.push('May require user intervention to correct');
    }
    if (score.confidence < 0.6) {
      risks.push('Uncertain outcome due to limited context');
    }
    if (score.feasibility < 0.7) {
      risks.push('May encounter permission or resource constraints');
    }

    return risks.length ? risks : ['Minimal risk identified'];
  }

  /**
   * Plan risk mitigations
   */
  private planMitigations(risks: string[]): string[] {
    const mitigations: string[] = [];

    if (risks.some(r => r.includes('data modification'))) {
      mitigations.push('Create backup before execution');
      mitigations.push('Implement rollback capability');
    }
    if (risks.some(r => r.includes('uncertain'))) {
      mitigations.push('Request user confirmation with clear explanation');
    }
    if (risks.some(r => r.includes('permission'))) {
      mitigations.push('Gracefully degrade or request elevated permissions');
    }

    return mitigations.length ? mitigations : ['Standard error handling applies'];
  }

  /**
   * Create execution plan based on autonomy level and risk
   */
  private createExecutionPlan(score: DecisionScore, autonomyLevel: AutonomyLevel): ExecutionPlan {
    const matrix = this.autonomyRiskMatrix[autonomyLevel];
    const riskLevels: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 };

    const requiresApproval = riskLevels[score.risk] > riskLevels[matrix.maxAutoRisk];

    let executionStrategy: ExecutionPlan['executionStrategy'];
    if (!this.shouldExecute(score, autonomyLevel)) {
      executionStrategy = 'blocked';
    } else if (requiresApproval) {
      executionStrategy = 'queued';
    } else if (score.urgency >= 8) {
      executionStrategy = 'immediate';
    } else {
      executionStrategy = 'scheduled';
    }

    const approvalMessage = requiresApproval
      ? `This ${score.risk}-risk action requires your approval (autonomy: ${autonomyLevel}).`
      : undefined;

    return {
      shouldExecute: executionStrategy !== 'blocked',
      requiresApproval,
      approvalMessage,
      executionStrategy,
      fallbackActions: ['Log issue', 'Notify user', 'Request manual intervention'],
      monitoringRequired: score.risk !== 'low'
    };
  }

  /**
   * Determine if action should execute at all
   */
  private shouldExecute(score: DecisionScore, autonomyLevel: AutonomyLevel): boolean {
    if (autonomyLevel === 'observer') return false;
    if (score.feasibility < 0.5) return false;
    if (score.confidence < 0.4) return false;
    return true;
  }

  /**
   * Log decision to database for audit trail
   */
  private async logDecision(decision: Decision): Promise<void> {
    try {
      const agenticEnabled = process.env.EXPO_PUBLIC_AGENTIC_ENABLED === 'true';
      if (!agenticEnabled) return;

      const supabase = assertSupabase();
      const profile = await getCurrentProfile();
      if (!profile) return;

      await supabase.from('ai_events').insert({
        preschool_id: profile.organization_id,
        user_id: profile.id,
        event_type: 'ai.agent.decision_made',
        event_data: {
          decision_id: decision.id,
          action: decision.candidate.action,
          action_type: decision.candidate.type,
          confidence: decision.score.confidence,
          risk: decision.score.risk,
          priority: decision.score.priority,
          execution_strategy: decision.plan.executionStrategy,
          requires_approval: decision.plan.requiresApproval,
          reasoning: decision.rationale.reasoning
        }
      });

      console.log(`[DecisionEngine] Decision logged: ${decision.id} (${decision.plan.executionStrategy})`);
    } catch (error) {
      console.error('[DecisionEngine] Failed to log decision:', error);
    }
  }

  /**
   * Get recent decisions for pattern analysis
   */
  public getRecentDecisions(limit: number = 10): Decision[] {
    return this.decisionHistory.slice(-limit);
  }

  /**
   * Get decision statistics
   */
  public getDecisionStats(): {
    total: number;
    byRisk: Record<RiskLevel, number>;
    byStrategy: Record<string, number>;
    avgConfidence: number;
  } {
    const total = this.decisionHistory.length;
    const byRisk: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0 };
    const byStrategy: Record<string, number> = {};
    let totalConfidence = 0;

    for (const decision of this.decisionHistory) {
      byRisk[decision.score.risk]++;
      byStrategy[decision.plan.executionStrategy] = (byStrategy[decision.plan.executionStrategy] || 0) + 1;
      totalConfidence += decision.score.confidence;
    }

    return {
      total,
      byRisk,
      byStrategy,
      avgConfidence: total > 0 ? totalConfidence / total : 0
    };
  }

  /**
   * Get decision history
   */
  public getDecisionHistory(): Decision[] {
    return [...this.decisionHistory];
  }

  /**
   * Dispose method for cleanup
   */
  dispose(): void {
    this.decisionHistory = [];
  }
}

// Backward compatibility: Export default instance
// Note: Prefer using DI container to resolve this service
let _defaultInstance: DashDecisionEngine | null = null;

export function getDashDecisionEngineInstance(): DashDecisionEngine {
  if (!_defaultInstance) {
    _defaultInstance = new DashDecisionEngine();
  }
  return _defaultInstance;
}

export default getDashDecisionEngineInstance();
