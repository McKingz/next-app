/**
 * Web stub for expo-local-authentication
 * Biometric authentication is not available on web
 */

export const authenticateAsync = async () => ({
  success: false,
  error: 'Biometric authentication not available on web',
});

export const hasHardwareAsync = async () => false;

export const isEnrolledAsync = async () => false;

export const supportedAuthenticationTypesAsync = async () => [];

export const getEnrolledLevelAsync = async () => 0;

export const SecurityLevel = {
  NONE: 0,
  SECRET: 1,
  BIOMETRIC: 2,
};

export const AuthenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
  IRIS: 3,
};

export default {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
  getEnrolledLevelAsync,
  SecurityLevel,
  AuthenticationType,
};
