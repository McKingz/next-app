import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  
  useEffect(() => {
    // Gather debug information
    const gatherDebugInfo = () => {
      try {
        const canGo = typeof router.canGoBack === 'function' ? router.canGoBack() : false;
        setCanGoBack(canGo);
        
        const info = {
          pathname,
          segments,
          canGoBack: canGo,
          userRole: profile?.role || 'unknown',
          isAuthenticated: !!user,
          windowLocation: typeof window !== 'undefined' ? window.location.href : 'N/A',
          timestamp: new Date().toISOString(),
        };
        
        setDebugInfo(info);
        
        if (__DEV__) {
          console.warn('🚨 [NOT-FOUND] Unmatched route detected:', info);
        }
      } catch (error) {
        console.error('🚨 [NOT-FOUND] Error gathering debug info:', error);
      }
    };
    
    gatherDebugInfo();
  }, [pathname, segments, user, profile, router]);
  
  // Smart fallback navigation based on user state
  const getSmartFallback = () => {
    if (!user) return '/';
    
    // Route based on user role
    switch (profile?.role) {
      case 'super_admin':
        return '/screens/super-admin-dashboard';
      case 'principal_admin':
        return '/screens/principal-dashboard';
      case 'teacher':
        return '/screens/teacher-dashboard';
      case 'parent':
        return '/screens/parent-dashboard';
      default:
        return '/';
    }
  };

  const handleSmartBack = () => {
    try {
      if (canGoBack) {
        router.back();
      } else {
        const fallback = getSmartFallback();
        router.replace(fallback as any);
      }
    } catch (error) {
      console.error('Smart back navigation failed:', error);
      router.replace('/');
    }
  };

  const handleGoToDashboard = () => {
    const fallback = getSmartFallback();
    router.replace(fallback as any);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('not_found.title', { defaultValue: 'Route Not Found' }), headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="warning" size={64} color="#ff6b6b" />
          <Text style={styles.title}>{t('not_found.title', { defaultValue: 'Route Not Found' })}</Text>
          <Text style={styles.subtitle}>{t('not_found.subtitle', { defaultValue: "The requested page doesn't exist in the app." })}</Text>
        </View>

        {/* Navigation Options */}
        <View style={styles.actions}>
          {canGoBack ? (
            <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleSmartBack}>
              <Ionicons name="arrow-back" size={20} color="#000" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>{t('navigation.back', { defaultValue: 'Back' })}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleGoToDashboard}>
              <Ionicons name="home" size={20} color="#000" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>{t('not_found.go_to_dashboard', { defaultValue: 'Go to Dashboard' })}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => router.replace('/')}>
            <Ionicons name="planet" size={20} color="#00f5ff" style={styles.buttonIcon} />
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>{t('not_found.go_to_home', { defaultValue: 'Go to Home' })}</Text>
          </TouchableOpacity>
        </View>

        {/* Debug Information (Development Only) */}
        {__DEV__ && debugInfo && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>{t('not_found.debug.title', { defaultValue: 'Debug Information' })}</Text>
            <View style={styles.debugCard}>
              <Text style={styles.debugInfo}>{t('not_found.debug.path', { defaultValue: 'Path' })}: {debugInfo.pathname}</Text>
              <Text style={styles.debugInfo}>{t('not_found.debug.user_role', { defaultValue: 'User Role' })}: {debugInfo.userRole}</Text>
              <Text style={styles.debugInfo}>{t('not_found.debug.authenticated', { defaultValue: 'Authenticated' })}: {debugInfo.isAuthenticated ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })}</Text>
              <Text style={styles.debugInfo}>{t('not_found.debug.can_go_back', { defaultValue: 'Can Go Back' })}: {debugInfo.canGoBack ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })}</Text>
              <Text style={styles.debugInfo}>{t('not_found.debug.segments', { defaultValue: 'Segments' })}: {JSON.stringify(debugInfo.segments)}</Text>
              <Text style={styles.debugInfoSmall}>{t('not_found.debug.timestamp', { defaultValue: 'Timestamp' })}: {debugInfo.timestamp}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 8,
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#00f5ff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00f5ff',
  },
  buttonIcon: {
    marginRight: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  secondaryButtonText: {
    color: '#00f5ff',
  },
  debugSection: {
    marginTop: 32,
    width: '100%',
    maxWidth: 400,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  debugCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  debugInfo: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  debugInfoSmall: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'monospace',
  },
});
