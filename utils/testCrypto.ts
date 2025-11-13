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
import { logger } from '@/lib/logger';

export async function testCryptoFunctionality() {
  logger.info('🔐 Testing Crypto Functionality');
  logger.info('===============================');

  try {
    // Test 1: Check crypto availability
    logger.info('\n1️⃣ Checking Crypto Availability...');
    const cryptoInfo = getCryptoInfo();
    logger.info('Crypto Info:', cryptoInfo);
    logger.info('Secure Crypto Available:', isSecureCryptoAvailable());

    // Test 2: Generate random bytes
    logger.info('\n2️⃣ Testing Random Byte Generation...');
    const randomBytes = await getRandomBytes(16);
    logger.info('Random Bytes (16):', Array.from(randomBytes).join(', '));
    logger.info('Random Bytes as Hex:', Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join(''));

    // Test 3: Generate secure token
    logger.info('\n3️⃣ Testing Secure Token Generation...');
    const token1 = await generateSecureToken(32);
    const token2 = await generateSecureToken(32);
    logger.info('Token 1 (32 bytes):', token1);
    logger.info('Token 2 (32 bytes):', token2);
    logger.info('Tokens are different:', token1 !== token2);
    logger.info('Token 1 length:', token1.length);

    // Test 4: Generate UUID
    logger.info('\n4️⃣ Testing UUID Generation...');
    const uuid1 = await generateUUID();
    const uuid2 = await generateUUID();
    logger.info('UUID 1:', uuid1);
    logger.info('UUID 2:', uuid2);
    logger.info('UUIDs are different:', uuid1 !== uuid2);
    logger.info('UUID format valid:', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid1));

    // Test 5: Performance test
    logger.info('\n5️⃣ Performance Test...');
    const startTime = Date.now();
    const tokens = await Promise.all(Array(10).fill(0).map(() => generateSecureToken(16)));
    const endTime = Date.now();
    logger.info(`Generated 10 tokens in ${endTime - startTime}ms`);
    logger.info('All tokens unique:', new Set(tokens).size === tokens.length);

    logger.info('\n✅ All crypto tests completed successfully!');

  } catch (error) {
    console.error('❌ Crypto test failed:', error);
  }
}

// For easy console testing
export default testCryptoFunctionality;