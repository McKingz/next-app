#!/usr/bin/env node

// Simple test script for phone utilities
const { convertToE164, formatAsUserTypes, validatePhoneNumber, formatForDisplay } = require('./lib/utils/phoneUtils.ts');

console.log('🔢 Testing Phone Number Utilities\n');

const testNumbers = [
  '0821234567',
  '082 123 4567', 
  '27821234567',
  '+27821234567',
  '821234567',
  '0611234567',
  '061 123 4567',
  '0791234567',
  '079 123 4567',
  // Invalid cases
  '1234567',
  '012345678901',
  '0921234567', // Invalid prefix
  '+1234567890',
];

console.log('Testing E.164 Conversion:');
console.log('------------------------');
testNumbers.forEach(number => {
  const result = convertToE164(number);
  console.log(`${number.padEnd(15)} -> ${result.isValid ? `✅ ${result.e164} (${result.formatted})` : `❌ ${result.error}`}`);
});

console.log('\nTesting Format As User Types:');
console.log('-----------------------------');
const typingTests = [
  '0', '08', '082', '0821', '08212', '082123', '0821234', '08212345', '082123456', '0821234567'
];
typingTests.forEach(partial => {
  const formatted = formatAsUserTypes(partial);
  console.log(`${partial.padEnd(10)} -> ${formatted}`);
});

console.log('\nTesting Validation:');
console.log('-------------------');
testNumbers.forEach(number => {
  const validation = validatePhoneNumber(number);
  console.log(`${number.padEnd(15)} -> ${validation.isValid ? '✅ Valid' : `❌ ${validation.message}`}`);
});

console.log('\n✅ Phone utilities test complete!');