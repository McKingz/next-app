/**
 * New Enhanced Parent Dashboard - Modern UI/UX Implementation
 * 
 * Features:
 * - Clean grid-based layout with improved visual hierarchy
 * - Mobile-first responsive design with <2s load time
 * - Modern card design with subtle shadows and rounded corners
 * - Child switching with multi-child support
 * - Better information architecture with progressive disclosure
 * - Enhanced loading states and error handling
 * - Optimized for touch interfaces and accessibility
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import Feedback from '@/lib/feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// VOICETODO: DashVoiceFloatingButton archived - now using DashChatButton in root layout
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { track } from '@/lib/analytics';
import { useUnreadMessageCount } from '@/hooks/useParentMessaging';
import { usePOPStats } from '@/hooks/usePOPUploads';
import { useParentDashboard } from '@/hooks/useDashboardData';
import { logger } from '@/lib/logger';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  interpolate
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;
const containerWidth = width - (cardPadding * 2);
const cardWidth = isTablet ? (containerWidth - (cardGap * 3)) / 4 : (containerWidth - cardGap) / 2;

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: string;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

interface QuickActionProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
  subtitle?: string;
  disabled?: boolean;
}

interface NewEnhancedParentDashboardProps {
  refreshTrigger?: number;
}

// Collapseable Section Component
interface CollapseableSectionProps {
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  icon?: string;
}

const CollapsableSection: React.FC<CollapseableSectionProps> = ({ 
  title, 
  children, 
  defaultCollapsed = false,
  icon
}) => {
  const { theme } = useTheme();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const rotation = useSharedValue(defaultCollapsed ? 0 : 1);
  const height = useSharedValue(defaultCollapsed ? 0 : 1);

  const toggleCollapse = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    rotation.value = withTiming(newCollapsed ? 0 : 1, { duration: 200 });
    height.value = withTiming(newCollapsed ? 0 : 1, { duration: 200 });
  };

  const animatedChevronStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.value, [0, 1], [0, 90]);
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: height.value,
      maxHeight: height.value === 0 ? 0 : undefined,
      overflow: 'hidden' as const,
    };
  });

  return (
    <View style={{ marginBottom: 24 }}>
      <TouchableOpacity
        onPress={toggleCollapse}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 12,
          paddingHorizontal: 4,
        }}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon && (
            <Ionicons 
              name={icon as any} 
              size={20} 
              color={theme.primary} 
            />
          )}
          <Text style={{
            fontSize: isTablet ? 22 : isSmallScreen ? 18 : 20,
            fontWeight: '600',
            color: theme.text,
          }}>
            {title}
          </Text>
        </View>
        <Animated.View style={animatedChevronStyle}>
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={theme.textSecondary} 
          />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={animatedContentStyle}>
        {!collapsed && children}
      </Animated.View>
    </View>
  );
};

// Child Switcher Component
interface ChildSwitcherProps {
  children: any[];
  activeChildId: string | null;
  onChildChange: (childId: string) => void;
}

const ChildSwitcher: React.FC<ChildSwitcherProps> = ({ children, activeChildId, onChildChange }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  if (children.length <= 1) return null;

  return (
    <View style={{
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      marginBottom: 24,
    }}>
      <Text style={{
        fontSize: 14,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 12,
      }}>{t('parent.selectChild', { defaultValue: 'Select Child' })}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {children.map((child) => {
            const isActive = child.id === activeChildId;
            return (
              <TouchableOpacity
                key={child.id}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: isActive ? theme.primary : theme.elevated,
                  borderWidth: isActive ? 0 : 1,
                  borderColor: theme.border,
                }}
                onPress={() => onChildChange(child.id)}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: isActive ? '600' : '500',
                  color: isActive ? theme.onPrimary : theme.text,
                }}>
                  {child.firstName} {child.lastName}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => router.push('/screens/parent-children')}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: theme.elevated,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{t('common.manage', { defaultValue: 'Manage' })}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export const NewEnhancedParentDashboard: React.FC<NewEnhancedParentDashboardProps> = ({ 
  refreshTrigger
}) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { tier, ready: subscriptionReady } = useSubscription();
  const { preferences, setLayout } = useDashboardPreferences();
  const [refreshing, setRefreshing] = useState(false);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [children, setChildren] = useState<any[]>([]);
  const insets = useSafeAreaInsets();
  const userRole = (profile as any)?.role || 'parent';
  
  const styles = useMemo(() => createStyles(theme, insets.top, insets.bottom), [theme, insets.top, insets.bottom]);
  
  // Main parent dashboard data hook
  const {
    data: dashboardData,
    loading,
    error,
    refresh,
    isLoadingFromCache,
  } = useParentDashboard();
  
  // Hooks for parent-specific data
  const { data: unreadMessageCount = 0 } = useUnreadMessageCount();
  const { data: popStats } = usePOPStats(activeChildId || undefined);

  // Update children state when dashboard data changes
  React.useEffect(() => {
    if (dashboardData?.children) {
      setChildren(dashboardData.children);
      // Set first child as active if none selected
      if (!activeChildId && dashboardData.children.length > 0) {
        setActiveChildId(dashboardData.children[0].id);
      }
    }
  }, [dashboardData?.children, activeChildId]);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    const parentName = profile?.first_name || user?.user_metadata?.first_name || 'Parent';
    if (hour < 12) return t('dashboard.good_morning', { defaultValue: 'Good morning' }) + ', ' + parentName;
    if (hour < 18) return t('dashboard.good_afternoon', { defaultValue: 'Good afternoon' }) + ', ' + parentName;
    return t('dashboard.good_evening', { defaultValue: 'Good evening' }) + ', ' + parentName;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      try {
        await Feedback.vibrate(10);
      } catch {
        // Vibration not supported, ignore
      }
    } catch (_error) {
      logger.error('Dashboard refresh failed:', _error);
    } finally {
      setRefreshing(false);
    }
  };

  const MetricCard: React.FC<MetricCardProps> = ({ 
    title, 
    value, 
    icon, 
    color, 
    trend, 
    onPress,
    size = 'medium'
  }) => (
    <TouchableOpacity
      style={[
        styles.metricCard,
        size === 'large' && styles.metricCardLarge,
        size === 'small' && styles.metricCardSmall,
        { marginHorizontal: cardGap / 2, marginBottom: cardGap }
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.metricContent}>
        <View style={styles.metricHeader}>
          <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
            <Ionicons 
              name={icon as any} 
              size={isSmallScreen ? (size === 'large' ? 24 : 20) : (size === 'large' ? 28 : 24)} 
              color={color} 
            />
          </View>
          {trend && (
            <View style={styles.trendContainer}>
              <Text style={[styles.trendText, getTrendColor(trend)]}>
                {getTrendIcon(trend)} {getTrendText(trend)}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  const QuickAction: React.FC<QuickActionProps> = ({ title, icon, color, onPress, subtitle, disabled }) => (
    <TouchableOpacity
      style={[styles.actionCard, disabled && styles.actionCardDisabled]}
      onPress={async () => {
        if (disabled) return;
        try {
          await Feedback.vibrate(10);
        } catch {
          // Vibration not supported, ignore
        }
        onPress();
      }}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={isSmallScreen ? 20 : 24} color={disabled ? theme.textSecondary : color} />
      </View>
      <Text style={[styles.actionTitle, disabled && styles.actionTitleDisabled]}>{title}</Text>
      {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': case 'good': case 'excellent': case 'stable': return { color: theme.success };
      case 'warning': case 'attention': case 'high': return { color: theme.warning };
      case 'down': case 'low': case 'needs_attention': return { color: theme.error };
      default: return { color: theme.textSecondary };
    }
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'up': case 'good': case 'excellent': return '↗️';
      case 'down': case 'low': return '↘️';
      case 'warning': case 'attention': case 'needs_attention': return '⚠️';
      default: return '➡️';
    }
  };

  const getTrendText = (trend: string): string => {
    switch (trend) {
      case 'up': return t('trends.up', { defaultValue: 'Up' });
      case 'down': return t('trends.down', { defaultValue: 'Down' });
      case 'good': return t('trends.good', { defaultValue: 'Good' });
      case 'excellent': return t('trends.excellent', { defaultValue: 'Excellent' });
      case 'warning': return t('trends.warning', { defaultValue: 'Warning' });
      case 'attention': return t('trends.attention', { defaultValue: 'Attention' });
      case 'needs_attention': return t('trends.needs_attention', { defaultValue: 'Needs attention' });
      case 'low': return t('trends.low', { defaultValue: 'Low' });
      case 'stable': return t('trends.stable', { defaultValue: 'Stable' });
      case 'high': return t('trends.high', { defaultValue: 'High' });
      default: return trend;
    }
  };

  const handleQuickAction = (action: string) => {
    track('parent.dashboard.quick_action', { action, layout: 'enhanced' });
    
    switch (action) {
      case 'view_homework':
        router.push('/screens/homework');
        break;
      case 'check_attendance':
        router.push('/screens/attendance');
        break;
      case 'view_grades':
        router.push('/screens/grades');
        break;
      case 'messages':
        router.push('/screens/messages');
        break;
      case 'events':
        router.push('/screens/events');
        break;
      case 'ai_homework_help':
        router.push('/screens/ai-homework-help');
        break;
      default:
        Alert.alert(t('common.coming_soon', { defaultValue: 'Coming Soon' }), t('dashboard.feature_coming_soon', { defaultValue: 'This feature is coming soon!' }));
    }
  };

  // Real data metrics from dashboard
  const metrics = useMemo(() => {
    if (!dashboardData) {
      return [
        {
          title: t('parent.unread_messages', { defaultValue: 'Unread Messages' }),
          value: '...',
          icon: 'mail-unread',
          color: theme.primary,
          trend: 'stable'
        },
        {
          title: t('parent.homework_pending', { defaultValue: 'Homework Pending' }),
          value: '...',
          icon: 'document-text',
          color: theme.warning,
          trend: 'stable'
        },
        {
          title: t('parent.attendance_rate', { defaultValue: 'Attendance Rate' }),
          value: '...',
          icon: 'calendar',
          color: theme.success,
          trend: 'stable'
        },
        {
          title: t('parent.total_children', { defaultValue: 'Total Children' }),
          value: '...',
          icon: 'people',
          color: theme.secondary,
          trend: 'stable'
        }
      ];
    }

    const pendingHomework = dashboardData.recentHomework.filter(hw => hw.status === 'not_submitted').length;
    const attendancePercentage = `${dashboardData.attendanceRate}%`;
    
    return [
      {
        title: t('parent.unread_messages', { defaultValue: 'Unread Messages' }),
        value: dashboardData.unreadMessages || unreadMessageCount || '0',
        icon: 'mail-unread',
        color: theme.primary,
        trend: (dashboardData.unreadMessages || unreadMessageCount) > 5 ? 'attention' : 'stable'
      },
      {
        title: t('parent.homework_pending', { defaultValue: 'Homework Pending' }),
        value: pendingHomework.toString(),
        icon: 'document-text',
        color: theme.warning,
        trend: pendingHomework > 3 ? 'attention' : pendingHomework === 0 ? 'good' : 'stable'
      },
      {
        title: t('parent.attendance_rate', { defaultValue: 'Attendance Rate' }),
        value: attendancePercentage,
        icon: 'calendar',
        color: theme.success,
        trend: dashboardData.attendanceRate >= 90 ? 'good' : dashboardData.attendanceRate >= 75 ? 'stable' : 'attention'
      },
      {
        title: t('parent.total_children', { defaultValue: 'Total Children' }),
        value: dashboardData.totalChildren.toString(),
        icon: 'people',
        color: theme.secondary,
        trend: 'stable'
      }
    ];
  }, [dashboardData, unreadMessageCount, theme, t]);

  const quickActions = [
    {
      title: t('parent.view_homework', { defaultValue: 'View Homework' }),
      icon: 'book',
      color: theme.primary,
      onPress: () => handleQuickAction('view_homework')
    },
    {
      title: t('parent.check_attendance', { defaultValue: 'Check Attendance' }),
      icon: 'calendar',
      color: theme.success,
      onPress: () => handleQuickAction('check_attendance')
    },
    {
      title: t('parent.view_grades', { defaultValue: 'View Grades' }),
      icon: 'school',
      color: theme.secondary,
      onPress: () => handleQuickAction('view_grades')
    },
    {
      title: t('parent.messages', { defaultValue: 'Messages' }),
      icon: 'chatbubbles',
      color: theme.info,
      onPress: () => handleQuickAction('messages')
    },
    {
      title: t('parent.events', { defaultValue: 'Events' }),
      icon: 'calendar-outline',
      color: theme.warning,
      onPress: () => handleQuickAction('events')
    },
    {
      title: t('parent.ai_homework_help', { defaultValue: 'AI Homework Help' }),
      icon: 'sparkles',
      color: '#8B5CF6',
      onPress: () => handleQuickAction('ai_homework_help'),
      disabled: tier === 'free'
    }
  ];

  if (loading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
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
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.subtitle}>{t('parent.dashboard_subtitle', { defaultValue: 'Track your child\'s progress' })}</Text>
        </View>

        {/* Child Switcher */}
        <ChildSwitcher
          children={children}
          activeChildId={activeChildId}
          onChildChange={setActiveChildId}
        />

        {/* Metrics Grid - Collapseable */}
        <CollapsableSection 
          title={t('dashboard.overview', { defaultValue: 'Overview' })}
          icon="stats-chart"
          defaultCollapsed={false}
        >
          <View style={styles.metricsGrid}>
            {metrics.map((metric, index) => (
              <MetricCard
                key={index}
                title={metric.title}
                value={metric.value}
                icon={metric.icon}
                color={metric.color}
                trend={metric.trend}
                onPress={() => {
                  track('parent.dashboard.metric_clicked', { metric: metric.title });
                }}
              />
            ))}
          </View>
        </CollapsableSection>

        {/* Quick Actions - Collapseable */}
        <CollapsableSection 
          title={t('dashboard.quick_actions', { defaultValue: 'Quick Actions' })}
          icon="flash"
          defaultCollapsed={false}
        >
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <QuickAction
                key={index}
                title={action.title}
                icon={action.icon}
                color={action.color}
                onPress={action.onPress}
                disabled={action.disabled}
                subtitle={action.disabled ? t('dashboard.upgrade_required', { defaultValue: 'Upgrade required' }) : undefined}
              />
            ))}
          </View>
        </CollapsableSection>

        {/* Layout Toggle for Testing */}
        {process.env.NODE_ENV === 'development' && (
          <View style={styles.debugSection}>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => setLayout(preferences.layout === 'enhanced' ? 'classic' : 'enhanced')}
            >
              <Text style={styles.debugButtonText}>
                Switch to {preferences.layout === 'enhanced' ? 'Classic' : 'Enhanced'} Layout
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  metricCard: {
    width: cardWidth,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: cardPadding,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  metricCardLarge: {
    width: containerWidth,
  },
  metricCardSmall: {
    width: (containerWidth - cardGap) / 3,
  },
  metricContent: {
    flex: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: isSmallScreen ? 40 : 48,
    height: isSmallScreen ? 40 : 48,
    borderRadius: isSmallScreen ? 20 : 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexShrink: 1,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: isTablet ? 28 : isSmallScreen ? 22 : 24,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: isTablet ? 16 : isSmallScreen ? 12 : 14,
    color: theme.textSecondary,
    lineHeight: isTablet ? 22 : isSmallScreen ? 16 : 18,
  },
  actionCard: {
    width: cardWidth,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: cardPadding,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: cardGap / 2,
    marginBottom: cardGap,
    minHeight: isTablet ? 120 : isSmallScreen ? 90 : 100,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    width: isSmallScreen ? 48 : 56,
    height: isSmallScreen ? 48 : 56,
    borderRadius: isSmallScreen ? 24 : 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: isTablet ? 16 : isSmallScreen ? 12 : 14,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  actionTitleDisabled: {
    color: theme.textSecondary,
  },
  actionSubtitle: {
    fontSize: isTablet ? 14 : isSmallScreen ? 10 : 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  debugSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  debugButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  debugButtonText: {
    color: theme.onPrimary,
    fontWeight: '600',
  },
});