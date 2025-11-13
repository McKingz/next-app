#!/usr/bin/env tsx
/**
 * RBAC Matrix Export Tool
 * 
 * Extracts role-capability mappings from /lib/rbac.ts and exports to JSON
 * for downstream analysis and policy generation.
 */

import * as fs from 'fs';
import * as path from 'path';

// Import RBAC definitions (adjust path as needed)
import { 
  ROLES, 
  CAPABILITIES, 
  Role,
  Capability,
  PlanTier,
  getUserCapabilities,
  normalizeRole 
} from '../../lib/rbac';

interface RBACMatrix {
  metadata: {
    generated_at: string;
    total_roles: number;
    total_capabilities: number;
    total_plan_tiers: number;
  };
  roles: {
    [key: string]: {
      level: number;
      name: string;
      display: string;
      capabilities: string[];
    };
  };
  capabilities: {
    [key: string]: string;
  };
  role_capability_matrix: {
    [role: string]: {
      [capability: string]: boolean;
    };
  };
  plan_tier_enhancements: {
    [tier: string]: string[];
  };
  access_patterns: {
    hierarchical_roles: string[];
    cross_org_roles: string[];
    org_scoped_roles: string[];
    class_scoped_roles: string[];
    student_scoped_roles: string[];
  };
}

async function generateRBACMatrix(): Promise<RBACMatrix> {
  console.log('🔍 Analyzing RBAC system...');

  // Extract role definitions
  const roles = Object.entries(ROLES).reduce((acc, [key, value]) => {
    acc[key] = {
      level: value.level,
      name: value.name,
      display: value.display,
      capabilities: [] // Will be populated below
    };
    return acc;
  }, {} as RBACMatrix['roles']);

  // Extract capability definitions
  const capabilities = Object.entries(CAPABILITIES).reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {} as RBACMatrix['capabilities']);

  // Generate role-capability matrix
  const role_capability_matrix: RBACMatrix['role_capability_matrix'] = {};
  
  for (const [roleName] of Object.entries(ROLES)) {
    const role = roleName as Role;
    
    // Get capabilities for this role (using default plan tier and active seat)
    const userCapabilities = await getUserCapabilities(role, 'premium', 'active');
    
    // Update role capabilities list
    roles[roleName].capabilities = userCapabilities;
    
    // Build matrix
    role_capability_matrix[roleName] = {};
    
    Object.keys(CAPABILITIES).forEach(capability => {
      role_capability_matrix[roleName][capability] = userCapabilities.includes(capability as Capability);
    });
  }

  // Plan tier enhancements (manually extracted from rbac.ts)
  const plan_tier_enhancements = {
    'free': ['ai_homework_helper', 'view_engagement_metrics'],
    'starter': ['ai_homework_helper', 'ai_lesson_generation', 'view_engagement_metrics', 'whatsapp_voice_messages', 'ai_insights'],
    'premium': ['ai_homework_helper', 'ai_lesson_generation', 'ai_grading_assistance', 'ai_stem_activities', 'ai_progress_analysis', 'advanced_analytics', 'view_engagement_metrics', 'whatsapp_voice_messages', 'ai_insights', 'use_whatsapp'],
    'enterprise': ['ai_homework_helper', 'ai_lesson_generation', 'ai_grading_assistance', 'ai_stem_activities', 'ai_progress_analysis', 'advanced_analytics', 'bulk_operations', 'custom_reports', 'sso_access', 'priority_support', 'view_engagement_metrics', 'whatsapp_voice_messages', 'ai_insights', 'ai_quota_management', 'use_whatsapp']
  };

  // Access pattern categorization
  const access_patterns = {
    hierarchical_roles: ['super_admin', 'principal', 'principal_admin', 'teacher', 'parent'],
    cross_org_roles: ['super_admin'],
    org_scoped_roles: ['principal', 'principal_admin'],
    class_scoped_roles: ['teacher'],
    student_scoped_roles: ['parent']
  };

  const matrix: RBACMatrix = {
    metadata: {
      generated_at: new Date().toISOString(),
      total_roles: Object.keys(ROLES).length,
      total_capabilities: Object.keys(CAPABILITIES).length,
      total_plan_tiers: Object.keys(plan_tier_enhancements).length
    },
    roles,
    capabilities,
    role_capability_matrix,
    plan_tier_enhancements,
    access_patterns
  };

  return matrix;
}

async function main() {
  try {
    console.log('📊 Generating RBAC Matrix Export...');
    
    // Ensure output directory exists
    const outputDir = path.join(__dirname, '../../artifacts/security');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate matrix
    const matrix = await generateRBACMatrix();
    
    // Write JSON output
    const outputPath = path.join(outputDir, 'rbac_matrix.json');
    fs.writeFileSync(outputPath, JSON.stringify(matrix, null, 2), 'utf-8');
    
    console.log('✅ RBAC matrix exported successfully!');
    console.log(`📁 Output: ${outputPath}`);
    console.log('\n📋 Matrix Summary:');
    console.log(`   Roles: ${matrix.metadata.total_roles}`);
    console.log(`   Capabilities: ${matrix.metadata.total_capabilities}`);
    console.log(`   Plan Tiers: ${matrix.metadata.total_plan_tiers}`);
    
    // Generate capability summary by role
    console.log('\n🔑 Capabilities by Role:');
    Object.entries(matrix.roles).forEach(([role, data]) => {
      console.log(`   ${data.display} (${role}): ${data.capabilities.length} capabilities`);
    });
    
    // Cross-role capability analysis
    console.log('\n🔍 Capability Distribution:');
    const capabilityRoles: { [cap: string]: string[] } = {};
    
    Object.entries(matrix.role_capability_matrix).forEach(([role, caps]) => {
      Object.entries(caps).forEach(([cap, hasIt]) => {
        if (hasIt) {
          if (!capabilityRoles[cap]) capabilityRoles[cap] = [];
          capabilityRoles[cap].push(role);
        }
      });
    });
    
    const uniqueCaps = Object.keys(capabilityRoles).filter(cap => capabilityRoles[cap].length === 1);
    const sharedCaps = Object.keys(capabilityRoles).filter(cap => capabilityRoles[cap].length > 1);
    
    console.log(`   Unique capabilities: ${uniqueCaps.length}`);
    console.log(`   Shared capabilities: ${sharedCaps.length}`);
    console.log(`   Super admin exclusive: ${uniqueCaps.filter(cap => capabilityRoles[cap].includes('super_admin')).length}`);

  } catch (error) {
    console.error('❌ Failed to generate RBAC matrix:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { generateRBACMatrix, RBACMatrix };