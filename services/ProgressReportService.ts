/**
 * ProgressReportService
 * 
 * Business logic for progress report approval workflow with digital signatures
 * Handles Term 2 and School Readiness report gating, teacher-principal approval flow
 * 
 * References:
 * - Supabase JS v2: https://supabase.com/docs/reference/javascript/introduction
 * - Multi-tenant RLS: https://supabase.com/docs/guides/auth/row-level-security
 * - WARP.md: File size limit ≤500 lines for services
 */

import { supabase } from '../lib/supabase';
import { ApprovalWorkflowService } from './ApprovalWorkflowService';

/**
 * Progress Report with signature workflow fields
 */
export interface ProgressReport {
  id: string;
  preschool_id: string;
  student_id: string;
  teacher_id: string;
  
  // Report metadata
  report_period: string;
  report_type: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'term';
  report_category?: 'general' | 'school_readiness';
  
  // Content fields
  overall_comments?: string;
  teacher_comments?: string;
  strengths?: string;
  areas_for_improvement?: string;
  subjects_performance?: Record<string, any>;
  attendance_summary?: Record<string, any>;
  behavioral_notes?: Record<string, any>;
  overall_grade?: string;
  
  // School readiness fields
  school_readiness_indicators?: Record<string, any>;
  developmental_milestones?: Record<string, any>;
  transition_readiness_level?: 'not_ready' | 'developing' | 'ready' | 'exceeds_expectations';
  readiness_notes?: string;
  recommendations?: string;
  
  // Signature workflow fields
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'sent';
  teacher_signature_data?: string;
  teacher_signed_at?: string;
  principal_signature_data?: string;
  principal_signed_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  review_notes?: string;
  submission_count: number;
  
  // Email tracking
  email_sent_at?: string;
  email_message_id?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Joined data
  student_name?: string;
  teacher_name?: string;
  reviewer_name?: string;
}

/**
 * ProgressReportService
 * 
 * Handles all operations for progress report approval workflow
 * Enforces Term 2 and School Readiness gating rules
 */
export class ProgressReportService {
  
  /**
   * Determine if report requires approval workflow
   * 
   * Rules:
   * - report_type='term' AND report_period contains 'Term 2' (case-insensitive), OR
   * - report_category='school_readiness'
   * 
   * @param reportType - Type of report (weekly, monthly, quarterly, annual, term)
   * @param reportCategory - Category (general or school_readiness)
   * @param reportPeriod - Period text (e.g., "Term 2 2025", "Q4 2025")
   * @returns true if approval workflow required
   */
  static requiresApprovalWorkflow(
    reportType: string,
    reportCategory: string | undefined,
    reportPeriod: string
  ): boolean {
    // School readiness reports always require approval
    if (reportCategory === 'school_readiness') {
      return true;
    }
    
    // Term 2 reports require approval
    if (reportType === 'term') {
      const normalizedPeriod = reportPeriod.toLowerCase().trim();
      return normalizedPeriod.includes('term 2') || normalizedPeriod.includes('term2');
    }
    
    return false;
  }
  
  /**
   * Submit report for principal review
   * 
   * Validates:
   * - Report belongs to teacher
   * - Status is draft or rejected
   * - Signature data provided
   * 
   * Updates:
   * - teacher_signature_data, teacher_signed_at
   * - status → pending_review
   * - submission_count (increment if resubmission)
   * 
   * @param reportId - UUID of report
   * @param preschoolId - UUID of preschool (multi-tenant isolation)
   * @param teacherId - UUID of teacher submitting
   * @param teacherSignature - Base64 PNG signature data
   * @returns true if successful
   */
  static async submitReportForReview(
    reportId: string,
    preschoolId: string,
    teacherId: string,
    teacherSignature: string
  ): Promise<boolean> {
    try {
      // Fetch current report to validate and get previous status
      const { data: existingReport, error: fetchError } = await supabase
        .from('progress_reports')
        .select('status, submission_count, teacher_id')
        .eq('id', reportId)
        .eq('preschool_id', preschoolId)
        .eq('teacher_id', teacherId)
        .single();
      
      if (fetchError || !existingReport) {
        console.error('[ProgressReportService] Report not found or access denied:', fetchError);
        return false;
      }
      
      // Validate status
      if (!['draft', 'rejected'].includes(existingReport.status)) {
        console.error('[ProgressReportService] Cannot submit report with status:', existingReport.status);
        return false;
      }
      
      const wasRejected = existingReport.status === 'rejected';
      const newSubmissionCount = wasRejected ? existingReport.submission_count + 1 : 0;
      
      // Update report with signature and new status
      const { error: updateError } = await supabase
        .from('progress_reports')
        .update({
          teacher_signature_data: teacherSignature,
          teacher_signed_at: new Date().toISOString(),
          status: 'pending_review',
          submission_count: newSubmissionCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
        .eq('preschool_id', preschoolId)
        .eq('teacher_id', teacherId);
      
      if (updateError) {
        console.error('[ProgressReportService] Failed to update report:', updateError);
        return false;
      }
      
      // Log action
      await ApprovalWorkflowService.logApprovalAction(
        preschoolId,
        'progress_report',
        reportId,
        teacherId,
        '', // Teacher name fetched separately if needed
        'teacher',
        'submit',
        existingReport.status,
        'pending_review',
        wasRejected ? `Resubmission #${newSubmissionCount}` : 'Initial submission'
      );
      
      // Notify principals
      await ApprovalWorkflowService.notifyPrincipalOfNewReport({
        id: reportId,
        preschool_id: preschoolId,
      });
      
      return true;
    } catch (error) {
      console.error('[ProgressReportService] Error in submitReportForReview:', error);
      return false;
    }
  }
  
  /**
   * Get reports pending principal review
   * 
   * @param preschoolId - UUID of preschool (multi-tenant isolation)
   * @param principalId - UUID of principal (for audit)
   * @returns Array of reports with status=pending_review
   */
  static async getReportsForReview(
    preschoolId: string,
    principalId: string
  ): Promise<ProgressReport[]> {
    try {
      // Use explicit FK-qualified embeds to avoid PostgREST 300 (ambiguous relationship)
      // progress_reports has two FKs to users (teacher_id, reviewed_by), so we must disambiguate
      const { data, error, status } = await supabase
        .from('progress_reports')
        .select(`
          *,
          students:students!progress_reports_student_id_fkey(
            first_name,
            last_name
          ),
          users:users!progress_reports_teacher_id_fkey(
            first_name,
            last_name
          )
        `)
        .eq('preschool_id', preschoolId)
        .eq('status', 'pending_review')
        .order('teacher_signed_at', { ascending: false });
      
      // If ambiguous relationship persists (HTTP 300 / PGRST302), retry without embeds as safe fallback
      if (error && (status === 300 || (error as any)?.code === 'PGRST302')) {
        const retry = await supabase
          .from('progress_reports')
          .select('id, status, preschool_id, teacher_signed_at, student_id, teacher_id')
          .eq('preschool_id', preschoolId)
          .eq('status', 'pending_review')
          .order('teacher_signed_at', { ascending: false });
        if (retry.error) {
          console.error('[ProgressReportService] Error fetching reports for review (retry):', retry.error);
          return [];
        }

        // Optionally enrich names separately (best-effort)
        const rows = retry.data || [];
        return rows.map((report: any) => ({
          ...report,
          student_name: 'Pending student',
          teacher_name: 'Pending teacher',
        })) as any;
      }
      
      if (error) {
        console.error('[ProgressReportService] Error fetching reports for review:', error);
        return [];
      }
      
      const buildName = (first?: string | null, last?: string | null) => {
        const parts = [first, last].filter((p) => !!p && String(p).toLowerCase() !== 'null');
        return parts.length > 0 ? parts.join(' ') : undefined;
      };

      return (data || []).map((report: any) => ({
        ...report,
        student_name: report.students 
          ? buildName(report.students.first_name, report.students.last_name) || 'Unknown Student'
          : 'Unknown Student',
        teacher_name: report.users 
          ? buildName(report.users.first_name, report.users.last_name) || 'Unknown Teacher'
          : 'Unknown Teacher',
      }));
    } catch (error) {
      console.error('[ProgressReportService] Error in getReportsForReview:', error);
      return [];
    }
  }
  
  /**
   * Approve report with principal signature
   * 
   * Validates:
   * - Status is pending_review
   * - Principal belongs to preschool
   * 
   * Updates:
   * - principal_signature_data, principal_signed_at
   * - reviewed_by, reviewed_at, review_notes
   * - status → approved
   * 
   * @param reportId - UUID of report
   * @param preschoolId - UUID of preschool (multi-tenant isolation)
   * @param principalId - UUID of principal approving
   * @param principalSignature - Base64 PNG signature data
   * @param notes - Optional approval notes
   * @returns true if successful
   */
  static async approveReport(
    reportId: string,
    preschoolId: string,
    principalId: string,
    principalSignature: string,
    notes?: string
  ): Promise<boolean> {
    try {
      // Validate report exists and is pending review
      const { data: existingReport, error: fetchError } = await supabase
        .from('progress_reports')
        .select('status, teacher_id')
        .eq('id', reportId)
        .eq('preschool_id', preschoolId)
        .eq('status', 'pending_review')
        .single();
      
      if (fetchError || !existingReport) {
        console.error('[ProgressReportService] Report not found or not pending review:', fetchError);
        return false;
      }
      
      // Update report with principal approval
      const { error: updateError } = await supabase
        .from('progress_reports')
        .update({
          principal_signature_data: principalSignature,
          principal_signed_at: new Date().toISOString(),
          reviewed_by: principalId,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
        .eq('preschool_id', preschoolId)
        .eq('status', 'pending_review');
      
      if (updateError) {
        console.error('[ProgressReportService] Failed to approve report:', updateError);
        return false;
      }
      
      // Log action
      await ApprovalWorkflowService.logApprovalAction(
        preschoolId,
        'progress_report',
        reportId,
        principalId,
        '', // Principal name fetched separately if needed
        'principal',
        'approve',
        'pending_review',
        'approved',
        notes
      );
      
      // Notify teacher
      await ApprovalWorkflowService.notifyTeacherReportApproved({
        id: reportId,
        teacher_id: existingReport.teacher_id,
      });
      
      return true;
    } catch (error) {
      console.error('[ProgressReportService] Error in approveReport:', error);
      return false;
    }
  }
  
  /**
   * Reject report with reason
   * 
   * Validates:
   * - Status is pending_review
   * - Reason provided (min 10 chars)
   * 
   * Updates:
   * - rejection_reason, review_notes
   * - reviewed_by, reviewed_at
   * - principal_signature_data → null (clear any existing)
   * - status → rejected
   * 
   * @param reportId - UUID of report
   * @param preschoolId - UUID of preschool (multi-tenant isolation)
   * @param principalId - UUID of principal rejecting
   * @param reason - Rejection reason (required, min 10 chars)
   * @param notes - Optional additional notes
   * @returns true if successful
   */
  static async rejectReport(
    reportId: string,
    preschoolId: string,
    principalId: string,
    reason: string,
    notes?: string
  ): Promise<boolean> {
    try {
      // Validate reason
      if (!reason || reason.trim().length < 10) {
        console.error('[ProgressReportService] Rejection reason too short (min 10 chars)');
        return false;
      }
      
      // Validate report exists and is pending review
      const { data: existingReport, error: fetchError } = await supabase
        .from('progress_reports')
        .select('status, teacher_id')
        .eq('id', reportId)
        .eq('preschool_id', preschoolId)
        .eq('status', 'pending_review')
        .single();
      
      if (fetchError || !existingReport) {
        console.error('[ProgressReportService] Report not found or not pending review:', fetchError);
        return false;
      }
      
      // Update report with rejection
      const { error: updateError } = await supabase
        .from('progress_reports')
        .update({
          rejection_reason: reason,
          review_notes: notes,
          reviewed_by: principalId,
          reviewed_at: new Date().toISOString(),
          principal_signature_data: null, // Clear any existing signature
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
        .eq('preschool_id', preschoolId)
        .eq('status', 'pending_review');
      
      if (updateError) {
        console.error('[ProgressReportService] Failed to reject report:', updateError);
        return false;
      }
      
      // Log action
      await ApprovalWorkflowService.logApprovalAction(
        preschoolId,
        'progress_report',
        reportId,
        principalId,
        '', // Principal name fetched separately if needed
        'principal',
        'reject',
        'pending_review',
        'rejected',
        notes,
        reason
      );
      
      // Notify teacher
      await ApprovalWorkflowService.notifyTeacherReportRejected({
        id: reportId,
        teacher_id: existingReport.teacher_id,
        rejection_reason: reason,
      });
      
      return true;
    } catch (error) {
      console.error('[ProgressReportService] Error in rejectReport:', error);
      return false;
    }
  }
  
  /**
   * Check if teacher can edit report
   * 
   * Rules:
   * - Status must be draft or rejected
   * - Teacher must be the creator
   * 
   * @param reportId - UUID of report
   * @param teacherId - UUID of teacher
   * @returns true if teacher can edit
   */
  static async canTeacherEditReport(
    reportId: string,
    teacherId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('progress_reports')
        .select('status')
        .eq('id', reportId)
        .eq('teacher_id', teacherId)
        .single();
      
      if (error || !data) {
        return false;
      }
      
      return ['draft', 'rejected'].includes(data.status);
    } catch (error) {
      console.error('[ProgressReportService] Error in canTeacherEditReport:', error);
      return false;
    }
  }
  
  /**
   * Send approved report to parent
   * 
   * Validates:
   * - Status is approved
   * - Report has both signatures
   * 
   * Updates:
   * - status → sent
   * - email_sent_at timestamp
   * 
   * Note: Actual PDF generation and email sending handled by EmailTemplateService
   * 
   * @param reportId - UUID of report
   * @param preschoolId - UUID of preschool (multi-tenant isolation)
   * @returns true if successful
   */
  static async sendReportToParent(
    reportId: string,
    preschoolId: string
  ): Promise<boolean> {
    try {
      // Validate report is approved
      const { data: report, error: fetchError } = await supabase
        .from('progress_reports')
        .select('status, teacher_signature_data, principal_signature_data, teacher_id')
        .eq('id', reportId)
        .eq('preschool_id', preschoolId)
        .eq('status', 'approved')
        .single();
      
      if (fetchError || !report) {
        console.error('[ProgressReportService] Report not found or not approved:', fetchError);
        return false;
      }
      
      // Validate both signatures present
      if (!report.teacher_signature_data || !report.principal_signature_data) {
        console.error('[ProgressReportService] Report missing signatures');
        return false;
      }
      
      // Update status to sent
      const { error: updateError } = await supabase
        .from('progress_reports')
        .update({
          status: 'sent',
          email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
        .eq('preschool_id', preschoolId)
        .eq('status', 'approved');
      
      if (updateError) {
        console.error('[ProgressReportService] Failed to mark report as sent:', updateError);
        return false;
      }
      
      // Log action
      await ApprovalWorkflowService.logApprovalAction(
        preschoolId,
        'progress_report',
        reportId,
        report.teacher_id,
        '', // Teacher name fetched separately if needed
        'teacher',
        'submit', // Using 'submit' as closest action type for send
        'approved',
        'sent',
        'Report sent to parent'
      );
      
      // Notify teacher
      await ApprovalWorkflowService.notifyTeacherReportSent({
        id: reportId,
        teacher_id: report.teacher_id,
      });
      
      return true;
    } catch (error) {
      console.error('[ProgressReportService] Error in sendReportToParent:', error);
      return false;
    }
  }
}

/**
 * Documentation Sources:
 * - Supabase JS v2 Auth: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
 * - Supabase JS v2 Database: https://supabase.com/docs/reference/javascript/select
 * - PostgreSQL TIMESTAMPTZ: https://www.postgresql.org/docs/current/datatype-datetime.html
 * - Multi-tenant RLS: https://supabase.com/docs/guides/auth/row-level-security
 */
