/**
 * Enhanced Principal Hub Dashboard - Phase 1 Implementation
 * 
 * Features:
 * - Real-time school metrics from database
 * - Teacher management with performance indicators
 * - Financial overview and enrollment pipeline
 * - Mobile-responsive design with <2s load time
 * - Simple announcement creation
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Alert,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAds } from '@/contexts/AdsContext';
import { useTranslation } from 'react-i18next';
import { usePrincipalHub, getPendingReportCount } from '@/hooks/usePrincipalHub';
import { router, useFocusEffect } from 'expo-router';
import { AnnouncementModal, AnnouncementData } from '@/components/modals/AnnouncementModal';
import AnnouncementService from '@/lib/services/announcementService';
import { useTheme } from '@/contexts/ThemeContext';
import { usePettyCashMetricCards } from '@/hooks/usePettyCashDashboard';
import { useWhatsAppConnection } from '@/hooks/useWhatsAppConnection';
import { useSchoolSettings } from '@/lib/hooks/useSchoolSettings';
import WhatsAppOptInModal from '@/components/whatsapp/WhatsAppOptInModal';
import WhatsAppStatusChip from '@/components/whatsapp/WhatsAppStatusChip';
import Feedback from '@/lib/feedback';
import AdBannerWithUpgrade from '@/components/ui/AdBannerWithUpgrade';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { Avatar } from '@/components/ui/Avatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import TierBadge from '@/components/ui/TierBadge';
import { PendingParentLinkRequests } from '@/components/dashboard/PendingParentLinkRequests';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 3;

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: string;
  onPress?: () => void;
}

interface TeacherCardProps {
  teacher: any;
  onPress?: () => void;
}

export const EnhancedPrincipalDashboard: React.FC = () => {
  // ALL HOOKS MUST BE AT THE TOP IN CONSISTENT ORDER
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { theme, toggleTheme, isDark } = useTheme();
  const { tier, ready: subscriptionReady, refresh: refreshSubscription } = useSubscription();
  const { preferences, setLayout } = useDashboardPreferences();
  const { maybeShowInterstitial } = useAds();
  const { metricCards: pettyCashCards } = usePettyCashMetricCards();
  const { isWhatsAppEnabled, getWhatsAppDeepLink } = useWhatsAppConnection();
  const schoolSettingsQuery = useSchoolSettings((profile as any)?.organization_id);
  const { refetch: refetchSchoolSettings } = schoolSettingsQuery;
  
  // Real-time school settings from database
  const schoolSettings = schoolSettingsQuery.data;
  const isWAConfigured = !!schoolSettings?.whatsapp_number;
  const isWAEnabled = isWhatsAppEnabled() || isWAConfigured;
  
  // Derived state from centralized settings
  const financialsEnabled = schoolSettings?.features?.financialReports?.enabled ?? true;
  const pettyCashEnabled = schoolSettings?.features?.pettyCash?.enabled ?? true;
  const insets = useSafeAreaInsets();
  const {
    data,
    loading,
    error,
    refresh,
    getMetrics,
    getTeachersWithStatus,
    formatCurrency,
    isEmpty
  } = usePrincipalHub();
  
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  // Prefer explicit tenant slug where available
  const tenantSlug = (profile as any)?.organization_membership?.tenant_slug 
    || (profile as any)?.organization_membership?.organization_slug 
    || (profile as any)?.organization_membership?.slug 
    || '';
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const hasRefreshedOnFocus = useRef(false);
  
  // Collapsible sections (start with long sections collapsed)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set([
    'financial-tools', 'ai-analytics', 'quick-actions',
  ]));
  const toggleSection = useCallback((id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    try { Feedback.vibrate(8); } catch { /* no-op */ }
  }, []);
  
  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (hasRefreshedOnFocus.current) {
        refresh();
        // Also refresh school settings to ensure latest config
        refetchSchoolSettings?.();
      } else {
        hasRefreshedOnFocus.current = true;
      }
    }, [refresh, refetchSchoolSettings])
  );
  
  // Theme-aware styles
  const styles = React.useMemo(() => createStyles(theme, preferences), [theme, preferences]);
  
  // Ad gating logic
  const showAds = subscriptionReady && tier === 'free';
  
  // Check tier capability buckets
  const hasAdvancedFeatures = tier === 'enterprise' || tier === 'pro';
  const hasStarterAIFeatures = ['starter','pro','enterprise'].includes(tier);
  const hasPremiumOrHigher = ['premium','pro','enterprise'].includes(tier);
  const hasAdvancedAnalytics = ['pro','enterprise'].includes(tier);
  
  // Upgrade prompt helper
  const promptUpgrade = () => {
    Alert.alert(
      t('dashboard.upgrade_to_premium_title'),
      t('dashboard.upgrade_to_premium_description'),
      [
        { text: t('dashboard.learn_more'), onPress: () => router.push('/pricing' as any) },
        { text: t('dashboard.upgrade_now'), onPress: () => router.push('/screens/subscription-setup?planId=pro' as any) },
        { text: t('dashboard.later'), style: 'cancel' },
      ]
    );
  };

  // Gate an action behind subscription with web compatibility
  const gate = (action: () => void, options?: { needs?: 'starter' | 'premium' | 'advanced' }) => () => {
    const needs = options?.needs ?? 'starter';

    // Optional dev-only bypass on web (set EXPO_PUBLIC_WEB_BYPASS_GATING=true)
    if (typeof window !== 'undefined' && process.env.EXPO_PUBLIC_WEB_BYPASS_GATING === 'true') {
      action();
      return;
    }

    if (!subscriptionReady) {
      // Avoid gating until we know the tier
      action();
      return;
    }
    if (needs === 'starter' && !hasStarterAIFeatures) {
      promptUpgrade();
      return;
    }
    if (needs === 'premium' && !hasPremiumOrHigher) {
      promptUpgrade();
      return;
    }
    if (needs === 'advanced' && !hasAdvancedAnalytics) {
      promptUpgrade();
      return;
    }
    action();
  };
  
  // Open WhatsApp using school deep link if available; fallback to support line
  const openWhatsAppWithFallback = async () => {
    // Prefer the school's configured WhatsApp number from centralized settings
    const configuredNumber = schoolSettings?.whatsapp_number;
    if (configuredNumber) {
      const message = encodeURIComponent(
        `Hello! This is ${user?.user_metadata?.first_name || 'Principal'} from ${data.schoolName || 'school'}. Reaching out via EduDash Pro.`
      );
      const waLink = `https://wa.me/${configuredNumber.replace(/[^\d]/g, '')}?text=${message}`;
      try {
        await Linking.openURL(waLink);
        return;
      } catch (err: unknown) {
        console.error('Failed to open WhatsApp link:', err);
      }
    }
    
    // Fallback to deep link helper (legacy)
    const fallbackLink = getWhatsAppDeepLink?.();
    if (fallbackLink) {
      try {
        await Linking.openURL(fallbackLink);
        return;
      } catch (err: unknown) {
        console.error('Failed to open fallback WhatsApp link:', err);
      }
    }
    
    Alert.alert(
      t('quick_actions.whatsapp_setup'), 
      t('dashboard.whatsapp_not_configured') + '\n\n' + t('quick_actions.configure_in_settings'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('quick_actions.go_to_settings'), onPress: () => router.push('/screens/admin/school-settings') }
      ]
    );
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.good_morning');
    if (hour < 18) return t('dashboard.good_afternoon');
    return t('dashboard.good_evening');
  };
  const handleCreateAnnouncement = () => {
    setShowAnnouncementModal(true);
  };


  const handleSendAnnouncement = async (announcement: AnnouncementData) => {
    const preschoolId = data.schoolId;
    const userId = user?.id;
    
    if (!preschoolId || !userId) {
      Alert.alert(t('common.error'), t('dashboard.announcement_send_error'));
      return;
    }
    
    try {
      
      const result = await AnnouncementService.createAnnouncement(
        preschoolId,
        userId,
        announcement
      );
      
      if (result.success) {
        try { await Feedback.vibrate(40); } catch { /* Haptics unavailable */ }
        try { await Feedback.playSuccess(); } catch { /* Audio unavailable */ }
        Alert.alert(
          t('dashboard.announcement_send_success'),
          t('dashboard.announcement_send_details', {
            title: announcement.title,
            audience: announcement.audience.join(', '),
            count: announcement.audience.length,
            groups: announcement.audience.length === 1 ? '1 group' : announcement.audience.length + ' groups',
            priority: announcement.priority.toUpperCase(),
            requiresResponse: announcement.requiresResponse ? t('dashboard.response_required') : ''
          }),
          [
            { text: t('dashboard.view_messages'), onPress: () => router.push('/screens/teacher-messages') },
            { text: t('common.ok'), style: 'default' }
          ]
        );
        
        // Refresh dashboard data and subscription status
        refresh();
        refreshSubscription();
      } else {
        Alert.alert(t('common.error'), t('dashboard.announcement_failed', { error: result.error }));
      }
    } catch (error) {
      console.error('💥 Error sending announcement:', error);
      Alert.alert(t('common.error'), t('dashboard.announcement_unexpected_error'));
    }
  };

  const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color, trend, onPress }) => (
    <TouchableOpacity
      style={[styles.metricCard, { borderLeftColor: color, shadowColor: color }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.metricHeader}>
        <Ionicons name={icon as any} size={20} color={color} />
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
      {trend && (
        <View style={styles.trendBadge}>
          <Text style={[styles.trendText, getTrendColor(trend)]}>
            {getTrendIcon(trend)} {trend}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const TeacherCard: React.FC<TeacherCardProps> = ({ teacher, onPress }) => (
    <TouchableOpacity style={styles.teacherCard} onPress={onPress}>
      <View style={styles.teacherHeader}>
        <View style={styles.teacherAvatar}>
          <Text style={styles.teacherInitials}>
            {teacher.first_name?.[0]}{teacher.last_name?.[0]}
          </Text>
        </View>
        <View style={styles.teacherInfo}>
          <Text style={styles.teacherName}>{teacher.full_name}</Text>
          <Text style={styles.teacherSpecialty}>{teacher.subject_specialization || t('dashboard.general')}</Text>
        </View>
        <View style={[styles.statusBadge, getStatusColor(teacher.status)]}>
          <Text style={styles.statusText}>{getStatusIcon(teacher.status)}</Text>
        </View>
      </View>
      <View style={styles.teacherStats}>
        <Text style={styles.teacherStat}>{teacher.classes_assigned} {t('common.classes')}</Text>
        <Text style={styles.teacherStat}>•</Text>
        <Text style={styles.teacherStat}>{teacher.students_count} {t('common.students')}</Text>
      </View>
      <Text style={styles.performanceIndicator}>{teacher.performance_indicator}</Text>
    </TouchableOpacity>
  );

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'good': case 'excellent': case 'up': return { color: theme.success };
      case 'warning': case 'attention': return { color: theme.warning };
      case 'low': case 'needs_attention': return { color: theme.error };
      default: return { color: theme.textSecondary };
    }
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'up': case 'good': case 'excellent': return '↗️';
      case 'down': case 'low': return '↘️';
      case 'warning': case 'attention': return '⚠️';
      case 'high': return '🔥';
      default: return '➡️';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return { backgroundColor: theme.success };
      case 'good': return { backgroundColor: theme.accent };
      case 'needs_attention': return { backgroundColor: theme.error };
      default: return { backgroundColor: theme.textSecondary };
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'excellent': return '🌟';
      case 'good': return '✅';
      case 'needs_attention': return '⚠️';
      default: return '●';
    }
  };

  if (loading && isEmpty) {
    return <LoadingScreen message="Loading your dashboard..." />;
  }

  if (error && isEmpty) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={48} color={theme.error} />
        <Text style={styles.errorTitle}>{t('dashboard.principal_hub_load_error')}</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const metrics = getMetrics();
  const teachersWithStatus = getTeachersWithStatus();
  
  // Add pending reports metric BEFORE other metrics (high priority)
  const reportsMetric = {
    id: 'pending_reports',
    title: 'Reports to Review',
    value: getPendingReportCount(data),
    icon: 'document-text-outline',
    color: '#F59E0B',
    trend: getPendingReportCount(data) > 0 ? 'attention' : 'stable'
  };
  
  // Place reports card first for visibility (classic dashboard shows up to 6)
  const allMetrics = [reportsMetric, ...metrics, ...pettyCashCards];

  return (
    <View style={styles.container}>
      {/* Fixed top header to match enhanced dashboard - Hidden on web */}
      {Platform.OS !== 'web' && (
      <View style={[styles.appHeader, { paddingTop: insets.top + 12 }]}>
        <View style={styles.appHeaderContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={{ borderRadius: 18, overflow: 'hidden', marginRight: 10 }}
              onPress={() => router.push('/screens/account')}
              activeOpacity={0.7}
            >
              <Avatar 
                name={`${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim() || (user?.email || 'User')}
                imageUri={(profile as any)?.avatar_url || (user?.user_metadata as any)?.avatar_url || null}
                size={36}
              />
            </TouchableOpacity>
            <Text style={styles.tenantName} numberOfLines={1} ellipsizeMode="tail">
              {data.schoolName ||
               (schoolSettings?.schoolName && schoolSettings.schoolName !== 'My School' ? schoolSettings.schoolName : undefined) ||
               tenantSlug ||
               (profile as any)?.organization_membership?.organization_name ||
               t('dashboard.your_school')}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {/* Layout toggle */}
            <TouchableOpacity
              style={styles.dashboardToggle}
              onPress={() => {
                const newLayout = preferences.layout === 'classic' ? 'enhanced' : 'classic';
                setLayout(newLayout);
                try { Feedback.vibrate(15); } catch { /* Haptics unavailable */ }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={preferences.layout === 'classic' ? 'grid' : 'apps'}
                size={16}
                color={theme.primary}
              />
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => router.push('/screens/settings')}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      )}

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={Platform.OS === 'web' ? { paddingBottom: 40 } : undefined}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} />
        }
      >
        {/* Welcome Section with Subscription Badge */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeHeader}>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>
                {getGreeting()}, {user?.user_metadata?.first_name || t('roles.principal')}! 👋
              </Text>
              <Text style={styles.welcomeSubtitle}>
                {t('dashboard.managing_school', { schoolName: data.schoolName || (schoolSettings?.schoolName && schoolSettings.schoolName !== 'My School' ? schoolSettings.schoolName : t('dashboard.your_school')) })} • {t('dashboard.school_overview')}
              </Text>
              {/* Tier Badge - moved from header */}
              <View style={{ marginTop: 8 }}>
                <TierBadge size="sm" showManageButton={true} />
              </View>
            </View>
            <View style={styles.headerActions}>
              {/* Dashboard Layout Toggle - Web Only */}
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={[styles.themeToggle, { backgroundColor: theme.primaryLight, borderColor: theme.primary, borderWidth: 1 }]}
                  onPress={() => {
                    const newLayout = preferences.layout === 'classic' ? 'enhanced' : 'classic';
                    setLayout(newLayout);
                    try { Feedback.vibrate(15); } catch { /* Haptics unavailable */ }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={preferences.layout === 'classic' ? 'grid' : 'apps'}
                    size={18}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              )}
              {/* Theme Toggle */}
              <TouchableOpacity
                style={styles.themeToggle}
              onPress={async () => {
                await toggleTheme();
                try { Feedback.vibrate(15); } catch { /* Haptics unavailable */ }
              }}
              >
                <Ionicons 
                  name={isDark ? 'sunny' : 'moon'} 
                  size={18} 
                  color={theme.primary} 
                />
              </TouchableOpacity>
              {/* WhatsApp Status */}
              {isWAEnabled && (
                <TouchableOpacity onPress={() => setShowWhatsAppModal(true)}>
                  <WhatsAppStatusChip size="small" showText={false} />
                </TouchableOpacity>
              )}
              {!isWAEnabled && (
                <TouchableOpacity onPress={() => router.push('/screens/school-settings')} style={{ marginLeft: 8 }}>
                  <Ionicons name="settings" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Enhanced Prominent CTA for Free tier only */}
          {tier === 'free' && subscriptionReady && (
            <View style={styles.upgradeBanner}>
              {/* Gradient Background Effect */}
              <View style={styles.upgradeBannerGradient}>
                {/* Header Content */}
                <View style={styles.upgradeBannerContent}>
                  <View style={styles.upgradeBannerIcon}>
                    <Ionicons name="diamond" size={24} color="#FFD700" />
                  </View>
                  <View style={styles.upgradeBannerText}>
                    <Text style={styles.upgradeBannerTitle}>{t('dashboard.upgrade_to_premium_title')}</Text>
                    <Text style={styles.upgradeBannerSubtitle}>{t('dashboard.unlock_premium_subtitle')}</Text>
                  </View>
                </View>
                
                {/* CTA Button - Now below the content */}
                <TouchableOpacity
                  style={styles.upgradeBannerButton}
                  onPress={() => {
                    // Minimal navigation: no haptics, no delays, no fallbacks
                    const route = `/screens/subscription-upgrade-post?currentTier=${encodeURIComponent(tier || 'free')}&reason=manual_upgrade`;
                    try { router.push(route); } catch { /* Haptics unavailable */ }
                  }}
                >
                  <View style={styles.upgradeBannerButtonGlow}>
                    <Text style={styles.upgradeBannerButtonText}>{t('subscription.choose_your_plan')}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>
              {/* Subtle pulse animation effect */}
              <View style={styles.upgradeBannerPulse} pointerEvents="none" />
            </View>
          )}
        </View>

      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('dashboard.school_overview')}</Text>
        <View style={styles.metricsGrid}>
          {allMetrics.slice(0, 6).map((metric: any, index) => (
            <MetricCard
              key={index}
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              trend={metric.trend}
              onPress={async () => {
                try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }
                
                // Show interstitial ad before navigating (free tier only)
                await maybeShowInterstitial('principal_metrics_nav');
                
                // Navigate via stable metric id when available
                switch (metric.id) {
                  case 'students':
                    router.push('/screens/student-management');
                    return;
                  case 'staff':
                    router.push('/screens/teacher-management');
                    return;
                  case 'revenue':
                    router.push('/screens/financial-dashboard');
                    return;
                  case 'applications':
                    router.push('/screens/student-enrollment');
                    return;
                  case 'classes':
                    router.push('/screens/class-teacher-management');
                    return;
                  case 'pending_reports':
                    router.push('/screens/principal-report-review');
                    return;
                  case 'petty_cash_balance':
                  case 'monthly_expenses':
                  case 'pending_approvals':
                    router.push('/screens/petty-cash');
                    return;
                  default:
                    // Fallback based on title (legacy behavior)
                    if (metric.title?.includes('Students') || metric.title?.includes('Total Students')) {
                      router.push('/screens/student-management');
                    } else if (metric.title?.includes('Staff') || metric.title?.includes('Teaching Staff')) {
                      router.push('/screens/teacher-management');
                    } else if (metric.title?.includes('Revenue') || metric.title?.includes('Monthly Revenue')) {
                      router.push('/screens/financial-dashboard');
                    } else if (metric.title?.includes('Applications')) {
                      router.push('/screens/student-enrollment');
                    } else if (metric.title?.includes('Petty Cash') || metric.title?.includes('Cash') || metric.title?.includes('Expenses')) {
                      router.push('/screens/petty-cash');
                    } else if (metric.title?.includes('Pending') && metric.title?.includes('Approval')) {
                      router.push('/screens/petty-cash');
                    }
                }
              }}
            />
          ))}
        </View>
      </View>

      {/* Second Ad Placement: After Quick Stats */}
      {showAds && (
        <AdBannerWithUpgrade
          screen="principal_dashboard"
          showUpgradeCTA={false}
          margin={10}
        />
      )}

      {/* Financial Summary */}
      {data.capacityMetrics && (
        <View style={styles.section}>
          <View style={styles.capacityCard}>
            <View style={styles.capacityHeader}>
              <Ionicons name="business" size={20} color="#7C3AED" />
              <Text style={styles.capacityTitle}>{t('dashboard.school_capacity')}</Text>
            </View>
            <View style={styles.capacityInfo}>
              <Text style={styles.capacityText}>
                {t('dashboard.capacity_students', { current: data.capacityMetrics.current_enrollment, capacity: data.capacityMetrics.capacity })}
              </Text>
              <Text style={styles.capacityPercentage}>
                {t('dashboard.utilized_percentage', { percentage: data.capacityMetrics.utilization_percentage })}
              </Text>
            </View>
            <View style={styles.capacityBar}>
              <View 
                style={[
                  styles.capacityFill, 
                  { 
                    width: `${data.capacityMetrics.utilization_percentage}%`,
                    backgroundColor: data.capacityMetrics.utilization_percentage > 90 ? '#DC2626' : '#059669'
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      )}

      {/* First Ad Placement: After Welcome/Upgrade Section */}
      {showAds && (
        <AdBannerWithUpgrade
          screen="principal_dashboard"
          showUpgradeCTA={true}
          margin={12}
        />
      )}

      {/* Teaching Staff */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dashboard.teaching_staff')}</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={async () => {
                await maybeShowInterstitial('principal_teacher_management_nav');
                router.push('/screens/teacher-management');
              }}
            >
              <Text style={styles.viewAllText}>{t('common.viewAll')}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.primary} />
            </TouchableOpacity>
        </View>
        
        {teachersWithStatus.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.teachersRow}>
              {teachersWithStatus.slice(0, 5).map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  onPress={() => {
                    Alert.alert(
                      teacher.full_name,
                      `${t('common.email')}: ${teacher.email}\n${t('common.classes')}: ${teacher.classes_assigned}\n${t('common.students')}: ${teacher.students_count}\n\n${t('common.status')}: ${teacher.performance_indicator}`
                    );
                  }}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyStateText}>{t('dashboard.no_teachers_assigned')}</Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => router.push('/screens/teacher-management')}
            >
              <Text style={styles.emptyStateButtonText}>{t('dashboard.add_teachers')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Parent Link Requests */}
      <PendingParentLinkRequests />

      {/* Financial Summary - Respects backend settings */}
      {financialsEnabled && data.financialSummary && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('dashboard.financial_overview')}</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/screens/financial-dashboard')}
            >
              <Text style={styles.viewAllText}>{t('dashboard.details')}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.financialGrid}>
            <View style={styles.financialCard}>
              <Text style={styles.financialLabel}>{t('dashboard.monthly_revenue')}</Text>
              <Text style={[styles.financialValue, { color: '#059669' }]}>
                {formatCurrency(data.financialSummary.monthlyRevenue)}
              </Text>
            </View>
            <View style={styles.financialCard}>
              <Text style={styles.financialLabel}>{t('dashboard.net_profit')}</Text>
              <Text style={[styles.financialValue, { 
                color: data.financialSummary.netProfit > 0 ? '#059669' : '#DC2626' 
              }]}>
                {formatCurrency(data.financialSummary.netProfit)}
              </Text>
            </View>
          </View>
          
          {/* Real Petty Cash Balance - Only show when enabled and meaningful */}
          {pettyCashEnabled && data.financialSummary.pettyCashBalance > 50 && (
            <View style={styles.financialGrid}>
              <View style={[styles.financialCard, { borderLeftColor: '#F59E0B', shadowColor: '#F59E0B' }]}>
                <Text style={styles.financialLabel}>{t('dashboard.petty_cash_balance')}</Text>
                <Text style={[styles.financialValue, { color: '#F59E0B' }]}>
                  {formatCurrency(data.financialSummary.pettyCashBalance)}
                </Text>
              </View>
              <View style={[styles.financialCard, { borderLeftColor: '#DC2626', shadowColor: '#DC2626' }]}>
                <Text style={styles.financialLabel}>{t('dashboard.monthly_expenses')}</Text>
                <Text style={[styles.financialValue, { color: '#DC2626' }]}>
                  {formatCurrency(data.financialSummary.pettyCashExpenses || 0)}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}


      {/* AI Insights Banner */}
      <View style={styles.section}>
        <TouchableOpacity 
          style={[styles.aiInsightsBanner, (subscriptionReady && !hasPremiumOrHigher) ? styles.disabledCard : null]}
          onPress={gate(async () => {
            try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }
            router.push('/screens/principal-analytics');
          }, { needs: 'premium' })}
          disabled={subscriptionReady && !hasPremiumOrHigher}
          >
            <View style={styles.aiInsightsHeader}>
              <View style={styles.aiInsightsIcon}>
                <Ionicons name="sparkles" size={20} color={'#7C3AED'} />
              </View>
            <View style={styles.aiInsightsContent}>
              <Text style={styles.aiInsightsTitle}>{t('dashboard.ai_insights')}</Text>
              <Text style={styles.aiInsightsSubtitle}>{t('dashboard.smart_analytics_recommendations')}</Text>
            </View>
            {(!hasPremiumOrHigher) ? (
              <TouchableOpacity
                onPress={() => router.push('/screens/subscription-upgrade-post?reason=ai_insights')}
                style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#7C3AED', borderRadius: 12 }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{t('dashboard.upgrade')}</Text>
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            )}
          </View>
        </TouchableOpacity>
        
        {/* WhatsApp Contact Support Banner */}
        <TouchableOpacity 
          style={styles.whatsappContactBanner}
          onPress={openWhatsAppWithFallback}
        >
          <View style={styles.whatsappContactHeader}>
            <View style={styles.whatsappContactIcon}>
              <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.whatsappContactContent}>
              <Text style={styles.whatsappContactTitle}>{t('dashboard.need_help')}</Text>
              <Text style={styles.whatsappContactSubtitle}>{t('dashboard.contact_support_whatsapp')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Financial Management Tools - Collapsible */}
      {financialsEnabled && (
      <View style={styles.section}>
        <TouchableOpacity style={styles.collapsibleHeader} onPress={() => toggleSection('financial-tools')} activeOpacity={0.7} accessibilityRole="button">
          <View style={[styles.titleChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={styles.sectionTitle}>{t('dashboard.financial_management')}</Text>
          </View>
          <Ionicons name={collapsedSections.has('financial-tools') ? 'chevron-down' : 'chevron-up'} size={18} color={theme.textSecondary} />
        </TouchableOpacity>
        {!collapsedSections.has('financial-tools') && (
        <View style={styles.toolsGrid}>
          <TouchableOpacity 
            style={[styles.toolCard, { backgroundColor: '#4F46E5' + '10' }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/financial-dashboard') }}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#4F46E5' }]}>
              <Ionicons name="analytics" size={20} color="white" />
            </View>
            <View style={styles.toolContent}>
              <Text style={styles.toolTitle}>{t('dashboard.financial_overview')}</Text>
              <Text style={styles.toolSubtitle}>{t('dashboard.financial_overview_subtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.toolCard, { backgroundColor: '#059669' + '10' }]}
onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/financial-transactions') }}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#059669' }]}>
              <Ionicons name="list" size={20} color="white" />
            </View>
            <View style={styles.toolContent}>
              <Text style={styles.toolTitle}>{t('dashboard.payment_history')}</Text>
              <Text style={styles.toolSubtitle}>{t('dashboard.payment_history_subtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.toolCard, { backgroundColor: '#DC2626' + '10' }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/financial-reports') }}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#DC2626' }]}>
              <Ionicons name="bar-chart" size={20} color="white" />
            </View>
            <View style={styles.toolContent}>
              <Text style={styles.toolTitle}>{t('dashboard.financial_reports')}</Text>
              <Text style={styles.toolSubtitle}>{t('dashboard.financial_reports_subtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          
          {pettyCashEnabled && (
          <TouchableOpacity 
            style={[styles.toolCard, { backgroundColor: '#F59E0B' + '10' }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/petty-cash') }}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="wallet" size={20} color="white" />
            </View>
            <View style={styles.toolContent}>
              <Text style={styles.toolTitle}>{t('dashboard.petty_cash_system')}</Text>
              <Text style={styles.toolSubtitle}>{t('dashboard.petty_cash_subtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.toolCard, { backgroundColor: '#10B981' + '10' }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/class-teacher-management') }}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#10B981' }]}>
              <Ionicons name="school" size={20} color="white" />
            </View>
            <View style={styles.toolContent}>
              <Text style={styles.toolTitle}>{t('dashboard.class_teacher_management')}</Text>
              <Text style={styles.toolSubtitle}>{t('dashboard.class_teacher_management_subtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        )}
      </View>
      )}

      {/* AI & Analytics Tools - Collapsible */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.collapsibleHeader} onPress={() => toggleSection('ai-analytics')} activeOpacity={0.7} accessibilityRole="button">
          <View style={[styles.titleChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={styles.sectionTitle}>{t('dashboard.ai_analytics')}</Text>
          </View>
          <Ionicons name={collapsedSections.has('ai-analytics') ? 'chevron-down' : 'chevron-up'} size={18} color={theme.textSecondary} />
        </TouchableOpacity>
        {!collapsedSections.has('ai-analytics') && (
        <View style={styles.toolsGrid}>
          {/* Active Tools First - Available with starter subscription */}
          <TouchableOpacity 
            style={[styles.toolCard, { backgroundColor: '#EC4899' + '10' }, (subscriptionReady && !hasStarterAIFeatures) ? styles.disabledCard : null]}
            onPress={gate(() => {
              Alert.alert(
                t('quick_actions.ai_lesson_generator'),
                t('quick_actions.ai_lesson_description'),
                [
                  { text: t('quick_actions.create_lesson'), onPress: () => router.push('/screens/ai-lesson-generator') },
                  { text: t('quick_actions.view_ai_tools'), onPress: () => router.push('/screens/ai-homework-grader-live') },
                  { text: t('dashboard.later'), style: 'cancel' },
                ]
              )
            }, { needs: 'starter' })}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#EC4899' }]}>
              <Ionicons name="document-text" size={20} color="white" />
            </View>
            <View style={styles.toolContent}>
              <Text style={styles.toolTitle}>{t('quick_actions.create_lessons')}</Text>
              <Text style={styles.toolSubtitle}>{t('quick_actions.create_lessons_subtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.toolCard, { backgroundColor: '#F59E0B' + '10' }, (subscriptionReady && !hasStarterAIFeatures) ? styles.disabledCard : null]}
            onPress={gate(async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/admin-ai-allocation') }, { needs: 'starter' })}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="settings" size={20} color="white" />
            </View>
            <View style={styles.toolContent}>
              <Text style={styles.toolTitle}>{t('quick_actions.ai_quota_management')}</Text>
              <Text style={styles.toolSubtitle}>{t('quick_actions.ai_quota_subtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          
          {/* Gated/Premium Tools Below - Require premium/advanced subscriptions */}
          <TouchableOpacity 
            style={[
              styles.toolCard,
              { backgroundColor: '#7C3AED' + '10' },
              (subscriptionReady && !hasPremiumOrHigher) ? styles.disabledCard : null
            ]}
            onPress={gate(() => {
              Alert.alert(
                t('quick_actions.ai_insights_recommendations'),
                t('quick_actions.ai_insights_description'),
                [
                  { text: t('quick_actions.view_ai_insights'), onPress: () => router.push('/screens/principal-analytics') },
                  { text: t('dashboard.later'), style: 'cancel' },
                ]
              );
            }, { needs: 'premium' })}
            disabled={subscriptionReady && !hasPremiumOrHigher}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#7C3AED' }]}>
              <Ionicons name="sparkles" size={20} color="white" />
            </View>
            <View style={styles.toolContent}>
              <Text style={styles.toolTitle}>{t('dashboard.ai_insights')}</Text>
              <Text style={styles.toolSubtitle}>{t('dashboard.smart_analytics_recommendations')}</Text>
            </View>
            {(!hasPremiumOrHigher) ? (
              <TouchableOpacity
                onPress={() => router.push('/screens/subscription-upgrade-post?reason=ai_insights')}
                style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#7C3AED', borderRadius: 12 }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{t('dashboard.upgrade')}</Text>
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.toolCard, { backgroundColor: '#0891B2' + '10' }, (subscriptionReady && !hasAdvancedAnalytics) ? styles.disabledCard : null]}
            onPress={gate(async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/principal-analytics') }, { needs: 'advanced' })}
            disabled={subscriptionReady && !hasAdvancedAnalytics}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#0891B2' }]}>
              <Ionicons name="analytics" size={20} color="white" />
            </View>
            <View style={styles.toolContent}>
              <Text style={styles.toolTitle}>{t('dashboard.advanced_analytics')}</Text>
              <Text style={styles.toolSubtitle}>{t('quick_actions.advanced_analytics_subtitle')}</Text>
            </View>
            {(!hasAdvancedAnalytics) ? (
              <TouchableOpacity
                onPress={() => router.push('/screens/subscription-upgrade-post?reason=advanced_analytics')}
                style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#0891B2', borderRadius: 12 }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{t('dashboard.upgrade')}</Text>
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
        )}
      </View>

      {/* Quick Actions - Collapsible */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.collapsibleHeader} onPress={() => toggleSection('quick-actions')} activeOpacity={0.7} accessibilityRole="button">
          <View style={[styles.titleChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
          </View>
          <Ionicons name={collapsedSections.has('quick-actions') ? 'chevron-down' : 'chevron-up'} size={18} color={theme.textSecondary} />
        </TouchableOpacity>
        {!collapsedSections.has('quick-actions') && (
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#6366F1', shadowColor: '#6366F1' }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/dash-assistant') }}
          >
            <Ionicons name="chatbubbles" size={24} color="#6366F1" />
            <Text style={styles.actionText}>{t('quick_actions.dash_chat', { defaultValue: 'Chat with Dash' })}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: theme.primary, shadowColor: theme.primary }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/student-enrollment') }}
          >
            <Ionicons name="person-add" size={24} color={theme.primary} />
            <Text style={styles.actionText}>{t('quick_actions.enroll_student')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: theme.success, shadowColor: theme.success }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/teacher-management') }}
          >
            <Ionicons name="people" size={24} color={theme.success} />
            <Text style={styles.actionText}>{t('quick_actions.manage_teachers')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: theme.accent, shadowColor: theme.accent }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; handleCreateAnnouncement(); }}
          >
            <Ionicons name="megaphone" size={24} color={theme.accent} />
            <Text style={styles.actionText}>{t('quick_actions.send_announcement')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: theme.primary, shadowColor: theme.primary }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/principal-parent-requests') }}
          >
            <Ionicons name="people-circle" size={24} color={theme.primary} />
            <Text style={styles.actionText}>{t('quick_actions.parent_requests')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: theme.success, shadowColor: theme.success }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/principal-seat-management') }}
          >
            <Ionicons name="id-card" size={24} color={theme.success} />
            <Text style={styles.actionText}>{t('quick_actions.seat_management')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: theme.accent, shadowColor: theme.accent }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/principal-parent-invite-code') }}
          >
            <Ionicons name="key" size={24} color={theme.accent} />
            <Text style={styles.actionText}>{t('quick_actions.invite_parents')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: theme.accent, shadowColor: theme.accent }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/admin/data-export') }}
          >
            <Ionicons name="cloud-download" size={24} color={theme.accent} />
            <Text style={styles.actionText}>{t('quick_actions.export_data')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: '#8B5CF6', shadowColor: '#8B5CF6' }]}
            onPress={async () => { try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }; router.push('/screens/student-management') }}
          >
            <Ionicons name="school" size={24} color="#8B5CF6" />
            <Text style={styles.actionText}>Progress Reports</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { borderLeftColor: theme.primary, shadowColor: theme.primary }]}
            onPress={async () => {
              // Quick school stats action
              try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }
              const content = t('common.school_stats_content', {
                studentsPresent: 87,
                totalStudents: 92,
                studentsPercentage: 95,
                teachersPresent: 8,
                totalTeachers: 9,
                teachersPercentage: 89,
                activeClasses: 6,
                lunchOrders: 73,
                lastUpdated: new Date().toLocaleTimeString(),
              });
              Alert.alert(
                t('common.school_stats_today'),
                content,
                [
                  { text: t('common.view_details'), onPress: () => router.push('/screens/principal-analytics') },
                  { text: t('common.close'), style: 'cancel' }
                ]
              );
            }}
          >
            <Ionicons name="analytics" size={24} color={theme.primary} />
            <Text style={styles.actionText}>{t('quick_actions.todays_stats')}</Text>
          </TouchableOpacity>
          
          {isWAEnabled && (
            <TouchableOpacity 
              style={[styles.actionCard, { borderLeftColor: '#25D366', shadowColor: '#25D366' }]}
              onPress={async () => {
                try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }
                setShowWhatsAppModal(true);
              }}
            >
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
              <Text style={styles.actionText}>{t('quick_actions.whatsapp_setup')}</Text>
            </TouchableOpacity>
          )}
          
          {!isWAEnabled && (
            <TouchableOpacity 
              style={[styles.actionCard, { borderLeftColor: theme.textSecondary, shadowColor: theme.textSecondary }]}
              onPress={async () => {
                try { await Feedback.vibrate(15); } catch { /* Haptics unavailable */ }
                Alert.alert(
                  t('common.quick_settings_content'),
                  t('common.quick_settings_description'),
                  [
                    { text: t('quick_actions.school_settings'), onPress: () => router.push('/screens/admin/school-settings') },
                    { text: t('common.close'), style: 'cancel' }
                  ]
                );
              }}
            >
              <Ionicons name="settings" size={24} color={theme.textSecondary} />
              <Text style={styles.actionText}>{t('quick_actions.quick_settings')}</Text>
            </TouchableOpacity>
          )}
        </View>
        )}
      </View>

      </ScrollView>
      
      {/* Options Menu Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showOptionsMenu}
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={styles.optionsMenuContent}>
            <View style={styles.optionsMenuHeader}>
              <Text style={styles.optionsMenuTitle}>{t('common.menu')}</Text>
              <TouchableOpacity onPress={() => setShowOptionsMenu(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                router.push('/screens/account');
              }}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="person-outline" size={24} color={theme.primary} />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{t('common.my_profile')}</Text>
                  <Text style={styles.optionSubtitle}>{t('common.account_settings_subtitle')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                router.push('/screens/admin/school-settings');
              }}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="settings-outline" size={24} color={theme.success} />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{t('quick_actions.school_settings')}</Text>
                  <Text style={styles.optionSubtitle}>{t('common.school_settings_modal_subtitle')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                handleCreateAnnouncement();
              }}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="megaphone-outline" size={24} color={theme.accent} />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{t('quick_actions.create_announcement')}</Text>
                  <Text style={styles.optionSubtitle}>{t('quick_actions.create_announcement_subtitle')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsMenu(false);
                router.push('/screens/principal-seat-management');
              }}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="id-card" size={24} color={theme.success} />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{t('quick_actions.seat_management')}</Text>
                  <Text style={styles.optionSubtitle}>{t('quick_actions.seat_management_subtitle')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      
      {/* Announcement Modal */}
      <AnnouncementModal
        visible={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        onSend={handleSendAnnouncement}
      />
      
      {/* WhatsApp Modal */}
      <WhatsAppOptInModal
        visible={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        onSuccess={() => {
          setShowWhatsAppModal(false);
          Alert.alert(t('common.whatsapp_connected'), t('common.whatsapp_updates_enabled'));
        }}
      />

      {/* Dash AI Floating Button removed - using global voice FAB */}
    </View>
  );
};

const createStyles = (theme: any, preferences: any = {}) => {
  const isSmall = width <= 400;
  const isClassicLayout = preferences.layout === 'classic';
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  appHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  appHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', minWidth: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tenantName: { fontSize: 18, fontWeight: '700', color: theme.text, flexShrink: 1, minWidth: 0, overflow: 'hidden' },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: theme.onPrimary, fontSize: 14, fontWeight: '700' },
  settingsButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: theme.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },

  scrollContainer: {
    flex: 1,
    // Increased top margin to ensure greeting section is visible below fixed header
    // Accounts for header height including safe area insets and content
    // Add a bit of space between the header and greetings card
    // On web, DesktopLayout provides the header, so we need minimal spacing
    marginTop: Platform.OS === 'web' ? 12 : (isClassicLayout ? 104 : 120),
  },
  welcomeSection: {
    backgroundColor: theme.surface,
    paddingHorizontal: 20,
    paddingVertical: isClassicLayout ? 12 : 16,
    marginBottom: isClassicLayout ? 4 : 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: isClassicLayout ? 12 : 16,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '400',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dashboardToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  clickableTitle: {
    textDecorationLine: 'underline',
  },
  titleChip: {
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
    marginRight: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: theme.primary,
    marginRight: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: cardWidth,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: theme.borderLight,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    color: theme.text,
  },
  metricTitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  trendBadge: {
    alignSelf: 'flex-start',
  },
  trendText: {
    fontSize: 10,
    fontWeight: '500',
  },
  teachersRow: {
    flexDirection: 'row',
    paddingRight: 20,
  },
  teacherCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 200,
    borderWidth: 1,
    borderColor: theme.borderLight,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  teacherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  teacherAvatar: {
    width: 32,
    height: 32,
    backgroundColor: theme.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  teacherInitials: {
    color: theme.onPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  teacherSpecialty: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  statusBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 10,
  },
  teacherStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  teacherStat: {
    fontSize: 12,
    color: theme.textSecondary,
    marginHorizontal: 2,
  },
  performanceIndicator: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.primary,
  },
  capacityCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  capacityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  capacityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginLeft: 8,
  },
  capacityInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  capacityText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  capacityPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  capacityBar: {
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
  },
  capacityFill: {
    height: 4,
    borderRadius: 2,
  },
  financialGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  financialCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    borderLeftWidth: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  financialLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  financialValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 12,
  },
  actionCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '30%',
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: theme.borderLight,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.text,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginVertical: 8,
  },
  emptyStateButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: theme.onPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingSkeleton: {
    padding: 20,
  },
  skeletonHeader: {
    height: 80,
    backgroundColor: theme.surfaceVariant,
    borderRadius: 8,
    marginBottom: 20,
  },
  skeletonMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  skeletonMetric: {
    width: cardWidth,
    height: 100,
    backgroundColor: theme.surfaceVariant,
    borderRadius: 12,
  },
  skeletonSection: {
    height: 200,
    backgroundColor: theme.surfaceVariant,
    borderRadius: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: theme.onPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  // Contact Admin Banner Styles
  contactAdminBanner: {
    backgroundColor: (theme.success || '#059669') + '10',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: (theme.success || '#059669') + '20',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  contactAdminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactAdminIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: (theme.success || '#059669') + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactAdminContent: {
    flex: 1,
  },
  contactAdminTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  contactAdminSubtitle: {
    fontSize: 14,
    color: theme.success || '#059669',
    fontWeight: '500',
  },
  // AI Insights Banner Styles
  aiInsightsBanner: {
    backgroundColor: (theme.accentLight || theme.accent + '15' || '#A78BFA15'),
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: (theme.accent || '#8B5CF6') + '20',
    shadowColor: theme.shadow || '#00000020',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  aiInsightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiInsightsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: (theme.accent || '#8B5CF6') + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  aiInsightsContent: {
    flex: 1,
  },
  aiInsightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text || '#111827',
    marginBottom: 2,
  },
  aiInsightsSubtitle: {
    fontSize: 14,
    color: '#FFFFFF', // High contrast white text for better visibility
    fontWeight: '500',
    opacity: 0.9, // Slightly transparent for elegant look
  },
  // WhatsApp Contact Support Banner Styles
  whatsappContactBanner: {
    backgroundColor: '#25D366', // WhatsApp green
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#25D366',
    shadowColor: theme.shadow || '#00000020',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  whatsappContactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  whatsappContactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  whatsappContactContent: {
    flex: 1,
  },
  whatsappContactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  whatsappContactSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  // Tool Cards Styles
  toolsGrid: {
    gap: 12,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.borderLight,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledCard: {
    opacity: 0.55,
  },
  toolIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toolContent: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  toolSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  // Options Menu Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.modalOverlay,
    justifyContent: 'flex-end',
  },
  optionsMenuContent: {
    backgroundColor: theme.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '60%',
  },
  optionsMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  optionsMenuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: theme.surface,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionText: {
    marginLeft: 16,
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  
  // Enhanced Subscription Badge Styles
  subscriptionBadgeContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  premiumSubscriptionBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.9)', // More opaque purple
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  basicSubscriptionBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.9)', // More opaque orange
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  subscriptionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  premiumBadgeText: {
    color: '#FFFFFF',
  },
  basicBadgeText: {
    color: '#FFFFFF',
  },
  
  // Enhanced Prominent Upgrade Banner Styles (theme-aware)
  upgradeBanner: {
    borderRadius: 16,
    marginTop: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  upgradeBannerGradient: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: isSmall ? 12 : 14,
    flexDirection: 'column',
    gap: isSmall ? 12 : 16,
    borderWidth: 1,
    borderColor: theme.border,
    position: 'relative',
    overflow: 'hidden',
  },
  upgradeBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  upgradeBannerIcon: {
    width: isSmall ? 40 : 48,
    height: isSmall ? 40 : 48,
    borderRadius: isSmall ? 20 : 24,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.primary,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  upgradeBannerText: {
    flex: 1,
  },
  upgradeBannerTitle: {
    fontSize: isSmall ? 14 : 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 2,
  },
  upgradeBannerSubtitle: {
    fontSize: isSmall ? 12 : 13,
    color: theme.textSecondary,
    lineHeight: isSmall ? 16 : 18,
    fontWeight: '500',
  },
  upgradeBannerButton: {
    borderRadius: 12,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    alignSelf: 'stretch', // Full width button
  },
  upgradeBannerButtonGlow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: isSmall ? 8 : 10,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.border,
    minWidth: isSmall ? 100 : 110,
    justifyContent: 'center',
    flex: 1,
  },
  upgradeBannerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.onPrimary,
  },
  upgradeBannerPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    zIndex: -1,
    backgroundColor: theme.primaryLight,
    opacity: 0.15,
  },
});
};

export default EnhancedPrincipalDashboard;
