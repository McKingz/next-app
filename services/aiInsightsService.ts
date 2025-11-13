/* eslint-disable @typescript-eslint/no-unused-vars */

import { supabase } from '../lib/supabase';

export interface AIInsight {
  id: string;
  type: 'attendance' | 'financial' | 'enrollment' | 'performance' | 'alert';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionRequired: boolean;
  suggestedActions?: string[];
  createdAt: string;
  data?: any;
}

export class AIInsightsService {
  static async generateInsightsForSchool(schoolId: string): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    
    try {
      // Get current date for calculations
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      
      // Attendance Analysis
      const attendanceInsight = await this.analyzeAttendance(schoolId, lastWeek, now);
      if (attendanceInsight) insights.push(attendanceInsight);
      
      // Financial Analysis
      const financialInsight = await this.analyzeFinancials(schoolId, lastMonth, now);
      if (financialInsight) insights.push(financialInsight);
      
      // Enrollment Trends
      const enrollmentInsight = await this.analyzeEnrollment(schoolId, lastMonth, now);
      if (enrollmentInsight) insights.push(enrollmentInsight);
      
      // Teacher Performance
      const teacherInsight = await this.analyzeTeacherPerformance(schoolId);
      if (teacherInsight) insights.push(teacherInsight);
      
      // Outstanding Payments Alert
      const paymentInsight = await this.analyzeOutstandingPayments(schoolId);
      if (paymentInsight) insights.push(paymentInsight);
      
      // Sort by priority and date
      return insights.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
    } catch {
      console.error('Error generating AI insights');
      return [];
    }
  }
  
  private static async analyzeAttendance(schoolId: string, startDate: Date, endDate: Date): Promise<AIInsight | null> {
    try {
      const { data: attendanceRecords } = await supabase!
        .from('attendance_records')
        .select('status, date')
        .eq('preschool_id', schoolId)
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString());
      
      if (!attendanceRecords || attendanceRecords.length === 0) return null;
      
      const totalRecords = attendanceRecords.length;
      const presentRecords = attendanceRecords.filter(r => r.status === 'present').length;
      const attendanceRate = (presentRecords / totalRecords) * 100;
      
      // Get previous week for comparison
      const prevWeekStart = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const { data: prevWeekRecords } = await supabase!
        .from('attendance_records')
        .select('status')
        .eq('preschool_id', schoolId)
        .gte('date', prevWeekStart.toISOString())
        .lt('date', startDate.toISOString());
      
      let trend = 'stable';
      let trendDescription = '';
      
      if (prevWeekRecords && prevWeekRecords.length > 0) {
        const prevPresentRecords = prevWeekRecords.filter(r => r.status === 'present').length;
        const prevAttendanceRate = (prevPresentRecords / prevWeekRecords.length) * 100;
        const change = attendanceRate - prevAttendanceRate;
        
        if (change > 5) {
          trend = 'improving';
          trendDescription = `up ${change.toFixed(1)}% from last week`;
        } else if (change < -5) {
          trend = 'declining';
          trendDescription = `down ${Math.abs(change).toFixed(1)}% from last week`;
        } else {
          trendDescription = 'consistent with last week';
        }
      }
      
      const priority = attendanceRate < 80 ? 'high' : attendanceRate < 90 ? 'medium' : 'low';
      
      return {
        id: `attendance-${Date.now()}`,
        type: 'attendance',
        title: `Weekly Attendance: ${attendanceRate.toFixed(1)}%`,
        description: `Student attendance is ${trendDescription}. ${totalRecords} attendance records analyzed.`,
        priority,
        actionRequired: attendanceRate < 85,
        suggestedActions: attendanceRate < 85 ? [
          'Contact parents of frequently absent students',
          'Review attendance policies with staff',
          'Consider rewards for good attendance'
        ] : undefined,
        createdAt: new Date().toISOString(),
        data: { attendanceRate, trend, totalRecords, presentRecords }
      };
      
    } catch {
      console.error('Error analyzing attendance');
      return null;
    }
  }
  
  private static async analyzeFinancials(schoolId: string, startDate: Date, endDate: Date): Promise<AIInsight | null> {
    try {
      const { data: currentRevenue } = await supabase!
        .from('financial_transactions')
        .select('amount')
        .eq('preschool_id', schoolId)
        .eq('type', 'fee_payment')
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      
      const { data: outstanding } = await supabase!
        .from('financial_transactions')
        .select('amount')
        .eq('preschool_id', schoolId)
        .eq('type', 'fee_payment')
        .eq('status', 'pending');
      
      const totalRevenue = currentRevenue?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const totalOutstanding = outstanding?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const paymentRate = totalRevenue > 0 ? (totalRevenue / (totalRevenue + totalOutstanding)) * 100 : 0;
      
      const priority = paymentRate < 70 ? 'high' : paymentRate < 85 ? 'medium' : 'low';
      
      return {
        id: `financial-${Date.now()}`,
        type: 'financial',
        title: `Payment Collection Rate: ${paymentRate.toFixed(1)}%`,
        description: `Monthly revenue: R${totalRevenue.toLocaleString()}. Outstanding fees: R${totalOutstanding.toLocaleString()}.`,
        priority,
        actionRequired: paymentRate < 80,
        suggestedActions: paymentRate < 80 ? [
          'Send payment reminders to parents',
          'Review payment terms and options',
          'Contact parents with overdue payments'
        ] : undefined,
        createdAt: new Date().toISOString(),
        data: { totalRevenue, totalOutstanding, paymentRate }
      };
      
    } catch {
      console.error('Error analyzing financials');
      return null;
    }
  }
  
  private static async analyzeEnrollment(schoolId: string, startDate: Date, endDate: Date): Promise<AIInsight | null> {
    try {
      const { data: students, count: totalStudents } = await supabase!
        .from('students')
        .select('id, created_at, status')
        .eq('preschool_id', schoolId);
      
      const newEnrollments = students?.filter(s => 
        new Date(s.created_at) >= startDate
      ).length || 0;
      
      const activeStudents = students?.filter(s => s.status === 'active').length || 0;
      const totalCapacity = 200; // This could be fetched from school settings
      const utilizationRate = (activeStudents / totalCapacity) * 100;
      
      let priority: 'low' | 'medium' | 'high' = 'low';
      let actionRequired = false;
      let suggestedActions: string[] = [];
      
      if (utilizationRate > 95) {
        priority = 'high';
        actionRequired = true;
        suggestedActions = ['Consider expanding capacity', 'Create waiting list', 'Review class sizes'];
      } else if (utilizationRate < 60) {
        priority = 'medium';
        actionRequired = true;
        suggestedActions = ['Launch marketing campaign', 'Review pricing strategy', 'Engage with community'];
      }
      
      return {
        id: `enrollment-${Date.now()}`,
        type: 'enrollment',
        title: `School Capacity: ${utilizationRate.toFixed(1)}%`,
        description: `${activeStudents} active students, ${newEnrollments} new enrollments this month. Capacity utilization at ${utilizationRate.toFixed(1)}%.`,
        priority,
        actionRequired,
        suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
        createdAt: new Date().toISOString(),
        data: { activeStudents, newEnrollments, utilizationRate, totalCapacity }
      };
      
    } catch {
      console.error('Error analyzing enrollment');
      return null;
    }
  }
  
  private static async analyzeTeacherPerformance(schoolId: string): Promise<AIInsight | null> {
    try {
      const { data: teachers, count: totalTeachers } = await supabase!
        .from('users')
        .select('id, role')
        .eq('preschool_id', schoolId)
        .eq('role', 'teacher');
      
      const { count: totalStudents } = await supabase!
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('preschool_id', schoolId)
        .eq('status', 'active');
      
      const activeTeachers = teachers?.length || 0;
      const studentTeacherRatio = activeTeachers > 0 ? (totalStudents || 0) / activeTeachers : 0;
      
      let priority: 'low' | 'medium' | 'high' = 'low';
      let actionRequired = false;
      let suggestedActions: string[] = [];
      
      if (studentTeacherRatio > 20) {
        priority = 'high';
        actionRequired = true;
        suggestedActions = ['Consider hiring additional teachers', 'Review class sizes', 'Assess teacher workload'];
      } else if (studentTeacherRatio > 15) {
        priority = 'medium';
        suggestedActions = ['Monitor teacher workload', 'Plan for future hiring needs'];
      }
      
      return {
        id: `teacher-${Date.now()}`,
        type: 'performance',
        title: `Student-Teacher Ratio: ${studentTeacherRatio.toFixed(1)}:1`,
        description: `${activeTeachers} active teachers managing ${totalStudents} students. ${studentTeacherRatio <= 12 ? 'Optimal' : studentTeacherRatio <= 18 ? 'Good' : 'High'} ratio.`,
        priority,
        actionRequired,
        suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
        createdAt: new Date().toISOString(),
        data: { activeTeachers, totalStudents, studentTeacherRatio }
      };
      
    } catch {
      console.error('Error analyzing teacher performance');
      return null;
    }
  }
  
  private static async analyzeOutstandingPayments(schoolId: string): Promise<AIInsight | null> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const { data: overduePayments } = await supabase!
        .from('financial_transactions')
        .select('amount, created_at')
        .eq('preschool_id', schoolId)
        .eq('type', 'fee_payment')
        .eq('status', 'pending')
        .lt('created_at', thirtyDaysAgo.toISOString());
      
      if (!overduePayments || overduePayments.length === 0) return null;
      
      const totalOverdue = overduePayments.reduce((sum, p) => sum + p.amount, 0);
      
      return {
        id: `payments-${Date.now()}`,
        type: 'alert',
        title: `${overduePayments.length} Overdue Payments`,
        description: `R${totalOverdue.toLocaleString()} in payments overdue by 30+ days. Immediate action required.`,
        priority: 'high',
        actionRequired: true,
        suggestedActions: [
          'Send urgent payment notices',
          'Contact parents directly',
          'Review payment plans with families',
          'Consider payment arrangements'
        ],
        createdAt: new Date().toISOString(),
        data: { overdueCount: overduePayments.length, totalOverdue }
      };
      
    } catch {
      console.error('Error analyzing outstanding payments');
      return null;
    }
  }
  
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(amount);
  }
  
  static getInsightIcon(type: string): string {
    switch (type) {
      case 'attendance': return 'people';
      case 'financial': return 'cash';
      case 'enrollment': return 'school';
      case 'performance': return 'trending-up';
      case 'alert': return 'warning';
      default: return 'information-circle';
    }
  }
  
  static getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  }
}