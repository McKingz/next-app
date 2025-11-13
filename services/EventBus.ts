/**
 * EventBus - Simple pub/sub for agent perception
 * Enables the AI agent to observe app state changes
 */

type EventHandler = (data: any) => void | Promise<void>;

/**
 * EventBus interface for dependency injection
 */
export interface IEventBus {
  subscribe(event: string, handler: EventHandler): () => void;
  publish(event: string, data?: any): Promise<void>;
}

class EventBusService implements IEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Subscribe to an event
   */
  subscribe(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  /**
   * Publish an event
   */
  async publish(event: string, data?: any): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    // Execute handlers in parallel
    await Promise.all(
      Array.from(handlers).map(handler => 
        Promise.resolve(handler(data)).catch(err => 
          console.error(`[EventBus] Handler error for ${event}:`, err)
        )
      )
    );
  }

  /**
   * Standard event types for the agent
   */
  static readonly Events = {
    // User interactions
    CONVERSATION_MESSAGE: 'conversation:message',
    VOICE_INPUT: 'voice:input',
    
    // Task management
    TASK_CREATED: 'task:created',
    TASK_UPDATED: 'task:updated',
    TASK_COMPLETED: 'task:completed',
    
    // Navigation
    SCREEN_CHANGED: 'navigation:screen_changed',
    
    // Agent decisions
    AGENT_DECISION: 'agent:decision',
    TOOL_EXECUTED: 'agent:tool_executed',
    
    // System events
    AI_ERROR: 'system:ai_error',
    REMINDER_TRIGGERED: 'reminder:triggered',
  } as const;

  /**
   * Dispose method for cleanup
   */
  dispose(): void {
    this.handlers.clear();
  }
}

// Export service for DI registration
export { EventBusService };
export const Events = EventBusService.Events;

// Backward compatibility: Export singleton instance
// TODO: Remove once all call sites migrated to DI
import { container, TOKENS } from '../lib/di/providers/default';
export const EventBus = (() => {
  try {
    return container.resolve(TOKENS.eventBus);
  } catch {
    // Fallback during initialization
    return new EventBusService();
  }
})();
