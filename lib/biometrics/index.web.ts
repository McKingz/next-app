/**
 * Web Biometrics Stub
 * 
 * Biometric authentication is not supported on web browsers.
 * This stub returns unavailable/unsupported responses.
 */

export const biometrics = {
  isAvailable: async (): Promise<boolean> => {
    return false;
  },

  authenticate: async (_promptMessage?: string): Promise<{ success: boolean; error?: string }> => {
    return {
      success: false,
      error: 'Biometric authentication is not supported on web platforms',
    };
  },
};
