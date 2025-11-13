/**
 * DashCapabilityDiscovery Service
 * 
 * Handles intelligent feature discovery and availability checking for the Dash AI Assistant.
 * This service helps Dash discover what it can do based on user context, subscription tier,
 * and role permissions.
 */

import { DashEduDashKnowledge } from './DashEduDashKnowledge';
import type { Feature } from '@/lib/constants/edudash-features';

interface DiscoveryCache {
  capabilities: Feature[];
  role: string;
  tier: string;
  timestamp: number;
}

interface DiscoveryContext {
  role: string;
  tier: string;
  currentScreen?: string;
  recentActions?: string[];
  hour?: number;
  dayOfWeek?: number;
}

export class DashCapabilityDiscovery {
  private static cache: DiscoveryCache | null = null;
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if a specific feature is available to the current user
   */
  static checkAvailability(
    featureId: string,
    role: string,
    tier: string
  ): {
    available: boolean;
    reason?: string;
    upgradeRequired?: string;
  } {
    const isAvailable = DashEduDashKnowledge.isFeatureAvailable(featureId, role, tier);

    if (isAvailable) {
      return { available: true };
    }

    // Get upgrade recommendation
    const upgrade = DashEduDashKnowledge.getTierUpgradeRecommendation(tier, featureId);
    const feature = DashEduDashKnowledge.getFeature(featureId);

    if (!feature) {
      return {
        available: false,
        reason: `Feature "${featureId}" does not exist`
      };
    }

    // Check if it's a role issue
    if (!feature.roles.includes(role as any)) {
      return {
        available: false,
        reason: `Feature "${feature.name}" is not available for ${role} role`
      };
    }

    // Must be a tier issue
    return {
      available: false,
      reason: `Feature "${feature.name}" requires a higher subscription tier`,
      upgradeRequired: upgrade?.tier
    };
  }

  /**
   * Discover all capabilities available to the current user
   * Uses caching to avoid repeated calculations
   */
  static discoverCapabilities(role: string, tier: string): Feature[] {
    // Check cache
    if (
      this.cache &&
      this.cache.role === role &&
      this.cache.tier === tier &&
      Date.now() - this.cache.timestamp < this.CACHE_TTL
    ) {
      return this.cache.capabilities;
    }

    // Fetch capabilities
    const capabilities = DashEduDashKnowledge.getRoleCapabilities(role, tier);

    // Update cache
    this.cache = {
      capabilities,
      role,
      tier,
      timestamp: Date.now()
    };

    return capabilities;
  }

  /**
   * Discover capabilities for a specific user intent
   * Uses natural language matching to find relevant features
   */
  static discoverForIntent(
    intent: string,
    context: DiscoveryContext
  ): {
    primaryMatch: Feature | null;
    relatedMatches: Feature[];
  } {
    // Search for features matching the intent
    const searchResults = DashEduDashKnowledge.search(intent, {
      includeFeatures: true,
      includeScreens: false,
      includeDb: false
    });

    // Filter to only features the user can access
    const capabilities = this.discoverCapabilities(context.role, context.tier);
    const capabilityIds = new Set(capabilities.map(c => c.id));

    const accessibleMatches = searchResults
      .filter(r => r.type === 'feature' && capabilityIds.has(r.id))
      .map(r => r.data as Feature);

    if (accessibleMatches.length === 0) {
      return {
        primaryMatch: null,
        relatedMatches: []
      };
    }

    // First match is the primary
    const primaryMatch = accessibleMatches[0];

    // Related matches are the rest (limit to 3)
    const relatedMatches = accessibleMatches.slice(1, 4);

    return {
      primaryMatch,
      relatedMatches
    };
  }

  /**
   * Auto-discover relevant capabilities based on context
   * This is used for proactive suggestions
   */
  static autoDiscover(context: DiscoveryContext): Feature[] {
    return DashEduDashKnowledge.suggestForContext(context);
  }

  /**
   * Get discovery suggestions for a specific screen
   */
  static discoverForScreen(
    screenRoute: string,
    role: string,
    tier: string
  ): Feature[] {
    const screen = DashEduDashKnowledge.getScreen(screenRoute);
    if (!screen || !screen.relatedFeatures) {
      return [];
    }

    const capabilities = this.discoverCapabilities(role, tier);
    return capabilities.filter(cap =>
      screen.relatedFeatures?.includes(cap.id)
    );
  }

  /**
   * Discover features by risk level
   * Useful for autonomy decisions
   */
  static discoverByRisk(
    riskLevel: 'low' | 'medium' | 'high',
    role: string,
    tier: string
  ): Feature[] {
    const capabilities = this.discoverCapabilities(role, tier);
    return capabilities.filter(cap => cap.riskLevel === riskLevel);
  }

  /**
   * Get feature summary for prompt injection
   * Returns a compact description of what Dash can do
   */
  static getCapabilitySummary(role: string, tier: string): string {
    const capabilities = this.discoverCapabilities(role, tier);

    // Group by risk level
    const byRisk = {
      low: capabilities.filter(c => c.riskLevel === 'low'),
      medium: capabilities.filter(c => c.riskLevel === 'medium'),
      high: capabilities.filter(c => c.riskLevel === 'high')
    };

    let summary = `You have access to ${capabilities.length} capabilities:\n\n`;

    // Safe actions
    if (byRisk.low.length > 0) {
      summary += `**Safe Actions (auto-executable):**\n`;
      summary += byRisk.low.slice(0, 5).map(c => `- ${c.name}`).join('\n');
      if (byRisk.low.length > 5) {
        summary += `\n- ... and ${byRisk.low.length - 5} more\n`;
      }
      summary += `\n\n`;
    }

    // Moderate actions
    if (byRisk.medium.length > 0) {
      summary += `**Moderate Actions (may require approval):**\n`;
      summary += byRisk.medium.slice(0, 3).map(c => `- ${c.name}`).join('\n');
      if (byRisk.medium.length > 3) {
        summary += `\n- ... and ${byRisk.medium.length - 3} more\n`;
      }
      summary += `\n\n`;
    }

    // High-risk actions
    if (byRisk.high.length > 0) {
      summary += `**High-Risk Actions (always require approval):**\n`;
      summary += byRisk.high.slice(0, 3).map(c => `- ${c.name}`).join('\n');
      if (byRisk.high.length > 3) {
        summary += `\n- ... and ${byRisk.high.length - 3} more\n`;
      }
    }

    return summary;
  }

  /**
   * Clear the discovery cache
   */
  static clearCache(): void {
    this.cache = null;
  }

  /**
   * Check if a feature requires an upgrade
   */
  static requiresUpgrade(
    featureId: string,
    currentTier: string
  ): { required: boolean; targetTier?: string; reason?: string } {
    const upgrade = DashEduDashKnowledge.getTierUpgradeRecommendation(currentTier, featureId);

    if (!upgrade) {
      return { required: false };
    }

    return {
      required: true,
      targetTier: upgrade.tier,
      reason: upgrade.reason
    };
  }

  /**
   * Get navigation suggestions based on current context
   */
  static discoverNavigationOptions(
    role: string,
    tier: string,
    currentScreen?: string
  ): Array<{ screen: any; features: Feature[] }> {
    const capabilities = this.discoverCapabilities(role, tier);
    const screens = DashEduDashKnowledge.getScreensByRole(role);

    return screens
      .filter(screen => screen.route !== currentScreen) // Exclude current screen
      .map(screen => {
        const relatedFeatures = capabilities.filter(cap =>
          screen.relatedFeatures?.includes(cap.id)
        );

        return {
          screen,
          features: relatedFeatures
        };
      })
      .filter(option => option.features.length > 0) // Only screens with features
      .slice(0, 5); // Limit to top 5
  }

  /**
   * Get discovery statistics
   */
  static getStats(role: string, tier: string) {
    const capabilities = this.discoverCapabilities(role, tier);
    const allFeatures = Object.values(DashEduDashKnowledge.getFeatureCatalog());

    return {
      available: capabilities.length,
      total: allFeatures.length,
      percentage: Math.round((capabilities.length / allFeatures.length) * 100),
      byRisk: {
        low: capabilities.filter(c => c.riskLevel === 'low').length,
        medium: capabilities.filter(c => c.riskLevel === 'medium').length,
        high: capabilities.filter(c => c.riskLevel === 'high').length
      },
      locked: allFeatures.length - capabilities.length
    };
  }
}
