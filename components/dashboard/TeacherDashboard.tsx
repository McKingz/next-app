/**
 * Teacher Dashboard - Orchestrator Component
 *
 * Responsibilities:
 * - Compose sub-components for teacher dashboard
 * - Manage data fetching and state via custom hooks
 * - Handle real-time subscriptions for seat status
 * - Coordinate loading/error states
 */

import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { useTeacherDashboard } from "@/hooks/useDashboardData";
import { useAds } from "@/contexts/AdsContext";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { assertSupabase } from "@/lib/supabase";
import { CacheIndicator } from "@/components/ui/CacheIndicator";
import AdBannerWithUpgrade from "@/components/ui/AdBannerWithUpgrade";
import { useTeacherDashboardState } from "@/hooks/useTeacherDashboardState";
import { TeacherHeader } from "./teacher/TeacherHeader";
import { TeacherMetrics } from "./teacher/TeacherMetrics";
import { SeatPendingBanner } from "./teacher/SeatPendingBanner";
import {
  TeacherQuickActions,
  TeacherAITools,
  TeacherClasses,
  TeacherAssignments,
  TeacherEvents,
} from "./teacher/TeacherDashboardComponents";
import { TeacherModals } from "./teacher/TeacherModals";
import { buildAITools, buildQuickActions } from "./teacher/actionBuilders";
import { getStyles } from "./teacher/styles";
import { PendingParentLinkRequests } from "./PendingParentLinkRequests";

export const TeacherDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = getStyles(theme, isDark);
  const { maybeShowInterstitial } = useAds();
  const { connectionStatus, isWhatsAppEnabled } = useWhatsAppConnection();
  const [showWhatsAppModal, setShowWhatsAppModal] = React.useState(false);

  // Custom state hook for all dashboard state
  const state = useTeacherDashboardState();

  // Dashboard data hook
  const {
    data: dashboardData,
    loading: isLoading,
    error,
    refresh,
    isLoadingFromCache,
  } = useTeacherDashboard();

  // Build AI tools and quick actions
  const aiTools = buildAITools({
    hasActiveSeat: state.hasActiveSeat,
    aiLessonEnabled: state.aiLessonEnabled,
    aiGradingEnabled: state.aiGradingEnabled,
    aiHelperEnabled: state.aiHelperEnabled,
    canCreateAssignments: state.canCreateAssignments,
    canGradeAssignments: state.canGradeAssignments,
    t,
  });

  const quickActions = buildQuickActions({
    hasCap: state.hasCap,
    maybeShowInterstitial,
    connectionStatus,
    isWhatsAppEnabled,
    setShowWhatsAppModal,
  });

  // Real-time seat status subscription (disabled on web unless explicitly enabled)
  React.useEffect(() => {
    if (Platform.OS === 'web' && process.env.EXPO_PUBLIC_ENABLE_REALTIME_WEB !== 'true') {
      return; // Avoid WebSocket errors on PWA/web by default
    }

    let channelProfile: any;
    let channelSeats: any;
    (async () => {
      try {
        const id = state.user?.id;
        if (!id) return;
        const client = assertSupabase();

        // Profile updates
        channelProfile = client
          .channel("seat-status-profile")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "profiles",
              filter: `id=eq.${id}`,
            },
            async () => {
              try {
                await state.refreshProfile();
                await refresh();
              } catch (err) {
                console.warn("Failed to refresh profile:", err);
              }
            },
          )
          .subscribe();

        // Teacher seats assignment updates
        channelSeats = client
          .channel("seat-status-teacher-seats")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "subscription_seats",
              filter: `user_id=eq.${id}`,
            },
            async () => {
              try {
                await state.refreshProfile();
                await refresh();
              } catch (err) {
                console.warn("Failed to refresh after seat change:", err);
              }
            },
          )
          .subscribe();
      } catch (err) {
        console.warn("Failed to set up subscriptions:", err);
      }
    })();
    return () => {
      try {
        channelProfile?.unsubscribe?.();
      } catch (err) {
        console.warn("Failed to unsubscribe profile:", err);
      }
      try {
        channelSeats?.unsubscribe?.();
      } catch (err) {
        console.warn("Failed to unsubscribe seats:", err);
      }
    };
  }, [state.user?.id, state.refreshProfile, refresh]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingSkeleton}>
          <View style={styles.skeletonHeader} />
          <View style={styles.skeletonMetrics}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonMetric} />
            ))}
          </View>
          <View style={styles.skeletonSection} />
        </View>
      </View>
    );
  }

  // Error state
  if (error && !dashboardData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons
          name="warning-outline"
          size={48}
          color={theme.error || "#DC2626"}
        />
        <Text style={styles.errorTitle}>{t("dashboard.error_title")}</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>
            {t("dashboard.retry_button")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
      >
        {/* Teacher Header */}
        <TeacherHeader
          teacherName={state.teacherName}
          role={state.profile?.role || "teacher"}
          hasActiveSeat={state.hasActiveSeat}
          seatStatus={state.seatStatus}
          onMenuPress={() => state.setShowOptionsMenu(true)}
        />

        {/* Seat Pending Banner */}
        {state.showSeatPending && (
          <View style={styles.section}>
            <SeatPendingBanner
              seatStatus={state.seatStatus}
              user={state.user}
              refresh={refresh}
            />
          </View>
        )}

        {/* Cache Status Indicator */}
        <View style={styles.section}>
          <CacheIndicator
            isLoadingFromCache={isLoadingFromCache}
            onRefresh={refresh}
            compact={true}
          />
        </View>

        {/* Dev Capability Debug Chip */}
        {((process.env.EXPO_PUBLIC_SHOW_DEBUG_CAPS === "true") ||
          (typeof __DEV__ !== "undefined" && __DEV__)) && (
          <View style={styles.section}>
            <View
              style={[
                styles.sectionCard,
                {
                  padding: 8,
                  backgroundColor: "#0f172a",
                  borderColor: "#1f2937",
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                Seat: {state.hasActiveSeat ? "active" : String(state.seatStatus)}{" "}
                | Plan: {String(state.planTier)} | Caps: LG=
                {String(state.aiLessonCap)} GH={String(state.aiGradingCap)} HH=
                {String(state.aiHelperCap)}
              </Text>
            </View>
          </View>
        )}

        {/* Key Metrics */}
        {dashboardData && (
          <TeacherMetrics
            totalStudents={dashboardData.totalStudents}
            totalClasses={dashboardData.totalClasses}
            pendingGrading={dashboardData.pendingGrading}
            upcomingLessons={dashboardData.upcomingLessons}
          />
        )}

        {/* Quick Actions */}
        <TeacherQuickActions quickActions={quickActions} />

        {/* First Ad Placement: Below Quick Actions */}
        {state.showAds && (
          <AdBannerWithUpgrade
            screen="teacher_dashboard"
            showUpgradeCTA={true}
            margin={12}
          />
        )}

        {/* AI Tools */}
        <TeacherAITools
          aiTools={aiTools}
          aiLessonEnabled={state.aiLessonEnabled}
          aiGradingEnabled={state.aiGradingEnabled}
          aiHelperEnabled={state.aiHelperEnabled}
          hasActiveSeat={state.hasActiveSeat}
          canCreateAssignments={state.canCreateAssignments}
          canGradeAssignments={state.canGradeAssignments}
          canViewAnalytics={state.canViewAnalytics}
          hasPremiumOrHigher={state.hasPremiumOrHigher}
          aiLessonCap={state.aiLessonCap}
          aiGradingCap={state.aiGradingCap}
          aiTempUnlocks={state.aiTempUnlocks}
          setAiTempUnlocks={state.setAiTempUnlocks}
          showAds={state.showAds}
          showUpgradeNudge={state.showUpgradeNudge}
          setShowUpgradeNudge={state.setShowUpgradeNudge}
          setShowUpgradeModal={state.setShowUpgradeModal}
          orgLimits={state.orgLimits}
          userRole={state.user?.role}
        />

        {/* My Classes */}
        <TeacherClasses
          myClasses={dashboardData?.myClasses || []}
          showAds={state.showAds}
        />

        {/* Recent Assignments */}
        <TeacherAssignments
          recentAssignments={dashboardData?.recentAssignments || []}
        />

        {/* Parent Link Requests (Teacher Approval) */}
        <View style={styles.section}>
          <PendingParentLinkRequests />
        </View>

        {/* Upcoming Events */}
        <TeacherEvents upcomingEvents={dashboardData?.upcomingEvents || []} />

        {/* Bottom Ad Placement: For long sessions */}
        {state.showAds && (
          <AdBannerWithUpgrade
            screen="teacher_dashboard"
            showUpgradeCTA={false}
            margin={16}
          />
        )}

        {/* Bottom Padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals */}
      <TeacherModals
        showUpgradeModal={state.showUpgradeModal}
        setShowUpgradeModal={state.setShowUpgradeModal}
        showOptionsMenu={state.showOptionsMenu}
        setShowOptionsMenu={state.setShowOptionsMenu}
        upgrading={state.upgrading}
        setUpgrading={state.setUpgrading}
        showWhatsAppModal={showWhatsAppModal}
        setShowWhatsAppModal={setShowWhatsAppModal}
      />
    </>
  );
};

export default TeacherDashboard;
