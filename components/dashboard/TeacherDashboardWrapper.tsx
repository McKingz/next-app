import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { TeacherDashboard as TeacherDashboardImpl } from './TeacherDashboard';
import { NewEnhancedTeacherDashboard } from './NewEnhancedTeacherDashboard';

interface TeacherDashboardWrapperProps {
  refreshTrigger?: number;
}

export const TeacherDashboardWrapper: React.FC<TeacherDashboardWrapperProps> = ({
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
        <NewEnhancedTeacherDashboard 
          key="enhanced"
          refreshTrigger={refreshTrigger}
        />
      );
    case 'classic':
    default:
      return (
        <TeacherDashboardImpl 
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

export default TeacherDashboardWrapper;
