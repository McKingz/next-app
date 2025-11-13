/**
 * useNewEnhancedTeacherState - State management hook for New Enhanced Teacher Dashboard
 * 
 * Extracts all state logic, handlers, and business logic from the dashboard component.
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import Feedback from '@/lib/feedback';
import { track } from '@/lib/analytics';

export const useNewEnhancedTeacherState = () => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);

  // Get personalized greeting based on time of day
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    const teacherName = profile?.first_name || user?.user_metadata?.first_name || 'Teacher';
    
    if (hour < 12) return t('dashboard.good_morning') + ', ' + teacherName;
    if (hour < 18) return t('dashboard.good_afternoon') + ', ' + teacherName;
    return t('dashboard.good_evening') + ', ' + teacherName;
  };

  // Handle dashboard refresh with haptic feedback
  const handleRefresh = async (refresh: () => Promise<void>) => {
    setRefreshing(true);
    try {
      await refresh();
      await Feedback.vibrate(10);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle quick action navigation with analytics tracking
  const handleQuickAction = (action: string) => {
    track('teacher.dashboard.quick_action', { action, layout: 'enhanced' });
    
    switch (action) {
      case 'create_lesson':
        router.push('/screens/lesson-planner');
        break;
      case 'grade_assignments':
        router.push('/screens/assignments');
        break;
      case 'view_classes':
        router.push('/screens/classes');
        break;
      case 'parent_communication':
        router.push('/screens/messages');
        break;
      case 'student_reports':
        router.push('/screens/reports');
        break;
      case 'ai_assistant':
        router.push('/screens/dash-assistant');
        break;
      default:
        Alert.alert(t('common.coming_soon'), t('dashboard.feature_coming_soon'));
    }
  };

  // Build metrics data for display
  const buildMetrics = (dashboardData: any) => [
    {
      title: t('teacher.students_total'),
      value: dashboardData?.totalStudents || '24',
      icon: 'people',
      color: theme.primary,
      trend: 'stable'
    },
    {
      title: t('teacher.classes_active'),
      value: dashboardData?.totalClasses || '3',
      icon: 'school',
      color: theme.secondary,
      trend: 'good'
    },
    {
      title: t('teacher.assignments_pending'),
      value: dashboardData?.pendingGrading || '8',
      icon: 'document-text',
      color: theme.warning,
      trend: 'attention'
    },
    {
      title: t('teacher.average_grade'),
      value: dashboardData?.upcomingLessons || '0',
      icon: 'trophy',
      color: theme.success,
      trend: 'up'
    }
  ];

  // Build quick actions data
  const buildQuickActions = () => [
    {
      title: t('teacher.create_lesson'),
      icon: 'book',
      color: theme.primary,
      onPress: () => handleQuickAction('create_lesson')
    },
    {
      title: t('teacher.grade_assignments'),
      icon: 'checkmark-circle',
      color: theme.success,
      onPress: () => handleQuickAction('grade_assignments')
    },
    {
      title: t('teacher.view_classes'),
      icon: 'people',
      color: theme.secondary,
      onPress: () => handleQuickAction('view_classes')
    },
    {
      title: t('teacher.parent_communication'),
      icon: 'chatbubbles',
      color: theme.info,
      onPress: () => handleQuickAction('parent_communication')
    },
    {
      title: t('teacher.student_reports'),
      icon: 'bar-chart',
      color: theme.warning,
      onPress: () => handleQuickAction('student_reports')
    },
    {
      title: t('teacher.ai_assistant'),
      icon: 'sparkles',
      color: theme.accent,
      onPress: () => handleQuickAction('ai_assistant'),
      disabled: tier === 'free'
    }
  ];

  return {
    user,
    profile,
    theme,
    tier,
    refreshing,
    getGreeting,
    handleRefresh,
    handleQuickAction,
    buildMetrics,
    buildQuickActions,
  };
};
