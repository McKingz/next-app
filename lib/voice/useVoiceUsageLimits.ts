/**
 * Voice Usage Limits Hook
 * 
 * Fetches and monitors voice usage quotas for the current user
 * Provides quota information and warnings for UI components
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface VoiceUsageQuota {
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
  daily: {
    stt_minutes_remaining: number;
    stt_minutes_total: number;
    tts_characters_remaining: number;
    tts_characters_total: number;
    cost_remaining_usd: number;
    cost_cap_usd: number;
  };
  monthly: {
    stt_minutes_remaining: number;
    stt_minutes_total: number;
    tts_characters_remaining: number;
    tts_characters_total: number;
    cost_remaining_usd: number;
    cost_cap_usd: number;
  };
}

export interface VoiceUsageLimitsState {
  quota: VoiceUsageQuota | null;
  loading: boolean;
  error: string | null;
  
  // Convenience flags
  isNearDailyLimit: boolean; // <20% remaining
  isNearMonthlyLimit: boolean; // <20% remaining
  canUseVoice: boolean;
  
  // Actions
  refresh: () => Promise<void>;
}

export function useVoiceUsageLimits(): VoiceUsageLimitsState {
  const { user, profile } = useAuth() as any;
  const preschoolId: string | undefined = (user?.user_metadata && (user.user_metadata as any).preschool_id) || profile?.organization_id;
  const [quota, setQuota] = useState<VoiceUsageQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchQuota = async () => {
    if (!user || !preschoolId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Check usage limits with minimal estimated units (just to get quota info)
      const { data, error: rpcError } = await supabase.rpc('check_voice_usage_limit', {
        p_user_id: user.id,
        p_preschool_id: preschoolId,
        p_service: 'stt',
        p_estimated_units: 0.01, // Minimal units just to check
      });
      
      if (rpcError) {
        throw rpcError;
      }
      
      if (!data || !data.quota_remaining) {
        throw new Error('No quota data returned');
      }
      
      // Get total limits from quotas table
      const { data: quotaConfig, error: quotaError } = await supabase
        .from('voice_usage_quotas')
        .select('*')
        .eq('subscription_tier', data.tier)
        .single();
      
      if (quotaError) {
        throw quotaError;
      }
      
      // Build quota object
      const quotaData: VoiceUsageQuota = {
        tier: data.tier,
        daily: {
          stt_minutes_remaining: data.quota_remaining.daily.stt_minutes_remaining,
          stt_minutes_total: quotaConfig.stt_daily_minutes,
          tts_characters_remaining: data.quota_remaining.daily.tts_characters_remaining,
          tts_characters_total: quotaConfig.tts_daily_characters,
          cost_remaining_usd: data.quota_remaining.daily.cost_remaining_usd,
          cost_cap_usd: quotaConfig.daily_cost_cap_usd,
        },
        monthly: {
          stt_minutes_remaining: data.quota_remaining.monthly.stt_minutes_remaining,
          stt_minutes_total: quotaConfig.stt_monthly_minutes,
          tts_characters_remaining: data.quota_remaining.monthly.tts_characters_remaining,
          tts_characters_total: quotaConfig.tts_monthly_characters,
          cost_remaining_usd: data.quota_remaining.monthly.cost_remaining_usd,
          cost_cap_usd: quotaConfig.monthly_cost_cap_usd,
        },
      };
      
      setQuota(quotaData);
      
    } catch (err) {
      console.error('[useVoiceUsageLimits] Failed to fetch quota:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch quota');
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchQuota();
  }, [user?.id, preschoolId]);
  
  // Calculate convenience flags
  const isNearDailyLimit = quota 
    ? (quota.daily.stt_minutes_remaining / quota.daily.stt_minutes_total) < 0.2
    : false;
  
  const isNearMonthlyLimit = quota
    ? (quota.monthly.stt_minutes_remaining / quota.monthly.stt_minutes_total) < 0.2
    : false;
  
  const canUseVoice = quota
    ? quota.daily.stt_minutes_remaining > 0 && quota.monthly.stt_minutes_remaining > 0
    : true; // Default to true if no quota data (fail-open)
  
  return {
    quota,
    loading,
    error,
    isNearDailyLimit,
    isNearMonthlyLimit,
    canUseVoice,
    refresh: fetchQuota,
  };
}
