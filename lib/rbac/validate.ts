#!/usr/bin/env npx tsx

// RBAC Validation Script
// Validates the roles-permissions.json file for consistency and completeness

import { 
  RolesPermissions, 
  getAllRoles, 
  getAllPermissions,
  getRolePermissions,
  roleHasPermission,
  getPermissionsSummary,
  ROLES,
  PERMISSIONS
} from './types';

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

class RBACValidator {
  private results: ValidationResult[] = [];

  validate(): boolean {
    console.log('🔍 Validating RBAC System...\n');

    this.validateMetadata();
    this.validateRoles();
    this.validatePermissions();
    this.validateHierarchy();
    this.validateConsistency();
    
    this.printResults();
    return this.results.every(r => r.passed);
  }

  private validateMetadata() {
    const meta = RolesPermissions.metadata;
    
    this.check(
      !!meta.version,
      'Metadata has version',
      { version: meta.version }
    );
    
    this.check(
      !!meta.description,
      'Metadata has description',
      { description: meta.description }
    );
    
    this.check(
      meta.lastUpdated === '2025-09-21',
      'Metadata has current date',
      { lastUpdated: meta.lastUpdated }
    );
  }

  private validateRoles() {
    const roles = getAllRoles();
    
    this.check(
      roles.length === 3,
      'Has exactly 3 roles (admin, instructor, student)',
      { roles, count: roles.length }
    );
    
    this.check(
      roles.includes('admin'),
      'Has admin role',
      { roles }
    );
    
    this.check(
      roles.includes('instructor'),
      'Has instructor role', 
      { roles }
    );
    
    this.check(
      roles.includes('student'),
      'Has student role',
      { roles }
    );

    // Validate role hierarchy levels
    const adminRole = RolesPermissions.roles.admin;
    const instructorRole = RolesPermissions.roles.instructor;
    const studentRole = RolesPermissions.roles.student;

    this.check(
      adminRole.level === 4,
      'Admin role has level 4',
      { level: adminRole.level }
    );

    this.check(
      instructorRole.level === 2,
      'Instructor role has level 2', 
      { level: instructorRole.level }
    );

    this.check(
      studentRole.level === 1,
      'Student role has level 1',
      { level: studentRole.level }
    );

    // Validate scopes
    this.check(
      adminRole.scope === 'global',
      'Admin has global scope',
      { scope: adminRole.scope }
    );

    this.check(
      instructorRole.scope === 'organization',
      'Instructor has organization scope',
      { scope: instructorRole.scope }
    );

    this.check(
      studentRole.scope === 'self',
      'Student has self scope',
      { scope: studentRole.scope }
    );
  }

  private validatePermissions() {
    const permissions = getAllPermissions();
    const summary = getPermissionsSummary();
    
    this.check(
      permissions.length > 20,
      'Has sufficient permissions defined',
      { count: permissions.length }
    );
    
    // Core permissions exist
    const corePermissions = [
      'manage_users',
      'manage_courses', 
      'view_courses',
      'submit_assignments',
      'grade_assignments'
    ];
    
    corePermissions.forEach(permission => {
      this.check(
        permissions.includes(permission as any),
        `Has core permission: ${permission}`,
        { permission }
      );
    });

    // Check permission distribution
    this.check(
      summary.admin > summary.instructor,
      'Admin has more permissions than Instructor',
      { admin: summary.admin, instructor: summary.instructor }
    );

    this.check(
      summary.instructor > summary.student,
      'Instructor has more permissions than Student',
      { instructor: summary.instructor, student: summary.student }
    );
  }

  private validateHierarchy() {
    // Admin should have manage_users (admin-only)
    this.check(
      roleHasPermission('admin', 'manage_users'),
      'Admin has manage_users permission'
    );

    this.check(
      !roleHasPermission('instructor', 'manage_users'),
      'Instructor does NOT have manage_users permission'
    );

    this.check(
      !roleHasPermission('student', 'manage_users'),
      'Student does NOT have manage_users permission'
    );

    // Both Admin and Instructor should have manage_courses
    this.check(
      roleHasPermission('admin', 'manage_courses'),
      'Admin has manage_courses permission'
    );

    this.check(
      roleHasPermission('instructor', 'manage_courses'),
      'Instructor has manage_courses permission'
    );

    this.check(
      !roleHasPermission('student', 'manage_courses'),
      'Student does NOT have manage_courses permission'
    );

    // All roles should have view_courses
    this.check(
      roleHasPermission('admin', 'view_courses'),
      'Admin has view_courses permission'
    );

    this.check(
      roleHasPermission('instructor', 'view_courses'),
      'Instructor has view_courses permission'
    );

    this.check(
      roleHasPermission('student', 'view_courses'),
      'Student has view_courses permission'
    );

    // Only students should have submit_assignments
    this.check(
      !roleHasPermission('admin', 'submit_assignments'),
      'Admin does NOT have submit_assignments permission'
    );

    this.check(
      !roleHasPermission('instructor', 'submit_assignments'),
      'Instructor does NOT have submit_assignments permission'
    );

    this.check(
      roleHasPermission('student', 'submit_assignments'),
      'Student has submit_assignments permission'
    );
  }

  private validateConsistency() {
    // Check that all role permissions exist in permissions list
    const allPermissions = getAllPermissions();
    
    getAllRoles().forEach(roleId => {
      const rolePermissions = getRolePermissions(roleId);
      
      rolePermissions.forEach(permission => {
        this.check(
          allPermissions.includes(permission),
          `Role ${roleId} permission ${permission} exists in permissions list`,
          { roleId, permission }
        );
      });
    });

    // Check for duplicate permissions in roles
    getAllRoles().forEach(roleId => {
      const rolePermissions = getRolePermissions(roleId);
      const uniquePermissions = [...new Set(rolePermissions)];
      
      this.check(
        rolePermissions.length === uniquePermissions.length,
        `Role ${roleId} has no duplicate permissions`,
        { roleId, duplicates: rolePermissions.length - uniquePermissions.length }
      );
    });
  }

  private check(condition: boolean, message: string, details?: any) {
    const result: ValidationResult = {
      passed: condition,
      message,
      details
    };
    
    this.results.push(result);
  }

  private printResults() {
    console.log('\n📋 Validation Results:\n');
    
    let passed = 0;
    let failed = 0;
    
    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.message}`);
      
      if (!result.passed && result.details) {
        console.log(`   Details:`, result.details);
      }
      
      if (result.passed) passed++;
      else failed++;
    });
    
    console.log(`\n📊 Summary: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('🎉 All validations passed! RBAC system is ready.\n');
    } else {
      console.log('⚠️  Some validations failed. Please fix before proceeding.\n');
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new RBACValidator();
  const success = validator.validate();
  process.exit(success ? 0 : 1);
}

export default RBACValidator;