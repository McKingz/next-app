#!/usr/bin/env node
/**
 * Database Schema Extraction Tool
 * 
 * Extracts database schema information for RLS analysis
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Need: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function extractDatabaseInfo() {
  console.log('🔍 Extracting database information...');
  
  try {
    // Get basic database info
    const { data: dbInfo, error: dbError } = await supabase
      .from('information_schema.tables')
      .select('*')
      .eq('table_schema', 'public')
      .limit(1);

    if (dbError) {
      console.log('❌ Cannot access information_schema directly');
      console.log('Using alternative approach...');
    }

    // Try to get tables through a different method
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .order('table_name');

    if (tablesError) {
      console.log('⚠️  Cannot query information_schema.tables:', tablesError.message);
    } else {
      console.log(`✅ Found ${tables.length} public tables`);
      
      // Write tables info
      const outputDir = path.join(__dirname, '../../artifacts/security');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(outputDir, 'tables.csv'), 
        'table_name,table_type\n' + 
        tables.map(t => `${t.table_name},${t.table_type}`).join('\n')
      );
      
      console.log('📁 Tables exported to artifacts/security/tables.csv');
    }

    // Get columns information for key tables
    const keyTables = [
      'profiles', 'users', 'preschools', 'classes', 'students', 
      'subscriptions', 'assignments', 'homework_assignments',
      'parent_child_links', 'push_devices', 'ai_usage_logs'
    ];

    console.log('\n🔍 Analyzing key tables...');
    const tableDetails = {};

    for (const tableName of keyTables) {
      try {
        const { data: columns, error: colError } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .order('ordinal_position');

        if (colError) {
          console.log(`⚠️  Cannot get columns for ${tableName}:`, colError.message);
          continue;
        }

        if (columns.length > 0) {
          tableDetails[tableName] = columns;
          console.log(`✅ ${tableName}: ${columns.length} columns`);
          
          // Check for tenant isolation columns
          const tenantCols = columns.filter(c => 
            ['organization_id', 'preschool_id', 'school_id', 'tenant_id'].includes(c.column_name)
          );
          
          if (tenantCols.length > 0) {
            console.log(`   🏢 Tenant columns: ${tenantCols.map(c => c.column_name).join(', ')}`);
          }

          // Check for relationship columns
          const relationCols = columns.filter(c => 
            c.column_name.endsWith('_id') && 
            !['organization_id', 'preschool_id', 'school_id', 'tenant_id', 'id'].includes(c.column_name)
          );
          
          if (relationCols.length > 0) {
            console.log(`   🔗 Relation columns: ${relationCols.map(c => c.column_name).join(', ')}`);
          }
        } else {
          console.log(`⚠️  Table ${tableName} not found or empty`);
        }
      } catch (err) {
        console.log(`❌ Error analyzing ${tableName}:`, err.message);
      }
    }

    // Write detailed column information
    if (Object.keys(tableDetails).length > 0) {
      fs.writeFileSync(
        path.join(outputDir, 'table_details.json'), 
        JSON.stringify(tableDetails, null, 2)
      );
      console.log('📁 Table details exported to artifacts/security/table_details.json');
    }

    // Try to get RLS status information
    console.log('\n🔒 Checking RLS status...');
    try {
      // This might work if we have the right permissions
      const { data: rlsData, error: rlsError } = await supabase
        .from('pg_tables')
        .select('tablename, rowsecurity')
        .eq('schemaname', 'public');

      if (rlsError) {
        console.log('⚠️  Cannot query pg_tables directly:', rlsError.message);
      } else {
        console.log(`✅ RLS status retrieved for ${rlsData.length} tables`);
        
        const rlsEnabled = rlsData.filter(t => t.rowsecurity).length;
        const rlsDisabled = rlsData.filter(t => !t.rowsecurity).length;
        
        console.log(`   Enabled: ${rlsEnabled}, Disabled: ${rlsDisabled}`);
        
        // Write RLS status
        fs.writeFileSync(
          path.join(outputDir, 'rls_status.csv'),
          'table_name,rls_enabled\n' +
          rlsData.map(t => `${t.tablename},${t.rowsecurity}`).join('\n')
        );
        
        console.log('📁 RLS status exported to artifacts/security/rls_status.csv');
      }
    } catch (rlsErr) {
      console.log('❌ RLS status check failed:', rlsErr.message);
    }

    // Try to detect tenant isolation patterns
    console.log('\n🏢 Analyzing tenant isolation patterns...');
    const tenantColumns = {};
    
    Object.entries(tableDetails).forEach(([tableName, columns]) => {
      const tenantCol = columns.find(c => 
        ['organization_id', 'preschool_id', 'school_id', 'tenant_id'].includes(c.column_name)
      );
      
      if (tenantCol) {
        tenantColumns[tableName] = tenantCol.column_name;
      }
    });

    console.log('🏢 Tenant isolation mapping:');
    Object.entries(tenantColumns).forEach(([table, column]) => {
      console.log(`   ${table} -> ${column}`);
    });

    // Write tenant mapping
    fs.writeFileSync(
      path.join(outputDir, 'tenant_mapping.json'),
      JSON.stringify({
        tenant_columns: tenantColumns,
        tables_with_tenant_isolation: Object.keys(tenantColumns),
        tables_without_tenant_isolation: Object.keys(tableDetails).filter(t => !tenantColumns[t])
      }, null, 2)
    );

    console.log('\n✅ Schema extraction complete!');
    console.log('📁 Output files:');
    console.log('   - artifacts/security/tables.csv');
    console.log('   - artifacts/security/table_details.json');
    console.log('   - artifacts/security/rls_status.csv (if available)');
    console.log('   - artifacts/security/tenant_mapping.json');

  } catch (error) {
    console.error('❌ Schema extraction failed:', error);
  }
}

// Run the extraction
extractDatabaseInfo().catch(console.error);