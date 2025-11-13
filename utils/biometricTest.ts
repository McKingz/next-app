/**
 * Biometric Testing Utility
 * 
 * Helper functions to test and debug biometric authentication functionality
 */

import { BiometricAuthService } from '@/services/BiometricAuthService';
// import { getBiometricInfo } from '@/lib/biometrics';

export interface BiometricTestResult {
  capabilities: {
    isAvailable: boolean;
    isEnrolled: boolean;
    supportedTypes: string[];
    securityLevel: string;
  };
  status: {
    isEnabled: boolean;
    lastUsed?: string;
  };
  tests: {
    name: string;
    passed: boolean;
    message: string;
  }[];
}

/**
 * Run comprehensive biometric tests
 */
export async function runBiometricTests(): Promise<BiometricTestResult> {
  const tests: BiometricTestResult['tests'] = [];
  
  try {
    // Test 1: Check hardware availability
    const capabilities = await BiometricAuthService.checkCapabilities();
    tests.push({
      name: 'Hardware Available',
      passed: capabilities.isAvailable,
      message: capabilities.isAvailable 
        ? 'Biometric hardware detected'
        : 'No biometric hardware found'
    });

    // Test 2: Check enrollment
    tests.push({
      name: 'Biometric Enrolled',
      passed: capabilities.isEnrolled,
      message: capabilities.isEnrolled
        ? 'Biometric data is enrolled on device'
        : 'No biometric data enrolled - setup required'
    });

    // Test 3: Check supported types
    const availableTypes = await BiometricAuthService.getAvailableBiometricOptions();
    tests.push({
      name: 'Supported Types',
      passed: availableTypes.length > 0,
      message: availableTypes.length > 0
        ? `Available: ${availableTypes.join(', ')}`
        : 'No biometric types available'
    });

    // Test 4: Check security level
    tests.push({
      name: 'Security Level',
      passed: capabilities.securityLevel === 'strong' || capabilities.supportedTypes.length > 0,
      message: `Security level: ${capabilities.securityLevel}`
    });

    // Test 5: Check current enabled status
    const isEnabled = await BiometricAuthService.isBiometricEnabled();
    tests.push({
      name: 'Currently Enabled',
      passed: true, // This is informational
      message: isEnabled ? 'Biometric login is enabled' : 'Biometric login is disabled'
    });

    // Get stored data for last used
    const storedData = await BiometricAuthService.getStoredBiometricData();
    
    return {
      capabilities: {
        isAvailable: capabilities.isAvailable,
        isEnrolled: capabilities.isEnrolled,
        supportedTypes: availableTypes,
        securityLevel: capabilities.securityLevel,
      },
      status: {
        isEnabled,
        lastUsed: storedData?.lastUsed,
      },
      tests,
    };

  } catch (error) {
    tests.push({
      name: 'Test Execution',
      passed: false,
      message: `Error running tests: ${error}`
    });

    return {
      capabilities: {
        isAvailable: false,
        isEnrolled: false,
        supportedTypes: [],
        securityLevel: 'unknown',
      },
      status: {
        isEnabled: false,
      },
      tests,
    };
  }
}

/**
 * Generate biometric diagnostic report
 */
export async function getBiometricDiagnostic(): Promise<string> {
  const result = await runBiometricTests();
  
  let report = '🔐 Biometric Authentication Diagnostic Report\n\n';
  
  // Capabilities
  report += '📋 Capabilities:\n';
  report += `  • Hardware Available: ${result.capabilities.isAvailable ? '✅' : '❌'}\n`;
  report += `  • Biometric Enrolled: ${result.capabilities.isEnrolled ? '✅' : '❌'}\n`;
  report += `  • Security Level: ${result.capabilities.securityLevel}\n`;
  report += `  • Supported Types: ${result.capabilities.supportedTypes.join(', ') || 'None'}\n\n`;
  
  // Current Status
  report += '🔒 Current Status:\n';
  report += `  • Enabled in App: ${result.status.isEnabled ? '✅' : '❌'}\n`;
  if (result.status.lastUsed) {
    report += `  • Last Used: ${new Date(result.status.lastUsed).toLocaleString()}\n`;
  }
  report += '\n';
  
  // Test Results
  report += '🧪 Test Results:\n';
  result.tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    report += `  ${status} ${test.name}: ${test.message}\n`;
  });
  
  // Recommendations
  report += '\n💡 Recommendations:\n';
  if (!result.capabilities.isAvailable) {
    report += '  • This device does not support biometric authentication\n';
  } else if (!result.capabilities.isEnrolled) {
    report += '  • Set up fingerprint or face recognition in device settings\n';
  } else if (!result.status.isEnabled) {
    report += '  • Enable biometric login in app settings for faster access\n';
  } else {
    report += '  • Biometric authentication is properly configured ✅\n';
  }
  
  return report;
}

/**
 * Quick fingerprint availability check
 */
export async function isFingerprintAvailable(): Promise<boolean> {
  try {
    const capabilities = await BiometricAuthService.checkCapabilities();
    const availableTypes = await BiometricAuthService.getAvailableBiometricOptions();
    
    return capabilities.isAvailable && 
           capabilities.isEnrolled && 
           availableTypes.some(type => type.toLowerCase().includes('fingerprint'));
  } catch {
    return false;
  }
}

/**
 * Test biometric authentication without storing credentials
 */
export async function testBiometricAuth(): Promise<{ success: boolean; message: string }> {
  try {
    const result = await BiometricAuthService.authenticate('Test biometric authentication');
    
    if (result.success) {
      return {
        success: true,
        message: `Authentication successful using ${result.biometricType || 'biometric'} authentication`
      };
    } else {
      return {
        success: false,
        message: result.error || 'Authentication failed'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Test failed: ${error}`
    };
  }
}