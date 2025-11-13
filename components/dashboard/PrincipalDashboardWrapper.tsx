import React, { memo } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { EnhancedPrincipalDashboard } from './EnhancedPrincipalDashboard';
import { NewEnhancedPrincipalDashboard } from './NewEnhancedPrincipalDashboard';

interface PrincipalDashboardWrapperProps {
  // Add any props that should be passed to both dashboard components
  refreshTrigger?: number;
}

const PrincipalDashboardWrapperComponent: React.FC<PrincipalDashboardWrapperProps> = ({
  refreshTrigger
}) => {
  const { preferences, isLoading } = useDashboardPreferences();
  const { theme } = useTheme();

  // Show loading indicator while preferences are being loaded
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Render the appropriate dashboard based on layout preference
  switch (preferences.layout) {
    case 'enhanced':
      return (
        <NewEnhancedPrincipalDashboard 
          key="enhanced"
        />
      );
    case 'classic':
    default:
      return (
        <EnhancedPrincipalDashboard 
          key="classic"
        />
      );
  }
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      minHeight: '100vh' as any,
    }),
  },
});

// Memoize wrapper to prevent unnecessary re-renders
// Only re-render if preferences layout changes
export const PrincipalDashboardWrapper = memo(
  PrincipalDashboardWrapperComponent,
  (prevProps, nextProps) => {
    // Custom comparator: only re-render if refreshTrigger changes
    return prevProps.refreshTrigger === nextProps.refreshTrigger;
  }
);
