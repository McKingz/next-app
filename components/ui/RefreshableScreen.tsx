/**
 * RefreshableScreen Component
 * 
 * Reusable wrapper component that adds pull-to-refresh functionality
 * to any screen in the app with proper SafeAreaView and theming
 */

import React, { ReactNode } from 'react';
import { ScrollView, RefreshControl, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

interface RefreshableScreenProps {
  children: ReactNode;
  onRefresh: () => void | Promise<void>;
  refreshing?: boolean;
  edges?: Edge[];
  contentContainerStyle?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
}

/**
 * RefreshableScreen - Standardized screen wrapper with pull-to-refresh
 * 
 * Features:
 * - SafeAreaView with customizable edges
 * - Pull-to-refresh with theme-aware colors
 * - Proper ScrollView configuration
 * - Consistent styling across app
 * 
 * Usage:
 * ```tsx
 * <RefreshableScreen onRefresh={refetch} refreshing={isLoading}>
 *   <YourContent />
 * </RefreshableScreen>
 * ```
 */
export const RefreshableScreen: React.FC<RefreshableScreenProps> = ({
  children,
  onRefresh,
  refreshing = false,
  edges = ['top', 'bottom'],
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
}) => {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={edges}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
            progressBackgroundColor={theme.surface}
          />
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});
