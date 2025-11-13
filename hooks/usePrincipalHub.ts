/* eslint-disable @typescript-eslint/no-unused-vars */

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { usePettyCashDashboard } from './usePettyCashDashboard';
import { useTranslation } from 'react-i18next';

// Polyfill for Promise.allSettled (for older JavaScript engines)
if (!Promise.allSettled) {
  Promise.allSettled = function <T>(promises: Array<Promise<T>>): Promise<Array<PromiseSettledResult<T>>> {
    return Promise.all(
      promises.map((promise) =>
        Promise.resolve(promise)
          .then((value) => ({ status: 'fulfilled' as const, value }))
          .catch((reason) => ({ status: 'rejected' as const, reason }))
      )
    );
  };
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const PRINCIPAL_HUB_API = `${SUPABASE_URL}/functions/v1/principal-hub-api`;

// Global fetch guard to avoid duplicate initial fetches in dev (React StrictMode double-mount)
const __FETCH_GUARD: Record<string, number> = ((global as any).__EDUDASH_FETCH_GUARD__ ??= {});

export interface SchoolStats {
  students: { total: number; trend: string };
  staff: { total: number; trend: string };
  classes: { total: number; trend: string };
  pendingApplications: { total: number; trend: string };
  monthlyRevenue: { total: number; trend: string };
  attendanceRate: { percentage: number; trend: string };
  timestamp: string;
}

export interface TeacherSummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  subject_specialization?: string;
  hire_date?: string;
  classes_assigned: number;
  students_count: number;
  status: 'excellent' | 'good' | 'needs_attention';
  performance_indicator: string;
}

export interface FinancialSummary {
  monthlyRevenue: number;
  previousMonthRevenue: number;
  estimatedExpenses: number;
  netProfit: number;
  revenueGrowth: number;
  profitMargin: number;
  pettyCashBalance: number;
  pettyCashExpenses: number;
  pendingApprovals: number;
  timestamp: string;
}

export interface CapacityMetrics {
  capacity: number;
  current_enrollment: number;
  available_spots: number;
  utilization_percentage: number;
  enrollment_by_age: {
    toddlers: number;
    preschool: number;
    prekindergarten: number;
  };
  status: 'full' | 'high' | 'available';
  timestamp: string;
}

export interface EnrollmentPipeline {
  pending: number;
  approved: number;
  rejected: number;
  waitlisted: number;
  total: number;
}

export interface ActivitySummary {
  type: 'enrollment' | 'application';
  title: string;
  timestamp: string;
  status?: string;
  icon: string;
}

export interface PrincipalHubData {
  stats: SchoolStats | null;
  teachers: TeacherSummary[] | null;
  financialSummary: FinancialSummary | null;
  enrollmentPipeline: EnrollmentPipeline | null;
  capacityMetrics: CapacityMetrics | null;
  recentActivities: ActivitySummary[] | null;
  pendingReportApprovals: number;
  schoolId: string | null;
  schoolName: string;
}

// API helper function
const apiCall = async (endpoint: string, user?: any) => {
  // Try to get current session
  let accessToken = null;
  
  try {
    const { data: { session }, error } = await assertSupabase().auth.getSession();
    
    if (error) {
      logger.warn('Session error:', error);
    }
    
    if (session?.access_token) {
      accessToken = session.access_token;
    } else {
      // Fallback: Try to get user and refresh session
      const { data: { user: currentUser }, error: userError } = await assertSupabase().auth.getUser();
      
      if (userError || !currentUser) {
        throw new Error('User not authenticated - please log in again');
      }
      
      // Try refreshing the session
      const { data: { session: newSession }, error: refreshError } = await assertSupabase().auth.refreshSession();
      
      if (refreshError || !newSession?.access_token) {
        throw new Error('Unable to refresh authentication - please log in again');
      }
      
      accessToken = newSession.access_token;
    }
  } catch (err) {
    console.error('Auth error in apiCall:', err);
    throw new Error('Authentication failed - please log in again');
  }
  
  if (!accessToken) {
    throw new Error('No authentication token available');
  }

  const response = await fetch(`${PRINCIPAL_HUB_API}/${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`API call failed for ${endpoint}:`, response.status, errorData);
    throw new Error(errorData.error || `API call failed: ${response.status}`);
  }

  return response.json();
};

export const usePrincipalHub = () => {
  const { user, profile } = useAuth();
  const { metrics: pettyCashMetrics } = usePettyCashDashboard();
  const { t } = useTranslation();
  const [data, setData] = useState<PrincipalHubData>({
    stats: null,
    teachers: null,
    financialSummary: null,
    enrollmentPipeline: null,
    capacityMetrics: null,
    recentActivities: null,
    pendingReportApprovals: 0,
    schoolId: null,
    schoolName: t('dashboard.no_school_assigned_text')
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Get preschool ID from profile
  // Helper function for currency formatting
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `R${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `R${(amount / 1000).toFixed(0)}k`;
    } else {
      return `R${amount.toFixed(0)}`;
    }
  };

  const userId = user?.id ?? null;

  const preschoolId = useMemo((): string | null => {
    if (profile?.organization_id) {
      return profile.organization_id as string;
    }
    const userMetaPreschoolId = user?.user_metadata?.preschool_id;
    return userMetaPreschoolId ?? null;
  }, [profile?.organization_id, user?.user_metadata?.preschool_id]);

  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);
  // Additional guard: track if initial fetch completed
  const initialFetchComplete = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async (forceRefresh = false) => {
    const fetchId = `${preschoolId}-${Date.now()}`;
    logger.info('📊 [PrincipalHub] Fetch initiated:', {
      fetchId,
      preschoolId,
      userId,
      forceRefresh,
      inFlight: inFlightRef.current,
      initialFetchComplete: initialFetchComplete.current,
      profileOrgId: profile?.organization_id,
      userMetadata: user?.user_metadata
    });
    
    if (!preschoolId) {
      logger.warn('[PrincipalHub] No preschool ID available');
      setError('School not assigned');
      if (isMountedRef.current) setLoading(false);
      return;
    }

    if (!userId) {
      logger.warn('[PrincipalHub] User not authenticated');
      setError('User not authenticated');
      if (isMountedRef.current) setLoading(false);
      return;
    }

    // Prevent duplicate fetches unless forced or initial fetch incomplete
    if (inFlightRef.current && !forceRefresh) {
      logger.info('[PrincipalHub] Fetch already in flight, skipping', fetchId);
      return;
    }
    
    // Prevent multiple initial fetches (React StrictMode guard)
    if (initialFetchComplete.current && !forceRefresh) {
      logger.info('[PrincipalHub] Initial fetch already completed, skipping', fetchId);
      return;
    }
    
    inFlightRef.current = true;

    try {
      if (isMountedRef.current) setLoading(true);
      setError(null);
      setLastRefresh(new Date());

      logger.info('🏫 Loading REAL Principal Hub data from database for preschool:', preschoolId);

      // **FETCH REAL DATA FROM DATABASE INSTEAD OF API/MOCK**
      logger.info('📊 Fetching real data from Supabase tables...');
      
      const [
        studentsResult,
        teachersResult,
        classesResult,
        applicationsResult,
        approvedAppsResult,
        rejectedAppsResult,
        waitlistedAppsResult,
        attendanceResult,
        capacityResult,
        preschoolResult,
        pendingReportsResult
      ] = await Promise.allSettled([
        // Get students count
        assertSupabase()
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .or('is_active.eq.true,is_active.is.null'),
          
        // Get teachers from teachers table (CORRECTED)
        assertSupabase()
          .from('teachers')
          .select(`
            id, 
            user_id,
            email,
            first_name,
            last_name,
            phone,
            subject_specialization,
            preschool_id,
            is_active,
            created_at
          `)
          .eq('preschool_id', preschoolId)
          .or('is_active.eq.true,is_active.is.null'),
          
        // Get classes count
        assertSupabase()
          .from('classes')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .or('is_active.eq.true,is_active.is.null'),
          
        // Get pending applications from enrollment_applications
        assertSupabase()
          .from('enrollment_applications')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .in('status', ['pending', 'under_review', 'interview_scheduled']),

        // Approved/Rejected/Waitlisted - real counts
        assertSupabase()
          .from('enrollment_applications')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .eq('status', 'approved'),
        assertSupabase()
          .from('enrollment_applications')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .eq('status', 'rejected'),
        assertSupabase()
          .from('enrollment_applications')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .eq('status', 'waitlisted'),
          
        // Get recent attendance records for attendance rate
        assertSupabase()
          .from('attendance_records')
          .select('status')
          .eq('preschool_id', preschoolId)
          .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .limit(1000),
          
        // Get preschool capacity info
        assertSupabase()
          .from('preschools')
          .select('capacity:max_students, name')
          .eq('id', preschoolId)
          .single(),
          
        // Get preschool info for school name
        assertSupabase()
          .from('preschools')
          .select('name')
          .eq('id', preschoolId)
          .single(),
          
        // Get pending progress report approvals (compatibility: both status fields)
        assertSupabase()
          .from('progress_reports')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .or('approval_status.eq.pending_review,status.eq.pending_review')
      ]);
      
      // Extract data with error handling
      const studentsCount = studentsResult.status === 'fulfilled' ? (studentsResult.value.count || 0) : 0;
      const teachersData = teachersResult.status === 'fulfilled' ? (teachersResult.value.data || []) : [];
      const classesCount = classesResult.status === 'fulfilled' ? (classesResult.value.count || 0) : 0;
      const applicationsCount = applicationsResult.status === 'fulfilled' ? (applicationsResult.value.count || 0) : 0;
      const approvedCount = approvedAppsResult.status === 'fulfilled' ? (approvedAppsResult.value.count || 0) : 0;
      const rejectedCount = rejectedAppsResult.status === 'fulfilled' ? (rejectedAppsResult.value.count || 0) : 0;
      const waitlistedCount = waitlistedAppsResult.status === 'fulfilled' ? (waitlistedAppsResult.value.count || 0) : 0;
      const attendanceData = attendanceResult.status === 'fulfilled' ? (attendanceResult.value.data || []) : [];
      const preschoolCapacity = capacityResult.status === 'fulfilled' ? (capacityResult.value.data || {}) : {} as any;
      const preschoolInfo = preschoolResult.status === 'fulfilled' ? (preschoolResult.value.data || {}) : {} as any;
      const pendingReportsCount = pendingReportsResult.status === 'fulfilled' ? (pendingReportsResult.value.count || 0) : 0;
      
      logger.info('📊 REAL DATA FETCHED:', {
        studentsCount,
        teachersCount: teachersData.length,
        classesCount,
        applicationsCount,
        pendingReportsCount,
        attendanceRecords: attendanceData.length,
        preschoolName: preschoolInfo.name
      });
      
      // Calculate real attendance rate
      let attendanceRate = 0;
      if (attendanceData.length > 0) {
        const presentCount = attendanceData.filter((record: any) => record.status === 'present').length;
        attendanceRate = Math.round((presentCount / attendanceData.length) * 100);
      }
      
      // Preload secure per-teacher stats from view (tenant-isolated)
      let overviewByEmail: Map<string, { class_count: number; student_count: number }> = new Map();
      try {
        const { data: overviewRows } = await assertSupabase()
          .from('vw_teacher_overview')
          .select('email, class_count, student_count');
        (overviewRows || []).forEach((row: any) => {
          if (row?.email) overviewByEmail.set(String(row.email).toLowerCase(), {
            class_count: Number(row.class_count || 0),
            student_count: Number(row.student_count || 0)
          });
        });
      } catch (e) {
        logger.warn('[PrincipalHub] vw_teacher_overview fetch failed, falling back to per-teacher queries:', e);
      }

      // Process teachers data with database information (using view when available)
      const processedTeachers = await Promise.all(
        teachersData.map(async (teacher: any) => {
          // Determine the effective user ID for this teacher.
          // classes.teacher_id references users.id. Some teacher rows may not yet have user_id linked.
          let effectiveUserId: string | null = teacher.user_id || null;
          if (!effectiveUserId && teacher.email) {
            // Fallback: try resolve users.id by teacher email within the same preschool
            try {
              const { data: fallbackUser } = await assertSupabase()
                .from('users')
                .select('id')
                .eq('email', teacher.email)
                .eq('preschool_id', preschoolId)
                .maybeSingle();
              if (fallbackUser?.id) effectiveUserId = fallbackUser.id;
            } catch { /* Intentional: non-fatal */ }
          }

          // Get classes assigned to this teacher (by effective user id)
          let teacherClassesCount = 0;
          let teacherClasses: any[] = [];

          // Prefer view-provided counts
          const viewStats = overviewByEmail.get(String(teacher.email || '').toLowerCase());
          if (viewStats) {
            teacherClassesCount = viewStats.class_count || 0;
            // We don't have per-class IDs in the view; only counts. We'll keep teacherClasses empty and use counts.
          } else if (effectiveUserId) {
            const classesCountRes = await assertSupabase()
              .from('classes')
              .select('id', { count: 'exact', head: true })
              .eq('teacher_id', effectiveUserId)
              .or('is_active.eq.true,is_active.is.null')
              .eq('preschool_id', preschoolId);
            teacherClassesCount = classesCountRes?.count || 0;

            const classesRes = await assertSupabase()
              .from('classes')
              .select('id')
              .eq('teacher_id', effectiveUserId)
              .or('is_active.eq.true,is_active.is.null')
              .eq('preschool_id', preschoolId);
            teacherClasses = classesRes?.data || [];
          }

          // Fallback: if there is only one active teacher in the school and
          // this teacher has zero classes assigned, attribute currently unassigned
          // active classes to this teacher for dashboard context. This matches
          // School Overview which counts all active classes regardless of assignment.
          if ((teacherClassesCount === 0) && (teachersData?.length === 1)) {
            const unassignedRes = await assertSupabase()
              .from('classes')
              .select('id')
              .is('teacher_id', null)
              .or('is_active.eq.true,is_active.is.null')
              .eq('preschool_id', preschoolId);
            const unassigned = unassignedRes?.data || [];
            if (unassigned.length > 0) {
              teacherClasses = unassigned;
              teacherClassesCount = unassigned.length;
            }
          }
            
          const classIds = (teacherClasses || []).map((c: any) => c.id);
          let studentsInClasses = 0;
          
          // Prefer view-provided student count
          if (viewStats) {
            studentsInClasses = viewStats.student_count || 0;
          } else if (classIds.length > 0) {
            const { count: studentsCount } = await assertSupabase()
              .from('students')
              .select('id', { count: 'exact', head: true })
              .in('class_id', classIds) || { count: 0 };
            studentsInClasses = studentsCount || 0;
          }
          
          // Enhanced performance calculation based on multiple factors
          let status: 'excellent' | 'good' | 'needs_attention' = 'good';
          let performanceIndicator = t('teacher.performance.active', { defaultValue: 'Active teacher' });
          
          // Calculate optimal ratios and workload
          const studentTeacherRatio = studentsInClasses > 0 ? studentsInClasses / Math.max(teacherClassesCount || 1, 1) : 0;
          const workloadScore = teacherClassesCount || 0;
          
          // Get attendance rate for teacher's students (performance indicator)
          let teacherAttendanceRate = 0;
          if (classIds.length > 0) {
            const { data: teacherAttendanceData } = await assertSupabase()
              .from('attendance_records')
              .select('status, student_id')
.in('student_id', await assertSupabase()
                .from('students')
                .select('id')
                .in('class_id', classIds)
                .then(res => (res.data || []).map((s: any) => s.id))
              )
              .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) || { data: [] };
              
            if (teacherAttendanceData && teacherAttendanceData.length > 0) {
              const presentCount = teacherAttendanceData.filter((a: any) => a.status === 'present').length;
              teacherAttendanceRate = Math.round((presentCount / teacherAttendanceData.length) * 100);
            }
          }
          
          // Sophisticated performance evaluation
          if (teacherClassesCount === 0) {
            status = 'needs_attention';
            performanceIndicator = t('teacher.performance.no_classes', { defaultValue: 'No classes assigned - requires attention' });
          } else if (studentTeacherRatio > 25) {
            status = 'needs_attention';
            performanceIndicator = t('teacher.performance.high_ratio', { ratio: Math.round(studentTeacherRatio), defaultValue: 'High student ratio ({{ratio}}:1) - may need support' });
          } else if ((teacherClassesCount ?? 0) >= 3 && studentTeacherRatio <= 20 && teacherAttendanceRate >= 85) {
            status = 'excellent';
            performanceIndicator = t('teacher.performance.excellent', { classes: teacherClassesCount ?? 0, ratio: Math.round(studentTeacherRatio), attendance: teacherAttendanceRate, defaultValue: 'Excellent performance - {{classes}} classes, {{ratio}}:1 ratio, {{attendance}}% attendance' });
          } else if ((teacherClassesCount ?? 0) >= 2 && studentTeacherRatio <= 22 && teacherAttendanceRate >= 80) {
            status = 'excellent';
            performanceIndicator = t('teacher.performance.strong', { classes: teacherClassesCount ?? 0, defaultValue: 'Strong performance - {{classes}} classes, good attendance rates' });
          } else if (studentTeacherRatio <= 25 && teacherAttendanceRate >= 75) {
            status = 'good';
            performanceIndicator = t('teacher.performance.good', { students: studentsInClasses, defaultValue: 'Good performance - managing {{students}} students effectively' });
          } else {
            status = 'needs_attention';
            performanceIndicator = t('teacher.performance.review_needed', { attendance: teacherAttendanceRate, defaultValue: 'Performance review needed - {{attendance}}% attendance rate in classes' });
          }
          
          // Use first_name and last_name from teachers table
          const first_name = teacher.first_name || 'Unknown';
          const last_name = teacher.last_name || 'Teacher';
          const full_name = `${first_name} ${last_name}`.trim();
          
          return {
            id: teacher.id,
            email: teacher.email,
            first_name,
            last_name,
            full_name,
            phone: teacher.phone,
            subject_specialization: teacher.subject_specialization || 'General',
            hire_date: teacher.created_at,
            classes_assigned: teacherClassesCount || 0,
            students_count: studentsInClasses,
            status,
            performance_indicator: performanceIndicator
          };
        })
      );
      
      // Get REAL financial data from transactions
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Fetch actual financial transactions for current month
      const { data: currentMonthTransactions } = await assertSupabase()
        .from('financial_transactions')
        .select('amount, type, status')
        .eq('preschool_id', preschoolId)
        .eq('type', 'fee_payment')
        .eq('status', 'completed')
        .gte('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('created_at', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`) || { data: [] };
      
      // Fetch previous month for comparison
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      
      const { data: previousMonthTransactions } = await assertSupabase()
        .from('financial_transactions')
        .select('amount, type, status')
        .eq('preschool_id', preschoolId)
        .eq('type', 'fee_payment')
        .eq('status', 'completed')
        .gte('created_at', `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`)
        .lt('created_at', `${prevYear}-${(prevMonth + 1).toString().padStart(2, '0')}-01`) || { data: [] };
      
      // Calculate real revenue
      const currentMonthRevenue = (currentMonthTransactions || []).reduce((sum: number, transaction: any) => {
        return sum + (transaction.amount || 0);
      }, 0);
      
      const previousMonthRevenue = (previousMonthTransactions || []).reduce((sum: number, transaction: any) => {
        return sum + (transaction.amount || 0);
      }, 0);
      
      // No estimates in production path per rules: use only real figures
      const monthlyRevenueTotal = currentMonthRevenue;
      const finalPreviousRevenue = previousMonthRevenue;
      
      // Build real stats object
      const stats = {
        students: { 
          total: studentsCount, 
          trend: studentsCount > 20 ? t('trends.up') : studentsCount > 10 ? t('trends.stable') : t('trends.low') 
        },
        staff: { 
          total: teachersData.length, 
          trend: teachersData.length >= 5 ? t('trends.stable') : t('trends.needs_attention') 
        },
        classes: { 
          total: classesCount, 
          trend: classesCount >= studentsCount / 8 ? t('trends.stable') : t('trends.up') 
        },
        pendingApplications: { 
          total: applicationsCount, 
          trend: applicationsCount > 5 ? t('trends.high') : applicationsCount > 2 ? t('trends.up') : t('trends.stable') 
        },
        monthlyRevenue: { 
          total: monthlyRevenueTotal, 
          trend: monthlyRevenueTotal > finalPreviousRevenue ? t('trends.up') : monthlyRevenueTotal < finalPreviousRevenue ? t('trends.down') : t('trends.stable') 
        },
        attendanceRate: { 
          percentage: attendanceRate || 0, 
          trend: attendanceRate >= 90 ? t('trends.excellent') : attendanceRate >= 80 ? t('trends.good') : t('trends.needs_attention') 
        },
        timestamp: new Date().toISOString()
      };
      
      const teachers = processedTeachers;
      
      // Use real petty cash data if available, otherwise fall back to basic estimates
      const realPettyCashExpenses = pettyCashMetrics?.monthlyExpenses || 0;
      
      // Expenses: Use only real petty cash expenses for now (no estimates)
      const totalExpenses = realPettyCashExpenses;
      const netProfit = monthlyRevenueTotal - totalExpenses;
      const profitMargin = monthlyRevenueTotal > 0 ? Math.round((netProfit / monthlyRevenueTotal) * 100) : 0;
      
      const financialSummary = {
        monthlyRevenue: monthlyRevenueTotal,
        previousMonthRevenue: finalPreviousRevenue,
        estimatedExpenses: totalExpenses,
        netProfit,
        revenueGrowth: finalPreviousRevenue > 0 ? Math.round(((monthlyRevenueTotal - finalPreviousRevenue) / finalPreviousRevenue) * 100) : 0,
        profitMargin,
        pettyCashBalance: pettyCashMetrics?.currentBalance || 0,
        pettyCashExpenses: realPettyCashExpenses,
        pendingApprovals: pettyCashMetrics?.pendingTransactionsCount || 0,
        timestamp: new Date().toISOString()
      };
      
      const capacityMetrics = {
        capacity: preschoolCapacity.capacity || 60,
        current_enrollment: studentsCount,
        available_spots: (preschoolCapacity.capacity || 60) - studentsCount,
        utilization_percentage: Math.round((studentsCount / (preschoolCapacity.capacity || 60)) * 100),
        enrollment_by_age: {
          toddlers: Math.round(studentsCount * 0.3),
          preschool: Math.round(studentsCount * 0.4),
          prekindergarten: Math.round(studentsCount * 0.3)
        },
        status: studentsCount >= (preschoolCapacity.capacity || 60) * 0.9 ? 'full' as const : 
                studentsCount >= (preschoolCapacity.capacity || 60) * 0.7 ? 'high' as const : 'available' as const,
        timestamp: new Date().toISOString()
      };
      
      const enrollmentPipeline = {
        pending: applicationsCount,
        approved: approvedCount,
        rejected: rejectedCount,
        waitlisted: waitlistedCount,
        total: applicationsCount + approvedCount + rejectedCount + waitlistedCount,
      };
      
      // Get real recent activities from database
      const { data: recentDBActivities } = await assertSupabase()
        .from('activity_logs')
        .select('activity_type, description, created_at, user_name, organization_id')
        .eq('organization_id', preschoolId)
        .order('created_at', { ascending: false })
        .limit(8) || { data: [] };
      
      // Extra client-side guard to prevent any cross-tenant leakage
      const scopedActivities = (recentDBActivities || []).filter((a: any) => a?.organization_id === preschoolId);
      
      // Process activities with meaningful information
      const processedActivities = (scopedActivities || []).map((activity: any) => {
        const activityType = activity.activity_type;
        let type: 'enrollment' | 'application' = 'enrollment';
        let icon = 'information-circle';
        
        if (activityType?.includes('student') || activityType?.includes('enrollment')) {
          type = 'enrollment';
          icon = 'people';
        } else if (activityType?.includes('application') || activityType?.includes('apply')) {
          type = 'application';
          icon = 'document-text';
        }
        
        return {
          type,
          title: activity.description || `${activityType} activity`,
          timestamp: activity.created_at,
          icon,
          userName: activity.user_name
        };
      });
      
      // Add current status activities if no recent activities exist
      const recentActivities = processedActivities.length > 0 ? processedActivities : [
        {
          type: 'enrollment' as const,
          title: `${studentsCount} students currently enrolled`,
          timestamp: new Date().toISOString(),
          icon: 'people'
        },
        {
          type: 'application' as const,
          title: `${applicationsCount} pending applications`,
          timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          status: 'pending',
          icon: 'document-text'
        }
      ];
      
      logger.info('✅ REAL DATABASE DATA PROCESSED:', {
        totalStudents: stats.students.total,
        totalTeachers: stats.staff.total,
        totalClasses: stats.classes.total,
        attendanceRate: stats.attendanceRate.percentage + '%',
        monthlyRevenue: 'R' + stats.monthlyRevenue.total.toLocaleString(),
        teacherNames: teachers.map(t => t.full_name).join(', ') || 'None'
      });
      
      // Get real school name from database
      const schoolName = preschoolInfo.name || preschoolCapacity.name || user?.user_metadata?.school_name || t('dashboard.your_school');

      if (isMountedRef.current) {
        setData({
          stats,
          teachers,
          financialSummary,
          enrollmentPipeline,
          capacityMetrics,
          recentActivities,
          pendingReportApprovals: pendingReportsCount,
          schoolId: preschoolId,
          schoolName
        });
      }

      logger.info('✅ [PrincipalHub] REAL data loaded successfully from database');
      logger.info('🎯 [PrincipalHub] Final dashboard summary:', {
        fetchId,
        school: schoolName,
        students: stats.students.total,
        teachers: stats.staff.total,
        classes: stats.classes.total,
        revenue: formatCurrency(stats.monthlyRevenue.total),
        attendance: stats.attendanceRate.percentage + '%'
      });
      
      // Mark initial fetch as complete
      if (!initialFetchComplete.current) {
        initialFetchComplete.current = true;
        logger.info('[PrincipalHub] Initial fetch completed successfully');
      }
    } catch (err) {
      logger.error('[PrincipalHub] Failed to fetch data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      if (isMountedRef.current) setLoading(false);
      inFlightRef.current = false;
      logger.info('[PrincipalHub] Fetch complete', { fetchId, success: !error });
    }
  }, [userId, preschoolId, t]);

useEffect(() => {
    logger.info('[PrincipalHub] useEffect triggered:', {
      userId,
      preschoolId,
      initialFetchComplete: initialFetchComplete.current,
      timestamp: Date.now()
    });
    
    if (!userId || !preschoolId) {
      logger.warn('[PrincipalHub] Missing userId or preschoolId, skipping fetch');
      return;
    }
    
    // Guard 2: Global fetch guard with time-based deduplication
    const key = `${userId}:${preschoolId}`;
    const now = Date.now();
    const last = __FETCH_GUARD[key] || 0;
    if (now - last < 2000) {
      logger.info(`[PrincipalHub] Fetch guard: Too soon since last fetch (${now - last}ms), skipping`);
      return;
    }
    __FETCH_GUARD[key] = now;
    
    logger.info('[PrincipalHub] Starting fetch...');
    fetchData().then(() => {
      initialFetchComplete.current = true;
      logger.info('[PrincipalHub] Fetch promise resolved');
    }).catch((err) => {
      logger.error('[PrincipalHub] Fetch promise rejected:', err);
    });
    
    // Cleanup: Reset on unmount to allow refetch on remount
    return () => {
      logger.info('[PrincipalHub] Component unmounting, resetting fetch guard');
      initialFetchComplete.current = false;
    };
  }, [userId, preschoolId, fetchData]);

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Helper methods for component convenience
  const getMetrics = useCallback(() => {
    if (!data.stats) return [];

    return [
      {
        id: 'students',
        title: t('metrics.total_students'),
        value: data.stats.students.total,
        icon: 'people-outline',
        color: '#4F46E5',
        trend: data.stats.students.trend
      },
      {
        id: 'staff',
        title: t('metrics.teaching_staff'),
        value: data.stats.staff.total,
        icon: 'school-outline', 
        color: '#059669',
        trend: data.stats.staff.trend
      },
      {
        id: 'classes',
        title: t('metrics.active_classes', { defaultValue: 'Active Classes' }),
        value: data.stats.classes.total,
        icon: 'library-outline',
        color: '#7C3AED',
        trend: data.stats.classes.trend
      },
      {
        id: 'attendance',
        title: t('metrics.attendance_rate'),
        value: `${data.stats.attendanceRate.percentage}%`,
        icon: 'checkmark-circle-outline',
        color: data.stats.attendanceRate.percentage >= 90 ? '#059669' : '#DC2626',
        trend: data.stats.attendanceRate.trend
      },
      {
        id: 'revenue',
        title: t('metrics.monthly_revenue'),
        value: formatCurrency(data.stats.monthlyRevenue.total),
        icon: 'card-outline',
        color: '#059669',
        trend: data.stats.monthlyRevenue.trend
      },
      {
        id: 'applications',
        title: t('metrics.pending_applications', { defaultValue: 'Pending Applications' }),
        value: data.stats.pendingApplications.total,
        icon: 'document-text-outline',
        color: '#F59E0B',
        trend: data.stats.pendingApplications.trend
      }
    ];
  }, [data]);


  const getTeachersWithStatus = useCallback(() => {
    if (!data.teachers) return [];

    return data.teachers; // Teachers already come with status and performance_indicator from API
  }, [data.teachers]);

  return {
    data,
    loading,
    error,
    refresh,
    lastRefresh,
    getMetrics,
    getTeachersWithStatus,
    formatCurrency,
    // Convenience flags
    hasData: !!data.stats,
    isReady: !loading && !error && !!data.stats,
    isEmpty: !loading && !data.stats
  };
};

/**
 * Helper function to get pending report approvals count
 * Safe to use even if data is undefined
 */
export const getPendingReportCount = (data?: PrincipalHubData | null): number => {
  return data?.pendingReportApprovals ?? 0;
};
