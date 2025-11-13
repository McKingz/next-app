/**
 * DashAutonomyManager Service
 * 
 * Manages Dash AI Assistant's autonomy levels and action execution permissions.
 * Determines when Dash can auto-execute vs when it needs user approval.
 */

import { DashEduDashKnowledge } from './DashEduDashKnowledge';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AutonomyMode = 'assistant' | 'copilot';
export type ActionRisk = 'low' | 'medium' | 'high';

interface PendingAction {
  id: string;
  type: string;
  description: string;
  parameters: Record<string, any>;
  riskLevel: ActionRisk;
  timestamp: number;
  approved?: boolean;
}

interface AutonomySettings {
  mode: AutonomyMode;
  autoExecuteLowRisk: boolean;
  autoExecuteMediumRisk: boolean;
  autoExecuteHighRisk: boolean;
  requireConfirmForNavigation: boolean;
}

interface ActionHistory {
  id: string;
  type: string;
  riskLevel: ActionRisk;
  autoExecuted: boolean;
  success: boolean;
  timestamp: number;
}

const STORAGE_KEY_SETTINGS = '@dash_autonomy_settings';
const STORAGE_KEY_HISTORY = '@dash_autonomy_history';
const MAX_HISTORY = 100;

export class DashAutonomyManager {
  private static settings: AutonomySettings | null = null;
  private static history: ActionHistory[] = [];
  private static pendingActions: Map<string, PendingAction> = new Map();

  /**
   * Initialize autonomy settings
   */
  static async initialize(): Promise<void> {
    try {
      // Load settings
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEY_SETTINGS);
      if (settingsJson) {
        this.settings = JSON.parse(settingsJson);
      } else {
        // Default settings: assistant mode (more cautious)
        this.settings = {
          mode: 'assistant',
          autoExecuteLowRisk: true,
          autoExecuteMediumRisk: false,
          autoExecuteHighRisk: false,
          requireConfirmForNavigation: false
        };
      }

      // Load history
      const historyJson = await AsyncStorage.getItem(STORAGE_KEY_HISTORY);
      if (historyJson) {
        this.history = JSON.parse(historyJson);
      }
    } catch (error) {
      console.error('Failed to initialize autonomy settings:', error);
      // Use defaults
      this.settings = {
        mode: 'assistant',
        autoExecuteLowRisk: true,
        autoExecuteMediumRisk: false,
        autoExecuteHighRisk: false,
        requireConfirmForNavigation: false
      };
    }
  }

  /**
   * Get current autonomy settings
   */
  static async getSettings(): Promise<AutonomySettings> {
    if (!this.settings) {
      await this.initialize();
    }
    return this.settings!;
  }

  /**
   * Update autonomy settings
   */
  static async updateSettings(newSettings: Partial<AutonomySettings>): Promise<void> {
    if (!this.settings) {
      await this.initialize();
    }

    this.settings = {
      ...this.settings!,
      ...newSettings
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save autonomy settings:', error);
    }
  }

  /**
   * Set autonomy mode
   */
  static async setMode(mode: AutonomyMode): Promise<void> {
    const settings: Partial<AutonomySettings> = { mode };

    // Adjust execution permissions based on mode
    if (mode === 'assistant') {
      // Assistant mode: more cautious, asks for approval
      settings.autoExecuteLowRisk = true;
      settings.autoExecuteMediumRisk = false;
      settings.autoExecuteHighRisk = false;
    } else {
      // Copilot mode: more autonomous
      settings.autoExecuteLowRisk = true;
      settings.autoExecuteMediumRisk = true;
      settings.autoExecuteHighRisk = false; // Still require approval for high-risk
    }

    await this.updateSettings(settings);
  }

  /**
   * Determine if an action can be auto-executed
   */
  static async canAutoExecute(action: {
    type: string;
    parameters?: Record<string, any>;
  }): Promise<{
    canAutoExecute: boolean;
    reason: string;
    riskLevel: ActionRisk;
  }> {
    const settings = await this.getSettings();
    const riskLevel = DashEduDashKnowledge.getRiskForAction(action);

    // Check settings for this risk level
    let canAutoExecute = false;
    let reason = '';

    switch (riskLevel) {
      case 'low':
        canAutoExecute = settings.autoExecuteLowRisk;
        reason = canAutoExecute
          ? 'Low-risk action approved for auto-execution'
          : 'Low-risk actions require approval in current mode';
        break;

      case 'medium':
        canAutoExecute = settings.autoExecuteMediumRisk;
        reason = canAutoExecute
          ? 'Medium-risk action approved for auto-execution in copilot mode'
          : 'Medium-risk actions require explicit approval';
        break;

      case 'high':
        canAutoExecute = settings.autoExecuteHighRisk;
        reason = canAutoExecute
          ? 'High-risk action approved (rare setting)'
          : 'High-risk actions always require explicit approval';
        break;
    }

    // Special case: navigation
    if (action.type === 'navigation' && settings.requireConfirmForNavigation) {
      canAutoExecute = false;
      reason = 'Navigation confirmation is required';
    }

    return {
      canAutoExecute,
      reason,
      riskLevel
    };
  }

  /**
   * Request approval for an action
   */
  static async requestApproval(action: {
    type: string;
    description: string;
    parameters: Record<string, any>;
  }): Promise<string> {
    const riskLevel = DashEduDashKnowledge.getRiskForAction(action);
    const actionId = `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const pendingAction: PendingAction = {
      id: actionId,
      type: action.type,
      description: action.description,
      parameters: action.parameters,
      riskLevel,
      timestamp: Date.now()
    };

    this.pendingActions.set(actionId, pendingAction);

    return actionId;
  }

  /**
   * Approve a pending action
   */
  static approvePendingAction(actionId: string): PendingAction | null {
    const action = this.pendingActions.get(actionId);
    if (!action) return null;

    action.approved = true;
    return action;
  }

  /**
   * Reject a pending action
   */
  static rejectPendingAction(actionId: string): void {
    this.pendingActions.delete(actionId);
  }

  /**
   * Get all pending actions
   */
  static getPendingActions(): PendingAction[] {
    return Array.from(this.pendingActions.values());
  }

  /**
   * Clear old pending actions (older than 5 minutes)
   */
  static clearStaleActions(): void {
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    for (const [id, action] of this.pendingActions.entries()) {
      if (now - action.timestamp > STALE_THRESHOLD) {
        this.pendingActions.delete(id);
      }
    }
  }

  /**
   * Record action in history
   */
  static async recordAction(
    type: string,
    riskLevel: ActionRisk,
    autoExecuted: boolean,
    success: boolean
  ): Promise<void> {
    const historyEntry: ActionHistory = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type,
      riskLevel,
      autoExecuted,
      success,
      timestamp: Date.now()
    };

    this.history.unshift(historyEntry);

    // Limit history size
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }

    // Persist to storage
    try {
      await AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Failed to save action history:', error);
    }
  }

  /**
   * Get action history
   */
  static getHistory(limit?: number): ActionHistory[] {
    return limit ? this.history.slice(0, limit) : this.history;
  }

  /**
   * Get autonomy statistics
   */
  static getStats() {
    const total = this.history.length;
    if (total === 0) {
      return {
        totalActions: 0,
        autoExecuted: 0,
        manualApproval: 0,
        successRate: 0,
        byRisk: { low: 0, medium: 0, high: 0 }
      };
    }

    const autoExecuted = this.history.filter(h => h.autoExecuted).length;
    const successful = this.history.filter(h => h.success).length;

    return {
      totalActions: total,
      autoExecuted,
      manualApproval: total - autoExecuted,
      successRate: Math.round((successful / total) * 100),
      byRisk: {
        low: this.history.filter(h => h.riskLevel === 'low').length,
        medium: this.history.filter(h => h.riskLevel === 'medium').length,
        high: this.history.filter(h => h.riskLevel === 'high').length
      }
    };
  }

  /**
   * Clear all history
   */
  static async clearHistory(): Promise<void> {
    this.history = [];
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }

  /**
   * Get recommendation for autonomy mode based on user behavior
   */
  static getRecommendedMode(): {
    mode: AutonomyMode;
    reason: string;
    confidence: number;
  } {
    const stats = this.getStats();

    if (stats.totalActions < 10) {
      return {
        mode: 'assistant',
        reason: 'Not enough usage data yet - starting with assistant mode',
        confidence: 50
      };
    }

    // Calculate approval rate for medium-risk actions
    const mediumRiskActions = this.history.filter(h => h.riskLevel === 'medium');
    const mediumRiskApproved = mediumRiskActions.filter(h => !h.autoExecuted && h.success).length;
    const approvalRate = mediumRiskActions.length > 0
      ? (mediumRiskApproved / mediumRiskActions.length) * 100
      : 0;

    // If user approves most medium-risk actions, recommend copilot mode
    if (approvalRate > 80 && mediumRiskActions.length >= 5) {
      return {
        mode: 'copilot',
        reason: 'You frequently approve medium-risk actions - copilot mode may save time',
        confidence: 80
      };
    }

    // If user rejects many actions, stick with assistant mode
    if (stats.successRate < 70) {
      return {
        mode: 'assistant',
        reason: 'Some actions were rejected - staying in assistant mode for safety',
        confidence: 75
      };
    }

    return {
      mode: 'assistant',
      reason: 'Current mode is working well',
      confidence: 60
    };
  }
}
