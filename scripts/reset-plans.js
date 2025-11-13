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

  const plans = [
    { name: 'Free',       tier: 'free',       price_monthly: 0,    price_annual: 0,     max_teachers: 1,  max_students: 50,  is_active: true },
    { name: 'Starter',    tier: 'starter',    price_monthly: 49,   price_annual: 490,   max_teachers: 2,  max_students: 100, is_active: true },
    { name: 'Basic',      tier: 'basic',      price_monthly: 299,  price_annual: 2990,  max_teachers: 4,  max_students: 200, is_active: true },
    { name: 'Premium',    tier: 'premium',    price_monthly: 499,  price_annual: 4990,  max_teachers: 8,  max_students: 400, is_active: true },
    { name: 'Pro',        tier: 'pro',        price_monthly: 899,  price_annual: 8990,  max_teachers: 12, max_students: 800, is_active: true },
    { name: 'Enterprise', tier: 'enterprise', price_monthly: 1999, price_annual: 19990, max_teachers: 50, max_students: 2000,is_active: true },
  ];

  try {
    console.log('Archiving existing subscription_plans (is_active=false)...');
    const { error: updErr } = await s.from('subscription_plans').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (updErr) throw updErr;

    console.log('Inserting new plans...');
    const { data, error } = await s.from('subscription_plans').insert(plans).select('id, name, tier, price_monthly, max_teachers');
    if (error) throw error;

    console.log('Seeded plans:');
    (data || []).forEach((p, i) => console.log(`${i + 1}. ${p.name} (${p.tier}) R${p.price_monthly}/mo, seats ${p.max_teachers}`));

    // Verify via RPC
    const { data: rpcPlans, error: rpcErr } = await s.rpc('public_list_plans');
    if (rpcErr) throw rpcErr;
    console.log(`RPC visible plans: ${rpcPlans?.length}`);
  } catch (e) {
    console.error('Seeding failed:', e.message || e);
    process.exit(1);
  }
})();
