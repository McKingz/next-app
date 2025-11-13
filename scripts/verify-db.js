const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyDatabase() {
  console.log('🔍 Verifying database cleanup and setup...\n');

  try {
    // Check subscription plans
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (plansError) {
      console.error('❌ Error fetching plans:', plansError);
      return;
    }

    console.log(`✅ Found ${plans.length} active subscription plans:`);
    plans.forEach((plan, index) => {
      console.log(`  ${index + 1}. ${plan.name} (${plan.tier}) - R${plan.price_monthly}/month`);
      console.log(`     Teachers: ${plan.max_teachers} | Students: ${plan.max_students}`);
    });
    console.log('');

    // Check users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('email, role, first_name, last_name')
      .order('role');

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    console.log(`✅ Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (${user.role}) - ${user.first_name} ${user.last_name}`);
    });
    console.log('');

    // Check subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        preschools(name),
        subscription_plans(name, tier)
      `);

    if (subsError) {
      console.error('❌ Error fetching subscriptions:', subsError);
      return;
    }

    console.log(`✅ Found ${subscriptions.length} active subscriptions:`);
    subscriptions.forEach((sub, index) => {
      console.log(`  ${index + 1}. ${sub.preschools?.name} - ${sub.subscription_plans?.name} (${sub.status})`);
      console.log(`     Seats: ${sub.seats_used}/${sub.seats_total}`);
    });
    console.log('');

    // Check students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('first_name, last_name')
      .limit(10);

    if (studentsError) {
      console.error('❌ Error fetching students:', studentsError);
      return;
    }

    console.log(`✅ Found ${students.length} students (showing first 10):`);
    students.forEach((student, index) => {
      console.log(`  ${index + 1}. ${student.first_name} ${student.last_name}`);
    });

    console.log('\n🎉 Database verification completed successfully!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyDatabase();