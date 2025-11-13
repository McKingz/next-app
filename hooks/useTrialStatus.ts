import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';

export interface TrialStatus {
  is_trial: boolean;
  trial_end_date: string | null;
  days_remaining: number;
  plan_tier: string;
  plan_name: string;
  message?: string;
}

/**
 * Hook to get the current user's trial status
 * 
 * Returns trial information including:
 * - Whether account is in trial
 * - Days remaining in trial
 * - Current plan details
 * 
 * Refetches every 5 minutes to keep trial countdown current
 */
export function useTrialStatus() {
  return useQuery({
    queryKey: ['trial-status'],
    queryFn: async (): Promise<TrialStatus> => {
      const supabase = assertSupabase();
      
      const { data, error } = await supabase.rpc('get_my_trial_status');
      
      if (error) {
        console.error('[useTrialStatus] Error fetching trial status:', error);
        throw error;
      }
      
      return data as TrialStatus;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

/**
 * Helper function to determine if trial is expiring soon
 * @param daysRemaining - Number of days left in trial
 * @param threshold - Number of days to consider "expiring soon" (default: 3)
 */
export function isTrialExpiringSoon(daysRemaining: number, threshold: number = 3): boolean {
  return daysRemaining > 0 && daysRemaining <= threshold;
}

/**
 * Helper function to get trial urgency level
 * @param daysRemaining - Number of days left in trial
 */
export function getTrialUrgency(daysRemaining: number): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  if (daysRemaining <= 0) return 'critical';
  if (daysRemaining === 1) return 'high';
  if (daysRemaining <= 3) return 'medium';
  if (daysRemaining <= 7) return 'low';
  return 'none';
}
