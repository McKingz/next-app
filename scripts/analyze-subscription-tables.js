const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeSubscriptionTables() {
  console.log('🔍 Analyzing current subscription-related tables...\n');

  // List of subscription-related tables from the screenshot
  const tables = [
    'subscription_plans',
    'subscriptions',
    'subscription_seats',
    'subscription_invoices', 
    'subscription_payments',
    'subscription_events',
    'subscription_usage'
  ];

  for (const tableName of tables) {
    console.log(`📊 Analyzing table: ${tableName}`);
    
    try {
      // Try to get data from each table
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .limit(3);

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Exists with ${count || 0} rows`);
        if (data && data.length > 0) {
          console.log(`   📋 Sample columns:`, Object.keys(data[0]));
        }
      }
    } catch (err) {
      console.log(`   ❌ Failed to query: ${err.message}`);
    }
    console.log('');
  }

  // Check for foreign key relationships
  console.log('🔗 Checking foreign key relationships...\n');
  
  try {
    // Try to join subscriptions with subscription_plans
    const { data: joinTest, error: joinError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        plan_id,
        subscription_plans(name, tier)
      `)
      .limit(1);

    if (joinError) {
      console.log('❌ subscriptions -> subscription_plans join failed:', joinError.message);
    } else {
      console.log('✅ subscriptions -> subscription_plans relationship works');
    }

    // Check subscription_seats relationship
    const { data: seatsTest, error: seatsError } = await supabase
      .from('subscription_seats')
      .select('*')
      .limit(1);

    if (seatsError) {
      console.log('❌ subscription_seats access failed:', seatsError.message);
    } else {
      console.log('✅ subscription_seats accessible');
    }

  } catch (err) {
    console.log('❌ Relationship check failed:', err.message);
  }

  console.log('\n📝 Analysis complete!');
}

analyzeSubscriptionTables();