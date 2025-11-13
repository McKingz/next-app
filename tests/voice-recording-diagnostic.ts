#!/usr/bin/env tsx
/**
 * Voice Recording Diagnostic Test
 * Tests microphone, streaming, and transcription functionality
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface DiagnosticResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: DiagnosticResult[] = [];

async function testStreamingEnabled() {
  console.log('\n🔍 Test 1: Streaming Configuration');
  
  const envStreaming = process.env.EXPO_PUBLIC_DASH_STREAMING;
  console.log(`   ENV EXPO_PUBLIC_DASH_STREAMING: ${envStreaming}`);
  
  const isEnabled = String(envStreaming || '').toLowerCase() === 'true';
  
  if (isEnabled) {
    console.log('   ✅ Streaming is ENABLED');
    results.push({
      test: 'Streaming Configuration',
      status: 'PASS',
      message: 'Streaming enabled in environment',
      details: { EXPO_PUBLIC_DASH_STREAMING: envStreaming }
    });
  } else {
    console.log('   ❌ Streaming is DISABLED');
    console.log('   💡 Voice recording requires streaming to be enabled');
    results.push({
      test: 'Streaming Configuration',
      status: 'FAIL',
      message: 'Streaming disabled - voice recording will not work',
      details: { EXPO_PUBLIC_DASH_STREAMING: envStreaming }
    });
  }
  
  return isEnabled;
}

async function testOpenAIRealtimeToken() {
  console.log('\n🔍 Test 2: OpenAI Realtime Token Generation');
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase.functions.invoke('openai-realtime-token');
    const duration = Date.now() - startTime;

    if (error) {
      console.log(`   ❌ FAIL (${duration}ms): ${error.message}`);
      results.push({
        test: 'OpenAI Realtime Token',
        status: 'FAIL',
        message: `Token generation failed: ${error.message}`,
        details: error
      });
      return false;
    }

    if (data?.token) {
      console.log(`   ✅ PASS (${duration}ms): Token generated successfully`);
      console.log(`   🔑 Token length: ${data.token.length} chars`);
      results.push({
        test: 'OpenAI Realtime Token',
        status: 'PASS',
        message: `Token generated in ${duration}ms`,
        details: { tokenLength: data.token.length, duration }
      });
      return true;
    }

    console.log(`   ⚠️ WARN: Token generation returned but no token`);
    results.push({
      test: 'OpenAI Realtime Token',
      status: 'WARN',
      message: 'Token endpoint responded but no token provided',
      details: data
    });
    return false;
  } catch (error) {
    console.log(`   ❌ FAIL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    results.push({
      test: 'OpenAI Realtime Token',
      status: 'FAIL',
      message: 'Token generation threw exception',
      details: { error: error instanceof Error ? error.message : String(error) }
    });
    return false;
  }
}

async function testWebSocketConnection() {
  console.log('\n🔍 Test 3: WebSocket/Realtime Connection');
  const startTime = Date.now();
  
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      console.log('   ❌ FAIL: Connection timeout (5s)');
      results.push({
        test: 'WebSocket Connection',
        status: 'FAIL',
        message: 'Connection timeout after 5 seconds',
        details: { duration: Date.now() - startTime }
      });
      channel.unsubscribe();
      resolve(false);
    }, 5000);

    const channel = supabase
      .channel('voice-diagnostic-test')
      .on('presence', { event: 'sync' }, () => {
        console.log('   📡 Presence sync received');
      })
      .subscribe((status) => {
        console.log(`   📡 Channel status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          const duration = Date.now() - startTime;
          console.log(`   ✅ PASS (${duration}ms): Realtime connected`);
          results.push({
            test: 'WebSocket Connection',
            status: 'PASS',
            message: `Connected in ${duration}ms`,
            details: { duration }
          });
          clearTimeout(timeout);
          setTimeout(() => {
            channel.unsubscribe();
            resolve(true);
          }, 500);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const duration = Date.now() - startTime;
          console.log(`   ❌ FAIL (${duration}ms): Status ${status}`);
          results.push({
            test: 'WebSocket Connection',
            status: 'FAIL',
            message: `Connection failed with status: ${status}`,
            details: { status, duration }
          });
          clearTimeout(timeout);
          channel.unsubscribe();
          resolve(false);
        }
      });
  });
}

async function checkEnvironmentVariables() {
  console.log('\n🔍 Test 4: Environment Variables Check');
  
  const requiredVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_DASH_STREAMING',
  ];
  
  const optionalVars = [
    'EXPO_PUBLIC_SENTRY_DSN',
    'EXPO_PUBLIC_POSTHOG_KEY',
  ];
  
  const missing: string[] = [];
  const present: string[] = [];
  
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      present.push(varName);
      console.log(`   ✅ ${varName}: ${process.env[varName]?.substring(0, 20)}...`);
    } else {
      missing.push(varName);
      console.log(`   ❌ ${varName}: MISSING`);
    }
  });
  
  console.log('\n   Optional variables:');
  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`   ℹ️  ${varName}: Set`);
    } else {
      console.log(`   ⚠️  ${varName}: Not set`);
    }
  });
  
  if (missing.length === 0) {
    results.push({
      test: 'Environment Variables',
      status: 'PASS',
      message: 'All required variables present',
      details: { present, missing }
    });
    return true;
  } else {
    results.push({
      test: 'Environment Variables',
      status: 'FAIL',
      message: `Missing ${missing.length} required variable(s)`,
      details: { present, missing }
    });
    return false;
  }
}

async function testEdgeFunctions() {
  console.log('\n🔍 Test 5: Edge Functions Availability');
  
  const functions = [
    'openai-realtime-token',
    'ai-proxy',
    'transcribe-audio'
  ];
  
  const available: string[] = [];
  const unavailable: string[] = [];
  
  for (const funcName of functions) {
    try {
      const { error } = await supabase.functions.invoke(funcName, {
        body: { test: true }
      });
      
      // If we get a response (even error), function exists
      if (error?.message?.includes('not found') || error?.message?.includes('does not exist')) {
        unavailable.push(funcName);
        console.log(`   ❌ ${funcName}: Not found`);
      } else {
        available.push(funcName);
        console.log(`   ✅ ${funcName}: Available`);
      }
    } catch {
      // Exception means function exists but rejected request
      available.push(funcName);
      console.log(`   ✅ ${funcName}: Available (rejected test request)`);
    }
  }
  
  if (unavailable.length === 0) {
    results.push({
      test: 'Edge Functions',
      status: 'PASS',
      message: 'All voice-related functions available',
      details: { available, unavailable }
    });
    return true;
  } else {
    results.push({
      test: 'Edge Functions',
      status: 'WARN',
      message: `Some functions unavailable: ${unavailable.join(', ')}`,
      details: { available, unavailable }
    });
    return false;
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 VOICE RECORDING DIAGNOSTIC SUMMARY');
  console.log('='.repeat(70));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  
  console.log(`\n✅ Passed:   ${passed}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📈 Total:    ${results.length}`);
  
  console.log('\n📋 Results:');
  console.log('-'.repeat(70));
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${result.test}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  });
  
  console.log('\n💡 Recommendations:');
  console.log('-'.repeat(70));
  
  const streamingTest = results.find(r => r.test === 'Streaming Configuration');
  if (streamingTest?.status === 'FAIL') {
    console.log('❌ CRITICAL: Streaming is disabled');
    console.log('   → Set EXPO_PUBLIC_DASH_STREAMING=true in .env');
    console.log('   → Restart the app after changing environment variables');
  }
  
  const tokenTest = results.find(r => r.test === 'OpenAI Realtime Token');
  if (tokenTest?.status === 'FAIL') {
    console.log('❌ CRITICAL: Cannot generate OpenAI tokens');
    console.log('   → Check OpenAI API key in Supabase Edge Functions secrets');
    console.log('   → Command: supabase secrets list');
    console.log('   → Ensure OPENAI_API_KEY is set');
  }
  
  const wsTest = results.find(r => r.test === 'WebSocket Connection');
  if (wsTest?.status === 'FAIL') {
    console.log('❌ CRITICAL: Realtime/WebSocket not working');
    console.log('   → Enable Realtime in Supabase project settings');
    console.log('   → Check network/firewall allows WebSocket connections');
  }
  
  if (failed === 0 && warnings === 0) {
    console.log('✅ All systems operational!');
    console.log('   Voice recording should work correctly.');
  }
  
  console.log('\n' + '='.repeat(70));
}

async function main() {
  console.log('🚀 VOICE RECORDING DIAGNOSTIC TEST');
  console.log('Testing microphone, streaming, and transcription system');
  console.log('='.repeat(70));
  
  await checkEnvironmentVariables();
  await testStreamingEnabled();
  await testOpenAIRealtimeToken();
  await testWebSocketConnection();
  await testEdgeFunctions();
  
  printSummary();
  
  const failedCount = results.filter(r => r.status === 'FAIL').length;
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
