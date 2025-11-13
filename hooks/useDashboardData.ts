/**
 * Dashboard Data Hooks
 * 
 * Custom hooks for fetching dashboard data for different user roles
 */

import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { offlineCacheService } from '@/lib/services/offlineCacheService';
import { log, warn, debug, error as logError } from '@/lib/debug';

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

// Helper functions for business logic
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
};

const calculateEstimatedRevenue = (studentCount: number): number => {
  // Only use as absolute fallback when no payment data exists
  // Average fee per student per month (in Rand) - conservative estimate
  const averageFeePerStudent = 1000; // Conservative estimate
  return studentCount * averageFeePerStudent;
};

const calculateAttendanceRate = async (schoolId: string): Promise<number> => {
  // Supabase is guaranteed by assertSupabase(); proceed safely
  
  try {
    // Get attendance records from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: attendanceData } = await assertSupabase()
      .from('attendance')
      .select('present, student_id')
      .eq('school_id', schoolId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
    
    if (attendanceData && attendanceData.length > 0) {
      const presentCount = attendanceData.filter(a => a.present).length;
      return Math.round((presentCount / attendanceData.length) * 1000) / 10;
    }
  } catch (error) {
    console.error('Failed to calculate attendance rate:', error);
  }
  
  // Return 0 if no data available
  return 0;
};

const getNextLessonTime = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0); // 9:00 AM tomorrow
  
  return tomorrow.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const formatDueDate = (dueDateString: string): string => {
  const dueDate = new Date(dueDateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  if (dueDate.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (dueDate.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return dueDate.toLocaleDateString('en-ZA', {
      month: 'short',
      day: 'numeric'
    });
  }
};

const getAssignmentStatus = (dueDateString: string, status: string): 'pending' | 'graded' | 'overdue' => {
  if (status === 'graded' || status === 'completed') return 'graded';
  
  const dueDate = new Date(dueDateString);
  const now = new Date();
  
  if (dueDate < now) return 'overdue';
  return 'pending';
};

// Types for dashboard data
export interface PrincipalDashboardData {
  schoolId?: string;
  schoolName: string;
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  attendanceRate: number;
  monthlyRevenue: number;
  pendingApplications: number;
  upcomingEvents: number;
  capacity?: number;
  enrollmentPercentage?: number;
  lastUpdated?: string;
  recentActivity: Array<{
    id: string;
    type: 'enrollment' | 'payment' | 'teacher' | 'event';
    message: string;
    time: string;
    userName?: string;
  }>;
}

export interface TeacherDashboardData {
  schoolName: string;
  totalStudents: number;
  totalClasses: number;
  upcomingLessons: number;
  pendingGrading: number;
  myClasses: Array<{
    id: string;
    name: string;
    studentCount: number;
    grade: string;
    room: string;
    nextLesson: string;
    attendanceRate?: number;
    presentToday?: number;
  }>;
  recentAssignments: Array<{
    id: string;
    title: string;
    dueDate: string;
    submitted: number;
    total: number;
    status: 'pending' | 'graded' | 'overdue';
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    time: string;
    type: 'meeting' | 'activity' | 'assessment';
  }>;
}

export interface ParentDashboardData {
  schoolName: string;
  totalChildren: number;
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
    grade: string;
    className: string;
    teacher: string;
  }>;
  attendanceRate: number;
  presentToday: number;
  recentHomework: Array<{
    id: string;
    title: string;
    dueDate: string;
    status: 'submitted' | 'graded' | 'not_submitted';
    studentName: string;
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    time: string;
    type: 'meeting' | 'activity' | 'assessment';
  }>;
  unreadMessages: number;
}

// Helper function to create empty dashboard data
const createEmptyPrincipalData = (schoolName: string = 'No School Assigned'): PrincipalDashboardData => ({
  schoolName,
  totalStudents: 0,
  totalTeachers: 0,
  totalParents: 0,
  attendanceRate: 0,
  monthlyRevenue: 0,
  pendingApplications: 0,
  upcomingEvents: 0,
  recentActivity: []
});

const createEmptyTeacherData = (): TeacherDashboardData => ({
  schoolName: 'No School Assigned',
  totalStudents: 0,
  totalClasses: 0,
  upcomingLessons: 0,
  pendingGrading: 0,
  myClasses: [],
  recentAssignments: [],
  upcomingEvents: []
});

const createEmptyParentData = (): ParentDashboardData => ({
  schoolName: 'No School Assigned',
  totalChildren: 0,
  children: [],
  attendanceRate: 0,
  presentToday: 0,
  recentHomework: [],
  upcomingEvents: [],
  unreadMessages: 0
});

/**
 * Comprehensive Principal Dashboard Hook with Real Data Integration
 * Provides complete school management analytics and real-time updates
 * 
 * FIXES APPLIED (2025-01-11):
 * - Removed non-existent 'principal_id' column query from preschools table
 * - Added proper user profile lookup via users table with auth_user_id
 * - Added fallback lookup via organization_members table
 * - Added support for both organizations and preschools table lookup
 * - Updated data queries to use correct organization relationship structure
 * - Added compatibility with both preschool_id and organization_id patterns
 */
export const usePrincipalDashboard = () => {
  const { user, profile } = useAuth();
  const [data, setData] = useState<PrincipalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    const startTime = Date.now();
    
    // Prevent data fetching during dashboard switches
    if (typeof window !== 'undefined' && (window as any).dashboardSwitching) {
      console.log('🏫 Skipping principal dashboard data fetch during switch');
      return;
    }
    
    log('🏫 Loading Principal Dashboard data...');
    
    try {
      setLoading(true);
      setError(null);
      setLastRefresh(new Date());

      // Try to load from cache first (unless forced refresh)
      if (!forceRefresh && user?.id) {
        setIsLoadingFromCache(true);
        const cachedData = await offlineCacheService.getPrincipalDashboard(
          user.id, 
          user.user_metadata?.school_id || 'unknown'
        );
        
        if (cachedData) {
          log('📱 Loading from cache...');
          setData(cachedData);
          setLoading(false);
          setIsLoadingFromCache(false);
          // Continue to fetch fresh data in background
          setTimeout(() => fetchData(true), 100);
          return;
        }
        setIsLoadingFromCache(false);
      }

      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Use assertSupabase() which throws if not configured
      assertSupabase();

      // Enhanced principal data fetch with comprehensive error handling
      // Use the existing profile system instead of direct query
      log('Using profile from auth context for organization lookup');
      const userProfile = profile; // Use the existing profile from useAuth hook
      
      if (!userProfile) {
        throw new Error('No user profile available - user not properly authenticated');
      }

      // Get organization identifier from profile (can be UUID id or tenant slug)
      const rawOrgId = userProfile.organization_id as string | undefined;
      const rawPreschoolId = (userProfile as any)?.preschool_id as string | undefined;
      const rawTenantSlug = (userProfile as any)?.tenant_slug as string | undefined;

      // Also consider auth user metadata slugs
      const metaSlugCandidates: (string | undefined)[] = [
        (user as any)?.user_metadata?.tenant_slug,
        (user as any)?.user_metadata?.preschool_slug,
        (user as any)?.user_metadata?.school_slug,
        (user as any)?.user_metadata?.school_id, // may be slug in some setups
      ];

      const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

      // Prefer explicit orgId/preschoolId; otherwise first non-UUID slug from metadata
      let orgIdentifier: string | undefined = rawOrgId || rawPreschoolId || rawTenantSlug;
      if (!orgIdentifier) {
        const metaSlug = metaSlugCandidates.find((s) => typeof s === 'string' && s.length > 0 && !isUuid(String(s)));
        if (metaSlug) orgIdentifier = String(metaSlug);
      }

      if (!orgIdentifier) {
        warn('⚠️ No organization identifier found in profile, checking organization membership');
        // Try alternative lookup via organization_members table  
        const { data: alternativeOrg } = await assertSupabase()
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', userProfile.id)
          .maybeSingle();
        
        if (alternativeOrg?.organization_id) {
          log('✅ Found organization via organization_members table');
          orgIdentifier = alternativeOrg.organization_id as string;
        } else {
          warn('⚠️ No organization found via organization_members - trying self users row');
          // Final fallback with RLS-friendly self read on public.users
          try {
            const { data: selfUser, error: selfErr } = await assertSupabase()
              .from('users')
              .select('id, auth_user_id, preschool_id, role')
              .eq('auth_user_id', user.id)
              .maybeSingle();
            if (selfErr) {
              warn('Self users row lookup error:', selfErr?.message);
            }
            if (selfUser?.preschool_id) {
              log('✅ Resolved organization from self users row (preschool_id)');
              orgIdentifier = selfUser.preschool_id as string;
            } else {
              warn('⚠️ Self users row did not contain preschool_id');
            }
          } catch (e) {
            warn('Self users row lookup threw:', e);
          }
        }
      } else {
        log('✅ Found organization identifier in profile:', orgIdentifier);
      }

      // Fetch organization data from either organizations or preschools table by ID or slug
      let principalData: any = null;
      let principalError: any = null;

      if (orgIdentifier) {
        const tryFetchById = async (id: string) => {
          // Try organizations by id first
          const { data: orgData } = await assertSupabase()
            .from('organizations')
            .select('id, name, plan_tier, created_at, address, phone, email')
            .eq('id', id)
            .maybeSingle();
          if (orgData) {
            return { 
              id: orgData.id, 
              name: orgData.name, 
              subscription_status: 'active', 
              address: orgData.address, 
              phone: orgData.phone, 
              email: orgData.email 
            };
          }
          
          // Try preschools by id (they have more detailed subscription info)
          const { data: preschoolData, error: preschoolErr } = await assertSupabase()
            .from('preschools')
            .select('id, name, address, phone, email, subscription_status, subscription_plan')
            .eq('id', id)
            .maybeSingle();
          principalError = preschoolErr;
          if (preschoolData) {
            return {
              id: preschoolData.id,
              name: preschoolData.name,
              subscription_status: preschoolData.subscription_status || 'active',
              address: preschoolData.address,
              phone: preschoolData.phone,
              email: preschoolData.email
            };
          }
          return null;
        };

        const tryFetchBySlug = async (slug: string) => {
          // Preschools by tenant_slug (this column exists in preschools)
          try {
            const { data: preschoolBySlug } = await assertSupabase()
              .from('preschools')
              .select('id, name, address, phone, email, subscription_status')
              .eq('tenant_slug', slug)
              .maybeSingle();
            if (preschoolBySlug) return preschoolBySlug;
          } catch (e) {
            warn('preschools.tenant_slug lookup failed:', e);
          }

          // Organizations by name (no tenant_slug in organizations table)
          try {
            const { data: orgByName } = await assertSupabase()
              .from('organizations')
              .select('id, name, plan_tier, created_at')
              .ilike('name', slug.replace(/-/g, ' '))
              .maybeSingle();
            if (orgByName) {
              return { id: orgByName.id, name: orgByName.name, subscription_status: 'active', address: null, phone: null, email: null };
            }
          } catch (e) {
            warn('organizations name lookup failed:', e);
          }

          // As a last resort, try preschools name ilike
          try {
            const { data: preschoolByName } = await assertSupabase()
              .from('preschools')
              .select('id, name, address, phone, email, subscription_status')
              .ilike('name', slug.replace(/-/g, ' '))
              .maybeSingle();
            return preschoolByName || null;
          } catch (e) {
            warn('preschools name lookup failed:', e);
            return null;
          }
        };

        if (isUuid(orgIdentifier)) {
          principalData = await tryFetchById(orgIdentifier);
        } else {
          // Identifier looks like a slug (e.g., "young-eagles")
          principalData = await tryFetchBySlug(orgIdentifier);
          // If slug lookup failed, still try as ID in case it's a non-standard UUID
          if (!principalData) {
            principalData = await tryFetchById(orgIdentifier);
          }
        }

        if (!principalData) {
          warn('⚠️ No organization found by identifier (id/slug):', orgIdentifier);
        } else {
          log('✅ Resolved organization from identifier:', principalData?.id, principalData?.name);
        }
      }

      if (principalError && principalError.code !== 'PGRST116') {
        logError('❌ Principal school fetch error:', principalError);
        throw new Error(`Database error: ${principalError.message}`);
      }

      let dashboardData: PrincipalDashboardData;

      if (principalData) {
        const schoolId = principalData.id;
        const schoolName = principalData.name || 'Unknown School';
        log(`📚 Loading data for ${schoolName} (ID: ${schoolId})`);

        // Helper function to map database activity types to dashboard types
        const mapActivityType = (actionType: string): string => {
          const typeMap: { [key: string]: string } = {
            'student_created': 'enrollment',
            'student_enrolled': 'enrollment',
            'payment_completed': 'payment',
            'payment_received': 'payment',
            'teacher_hired': 'teacher',
            'teacher_updated': 'teacher',
            'event_created': 'event',
            'meeting_scheduled': 'event'
          };
          
          return typeMap[actionType] || 'event';
        };

        // Parallel data fetching with correct schema
        debug('🔍 DEBUG: Starting parallel data fetch for schoolId:', schoolId);
        
        // Use authenticated Supabase client for all queries to work with RLS
        const authenticatedClient = assertSupabase();
        
        // Extra debug: confirm auth identity for RLS
        try {
          const { data: me } = await authenticatedClient.auth.getUser();
          debug('🔐 RLS DEBUG - auth user id:', me?.user?.id);
        } catch (e) {
          debug('RLS auth getUser failed', e);
        }
        
        const dataPromises = [
          // Students data - use is_active instead of status, preschool_id only
          authenticatedClient
            .from('students')
            .select('id, first_name, last_name, created_at, preschool_id, is_active, class_id')
            .eq('preschool_id', schoolId)
            .eq('is_active', true)
            .not('id', 'is', null), // Ensure valid records

          // Teachers data - query organization_members for teachers
          authenticatedClient
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', schoolId)
            .eq('role', 'teacher'),

          // Parents data - query organization_members for parents
          authenticatedClient
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', schoolId)
            .eq('role', 'parent'),

          // Payments - try both school_id and organization_id
          authenticatedClient
            .from('payments')
            .select('amount, created_at, status, payment_type, school_id, organization_id')
            .or(`school_id.eq.${schoolId},organization_id.eq.${schoolId}`)
            .gte('created_at', new Date(new Date().setDate(new Date().getDate() - 60)).toISOString())
            .not('id', 'is', null),

          // Applications - try both school_id and organization_id
          authenticatedClient
            .from('preschool_onboarding_requests')
            .select('id, school_name, created_at, status, organization_id')
            .or(`organization_id.eq.${schoolId},preschool_id.eq.${schoolId}`)
            .in('status', ['pending', 'under_review', 'interview_scheduled'])
            .not('id', 'is', null),

          // Events - try both school_id and organization_id
          authenticatedClient
            .from('events')
            .select('id, title, event_date, event_type, description, preschool_id, organization_id')
            .or(`preschool_id.eq.${schoolId},organization_id.eq.${schoolId}`)
            .gte('event_date', new Date().toISOString())
            .lte('event_date', new Date(new Date().setDate(new Date().getDate() + 30)).toISOString())
            .not('id', 'is', null),

          // Activity logs - use organization_id
          authenticatedClient
            .from('activity_logs')
            .select('id, activity_type, description, created_at, user_name, table_name, organization_id')
            .eq('organization_id', schoolId)
            .not('id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(10)
        ];

        const results = await Promise.allSettled(dataPromises);
        const [
          studentsResult, 
          teacherMembersResult, 
          parentMembersResult, 
          paymentsResult, 
          applicationsResult, 
          eventsResult, 
          activitiesResult
        ] = results;

        // Extract data with proper error handling and detailed logging
        const studentsData = studentsResult.status === 'fulfilled' ? studentsResult.value.data || [] : [];
        const teacherMembersData = teacherMembersResult.status === 'fulfilled' ? teacherMembersResult.value.data || [] : [];
        const parentMembersData = parentMembersResult.status === 'fulfilled' ? parentMembersResult.value.data || [] : [];
        const paymentsData = paymentsResult.status === 'fulfilled' ? paymentsResult.value.data || [] : [];
        const applicationsData = applicationsResult.status === 'fulfilled' ? applicationsResult.value.data || [] : [];
        const eventsData = eventsResult.status === 'fulfilled' ? eventsResult.value.data || [] : [];
        const activitiesData = activitiesResult.status === 'fulfilled' ? activitiesResult.value.data || [] : [];

        // Fetch teacher and parent users by membership to avoid relying on users.preschool_id
        let teacherUsersData: any[] = [];
        let parentUsersData: any[] = [];
        try {
          if (teacherMembersData.length > 0) {
            const teacherIds = (teacherMembersData as any[])
              .map((m: any) => m.user_id)
              .filter((v: any) => !!v);
            if (teacherIds.length > 0) {
              const { data: tUsers } = await authenticatedClient
                .from('users')
                .select('id, name, email, role, preschool_id, auth_user_id')
                .in('auth_user_id', teacherIds)
                .eq('role', 'teacher');
              teacherUsersData = tUsers || [];
            }
          }
          if (parentMembersData.length > 0) {
            const parentIds = (parentMembersData as any[])
              .map((m: any) => m.user_id)
              .filter((v: any) => !!v);
            if (parentIds.length > 0) {
              const { data: pUsers } = await authenticatedClient
                .from('users')
                .select('id, name, email, role, preschool_id, auth_user_id')
                .in('auth_user_id', parentIds)
                .eq('role', 'parent');
              parentUsersData = pUsers || [];
            }
          }
        } catch (fetchUsersErr) {
          warn('Teacher/Parent user detail fetch by membership failed:', fetchUsersErr);
        }

        // Enhanced logging with actual data counts and sample records
        debug('🔍 DEBUG DATA RESULTS:');
        debug('- Students:', studentsData.length, studentsData.length > 0 ? studentsData[0] : 'No students found');
        debug('- Teacher Members:', teacherMembersData.length, teacherMembersData.length > 0 ? teacherMembersData[0] : 'No teacher members found');
        debug('- Parent Members:', parentMembersData.length, parentMembersData.length > 0 ? parentMembersData[0] : 'No parent members found');
        debug('- Teacher Users:', teacherUsersData.length, teacherUsersData.length > 0 ? teacherUsersData[0] : 'No teacher users found');
        debug('- Parent Users:', parentUsersData.length, parentUsersData.length > 0 ? parentUsersData[0] : 'No parent users found');
        debug('- Payments:', paymentsData.length);
        debug('- Applications:', applicationsData.length);
        debug('- Events:', eventsData.length);
        debug('- Activities:', activitiesData.length);

        // Log any failed requests for debugging
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const queries = ['students', 'teacher_members', 'parent_members', 'payments', 'applications', 'events', 'activities'];
            logError(`❌ ${queries[index]} query failed:`, result.reason);
          }
        });

        // Calculate comprehensive metrics with proper typing
        // Students - using is_active filter from the query
        const totalStudents = studentsData.length;
        
        // Teachers - prefer direct users query, but fall back to organization_members count under RLS constraints
        const totalTeachers = teacherUsersData.length || teacherMembersData.length;
        
        // Parents - prefer direct users query, but fall back to organization_members count under RLS constraints
        const totalParents = parentUsersData.length || parentMembersData.length;
        
        // Extract teacher and parent names for debugging (best-effort)
        const teacherNames = (teacherUsersData.length > 0
          ? teacherUsersData.map((t: any) => t.name || 'Unknown')
          : teacherMembersData.map((m: any) => m.user_id).slice(0, 3)
        ).join(', ');
        const parentNames = (parentUsersData.length > 0
          ? parentUsersData.map((p: any) => p.name || 'Unknown')
          : parentMembersData.map((m: any) => m.user_id).slice(0, 3)
        ).join(', ');
        
        debug('👥 STAFF DETAILS:');
        debug('- Teacher names:', teacherNames || 'None');
        debug('- Parent names:', parentNames || 'None');
        debug('- Teacher member count:', teacherMembersData.length);
        debug('- Parent member count:', parentMembersData.length);

        // Calculate real attendance rate with error handling
        let attendanceRate = 0;
        try {
          attendanceRate = await calculateAttendanceRate(schoolId);
        } catch (error) {
          warn('Failed to calculate attendance rate:', error);
          // Keep as 0 rather than throwing
        }

        // Calculate monthly revenue from real payments only
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const currentMonthPayments = paymentsData.filter((p: any) => {
          if (!p?.created_at || p?.status !== 'completed') return false;
          const paymentDate = new Date(p.created_at);
          return paymentDate >= monthStart && paymentDate <= monthEnd;
        });
        
        let monthlyRevenue = currentMonthPayments.reduce((sum: number, payment: any) => {
          // Ensure amount is treated as cents if needed, convert to Rand
          const amount = payment?.amount || 0;
          // Assume amounts in database are in cents, convert to Rand
          return sum + (amount > 1000 ? amount / 100 : amount);
        }, 0);
        
        // Only estimate if absolutely no payment records exist for the school
        if (monthlyRevenue === 0 && paymentsData.length === 0 && totalStudents > 0) {
          monthlyRevenue = calculateEstimatedRevenue(totalStudents);
        }

        // Process applications
        const pendingApplications = applicationsData.length;

        // Process upcoming events
        const upcomingEvents = eventsData.length;

        // Calculate capacity metrics (column may not exist); default to 0
        const capacity = (principalData as any)?.capacity ?? 0;
        const enrollmentPercentage = capacity > 0 ? Math.round((totalStudents / capacity) * 100) : 0;

        // Process recent activity with enhanced formatting
        let recentActivity = activitiesData.map((activity: any) => ({
          id: activity?.id || 'unknown',
          type: mapActivityType(activity?.action_type || 'event') as 'enrollment' | 'payment' | 'teacher' | 'event',
          message: activity?.description || `${activity?.action_type || 'Unknown'} activity`,
          time: formatTimeAgo(activity?.created_at || new Date().toISOString()),
          userName: activity?.user_name || 'System'
        }));

        // Add synthetic recent activity if none exists
        if (recentActivity.length === 0) {
          recentActivity = [
            {
              id: 'synthetic-students',
              type: 'enrollment',
              message: `${totalStudents} students currently enrolled`,
              time: 'Currently',
              userName: 'System'
            },
            {
              id: 'synthetic-teachers',
              type: 'teacher',
              message: `${totalTeachers} active teaching staff members`,
              time: 'Currently',
              userName: 'System'
            }
          ];
          
          if (pendingApplications > 0) {
            recentActivity.push({
              id: 'synthetic-applications',
              type: 'enrollment',
              message: `${pendingApplications} pending applications awaiting review`,
              time: 'Pending',
              userName: 'System'
            });
          }
        }

        dashboardData = {
          schoolId,
          schoolName,
          totalStudents,
          totalTeachers,
          totalParents,
          attendanceRate: Math.round(attendanceRate * 10) / 10,
          monthlyRevenue: Math.round(monthlyRevenue),
          pendingApplications,
          upcomingEvents,
          capacity,
          enrollmentPercentage,
          lastUpdated: new Date().toISOString(),
          recentActivity: recentActivity.slice(0, 8) // Limit to 8 most recent
        };

        const loadTime = Date.now() - startTime;
        log(`✅ Dashboard data loaded successfully in ${loadTime}ms:`, {
          school: schoolName,
          students: totalStudents,
          teachers: totalTeachers,
          parents: totalParents,
          revenue: monthlyRevenue,
          attendance: attendanceRate
        });

        // Cache the fresh data for offline use
        if (user?.id) {
          await offlineCacheService.cachePrincipalDashboard(
            user.id,
            schoolId,
            dashboardData
          );
          log('💾 Dashboard data cached for offline use');
        }

      } else {
        // No school found for this principal
        warn('⚠️ No school found for this principal');
        dashboardData = {
          ...createEmptyPrincipalData('No School Assigned'),
          schoolId: undefined,
          lastUpdated: new Date().toISOString(),
          recentActivity: [
            {
              id: 'no-school',
              type: 'event',
              message: 'No school assigned to this principal account',
              time: 'Now',
              userName: 'System'
            }
          ]
        };
      }

      setData(dashboardData);
    } catch (err) {
      logError('❌ Failed to fetch principal dashboard data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      // Fallback to empty data with error indication
      setData({
        ...createEmptyPrincipalData('Database Error'),
        schoolId: 'error-fallback',
        lastUpdated: new Date().toISOString(),
        recentActivity: [
          {
            id: 'error-notice',
            type: 'event',
            message: `Dashboard error: ${errorMessage}`,
            time: 'Just now',
            userName: 'System'
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Only fetch data if user exists
    if (user?.id) {
      fetchData();
    } else {
      // No user - clear any stale data
      setData(null);
      setLoading(false);
      setError(null);
    }
  }, [fetchData, user]);

  const refresh = useCallback(() => {
    log('🔄 Refreshing Principal Dashboard data...');
    fetchData(true); // Force refresh from server
  }, [fetchData]);

  // Auto-refresh every 5 minutes when data is loaded
  useEffect(() => {
    if (!data || loading) return;

    const interval = setInterval(() => {
      log('⏰ Auto-refreshing Principal Dashboard');
      fetchData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [fetchData, data, loading]);

  return {
    data,
    loading,
    error,
    refresh,
    lastRefresh,
    isLoadingFromCache
  };
};

/**
 * Hook for fetching Teacher dashboard data
 */
export const useTeacherDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Prevent data fetching during dashboard switches
    if (typeof window !== 'undefined' && (window as any).dashboardSwitching) {
      console.log('👨‍🏫 Skipping teacher dashboard data fetch during switch');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);

      // Wait for auth to complete loading before proceeding
      if (authLoading) {
        log('🔄 Waiting for auth to complete...');
        // Keep loading state true until auth resolves to avoid premature empty UI
        return;
      }

      // Try to load from cache first (unless forced refresh)
      if (!forceRefresh && user?.id) {
        setIsLoadingFromCache(true);
        const cachedData = await offlineCacheService.getTeacherDashboard(
          user.id, 
          user.user_metadata?.school_id || 'unknown'
        );
        
        if (cachedData) {
          log('📱 Loading teacher data from cache...');
          setData(cachedData);
          setLoading(false);
          setIsLoadingFromCache(false);
          // Continue to fetch fresh data in background
          setTimeout(() => fetchData(true), 100);
          return;
        }
        setIsLoadingFromCache(false);
      }

      if (!user?.id) {
        if (!authLoading) {
          // Auth has completed but no user - this is a real auth error
          throw new Error('User not authenticated');
        }
        // Auth still loading, just return and keep loading=true
        return;
      }
      
      // Ensure we have Supabase configured
      const supabase = assertSupabase();
      
      // Verify authentication state
      const { data: authCheck } = await supabase.auth.getUser();
      if (!authCheck.user) {
        throw new Error('Authentication session invalid');
      }

      // Fetch teacher user row from public.users (teachers table is not populated)
      const { data: teacherUser, error: teacherError } = await supabase
        .from('users')
        .select('id, auth_user_id, preschool_id, first_name, last_name, role')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (teacherError) {
        logError('Teacher user fetch error:', teacherError);
      }

      // Resolve teacher organization and role with robust fallbacks (profiles table)
      let resolvedTeacherUser: any = teacherUser || null;
      if (!resolvedTeacherUser || !resolvedTeacherUser.preschool_id || !(String(resolvedTeacherUser.role || '').toLowerCase().includes('teacher'))) {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, preschool_id, role, first_name, last_name, organization_id')
          .eq('id', user.id)
          .maybeSingle();
        if (!profErr && prof) {
          const roleStr = String((prof as any).role || '').toLowerCase();
          if (!resolvedTeacherUser || roleStr.includes('teacher')) {
            resolvedTeacherUser = {
              id: teacherUser?.id || user.id,
              auth_user_id: user.id,
              preschool_id: (prof as any).preschool_id || (prof as any).organization_id || teacherUser?.preschool_id || null,
              first_name: (prof as any).first_name || teacherUser?.first_name || null,
              last_name: (prof as any).last_name || teacherUser?.last_name || null,
              role: (prof as any).role || teacherUser?.role || 'teacher'
            };
          }
        }
      }

      let dashboardData: TeacherDashboardData;

      if (resolvedTeacherUser) {
        const teacherId = resolvedTeacherUser.id; // references users.id or profiles.id
        let schoolName = 'Unknown School';
        const schoolIdToUse = resolvedTeacherUser.preschool_id;
        if (schoolIdToUse) {
          const { data: school } = await supabase
            .from('preschools')
            .select('id, name')
            .eq('id', schoolIdToUse)
            .maybeSingle();
          
          // If not found in preschools, try organizations
          if (!school) {
            const { data: org } = await supabase
              .from('organizations')
              .select('id, name')
              .eq('id', schoolIdToUse)
              .maybeSingle();
            schoolName = org?.name || schoolName;
          } else {
            schoolName = school.name || schoolName;
          }
        }

        // Fetch teacher's classes with student and attendance data
        const { data: classesData } = await supabase
          .from('classes')
          .select(`
            id,
            name,
            grade_level,
            room_number,
            students!inner(id, first_name, last_name)
          `)
          .eq('teacher_id', teacherId);

        // Get today's attendance for all teacher's students
        const today = new Date().toISOString().split('T')[0];
        const allStudentIds = classesData?.flatMap(cls => 
          cls.students?.map((s: any) => s.id) || []
        ) || [];
        
        let todayAttendanceData: any[] = [];
        if (allStudentIds.length > 0) {
          const { data: attendanceData } = await supabase
            .from('attendance_records')
            .select('student_id, status')
            .in('student_id', allStudentIds)
            .gte('date', today + 'T00:00:00')
            .lt('date', today + 'T23:59:59');
          
          todayAttendanceData = attendanceData || [];
        }

const myClasses = (classesData || []).map((classItem: any) => {
          const classStudents = classItem.students || [];
          const classStudentIds = classStudents.map((s: any) => s.id);
          const classAttendance = todayAttendanceData.filter(a => 
            classStudentIds.includes(a.student_id)
          );
          const presentCount = classAttendance.filter(a => a.status === 'present').length;
          const attendanceRate = classStudents.length > 0 
            ? Math.round((presentCount / classStudents.length) * 100)
            : 0;
            
          return {
            id: classItem.id,
            name: classItem.name,
            studentCount: classStudents.length,
            grade: classItem.grade_level || 'Grade R',
            room: classItem.room_number || 'TBD',
            nextLesson: getNextLessonTime(),
            attendanceRate,
            presentToday: presentCount
          };
        }) || [];

        // Calculate total students
const totalStudents = myClasses.reduce((sum: number, cls: any) => sum + cls.studentCount, 0);

        // Fetch assignments (use homework_assignments + homework_submissions relationship)
        const { data: assignmentsData } = await supabase
          .from('homework_assignments')
          .select(`
            id,
            title,
            due_date,
            is_published,
            homework_submissions!left(
              id,
              status
            )
          `)
          .eq('teacher_id', teacherId)
          .order('created_at', { ascending: false })
          .limit(3);

        // Fetch upcoming events for teacher's school
        const { data: eventsData } = await supabase
          .from('events')
          .select('id, title, event_date, event_type, description')
          .eq('preschool_id', resolvedTeacherUser.preschool_id)
          .gte('event_date', new Date().toISOString())
          .order('event_date', { ascending: true })
          .limit(5);

const recentAssignments = (assignmentsData || []).map((assignment: any) => {
          const submissions = assignment.homework_submissions || [];
          const submittedCount = (submissions || []).filter((s: any) => s.status === 'submitted').length;
          const totalCount = submissions.length;

          // Derive a simple status from due date and submissions since homework_assignments has no status column
          const derivedStatus = (() => {
            const now = new Date();
            const due = new Date(assignment.due_date);
            if (totalCount > 0 && submissions.every((s: any) => s.status === 'graded')) return 'graded';
            if (due < now) return 'overdue';
            return 'pending';
          })() as 'pending' | 'graded' | 'overdue';
          
          return {
            id: assignment.id,
            title: assignment.title,
            dueDate: formatDueDate(assignment.due_date),
            submitted: submittedCount,
            total: totalCount,
            status: derivedStatus
          };
        }) || [];

        // Calculate pending grading
        const pendingGrading = recentAssignments
 .filter((a: any) => a.status === 'pending')
.reduce((sum: number, a: any) => sum + a.submitted, 0);

        // Process upcoming events
const upcomingEvents = (eventsData || []).map((event: any) => {
          const eventDate = new Date(event.event_date);
          const now = new Date();
          const diffInHours = Math.floor((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60));
          
          let timeStr = '';
          if (diffInHours < 24) {
            timeStr = diffInHours <= 2 ? 'Soon' : `In ${diffInHours} hours`;
          } else {
            const diffInDays = Math.floor(diffInHours / 24);
            timeStr = diffInDays === 1 ? 'Tomorrow' : `In ${diffInDays} days`;
          }
          
          return {
            id: event.id,
            title: event.title,
            time: timeStr,
            type: (event.event_type || 'event') as 'meeting' | 'activity' | 'assessment'
          };
        }) || [];

        dashboardData = {
          schoolName,
          totalStudents,
          totalClasses: myClasses.length,
          upcomingLessons: Math.min(myClasses.length, 3),
          pendingGrading,
          myClasses,
          recentAssignments,
          upcomingEvents
        };

        // Cache the fresh data for offline use
        if (user?.id && resolvedTeacherUser.preschool_id) {
          await offlineCacheService.cacheTeacherDashboard(
            user.id,
            resolvedTeacherUser.preschool_id,
            dashboardData
          );
          log('💾 Teacher dashboard data cached for offline use');
        }
      } else {
        // No teacher record found, use empty data
        dashboardData = createEmptyTeacherData();
      }

      setData(dashboardData);
    } catch (err) {
      logError('Failed to fetch teacher dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      // Fallback to empty data on error
      setData({
        ...createEmptyTeacherData(),
        recentActivity: [
          {
            id: 'error-notice',
            type: 'event', 
            message: `Teacher data error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            time: 'Just now'
          }
        ]
      } as any);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    // Only fetch data if auth is not loading and user exists
    if (!authLoading && user?.id) {
      fetchData();
    } else if (!authLoading && !user) {
      // Auth completed but no user - clear any stale data
      setData(null);
      setLoading(false);
      setError(null);
    }
  }, [fetchData, authLoading, user]);

  const refresh = useCallback(() => {
    fetchData(true); // Force refresh from server
  }, [fetchData]);

  // Refetch on window focus/visibility change (for web)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      // Only refetch if page becomes visible and we have existing data
      if (!document.hidden && data && !loading) {
        log('👁️ Page visible again, refreshing teacher dashboard...');
        fetchData(false); // Soft refresh (will use cache first if available)
      }
    };

    const handleFocus = () => {
      // Refetch when window regains focus
      if (data && !loading) {
        log('🎯 Window focused, refreshing teacher dashboard...');
        fetchData(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [data, loading, fetchData]);

  return { data, loading, error, refresh, isLoadingFromCache };
};

/**
 * Hook for fetching Parent dashboard data
 */
export const useParentDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Wait for auth to complete loading before proceeding
      if (authLoading) {
        log('🔄 Waiting for auth to complete...');
        setLoading(false);
        return;
      }

      // Try to load from cache first (unless forced refresh)
      if (!forceRefresh && user?.id) {
        setIsLoadingFromCache(true);
const cachedData = await offlineCacheService.getParentDashboard(
          user.id
        );
        
        if (cachedData) {
          log('📱 Loading parent data from cache...');
          setData(cachedData);
          setLoading(false);
          setIsLoadingFromCache(false);
          // Continue to fetch fresh data in background
          setTimeout(() => fetchData(true), 100);
          return;
        }
        setIsLoadingFromCache(false);
      }

      if (!user?.id) {
        if (!authLoading) {
          // Auth has completed but no user - this is a real auth error
          throw new Error('User not authenticated');
        }
        // Auth still loading, just return
        setLoading(false);
        return;
      }
      
      // Ensure we have Supabase configured
      const supabase = assertSupabase();
      
      // Verify authentication state
      const { data: authCheck } = await supabase.auth.getUser();
      if (!authCheck.user) {
        throw new Error('Authentication session invalid');
      }

      // Fetch parent user from profiles table
      const { data: parentUser, error: parentError } = await supabase
        .from('profiles')
        .select('id, preschool_id, first_name, last_name, role, organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (parentError) {
        logError('Parent user fetch error:', parentError);
      }

      let dashboardData: ParentDashboardData;

      if (parentUser) {
        const schoolId = (parentUser as any).preschool_id || (parentUser as any).organization_id;
        let schoolName = 'Unknown School';
        
        if (schoolId) {
          const { data: school } = await supabase
            .from('preschools')
            .select('id, name')
            .eq('id', schoolId)
            .maybeSingle();
          
          // If not found in preschools, try organizations
          if (!school) {
            const { data: org } = await supabase
              .from('organizations')
              .select('id, name')
              .eq('id', schoolId)
              .maybeSingle();
            schoolName = org?.name || schoolName;
          } else {
            schoolName = school.name || schoolName;
          }
        }

        // Fetch children for this parent
        const { data: childrenData } = await supabase
          .from('students')
          .select(`
            id,
            first_name,
            last_name,
            grade_level,
            student_class:classes(id, name, teacher:users(first_name, last_name))
          `)
          .eq('parent_id', user.id);

        const children = (childrenData || []).map((child: any) => ({
          id: child.id,
          firstName: child.first_name,
          lastName: child.last_name,
          grade: child.grade_level || 'Grade R',
          className: child.student_class?.name || 'No Class',
          teacher: child.student_class?.teacher ? 
            `${child.student_class.teacher.first_name} ${child.student_class.teacher.last_name}` : 
            'No Teacher Assigned'
        }));

        // Get today's attendance for all children
        const today = new Date().toISOString().split('T')[0];
        const childIds = children.map(child => child.id);
        
        let todayAttendanceData: any[] = [];
        if (childIds.length > 0) {
          const { data: attendanceData } = await supabase
            .from('attendance_records')
            .select('student_id, status')
            .in('student_id', childIds)
            .gte('date', today + 'T00:00:00')
            .lt('date', today + 'T23:59:59');
          
          todayAttendanceData = attendanceData || [];
        }

        // Fetch recent homework assignments for children
        const { data: assignmentsData } = await supabase
          .from('homework_assignments')
          .select(`
            id,
            title,
            due_date,
            homework_submissions!inner(
              id,
              status,
              student_id
            )
          `)
          .in('homework_submissions.student_id', childIds)
          .order('due_date', { ascending: false })
          .limit(5);

        // Fetch upcoming events for the school
        const { data: eventsData } = await supabase
          .from('events')
          .select('id, title, event_date, event_type, description')
          .eq('preschool_id', schoolId)
          .gte('event_date', new Date().toISOString())
          .order('event_date', { ascending: true })
          .limit(5);

        // Process attendance data
        const totalChildren = children.length;
        const presentToday = todayAttendanceData.filter(a => a.status === 'present').length;
        const attendanceRate = totalChildren > 0 ? Math.round((presentToday / totalChildren) * 100) : 0;

        // Process homework data
        const recentHomework = (assignmentsData || []).map((assignment: any) => {
          const submission = assignment.homework_submissions?.[0];
          return {
            id: assignment.id,
            title: assignment.title,
            dueDate: formatDueDate(assignment.due_date),
            status: submission?.status || 'not_submitted' as 'submitted' | 'graded' | 'not_submitted',
            studentName: children.find(child => child.id === submission?.student_id)?.firstName || 'Unknown'
          };
        });

        // Process upcoming events
        const upcomingEvents = (eventsData || []).map((event: any) => {
          const eventDate = new Date(event.event_date);
          const now = new Date();
          const diffInHours = Math.floor((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60));
          
          let timeStr = '';
          if (diffInHours < 24) {
            timeStr = diffInHours <= 2 ? 'Soon' : `In ${diffInHours} hours`;
          } else {
            const diffInDays = Math.floor(diffInHours / 24);
            timeStr = diffInDays === 1 ? 'Tomorrow' : `In ${diffInDays} days`;
          }
          
          return {
            id: event.id,
            title: event.title,
            time: timeStr,
            type: (event.event_type || 'event') as 'meeting' | 'activity' | 'assessment'
          };
        });

        dashboardData = {
          schoolName,
          totalChildren,
          children,
          attendanceRate,
          presentToday,
          recentHomework,
          upcomingEvents,
          unreadMessages: 0 // TODO: Implement messaging system
        };

        // Cache the fresh data for offline use
        if (user?.id && schoolId) {
await offlineCacheService.cacheParentDashboard(
            user.id,
            dashboardData
          );
          log('💾 Parent dashboard data cached for offline use');
        }
      } else {
        // No parent record found, use empty data
        dashboardData = createEmptyParentData();
      }

      setData(dashboardData);
    } catch (err) {
      logError('Failed to fetch parent dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      // Fallback to empty data on error
      setData({
        ...createEmptyParentData(),
        recentActivity: [
          {
            id: 'error-notice',
            type: 'event', 
            message: `Parent data error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            time: 'Just now'
          }
        ]
      } as any);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    // Only fetch data if auth is not loading and user exists
    if (!authLoading && user?.id) {
      fetchData();
    } else if (!authLoading && !user) {
      // Auth completed but no user - clear any stale data
      setData(null);
      setLoading(false);
      setError(null);
    }
  }, [fetchData, authLoading, user]);

  const refresh = useCallback(() => {
    fetchData(true); // Force refresh from server
  }, [fetchData]);

  return { data, loading, error, refresh, isLoadingFromCache };
};

