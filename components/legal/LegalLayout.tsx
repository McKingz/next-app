import React from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DesignSystem } from '@/constants/DesignSystem';

interface LegalLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout wrapper for legal pages (privacy policy, terms of service)
 * Provides consistent styling, max-width container, and safe areas
 */
export function LegalLayout({ children }: LegalLayoutProps) {
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.contentContainer}>
            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignSystem.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: DesignSystem.spacing.xxl,
    ...(Platform.OS === 'web' && {
      minHeight: '100vh',
    }),
  },
  contentContainer: {
    maxWidth: 920,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: DesignSystem.spacing.lg,
    paddingVertical: DesignSystem.spacing.xl,
    ...(Platform.OS === 'web' && {
      paddingHorizontal: DesignSystem.spacing.xxl,
    }),
  },
});
