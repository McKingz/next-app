/**
 * New Enhanced Teacher Dashboard - Modern UI/UX Implementation
 * 
 * Features:
 * - Clean grid-based layout with improved visual hierarchy
 * - Mobile-first responsive design with <2s load time
 * - Modern card design with subtle shadows and rounded corners
 * - Streamlined quick actions with contextual grouping
 * - Better information architecture with progressive disclosure
 * - Enhanced loading states and error handling
 * - Optimized for touch interfaces and accessibility
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTeacherDashboard } from '@/hooks/useDashboardData';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { track } from '@/lib/analytics';
import { PendingParentLinkRequests } from './PendingParentLinkRequests';
import { TeacherMetricsCard } from './teacher/TeacherMetricsCard';
import { TeacherQuickActionCard } from './teacher/TeacherQuickActionCard';
import { useNewEnhancedTeacherState } from '@/hooks/useNewEnhancedTeacherState';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;
const containerWidth = width - (cardPadding * 2);
const cardWidth = isTablet ? (containerWidth - (cardGap * 3)) / 4 : (containerWidth - cardGap) / 2;

interface NewEnhancedTeacherDashboardProps {
  refreshTrigger?: number;
  preferences?: any;
}

export const NewEnhancedTeacherDashboard: React.FC<NewEnhancedTeacherDashboardProps> = ({ 
  refreshTrigger, 
  preferences 
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { preferences: dashPrefs } = useDashboardPreferences();
  const insets = useSafeAreaInsets();
  
  const styles = useMemo(() => createStyles(theme, insets.top, insets.bottom), [theme, insets.top, insets.bottom]);
  
  // State management hook
  const state = useNewEnhancedTeacherState();
  
  const {
    data: dashboardData,
    loading,
    error,
    refresh,
    isLoadingFromCache,
  } = useTeacherDashboard();

  // Build metrics and actions from state
  const metrics = state.buildMetrics(dashboardData);
  const quickActions = state.buildQuickActions();


  if (loading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => state.handleRefresh(refresh)}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{state.getGreeting()}</Text>
          <Text style={styles.subtitle}>{t('teacher.dashboard_subtitle')}</Text>
        </View>

        {/* Metrics Grid */}
        <View style={styles.section}>
          <View style={[styles.sectionTitleChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={styles.sectionTitle}>{t('dashboard.overview')}</Text>
          </View>
          <View style={styles.metricsGrid}>
            {metrics.map((metric, index) => (
              <TeacherMetricsCard
                key={index}
                title={metric.title}
                value={metric.value}
                icon={metric.icon}
                color={metric.color}
                trend={metric.trend}
                onPress={() => {
                  track('teacher.dashboard.metric_clicked', { metric: metric.title });
                }}
              />
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={[styles.sectionTitleChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={styles.sectionTitle}>{t('dashboard.quick_actions')}</Text>
          </View>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TeacherQuickActionCard
                key={index}
                title={action.title}
                icon={action.icon}
                color={action.color}
                onPress={action.onPress}
                disabled={action.disabled}
                subtitle={action.disabled ? t('dashboard.upgrade_required') : undefined}
              />
            ))}
          </View>
        </View>

        {/* Parent Link Requests Widget */}
        <View style={styles.section}>
          <PendingParentLinkRequests />
        </View>

      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any, topInset: number, bottomInset: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: topInset || 20,
    paddingHorizontal: cardPadding,
    paddingBottom: bottomInset + 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 16,
  },
  header: {
    marginBottom: 32,
  },
  greeting: {
    fontSize: isTablet ? 32 : isSmallScreen ? 24 : 28,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: isTablet ? 18 : isSmallScreen ? 14 : 16,
    color: theme.textSecondary,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: isTablet ? 22 : isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  sectionTitleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -cardGap / 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -cardGap / 2,
  },
});