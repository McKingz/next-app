'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ChildCard {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  grade: string;
  className: string | null;
  lastActivity: Date;
  homeworkPending: number;
  upcomingEvents: number;
  progressScore: number;
  status: 'active' | 'absent' | 'late';
  avatarUrl?: string | null;
}

interface UseChildrenDataReturn {
  children: any[];
  childrenCards: ChildCard[];
  activeChildId: string | null;
  setActiveChildId: (id: string) => void;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useChildrenData(userId: string | undefined): UseChildrenDataReturn {
  const [children, setChildren] = useState<any[]>([]);
  const [childrenCards, setChildrenCards] = useState<ChildCard[]>([]);
  const [activeChildId, setActiveChildIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setActiveChildId = useCallback((id: string) => {
    setActiveChildIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('edudash_active_child_id', id);
    }
  }, []);

  const buildChildCard = useCallback(async (child: any, supabase: ReturnType<typeof createClient>): Promise<ChildCard> => {
    const today = new Date().toISOString().split('T')[0];
    let lastActivity = new Date();
    let status: 'active' | 'absent' | 'late' = 'active';

    // Check attendance
    try {
      const { data: att } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', child.id)
        .eq('preschool_id', child.preschool_id)
        .eq('attendance_date', today)
        .maybeSingle();
      if (att) {
        const s = String(att.status).toLowerCase();
        status = ['present', 'absent', 'late'].includes(s) ? (s as any) : 'active';
      }
    } catch {}

    // Homework & events counts (simplified for card view)
    let homeworkPending = 0;
    let upcomingEvents = 0;
    if (child.class_id) {
      try {
        const { count: hwCount } = await supabase
          .from('homework_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', child.class_id)
          .eq('preschool_id', child.preschool_id)
          .gte('due_date', today);
        homeworkPending = hwCount || 0;
      } catch {}
      try {
        const { count: evCount } = await supabase
          .from('class_events')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', child.class_id)
          .eq('preschool_id', child.preschool_id)
          .gte('start_time', new Date().toISOString());
        upcomingEvents = evCount || 0;
      } catch {}
    }

    return {
      id: child.id,
      firstName: child.first_name,
      lastName: child.last_name,
      dateOfBirth: child.date_of_birth,
      grade: child.classes?.grade_level || 'Preschool',
      className: child.classes?.name || (child.class_id ? `Class ${String(child.class_id).slice(-4)}` : null),
      lastActivity,
      homeworkPending,
      upcomingEvents,
      progressScore: 75,
      status,
      avatarUrl: child.avatar_url || child.profile_picture_url || null,
    };
  }, []);

  const loadChildrenData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      let studentsData: any[] = [];

      // Use profiles table (users table is deprecated)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, preschool_id')
        .eq('id', userId)
        .maybeSingle();

      if (!profileData) {
        console.error('❌ User profile not found in profiles table for user_id:', userId);
        setError('Profile not found. Please complete registration or contact support.');
        setLoading(false);
        return;
      }

      if (profileError) {
        console.error('❌ Error fetching profile:', profileError);
      }

      const userProfileId = profileData.id;
      const userPreschoolId = profileData.preschool_id;

      // Check if user has preschool linked
      if (!userPreschoolId) {
        console.log('ℹ️ [useChildrenData] Standalone user - not linked to a school yet');
        console.log('💡 [useChildrenData] User can link to school via "Join School" or "Claim Child" options');
        // Return empty data gracefully - this is expected for standalone users
        setChildren([]);
        setChildrenCards([]);
        setLoading(false);
        return;
      }

      console.log('✅ [useChildrenData] Fetching children for school-linked user:', { userProfileId, userPreschoolId });

      // Fetch children linked to this parent
      const { data: directChildren, error: studentsError } = await supabase
        .from('students')
        .select(`
          id, first_name, last_name, class_id, is_active, preschool_id, date_of_birth, parent_id, guardian_id, avatar_url,
          classes!left(id, name, grade_level)
        `)
        .or(`parent_id.eq.${userProfileId},guardian_id.eq.${userProfileId}`)
        .eq('is_active', true)
        .eq('preschool_id', userPreschoolId);

      if (studentsError) {
        console.error('❌ Error fetching students:', studentsError);
      }

      studentsData = directChildren || [];
      setChildren(studentsData);

      // Build child cards with detailed info
      const cards = await Promise.all(
        studentsData.map((child) => buildChildCard(child, supabase))
      );
      setChildrenCards(cards);

      // Set active child
      if (cards.length > 0) {
        const savedChildId = typeof window !== 'undefined' 
          ? localStorage.getItem('edudash_active_child_id')
          : null;
        const validChildId = savedChildId && cards.find((c) => c.id === savedChildId)
          ? savedChildId
          : cards[0].id;
        setActiveChildIdState(validChildId);
      }
    } catch (err) {
      console.error('Failed to load children data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId, buildChildCard]);

  useEffect(() => {
    loadChildrenData();
  }, [loadChildrenData]);

  return {
    children,
    childrenCards,
    activeChildId,
    setActiveChildId,
    loading,
    error,
    refetch: loadChildrenData,
  };
}
