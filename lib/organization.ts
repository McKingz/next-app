/**
 * Organization Configuration Service
 * 
 * Provides utilities for accessing organization-specific configurations,
 * terminology, and AI personalities.
 * 
 * Part of Phase 3C: Dynamic greetings and capabilities
 */

import { 
  OrganizationType, 
  OrganizationConfig, 
  ORGANIZATION_CONFIGS,
  TerminologyMap,
  AIPersonalityConfig 
} from './types/organization';

/**
 * Get organization configuration by type
 */
export function getOrganizationConfig(type: OrganizationType | string): OrganizationConfig {
  const orgType = type as OrganizationType;
  return ORGANIZATION_CONFIGS[orgType] || ORGANIZATION_CONFIGS[OrganizationType.PRESCHOOL];
}

/**
 * Get terminology mapping for an organization
 */
export function getTerminology(type: OrganizationType | string): TerminologyMap {
  const config = getOrganizationConfig(type);
  return config.terminology;
}

/**
 * Get AI personality for a specific role in an organization
 */
export function getAIPersonality(
  organizationType: OrganizationType | string,
  role: string
): AIPersonalityConfig | null {
  const config = getOrganizationConfig(organizationType);
  return config.aiPersonalities[role] || null;
}

/**
 * Get dynamic greeting for a user based on their organization and role
 */
export function getDynamicGreeting(
  organizationType: OrganizationType | string,
  role: string,
  userName?: string
): string {
  const personality = getAIPersonality(organizationType, role);
  
  if (personality) {
    return personality.greeting;
  }
  
  // Fallback greeting
  const config = getOrganizationConfig(organizationType);
  const term = config.terminology;
  
  if (userName) {
    return `Hello ${userName}! I'm Dash, your AI assistant. How can I help you today?`;
  }
  
  return `Hello! I'm Dash, your AI assistant for ${term.organization}. How can I help you today?`;
}

/**
 * Get capabilities for a role in an organization
 */
export function getRoleCapabilities(
  organizationType: OrganizationType | string,
  role: string
): string[] {
  const config = getOrganizationConfig(organizationType);
  const roleConfig = config.roles.find(r => r.id === role || r.name === role);
  return roleConfig?.capabilities || [];
}

/**
 * Get proactive behaviors for a role
 */
export function getProactiveBehaviors(
  organizationType: OrganizationType | string,
  role: string
): string[] {
  const personality = getAIPersonality(organizationType, role);
  return personality?.proactiveBehaviors || [];
}

/**
 * Map generic term to organization-specific term
 * 
 * @example
 * mapTerm('student', 'corporate') => 'employee'
 * mapTerm('class', 'sports_club') => 'team'
 */
export function mapTerm(
  genericTerm: keyof TerminologyMap,
  organizationType: OrganizationType | string
): string {
  const terminology = getTerminology(organizationType);
  return terminology[genericTerm] || genericTerm;
}

/**
 * Get all available roles for an organization type
 */
export function getAvailableRoles(organizationType: OrganizationType | string): string[] {
  const config = getOrganizationConfig(organizationType);
  return config.roles.map(r => r.id);
}

/**
 * Check if a feature is enabled for an organization type
 */
export function isFeatureEnabled(
  organizationType: OrganizationType | string,
  featureName: keyof OrganizationConfig['features']
): boolean {
  const config = getOrganizationConfig(organizationType);
  return config.features[featureName] ?? false;
}

/**
 * Get display name for organization type
 */
export function getOrganizationDisplayName(type: OrganizationType | string): string {
  const config = getOrganizationConfig(type);
  return config.displayName;
}
