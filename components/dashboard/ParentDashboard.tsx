import React, { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, View, Text, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import AdBanner from '@/components/ui/AdBanner';
import { NativeAdCard } from '@/components/ads/NativeAdCard';
import { PLACEMENT_KEYS } from '@/lib/ads/placements';
import ErrorBanner from '@/components/ui/ErrorBanner';
import WhatsAppOptInModal from '@/components/whatsapp/WhatsAppOptInModal';
import OfflineBanner from '@/components/sync/OfflineBanner';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { getCurrentLanguage } from '@/lib/i18n';
import { track } from '@/lib/analytics';
import { EnhancedStatsRow } from './EnhancedStats';
import { EnhancedQuickActions } from './EnhancedQuickActions';
import SkeletonLoader from '../ui/SkeletonLoader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUnreadMessageCount } from '@/hooks/useParentMessaging';
import { usePOPStats } from '@/hooks/usePOPUploads';
import { PendingRegistrationRequests } from './PendingRegistrationRequests';
import { HomeworkModal } from './HomeworkModal';
import { useWhatsAppConnection as useRealWhatsAppConnection } from '@/hooks/useWhatsAppConnection';
import { useParentDashboardData } from '@/hooks/useParentDashboardData';

// Extracted components
import { ChildSwitcher } from './parent/ChildSwitcher';
import { ChildCard } from './parent/ChildCard';
import { LanguageModal } from './parent/LanguageModal';
import { WelcomeSection } from './parent/WelcomeSection';
import { ParentInsightsCard } from '@/components/parent/ParentInsightsCard';
import { InteractiveLessonsWidget } from '@/components/parent/InteractiveLessonsWidget';
import { PendingLinkRequests } from './PendingLinkRequests';
import { PendingParentLinkRequests } from './PendingParentLinkRequests';

// Extracted helpers
import { 
  getMockWhatsAppConnection, 
  getAttendanceColor,
  getAttendanceIcon 
} from '@/lib/dashboard/parentDashboardHelpers';

// Proactive insights service
import { ProactiveInsightsService } from '@/services/ProactiveInsightsService';
import type { ProactiveInsight, InteractiveLesson } from '@/services/ProactiveInsightsService';

function useTier() {
  // Parent-specific tiers: free, parent-starter, parent-plus
  const [tier, setTier] = useState<'free' | 'parent-starter' | 'parent-plus'>('free');
  useEffect(() => {
    const forced = (process.env.EXPO_PUBLIC_FORCE_TIER || '').toLowerCase();
    if (['parent-starter', 'parent-plus'].includes(forced)) setTier(forced as any);
    (async () => {
      try {
        const { data } = await assertSupabase().auth.getUser();
        const roleTier = (data.user?.user_metadata as any)?.subscription_tier as string | undefined;
        if (roleTier && ['parent-starter', 'parent-plus'].includes(roleTier)) setTier(roleTier as any);
      } catch (error) {
        console.warn('Failed to get tier from user metadata:', error);
      }
    })();
  }, []);
  return tier;
}


export default function ParentDashboard() {
  const { t } = useTranslation();
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, profile } = useAuth();
  const { data: unreadMessageCount = 0 } = useUnreadMessageCount();
  const [refreshing, setRefreshing] = useState(false);
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [limits, setLimits] = useState<{ ai_help: number | 'unlimited'; ai_lessons: number | 'unlimited'; tutoring_sessions: number | 'unlimited' }>({ ai_help: 10, ai_lessons: 5, tutoring_sessions: 2 });
  const tier = useTier();
  
  // Proactive insights state
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [interactiveLessons, setInteractiveLessons] = useState<InteractiveLesson[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  
  // Custom hook for dashboard data
  const {
    children,
    childrenCards,
    activeChildId,
    setActiveChildId,
    urgentMetrics,
    setUrgentMetrics,
    usage,
    loading,
    error,
    setError,
    loadDashboardData,
  } = useParentDashboardData();
  
  // WhatsApp integration
  const realWhatsApp = useRealWhatsAppConnection();
  const whatsApp = realWhatsApp || getMockWhatsAppConnection();

  const isAndroid = Platform.OS === 'android';
  const adsEnabled = process.env.EXPO_PUBLIC_ENABLE_ADS !== '0';
  const showBanner = isAndroid && adsEnabled && tier === 'free';
  
  // POP stats hook
  const { data: popStats } = usePOPStats(activeChildId || undefined);
  
  // Update urgent metrics with unread messages
  useEffect(() => {
    setUrgentMetrics(prev => ({ ...prev, unreadMessages: unreadMessageCount }));
  }, [unreadMessageCount, setUrgentMetrics]);
  
  // Load proactive insights when active child changes
  useEffect(() => {
    const loadInsights = async () => {
      if (!activeChildId || !profile?.preschool_id) {
        console.log('[ParentDashboard] Cannot load insights:', { activeChildId, hasPreschoolId: !!profile?.preschool_id });
        return;
      }
      
      console.log('[ParentDashboard] Loading insights for child:', activeChildId);
      setLoadingInsights(true);
      try {
        const insightsService = new ProactiveInsightsService(profile.preschool_id);
        const studentInsights = await insightsService.generateProactiveInsights(activeChildId);
        const lessons = await insightsService.getInteractiveLessons(activeChildId, 5);
        
        console.log('[ParentDashboard] Loaded insights:', studentInsights.length, 'lessons:', lessons.length);
        setInsights(studentInsights);
        setInteractiveLessons(lessons);
      } catch (error) {
        console.error('[ParentDashboard] Failed to load proactive insights:', error);
      } finally {
        setLoadingInsights(false);
      }
    };
    
    loadInsights();
  }, [activeChildId, profile?.preschool_id]);


  const onRefresh = useCallback(async () => {
    const refreshStart = Date.now();
    setRefreshing(true);
    
    try {
      await loadDashboardData();
      
      // Track successful refresh
      track('edudash.dashboard.refresh', {
        role: 'parent',
        user_id: user?.id,
        load_time_ms: Date.now() - refreshStart,
        children_count: children.length,
        ai_usage_count: usage.ai_help + usage.ai_lessons,
        platform: Platform.OS,
        tier: 'free', // This dashboard is only for free tier
      });
    } catch (error) {
      // Track failed refresh
      track('edudash.dashboard.refresh_failed', {
        role: 'parent',
        user_id: user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: Platform.OS,
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboardData, user?.id, children.length, usage.ai_help, usage.ai_lessons]);

  useEffect(() => {
    // Adjust limits by parent tier - matching parent pricing
    if (tier === 'parent-starter') {
      setLimits({ ai_help: 30, ai_lessons: 20, tutoring_sessions: 5 });
    } else if (tier === 'parent-plus') {
      setLimits({ ai_help: 100, ai_lessons: 50, tutoring_sessions: 10 });
    } else {
      // Free tier
      setLimits({ ai_help: 10, ai_lessons: 5, tutoring_sessions: 2 });
    }
  }, [tier]);






  const handleQuickAction = (action: string) => {
    track('edudash.dashboard.quick_action', {
      action,
      user_id: user?.id,
      role: 'parent',
      children_count: children.length,
      platform: Platform.OS,
      tier: 'free',
    });

    switch (action) {
case 'homework':
        track('edudash.parent.homework_help_requested', {
          subject: 'General Education',
          child_age: children.length > 0 ? 8 : 10,
          user_id: user?.id,
          children_count: children.length,
          source: 'dashboard_quick_action',
        } as any);
        setShowHomeworkModal(true);
        break;
      case 'whatsapp':
        track('edudash.whatsapp.connect_requested', {
          user_id: user?.id,
          source: 'dashboard_quick_action',
        });
        setShowWhatsAppModal(true);
        break;
      case 'language':
        track('edudash.language.selector_opened', {
          user_id: user?.id,
          current_language: getCurrentLanguage(),
          source: 'parent_dashboard',
        });
        setShowLanguageModal(true);
        break;
      case 'upgrade':
        track('edudash.billing.upgrade_viewed', {
          user_id: user?.id,
          current_tier: tier,
          target_tier: 'parent-plus', // Default parent upgrade target
        });
        // Navigate to pricing screen instead of showing placeholder alert
        router.push('/pricing');
        break;
    }
  };
  
  // Enhanced WhatsApp message handler for children
  const handleQuickMessage = async (child: any) => {
    track('child_quick_message', { 
      child_id: child.id, 
      source: 'dashboard_quick_action',
      whatsapp_connected: whatsApp.connectionStatus.isConnected 
    });
    
    // Check if WhatsApp is connected
    if (!whatsApp.connectionStatus.isConnected) {
      // Show WhatsApp opt-in modal if not connected
      setShowWhatsAppModal(true);
      return;
    }
    
    // If connected, show the WhatsApp modal with context of the child
    setShowWhatsAppModal(true);
  };

  // Function to cycle through children when tapping header subtitle
  const cycleToNextChild = () => {
    if (children.length <= 1) return;
    
    const currentIndex = children.findIndex(child => child.id === activeChildId);
    const nextIndex = (currentIndex + 1) % children.length;
    const nextChild = children[nextIndex];
    
    if (nextChild) {
      setActiveChildId(nextChild.id);
      track('edudash.dashboard.child_cycled', {
        user_id: user?.id,
        from_child_id: activeChildId,
        to_child_id: nextChild.id,
        total_children: children.length,
        source: 'header_tap'
      });
    }
  };

  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    loadingText: {
      color: theme.text,
      marginTop: 12,
    },
    section: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 12,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    statGradient: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 8,
    },
    statTitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    statSubtitle: {
      fontSize: 12,
      color: theme.textTertiary,
      marginTop: 2,
    },
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
    },
    quickActionCard: {
      width: cardWidth,
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: theme.shadow || '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 10,
    },
    disabledCard: {
      opacity: 0.6,
      shadowOpacity: 0.05,
      elevation: 2,
    },
    quickActionGradient: {
      padding: 16,
      alignItems: 'center',
      minHeight: 120,
      justifyContent: 'center',
      borderRadius: 12,
    },
    quickActionTitle: {
      color: '#FFFFFF',
      fontWeight: 'bold',
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
    },
    quickActionDescription: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: 12,
      marginTop: 4,
      textAlign: 'center',
    },
    activityCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
    },
    activityText: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    upgradeButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      marginTop: 12,
      alignSelf: 'flex-start',
    },
    upgradeButtonText: {
      color: theme.background,
      fontWeight: 'bold',
      fontSize: 12,
    },
    emptyCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 6,
    },
    emptySubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      textAlign: 'center',
    },
    profileMenuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.15)',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      paddingTop: 80,
      paddingRight: 16,
    },
    profileMenuContainer: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingVertical: 8,
      minWidth: 200,
      shadowColor: theme.shadow || '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    profileMenuHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    profileMenuTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    profileRoleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.warning + '20',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    profileFreeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.warning,
    },
    profileMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    profileMenuItemText: {
      fontSize: 14,
      color: theme.textSecondary,
      flex: 1,
    },
    profileMenuDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 4,
    },
    // Empty State Styles
    emptyState: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: theme.surface,
      borderRadius: 16,
      marginTop: 16,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
      textAlign: 'center',
    },
    emptyStateSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
    emptyStateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
    },
    emptyStateButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    // Claim overlay styles
    claimOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      backdropFilter: 'blur(4px)',
    },
    claimButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
    },
    claimButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 12,
    },
    infoText: {
      fontSize: 13,
      lineHeight: 18,
    },
    // Principal Dashboard Style Section Headers
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
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
    // Principal Dashboard Style Tool Cards
    toolsGrid: {
      gap: 12,
    },
    toolCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
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
    // Urgent Cards Styling
    urgentCardsGrid: {
      gap: 12,
    },
    urgentCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      borderLeftWidth: 4,
    },
    urgentCardPayment: {
      borderLeftColor: theme.warning,
    },
    urgentCardMessage: {
      borderLeftColor: theme.primary,
    },
    urgentCardHomework: {
      borderLeftColor: theme.accent,
    },
    urgentCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    urgentIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    urgentCardContent: {
      flex: 1,
    },
    urgentCardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 2,
    },
    urgentCardAmount: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 2,
    },
    urgentCardSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    // Daily Summary Styling
    dailySummaryCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    dailySummaryGrid: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    dailySummaryItem: {
      alignItems: 'center',
      flex: 1,
    },
    dailySummaryIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    dailySummaryLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    dailySummaryValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
    },
    // Professional Metric Cards - Principal Dashboard Style
    metricsGrid: {
      gap: 12,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    metricCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    metricIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 4,
    },
    metricLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    metricStatus: {
      fontSize: 12,
      fontWeight: '500',
      textTransform: 'lowercase',
    },
    // POP Actions Grid
    popActionsGrid: {
      gap: 12,
    },
    popActionCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 2,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      marginBottom: 12,
    },
    popActionIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    popActionContent: {
      flex: 1,
    },
    popActionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    popActionSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    popActionBadge: {
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    popActionBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: 'white',
    },
    // Timeline Styles
    timelineContainer: {
      paddingLeft: 16,
    },
    timelineItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    timelineDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 12,
      marginTop: 6,
    },
    timelineContent: {
      flex: 1,
    },
    timelineEvent: {
      fontSize: 14,
      color: theme.text,
      marginBottom: 2,
    },
    timelineTime: {
      fontSize: 12,
      color: theme.textSecondary,
    },
  }), [theme]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ padding: 16 }}>
          <SkeletonLoader width="100%" height={120} borderRadius={20} style={{ marginBottom: 16 }} />
          <SkeletonLoader width="100%" height={80} borderRadius={12} style={{ marginBottom: 16 }} />
          <SkeletonLoader width="100%" height={200} borderRadius={16} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Offline Banner */}
      <OfflineBanner />

      {/* Fixed Header - Hidden for cleaner UI */}
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00f5ff"
          />
        }
      >
        {/* Error Banner */}
        {error && (
          <ErrorBanner
            message={t('dashboard.loadError')}
            onRetry={() => loadDashboardData()}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Professional Welcome Section */}
        <WelcomeSection
          userName={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || t('roles.parent')}
          subtitle={(() => {
            const active = (childrenCards || []).find(c => c.id === activeChildId) || (childrenCards.length === 1 ? childrenCards[0] : null);
            if (active) {
              return `Managing ${active.firstName} ${active.lastName}`;
            }
            if (children.length > 0) {
              return t('dashboard.managingChildrenPlural', { count: children.length });
            }
            return 'Welcome to EduDash Pro';
          })()}
          isDark={isDark}
          onThemeToggle={toggleTheme}
          showTierBadge={true}
          tierBadgePlacement="subtitle-inline"
          tierBadgeSize="sm"
        />

        {/* Enhanced Children Section (moved under welcome) */}
        {children.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('parent.myChildren')} ({children.length})</Text>
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => router.push('/screens/parent-children')}
              >
                <Text style={styles.viewAllText}>{t('common.viewAll')}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
            {children.length > 1 && (
              <View style={{ marginBottom: 12 }}>
                <ChildSwitcher 
                  children={childrenCards}
                  activeChildId={activeChildId}
                  onChildChange={setActiveChildId}
                />
              </View>
            )}
            {(children.length > 1 && activeChildId ? 
              childrenCards.filter(child => child.id === activeChildId) : 
              childrenCards
            ).map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                onAttendancePress={() => console.log('View attendance for', child.id)}
                onHomeworkPress={() => console.log('View homework for', child.id)}
                onMessagePress={() => handleQuickMessage(child)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('parent.noChildrenFound')}</Text>
            </View>
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color={theme.primary} />
              <Text style={styles.emptyStateTitle}>No Children Linked Yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Search for your child by name to link them to your account. The school will approve your request.
              </Text>
              
              {/* Claim Existing Child Button */}
              <TouchableOpacity 
                style={[styles.emptyStateButton, { backgroundColor: theme.primary, marginBottom: 12, marginTop: 8 }]}
                onPress={() => router.push('/screens/parent-claim-child')}
              >
                <Ionicons name="search" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={[styles.emptyStateButtonText, { color: '#fff' }]}>Search & Claim Child</Text>
              </TouchableOpacity>
              
              {/* Register New Child Button */}
              <TouchableOpacity 
                style={[styles.emptyStateButton, { borderWidth: 1, borderColor: theme.border, backgroundColor: 'transparent' }]}
                onPress={() => {
                  console.log('[ParentDashboard] Register button pressed');
                  console.log('[ParentDashboard] Navigating to /screens/parent-child-registration');
                  try {
                    router.push('/screens/parent-child-registration' as any);
                    console.log('[ParentDashboard] Navigation called successfully');
                  } catch (error) {
                    console.error('[ParentDashboard] Navigation error:', error);
                  }
                }}
              >
                <Ionicons name="person-add" size={20} color={theme.text} style={{ marginRight: 8 }} />
                <Text style={[styles.emptyStateButtonText, { color: theme.text }]}>{t('parent.registerChild')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Parent Link Requests Status */}
        <View style={styles.section}>
          <PendingLinkRequests />
        </View>

        {/* Staff View: Parent Link Requests (Principal/Teacher Approval) */}
        {(profile?.role === 'principal' || profile?.role === 'teacher') && (
          <View style={styles.section}>
            <PendingParentLinkRequests />
          </View>
        )}

        {/* AI-Powered Proactive Insights */}
        {activeChildId && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bulb" size={24} color="#00f5ff" style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Insights for Your Child</Text>
            </View>
            {loadingInsights ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Loading insights...</Text>
              </View>
            ) : insights.length > 0 ? (
              insights.slice(0, 3).map((insight, index) => (
                <ParentInsightsCard
                  key={index}
                  insight={insight}
                  onActionPress={(actionTitle) => {
                    track('edudash.parent.insight_action_pressed', {
                      action: actionTitle,
                      insight_type: insight.type,
                      child_id: activeChildId,
                      user_id: user?.id,
                    });
                    // Navigate or perform action based on actionTitle
                    console.log('Action pressed:', actionTitle);
                  }}
                />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No insights available yet</Text>
                <Text style={styles.emptySubtitle}>Check back later for personalized guidance</Text>
              </View>
            )}
          </View>
        )}

        {/* CAPS-Aligned Interactive Lessons */}
        {activeChildId && (
          <View style={styles.section}>
            {loadingInsights ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Loading lessons...</Text>
              </View>
            ) : (
              <InteractiveLessonsWidget
                lessons={interactiveLessons}
                onLessonPress={(lesson) => {
                  track('edudash.parent.lesson_started', {
                    lesson_id: lesson.id,
                    lesson_title: lesson.title,
                    difficulty: lesson.difficulty,
                    child_id: activeChildId,
                    user_id: user?.id,
                  });
                  // Navigate to lesson detail or start lesson
                  console.log('Lesson pressed:', lesson.title);
                }}
              />
            )}
          </View>
        )}

        {/* Professional Metric Cards - Principal Dashboard Style */}
        <View style={styles.section}>
          <View style={styles.metricsGrid}>
            {/* Row 1: Core metrics */}
            <View style={styles.metricsRow}>
              <TouchableOpacity 
                style={[styles.metricCard, { borderColor: theme.primary + '30' }]}
                onPress={() => router.push('/messages')}
              >
                <View style={[styles.metricIcon, { backgroundColor: theme.primary }]}>
                  <Ionicons name="mail" size={20} color="white" />
                </View>
                <Text style={styles.metricValue}>{unreadMessageCount}</Text>
                <Text style={styles.metricLabel}>New Messages</Text>
                <Text style={[styles.metricStatus, { color: unreadMessageCount > 0 ? theme.warning : theme.textSecondary }]}>
                  {unreadMessageCount > 0 ? 'needs attention' : 'all read'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.metricCard, { borderColor: theme.success + '30' }]}
                onPress={() => router.push('/pop-history')}
              >
                <View style={[styles.metricIcon, { backgroundColor: theme.success }]}>
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                </View>
                <Text style={styles.metricValue}>{popStats?.proof_of_payment?.approved || 0}</Text>
                <Text style={styles.metricLabel}>Approved Payments</Text>
                <Text style={[styles.metricStatus, { color: theme.success }]}>verified</Text>
              </TouchableOpacity>
            </View>

            {/* Row 2: POP metrics */}
            <View style={styles.metricsRow}>
              <TouchableOpacity 
                style={[styles.metricCard, { borderColor: theme.warning + '30' }]}
                onPress={() => router.push('/pop-history?type=proof_of_payment&status=pending')}
              >
                <View style={[styles.metricIcon, { backgroundColor: theme.warning }]}>
                  <Ionicons name="time" size={20} color="white" />
                </View>
                <Text style={styles.metricValue}>{popStats?.proof_of_payment?.pending || 0}</Text>
                <Text style={styles.metricLabel}>Pending Payments</Text>
                <Text style={[styles.metricStatus, { color: theme.warning }]}>review needed</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.metricCard, { borderColor: theme.accent + '30' }]}
                onPress={() => router.push('/pop-history?type=picture_of_progress')}
              >
                <View style={[styles.metricIcon, { backgroundColor: theme.accent }]}>
                  <Ionicons name="images" size={20} color="white" />
                </View>
                <Text style={styles.metricValue}>{(popStats?.picture_of_progress?.pending || 0) + (popStats?.picture_of_progress?.approved || 0)}</Text>
                <Text style={styles.metricLabel}>Progress Photos</Text>
                <Text style={[styles.metricStatus, { color: theme.accent }]}>shared</Text>
              </TouchableOpacity>
            </View>

            {/* Row 3: Activity metrics */}
            <View style={styles.metricsRow}>
              <TouchableOpacity 
                style={[styles.metricCard, { borderColor: theme.error + '30' }]}
                onPress={() => router.push('/homework')}
              >
                <View style={[styles.metricIcon, { backgroundColor: theme.error }]}>
                  <Ionicons name="book" size={20} color="white" />
                </View>
                <Text style={styles.metricValue}>{urgentMetrics.pendingHomework}</Text>
                <Text style={styles.metricLabel}>Pending Homework</Text>
                <Text style={[styles.metricStatus, { color: urgentMetrics.pendingHomework > 0 ? theme.error : theme.textSecondary }]}>
                  {urgentMetrics.pendingHomework > 0 ? 'overdue' : 'up to date'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.metricCard, { borderColor: theme.primary + '30' }]}
                onPress={() => router.push('/attendance')}
              >
                <View style={[styles.metricIcon, { backgroundColor: getAttendanceColor(urgentMetrics.todayAttendance, theme) }]}>
                  <Ionicons name={getAttendanceIcon(urgentMetrics.todayAttendance)} size={20} color="white" />
                </View>
                <Text style={styles.metricValue}>Today</Text>
                <Text style={styles.metricLabel}>Attendance</Text>
                <Text style={[styles.metricStatus, { color: getAttendanceColor(urgentMetrics.todayAttendance, theme) }]}>
                  {urgentMetrics.todayAttendance === 'unknown' ? 'not recorded' : urgentMetrics.todayAttendance}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* POP Upload Actions - Prominent section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📸 Upload & Share</Text>
          <View style={styles.popActionsGrid}>
            <TouchableOpacity 
              style={[styles.popActionCard, { backgroundColor: theme.warning + '10', borderColor: theme.warning }]}
              onPress={() => {
                if (activeChildId) {
                  const child = childrenCards.find(c => c.id === activeChildId);
                  router.push(`/screens/parent-proof-of-payment?studentId=${activeChildId}&studentName=${encodeURIComponent(`${child?.firstName || ''} ${child?.lastName || ''}`.trim())}`);
                } else {
                  router.push('/screens/parent-proof-of-payment');
                }
              }}
            >
              <View style={[styles.popActionIcon, { backgroundColor: theme.warning }]}>
                <Ionicons name="receipt" size={28} color="white" />
              </View>
              <View style={styles.popActionContent}>
                <Text style={styles.popActionTitle}>Upload Proof of Payment</Text>
                <Text style={styles.popActionSubtitle}>Share receipts & payment confirmations</Text>
                {popStats?.proof_of_payment?.pending && popStats.proof_of_payment.pending > 0 && (
                  <View style={[styles.popActionBadge, { backgroundColor: theme.warning }]}>
                    <Text style={styles.popActionBadgeText}>{`${popStats.proof_of_payment.pending} pending`}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.popActionCard, { backgroundColor: theme.accent + '10', borderColor: theme.accent }]}
              onPress={() => {
                if (activeChildId) {
                  const child = childrenCards.find(c => c.id === activeChildId);
                  router.push(`/picture-of-progress?studentId=${activeChildId}&studentName=${encodeURIComponent(`${child?.firstName || ''} ${child?.lastName || ''}`.trim())}`);
                } else {
                  router.push('/picture-of-progress');
                }
              }}
            >
              <View style={[styles.popActionIcon, { backgroundColor: theme.accent }]}>
                <Ionicons name="camera" size={28} color="white" />
              </View>
              <View style={styles.popActionContent}>
                <Text style={styles.popActionTitle}>Share Progress Pictures</Text>
                <Text style={styles.popActionSubtitle}>Document your child's learning journey</Text>
                {popStats?.picture_of_progress?.recent && popStats.picture_of_progress.recent > 0 && (
                  <View style={[styles.popActionBadge, { backgroundColor: theme.accent }]}>
                    <Text style={styles.popActionBadgeText}>{`${popStats.picture_of_progress.recent} this week`}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.popActionCard, { backgroundColor: theme.primary + '10', borderColor: theme.primary }]}
              onPress={() => router.push('/pop-history')}
            >
              <View style={[styles.popActionIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="folder-open" size={28} color="white" />
              </View>
              <View style={styles.popActionContent}>
                <Text style={styles.popActionTitle}>View Upload History</Text>
                <Text style={styles.popActionSubtitle}>Manage all your uploads & approvals</Text>
                {popStats?.total_pending && popStats.total_pending > 0 && (
                  <View style={[styles.popActionBadge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.popActionBadgeText}>{`${popStats.total_pending} to review`}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Native Ad - Inline in content stream */}
        {showBanner && (
          <View style={styles.section}>
            <NativeAdCard 
              placement={PLACEMENT_KEYS.NATIVE_PARENT_FEED}
              style={{ alignSelf: 'center' }}
              itemIndex={1}
              showFallback={true}
            />
          </View>
        )}

        {/* Enhanced Usage Stats */}
        <EnhancedStatsRow
          aiHelp={usage.ai_help}
          aiHelpLimit={limits.ai_help}
          aiLessons={usage.ai_lessons}
          aiLessonsLimit={limits.ai_lessons}
        />

        {/* Enhanced Quick Actions */}
        <EnhancedQuickActions
          aiHelpUsage={usage.ai_help}
          aiHelpLimit={limits.ai_help}
          onHomeworkPress={() => handleQuickAction('homework')}
          onWhatsAppPress={() => handleQuickAction('whatsapp')}
          onUpgradePress={() => { /* removed in OTA preview */ }}
        />

        {/* Ad Banner for Free Tier - Middle placement */}
        {showBanner && (
          <View style={styles.section}>
            <AdBanner />
          </View>
        )}

        
        {/* Communication Hub - Principal Dashboard Style */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('parent.communicationHub')}</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/screens/parent-messages')}
            >
              <Text style={styles.viewAllText}>{t('common.viewAll')}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.toolsGrid}>
            <TouchableOpacity 
              style={[styles.toolCard, { backgroundColor: theme.primary + '10' }]}
              onPress={() => router.push('/screens/parent-messages')}
            >
              <View style={[styles.toolIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="mail" size={20} color="white" />
              </View>
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>{t('parent.messages')}</Text>
                <Text style={styles.toolSubtitle}>{t('parent.teacherCommunication')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.toolCard, { backgroundColor: theme.success + '10' }]}
              onPress={() => router.push('/screens/parent-announcements')}
            >
              <View style={[styles.toolIcon, { backgroundColor: theme.success }]}>
                <Ionicons name="megaphone" size={20} color="white" />
              </View>
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>{t('parent.announcements')}</Text>
                <Text style={styles.toolSubtitle}>{t('parent.schoolUpdates')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.toolCard, { backgroundColor: theme.warning + '10' }]}
              onPress={() => router.push('/screens/parent-meetings')}
            >
              <View style={[styles.toolIcon, { backgroundColor: theme.warning }]}>
                <Ionicons name="calendar" size={20} color="white" />
              </View>
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle}>{t('parent.scheduleMeeting')}</Text>
                <Text style={styles.toolSubtitle}>{t('parent.teacherMeeting')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
            
            {/* Native Ad - List context */}
            {showBanner && (
              <NativeAdCard 
                placement={PLACEMENT_KEYS.NATIVE_PARENT_LIST}
                style={{ marginVertical: 8 }}
                itemIndex={3}
                showFallback={true}
              />
            )}
          </View>
        </View>
        
        {/* Banner Ad - Messages/Communication context */}
        {showBanner && (
          <View style={styles.section}>
            <AdBanner 
              placement={PLACEMENT_KEYS.BANNER_PARENT_MESSAGES}
              style={{ marginVertical: 8 }}
              showFallback={true}
            />
          </View>
        )}
        
        {/* Child Registration Requests - Shows pending/approved/rejected requests */}
        <PendingRegistrationRequests />
        
        {/* Recent Activity Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.recentActivity')}</Text>
          <View style={styles.timelineContainer}>
            {(() => {
              const recentActivities = [];
              
              // Add AI help usage if any
              if (usage.ai_help > 0) {
                recentActivities.push({
                  time: 'Today',
                  event: t('dashboard.aiHelpUsed', { count: usage.ai_help }),
                  type: 'success'
                });
              }
              
              // Add children activities if any
              if (children.length > 0) {
                recentActivities.push({
                  time: '1 day ago',
                  event: `Monitoring ${children.length} ${children.length === 1 ? 'child' : 'children'}`,
                  type: 'info'
                });
              }
              
              // Add usage limit warning if needed
              if (usage.ai_help >= (limits.ai_help as number)) {
                recentActivities.push({
                  time: 'Now',
                  event: t('dashboard.upgradeLimitReached'),
                  type: 'warning'
                });
              }
              
              // Fallback activities if no real data
              if (recentActivities.length === 0) {
                recentActivities.push(
                  { time: 'Welcome!', event: 'Account created successfully', type: 'success' },
                  { time: 'Next', event: 'Link your children to start tracking progress', type: 'info' }
                );
              }
              
              return recentActivities.slice(0, 4).map((item, index) => (
                <View key={index} style={styles.timelineItem}>
                  <View style={[
                    styles.timelineDot,
                    { backgroundColor: 
                      item.type === 'success' ? theme.success :
                      item.type === 'warning' ? theme.warning :
                      theme.primary
                    }
                  ]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineEvent}>{item.event}</Text>
                    <Text style={styles.timelineTime}>{item.time}</Text>
                  </View>
                </View>
              ));
            })()
            }
            
            {/* Upgrade CTA if usage limit reached */}
            {usage.ai_help >= (limits.ai_help as number) && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: theme.warning }]} />
                <View style={styles.timelineContent}>
                  <TouchableOpacity 
                    style={styles.upgradeButton}
                    onPress={() => handleQuickAction('upgrade')}
                  >
                    <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Ad Banner for Free Tier - Main Dashboard bottom placement */}
        {showBanner && (
          <View style={styles.section}>
            <AdBanner 
              placement={PLACEMENT_KEYS.BANNER_PARENT_DASHBOARD}
              style={{ marginBottom: 16 }}
              showFallback={true}
            />
          </View>
        )}

        {/* Additional spacing for bottom navigation */}
        <View style={{ height: 20 }} />

      </ScrollView>

      {/* Homework Modal */}
      <HomeworkModal 
        visible={showHomeworkModal} 
        onClose={() => setShowHomeworkModal(false)}
        activeChildId={activeChildId}
        children={children}
      />
      
      {/* Language Modal */}
      <LanguageModal 
        visible={showLanguageModal} 
        onClose={() => setShowLanguageModal(false)}
        userId={user?.id}
      />
      
      {/* WhatsApp Modal */}
      <WhatsAppOptInModal visible={showWhatsAppModal} onClose={() => setShowWhatsAppModal(false)} />
      
      {/* VOICETODO: AI Assistant Floating Button now in root layout */}
    </View>
  );
}

const { width } = require('react-native').Dimensions.get('window');
const cardWidth = (width - 48) / 2; // Account for padding and gap
