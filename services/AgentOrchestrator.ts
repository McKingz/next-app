/**
 * AgentOrchestrator - The brain of the agentic AI system
 * Implements the Plan-Act-Reflect loop with tool use and memory
 */

import { ToolRegistry } from './AgentTools';
import { MemoryService } from './MemoryService';
import { EventBus, Events } from './EventBus';
import { assertSupabase } from '@/lib/supabase';
import { getCurrentProfile } from '@/lib/sessionManager';
import { getAssistant } from './core/getAssistant';

export interface AgentGoal {
  objective: string;
  context?: any;
  constraints?: {
    maxSteps?: number;
    maxTools?: number;
    timeout?: number;
  };
}

export interface AgentResult {
  success: boolean;
  message: string;
  toolsUsed: string[];
  reflection?: string;
  metadata?: any;
}

interface ToolCall {
  name: string;
  arguments: any;
}

/**
 * Interface for AgentOrchestrator
 */
export interface IAgentOrchestrator {
  run(goal: AgentGoal): Promise<AgentResult>;
  dispose(): void;
}

export class AgentOrchestratorClass implements IAgentOrchestrator {
  private isRunning = false;
  private currentRunId?: string;
  
  // Default constraints
  private readonly DEFAULT_MAX_STEPS = 4;
  private readonly DEFAULT_MAX_TOOLS = 5;
  private readonly DEFAULT_TIMEOUT = 20000; // 20 seconds

  constructor() {}

  /**
   * Main agent execution loop
   */
  async run(goal: AgentGoal): Promise<AgentResult> {
    if (this.isRunning) {
      return {
        success: false,
        message: "Agent is already running another task",
        toolsUsed: []
      };
    }

    this.isRunning = true;
    this.currentRunId = `run_${Date.now()}`;
    const runId = this.currentRunId;
    
    // Track execution
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    const constraints = {
      maxSteps: goal.constraints?.maxSteps || this.DEFAULT_MAX_STEPS,
      maxTools: goal.constraints?.maxTools || this.DEFAULT_MAX_TOOLS,
      timeout: goal.constraints?.timeout || this.DEFAULT_TIMEOUT
    };

    try {
      console.log(`[Agent] Starting run ${runId} for objective:`, goal.objective);
      
      // 1. PERCEIVE - Gather context
      const perception = await this.perceive(goal);
      
      // 2. PLAN & ACT - Tool use loop
      const messages: any[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(perception)
        },
        {
          role: 'user',
          content: goal.objective
        }
      ];
      
      let steps = 0;
      let toolCount = 0;
      
      while (steps < constraints.maxSteps && toolCount < constraints.maxTools) {
        // Check timeout
        if (Date.now() - startTime > constraints.timeout) {
          console.warn(`[Agent] Timeout reached for run ${runId}`);
          break;
        }
        
        // Get next action from LLM
        const decision = await this.think(messages, perception.toolSpecs);
        
        if (!decision.toolCalls || decision.toolCalls.length === 0) {
          // No more tools to call - agent is done
          messages.push({
            role: 'assistant',
            content: decision.content || "I've completed the requested task."
          });
          break;
        }
        
        // Execute tools
        for (const toolCall of decision.toolCalls) {
          if (toolCount >= constraints.maxTools) break;
          
          const result = await this.act(toolCall);
          toolsUsed.push(toolCall.name);
          toolCount++;
          
          // Add tool result to conversation
          messages.push({
            role: 'tool',
            name: toolCall.name,
            content: JSON.stringify(result)
          });
          
          // Publish event
          await EventBus.publish(Events.TOOL_EXECUTED, {
            tool: toolCall.name,
            args: toolCall.arguments,
            result
          });
        }
        
        steps++;
      }
      
      // 3. REFLECT - Learn from the execution
      const reflection = await this.reflect(goal.objective, messages, toolsUsed);
      
      // Store execution in memory
      await this.storeExecution(goal, toolsUsed, reflection);
      
      // Extract final message
      const finalMessage = messages
        .filter(m => m.role === 'assistant')
        .pop()?.content || "Task completed successfully.";
      
      return {
        success: true,
        message: finalMessage,
        toolsUsed,
        reflection,
        metadata: {
          runId,
          steps,
          duration: Date.now() - startTime
        }
      };
      
    } catch (error) {
      console.error(`[Agent] Run ${runId} failed:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
        toolsUsed
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * PERCEIVE - Gather context and available tools
   */
  private async perceive(goal: AgentGoal) {
    // Get user profile
    const profile = await getCurrentProfile();
    
    // Retrieve relevant memories
    const memories = await MemoryService.retrieveRelevant(goal.objective, 8);
    
    // Get available tools
    const toolSpecs = ToolRegistry.getToolSpecs();
    
    // Get current screen context
    const dash = await getAssistant();
    const screenContext = dash.getCurrentScreenContext();
    
    return {
      userRole: profile?.role || 'teacher',
      memories,
      toolSpecs,
      screenContext,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * THINK - Use LLM to decide next action
   */
  private async think(messages: any[], toolSpecs: any[]) {
    try {
      const supabase = assertSupabase();
      
      const { data, error } = await supabase.functions.invoke('ai-gateway', {
        body: {
          action: 'agent_plan',
          messages,
          tools: toolSpecs,
          model: 'claude-3-haiku', // Fast model for agent loops
          temperature: 0.3 // Lower temperature for more deterministic behavior
        }
      });

      if (error) throw error;

      return {
        content: data.content,
        toolCalls: data.tool_calls || []
      };
    } catch (error) {
      console.error('[Agent] Think failed:', error);
      // Fallback response
      return {
        content: "I apologize, but I'm having trouble processing this request. Please try again.",
        toolCalls: []
      };
    }
  }

  /**
   * ACT - Execute a tool
   */
  private async act(toolCall: ToolCall) {
    console.log(`[Agent] Executing tool: ${toolCall.name}`);
    
    const result = await ToolRegistry.execute(
      toolCall.name,
      toolCall.arguments
    );
    
    return result;
  }

  /**
   * REFLECT - Learn from the execution
   */
  private async reflect(
    objective: string,
    messages: any[],
    toolsUsed: string[]
  ): Promise<string> {
    try {
      const supabase = assertSupabase();
      
      const reflectionPrompt = `
        Based on the execution:
        - Objective: ${objective}
        - Tools used: ${toolsUsed.join(', ')}
        - Message count: ${messages.length}
        
        Provide a brief reflection (1-2 sentences) on:
        1. What worked well?
        2. What could be improved next time?
      `;
      
      const { data } = await supabase.functions.invoke('ai-gateway', {
        body: {
          action: 'chat',
          messages: [
            { role: 'system', content: 'You are Dash reflecting on task execution.' },
            { role: 'user', content: reflectionPrompt }
          ],
          model: 'claude-3-haiku',
          maxTokens: 100
        }
      });
      
      return data?.content || "Execution completed as expected.";
    } catch (error) {
      console.error('[Agent] Reflection failed:', error);
      return "Execution completed.";
    }
  }

  /**
   * Store execution details in memory
   */
  private async storeExecution(
    goal: AgentGoal,
    toolsUsed: string[],
    reflection: string
  ) {
    // Store as interaction memory
    await MemoryService.upsertMemory({
      type: 'interaction',
      content: {
        objective: goal.objective,
        toolsUsed,
        reflection,
        timestamp: new Date().toISOString()
      },
      importance: 3
    });
    
    // If tools were used successfully, store as pattern
    if (toolsUsed.length > 0) {
      await MemoryService.upsertMemory({
        type: 'pattern',
        content: {
          pattern: `For objectives like "${goal.objective}", use tools: ${toolsUsed.join(', ')}`,
          success: true
        },
        importance: 5
      });
    }
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(perception: any): string {
    const memoryContext = perception.memories
      .slice(0, 3)
      .map((m: any) => `- ${JSON.stringify(m.content)}`)
      .join('\n');

    return `You are Dash, an AI teaching assistant with the ability to use tools to help users.

Current context:
- User role: ${perception.userRole}
- Current screen: ${perception.screenContext.screen}
- Time: ${perception.timestamp}

Relevant memories:
${memoryContext || '(No relevant memories)'}

You have access to various tools to complete tasks. Use them wisely and efficiently.
Always be helpful, concise, and focused on education.
If you need to perform multiple steps, use the appropriate tools in sequence.
When you've completed the task, provide a clear summary without calling more tools.`;
  }

  /**
   * Cancel current execution
   */
  cancelCurrentRun(): void {
    if (this.isRunning && this.currentRunId) {
      console.log(`[Agent] Cancelling run ${this.currentRunId}`);
      this.isRunning = false;
    }
  }

  /**
   * Check if agent is currently running
   */
  isAgentRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Dispose method for cleanup
   */
  public dispose(): void {
    this.cancelCurrentRun();
  }
}

// Backward compatibility: Export singleton instance
// TODO: Remove once all call sites migrated to DI
import { container, TOKENS } from '../lib/di/providers/default';
export const AgentOrchestratorInstance = (() => {
  try {
    return container.resolve(TOKENS.agentOrchestrator);
  } catch {
    // Fallback during initialization
    return new AgentOrchestratorClass();
  }
})();

// Back-compat export for legacy call sites
export const AgentOrchestrator = AgentOrchestratorInstance;

export default AgentOrchestratorInstance;
