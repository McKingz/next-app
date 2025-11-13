import { assertSupabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

// Types for Principal Hub data
export interface PrincipalHubStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  attendanceRate: number;
  monthlyRevenue: number;
  pendingApplications: number;
  upcomingEvents: number;
}

export interface TeacherInfo {
  id: string;
  auth_user_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string;
  subject_specialization?: string;
  is_active: boolean;
  created_at: string;
  classes_assigned: number;
  students_count: number;
  last_login?: string;
}

export interface AnnouncementData {
  id: string;
  title: string;
  content: string;
  target_audience: string[];
  target_classes?: string[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduled_for?: string;
  expires_at?: string;
  is_published: boolean;
  created_at: string;
  created_by: string;
}

export interface FinancialSummary {
  monthlyRevenue: number;
  monthlyExpenses: number;
  netProfit: number;
  outstandingFees: number;
  enrollmentTrend: 'up' | 'down' | 'stable';
  paymentRate: number;
}

export class PrincipalHubService {
  
  /**
   * Get comprehensive school statistics for principal dashboard
   */
  static async getSchoolStats(preschoolId: string): Promise<PrincipalHubStats> {
    try {
      const supabase = assertSupabase();

      // Get parallel queries for all stats
      const [
        studentsResult,
        teachersResult,
        classesResult,
        applicationsResult
      ] = await Promise.all([
        // Total students
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .eq('is_active', true),

        // Total teachers
        supabase
          .from('teachers')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .eq('is_active', true),

        // Total classes
        supabase
          .from('classes')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .eq('is_active', true),

        // Pending applications from enrollment_applications
        assertSupabase()
          .from('enrollment_applications')
          .select('status', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .in('status', ['pending', 'in_review', 'new'])
      ]);

      // Attendance rate over last 30 days
      let attendanceRate = 0;
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data: att } = await assertSupabase()
          .from('attendance_records')
          .select('status')
          .eq('preschool_id', preschoolId)
          .gte('date', thirtyDaysAgo)
          .limit(5000);
        if (att && att.length > 0) {
          const present = att.filter((a: any) => String(a.status).toLowerCase() === 'present').length;
          attendanceRate = Math.round((present / att.length) * 100);
        }
      } catch { /* Intentional: non-fatal */ }

      // Monthly revenue from transactions; fallback to estimate if none
      let monthlyRevenue = 0;
      try {
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-01`;
        const nextMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2,'0')}-01`;
        const { data: tx } = await assertSupabase()
          .from('financial_transactions')
          .select('amount, type, status')
          .eq('preschool_id', preschoolId)
          .eq('type', 'fee_payment')
          .eq('status', 'completed')
          .gte('created_at', monthStart)
          .lt('created_at', nextMonthStart);
        monthlyRevenue = (tx || []).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
      } catch { /* Intentional: non-fatal */ }
      if (!monthlyRevenue) {
        monthlyRevenue = Math.round((studentsResult.count || 0) * 1200);
      }

      // Pending applications from enrollment_applications
      const pendingApplications = applicationsResult.count || 0;

      // Upcoming events (best-effort): sum of next 2 weeks class events
      let upcomingEvents = 0;
      try {
        const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: ev } = await assertSupabase()
          .from('class_events')
          .select('id')
          .eq('preschool_id', preschoolId)
          .gt('start_time', new Date().toISOString())
          .lt('start_time', twoWeeks)
          .limit(50);
        upcomingEvents = (ev || []).length;
      } catch { /* Intentional: non-fatal */ }

      return {
        totalStudents: studentsResult.count || 0,
        totalTeachers: teachersResult.count || 0,
        totalClasses: classesResult.count || 0,
        attendanceRate,
        monthlyRevenue,
        pendingApplications,
        upcomingEvents
      };
    } catch (error) {
      console.error('Failed to fetch school stats:', error);
      throw new Error('Failed to load school statistics');
    }
  }

  /**
   * Get teachers list with performance metrics
   */
  static async getTeachersList(preschoolId: string): Promise<TeacherInfo[]> {
    try {
      const supabase = assertSupabase();

      const { data: teachers, error } = await supabase
        .from('teachers')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          subject_specialization,
          is_active,
          created_at,
          users!inner(
            auth_user_id,
            full_name
          )
        `)
        .eq('preschool_id', preschoolId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enhance with class and student counts
      const enhancedTeachers = await Promise.all(
        (teachers || []).map(async (teacher) => {
          // Get classes assigned to this teacher
          const { count: classesCount } = await supabase
            .from('classes')
            .select('id', { count: 'exact', head: true })
            .eq('teacher_id', teacher.user_id)
            .eq('is_active', true);

          // Get classes first, then count students
          const { data: teacherClasses } = await supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', teacher.user_id)
            .eq('is_active', true);
            
          const classIds = (teacherClasses || []).map(c => c.id);
          
          // Get total students across teacher's classes
          const { count: studentsCount } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .in('class_id', classIds.length > 0 ? classIds : ['no-classes']);

          // Handle users relation which could be array or object
          const userInfo = Array.isArray(teacher.users) ? teacher.users[0] : teacher.users;
          
          return {
            id: teacher.id,
            auth_user_id: userInfo?.auth_user_id || '',
            first_name: teacher.first_name,
            last_name: teacher.last_name,
            full_name: userInfo?.full_name || `${teacher.first_name} ${teacher.last_name}`,
            email: teacher.email,
            phone: teacher.phone,
            subject_specialization: teacher.subject_specialization,
            is_active: teacher.is_active,
            created_at: teacher.created_at,
            classes_assigned: classesCount || 0,
            students_count: studentsCount || 0,
            last_login: undefined // Would come from users table login tracking
          };
        })
      );

      return enhancedTeachers;
    } catch (error) {
      console.error('Failed to fetch teachers list:', error);
      throw new Error('Failed to load teachers information');
    }
  }

  /**
   * Create a new announcement
   */
  static async createAnnouncement(
    preschoolId: string,
    createdBy: string,
    announcementData: Omit<AnnouncementData, 'id' | 'created_at' | 'created_by'>
  ): Promise<string> {
    try {
      const supabase = assertSupabase();

      // Normalize payload to match announcements table
      const payload: any = {
        preschool_id: preschoolId,
        created_by: createdBy,
        title: announcementData.title ?? (announcementData.content?.slice(0, 100) || 'Announcement'),
        content: announcementData.content,
        audience: announcementData.target_audience || [],
        priority: announcementData.priority ?? 'normal',
        is_active: true,
        scheduled_for: announcementData.scheduled_for ?? null,
        expires_at: announcementData.expires_at ?? null,
      };

      const { data, error } = await supabase
        .from('announcements')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;
      return String((data as any).id);
    } catch (error) {
      console.error('Failed to create announcement:', error);
      throw new Error('Failed to create announcement');
    }
  }

  /**
   * Get financial summary for the school
   */
  static async getFinancialSummary(preschoolId: string): Promise<FinancialSummary> {
    try {
      const supabase = assertSupabase();

      // Get student count for revenue calculation
      const { count: studentCount } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .eq('is_active', true);

      // Calculate mock financial data based on student count
      const monthlyRevenue = (studentCount || 0) * 850; // R850 per student
      const monthlyExpenses = monthlyRevenue * 0.7; // 70% expense ratio
      const netProfit = monthlyRevenue - monthlyExpenses;
      const outstandingFees = monthlyRevenue * 0.15; // 15% outstanding

      return {
        monthlyRevenue,
        monthlyExpenses,
        netProfit,
        outstandingFees,
        enrollmentTrend: studentCount && studentCount > 20 ? 'up' : 'stable',
        paymentRate: 85 // 85% payment rate
      };
    } catch (error) {
      console.error('Failed to fetch financial summary:', error);
      throw new Error('Failed to load financial information');
    }
  }

  /**
   * Get student enrollment pipeline
   */
  static async getEnrollmentPipeline(preschoolId: string) {
    try {
      const supabase = assertSupabase();

      // Fetch recent applications (last 90 days) and compute pipeline counts
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: apps, error } = await supabase
        .from('enrollment_applications')
        .select('status, created_at, decision, enrolled_at')
        .eq('preschool_id', preschoolId)
        .gte('created_at', ninetyDaysAgo);

      if (error) throw error;

      const pipeline = {
        new_applications: 0,
        in_review: 0,
        approved: 0,
        enrolled_this_month: 0,
        waiting_list: 0,
      };

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      (apps || []).forEach((a: any) => {
        const status = String(a.status || '').toLowerCase();
        if (status === 'pending' || status === 'new') pipeline.new_applications++;
        else if (status === 'in_review' || status === 'review') pipeline.in_review++;
        else if (status === 'approved') pipeline.approved++;
        else if (status === 'waitlisted' || status === 'waiting_list') pipeline.waiting_list++;

        if (a.enrolled_at) {
          const enrolledAt = new Date(a.enrolled_at);
          if (enrolledAt >= monthStart) pipeline.enrolled_this_month++;
        }
      });

      return pipeline;
    } catch (error) {
      console.error('Failed to fetch enrollment pipeline:', error);
      // Safe fallback
      return {
        new_applications: 0,
        in_review: 0,
        approved: 0,
        enrolled_this_month: 0,
        waiting_list: 0,
      };
    }
  }

  /**
   * Get school capacity and utilization metrics
   */
  static async getCapacityMetrics(preschoolId: string) {
    try {
      const supabase = assertSupabase();

      // Get school capacity from preschools table
      const { data: school } = await supabase
        .from('preschools')
        .select('capacity:max_students')
        .eq('id', preschoolId)
        .single();

      // Get current enrollment
      const { count: currentEnrollment } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .eq('is_active', true);

      const capacity = school?.capacity || 100;
      const utilization = Math.round(((currentEnrollment || 0) / capacity) * 100);

      return {
        capacity,
        current_enrollment: currentEnrollment || 0,
        utilization_percentage: utilization,
        available_spots: capacity - (currentEnrollment || 0)
      };
    } catch (error) {
      console.error('Failed to fetch capacity metrics:', error);
      return {
        capacity: 100,
        current_enrollment: 0,
        utilization_percentage: 0,
        available_spots: 100
      };
    }
  }
}
