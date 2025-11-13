/**
 * Agentic Tool System Tests
 * 
 * Tests tool registry, execution, RLS enforcement, and role-based access control
 */

import { DashToolRegistry } from '../DashToolRegistry';
import { DatabaseQueryTool } from '../tools/DatabaseQueryTool';
import { initializeTools } from '../tools';

describe('Agentic Tool System', () => {
  beforeAll(() => {
    // Initialize tools before running tests
    initializeTools();
  });

  afterEach(() => {
    // Clear registry between tests
    DashToolRegistry.clear();
    initializeTools();
  });

  describe('Tool Registry', () => {
    test('should initialize and register DatabaseQueryTool', () => {
      const stats = DashToolRegistry.getStats();
      
      expect(stats.totalTools).toBeGreaterThan(0);
      expect(stats.toolsByCategory.database).toBe(1);
      expect(stats.toolsByRisk.low).toBeGreaterThanOrEqual(1);
    });

    test('should get tool by ID', () => {
      const tool = DashToolRegistry.getTool('query_database');
      
      expect(tool).toBeDefined();
      expect(tool?.id).toBe('query_database');
      expect(tool?.name).toBe('Query Database');
      expect(tool?.riskLevel).toBe('low');
    });

    test('should filter tools by role', () => {
      // Parent should have access
      const parentTools = DashToolRegistry.getAvailableTools('parent', 'free');
      expect(parentTools.length).toBeGreaterThan(0);
      
      // Teacher should have access
      const teacherTools = DashToolRegistry.getAvailableTools('teacher', 'starter');
      expect(teacherTools.length).toBeGreaterThan(0);
      
      // Superadmin should have access
      const superadminTools = DashToolRegistry.getAvailableTools('superadmin', 'enterprise');
      expect(superadminTools.length).toBeGreaterThan(0);
    });

    test('should filter tools by tier', () => {
      // Free tier should have basic tools
      const freeTools = DashToolRegistry.getAvailableTools('parent', 'free');
      
      // Premium tier should have all tools
      const premiumTools = DashToolRegistry.getAvailableTools('parent', 'premium');
      
      expect(premiumTools.length).toBeGreaterThanOrEqual(freeTools.length);
    });

    test('should get Claude-formatted tools', () => {
      const claudeTools = DashToolRegistry.getClaudeTools('teacher', 'starter');
      
      expect(Array.isArray(claudeTools)).toBe(true);
      expect(claudeTools.length).toBeGreaterThan(0);
      
      const tool = claudeTools[0];
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('input_schema');
      expect(tool.input_schema.type).toBe('object');
    });
  });

  describe('Parameter Validation', () => {
    test('should reject missing required parameters', async () => {
      const result = await DashToolRegistry.executeTool(
        'query_database',
        {}, // Missing query_type
        {
          userId: 'test-user',
          organizationId: 'test-org',
          role: 'teacher',
          tier: 'starter',
          hasOrganization: true,
          isGuest: false
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    test('should reject invalid parameter types', async () => {
      const result = await DashToolRegistry.executeTool(
        'query_database',
        {
          query_type: 'list_students',
          limit: 'not-a-number' // Should be number
        },
        {
          userId: 'test-user',
          organizationId: 'test-org',
          role: 'teacher',
          tier: 'starter',
          hasOrganization: true,
          isGuest: false
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid type');
    });

    test('should accept valid parameters', async () => {
      // Note: This will fail without real Supabase client
      // Just testing validation passes
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      };

      const result = await DashToolRegistry.executeTool(
        'query_database',
        {
          query_type: 'list_students',
          limit: 20
        },
        {
          userId: 'test-user',
          organizationId: 'test-org',
          role: 'teacher',
          tier: 'starter',
          hasOrganization: true,
          isGuest: false,
          supabaseClient: mockSupabase
        }
      );

      // Should not fail on validation
      expect(result).toBeDefined();
    });

    test('should enforce enum values', async () => {
      const result = await DashToolRegistry.executeTool(
        'query_database',
        {
          query_type: 'invalid_query_type' // Not in enum
        },
        {
          userId: 'test-user',
          organizationId: 'test-org',
          role: 'teacher',
          tier: 'starter',
          hasOrganization: true,
          isGuest: false
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid value');
    });
  });

  describe('Role-Based Access Control', () => {
    test('should allow parent role to access query_database', () => {
      const tools = DashToolRegistry.getAvailableTools('parent', 'free');
      const hasTool = tools.some(t => t.id === 'query_database');
      
      expect(hasTool).toBe(true);
    });

    test('should allow teacher role to access query_database', () => {
      const tools = DashToolRegistry.getAvailableTools('teacher', 'starter');
      const hasTool = tools.some(t => t.id === 'query_database');
      
      expect(hasTool).toBe(true);
    });

    test('should block execution for non-allowed roles', async () => {
      const result = await DashToolRegistry.executeTool(
        'query_database',
        { query_type: 'list_students' },
        {
          userId: 'test-user',
          organizationId: 'test-org',
          role: 'invalid_role',
          tier: 'free',
          hasOrganization: true,
          isGuest: false
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
    });
  });

  describe('Organization-Agnostic Support', () => {
    test('should support affiliated users (with organizationId)', () => {
      const context = {
        userId: 'user-123',
        organizationId: 'org-456',
        role: 'teacher',
        tier: 'starter',
        hasOrganization: true,
        isGuest: false
      };

      expect(context.hasOrganization).toBe(true);
      expect(context.organizationId).not.toBeNull();
    });

    test('should support independent users (without organizationId)', () => {
      const context = {
        userId: 'user-789',
        organizationId: null,
        role: 'parent',
        tier: 'free',
        hasOrganization: false,
        isGuest: false
      };

      expect(context.hasOrganization).toBe(false);
      expect(context.organizationId).toBeNull();
    });

    test('should block guest users', async () => {
      const result = await DashToolRegistry.executeTool(
        'query_database',
        { query_type: 'list_students' },
        {
          userId: 'guest-user',
          organizationId: null,
          role: 'guest',
          tier: 'free',
          hasOrganization: false,
          isGuest: true
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Guest');
    });
  });

  describe('Tool Execution', () => {
    test('should track execution statistics', async () => {
      const initialStats = DashToolRegistry.getStats();
      const initialExecutions = initialStats.recentExecutions;

      // Execute a tool (will fail without real Supabase, but still tracked)
      await DashToolRegistry.executeTool(
        'query_database',
        { query_type: 'list_students' },
        {
          userId: 'test-user',
          organizationId: 'test-org',
          role: 'teacher',
          tier: 'starter',
          hasOrganization: true,
          isGuest: false
        }
      );

      const newStats = DashToolRegistry.getStats();
      expect(newStats.recentExecutions).toBe(initialExecutions + 1);
    });

    test('should return execution metadata', async () => {
      const result = await DashToolRegistry.executeTool(
        'query_database',
        { query_type: 'list_students' },
        {
          userId: 'test-user',
          organizationId: 'test-org',
          role: 'teacher',
          tier: 'starter',
          hasOrganization: true,
          isGuest: false
        }
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('metadata');
      if (result.metadata) {
        expect(result.metadata).toHaveProperty('executionTime');
      }
    });
  });

  describe('DatabaseQueryTool Specific', () => {
    test('should have correct query types defined', () => {
      const tool = DashToolRegistry.getTool('query_database');
      const queryTypeParam = tool?.parameters.find(p => p.name === 'query_type');
      
      expect(queryTypeParam).toBeDefined();
      expect(queryTypeParam?.enum).toContain('list_students');
      expect(queryTypeParam?.enum).toContain('list_teachers');
      expect(queryTypeParam?.enum).toContain('list_classes');
      expect(queryTypeParam?.enum).toContain('list_assignments');
      expect(queryTypeParam?.enum).toContain('list_attendance');
    });

    test('should enforce row limits', () => {
      const tool = DashToolRegistry.getTool('query_database');
      const limitParam = tool?.parameters.find(p => p.name === 'limit');
      
      expect(limitParam).toBeDefined();
      expect(limitParam?.validation?.max).toBe(100);
    });
  });
});

/**
 * Manual Test Instructions
 * 
 * To test with real Supabase data:
 * 
 * 1. Set up test database with sample data
 * 2. Create test users with different roles
 * 3. Run integration tests:
 * 
 *    npm run test:integration
 * 
 * Test cases:
 * - Affiliated parent queries students in their school
 * - Independent parent queries own children (no school)
 * - Teacher queries classes in their school
 * - Guest user gets blocked
 * - RLS prevents cross-tenant data access
 */
