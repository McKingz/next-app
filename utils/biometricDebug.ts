import { logger } from '@/lib/logger';
/**
 * Biometric Debug Utility
 * 
 * Helps diagnose biometric authentication issues on different Android devices,
 * particularly useful for debugging OppoA40 fingerprint detection problems.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import BiometricAuthService from '../services/BiometricAuthService';

export interface BiometricDebugInfo {
  deviceInfo: {
    brand?: string | null;
    modelName?: string | null;
    osName?: string | null;
    osVersion?: string | null;
    platform: string;
  };
  capabilities: {
    hasHardware: boolean;
    supportedTypes: LocalAuthentication.AuthenticationType[];
    isEnrolled: boolean;
    securityLevel?: LocalAuthentication.SecurityLevel | null;
  };
  detailedTypes: {
    [key: number]: string;
  };
  recommendations: string[];
  potentialIssues: string[];
}

export class BiometricDebugger {
  /**
   * Get comprehensive debug information about biometric capabilities
   */
  static async getDebugInfo(): Promise<BiometricDebugInfo> {
    const deviceInfo = {
      brand: Device.brand,
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      platform: Platform.OS,
    };

    // Get basic capabilities
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    let securityLevel: LocalAuthentication.SecurityLevel | null = null;
    try {
      securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
    } catch (error) {
      logger.warn('Could not get security level:', error);
    }

    const capabilities = {
      hasHardware,
      supportedTypes,
      isEnrolled,
      securityLevel,
    };

    // Map authentication types to readable names
    const detailedTypes: { [key: number]: string } = {};
    supportedTypes.forEach(type => {
      switch (type) {
        case LocalAuthentication.AuthenticationType.FINGERPRINT:
          detailedTypes[type] = 'FINGERPRINT';
          break;
        case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
          detailedTypes[type] = 'FACIAL_RECOGNITION';
          break;
        case LocalAuthentication.AuthenticationType.IRIS:
          detailedTypes[type] = 'IRIS';
          break;
        default:
          detailedTypes[type] = `UNKNOWN_TYPE_${type}`;
      }
    });

    const recommendations = this.generateRecommendations(deviceInfo, capabilities);
    const potentialIssues = this.identifyPotentialIssues(deviceInfo, capabilities);

    return {
      deviceInfo,
      capabilities,
      detailedTypes,
      recommendations,
      potentialIssues,
    };
  }

  /**
   * Generate recommendations based on device and capability analysis
   */
  private static generateRecommendations(
    deviceInfo: BiometricDebugInfo['deviceInfo'],
    capabilities: BiometricDebugInfo['capabilities']
  ): string[] {
    const recommendations: string[] = [];

    // Device-specific recommendations
    if (deviceInfo.brand?.toLowerCase().includes('oppo')) {
      recommendations.push('OPPO device detected - use BIOMETRIC_WEAK security level for better compatibility');
      
      if (deviceInfo.modelName?.toLowerCase().includes('a40')) {
        recommendations.push('OppoA40 detected - fingerprint sensor should be available, check device settings');
      }
    }

    // Capability-based recommendations
    if (!capabilities.hasHardware) {
      recommendations.push('No biometric hardware detected - check device specifications');
    } else if (!capabilities.isEnrolled) {
      recommendations.push('Biometric hardware available but no biometrics enrolled - user needs to set up biometrics in device settings');
    } else if (capabilities.supportedTypes.length === 0) {
      recommendations.push('Hardware available and enrolled but no supported types detected - possible API compatibility issue');
    }

    // Security level recommendations
    if (capabilities.securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK) {
      recommendations.push('Device supports WEAK biometric security - acceptable for most use cases');
    } else if (capabilities.securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) {
      recommendations.push('Device supports STRONG biometric security - best security level');
    } else if (capabilities.securityLevel === null) {
      recommendations.push('Could not determine security level - use permissive authentication options');
    }

    // Platform-specific recommendations
    if (deviceInfo.platform === 'android') {
      recommendations.push('Android device - use disableDeviceFallback: false for better compatibility');
      recommendations.push('Consider using BIOMETRIC_WEAK security level if STRONG fails');
    }

    return recommendations;
  }

  /**
   * Identify potential issues based on device and capability analysis
   */
  private static identifyPotentialIssues(
    deviceInfo: BiometricDebugInfo['deviceInfo'],
    capabilities: BiometricDebugInfo['capabilities']
  ): string[] {
    const issues: string[] = [];

    // Hardware vs enrollment mismatch
    if (capabilities.hasHardware && !capabilities.isEnrolled) {
      issues.push('Biometric hardware present but no biometrics enrolled by user');
    }

    // Enrollment vs supported types mismatch
    if (capabilities.isEnrolled && capabilities.supportedTypes.length === 0) {
      issues.push('Biometrics enrolled but no supported authentication types detected - possible API issue');
    }

    // OPPO-specific issues
    if (deviceInfo.brand?.toLowerCase().includes('oppo')) {
      if (capabilities.hasHardware && capabilities.isEnrolled && capabilities.supportedTypes.length === 0) {
        issues.push('OPPO device with enrolled biometrics but no supported types - known compatibility issue');
      }
    }

    // Security level issues
    if (capabilities.securityLevel === null && capabilities.isEnrolled) {
      issues.push('Cannot determine security level despite enrolled biometrics - may cause authentication failures');
    }

    // Android-specific issues
    if (deviceInfo.platform === 'android') {
      if (parseFloat(deviceInfo.osVersion || '0') < 6.0) {
        issues.push('Android version may be too old for reliable biometric authentication');
      }
    }

    return issues;
  }

  /**
   * Test biometric authentication with various configurations
   */
  static async testAuthentication(): Promise<{
    tests: Array<{
      name: string;
      config: any;
      success: boolean;
      error?: string;
      warning?: string;
    }>;
  }> {
    const tests = [];

    // Test 1: Default configuration
    try {
      const result1 = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Test Authentication - Default',
        cancelLabel: 'Cancel',
      });
      const err1 = (typeof (result1 as any)?.error === 'string') ? (result1 as any).error : undefined;
      const warn1 = (typeof (result1 as any)?.warning === 'string') ? (result1 as any).warning : undefined;
      tests.push({
        name: 'Default Configuration',
        config: { promptMessage: 'Test Authentication - Default' },
        success: result1.success,
        error: err1,
        warning: warn1,
      });
    } catch (error) {
      tests.push({
        name: 'Default Configuration',
        config: { promptMessage: 'Test Authentication - Default' },
        success: false,
        error: `Exception: ${error}`,
      });
    }

    // Test 2: Permissive configuration
    try {
      const result2 = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Test Authentication - Permissive',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        requireConfirmation: false,
      });
      const err2 = (typeof (result2 as any)?.error === 'string') ? (result2 as any).error : undefined;
      const warn2 = (typeof (result2 as any)?.warning === 'string') ? (result2 as any).warning : undefined;
      tests.push({
        name: 'Permissive Configuration',
        config: { 
          disableDeviceFallback: false,
          requireConfirmation: false,
        },
        success: result2.success,
        error: err2,
        warning: warn2,
      });
    } catch (error) {
      tests.push({
        name: 'Permissive Configuration',
        config: { 
          disableDeviceFallback: false,
          requireConfirmation: false,
        },
        success: false,
        error: `Exception: ${error}`,
      });
    }

    // Test 3: Without security level (for OPPO compatibility)
    try {
      const result3 = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Test Authentication - No Security Level',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        requireConfirmation: false,
        // Skip biometricsSecurityLevel to avoid casting issues on some Android devices
      });
      const err3 = (typeof (result3 as any)?.error === 'string') ? (result3 as any).error : undefined;
      const warn3 = (typeof (result3 as any)?.warning === 'string') ? (result3 as any).warning : undefined;
      tests.push({
        name: 'No Security Level (OPPO Compatible)',
        config: { 
          note: 'Skips biometricsSecurityLevel to avoid casting issues',
        },
        success: result3.success,
        error: err3,
        warning: warn3,
      });
    } catch (error) {
      tests.push({
        name: 'No Security Level (OPPO Compatible)',
        config: { 
          note: 'Skips biometricsSecurityLevel to avoid casting issues',
        },
        success: false,
        error: `Exception: ${error}`,
      });
    }

    return { tests };
  }

  /**
   * Generate a comprehensive debug report
   */
  static async generateReport(): Promise<string> {
    const debugInfo = await this.getDebugInfo();
    
    let report = '=== BIOMETRIC DEBUG REPORT ===\n\n';
    
    // Device Information
    report += 'DEVICE INFORMATION:\n';
    report += `Brand: ${debugInfo.deviceInfo.brand || 'Unknown'}\n`;
    report += `Model: ${debugInfo.deviceInfo.modelName || 'Unknown'}\n`;
    report += `OS: ${debugInfo.deviceInfo.osName} ${debugInfo.deviceInfo.osVersion}\n`;
    report += `Platform: ${debugInfo.deviceInfo.platform}\n\n`;
    
    // Capabilities
    report += 'BIOMETRIC CAPABILITIES:\n';
    report += `Has Hardware: ${debugInfo.capabilities.hasHardware}\n`;
    report += `Is Enrolled: ${debugInfo.capabilities.isEnrolled}\n`;
    report += `Security Level: ${debugInfo.capabilities.securityLevel || 'Unknown'}\n`;
    report += `Supported Types: [${Object.values(debugInfo.detailedTypes).join(', ')}]\n\n`;
    
    // EduDash Service Status
    try {
      const serviceInfo = await BiometricAuthService.getSecurityInfo();
      report += 'EDUDASH SERVICE STATUS:\n';
      report += `Service Available: ${serviceInfo.capabilities.isAvailable}\n`;
      report += `Service Enrolled: ${serviceInfo.capabilities.isEnrolled}\n`;
      report += `Service Enabled: ${serviceInfo.isEnabled}\n`;
      report += `Available Types: [${serviceInfo.availableTypes.join(', ')}]\n\n`;
    } catch (error) {
      report += 'EDUDASH SERVICE STATUS:\n';
      report += `Error getting service status: ${error}\n\n`;
    }
    
    // Issues
    if (debugInfo.potentialIssues.length > 0) {
      report += 'POTENTIAL ISSUES:\n';
      debugInfo.potentialIssues.forEach((issue, index) => {
        report += `${index + 1}. ${issue}\n`;
      });
      report += '\n';
    }
    
    // Recommendations
    if (debugInfo.recommendations.length > 0) {
      report += 'RECOMMENDATIONS:\n';
      debugInfo.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
      report += '\n';
    }
    
    report += '=== END REPORT ===';
    
    return report;
  }

  /**
   * Log debug information to console
   */
  static async logDebugInfo(): Promise<void> {
    logger.info('🔍 BIOMETRIC DEBUG INFO 🔍');
    
    const debugInfo = await this.getDebugInfo();
    logger.info('Device Info:', debugInfo.deviceInfo);
    logger.info('Capabilities:', debugInfo.capabilities);
    logger.info('Supported Types:', debugInfo.detailedTypes);
    logger.info('Potential Issues:', debugInfo.potentialIssues);
    logger.info('Recommendations:', debugInfo.recommendations);
    
    const report = await this.generateReport();
    logger.info('\n' + report);
  }
}

export default BiometricDebugger;