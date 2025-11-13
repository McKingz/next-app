import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PrincipalDashboardWrapper } from '@/components/dashboard/PrincipalDashboardWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DesktopLayout } from '@/components/layout/DesktopLayout';

export default function PrincipalDashboardScreen() {
  const { user, profile, profileLoading, loading } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  // Guard against React StrictMode double-invoke in development
  const navigationAttempted = useRef(false);

  // Handle both organization_id (new RBAC) and preschool_id (legacy) fields
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;
  
  // Wait for auth and profile to finish loading before making routing decisions
  const isStillLoading = loading || profileLoading;

  // CONSOLIDATED NAVIGATION EFFECT: Single source of truth for all routing decisions
  useEffect(() => {
    // Skip if still loading data
    if (isStillLoading) return;
    
    // Guard against double navigation (React StrictMode in dev)
    if (navigationAttempted.current) return;
    
    // Decision 1: No user -> sign in
    if (!user) {
      navigationAttempted.current = true;
      try { 
        router.replace('/(auth)/sign-in'); 
      } catch (e) {
        try { router.replace('/sign-in'); } catch { /* Intentional: non-fatal */ }
      }
      return;
    }
    
    // Decision 2: User exists but no organization -> onboarding
    if (!orgId) {
      navigationAttempted.current = true;
      console.log('Principal dashboard: No school found, redirecting to onboarding', {
        profile,
        organization_id: profile?.organization_id,
        preschool_id: (profile as any)?.preschool_id,
      });
      try { 
        router.replace('/screens/principal-onboarding'); 
      } catch (e) {
        console.debug('Redirect to onboarding failed', e);
      }
      return;
    }
    
    // Decision 3: All good, stay on dashboard (no navigation needed)
  }, [isStillLoading, user, orgId, profile]);

  // Show loading state while auth/profile is loading
  if (isStillLoading) {
    return (
      <View style={styles.empty}>
        <Text style={styles.text}>{t('dashboard.loading_profile')}</Text>
      </View>
    );
  }

  // Show redirect message if no organization after loading is complete
  if (!orgId) {
    // If not authenticated, avoid onboarding redirect here
    if (!user) {
      return (
        <View style={styles.empty}>
          <Text style={styles.text}>{t('dashboard.loading_profile')}</Text>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Text style={styles.text}>{t('dashboard.no_school_found_redirect')}</Text>
        <TouchableOpacity onPress={() => {
          try { router.replace('/screens/principal-onboarding'); } catch (e) { console.debug('Redirect failed', e); }
        }}>
          <Text style={[styles.text, { textDecorationLine: 'underline' }]}>{t('common.go_now')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <DesktopLayout role="principal">
      <PrincipalDashboardWrapper />
    </DesktopLayout>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme?.background || '#0b1220' },
  text: { color: theme?.text || '#E5E7EB' },
});
