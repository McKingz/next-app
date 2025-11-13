/**
 * Web stub for BiometricAuthService
 * Biometric authentication not available on web, all methods return disabled state
 */

export class BiometricAuthService {
  static async checkCapabilities() {
    return {
      isAvailable: false,
      isEnrolled: false,
      supportedTypes: [],
      securityLevel: 'weak' as const,
    };
  }

  static getBiometricTypeName(_type: any): string {
    return 'Biometric';
  }

  static async getAvailableBiometricOptions(): Promise<string[]> {
    return [];
  }

  static async isLockedOut(): Promise<boolean> {
    return false;
  }

  static async getSecurityState() {
    return { failedAttempts: 0 };
  }

  static async updateSecurityState(_success: boolean): Promise<void> {
    // No-op on web
  }

  static async generateSecurityToken(): Promise<string> {
    return `web-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  static async authenticate(_reason?: string) {
    return {
      success: false,
      error: 'Biometric authentication not available on web',
    };
  }

  static async isBiometricEnabled() {
    return false;
  }

  static async enableBiometric() {
    console.warn('[Web] Biometric authentication not supported on web');
    return false;
  }

  static async disableBiometric(): Promise<void> {
    // No-op on web
  }

  static async getStoredBiometricData(): Promise<null> {
    return null;
  }

  static async promptBiometricSetup() {
    return false;
  }

  static async attemptBiometricLogin(): Promise<null> {
    return null;
  }

  static async getSecurityInfo() {
    return {
      capabilities: {
        isAvailable: false,
        isEnrolled: false,
        supportedTypes: [],
        securityLevel: 'weak' as const,
      },
      isEnabled: false,
      availableTypes: [],
    };
  }

  static async getLastUnlockedAt(): Promise<number | null> {
    return null;
  }

  static async setLastUnlockedAt(_ts: number): Promise<void> {
    // No-op on web
  }

  static async shouldGate(_opts: { hasSession: boolean; graceMs: number }): Promise<boolean> {
    return false;
  }
}

export default BiometricAuthService;
