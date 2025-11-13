/**
 * Lazy Dash AI Assistant Accessor
 * 
 * Provides a safe, async way to access the DashAIAssistant instance.
 * Uses dynamic imports to break circular dependencies at module evaluation time.
 * 
 * ⚠️ IMPORTANT: Always use this function instead of directly calling
 * DashAIAssistant.getInstance() from other services to avoid circular deps.
 * 
 * Usage:
 * ```typescript
 * import { getAssistant } from './core/getAssistant';
 * 
 * async function myFunction() {
 *   try {
 *     const assistant = await getAssistant();
 *     await assistant.sendMessage('Hello');
 *   } catch (error) {
 *     console.error('Failed to get assistant:', error);
 *     // Handle gracefully
 *   }
 * }
 * ```
 */

import { serviceLocator } from './ServiceLocator';
import type { IDashAIAssistant } from '../dash-ai/DashAICompat';

/**
 * Get or initialize the DashAIAssistant instance
 * 
 * This function:
 * 1. Checks if the assistant is already registered in the ServiceLocator
 * 2. If not, dynamically imports the DashAICompat module
 * 3. Calls getInstance() to get the singleton instance
 * 4. Registers it in the ServiceLocator for future use
 * 5. Returns the instance
 * 
 * @returns Promise<IDashAIAssistant> - The assistant instance
 * @throws Error if the module fails to load
 */
export async function getAssistant(): Promise<IDashAIAssistant> {
  // Check if already registered
  const existing = serviceLocator.get('DashAIAssistant');
  if (existing) {
    return existing;
  }

  try {
    // Dynamic import to break circular dependency - use new modular path
    const mod = await import('../dash-ai/DashAICompat');
    
    // Get the DashAIAssistant class from the compat module
    const AssistantClass = mod.DashAIAssistant;
    
    if (!AssistantClass || typeof AssistantClass.getInstance !== 'function') {
      throw new Error('DashAIAssistant module failed to load: getInstance not available');
    }

    // Get singleton instance
    const instance = AssistantClass.getInstance();

    // Register for future use
    serviceLocator.register('DashAIAssistant', instance);

    console.debug('[getAssistant] Successfully loaded and registered DashAIAssistant');
    return instance;
  } catch (error) {
    console.error('[getAssistant] Failed to load DashAIAssistant:', error);
    throw new Error(`Failed to load Dash AI Assistant: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the assistant instance without throwing if unavailable
 * Returns null instead of throwing an error
 * 
 * @returns Promise<IDashAIAssistant | null>
 */
export async function getAssistantSafe(): Promise<IDashAIAssistant | null> {
  try {
    return await getAssistant();
  } catch (error) {
    console.warn('[getAssistantSafe] Assistant unavailable:', error);
    return null;
  }
}
