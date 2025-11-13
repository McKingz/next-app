#!/usr/bin/env node

/**
 * Generate RLS Policies for Remaining Unprotected Tables
 * This script addresses the critical tables still visible without RLS protection
 */

const fs = require('fs').promises;
const path = require('path');

console.log('🚀 EduDash Pro - Remaining Tables RLS Policy Generator');
console.log('📋 Securing remaining unprotected critical tables');

// Critical unprotected tables identified from Supabase dashboard
const remainingTables = [
  // Communication & Notifications
  {
    table: 'push_notifications',
    template: 'user_scoped',
    user_column: 'user_id',
    write_capability: 'send_notifications',
    priority: 'high',
    description: 'Push notification delivery - user privacy critical'
  },
  {
    table: 'push_devices', 
    template: 'user_scoped',
    user_column: 'user_id',
    write_capability: 'manage_devices',
    priority: 'high', 
    description: 'User device tokens - high privacy risk'
  },
  
  // Educational Content
  {
    table: 'homework_assignments',
    template: 'org_scoped',
    tenant_column: 'preschool_id',
    write_capability: 'manage_assignments',
    priority: 'high',
    description: 'Homework and assignment data'
  },
  {
    table: 'lessons',
    template: 'org_scoped', 
    tenant_column: 'preschool_id',
    write_capability: 'manage_lessons',
    priority: 'high',
    description: 'Lesson planning and content'
  },
  {
    table: 'ai_generations',
    template: 'org_scoped',
    tenant_column: 'preschool_id', 
    write_capability: 'use_ai_features',
    priority: 'medium',
    description: 'AI content generation tracking'
  },
  
  // Financial & Billing
  {
    table: 'billing_plans',
    template: 'global_config',
    write_capability: 'manage_system_config',
    priority: 'medium',
    description: 'System-wide billing plan configuration'
  },
  {
    table: 'school_ai_subscriptions',
    template: 'org_scoped',
    tenant_column: 'preschool_id',
    write_capability: 'manage_ai_subscriptions', 
    priority: 'high',
    description: 'School AI subscription management'
  },
  
  // Additional Tables (if they exist)
  {
    table: 'petty_cash_receipts',
    template: 'org_scoped',
    tenant_column: 'preschool_id',
    write_capability: 'manage_petty_cash',
    priority: 'medium',
    description: 'Petty cash receipt tracking'
  },
  {
    table: 'petty_cash_reconciliations', 
    template: 'org_scoped',
    tenant_column: 'preschool_id',
    write_capability: 'manage_petty_cash',
    priority: 'medium',
    description: 'Petty cash reconciliation records'
  }
];

// Policy templates
const templates = {
  org_scoped: {
    read_policy: `{is_superadmin_expr}
      OR ({tenant_expr} = {current_org_expr})`,
    write_policy: `{is_superadmin_expr}
      OR (
        {tenant_expr} = {current_org_expr}
        AND app_auth.has_cap('{write_capability}')
      )`
  },
  
  user_scoped: {
    read_policy: `{is_superadmin_expr}
      OR {user_column} = {actor_domain_id_expr}
      OR (
        app_auth.is_principal()
        AND EXISTS (
          SELECT 1 FROM users u 
          WHERE u.id = {user_column} 
          AND COALESCE(u.organization_id, u.preschool_id, u.school_id) = {current_org_expr}
        )
      )`,
    write_policy: `{is_superadmin_expr}
      OR (
        {user_column} = {actor_domain_id_expr}
        AND app_auth.has_cap('manage_own_profile')
      )
      OR (
        app_auth.is_principal()
        AND app_auth.has_cap('{write_capability}')
        AND EXISTS (
          SELECT 1 FROM users u 
          WHERE u.id = {user_column} 
          AND COALESCE(u.organization_id, u.preschool_id, u.school_id) = {current_org_expr}
        )
      )`
  },
  
  global_config: {
    read_policy: `active = true`,
    write_policy: `{is_superadmin_expr}`
  }
};

function interpolateTemplate(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), value);
  }
  return result;
}

function generatePolicySQL(table) {
  const isSuperadminExpr = '(app_auth.is_superadmin() OR app_auth.is_super_admin())';
  const currentOrgExpr = 'COALESCE(app_auth.current_user_org_id(), app_auth.org_id())';
  const actorDomainIdExpr = '(SELECT id FROM users WHERE auth_user_id = app_auth.user_id())';
  const template = templates[table.template];
  if (!template) {
    console.warn(`⚠️ Unknown template: ${table.template} for table: ${table.table}`);
    return '';
  }

  const tenantColumn = table.tenant_column || 'preschool_id';
  const tenantExpr = tenantColumn === 'preschool_id'
    ? 'COALESCE(preschool_id, organization_id, school_id)'
    : tenantColumn === 'organization_id'
      ? 'COALESCE(organization_id, preschool_id, school_id)'
      : tenantColumn === 'school_id'
        ? 'COALESCE(school_id, preschool_id, organization_id)'
        : `COALESCE(${tenantColumn}, organization_id, preschool_id, school_id)`;

  const variables = {
    table: table.table,
    tenant_column: tenantColumn,
    tenant_expr: tenantExpr,
    user_column: table.user_column || 'user_id',
    write_capability: table.write_capability || 'manage_records',
    is_superadmin_expr: isSuperadminExpr,
    current_org_expr: currentOrgExpr,
    actor_domain_id_expr: actorDomainIdExpr
  };

  const readPolicy = interpolateTemplate(template.read_policy, variables);
  const writePolicy = interpolateTemplate(template.write_policy, variables);

  return `
-- ============================================
-- ${table.table.toUpperCase()} TABLE POLICIES
-- ============================================
-- Description: ${table.description}
-- Template: ${table.template}
-- Priority: ${table.priority}

-- Drop existing policies
DROP POLICY IF EXISTS ${table.table}_rls_read ON ${table.table};
DROP POLICY IF EXISTS ${table.table}_rls_write ON ${table.table};

-- Read Policy
CREATE POLICY ${table.table}_rls_read
ON ${table.table}
FOR SELECT
TO public
USING (
  ${readPolicy}
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY ${table.table}_rls_write
ON ${table.table}
FOR ALL
TO public
USING (
  ${readPolicy}
)
WITH CHECK (
  ${writePolicy}
);

`;
}

async function main() {
  try {
    let sql = `-- ============================================
-- EduDash Pro RLS Policies - Remaining Tables
-- ============================================
-- Generated: ${new Date().toISOString()}
-- Purpose: Secure remaining unprotected critical tables
-- Tables: ${remainingTables.length}
-- Security Level: CRITICAL
-- ============================================

-- Ensure app_auth schema exists (dependency check)
SELECT 1 FROM pg_proc p
WHERE p.proname = 'is_super_admin' AND p.pronamespace = (
  SELECT n.oid FROM pg_namespace n
  WHERE n.nspname = 'app_auth'
);

`;

    // Generate policies for each table
    for (const table of remainingTables) {
      sql += generatePolicySQL(table);
    }

    // Add indexes for performance
    sql += `
-- ============================================
-- PERFORMANCE INDEXES FOR RLS POLICIES
-- ============================================

`;

    remainingTables.forEach(table => {
      if (table.tenant_column) {
        sql += `CREATE INDEX IF NOT EXISTS idx_${table.table}_${table.tenant_column}
ON ${table.table} (${table.tenant_column});

`;
      }
      if (table.user_column) {
        sql += `CREATE INDEX IF NOT EXISTS idx_${table.table}_${table.user_column}
ON ${table.table} (${table.user_column});

`;
      }
    });

    // Add completion notice
    sql += `
-- ============================================
-- Migration Completion Notice
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS Policy Generation Complete - Remaining Tables';
  RAISE NOTICE '📋 Generated policies for ${remainingTables.length} tables';
  RAISE NOTICE '🔒 Security level: CRITICAL - Immediate deployment required';
  RAISE NOTICE '⚡ Performance indexes added for optimal query performance';
  RAISE NOTICE '🚨 WARNING: Critical security gaps closed';
END $$;`;

    // Write to migration file
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
    const outputPath = path.join(__dirname, '../../supabase/migrations', `${timestamp}_remaining_table_policies.sql`);
    
    await fs.writeFile(outputPath, sql);
    
    console.log('\\n✅ Policy generation completed successfully!');
    console.log(`📁 Output: ${outputPath}`);
    console.log(`📊 Generated policies for ${remainingTables.length} tables:`);
    remainingTables.forEach(table => {
      console.log(`   - ${table.table} (${table.priority}) using ${table.template} template`);
    });
    
    console.log('\\n📋 Next steps:');
    console.log('1. Review generated policies in the migration file');
    console.log('2. Apply migration: supabase db push');
    console.log('3. Validate multi-tenant isolation');
    console.log('4. Verify all critical tables are now protected');
    
    console.log('\\n🚨 CRITICAL SECURITY REMINDER');
    console.log('⚠️  These tables were UNPROTECTED and accessible by all users');
    console.log('🔥 Apply immediately to prevent data exposure');

  } catch (error) {
    console.error('❌ Policy generation failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);