// Deprecated shim: prefer services/BiometricAuthService for all biometric logic
import { BiometricAuthService } from "@/services/BiometricAuthService";
import * as LocalAuthentication from "expo-local-authentication";

const CACHE_DURATION = 30000; // kept for API compatibility (no-op here)

let capabilityCache: { isAvailable: boolean; isEnrolled: boolean; timestamp: number } | null = null;

async function getCapabilities(): Promise<{ isAvailable: boolean; isEnrolled: boolean; }> {
  const now = Date.now();

  // Return cached result if still valid
  if (capabilityCache && now - capabilityCache.timestamp < CACHE_DURATION) {
    console.log('Using cached biometric capabilities:', capabilityCache);
    return {
      isAvailable: capabilityCache.isAvailable,
      isEnrolled: capabilityCache.isEnrolled,
    };
  }

  // Fetch new capabilities via unified service
  try {
    const caps = await BiometricAuthService.checkCapabilities();
    capabilityCache = {
      isAvailable: caps.isAvailable,
      isEnrolled: caps.isEnrolled,
      timestamp: now,
    };
    return { isAvailable: caps.isAvailable, isEnrolled: caps.isEnrolled };
  } catch (error) {
    console.warn("Failed to check biometric capabilities:", error);
    return { isAvailable: false, isEnrolled: false };
  }
}

export async function isHardwareAvailable(): Promise<boolean> {
  const { isAvailable } = await getCapabilities();
  return isAvailable;
}

export async function isEnrolled(): Promise<boolean> {
  const { isEnrolled } = await getCapabilities();
  return isEnrolled;
}

export async function getEnabled(): Promise<boolean> {
  return BiometricAuthService.isBiometricEnabled();
}

export async function setEnabled(enabled: boolean): Promise<void> {
  // No-op here to avoid diverging sources; callers should use BiometricAuthService.enable/disable
  if (enabled) {
    console.warn('[Deprecated] Use BiometricAuthService.enableBiometric to enable biometrics');
  } else {
    console.warn('[Deprecated] Use BiometricAuthService.disableBiometric to disable biometrics');
  }
}

export async function authenticate(
  reason = "Unlock EduDash Pro",
): Promise<boolean> {
  try {
    const { isAvailable, isEnrolled } = await getCapabilities();
    if (!isAvailable || !isEnrolled) return false;
    const res = await BiometricAuthService.authenticate(reason);
    return !!res.success;
  } catch (error) {
    console.error("Biometric authentication error:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
    return false;
  }
}

export async function promptIfEnabled(): Promise<boolean> {
  try {
    const { isAvailable, isEnrolled } = await getCapabilities();
    const enabled = await getEnabled();
    if (!enabled || !isAvailable || !isEnrolled) return true;
    const ok = await authenticate();
    return ok;
  } catch (error) {
    console.warn("Error in promptIfEnabled:", error);
    return true; // Default to allowing access if there's an error
  }
}

/**
 * Clear the capability cache (useful for testing or when settings change)
 */
export function clearCapabilityCache(): void {
  capabilityCache = null;
}

/**
 * Get detailed biometric information
 */
export async function getBiometricInfo(): Promise<{
  isAvailable: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  securityLevel: LocalAuthentication.SecurityLevel | null;
}> {
  try {
    const { isAvailable, isEnrolled } = await getCapabilities();
    let supportedTypes: LocalAuthentication.AuthenticationType[] = [];
    let securityLevel: LocalAuthentication.SecurityLevel | null = null;

    if (isAvailable) {
      supportedTypes =
        await LocalAuthentication.supportedAuthenticationTypesAsync();
      securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
    }

    return {
      isAvailable,
      isEnrolled,
      supportedTypes,
      securityLevel,
    };
  } catch (error) {
    console.warn("Error getting biometric info:", error);
    return {
      isAvailable: false,
      isEnrolled: false,
      supportedTypes: [],
      securityLevel: null,
    };
  }
}
