import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AIQuotaStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
  current_tier: string;
  upgrade_available: boolean;
}

interface AIUsageStats {
  exams_generated_this_month: number;
  explanations_requested_this_month: number;
  chat_messages_today: number;
  total_exams_generated: number;
  total_explanations_requested: number;
  total_chat_messages: number;
  current_tier: string;
}

export function useAIQuota() {
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<AIUsageStats | null>(null);
  const supabase = createClient();

  // Fetch current usage stats
  const fetchUsage = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_ai_usage')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching AI usage:', error);
        return;
      }

      setUsage(data);
    } catch (error) {
      console.error('Error in fetchUsage:', error);
    }
  }, [supabase]);

  // Check if user can make a specific type of AI request
  const checkQuota = useCallback(async (requestType: 'exam_generation' | 'explanation' | 'chat_message'): Promise<AIQuotaStatus> => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.rpc('check_ai_usage_limit', {
        p_user_id: user.id,
        p_request_type: requestType
      });

      if (error) throw error;

      return data as AIQuotaStatus;
    } catch (error) {
      console.error('Error checking AI quota:', error);
      // Return conservative default on error
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        current_tier: 'free',
        upgrade_available: true
      };
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Increment usage counter after successful request
  const incrementUsage = useCallback(async (
    requestType: 'exam_generation' | 'explanation' | 'chat_message',
    status: 'success' | 'failed' | 'rate_limited' = 'success',
    metadata: any = {}
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc('increment_ai_usage', {
        p_user_id: user.id,
        p_request_type: requestType,
        p_status: status,
        p_metadata: metadata
      });

      // Refresh usage stats
      await fetchUsage();
    } catch (error) {
      console.error('Error incrementing AI usage:', error);
    }
  }, [supabase, fetchUsage]);

  // Check quota and execute callback if allowed
  const withQuotaCheck = useCallback(async <T,>(
    requestType: 'exam_generation' | 'explanation' | 'chat_message',
    callback: () => Promise<T>,
    onQuotaExceeded?: (status: AIQuotaStatus) => void
  ): Promise<T | null> => {
    const quotaStatus = await checkQuota(requestType);

    if (!quotaStatus.allowed) {
      if (onQuotaExceeded) {
        onQuotaExceeded(quotaStatus);
      } else {
        // Default quota exceeded message
        const typeLabel = requestType.replace('_', ' ');
        alert(
          `⚠️ AI Quota Exceeded\n\n` +
          `You've reached your ${typeLabel} limit (${quotaStatus.limit} per ${requestType === 'chat_message' ? 'day' : 'month'}).\n\n` +
          `${quotaStatus.upgrade_available ? 'Upgrade to continue using AI features!' : 'Please try again later.'}`
        );
      }
      await incrementUsage(requestType, 'rate_limited');
      return null;
    }

    // Show warning if approaching limit
    if (quotaStatus.remaining <= 3 && quotaStatus.remaining > 0) {
      console.warn(`⚠️ AI Quota Warning: ${quotaStatus.remaining} ${requestType} remaining`);
    }

    try {
      const result = await callback();
      await incrementUsage(requestType, 'success');
      return result;
    } catch (error) {
      await incrementUsage(requestType, 'failed', { error: String(error) });
      throw error;
    }
  }, [checkQuota, incrementUsage]);

  // Fetch usage on mount
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    usage,
    loading,
    checkQuota,
    incrementUsage,
    withQuotaCheck,
    fetchUsage,
    // Helper computed values
    hasExamsRemaining: usage ? usage.exams_generated_this_month < 999 : true,
    hasExplanationsRemaining: usage ? usage.explanations_requested_this_month < 999 : true,
    hasChatRemaining: usage ? usage.chat_messages_today < 999 : true,
  };
}
