// TypeScript types and utilities for RBAC system
// Generated from roles-permissions.json

// Note: JSON data will be loaded dynamically to avoid import issues
// import rolesPermissionsData from './roles-permissions.json';

/**
 * Role identifiers - these match the database enum values
 */
export type RoleId = 'admin' | 'instructor' | 'student';

/**
 * Permission identifiers - these match the permission IDs in the matrix
 */
export type PermissionId = 
  // User Management
  | 'manage_users'
  
  // Course Management
  | 'manage_courses'
  | 'manage_enrollments'
  | 'manage_assignments'
  | 'view_courses'
  
  // Course Access
  | 'enroll_in_courses'
  
  // Assignments
  | 'submit_assignments'
  | 'grade_assignments'
  | 'view_submissions'
  | 'view_own_submissions'
  | 'view_own_grades'
  
  // Course Tools
  | 'create_join_codes'
  | 'view_course_roster'
  
  // Communication
  | 'communicate_with_students'
  | 'communicate_with_instructors'
  
  // Analytics
  | 'view_student_progress'
  | 'view_own_progress'
  
  // Administration
  | 'manage_organizations'
  | 'manage_billing'
  | 'manage_subscriptions'
  | 'view_system_logs'
  | 'manage_roles'
  | 'view_audit_logs'
  
  // AI Features
  | 'manage_ai_quotas'
  | 'manage_ai_tiers'
  | 'use_ai_lesson_tools'
  | 'use_ai_grading_tools'
  | 'use_ai_homework_helper'
  
  // Dashboard Access
  | 'access_admin_dashboard'
  | 'access_instructor_dashboard'
  | 'access_student_dashboard';

/**
 * Permission categories
 */
export type PermissionCategoryType = 
  | 'user_management'
  | 'course_management'
  | 'course_access'
  | 'assignments'
  | 'communication'
  | 'analytics'
  | 'admin'
  | 'ai'
  | 'ui';

/**
 * Access scopes
 */
export type AccessScope = 'global' | 'organization' | 'self';

/**
 * CRUD actions
 */
export type Action = 'create' | 'read' | 'update' | 'delete';

/**
 * Role definition interface
 */
export interface Role {
  id: RoleId;
  name: string;
  level: number;
  description: string;
  scope: AccessScope;
  inheritsFrom: RoleId[];
  mapToExisting: string[];
  permissions: PermissionId[];
}

/**
 * Permission definition interface
 */
export interface Permission {
  id: PermissionId;
  name: string;
  category: PermissionCategoryType;
  description: string;
  resources: string[];
  actions: Action[];
  scope?: AccessScope;
}

/**
 * Permission category definition
 */
export interface PermissionCategory {
  name: string;
  description: string;
}

/**
 * Complete roles and permissions data structure
 */
export interface RolesPermissionsMatrix {
  metadata: {
    version: string;
    lastUpdated: string;
    description: string;
    compatibleWith: string;
  };
  roles: Record<RoleId, Role>;
  permissions: Record<PermissionId, Permission>;
  categories: Record<string, PermissionCategory>;
  hierarchyRules: {
    description: string;
    rules: Array<{
      rule: string;
      description: string;
      implementation: string;
    }>;
  };
}

/**
 * Load roles and permissions data dynamically
 */
function loadRolesPermissionsData(): RolesPermissionsMatrix {
  try {
    // In Node.js/build environment, load from file system
    if (typeof require !== 'undefined') {
      return require('./roles-permissions.json') as RolesPermissionsMatrix;
    }
    
    // Fallback with inline data (for browser/bundler compatibility)
    throw new Error('Dynamic loading not available');
  } catch (error) {
    // If loading fails, throw error - we need the actual data
    throw new Error(`Could not load roles-permissions.json: ${error}. Please ensure the file exists and is valid.`);
  }
}

/**
 * Typed access to the roles and permissions data
 */
export const RolesPermissions: RolesPermissionsMatrix = loadRolesPermissionsData();

/**
 * Get all permissions for a specific role
 */
export function getRolePermissions(roleId: RoleId): PermissionId[] {
  const role = RolesPermissions.roles[roleId];
  if (!role) {
    throw new Error(`Role '${roleId}' not found`);
  }
  return role.permissions;
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(roleId: RoleId, permissionId: PermissionId): boolean {
  const rolePermissions = getRolePermissions(roleId);
  return rolePermissions.includes(permissionId);
}

/**
 * Get all roles that have a specific permission
 */
export function getRolesWithPermission(permissionId: PermissionId): RoleId[] {
  return Object.entries(RolesPermissions.roles)
    .filter(([_, role]) => role.permissions.includes(permissionId))
    .map(([roleId]) => roleId as RoleId);
}

/**
 * Get permission details by ID
 */
export function getPermission(permissionId: PermissionId): Permission {
  const permission = RolesPermissions.permissions[permissionId];
  if (!permission) {
    throw new Error(`Permission '${permissionId}' not found`);
  }
  return permission;
}

/**
 * Get role details by ID
 */
export function getRole(roleId: RoleId): Role {
  const role = RolesPermissions.roles[roleId];
  if (!role) {
    throw new Error(`Role '${roleId}' not found`);
  }
  return role;
}

/**
 * Get all permissions in a specific category
 */
export function getPermissionsByCategory(category: PermissionCategoryType): Permission[] {
  return Object.values(RolesPermissions.permissions)
    .filter(permission => permission.category === category);
}

/**
 * Get role hierarchy (sorted by level, highest first)
 */
export function getRoleHierarchy(): Role[] {
  return Object.values(RolesPermissions.roles)
    .sort((a, b) => b.level - a.level);
}

/**
 * Check if roleA has higher or equal level than roleB
 */
export function roleHasHigherOrEqualLevel(roleA: RoleId, roleB: RoleId): boolean {
  const roleAData = getRole(roleA);
  const roleBData = getRole(roleB);
  return roleAData.level >= roleBData.level;
}

/**
 * Get all available role IDs
 */
export function getAllRoles(): RoleId[] {
  return Object.keys(RolesPermissions.roles) as RoleId[];
}

/**
 * Get all available permission IDs
 */
export function getAllPermissions(): PermissionId[] {
  return Object.keys(RolesPermissions.permissions) as PermissionId[];
}

/**
 * Validate that a role ID is valid
 */
export function isValidRole(roleId: string): roleId is RoleId {
  return roleId in RolesPermissions.roles;
}

/**
 * Validate that a permission ID is valid
 */
export function isValidPermission(permissionId: string): permissionId is PermissionId {
  return permissionId in RolesPermissions.permissions;
}

/**
 * Get permissions summary for debugging/logging
 */
export function getPermissionsSummary(): Record<RoleId, number> {
  const summary: Record<string, number> = {};
  
  Object.entries(RolesPermissions.roles).forEach(([roleId, role]) => {
    summary[roleId] = role.permissions.length;
  });
  
  return summary as Record<RoleId, number>;
}

/**
 * Constants for easy access
 */
export const ROLES = {
  ADMIN: 'admin' as const,
  INSTRUCTOR: 'instructor' as const,
  STUDENT: 'student' as const,
} satisfies Record<string, RoleId>;

export const PERMISSIONS = {
  // User Management
  MANAGE_USERS: 'manage_users' as const,
  
  // Course Management  
  MANAGE_COURSES: 'manage_courses' as const,
  MANAGE_ENROLLMENTS: 'manage_enrollments' as const,
  MANAGE_ASSIGNMENTS: 'manage_assignments' as const,
  VIEW_COURSES: 'view_courses' as const,
  
  // Assignments
  SUBMIT_ASSIGNMENTS: 'submit_assignments' as const,
  GRADE_ASSIGNMENTS: 'grade_assignments' as const,
  VIEW_SUBMISSIONS: 'view_submissions' as const,
  
  // AI Features
  USE_AI_LESSON_TOOLS: 'use_ai_lesson_tools' as const,
  USE_AI_HOMEWORK_HELPER: 'use_ai_homework_helper' as const,
  
  // Dashboard Access
  ACCESS_ADMIN_DASHBOARD: 'access_admin_dashboard' as const,
  ACCESS_INSTRUCTOR_DASHBOARD: 'access_instructor_dashboard' as const,
  ACCESS_STUDENT_DASHBOARD: 'access_student_dashboard' as const,
} satisfies Record<string, PermissionId>;