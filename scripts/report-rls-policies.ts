import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_DB_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log(`🔒 Reporting RLS policies for ${SUPABASE_URL}`);
  try {
    const { data, error } = await sb.rpc('get_public_rls_policies');
    if (error) {
      console.log('⚠️ Could not fetch policies via RPC. Apply migrations_drafts/20250915_rls_policy_introspection.sql first.');
      process.exit(1);
    }
    const byTable: Record<string, any[]> = {};
    (data || []).forEach((row: any) => {
      if (!byTable[row.tablename]) byTable[row.tablename] = [];
      byTable[row.tablename].push(row);
    });

    Object.entries(byTable).forEach(([table, policies]) => {
      console.log(`\n🛡️ ${table}: ${policies.length} policies`);
      policies.forEach((p) => {
        console.log(`  - ${p.policyname} (${p.cmd}) roles=${(p.roles || []).join(',')}`);
      });
    });
    if (Object.keys(byTable).length === 0) {
      console.log('\n⚠️ No policies returned. Ensure RLS RPC is installed or RLS is configured.');
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();