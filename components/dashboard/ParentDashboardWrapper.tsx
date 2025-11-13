import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { useTheme } from '@/contexts/ThemeContext';
import ParentDashboard from './ParentDashboard';
import { NewEnhancedParentDashboard } from './NewEnhancedParentDashboard';

interface ParentDashboardWrapperProps {
  refreshTrigger?: number;
}

export const ParentDashboardWrapper: React.FC<ParentDashboardWrapperProps> = ({
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
        <NewEnhancedParentDashboard 
          key="enhanced"
          refreshTrigger={refreshTrigger}
        />
      );
    case 'classic':
    default:
      return (
        <ParentDashboard 
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

export default ParentDashboardWrapper;
