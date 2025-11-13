import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_DB_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type TableSpec = { table: string; columns: string[] };

const specs: TableSpec[] = [
  { table: 'students', columns: ['id','first_name','last_name','class_id','is_active','parent_id','guardian_id'] },
  { table: 'attendance_records', columns: ['id','student_id','preschool_id','date','status','created_at'] },
  { table: 'homework_assignments', columns: ['id','class_id','due_date'] },
  { table: 'homework_submissions', columns: ['id','assignment_id','student_id','submitted_at','grade','feedback','status'] },
  { table: 'class_events', columns: ['id','class_id','preschool_id','title','start_time','end_time'] },
  { table: 'financial_transactions', columns: ['id','preschool_id','amount','type','status','created_at','description','student_id'] },
  { table: 'guardian_requests', columns: ['id','school_id','parent_auth_id','parent_email','student_id','child_full_name','child_class','status','created_at','approved_at','approved_by'] },
  { table: 'teacher_invites', columns: ['id','school_id','email','token','status','invited_by','expires_at','created_at','accepted_by','accepted_at'] },
];

async function tableExists(table: string): Promise<boolean> {
  try {
    const { error } = await sb.from(table).select('id', { count: 'exact', head: true });
    if (error) {
      const msg = (error as any).message || '';
      if (/relation .* does not exist/i.test(msg)) return false;
      // If 406 Not Acceptable or other, still assume exists
    }
    return true;
  } catch (e: any) {
    const msg = e?.message || '';
    if (/does not exist/.test(msg)) return false;
    return true;
  }
}

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const { error } = await sb.from(table).select(column).limit(1);
    if (error) {
      const msg = (error as any).message || '';
      if (/column .* does not exist/i.test(msg)) return false;
    }
    return true;
  } catch (e: any) {
    const msg = e?.message || '';
    if (/does not exist/.test(msg)) return false;
    return true;
  }
}

async function main() {
  console.log(`🔍 Verifying app schema on ${SUPABASE_URL}`);

  const results: Record<string, { missingTable: boolean; missingColumns: string[] }> = {};

  for (const spec of specs) {
    const exists = await tableExists(spec.table);
    const missingColumns: string[] = [];
    if (exists) {
      for (const col of spec.columns) {
        const ok = await columnExists(spec.table, col);
        if (!ok) missingColumns.push(col);
      }
    }
    results[spec.table] = { missingTable: !exists, missingColumns };
  }

  console.log('\n📋 App Schema Verification Results:');
  let anyMissing = false;
  for (const [table, res] of Object.entries(results)) {
    if (res.missingTable) {
      anyMissing = true;
      console.log(`  ❌ ${table}: MISSING TABLE`);
    } else if (res.missingColumns.length > 0) {
      anyMissing = true;
      console.log(`  ⚠️ ${table}: Missing columns -> ${res.missingColumns.join(', ')}`);
    } else {
      console.log(`  ✅ ${table}: OK`);
    }
  }

  if (!anyMissing) {
    console.log('\n✅ All required tables and columns are present.');
  } else {
    console.log('\n🔧 Some items are missing. I will prepare a migration draft to fix them.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });