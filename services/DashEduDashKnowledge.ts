/**
 * DashEduDashKnowledge Service
 * 
 * Provides a unified API for retrieving, searching, and rendering EduDash Pro
 * platform knowledge for the Dash AI Assistant.
 * 
 * This service is the bridge between the feature constants and the agentic systems.
 */

import {
  EDUDASH_FEATURES,
  EDUDASH_DB,
  EDUDASH_SCREENS,
  SUBSCRIPTION_TIERS,
  EDGE_FUNCTIONS,
  SA_CONTEXT,
  NAVIGATION_CONTEXT,
  SECURITY_CONTEXT,
  type Feature,
  type DbTable,
  type Screen,
  type SubscriptionTier
} from '@/lib/constants/edudash-features';

export class DashEduDashKnowledge {
  /**
   * Get complete feature catalog
   */
  static getFeatureCatalog(): Record<string, Feature> {
    return EDUDASH_FEATURES;
  }

  /**
   * Get database schema information
   */
  static getDbSchema(): Record<string, DbTable> {
    return EDUDASH_DB;
  }

  /**
   * Get all available screens
   */
  static getScreens(): Record<string, Screen> {
    return EDUDASH_SCREENS;
  }

  /**
   * Get tier limits and features
   */
  static getTierLimits(tier: string): SubscriptionTier {
    return SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.starter;
  }

  /**
   * Get Edge Functions metadata
   */
  static getEdgeFunctions() {
    return EDGE_FUNCTIONS;
  }

  /**
   * Get South African context
   */
  static getSaContext() {
    return SA_CONTEXT;
  }

  /**
   * Get navigation context
   */
  static getNavigationContext() {
    return NAVIGATION_CONTEXT;
  }

  /**
   * Get security context
   */
  static getSecurityContext() {
    return SECURITY_CONTEXT;
  }

  /**
   * Get capabilities available for a given role and tier
   */
  static getRoleCapabilities(role: string, tier: string): Feature[] {
    const tierData = this.getTierLimits(tier);
    const features = Object.values(EDUDASH_FEATURES);
    
    return features.filter(feature => {
      // Check if role has access
      const hasRole = feature.roles.includes(role as any);
      if (!hasRole) return false;
      
      // Check if tier has access
      const hasTier = feature.tiers.includes(tier as any) ||
                      tierData.features.includes(feature.id) ||
                      tierData.features.includes('all_starter_features') ||
                      tierData.features.includes('all_premium_features');
      
      return hasTier;
    });
  }

  /**
   * Search across features, screens, and schema
   * Returns ranked results with relevance scores
   */
  static search(query: string, options?: {
    includeFeatures?: boolean;
    includeScreens?: boolean;
    includeDb?: boolean;
  }): Array<{ 
    type: string; 
    id: string; 
    name: string; 
    relevance: number; 
    data: any 
  }> {
    const results: Array<{ 
      type: string; 
      id: string; 
      name: string; 
      relevance: number; 
      data: any 
    }> = [];
    
    const lowerQuery = query.toLowerCase();
    
    const opts = {
      includeFeatures: true,
      includeScreens: true,
      includeDb: true,
      ...options
    };

    // Search features
    if (opts.includeFeatures) {
      Object.values(EDUDASH_FEATURES).forEach(feature => {
        let relevance = 0;
        
        // High relevance for name matches
        if (feature.name.toLowerCase().includes(lowerQuery)) {
          relevance += 10;
        }
        
        // Medium relevance for description matches
        if (feature.description.toLowerCase().includes(lowerQuery)) {
          relevance += 5;
        }
        
        // High relevance for utterance matches (user language)
        if (feature.utterances.some(u => u.toLowerCase().includes(lowerQuery))) {
          relevance += 8;
        }
        
        // Lower relevance for trigger matches
        if (feature.triggers.some(t => t.toLowerCase().includes(lowerQuery))) {
          relevance += 3;
        }
        
        // Boost for exact ID match
        if (feature.id === lowerQuery) {
          relevance += 20;
        }
        
        if (relevance > 0) {
          results.push({
            type: 'feature',
            id: feature.id,
            name: feature.name,
            relevance,
            data: feature
          });
        }
      });
    }

    // Search screens
    if (opts.includeScreens) {
      Object.values(EDUDASH_SCREENS).forEach(screen => {
        let relevance = 0;
        
        if (screen.title.toLowerCase().includes(lowerQuery)) {
          relevance += 10;
        }
        
        if (screen.description.toLowerCase().includes(lowerQuery)) {
          relevance += 5;
        }
        
        if (screen.route.toLowerCase().includes(lowerQuery)) {
          relevance += 3;
        }
        
        // Check quick actions
        if (screen.quickActions?.some(a => a.toLowerCase().includes(lowerQuery))) {
          relevance += 6;
        }
        
        if (relevance > 0) {
          results.push({
            type: 'screen',
            id: screen.route,
            name: screen.title,
            relevance,
            data: screen
          });
        }
      });
    }

    // Search DB tables
    if (opts.includeDb) {
      Object.values(EDUDASH_DB).forEach(table => {
        let relevance = 0;
        
        if (table.table.toLowerCase().includes(lowerQuery)) {
          relevance += 10;
        }
        
        if (table.purpose.toLowerCase().includes(lowerQuery)) {
          relevance += 5;
        }
        
        // Check if query mentions any key columns
        if (table.keyCols.some(col => col.toLowerCase().includes(lowerQuery))) {
          relevance += 4;
        }
        
        if (relevance > 0) {
          results.push({
            type: 'db_table',
            id: table.table,
            name: table.table,
            relevance,
            data: table
          });
        }
      });
    }

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Suggest capabilities based on context
   * Uses time, screen, recent actions to recommend features
   */
  static suggestForContext(context: {
    role: string;
    tier: string;
    hour?: number;
    dayOfWeek?: number;
    currentScreen?: string;
    recentActions?: string[];
  }): Feature[] {
    const capabilities = this.getRoleCapabilities(context.role, context.tier);
    const scored: Array<{ feature: Feature; score: number }> = [];

    capabilities.forEach(feature => {
      let score = 0;

      // Time-based triggers
      if (context.hour !== undefined) {
        feature.triggers.forEach(trigger => {
          // Check for time range triggers (e.g., "8:00-9:00")
          if (trigger.includes('-') && trigger.includes(':')) {
            const parts = trigger.split('-');
            if (parts.length === 2) {
              const start = parseInt(parts[0].split(':')[0]);
              const end = parseInt(parts[1].split(':')[0]);
              if (!isNaN(start) && !isNaN(end)) {
                if (context.hour >= start && context.hour <= end) {
                  score += 5;
                }
              }
            }
          }
          
          // Check for general time triggers
          if (trigger.toLowerCase().includes('morning') && context.hour >= 6 && context.hour < 12) {
            score += 4;
          }
          if (trigger.toLowerCase().includes('afternoon') && context.hour >= 12 && context.hour < 17) {
            score += 4;
          }
          if (trigger.toLowerCase().includes('evening') && context.hour >= 17) {
            score += 4;
          }
        });

        // Day-based triggers
        if (context.dayOfWeek !== undefined) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const currentDay = dayNames[context.dayOfWeek];
          
          if (feature.triggers.some(t => t.toLowerCase().includes(currentDay.toLowerCase()))) {
            score += 5;
          }
          
          // Special cases
          if (context.dayOfWeek === 1 && feature.triggers.some(t => t.toLowerCase().includes('week start'))) {
            score += 5;
          }
          if (context.dayOfWeek === 5 && feature.triggers.some(t => t.toLowerCase().includes('week end'))) {
            score += 5;
          }
          if (context.dayOfWeek === 0 && feature.triggers.some(t => t.toLowerCase().includes('weekend'))) {
            score += 5;
          }
        }
      }

      // Screen context
      if (context.currentScreen && feature.relatedScreens?.includes(context.currentScreen)) {
        score += 8;
      }

      // Recent actions
      if (context.recentActions && context.recentActions.length > 0) {
        const hasRelated = context.recentActions.some(action =>
          feature.utterances.some(u => 
            action.toLowerCase().includes(u.toLowerCase()) ||
            u.toLowerCase().includes(action.toLowerCase())
          )
        );
        if (hasRelated) {
          score += 3;
        }
      }

      // Frequency boost for common features by role
      if (context.role === 'teacher') {
        if (['attendance', 'lesson_planning', 'grading'].includes(feature.id)) {
          score += 2;
        }
      } else if (context.role === 'principal') {
        if (['financial_dashboard', 'reports', 'announcement_system'].includes(feature.id)) {
          score += 2;
        }
      }

      if (score > 0) {
        scored.push({ feature, score });
      }
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.feature);
  }

  /**
   * Build compact prompt context string for AI
   * This is injected into system prompts to give Dash full platform awareness
   * Includes conversation state and voice/language settings
   */
  static buildPromptContext(
    profile: any,
    awareness: any,
    tier: string,
    conversationContext?: string,
    languageContext?: string
  ): string {
    const capabilities = this.getRoleCapabilities(profile?.role || 'teacher', tier);
    const tierData = this.getTierLimits(tier);
    
    let prompt = `\n## EDUDASH PRO PLATFORM KNOWLEDGE\n\n`;
    
    // Platform overview
    prompt += `**Platform:** EduDash Pro - ${SA_CONTEXT.targetAudience} Management System\n`;
    prompt += `**Focus:** ${SA_CONTEXT.ageRange} (${SA_CONTEXT.focusAreas.join(', ')})\n`;
    prompt += `**Curriculum:** ${SA_CONTEXT.curriculum} aligned\n`;
    prompt += `**Navigation:** ${NAVIGATION_CONTEXT.type} (${NAVIGATION_CONTEXT.notes[0]})\n\n`;
    
    // User context
    prompt += `**Current User:**\n`;
    prompt += `- Role: ${profile?.role || 'teacher'}\n`;
    prompt += `- Tier: ${tier} (${tierData.name})\n`;
    prompt += `- Organization: ${profile?.organization_name || awareness?.user?.organization || 'unknown'}\n\n`;
    
    // Available features (limit to 8 to avoid token bloat)
    prompt += `**Available Capabilities (${capabilities.length} total):**\n`;
    capabilities.slice(0, 8).forEach(cap => {
      prompt += `- **${cap.name}**: ${cap.description}\n`;
    });
    
    if (capabilities.length > 8) {
      prompt += `- ... and ${capabilities.length - 8} more features available\n`;
    }
    prompt += `\n`;
    
    // Database awareness
    prompt += `**Data Model & Security:**\n`;
    prompt += `- Multi-tenant: ALL queries filtered by ${SECURITY_CONTEXT.tenantKey}\n`;
    prompt += `- RLS enforced: ${SECURITY_CONTEXT.rlsEnforced ? 'YES' : 'NO'}\n`;
    prompt += `- Key tables: ${Object.keys(EDUDASH_DB).slice(0, 6).join(', ')}\n`;
    prompt += `- NEVER query across tenants - data isolation is CRITICAL\n\n`;
    
    // Edge Functions
    prompt += `**Available Edge Functions:**\n`;
    Object.values(EDGE_FUNCTIONS).forEach(fn => {
      prompt += `- **${fn.name}**: ${fn.description}\n`;
    });
    prompt += `\n`;
    
    // Subscription limits
    prompt += `**Subscription Limits:**\n`;
    prompt += `- AI Requests: ${tierData.aiLimits.requestsPerHour}/hour, ${tierData.aiLimits.requestsPerDay}/day\n`;
    prompt += `- Models: ${tierData.aiLimits.modelsAllowed.join(', ')}\n`;
    prompt += `- Storage: ${tierData.storage.documents === -1 ? 'unlimited' : tierData.storage.documents} docs, ${tierData.storage.voiceNotes === -1 ? 'unlimited' : tierData.storage.voiceNotes} voice notes\n\n`;
    
    // Critical guardrails
    prompt += `**CRITICAL GUARDRAILS:**\n`;
    SECURITY_CONTEXT.notes.forEach(note => {
      prompt += `- ${note}\n`;
    });
    prompt += `- NEVER claim files are attached; use Export/Save options or open screens\n`;
    prompt += `- Navigation is Stack-based; no tabs or drawer menu\n`;
    
    // Add conversation context if provided
    if (conversationContext) {
      prompt += conversationContext;
    }
    
    // Add language/voice context if provided
    if (languageContext) {
      prompt += languageContext;
    }
    
    return prompt;
  }

  /**
   * Determine risk level for an action
   * Used by autonomy system to decide if action can auto-execute
   */
  static getRiskForAction(action: {
    type: string;
    parameters?: Record<string, any>;
  }): 'low' | 'medium' | 'high' {
    const { type, parameters } = action;

    // High risk actions - always require approval
    const highRiskActions = [
      'email_send',
      'data_update',
      'api_call'
    ];

    if (highRiskActions.includes(type)) {
      // Check if it's a destructive operation
      if (parameters?.operation === 'delete') return 'high';
      if (parameters?.table === 'grades' || parameters?.table === 'students') return 'high';
      if (parameters?.external === true) return 'high';
      if (parameters?.modifiesGrades === true) return 'high';
      if (parameters?.deletesData === true) return 'high';
      
      return 'medium';
    }

    // Medium risk actions - require approval in assistant mode
    const mediumRiskActions = [
      'notification',
      'file_generation'
    ];

    if (mediumRiskActions.includes(type)) {
      // Check if it's external
      if (parameters?.external === true) return 'high';
      return 'medium';
    }

    // Low risk actions (navigation, read-only operations)
    return 'low';
  }

  /**
   * Get feature by ID
   */
  static getFeature(featureId: string): Feature | undefined {
    return EDUDASH_FEATURES[featureId];
  }

  /**
   * Get screen by route
   */
  static getScreen(route: string): Screen | undefined {
    return Object.values(EDUDASH_SCREENS).find(s => s.route === route);
  }

  /**
   * Get DB table info by name
   */
  static getDbTable(tableName: string): DbTable | undefined {
    return EDUDASH_DB[tableName];
  }

  /**
   * Check if feature is available for role and tier
   */
  static isFeatureAvailable(featureId: string, role: string, tier: string): boolean {
    const feature = this.getFeature(featureId);
    if (!feature) return false;

    const tierData = this.getTierLimits(tier);
    const hasRole = feature.roles.includes(role as any);
    const hasTier = feature.tiers.includes(tier as any) ||
                    tierData.features.includes(featureId) ||
                    tierData.features.includes('all_starter_features') ||
                    tierData.features.includes('all_premium_features');

    return hasRole && hasTier;
  }

  /**
   * Get features by risk level
   */
  static getFeaturesByRisk(riskLevel: 'low' | 'medium' | 'high'): Feature[] {
    return Object.values(EDUDASH_FEATURES).filter(f => f.riskLevel === riskLevel);
  }

  /**
   * Get features that match a specific utterance
   */
  static findFeaturesByUtterance(utterance: string): Feature[] {
    const lower = utterance.toLowerCase();
    return Object.values(EDUDASH_FEATURES).filter(feature =>
      feature.utterances.some(u => 
        u.toLowerCase().includes(lower) || 
        lower.includes(u.toLowerCase())
      )
    );
  }

  /**
   * Get screens accessible by role
   */
  static getScreensByRole(role: string): Screen[] {
    return Object.values(EDUDASH_SCREENS).filter(screen =>
      screen.roles.includes(role as any)
    );
  }

  /**
   * Get tier upgrade recommendation
   * Returns null if already at highest tier with needed feature
   */
  static getTierUpgradeRecommendation(
    currentTier: string,
    desiredFeatureId: string
  ): { tier: string; reason: string } | null {
    const feature = this.getFeature(desiredFeatureId);
    if (!feature) return null;

    // Check if current tier has access
    const currentTierData = this.getTierLimits(currentTier);
    const hasAccess = feature.tiers.includes(currentTier as any) ||
                      currentTierData.features.includes(desiredFeatureId) ||
                      currentTierData.features.includes('all_' + currentTier + '_features');

    if (hasAccess) return null; // Already has access

    // Find minimum tier that provides access
    const tierOrder = ['free', 'starter', 'premium', 'enterprise'];
    for (const tier of tierOrder) {
      if (feature.tiers.includes(tier as any)) {
        return {
          tier,
          reason: `${feature.name} is available in ${SUBSCRIPTION_TIERS[tier].name} tier and above`
        };
      }
    }

    return null;
  }

  /**
   * Get feature statistics
   */
  static getStats() {
    return {
      totalFeatures: Object.keys(EDUDASH_FEATURES).length,
      totalScreens: Object.keys(EDUDASH_SCREENS).length,
      totalDbTables: Object.keys(EDUDASH_DB).length,
      totalTiers: Object.keys(SUBSCRIPTION_TIERS).length,
      byRisk: {
        low: this.getFeaturesByRisk('low').length,
        medium: this.getFeaturesByRisk('medium').length,
        high: this.getFeaturesByRisk('high').length
      },
      byRole: {
        teacher: Object.values(EDUDASH_FEATURES).filter(f => f.roles.includes('teacher')).length,
        principal: Object.values(EDUDASH_FEATURES).filter(f => f.roles.includes('principal')).length,
        parent: Object.values(EDUDASH_FEATURES).filter(f => f.roles.includes('parent')).length,
        super_admin: Object.values(EDUDASH_FEATURES).filter(f => f.roles.includes('super_admin')).length
      }
    };
  }

  /**
   * Validate that a query respects multi-tenant isolation
   * Returns warning if query might be missing tenant filter
   */
  static validateQuery(query: string): { 
    valid: boolean; 
    warnings: string[] 
  } {
    const warnings: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Check if query mentions any tables
    const mentionedTables = Object.keys(EDUDASH_DB).filter(table =>
      lowerQuery.includes(table.toLowerCase())
    );

    if (mentionedTables.length > 0) {
      // Check if preschool_id is mentioned
      if (!lowerQuery.includes('preschool_id')) {
        warnings.push(
          `Query mentions tables (${mentionedTables.join(', ')}) but doesn't include preschool_id filter. ` +
          `This may violate tenant isolation!`
        );
      }
    }

    // Check for dangerous operations
    if (lowerQuery.includes('delete') || lowerQuery.includes('drop')) {
      warnings.push('Query contains potentially destructive operations (DELETE/DROP)');
    }

    // Check for cross-tenant keywords
    if (lowerQuery.includes('all preschool') || lowerQuery.includes('all school')) {
      warnings.push('Query suggests cross-tenant access which violates RLS policy');
    }

    return {
      valid: warnings.length === 0,
      warnings
    };
  }
}
