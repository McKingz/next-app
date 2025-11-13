/**
 * Utility functions for role-based agentic mode
 * Determines AI assistant capabilities based on user role
 */

import { DashAgenticIntegration, AgenticCapabilities } from '@/services/DashAgenticIntegration';

/**
 * Check if user has agentic mode enabled
 * Only superadmin role gets full agentic capabilities
 */
export function isAgenticModeEnabled(role?: string): boolean {
  if (!role) return false;
  
  const capabilities = DashAgenticIntegration.getAgenticCapabilities(role);
  return capabilities.mode === 'agent';
}

/**
 * Get agentic capabilities for a role
 */
export function getAgenticCapabilities(role?: string): AgenticCapabilities {
  if (!role) {
    return {
      mode: 'assistant',
      canRunDiagnostics: false,
      canMakeCodeChanges: false,
      canAccessSystemLevel: false,
      canAutoExecuteHighRisk: false,
      autonomyLevel: 'limited'
    };
  }
  
  return DashAgenticIntegration.getAgenticCapabilities(role);
}

/**
 * Check if user can run diagnostics
 */
export function canRunDiagnostics(role?: string): boolean {
  const capabilities = getAgenticCapabilities(role);
  return capabilities.canRunDiagnostics;
}

/**
 * Check if user can make code-level changes
 */
export function canMakeCodeChanges(role?: string): boolean {
  const capabilities = getAgenticCapabilities(role);
  return capabilities.canMakeCodeChanges;
}

/**
 * Check if user has system-level access
 */
export function hasSystemAccess(role?: string): boolean {
  const capabilities = getAgenticCapabilities(role);
  return capabilities.canAccessSystemLevel;
}

/**
 * Get display name for agentic mode
 */
export function getAgenticModeDisplayName(role?: string): string {
  const capabilities = getAgenticCapabilities(role);
  
  if (capabilities.mode === 'agent') {
    return 'Agentic Mode (Full Autonomy)';
  }
  
  return 'Assistant Mode';
}

/**
 * Get description for user's agentic capabilities
 */
export function getAgenticCapabilitiesDescription(role?: string): string {
  const capabilities = getAgenticCapabilities(role);
  
  if (capabilities.mode === 'agent') {
    return 'You have full system access. Dash can run diagnostics, analyze system health, and suggest code-level fixes.';
  }
  
  return 'Dash operates in assistant mode, helping with educational tasks and answering questions.';
}
