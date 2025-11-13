/**
 * Teacher Dashboard State Hook
 * Manages all state, capabilities, seat status, AI gating, and org limits
 */

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTeacherHasSeat } from '@/lib/hooks/useSeatLimits';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { assertSupabase } from '@/lib/supabase';
import type { OrgLimits } from '@/components/dashboard/teacher/types';

export const useTeacherDashboardState = () => {
  const flags = getFeatureFlagsSync();
  const AI_ENABLED =
    (process.env.EXPO_PUBLIC_AI_ENABLED !== "false") &&
    (process.env.EXPO_PUBLIC_ENABLE_AI_FEATURES !== "false");

  const { user, profile, refreshProfile } = useAuth();
  const { ready: subscriptionReady, tier } = useSubscription();
  const hasPremiumOrHigher = ['premium','pro','enterprise'].includes(String(tier || '')) as boolean;

  // Seat and plan status
  const seatStatus = profile?.seat_status || "inactive";
  const teacherHasSeat = useTeacherHasSeat(user?.id || "");
  const hasActiveSeat = teacherHasSeat || profile?.hasActiveSeat?.() || seatStatus === "active";
  const planTier = (profile as any)?.organization_membership?.plan_tier || (profile as any)?.plan_tier || 'unknown';

  // Capability-driven AI gating
  const aiLessonCap = !!profile?.hasCapability?.("ai_lesson_generation" as any);
  const aiGradingCap = !!profile?.hasCapability?.("ai_grading_assistance" as any);
  const aiHelperCap = !!profile?.hasCapability?.("ai_homework_helper" as any);

  // AI feature flags
  const aiLessonEnabled = (aiLessonCap || hasActiveSeat) && AI_ENABLED && flags.ai_lesson_generation !== false;
  const aiGradingEnabled = (aiGradingCap || hasActiveSeat) && AI_ENABLED && flags.ai_grading_assistance !== false;
  const aiHelperEnabled = (aiHelperCap || hasActiveSeat) && AI_ENABLED && flags.ai_homework_help !== false;

  // Ad gating logic
  const showAds = subscriptionReady && tier === 'free';

  // Temporary AI tool unlocks via rewarded ads
  const [aiTempUnlocks, setAiTempUnlocks] = React.useState<Record<string, number>>({});

  // Upgrade nudge
  const [showUpgradeNudge, setShowUpgradeNudge] = React.useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = React.useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  const [upgrading, setUpgrading] = React.useState(false);

  // Organization limits (for principals/admins)
  const [orgLimits, setOrgLimits] = React.useState<OrgLimits | null>(null);

  // Teacher info
  const teacherName = profile?.first_name
    ? profile.first_name
    : user?.user_metadata?.first_name
      ? user.user_metadata.first_name
      : profile?.email?.split("@")[0] || "Teacher";
  const schoolName = profile?.organization_name || "School";

  // Capability checker
  const hasCap = React.useCallback(
    (cap: string) => {
      if (hasActiveSeat) {
        const basicTeacherCaps = [
          "manage_classes",
          "create_assignments",
          "grade_assignments",
          "view_class_analytics",
          "communicate_with_parents",
        ];
        if (basicTeacherCaps.includes(cap)) return true;
      }
      return !!profile?.hasCapability && profile.hasCapability(cap as any);
    },
    [profile, hasActiveSeat],
  );

  const canCreateAssignments = hasCap("create_assignments");
  const canGradeAssignments = hasCap("grade_assignments");
  const canViewAnalytics = hasCap("view_class_analytics");

  // Show seat pending banner
  const showSeatPending =
    profile?.role &&
    String(profile.role).toLowerCase().includes("teacher") &&
    (profile?.seat_status === "pending" || !hasActiveSeat);

  // Debug logging
  React.useEffect(() => {
    const show = true;
    if (!show) return;
    try {
      const caps = Array.isArray((profile as any)?.capabilities) ? (profile as any).capabilities : [];
      console.log('[TeacherDashboard debug]', {
        user_id: user?.id,
        seat_status: seatStatus,
        teacherHasSeat_hook: teacherHasSeat,
        profile_hasActiveSeat: profile?.hasActiveSeat?.(),
        combined_hasActiveSeat: hasActiveSeat,
        plan_tier: planTier,
        ai_caps: {
          ai_lesson_generation: !!caps.includes?.('ai_lesson_generation'),
          ai_grading_assistance: !!caps.includes?.('ai_grading_assistance'),
          ai_homework_helper: !!caps.includes?.('ai_homework_helper'),
        },
        all_caps_count: caps?.length || 0,
      });
    } catch {}
  }, [user?.id, seatStatus, teacherHasSeat, hasActiveSeat, planTier, (profile as any)?.capabilities]);

  // Upgrade nudge logic
  React.useEffect(() => {
    const isTeacher = String(profile?.role || "").toLowerCase().includes("teacher");
    const hasSchoolSeats = !!profile?.organization_membership || hasActiveSeat;
    const hasAnyAICap = aiLessonCap || aiGradingCap;

    if (isTeacher && hasSchoolSeats) {
      setShowUpgradeNudge(false);
      return;
    }

    if (!hasAnyAICap) {
      setShowUpgradeNudge(Math.random() < 0.33);
    } else {
      setShowUpgradeNudge(false);
    }
  }, [aiLessonCap, aiGradingCap, profile?.role, hasActiveSeat, profile?.organization_membership]);

  // Fetch org limits (for principals/admins)
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (user?.role === "principal_admin") {
          const { data: userRes } = await assertSupabase().auth.getUser();
          const uid = userRes?.user?.id;
          if (uid) {
            const { data: prof } = await assertSupabase()
              .from("profiles")
              .select("preschool_id")
              .eq("id", uid)
              .maybeSingle();
            const orgId = (prof as any)?.preschool_id;
            if (orgId) {
              const { data: limitsRes } = await assertSupabase().functions.invoke("ai-usage", {
                body: { action: "org_limits", organization_id: orgId } as any,
              });
              if (mounted && limitsRes && (limitsRes.used || limitsRes.quotas)) {
                setOrgLimits({
                  used: {
                    lesson_generation: Number(limitsRes.used?.lesson_generation || 0),
                    grading_assistance: Number(limitsRes.used?.grading_assistance || 0),
                    homework_help: Number(limitsRes.used?.homework_help || 0),
                  },
                  quotas: {
                    lesson_generation: Number(limitsRes.quotas?.lesson_generation || 0),
                    grading_assistance: Number(limitsRes.quotas?.grading_assistance || 0),
                    homework_help: Number(limitsRes.quotas?.homework_help || 0),
                  },
                });
              }
            }
          }
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [user?.role]);

  return {
    // Auth & profile
    user,
    profile,
    refreshProfile,
    teacherName,
    schoolName,

    // Subscription & ads
    tier,
    hasPremiumOrHigher,
    showAds,

    // Seat & capabilities
    seatStatus,
    hasActiveSeat,
    planTier,
    hasCap,
    canCreateAssignments,
    canGradeAssignments,
    canViewAnalytics,
    showSeatPending,

    // AI features
    AI_ENABLED,
    aiLessonEnabled,
    aiGradingEnabled,
    aiHelperEnabled,
    aiLessonCap,
    aiGradingCap,
    aiHelperCap,
    aiTempUnlocks,
    setAiTempUnlocks,

    // Org limits
    orgLimits,

    // Modals & UI state
    showUpgradeNudge,
    setShowUpgradeNudge,
    showOptionsMenu,
    setShowOptionsMenu,
    showUpgradeModal,
    setShowUpgradeModal,
    upgrading,
    setUpgrading,
  };
};
