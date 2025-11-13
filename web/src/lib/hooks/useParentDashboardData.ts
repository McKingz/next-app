                    'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useChildrenData } from '@/lib/hooks/parent/useChildrenData';
import { useChildMetrics } from '@/lib/hooks/parent/useChildMetrics';
import { useUnreadMessages } from '@/lib/hooks/parent/useUnreadMessages';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';

export interface TrialStatus {
  is_trial: boolean;
  days_remaining: number;
  plan_tier: string;
  plan_name: string;
}

export function useParentDashboardData() {
  const supabase = createClient();
  
  // Auth state
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  
  // Trial state
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  
  // Fetch user ID
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
      setAuthLoading(false);
    };
    initAuth();
  }, [supabase]);
  
  // Use custom hooks
  const { profile, loading: profileLoading, refetch: refetchProfile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const {
    childrenCards,
    activeChildId,
    setActiveChildId,
    loading: childrenLoading,
    refetch: refetchChildren,
  } = useChildrenData(userId);
  const { metrics } = useChildMetrics(activeChildId);
  const { unreadCount } = useUnreadMessages(userId, activeChildId);
  
  // Derived values
  const userName = profile?.firstName || profile?.email?.split('@')[0] || 'User';
  const usageType = profile?.usageType;
  const hasOrganization = !!profile?.preschoolId;
  
  // Show "EduDash Pro Community" for standalone users, actual school name for org users
  const preschoolName = hasOrganization 
    ? profile?.preschoolName 
    : 'EduDash Pro Community';
  
  // Profile validation (no debug logs in production)
  
  // Fetch trial status
  useEffect(() => {
    const loadTrialStatus = async () => {
      if (!userId) return;
      
      try {
        const { data, error } = await supabase.rpc('get_my_trial_status');
        
        if (error) {
          // Silent fail - RPC might not exist in some environments
          return;
        }
        
        // Start with RPC value
        let status: TrialStatus | null = data as any;
        
        // Fallback: derive from profile flags (user-level trial)
        if ((!status || status.is_trial === false) && profile?.is_trial && profile.trial_end_date) {
          const trialEnd = new Date(profile.trial_end_date);
          const now = new Date();
          if (trialEnd > now) {
            const days_remaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            status = {
              is_trial: true,
              days_remaining,
              plan_tier: 'premium',
              plan_name: 'Premium',
            };
          }
        }
        
        setTrialStatus(status);
      } catch (err) {
        // Silent fail - trial status is optional
      }
    };
    
    loadTrialStatus();
  }, [userId, supabase, profile]);
  
  return {
    // Auth
    userId,
    authLoading,
    
    // Profile
    profile,
    profileLoading,
    refetchProfile,
    userName,
    preschoolName,
    usageType,
    hasOrganization,
    tenantSlug,
    
    // Children
    childrenCards,
    activeChildId,
    setActiveChildId,
    childrenLoading,
    refetchChildren,
    
    // Metrics
    metrics,
    unreadCount,
    
    // Trial
    trialStatus,
    
    // Computed
    loading: authLoading || profileLoading,
  };
}
