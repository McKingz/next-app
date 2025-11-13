/**
 * Native Biometrics Wrapper
 * 
 * Uses expo-local-authentication for biometric authentication on iOS/Android
 */

import * as LocalAuthentication from 'expo-local-authentication';

export const biometrics = {
  isAvailable: async (): Promise<boolean> => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  },

  authenticate: async (
    promptMessage: string = 'Authenticate'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      return {
        success: result.success,
        error: result.success ? undefined : result.error || 'Authentication failed',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Authentication error',
      };
    }
  },
};
