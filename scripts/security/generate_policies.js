#!/usr/bin/env node

/**
 * RLS Policy Generator for EduDash Pro
 * Generates comprehensive RLS policies from policy_manifest.yaml
 * Usage: node scripts/security/generate_policies.js [--phase=critical|financial|all]
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

// Parse command line arguments
const args = process.argv.slice(2);
const phaseArg = args.find(arg => arg.startsWith('--phase='));
const manifestArg = args.find(arg => arg.startsWith('--manifest='));
const requestedPhase = phaseArg ? phaseArg.split('=')[1] : 'critical';
const manifestFile = manifestArg ? manifestArg.split('=')[1] : 'policy_manifest.yaml';

console.log('🚀 EduDash Pro RLS Policy Generator');
console.log(`📋 Target phase: ${requestedPhase}`);

async function loadManifest() {
    try {
        const manifestPath = path.join(__dirname, '../../', manifestFile);
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        return yaml.load(manifestContent);
    } catch (error) {
        console.error('❌ Failed to load policy manifest:', error.message);
        process.exit(1);
    }
}

function interpolateTemplate(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }
    return result;
}

function generatePolicySQL(table, template, manifest) {
  // Build comprehensive variable set for enhanced templates
  const variables = {
    table: table.table,
    schema: table.schema || manifest.defaults.schema || 'public',
    policy_roles: table.policy_roles || manifest.defaults.policy_roles || 'authenticated',
    tenant_column: table.tenant_column || manifest.defaults.tenant_column || 'organization_id',
    user_column: table.user_column || manifest.defaults.user_column || 'user_id',
    parent_column: table.parent_column || 'parent_id',
    child_column: table.child_column || 'child_id',
    class_column: table.class_column || 'class_id',
    subscription_column: table.subscription_column || 'subscription_id',
    write_capability: table.write_capability || manifest.defaults.default_write_capability
  };

  // Compute robust fallback expressions to handle schema inconsistencies
  const tenantExpr = (() => {
    const t = variables.tenant_column;
    if (t === 'preschool_id') return 'COALESCE(preschool_id, organization_id, school_id)';
    if (t === 'organization_id') return 'COALESCE(organization_id, preschool_id, school_id)';
    if (t === 'school_id') return 'COALESCE(school_id, preschool_id, organization_id)';
    // Unknown custom tenant column: still add fallback to common keys
    return `COALESCE(${t}, organization_id, preschool_id, school_id)`;
  })();

  // Identity and role helper fallbacks
  const isSuperadminExpr = '(app_auth.is_superadmin() OR app_auth.is_super_admin())';
  const currentOrgExpr = 'COALESCE(app_auth.current_user_org_id(), app_auth.org_id())';
  const actorDomainIdExpr = '(SELECT id FROM users WHERE auth_user_id = app_auth.user_id())';
  const currentUserExpr = 'COALESCE(app_auth.current_user_id(), (SELECT id FROM users WHERE auth_user_id = app_auth.user_id()))';

  // Interpolate template and then normalize helper calls and tenant column usage
  let readPolicy = interpolateTemplate(template.read_policy, {
    ...variables,
    tenant_expr: tenantExpr,
    is_superadmin_expr: isSuperadminExpr,
    current_org_expr: currentOrgExpr,
    actor_domain_id_expr: actorDomainIdExpr,
    current_user_expr: currentUserExpr,
  });

  let writePolicy = interpolateTemplate(template.write_policy, {
    ...variables,
    tenant_expr: tenantExpr,
    is_superadmin_expr: isSuperadminExpr,
    current_org_expr: currentOrgExpr,
    actor_domain_id_expr: actorDomainIdExpr,
    current_user_expr: currentUserExpr,
  });

  // Backward-compatibility replacements for manifests that hardcode helper names
  const normalize = (s) => s
    .replace(/app_auth\.org_id\(\)/g, currentOrgExpr)
    .replace(/app_auth\.current_user_org_id\(\)/g, currentOrgExpr)
    .replace(/app_auth\.is_super_admin\(\)/g, isSuperadminExpr)
    .replace(/app_auth\.is_superadmin\(\)/g, isSuperadminExpr)
    .replace(/app_auth\.profile_id\(\)/g, actorDomainIdExpr)
    .replace(/\{tenant_column\}/g, tenantExpr);

  readPolicy = normalize(readPolicy);
  writePolicy = normalize(writePolicy);

  // Handle custom read policy if specified
  const finalReadPolicy = normalize(table.custom_read_policy || readPolicy);

  const sql = `
-- ============================================
-- ${table.table.toUpperCase()} TABLE POLICIES
-- ============================================
-- Description: ${table.description}
-- Template: ${table.template}
-- Priority: ${table.priority}
-- Complexity: ${template.complexity}

-- Drop existing policies
DROP POLICY IF EXISTS ${table.table}_rls_read
ON ${table.table};
DROP POLICY IF EXISTS ${table.table}_rls_write
ON ${table.table};

-- Read Policy
CREATE POLICY ${table.table}_rls_read
ON ${table.table}
FOR SELECT
TO public
USING (
  ${finalReadPolicy.trim()}
);

-- Write Policy (INSERT, UPDATE, DELETE)
CREATE POLICY ${table.table}_rls_write
ON ${table.table}
FOR ALL
TO public
USING (
  ${finalReadPolicy.trim()}
)
WITH CHECK (
  ${writePolicy.trim()}
);`;

    return sql;
}

function generateIndexSQL(tables, manifest) {
  // helper to determine if a value looks like a SQL expression rather than a column
  const isExpression = (val) => typeof val === 'string' && /\(|\)/.test(val);
    const indexes = new Set();

    // Add table-specific indexes (no CONCURRENTLY; safe in migrations)
    tables.forEach(table => {
    if (table.tenant_column && !isExpression(table.tenant_column)) {
            indexes.add(`CREATE INDEX IF NOT EXISTS idx_${table.table}_${table.tenant_column}\nON ${table.table}(${table.tenant_column});`);
        }

        // Add composite indexes for complex templates
        if (table.template === 'users_selective') {
            // Helpful for filtering users by org and role
            indexes.add(`CREATE INDEX IF NOT EXISTS idx_users_org_role\nON users(organization_id, role);`);
        }
    });

    if (indexes.size === 0) return '';

    return `
-- ============================================
-- PERFORMANCE INDEXES FOR RLS POLICIES
-- ============================================
-- Purpose: Optimize RLS policy performance
-- Target: <${manifest.validation.performance_targets.max_policy_overhead_ms}ms overhead per query

${Array.from(indexes).join('\n\n')}

-- Analyze tables after index creation
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[${tables.map(table => `'${table.table}'`).join(', ')}])
    LOOP
        EXECUTE format('ANALYZE %I', t);
    END LOOP;
    RAISE NOTICE '📊 Analyzed tables for query planner optimization';
END $$;`;
}

async function generatePolicies(manifest, phase) {
    let tablesToProcess = [];
    
    // Use phase-based table selection if available in implementation_phases
    if (manifest.implementation_phases && manifest.implementation_phases[phase]) {
        const phaseConfig = manifest.implementation_phases[phase];
        const phaseTableNames = phaseConfig.tables || [];
        
        tablesToProcess = manifest.tables.filter(table => 
            phaseTableNames.includes(table.table) && table.status !== 'implemented'
        );
        
        console.log(`📋 Using phase-based selection from implementation_phases.${phase}`);
    } else {
        // Fallback to priority-based filtering for legacy manifests
        switch (phase) {
            case 'critical':
                tablesToProcess = manifest.tables.filter(table => 
                    table.priority === 'critical' && table.status !== 'implemented'
                );
                break;
            case 'financial':
                tablesToProcess = manifest.tables.filter(table => 
                    table.priority === 'high' && table.status !== 'implemented'
                );
                break;
            case 'communication':
                tablesToProcess = manifest.tables.filter(table => 
                    table.priority === 'medium' && table.status !== 'implemented'
                );
                break;
            case 'all':
                tablesToProcess = manifest.tables.filter(table => table.status !== 'implemented');
                break;
            default:
                console.error(`❌ Unknown phase: ${phase}`);
                process.exit(1);
        }
    }

    if (tablesToProcess.length === 0) {
        console.log(`⚠️  No tables to process for phase: ${phase}`);
        return null;
    }

    console.log(`📋 Processing ${tablesToProcess.length} tables for phase: ${phase}`);
    tablesToProcess.forEach(table => {
        console.log(`  - ${table.table} (${table.priority}) - ${table.template}`);
    });

    let sql = `-- ============================================
-- EduDash Pro RLS Policies - Phase ${phase.toUpperCase()}
-- ============================================
-- Generated: ${new Date().toISOString()}
-- Phase: ${phase}
-- Tables: ${tablesToProcess.length}
-- Security Level: ${phase === 'critical' ? 'CRITICAL' : 'HIGH'}
-- ============================================

-- Ensure app_auth schema exists (dependency check)
SELECT 1
FROM pg_proc AS p
WHERE
    p.proname = 'is_super_admin'
    AND p.pronamespace = (
        SELECT n.oid
        FROM pg_namespace AS n
        WHERE n.nspname = 'app_auth'
    );

`;

    // Generate policies for each table
    for (const table of tablesToProcess) {
        const template = manifest.templates[table.template];
        if (!template) {
            console.error(`❌ Unknown template: ${table.template} for table: ${table.table}`);
            continue;
        }

        sql += generatePolicySQL(table, template, manifest);
        sql += '\n\n';
    }

    // Add performance indexes
    sql += generateIndexSQL(tablesToProcess, manifest);

    // Add completion notice
    sql += `

-- ============================================
-- Migration Completion Notice
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS Policy Generation Complete - Phase ${phase.toUpperCase()}';
  RAISE NOTICE '📋 Generated policies for ${tablesToProcess.length} tables';
  RAISE NOTICE '🔒 Security level: ${phase === 'critical' ? 'CRITICAL - Immediate deployment required' : 'HIGH PRIORITY'}';
  RAISE NOTICE '⚡ Performance indexes added for optimal query performance';
  ${phase === 'critical' ? "RAISE NOTICE '🚨 WARNING: Critical security vulnerabilities addressed';" : ''}
END $$;`;

    return { sql, tableCount: tablesToProcess.length, tables: tablesToProcess };
}

async function main() {
    try {
        const manifest = await loadManifest();
        console.log(`📖 Loaded manifest: ${manifest.metadata.description}`);
        console.log(`📅 Version: ${manifest.metadata.version} (${manifest.metadata.created_date})`);

        const result = await generatePolicies(manifest, requestedPhase);
        
        if (!result) {
            process.exit(0);
        }

        // Determine output filename based on phase
        const phaseMapping = {
            critical: '003_critical_policies',
            financial: '004_financial_policies', 
            communication: '005_communication_policies',
            all: '003_comprehensive_policies'
        };

        const filename = `${phaseMapping[requestedPhase] || '003_generated_policies'}.sql`;
        const outputPath = path.join(__dirname, '../../supabase/migrations', 
            `20250919140000_${filename}`);

        await fs.writeFile(outputPath, result.sql);
        
        console.log('\n✅ Policy generation completed successfully!');
        console.log(`📁 Output: ${outputPath}`);
        console.log(`📊 Generated policies for ${result.tableCount} tables:`);
        result.tables.forEach(table => {
            console.log(`   - ${table.table} (${table.priority}) using ${table.template} template`);
        });
        
        console.log('\n📋 Next steps:');
        console.log('1. Review generated policies in the migration file');
        console.log('2. Test policies in a development environment');
        console.log('3. Apply migration: supabase db push');
        console.log('4. Validate multi-tenant isolation');
        
        if (requestedPhase === 'critical') {
            console.log('\n🚨 CRITICAL PHASE COMPLETE');
            console.log('⚠️  These policies address the highest security risks');
            console.log('🔥 Apply immediately to prevent data exposure');
        }

    } catch (error) {
        console.error('❌ Policy generation failed:', error);
        process.exit(1);
    }
}

// Check for required dependencies
async function checkDependencies() {
    try {
        require('js-yaml');
    } catch (error) {
        console.error('❌ Missing dependency: js-yaml');
        console.error('Install with: npm install js-yaml');
        process.exit(1);
    }
}

checkDependencies().then(() => main()).catch(console.error);