/**
 * Test script for crypto utilities
 * 
 * Run this to test crypto functionality in React Native
 */

import { 
  getRandomBytes, 
  generateSecureToken, 
  generateUUID, 
  getCryptoInfo, 
  isSecureCryptoAvailable 
} from './crypto';

export async function testCryptoFunctionality() {
  console.log('🔐 Testing Crypto Functionality');
  console.log('===============================');

  try {
    // Test 1: Check crypto availability
    console.log('\n1️⃣ Checking Crypto Availability...');
    const cryptoInfo = getCryptoInfo();
    console.log('Crypto Info:', cryptoInfo);
    console.log('Secure Crypto Available:', isSecureCryptoAvailable());

    // Test 2: Generate random bytes
    console.log('\n2️⃣ Testing Random Byte Generation...');
    const randomBytes = await getRandomBytes(16);
    console.log('Random Bytes (16):', Array.from(randomBytes).join(', '));
    console.log('Random Bytes as Hex:', Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join(''));

    // Test 3: Generate secure token
    console.log('\n3️⃣ Testing Secure Token Generation...');
    const token1 = await generateSecureToken(32);
    const token2 = await generateSecureToken(32);
    console.log('Token 1 (32 bytes):', token1);
    console.log('Token 2 (32 bytes):', token2);
    console.log('Tokens are different:', token1 !== token2);
    console.log('Token 1 length:', token1.length);

    // Test 4: Generate UUID
    console.log('\n4️⃣ Testing UUID Generation...');
    const uuid1 = await generateUUID();
    const uuid2 = await generateUUID();
    console.log('UUID 1:', uuid1);
    console.log('UUID 2:', uuid2);
    console.log('UUIDs are different:', uuid1 !== uuid2);
    console.log('UUID format valid:', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid1));

    // Test 5: Performance test
    console.log('\n5️⃣ Performance Test...');
    const startTime = Date.now();
    const tokens = await Promise.all(Array(10).fill(0).map(() => generateSecureToken(16)));
    const endTime = Date.now();
    console.log(`Generated 10 tokens in ${endTime - startTime}ms`);
    console.log('All tokens unique:', new Set(tokens).size === tokens.length);

    console.log('\n✅ All crypto tests completed successfully!');

  } catch (error) {
    console.error('❌ Crypto test failed:', error);
  }
}

// For easy console testing
export default testCryptoFunctionality;