#!/usr/bin/env tsx
/**
 * Enable Wake Word Detection
 * 
 * This script enables the wake word detection feature by setting
 * the required AsyncStorage value.
 * 
 * Run with: npx tsx scripts/enable-wake-word.ts
 */

console.log('📱 Wake Word Enabler');
console.log('====================\n');

console.log('To enable wake word detection in your app:');
console.log('');
console.log('Option 1: Via Dash Settings Screen');
console.log('  1. Open the app');
console.log('  2. Go to Settings → Dash AI Settings');
console.log('  3. Toggle "In-App Wake Word" to ON');
console.log('');
console.log('Option 2: Programmatically (for testing)');
console.log('  Run this in your app console:');
console.log('  ```javascript');
console.log('  AsyncStorage.setItem("@dash_ai_in_app_wake_word", "true");');
console.log('  ```');
console.log('');
console.log('Option 3: Via ADB (Android)');
console.log('  adb shell "run-as com.edudashpro sh -c \'cd /data/data/com.edudashpro/files && echo true > @dash_ai_in_app_wake_word\'"');
console.log('');
console.log('✅ After enabling:');
console.log('  - Restart the app');
console.log('  - Say "Hello Dash" to trigger Dash Assistant');
console.log('  - Check logs for "[DashWakeWord]" messages');
console.log('');
console.log('🔍 Debug logs to watch for:');
console.log('  ✅ "[DashWakeWord] PorcupineManager initialized successfully"');
console.log('  ✅ "[DashWakeWord] Wake word listening started successfully"');
console.log('  ✅ "[DashWakeWord] Listening for Hello Dash..."');
console.log('  🎉 "[DashWakeWord] Wake word Hello Dash detected!"');
console.log('');
console.log('⚠️ Troubleshooting:');
console.log('  - Ensure preview build includes native Porcupine module');
console.log('  - Check EXPO_PUBLIC_PICOVOICE_ACCESS_KEY is set in .env');
console.log('  - Verify microphone permissions granted');
console.log('  - Model files exist in assets/wake-words/');
console.log('');