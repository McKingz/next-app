'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface UrgentMetrics {
  feesDue: {
    amount: number;
    dueDate: string | null;
    overdue: boolean;
  } | null;
  unreadMessages: number;
  pendingHomework: number;
  todayAttendance: 'present' | 'absent' | 'late' | 'unknown';
  upcomingEvents: number;
}

interface UseChildMetricsReturn {
  metrics: UrgentMetrics;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useChildMetrics(childId: string | null): UseChildMetricsReturn {
  const [metrics, setMetrics] = useState<UrgentMetrics>({
    feesDue: null,
    unreadMessages: 0,
    pendingHomework: 0,
    todayAttendance: 'unknown',
    upcomingEvents: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    if (!childId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Get student data
      const { data: studentData } = await supabase
        .from('students')
        .select('preschool_id, class_id')
        .eq('id', childId)
        .single();

      if (!studentData) {
        throw new Error('Student not found');
      }

      // Fetch outstanding fees from payments table
      let feesDue: { amount: number; dueDate: string | null; overdue: boolean } | null = null;
      try {
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('amount, created_at, status')
          .eq('student_id', childId)
          .eq('preschool_id', studentData.preschool_id)
          .in('status', ['pending', 'overdue'])
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!paymentsError && payments && payments.amount > 0) {
          const isOverdue = payments.status === 'overdue';
          feesDue = {
            amount: payments.amount,
            dueDate: null,
            overdue: isOverdue,
          };
        }
      } catch (err) {
        // Silently handle - payments table may not exist yet
      }

      // Pending homework
      let pendingHomework = 0;
      if (studentData.class_id) {
        const { data: assignments } = await supabase
          .from('homework_assignments')
          .select('id')
          .eq('class_id', studentData.class_id)
          .eq('preschool_id', studentData.preschool_id)
          .gte('due_date', today)
          .limit(10);

        if (assignments && assignments.length > 0) {
          const assignmentIds = assignments.map((a) => a.id);
          const { data: submissions } = await supabase
            .from('homework_submissions')
            .select('assignment_id')
            .eq('student_id', childId)
            .eq('preschool_id', studentData.preschool_id)
            .in('assignment_id', assignmentIds);

          const submittedIds = new Set(submissions?.map((s) => s.assignment_id) || []);
          pendingHomework = assignmentIds.filter((id) => !submittedIds.has(id)).length;
        }
      }

      // Today's attendance
      let todayAttendance: 'present' | 'absent' | 'late' | 'unknown' = 'unknown';
      try {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance_records')
          .select('status, attendance_date')
          .eq('student_id', childId)
          .eq('preschool_id', studentData.preschool_id)
          .eq('attendance_date', today)
          .maybeSingle();

        if (!attendanceError && attendanceData) {
          const status = String(attendanceData.status).toLowerCase();
          todayAttendance = ['present', 'absent', 'late'].includes(status)
            ? (status as 'present' | 'absent' | 'late')
            : 'unknown';
        }
      } catch (err) {
        // Silently handle - attendance_records table may not exist yet
      }

      // Upcoming events (next 7 days)
      let upcomingEvents = 0;
      if (studentData.class_id) {
        try {
          const { count } = await supabase
            .from('class_events')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', studentData.class_id)
            .eq('preschool_id', studentData.preschool_id)
            .gte('start_time', new Date().toISOString())
            .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

          upcomingEvents = count || 0;
        } catch (err) {
          console.error('Error fetching events:', err);
        }
      }

      setMetrics({
        feesDue,
        unreadMessages: 0, // Set by parent component or separate hook
        pendingHomework,
        todayAttendance,
        upcomingEvents,
      });
    } catch (err) {
      console.error('Failed to load child metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return {
    metrics,
    loading,
    error,
    refetch: loadMetrics,
  };
}
