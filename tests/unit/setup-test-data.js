#!/usr/bin/env node

// Setup minimal test data for seat management testing
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzc4MzgsImV4cCI6MjA2ODYxMzgzOH0.mjXejyRHPzEJfMlhW46TlYI0qw9mtoSRJZhGsCkuvd8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTestData() {
  console.log('🚀 Setting up minimal test data for seat management...\n');

  try {
    // 1. Create a test preschool
    console.log('1. Creating test preschool...');
    const { data: school, error: schoolError } = await supabase
      .from('preschools')
      .insert({
        name: 'Young Eagles Test School',
        tenant_slug: 'young-eagles',
        is_active: true
      })
      .select()
      .single();

    if (schoolError) {
      console.log('❌ Error creating preschool:', schoolError.message);
      return;
    }
    console.log('✅ Created preschool:', school.id);

    // 2. Create subscription plans
    console.log('\n2. Creating subscription plans...');
    const plans = [
      { id: 'free', name: 'Free', price_monthly: 0, price_annual: 0 },
      { id: 'basic', name: 'Basic', price_monthly: 299, price_annual: 2999 },
      { id: 'pro', name: 'Pro', price_monthly: 599, price_annual: 5999 }
    ];

    for (const plan of plans) {
      const { error: planError } = await supabase
        .from('subscription_plans')
        .insert(plan);
      
      if (planError) {
        console.log(`❌ Error creating plan ${plan.name}:`, planError.message);
      } else {
        console.log(`✅ Created plan: ${plan.name}`);
      }
    }

    // 3. Create a test subscription for the school
    console.log('\n3. Creating test subscription...');
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        owner_type: 'school',
        school_id: school.id,
        plan_id: 'basic',
        status: 'active',
        seats_total: 3,
        seats_used: 0,
        billing_cycle: 'monthly'
      })
      .select()
      .single();

    if (subError) {
      console.log('❌ Error creating subscription:', subError.message);
      return;
    }
    console.log('✅ Created subscription:', subscription.id);

    // 4. Create test users (auth users simulation)
    console.log('\n4. Creating test users...');
    const testUsers = [
      { 
        id: '00000000-0000-0000-0000-000000000001', 
        email: 'principal@young-eagles.com', 
        role: 'principal',
        first_name: 'John',
        last_name: 'Principal'
      },
      { 
        id: '00000000-0000-0000-0000-000000000002', 
        email: 'teacher1@young-eagles.com', 
        role: 'teacher',
        first_name: 'Sarah',
        last_name: 'Johnson'
      },
      { 
        id: '00000000-0000-0000-0000-000000000003', 
        email: 'teacher2@young-eagles.com', 
        role: 'teacher',
        first_name: 'Mike',
        last_name: 'Davis'
      }
    ];

    for (const user of testUsers) {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          role: user.role,
          preschool_id: school.id,
          first_name: user.first_name,
          last_name: user.last_name
        });

      if (profileError) {
        console.log(`❌ Error creating profile for ${user.email}:`, profileError.message);
      } else {
        console.log(`✅ Created profile: ${user.email} (${user.role})`);
      }

      // Also create in users table if it exists
      try {
        const { error: userError } = await supabase
          .from('users')
          .insert({
            auth_user_id: user.id,
            email: user.email,
            role: user.role,
            preschool_id: school.id,
            first_name: user.first_name,
            last_name: user.last_name
          });

        if (!userError) {
          console.log(`✅ Created user record: ${user.email}`);
        }
      } catch (e) {
        // Ignore if users table doesn't exist or has different structure
        console.log(`ℹ️ Skipping users table for ${user.email}`);
      }
    }

    // 5. Assign one seat to demonstrate seat management
    console.log('\n5. Creating test seat assignment...');
    const { error: seatError } = await supabase
      .from('subscription_seats')
      .insert({
        subscription_id: subscription.id,
        user_id: testUsers[1].id // Assign to first teacher
      });

    if (seatError) {
      console.log('❌ Error creating seat assignment:', seatError.message);
    } else {
      console.log('✅ Assigned seat to teacher1@young-eagles.com');
    }

    console.log('\n🎉 Test data setup complete!');
    console.log('\nYou can now test seat management with:');
    console.log('- School: Young Eagles Test School');
    console.log('- Principal: principal@young-eagles.com');
    console.log('- Teachers: teacher1@young-eagles.com (has seat), teacher2@young-eagles.com (no seat)');
    console.log('- Subscription: Basic plan with 3 seats total');

  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
  }
}

setupTestData().catch(console.error);