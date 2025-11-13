import { router } from 'expo-router';
import { signOut } from '@/lib/sessionManager';
import { Platform } from 'react-native';

// Prevent duplicate sign-out calls
let isSigningOut = false;

/**
 * Complete sign-out: clears session, storage, and navigates to sign-in
 * This ensures all auth state is properly cleaned up
 */
export async function signOutAndRedirect(optionsOrEvent?: { clearBiometrics?: boolean; redirectTo?: string } | any): Promise<void> {
  if (isSigningOut) {
    console.log('[authActions] Sign-out already in progress, skipping...');
    return;
  }
  isSigningOut = true;
  
  // If invoked as onPress handler, first argument will be an event; ignore it
  const options = (optionsOrEvent && typeof optionsOrEvent === 'object' && (
    Object.prototype.hasOwnProperty.call(optionsOrEvent, 'clearBiometrics') ||
    Object.prototype.hasOwnProperty.call(optionsOrEvent, 'redirectTo')
  )) ? (optionsOrEvent as { clearBiometrics?: boolean; redirectTo?: string }) : undefined;

  const targetRoute = options?.redirectTo ?? '/(auth)/sign-in';
  
  try {
    // First, perform complete sign-out (clears Supabase session + storage)
    console.log('[authActions] Performing complete sign-out...');
    await signOut();
    console.log('[authActions] Sign-out successful');
    
    // Then navigate to sign-in
    console.log('[authActions] Navigating to:', targetRoute);
    
    // Web-specific: use location.replace to clear history
    if (Platform.OS === 'web') {
      try {
        const w = globalThis as any;
        if (w?.location) {
          w.location.replace(targetRoute);
          console.log('[authActions] Browser history cleared and navigated');
        } else {
          router.replace(targetRoute);
        }
      } catch (historyErr) {
        console.warn('[authActions] Browser history clear failed:', historyErr);
        router.replace(targetRoute);
      }
    } else {
      // Mobile: use router.replace
      router.replace(targetRoute);
    }
  } catch (error) {
    console.error('[authActions] Sign-out failed:', error);
    
    // Even on error, try to navigate to sign-in
    try {
      if (Platform.OS === 'web') {
        const w = globalThis as any;
        if (w?.location) {
          w.location.replace(targetRoute);
        } else {
          router.replace(targetRoute);
        }
      } else {
        router.replace(targetRoute);
      }
    } catch (navError) {
      console.error('[authActions] Navigation failed:', navError);
      // Try fallback routes
      try { router.replace('/(auth)/sign-in'); } catch { /* Intentional: non-fatal */ }
      try { router.replace('/sign-in'); } catch { /* Intentional: non-fatal */ }
    }
  } finally {
    // Reset flag after a short delay
    setTimeout(() => {
      isSigningOut = false;
    }, 100);
  }
}

