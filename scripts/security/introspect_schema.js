#!/usr/bin/env node

/**
 * Database Schema Introspection Script
 * Exports schema information from Supabase for RLS analysis
 * Usage: node scripts/security/introspect_schema.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('  EXPO_PUBLIC_SUPABASE_URL');
    console.error('  SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function ensureDirectory(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

async function saveToCSV(filename, data) {
    const outputPath = path.join(__dirname, '../../artifacts/security', filename);
    await ensureDirectory(path.dirname(outputPath));
    
    if (!data || data.length === 0) {
        console.log(`⚠️  No data to save for ${filename}`);
        return;
    }
    
    // Convert to CSV
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) return '';
                const stringValue = String(value);
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            }).join(',')
        )
    ].join('\n');
    
    await fs.writeFile(outputPath, csvContent);
    console.log(`✅ Saved ${data.length} records to ${filename}`);
}

async function getBasicInfo() {
    console.log('📊 Getting basic database info...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
        query: `
            SELECT 
                current_database() as database_name,
                version() as postgres_version,
                current_timestamp as export_timestamp
        `
    });
    
    if (error) {
        console.error('❌ Error getting database info:', error);
        // Fallback to simpler approach
        const basicInfo = [{
            database_name: 'postgres',
            postgres_version: 'PostgreSQL (Supabase)',
            export_timestamp: new Date().toISOString()
        }];
        await saveToCSV('db_info.csv', basicInfo);
        return;
    }
    
    await saveToCSV('db_info.csv', data);
}

async function getTables() {
    console.log('📋 Getting tables information...');
    
    const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_schema, table_name, table_type')
        .in('table_schema', ['public', 'auth', 'storage'])
        .order('table_schema')
        .order('table_name');
        
    if (error) {
        console.error('❌ Error getting tables:', error);
        return;
    }
    
    await saveToCSV('tables.csv', data);
}

async function getColumns() {
    console.log('📝 Getting columns information...');
    
    const { data, error } = await supabase
        .from('information_schema.columns')
        .select('table_schema, table_name, column_name, data_type, is_nullable, column_default')
        .in('table_schema', ['public', 'auth', 'storage'])
        .order('table_schema')
        .order('table_name')
        .order('ordinal_position');
        
    if (error) {
        console.error('❌ Error getting columns:', error);
        return;
    }
    
    await saveToCSV('columns.csv', data);
}

async function getForeignKeys() {
    console.log('🔗 Getting foreign key relationships...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
        query: `
            SELECT 
                tc.table_schema,
                tc.table_name,
                kcu.column_name,
                ccu.table_schema as foreign_table_schema,
                ccu.table_name as foreign_table_name,
                ccu.column_name as foreign_column_name,
                tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
                AND tc.table_name = kcu.table_name
            JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
                AND tc.table_schema = ccu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema IN ('public', 'auth', 'storage')
            ORDER BY tc.table_schema, tc.table_name, kcu.column_name
        `
    });
    
    if (error) {
        console.error('❌ Error getting foreign keys:', error);
        return;
    }
    
    await saveToCSV('foreign_keys.csv', data);
}

async function getRLSStatus() {
    console.log('🔒 Getting RLS status...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
        query: `
            SELECT 
                n.nspname as schema_name,
                c.relname as table_name,
                c.relrowsecurity as rls_enabled,
                c.relforcerowsecurity as rls_forced
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r'
                AND n.nspname IN ('public', 'auth', 'storage')
            ORDER BY n.nspname, c.relname
        `
    });
    
    if (error) {
        console.error('❌ Error getting RLS status:', error);
        return;
    }
    
    await saveToCSV('rls_status.csv', data);
}

async function getPolicies() {
    console.log('📋 Getting RLS policies...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
        query: `
            SELECT 
                schemaname,
                tablename,
                policyname,
                permissive,
                roles,
                cmd,
                qual,
                with_check
            FROM pg_policies
            WHERE schemaname IN ('public', 'auth', 'storage')
            ORDER BY schemaname, tablename, policyname
        `
    });
    
    if (error) {
        console.error('❌ Error getting policies:', error);
        return;
    }
    
    await saveToCSV('policies.csv', data);
}

async function getTenantColumns() {
    console.log('🏢 Detecting tenant columns...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
        query: `
            SELECT 
                n.nspname as schema_name,
                c.relname as table_name,
                a.attname as column_name,
                t.typname as data_type
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_type t ON t.oid = a.atttypid
            WHERE a.attname IN ('organization_id', 'org_id', 'school_id', 'preschool_id', 'tenant_id')
                AND a.attnum > 0
                AND NOT a.attisdropped
                AND n.nspname IN ('public', 'auth', 'storage')
                AND c.relkind = 'r'
            ORDER BY n.nspname, c.relname, a.attname
        `
    });
    
    if (error) {
        console.error('❌ Error getting tenant columns:', error);
        return;
    }
    
    await saveToCSV('tenant_columns.csv', data);
}

async function getRelationshipColumns() {
    console.log('🔄 Detecting relationship columns...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
        query: `
            SELECT 
                n.nspname as schema_name,
                c.relname as table_name,
                a.attname as column_name,
                t.typname as data_type
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_type t ON t.oid = a.atttypid
            WHERE a.attname ~ '_(id|key)$'
                AND a.attname IN (
                    'user_id', 'class_id', 'student_id', 'teacher_id', 'parent_id',
                    'course_id', 'section_id', 'owner_id', 'creator_id', 'assigned_to',
                    'lesson_id', 'assignment_id', 'conversation_id', 'message_id'
                )
                AND a.attnum > 0
                AND NOT a.attisdropped
                AND n.nspname IN ('public', 'auth', 'storage')
                AND c.relkind = 'r'
            ORDER BY n.nspname, c.relname, a.attname
        `
    });
    
    if (error) {
        console.error('❌ Error getting relationship columns:', error);
        return;
    }
    
    await saveToCSV('relationship_columns.csv', data);
}

async function main() {
    console.log('🚀 Starting database schema introspection...');
    console.log(`📡 Connecting to: ${SUPABASE_URL}`);
    
    try {
        await getBasicInfo();
        await getTables();
        await getColumns();
        await getForeignKeys();
        await getRLSStatus();
        await getPolicies();
        await getTenantColumns();
        await getRelationshipColumns();
        
        console.log('\n✅ Schema introspection complete!');
        console.log('📁 All data exported to: artifacts/security/');
        console.log('\nGenerated files:');
        console.log('- db_info.csv           Database basic information');
        console.log('- tables.csv            All tables in public, auth, storage schemas');
        console.log('- columns.csv           All column definitions');
        console.log('- foreign_keys.csv      Foreign key relationships');
        console.log('- rls_status.csv        RLS enabled/forced status per table');
        console.log('- policies.csv          All existing RLS policies');
        console.log('- tenant_columns.csv    Detected tenant/org columns');
        console.log('- relationship_columns.csv    Key relationship columns');
        
    } catch (error) {
        console.error('❌ Schema introspection failed:', error);
        process.exit(1);
    }
}

// Handle Node.js missing RPC function
if (!supabase.rpc) {
    console.error('❌ This script requires Supabase client with RPC support');
    console.error('Please ensure you have the correct Supabase client version installed');
    process.exit(1);
}

main().catch(console.error);