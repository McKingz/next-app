#!/usr/bin/env tsx
/**
 * Enhanced Dash Features Test Suite
 * Tests AI response times, model responses, and realtime features with authentication
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  duration?: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];
// let authToken: string | null = null;

// Test user credentials (you may need to update these)
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'test123456';

async function authenticateTestUser() {
  console.log('\n🔐 Authenticating test user...');
  console.log(`   Email: ${TEST_USER_EMAIL}`);
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (error) {
      console.log(`   ⚠️ Authentication failed: ${error.message}`);
      console.log(`   ℹ️  Tests will run without authentication`);
      return false;
    }

    if (data.session) {
      authToken = data.session.access_token;
      console.log(`   ✅ Authenticated successfully`);
      console.log(`   👤 User ID: ${data.user?.id}`);
      return true;
    }

    return false;
  } catch (error) {
    console.log(`   ⚠️ Auth error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testAIProxyResponseTime() {
  console.log('\n🧪 Testing AI Proxy Response Time...');
  const startTime = Date.now();
  
  try {
    const requestBody = {
      messages: [
        { role: 'user', content: 'What is 2+2? Answer in one word.' }
      ],
      model: 'claude-3-5-haiku-20241022',
      stream: false,
    };

    console.log(`   📤 Request: ${JSON.stringify(requestBody).substring(0, 80)}...`);

    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: requestBody,
    });

    const duration = Date.now() - startTime;

    if (error) {
      console.log(`   ❌ FAIL (${duration}ms): ${error.message}`);
      console.log(`   📋 Error details: ${JSON.stringify(error)}`);
      results.push({
        name: 'AI Proxy Response Time',
        status: 'FAIL',
        duration,
        error: error.message,
      });
      return;
    }

    // Check if we got a proper response
    if (data && typeof data === 'object') {
      const status = duration < 3000 ? 'PASS' : 'WARN';
      console.log(`   ${status === 'PASS' ? '✅' : '⚠️'} ${status} (${duration}ms)`);
      console.log(`   📝 Response: ${JSON.stringify(data).substring(0, 150)}...`);
      
      results.push({
        name: 'AI Proxy Response Time',
        status,
        duration,
        details: `Response in ${duration}ms`,
      });
    } else {
      console.log(`   ⚠️ WARN: Unexpected response format`);
      console.log(`   📋 Response: ${JSON.stringify(data)}`);
      results.push({
        name: 'AI Proxy Response Time',
        status: 'WARN',
        duration,
        details: 'Unexpected response format',
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ FAIL (${duration}ms): ${errorMsg}`);
    results.push({
      name: 'AI Proxy Response Time',
      status: 'FAIL',
      duration,
      error: errorMsg,
    });
  }
}

async function testAIStreamingResponse() {
  console.log('\n🧪 Testing AI Streaming Response...');
  const startTime = Date.now();
  let firstChunkTime: number | null = null;
  let chunkCount = 0;
  let totalBytes = 0;
  
  try {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: {
        messages: [
          { role: 'user', content: 'Count from 1 to 3.' }
        ],
        model: 'claude-3-5-haiku-20241022',
        stream: true,
      },
    });

    if (error) {
      console.log(`   ❌ FAIL: ${error.message}`);
      console.log(`   📋 Error details: ${JSON.stringify(error)}`);
      results.push({
        name: 'AI Streaming Response',
        status: 'FAIL',
        error: error.message,
      });
      return;
    }

    // Try to process as stream
    if (data && typeof data === 'object' && 'getReader' in data) {
      const reader = (data as ReadableStream).getReader();
      const decoder = new TextDecoder();

      console.log(`   📡 Receiving stream...`);

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        if (firstChunkTime === null) {
          firstChunkTime = Date.now() - startTime;
          console.log(`\n   ⚡ First chunk: ${firstChunkTime}ms`);
        }
        
        chunkCount++;
        totalBytes += value.length;
        decoder.decode(value);
        process.stdout.write('.');
      }
      
      const totalDuration = Date.now() - startTime;
      console.log(`\n   ✅ PASS: ${chunkCount} chunks, ${totalBytes} bytes, TTFB: ${firstChunkTime}ms, total: ${totalDuration}ms`);
      
      results.push({
        name: 'AI Streaming Response',
        status: 'PASS',
        duration: totalDuration,
        details: `${chunkCount} chunks, ${totalBytes} bytes, TTFB: ${firstChunkTime}ms`,
      });
    } else {
      console.log(`   ⚠️ WARN: Response is not a stream`);
      console.log(`   📋 Response type: ${typeof data}`);
      results.push({
        name: 'AI Streaming Response',
        status: 'WARN',
        details: 'Non-streaming response received',
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`\n   ❌ FAIL: ${errorMsg}`);
    results.push({
      name: 'AI Streaming Response',
      status: 'FAIL',
      error: errorMsg,
    });
  }
}

async function checkDashboardFunction() {
  console.log('\n🧪 Checking Dashboard Function...');
  const startTime = Date.now();
  
  try {
    // Check if function exists
    const { data: functions, error: funcError } = await supabase
      .from('information_schema.routines')
      .select('routine_name')
      .eq('routine_schema', 'public')
      .like('routine_name', '%dashboard%');

    if (funcError) {
      console.log(`   ⚠️ Could not query routines: ${funcError.message}`);
    } else {
      console.log(`   📊 Dashboard functions found: ${functions?.length || 0}`);
      if (functions && functions.length > 0) {
        functions.forEach(f => console.log(`      - ${f.routine_name}`));
      }
    }

    // Try to call the function
    const { data, error } = await supabase.rpc('get_principal_dashboard_data');
    const duration = Date.now() - startTime;

    if (error) {
      if (error.code === '42883') {
        console.log(`   ⚠️ WARN (${duration}ms): Function not found`);
        console.log(`   ℹ️  This is expected if dashboard function hasn't been created`);
        results.push({
          name: 'Dashboard Function',
          status: 'WARN',
          duration,
          details: 'Function not implemented',
        });
      } else {
        console.log(`   ❌ FAIL (${duration}ms): ${error.message}`);
        results.push({
          name: 'Dashboard Function',
          status: 'FAIL',
          duration,
          error: error.message,
        });
      }
    } else {
      console.log(`   ✅ PASS (${duration}ms): Dashboard data fetched`);
      console.log(`   📊 Response keys: ${Object.keys(data || {}).join(', ')}`);
      results.push({
        name: 'Dashboard Function',
        status: 'PASS',
        duration,
        details: `Fetched in ${duration}ms`,
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ FAIL (${duration}ms): ${errorMsg}`);
    results.push({
      name: 'Dashboard Function',
      status: 'FAIL',
      duration,
      error: errorMsg,
    });
  }
}

async function testDatabaseTables() {
  console.log('\n🧪 Testing Database Tables...');
  const startTime = Date.now();
  
  const tables = [
    'preschools',
    'students',
    'teachers',
    'users',
    'attendance_records',
    'ai_usage_logs',
  ];

  let accessible = 0;
  let failed = 0;

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
        failed++;
      } else {
        console.log(`   ✅ ${table}: accessible`);
        accessible++;
      }
    } catch (error) {
      console.log(`   ❌ ${table}: ${error instanceof Error ? error.message : 'Unknown'}`);
      failed++;
    }
  }

  const duration = Date.now() - startTime;
  const status = failed === 0 ? 'PASS' : accessible > 0 ? 'WARN' : 'FAIL';
  
  console.log(`   📊 Result: ${accessible}/${tables.length} tables accessible`);
  
  results.push({
    name: 'Database Tables',
    status,
    duration,
    details: `${accessible}/${tables.length} accessible`,
  });
}

async function testRealtimeConnection() {
  console.log('\n🧪 Testing Realtime Connection...');
  const startTime = Date.now();
  
  return new Promise<void>((resolve) => {
    let connected = false;
    
    const timeout = setTimeout(() => {
      if (!connected) {
        console.log(`   ❌ FAIL: Connection timeout (5s)`);
        console.log(`   ℹ️  Realtime may not be enabled in Supabase project`);
        results.push({
          name: 'Realtime Connection',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: 'Connection timeout',
        });
        channel.unsubscribe();
      }
      resolve();
    }, 5000);

    const channel = supabase
      .channel('test-channel-' + Date.now())
      .on('presence', { event: 'sync' }, () => {
        console.log(`   📡 Presence sync received`);
      })
      .subscribe((status) => {
        console.log(`   📡 Channel status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          connected = true;
          const duration = Date.now() - startTime;
          console.log(`   ✅ PASS (${duration}ms): Realtime connected`);
          results.push({
            name: 'Realtime Connection',
            status: 'PASS',
            duration,
            details: `Connected in ${duration}ms`,
          });
          clearTimeout(timeout);
          setTimeout(() => {
            channel.unsubscribe();
            resolve();
          }, 500);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const duration = Date.now() - startTime;
          console.log(`   ❌ FAIL (${duration}ms): Status ${status}`);
          results.push({
            name: 'Realtime Connection',
            status: 'FAIL',
            duration,
            error: `Status: ${status}`,
          });
          clearTimeout(timeout);
          channel.unsubscribe();
          resolve();
        }
      });
  });
}

async function testOpenAIRealtimeToken() {
  console.log('\n🧪 Testing OpenAI Realtime Token...');
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase.functions.invoke('openai-realtime-token');
    const duration = Date.now() - startTime;

    if (error) {
      console.log(`   ❌ FAIL (${duration}ms): ${error.message}`);
      results.push({
        name: 'OpenAI Realtime Token',
        status: 'FAIL',
        duration,
        error: error.message,
      });
    } else if (data?.token) {
      console.log(`   ✅ PASS (${duration}ms): Token generated`);
      console.log(`   🔑 Token length: ${data.token.length} chars`);
      console.log(`   ⏰ Expires in: ${data.expires_in || 'unknown'} seconds`);
      results.push({
        name: 'OpenAI Realtime Token',
        status: 'PASS',
        duration,
        details: `Token generated in ${duration}ms`,
      });
    } else {
      console.log(`   ⚠️ WARN (${duration}ms): No token in response`);
      console.log(`   📋 Response: ${JSON.stringify(data)}`);
      results.push({
        name: 'OpenAI Realtime Token',
        status: 'WARN',
        duration,
        details: 'No token returned',
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ FAIL (${duration}ms): ${errorMsg}`);
    results.push({
      name: 'OpenAI Realtime Token',
      status: 'FAIL',
      duration,
      error: errorMsg,
    });
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 DASH FEATURES TEST SUMMARY');
  console.log('='.repeat(70));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`\n✅ Passed:   ${passed}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`⏭️  Skipped:  ${skipped}`);
  console.log(`📈 Total:    ${results.length}`);
  
  console.log('\n📋 Detailed Results:');
  console.log('-'.repeat(70));
  
  results.forEach(result => {
    const icons = { PASS: '✅', FAIL: '❌', WARN: '⚠️', SKIP: '⏭️' };
    const icon = icons[result.status];
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${result.name}${duration}`);
    if (result.details) console.log(`   ${result.details}`);
    if (result.error) console.log(`   Error: ${result.error}`);
  });
  
  // Performance insights
  const responseTimes = results
    .filter(r => r.duration && r.status === 'PASS')
    .sort((a, b) => (b.duration || 0) - (a.duration || 0));
  
  if (responseTimes.length > 0) {
    console.log('\n⚡ Performance Insights:');
    console.log('-'.repeat(70));
    
    const avgTime = responseTimes.reduce((sum, r) => sum + (r.duration || 0), 0) / responseTimes.length;
    console.log(`Average response time: ${avgTime.toFixed(0)}ms`);
    
    console.log('\nOperations by speed:');
    responseTimes.forEach((r) => {
      const speed = (r.duration || 0) < 500 ? '🚀' : (r.duration || 0) < 1000 ? '⚡' : '🐢';
      console.log(`  ${speed} ${r.name}: ${r.duration}ms`);
    });
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('-'.repeat(70));
  
  if (failed > 0) {
    console.log('❌ Failed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.name}: ${r.error}`);
      
      if (r.name.includes('AI Proxy')) {
        console.log(`     → Check AI service credentials and rate limits`);
      }
      if (r.name.includes('Realtime')) {
        console.log(`     → Enable Realtime in Supabase project settings`);
      }
      if (r.name.includes('Dashboard')) {
        console.log(`     → Create dashboard function or check migrations`);
      }
    });
  }
  
  if (warnings > 0) {
    console.log('\n⚠️  Warnings:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`   • ${r.name}: ${r.details || r.error}`);
    });
  }
  
  if (passed === results.length) {
    console.log('✅ All tests passed! Dash features are working correctly.');
  }
  
  console.log('\n' + '='.repeat(70));
}

async function main() {
  console.log('🚀 ENHANCED DASH FEATURES TEST SUITE');
  console.log('Testing AI responses, realtime features, and dashboard functionality');
  console.log('='.repeat(70));
  
  // Try to authenticate
  const authenticated = await authenticateTestUser();
  
  if (!authenticated) {
    console.log('\n⚠️  Running tests without authentication - some tests may fail');
  }
  
  // Run all tests
  await testDatabaseTables();
  await testAIProxyResponseTime();
  await testAIStreamingResponse();
  await checkDashboardFunction();
  await testRealtimeConnection();
  await testOpenAIRealtimeToken();
  
  printSummary();
  
  // Exit code
  const failedCount = results.filter(r => r.status === 'FAIL').length;
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
