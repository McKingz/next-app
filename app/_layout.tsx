import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, LogBox } from 'react-native';
// Initialize i18n globally (web + native)
import '@/lib/i18n';

// Suppress known dev warnings
if (__DEV__) {
  LogBox.ignoreLogs([
    'shadow* style props are deprecated',
    'textShadow* style props are deprecated',
    'props.pointerEvents is deprecated',
    '[expo-av]: Expo AV has been deprecated',
    'Require cycle:', // Suppress circular dependency warnings in dev
  ]);
}
import { StatusBar } from 'expo-status-bar';
import { Stack, usePathname } from 'expo-router';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import ToastProvider from '@/components/ui/ToastProvider';
import { QueryProvider } from '@/lib/query/queryClient';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DashboardPreferencesProvider } from '@/contexts/DashboardPreferencesContext';
import { UpdatesProvider } from '@/contexts/UpdatesProvider';
import { TermsProvider } from '@/contexts/TerminologyContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DashWakeWordListener from '@/components/ai/DashWakeWordListener';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import { DashChatButton } from '@/components/ui/DashChatButton';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';

// Extracted utilities and hooks (WARP.md refactoring)
import { useAuthGuard, useMobileWebGuard } from '@/hooks/useRouteGuard';
import { useFABVisibility } from '@/hooks/useFABVisibility';
import { setupPWAMetaTags } from '@/lib/utils/pwa';
import { injectWebStyles } from '@/lib/utils/web-styles';

// Inner component with access to AuthContext
function LayoutContent() {
  const pathname = usePathname();
  const { loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const [showFAB, setShowFAB] = useState(false);
  const [statusBarKey, setStatusBarKey] = useState(0);
  
  // Route guards (auth + mobile web)
  useAuthGuard();
  useMobileWebGuard();
  
  // Force StatusBar re-render when theme changes
  useEffect(() => {
    setStatusBarKey((prev) => prev + 1);
  }, [isDark]);
  
  // FAB visibility logic
  const { shouldHideFAB } = useFABVisibility(pathname);
  
  // Determine if on auth route for FAB delay logic
  const isAuthRoute =
    typeof pathname === 'string' &&
    (pathname.startsWith('/(auth)') ||
      pathname === '/sign-in' ||
      pathname === '/(auth)/sign-in' ||
      pathname === '/landing' ||
      pathname === '/' ||
      pathname.includes('auth-callback'));
  
  // Show FAB after auth loads and brief delay
  useEffect(() => {
    if (!authLoading && !isAuthRoute) {
      const timer = setTimeout(() => setShowFAB(true), 800);
      return () => clearTimeout(timer);
    } else {
      setShowFAB(false);
    }
  }, [authLoading, isAuthRoute]);
  
  return (
    <View style={styles.container}>
      <StatusBar key={statusBarKey} style={isDark ? 'light' : 'dark'} animated />
      {Platform.OS !== 'web' && <DashWakeWordListener />}
      
      {/* Main content area - leave space for bottom nav */}
      <View style={styles.contentContainer}>
        <Stack
          screenOptions={{
            headerShown: false,
            presentation: 'card',
            animationTypeForReplace: 'push',
          }}
        >
          {/* Let Expo Router auto-discover screens */}
        </Stack>
      </View>
      
      {/* Dash Chat FAB - temporarily hidden per user request */}
      {/* {showFAB && !shouldHideFAB && (
        <DashChatButton />
      )} */}
      
      {/* Persistent Bottom Navigation - positioned at bottom */}
      <BottomTabBar />
    </View>
  );
}

export default function RootLayout() {
  if (__DEV__) console.log('[RootLayout] Rendering...');
  
  // Setup PWA meta tags on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      setupPWAMetaTags();
    }
  }, []);
  
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <ThemeProvider>
          <AuthProvider>
            <OnboardingProvider>
              <DashboardPreferencesProvider>
                <TermsProvider>
                  <ToastProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <RootLayoutContent />
                    </GestureHandlerRootView>
                  </ToastProvider>
                </TermsProvider>
              </DashboardPreferencesProvider>
            </OnboardingProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutContent() {
  const [dashInstance, setDashInstance] = useState<IDashAIAssistant | null>(null);
  const { session } = useAuth();
  
  if (__DEV__) console.log('[RootLayoutContent] Rendering...');
  
  // Register service worker for PWA (web-only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const w = globalThis as any;
    const n = w?.navigator;
    
    if (n?.serviceWorker) {
      n.serviceWorker
        .register('/sw.js')
        .then((registration: any) => {
          console.log('[PWA] Service worker registered:', registration.scope);
        })
        .catch((error: Error) => {
          console.warn('[PWA] Service worker registration failed:', error);
        });
    } else {
      console.log('[PWA] Service workers not supported in this browser');
    }
  }, []);
  
  // Initialize Dash AI Assistant at root level and sync context
  useEffect(() => {
    // Skip Dash AI on web platform
    if (Platform.OS === 'web') {
      console.log('[RootLayoutContent] Skipping Dash AI on web');
      return;
    }
    
    // Skip initialization if no session (unauthenticated)
    if (!session) {
      return;
    }
    
    (async () => {
      try {
        const module = await import('@/services/dash-ai/DashAICompat');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash: IDashAIAssistant | null = DashClass?.getInstance?.() || null;
        if (dash) {
          await dash.initialize();
          setDashInstance(dash);
          // Best-effort: sync Dash user context (language, traits)
          // Only call Edge Functions when authenticated
          try {
            const { getCurrentLanguage } = await import('@/lib/i18n');
            const { syncDashContext } = await import('@/lib/agent/dashContextSync');
            const { getAgenticCapabilities } = await import('@/lib/utils/agentic-mode');
            const { getCurrentProfile } = await import('@/lib/sessionManager');
            const profile = await getCurrentProfile().catch(() => null as any);
            const role = profile?.role as string | undefined;
            const caps = getAgenticCapabilities(role);
            await syncDashContext({ language: getCurrentLanguage(), traits: { agentic: caps, role: role || null } });
          } catch (syncErr) {
            if (__DEV__) console.warn('[RootLayout] dash-context-sync skipped:', syncErr);
          }
        }
      } catch (e) {
        console.error('[RootLayout] Failed to initialize Dash:', e);
      }
    })();
  }, [session]); // Re-run when session changes
  
  // Inject web-specific styles (Expo dev nav hiding, full viewport height)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const cleanup = injectWebStyles();
      return cleanup;
    }
  }, []);
  
  return <LayoutContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    flex: 1,
  },
});
