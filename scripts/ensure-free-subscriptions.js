require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

(async () => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const s = createClient(url, key);

  // Fetch all schools
  const { data: schools, error: schoolErr } = await s
    .from('preschools')
    .select('id, name, subscription_tier')
    .order('name');
  if (schoolErr) {
    console.error('Failed to fetch schools:', schoolErr.message);
    process.exit(1);
  }
  console.log(`Found ${schools?.length || 0} schools`);

  for (const school of schools || []) {
    const schoolId = school.id;
    const { data: subs, error: subErr } = await s
      .from('subscriptions')
      .select('id, plan_id, status, seats_total')
      .eq('owner_type', 'school')
      .eq('school_id', schoolId);

    if (subErr) {
      console.error('Failed to check subscriptions for', school.name, subErr.message);
      continue;
    }

    const hasFree = (subs || []).some((x) => String(x.plan_id).toLowerCase() === 'free');
    if (hasFree) {
      console.log(`✓ ${school.name}: already has free plan`);
      continue;
    }

    // Insert a free plan with 5 seats
    const start = new Date();
    const end = new Date(start.getTime());
    end.setMonth(end.getMonth() + 1);
    const payload = {
      school_id: schoolId,
      plan_id: 'free',
      status: 'active',
      owner_type: 'school',
      billing_frequency: 'monthly',
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      next_billing_date: end.toISOString(),
      seats_total: 5,
      seats_used: 0,
      metadata: { created_by: 'ensure_free_script' },
    };

    const { data: ins, error: insErr } = await s
      .from('subscriptions')
      .insert(payload)
      .select('id')
      .single();

    if (insErr) {
      console.error(`✗ ${school.name}: failed to create free subscription`, insErr.message);
    } else {
      console.log(`+ ${school.name}: free subscription created (${ins.id})`);
      // Update school's subscription tier if blank
      if (!school.subscription_tier) {
        await s.from('preschools').update({ subscription_tier: 'free' }).eq('id', schoolId);
      }
    }
  }
})();
