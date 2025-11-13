import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChildCard {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  date_of_birth?: string;
  grade: string;
  className: string | null;
  lastActivity: Date;
  homeworkPending: number;
  upcomingEvents: number;
  progressScore: number;
  status: 'active' | 'absent' | 'late';
}

interface UrgentMetrics {
  feesDue: { amount: number; dueDate: string | null; overdue: boolean } | null;
  unreadMessages: number;
  pendingHomework: number;
  todayAttendance: 'present' | 'absent' | 'late' | 'unknown';
  upcomingEvents: number;
}

interface UsageStats {
  ai_help: number;
  ai_lessons: number;
  tutoring_sessions: number;
}

export function useParentDashboardData() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [children, setChildren] = useState<any[]>([]);
  const [childrenCards, setChildrenCards] = useState<ChildCard[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [urgentMetrics, setUrgentMetrics] = useState<UrgentMetrics>({ 
    feesDue: null, 
    unreadMessages: 0, 
    pendingHomework: 0, 
    todayAttendance: 'unknown',
    upcomingEvents: 0 
  });
  const [usage, setUsage] = useState<UsageStats>({ ai_help: 0, ai_lessons: 0, tutoring_sessions: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUrgentMetrics = useCallback(async (studentId: string) => {
    try {
      const client = assertSupabase();
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data: studentData } = await client
        .from('students')
        .select('preschool_id, class_id')
        .eq('id', studentId)
        .single();
      
      if (!studentData) return;
      
      // Mock fees (will be real when payments table exists)
      const feesDue = {
        amount: Math.random() > 0.7 ? Math.floor(Math.random() * 5000) + 500 : 0,
        dueDate: Math.random() > 0.5 ? thirtyDaysFromNow : null,
        overdue: Math.random() > 0.8
      };
      
      // Pending homework
      let pendingHomework = 0;
      if (studentData.class_id) {
        const { data: assignments } = await client
          .from('homework_assignments')
          .select('id')
          .eq('class_id', studentData.class_id)
          .gte('due_date', today)
          .limit(10);
        
        if (assignments) {
          const assignmentIds = assignments.map(a => a.id);
          const { data: submissions } = await client
            .from('homework_submissions')
            .select('assignment_id')
            .eq('student_id', studentId)
            .in('assignment_id', assignmentIds);
          
          const submittedIds = new Set(submissions?.map(s => s.assignment_id) || []);
          pendingHomework = assignmentIds.filter(id => !submittedIds.has(id)).length;
        }
      }
      
      // Today's attendance
      let todayAttendance: 'present' | 'absent' | 'late' | 'unknown' = 'unknown';
      try {
        const { data: attendanceData } = await client
          .from('attendance_records')
          .select('status')
          .eq('student_id', studentId)
          .eq('date', today)
          .maybeSingle();
        
        if (attendanceData) {
          const status = String(attendanceData.status).toLowerCase();
          todayAttendance = ['present', 'absent', 'late'].includes(status) 
            ? status as 'present' | 'absent' | 'late' 
            : 'unknown';
        }
      } catch {}
      
      // Upcoming events
      let upcomingEvents = 0;
      if (studentData.class_id) {
        try {
          const { count } = await client
            .from('class_events')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', studentData.class_id)
            .gte('start_time', new Date().toISOString())
            .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
          
          upcomingEvents = count || 0;
        } catch {}
      }
      
      setUrgentMetrics({
        feesDue: feesDue.amount > 0 ? feesDue : null,
        unreadMessages: 0, // Set by parent component
        pendingHomework,
        todayAttendance,
        upcomingEvents
      });
      
    } catch (error) {
      console.error('Failed to load urgent metrics:', error);
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (user?.id) {
        const client = assertSupabase();
        let studentsData: any[] = [];
        
        try {
          const { data: me } = await client
            .from('users')
            .select('id, preschool_id')
            .eq('auth_user_id', user.id)
            .single();
          const internalUserId = me?.id;
          const mySchoolId = me?.preschool_id || (profile as any)?.organization_id || null;

          const { data: directChildren } = internalUserId ? await client
            .from('students')
            .select(`
              id, first_name, last_name, class_id, is_active, preschool_id, date_of_birth, parent_id, guardian_id,
              classes!left(id, name, grade_level)
            `)
            .or(`parent_id.eq.${internalUserId},guardian_id.eq.${internalUserId}`)
            .eq('is_active', true)
            .maybeSingle() : { data: null } as any;

          let directChildrenList: any[] = [];
          if (directChildren) {
            directChildrenList = Array.isArray(directChildren) ? directChildren : [directChildren];
          }

          if (directChildrenList.length > 0) {
            studentsData = directChildrenList;
          }
          // Removed: Don't show unclaimed children from school
          // Parents must use "Claim Child" search to find and request linking
        } catch (error) {
          console.error('Error loading children:', error);
        }
        
        const realChildren = studentsData || [];
        setChildren(realChildren);
        if (realChildren.length > 0) {
          setActiveChildId(realChildren[0].id);
        }

        // Build child cards
        const nowIso = new Date().toISOString();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        async function buildCard(child: any): Promise<ChildCard> {
          let lastActivity: Date = new Date();
          let status: 'active' | 'absent' | 'late' = 'active';
          let progressScore = 75;
          let homeworkPending = 0;
          let upcomingEvents = 0;

          try {
            const { data: latestAtt } = await client
              .from('attendance_records')
              .select('status, date, created_at')
              .eq('student_id', child.id)
              .order('date', { ascending: false })
              .limit(1);
            if (latestAtt && latestAtt[0]) {
              lastActivity = new Date(latestAtt[0].created_at || latestAtt[0].date);
              const st = String(latestAtt[0].status || '').toLowerCase();
              status = st === 'late' ? 'late' : st === 'absent' ? 'absent' : 'active';
            }
            const { data: windowAtt } = await client
              .from('attendance_records')
              .select('status')
              .eq('student_id', child.id)
              .gte('date', thirtyDaysAgo)
              .limit(1000);
            if (windowAtt && windowAtt.length > 0) {
              const present = windowAtt.filter((a: any) => String(a.status).toLowerCase() === 'present').length;
              const ratio = present / windowAtt.length;
              progressScore = Math.max(60, Math.min(100, Math.round(60 + ratio * 40)));
            }
          } catch {}

          try {
            if (child.class_id) {
              const { data: assignments } = await client
                .from('homework_assignments')
                .select('id, due_date')
                .eq('class_id', child.class_id)
                .gte('due_date', new Date(Date.now() - 7*24*60*60*1000).toISOString())
                .lte('due_date', new Date(Date.now() + 14*24*60*60*1000).toISOString());
              const assignmentIds = (assignments || []).map((a: any) => a.id);
              if (assignmentIds.length > 0) {
                const { data: subs } = await client
                  .from('homework_submissions')
                  .select('assignment_id')
                  .eq('student_id', child.id)
                  .in('assignment_id', assignmentIds);
                const submittedSet = new Set((subs || []).map((s: any) => s.assignment_id));
                homeworkPending = assignmentIds.filter((id: string) => !submittedSet.has(id)).length;
              } else {
                homeworkPending = 0;
              }
            }
          } catch {
            homeworkPending = 0;
          }

          try {
            if (child.class_id) {
              const { data: events } = await client
                .from('class_events')
                .select('id, start_time')
                .eq('class_id', child.class_id)
                .gte('start_time', nowIso)
                .limit(3);
              upcomingEvents = (events || []).length;
            }
          } catch {
            upcomingEvents = 0;
          }

          return {
            id: child.id,
            firstName: child.first_name,
            lastName: child.last_name,
            dateOfBirth: child.date_of_birth,
            grade: child.classes?.grade_level || t('students.preschool'),
            className: child.classes?.name || (child.class_id ? `Class ${String(child.class_id).slice(-4)}` : null),
            lastActivity,
            homeworkPending,
            upcomingEvents,
            progressScore,
            status,
          };
        }

        const cards = await Promise.all(realChildren.map(buildCard));
        setChildrenCards(cards);
        
        if (cards.length > 0 && !activeChildId) {
          const savedChildId = await AsyncStorage.getItem('@edudash_active_child_id');
          const validChildId = savedChildId && cards.find(c => c.id === savedChildId) ? savedChildId : cards[0].id;
          setActiveChildId(validChildId);
        }
        
        if (cards.length > 0) {
          const targetChild = cards.find(c => c.id === (activeChildId || cards[0].id));
          if (targetChild) {
            await loadUrgentMetrics(targetChild.id);
          }
        }

        // Load AI usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: usageData } = await client
          .from('ai_usage_logs')
          .select('service_type')
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth.toISOString());

        if (usageData) {
          const homeworkCount = usageData.filter(u => u.service_type === 'homework_help').length;
          const lessonCount = usageData.filter(u => u.service_type === 'lesson_generation').length;
          setUsage({ ai_help: homeworkCount, ai_lessons: lessonCount, tutoring_sessions: 0 });
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [user?.id, t, activeChildId, profile, loadUrgentMetrics]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (activeChildId) {
      AsyncStorage.setItem('@edudash_active_child_id', activeChildId).catch(() => {});
      if (activeChildId && childrenCards.find(c => c.id === activeChildId)) {
        loadUrgentMetrics(activeChildId);
      }
    }
  }, [activeChildId, childrenCards, loadUrgentMetrics]);

  return {
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
  };
}
