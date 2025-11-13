import { assertSupabase } from '../lib/supabase';

async function verifySubscriptionPlans() {
  try {
    console.log('🔍 Verifying subscription plans...\n');
    
    const { data: plans, error } = await assertSupabase()
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (error) {
      console.error('❌ Error fetching plans:', error);
      return;
    }

    if (!plans || plans.length === 0) {
      console.log('❌ No active subscription plans found');
      return;
    }

    console.log(`✅ Found ${plans.length} active subscription plans:\n`);

    plans.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.name} (${plan.tier})`);
      console.log(`   💰 Monthly: R${plan.price_monthly} | Annual: R${plan.price_annual}`);
      console.log(`   👥 Teachers: ${plan.max_teachers} | Students: ${plan.max_students}`);
      console.log(`   🎯 Features: ${Array.isArray(plan.features) ? plan.features.length : 'N/A'} features`);
      console.log(`   🏫 School types: ${Array.isArray(plan.school_types) ? plan.school_types.join(', ') : 'N/A'}`);
      console.log('');
    });

    // Check for the specific tiers we expect
    const expectedTiers = ['free', 'starter', 'premium', 'enterprise'];
    const foundTiers = plans.map(p => p.tier.toLowerCase());
    
    console.log('🎯 Tier Coverage:');
    expectedTiers.forEach(tier => {
      const found = foundTiers.includes(tier);
      console.log(`   ${found ? '✅' : '❌'} ${tier.charAt(0).toUpperCase() + tier.slice(1)}: ${found ? 'Available' : 'Missing'}`);
    });

    console.log('\n🎉 Subscription plans verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  verifySubscriptionPlans();
}

export { verifySubscriptionPlans };