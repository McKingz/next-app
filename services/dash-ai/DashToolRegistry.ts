/**
 * DashToolRegistry
 * 
 * Central registry for all tools Dash can autonomously call.
 * Manages tool registration, access control, and execution.
 * 
 * **Security**:
 * - Role-based access control
 * - RLS enforcement for database tools
 * - Risk level assessment
 * - Execution logging
 */

import { Tool, ToolCategory, RiskLevel, ToolExecutionContext, ToolExecutionResult, ToolRegistryStats } from './types';

export class DashToolRegistry {
  private static tools: Map<string, Tool> = new Map();
  private static executionCount: number = 0;
  private static successCount: number = 0;

  /**
   * Register a tool in the registry
   */
  static registerTool(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      console.warn(`[ToolRegistry] Tool ${tool.id} already registered. Overwriting.`);
    }
    this.tools.set(tool.id, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.id} (${tool.category}, ${tool.riskLevel} risk)`);
  }

  /**
   * Get all tools available for a given role and tier
   */
  static getAvailableTools(role: string, tier: string): Tool[] {
    const available: Tool[] = [];

    for (const tool of this.tools.values()) {
      // Check role access
      if (!tool.allowedRoles.includes(role as any)) {
        continue;
      }

      // Check tier requirements
      if (tool.requiredTier) {
        const tierOrder = ['free', 'starter', 'basic', 'premium', 'pro', 'enterprise'];
        const userTierIndex = tierOrder.indexOf(tier);
        const requiredTierIndex = tierOrder.indexOf(tool.requiredTier);
        
        if (userTierIndex < requiredTierIndex) {
          continue; // User's tier is too low
        }
      }

      available.push(tool);
    }

    return available;
  }

  /**
   * Get tools formatted for Claude API
   * Returns array of Claude tool definitions
   */
  static getClaudeTools(role: string, tier: string): Array<{
    name: string;
    description: string;
    input_schema: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  }> {
    const availableTools = this.getAvailableTools(role, tier);
    return availableTools.map(tool => tool.claudeToolDefinition);
  }

  /**
   * Execute a tool by ID
   */
  static async executeTool(
    toolId: string,
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolId);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolId} not found in registry`
      };
    }

    // Block guest users
    if (context.isGuest) {
      return {
        success: false,
        error: `Guest users cannot execute tools. Please sign in to use ${tool.name}.`
      };
    }

    // Verify role access
    if (!tool.allowedRoles.includes(context.role as any)) {
      return {
        success: false,
        error: `Insufficient permissions. Tool ${toolId} requires role: ${tool.allowedRoles.join(', ')}`
      };
    }

    // Verify tier access
    if (tool.requiredTier) {
      const tierOrder = ['free', 'starter', 'basic', 'premium', 'pro', 'enterprise'];
      const userTierIndex = tierOrder.indexOf(context.tier);
      const requiredTierIndex = tierOrder.indexOf(tool.requiredTier);
      
      if (userTierIndex < requiredTierIndex) {
        return {
          success: false,
          error: `Upgrade required. Tool ${toolId} requires ${tool.requiredTier} tier or higher.`
        };
      }
    }

    // Validate parameters
    const validationError = this.validateParameters(tool, parameters);
    if (validationError) {
      return {
        success: false,
        error: validationError
      };
    }

    // Execute tool
    const startTime = Date.now();
    this.executionCount++;

    try {
      const result = await tool.execute(parameters, context);
      
      if (result.success) {
        this.successCount++;
      }

      // Add execution metadata
      result.metadata = {
        ...result.metadata,
        executionTime: Date.now() - startTime
      };

      console.log(`[ToolRegistry] Executed ${toolId}: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.metadata.executionTime}ms)`);

      return result;
    } catch (error: any) {
      console.error(`[ToolRegistry] Tool execution error for ${toolId}:`, error);
      return {
        success: false,
        error: `Tool execution failed: ${error.message}`,
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Validate tool parameters
   */
  private static validateParameters(tool: Tool, parameters: Record<string, any>): string | null {
    for (const param of tool.parameters) {
      const value = parameters[param.name];

      // Check required parameters
      if (param.required && (value === undefined || value === null)) {
        return `Missing required parameter: ${param.name}`;
      }

      if (value === undefined || value === null) {
        continue; // Optional parameter not provided
      }

      // Type checking
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== param.type) {
        return `Invalid type for ${param.name}: expected ${param.type}, got ${actualType}`;
      }

      // Enum validation
      if (param.enum && !param.enum.includes(value)) {
        return `Invalid value for ${param.name}: must be one of [${param.enum.join(', ')}]`;
      }

      // Validation rules
      if (param.validation) {
        if (param.type === 'number') {
          if (param.validation.min !== undefined && value < param.validation.min) {
            return `${param.name} must be at least ${param.validation.min}`;
          }
          if (param.validation.max !== undefined && value > param.validation.max) {
            return `${param.name} must be at most ${param.validation.max}`;
          }
        }

        if (param.type === 'string') {
          if (param.validation.maxLength && value.length > param.validation.maxLength) {
            return `${param.name} exceeds maximum length of ${param.validation.maxLength}`;
          }
          if (param.validation.pattern) {
            const regex = new RegExp(param.validation.pattern);
            if (!regex.test(value)) {
              return `${param.name} does not match required pattern`;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Get tool by ID
   */
  static getTool(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all registered tools
   */
  static getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  static getToolsByCategory(category: ToolCategory): Tool[] {
    return Array.from(this.tools.values()).filter(tool => tool.category === category);
  }

  /**
   * Get tools by risk level
   */
  static getToolsByRisk(riskLevel: RiskLevel): Tool[] {
    return Array.from(this.tools.values()).filter(tool => tool.riskLevel === riskLevel);
  }

  /**
   * Get registry statistics
   */
  static getStats(): ToolRegistryStats {
    const tools = Array.from(this.tools.values());

    const toolsByCategory = tools.reduce((acc, tool) => {
      acc[tool.category] = (acc[tool.category] || 0) + 1;
      return acc;
    }, {} as Record<ToolCategory, number>);

    const toolsByRisk = tools.reduce((acc, tool) => {
      acc[tool.riskLevel] = (acc[tool.riskLevel] || 0) + 1;
      return acc;
    }, {} as Record<RiskLevel, number>);

    return {
      totalTools: tools.length,
      toolsByCategory,
      toolsByRisk,
      recentExecutions: this.executionCount,
      successRate: this.executionCount > 0 ? this.successCount / this.executionCount : 0
    };
  }

  /**
   * Clear all registered tools (for testing)
   */
  static clear(): void {
    this.tools.clear();
    this.executionCount = 0;
    this.successCount = 0;
  }
}
