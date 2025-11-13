#!/usr/bin/env tsx
/**
 * Comprehensive Dash Features Test Suite
 * Tests AI response times, model responses, and realtime features
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

// Setup Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  duration?: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function testAIProxyResponseTime() {
  console.log('\n🧪 Testing AI Proxy Response Time...');
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: {
        messages: [
          { role: 'user', content: 'What is 2+2? Answer briefly.' }
        ],
        model: 'claude-3-5-haiku-20241022',
        stream: false,
        preschool_id: 'test',
      },
    });

    const duration = Date.now() - startTime;

    if (error) {
      results.push({
        name: 'AI Proxy Response Time',
        status: 'FAIL',
        duration,
        error: error.message,
      });
      console.log(`   ❌ FAIL (${duration}ms): ${error.message}`);
    } else {
      const status = duration < 3000 ? 'PASS' : 'WARN';
      results.push({
        name: 'AI Proxy Response Time',
        status,
        duration,
        details: `Response received in ${duration}ms`,
      });
      console.log(`   ${status === 'PASS' ? '✅' : '⚠️'} ${status} (${duration}ms)`);
      console.log(`   📝 Response preview: ${JSON.stringify(data).substring(0, 100)}...`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'AI Proxy Response Time',
      status: 'FAIL',
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(`   ❌ FAIL (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function testAIStreamingResponse() {
  console.log('\n🧪 Testing AI Streaming Response...');
  const startTime = Date.now();
  let firstChunkTime: number | null = null;
  let chunkCount = 0;
  
  try {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: {
        messages: [
          { role: 'user', content: 'Count from 1 to 5.' }
        ],
        model: 'claude-3-5-haiku-20241022',
        stream: true,
        preschool_id: 'test',
      },
    });

    if (error) {
      results.push({
        name: 'AI Streaming Response',
        status: 'FAIL',
        error: error.message,
      });
      console.log(`   ❌ FAIL: ${error.message}`);
      return;
    }

    // Process streaming response
    if (data instanceof ReadableStream) {
      const reader = data.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        if (firstChunkTime === null) {
          firstChunkTime = Date.now() - startTime;
        }
        
        chunkCount++;
        decoder.decode(value);
        process.stdout.write('.');
      }
      
      const totalDuration = Date.now() - startTime;
      console.log(`\n   ✅ PASS: ${chunkCount} chunks, first chunk in ${firstChunkTime}ms, total ${totalDuration}ms`);
      
      results.push({
        name: 'AI Streaming Response',
        status: 'PASS',
        duration: totalDuration,
        details: `${chunkCount} chunks, TTFB: ${firstChunkTime}ms`,
      });
    } else {
      console.log('   ⚠️ WARN: Expected streaming response but got regular response');
      results.push({
        name: 'AI Streaming Response',
        status: 'WARN',
        details: 'Non-streaming response received',
      });
    }
  } catch (error) {
    console.log(`\n   ❌ FAIL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    results.push({
      name: 'AI Streaming Response',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testDashboardDataFetch() {
  console.log('\n🧪 Testing Dashboard Data Fetch...');
  const startTime = Date.now();
  
  try {
    // Test principal dashboard function
    const { data, error } = await supabase.rpc('get_principal_dashboard_data');
    const duration = Date.now() - startTime;

    if (error) {
      // Function might not exist, that's okay
      if (error.code === '42883') {
        console.log(`   ⚠️ WARN: Dashboard function not found (expected for some setups)`);
        results.push({
          name: 'Dashboard Data Fetch',
          status: 'WARN',
          duration,
          details: 'Dashboard function not implemented',
        });
      } else {
        console.log(`   ❌ FAIL (${duration}ms): ${error.message}`);
        results.push({
          name: 'Dashboard Data Fetch',
          status: 'FAIL',
          duration,
          error: error.message,
        });
      }
    } else {
      console.log(`   ✅ PASS (${duration}ms): Dashboard data fetched successfully`);
      console.log(`   📊 Data keys: ${Object.keys(data || {}).join(', ')}`);
      results.push({
        name: 'Dashboard Data Fetch',
        status: 'PASS',
        duration,
        details: `Fetched in ${duration}ms`,
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ FAIL (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`);
    results.push({
      name: 'Dashboard Data Fetch',
      status: 'FAIL',
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testRealtimeConnection() {
  console.log('\n🧪 Testing Realtime Connection...');
  const startTime = Date.now();
  
  return new Promise<void>((resolve) => {
    let connected = false;
    let subscribed = false;
    
    const timeout = setTimeout(() => {
      if (!connected || !subscribed) {
        console.log(`   ❌ FAIL: Realtime connection timeout`);
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
      .channel('test-channel')
      .on('presence', { event: 'sync' }, () => {
        subscribed = true;
      })
      .subscribe((status) => {
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
          channel.unsubscribe();
          resolve();
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
  console.log('\n🧪 Testing OpenAI Realtime Token Generation...');
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
      console.log(`   ✅ PASS (${duration}ms): Token generated successfully`);
      console.log(`   🔑 Token length: ${data.token.length} chars`);
      results.push({
        name: 'OpenAI Realtime Token',
        status: 'PASS',
        duration,
        details: `Token generated in ${duration}ms`,
      });
    } else {
      console.log(`   ⚠️ WARN (${duration}ms): No token in response`);
      results.push({
        name: 'OpenAI Realtime Token',
        status: 'WARN',
        duration,
        details: 'No token returned',
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ FAIL (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`);
    results.push({
      name: 'OpenAI Realtime Token',
      status: 'FAIL',
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testAIUsageTracking() {
  console.log('\n🧪 Testing AI Usage Tracking...');
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .limit(1);
    
    const duration = Date.now() - startTime;

    if (error) {
      console.log(`   ❌ FAIL (${duration}ms): ${error.message}`);
      results.push({
        name: 'AI Usage Tracking',
        status: 'FAIL',
        duration,
        error: error.message,
      });
    } else {
      console.log(`   ✅ PASS (${duration}ms): Usage logs accessible`);
      console.log(`   📝 Sample logs: ${data?.length || 0} records`);
      results.push({
        name: 'AI Usage Tracking',
        status: 'PASS',
        duration,
        details: `${data?.length || 0} usage logs found`,
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ FAIL (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`);
    results.push({
      name: 'AI Usage Tracking',
      status: 'FAIL',
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📈 Total: ${results.length}`);
  
  console.log('\n📋 Detailed Results:');
  console.log('-'.repeat(60));
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${result.name}${duration}`);
    if (result.details) console.log(`   ${result.details}`);
    if (result.error) console.log(`   Error: ${result.error}`);
  });
  
  // Performance insights
  console.log('\n⚡ Performance Insights:');
  console.log('-'.repeat(60));
  
  const responseTimes = results
    .filter(r => r.duration && r.status === 'PASS')
    .sort((a, b) => (b.duration || 0) - (a.duration || 0));
  
  if (responseTimes.length > 0) {
    const avgTime = responseTimes.reduce((sum, r) => sum + (r.duration || 0), 0) / responseTimes.length;
    console.log(`Average response time: ${avgTime.toFixed(0)}ms`);
    
    console.log('\nSlowest operations:');
    responseTimes.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name}: ${r.duration}ms`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

async function main() {
  console.log('🚀 Starting Dash Features Test Suite');
  console.log('Testing AI responses, realtime features, and dashboard functionality');
  console.log('='.repeat(60));
  
  await testAIProxyResponseTime();
  await testAIStreamingResponse();
  await testDashboardDataFetch();
  await testRealtimeConnection();
  await testOpenAIRealtimeToken();
  await testAIUsageTracking();
  
  printSummary();
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
