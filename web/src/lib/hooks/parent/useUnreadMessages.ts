'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseUnreadMessagesReturn {
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUnreadMessages(userId: string | undefined, childId: string | null): UseUnreadMessagesReturn {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUnreadCount = useCallback(async () => {
    if (!userId || !childId) {
      setLoading(false);
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Get profile (profiles-first architecture)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, preschool_id')
        .eq('id', userId)
        .maybeSingle();

      if (!profile) {
        setUnreadCount(0);
        return;
      }

      // Count unread messages - using fallback to 0 until messaging system is implemented
      // TODO: Implement proper messaging system with messages table
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to load unread messages:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId, childId]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  return {
    unreadCount,
    loading,
    error,
    refetch: loadUnreadCount,
  };
}
