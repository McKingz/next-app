/**
 * Approval Workflow Service
 * 
 * Handles all approval workflows including:
 * - Parent POP (Proof of Payment) submissions
 * - Teacher petty cash requests
 * - Principal approvals/rejections
 * - Receipt verification
 * - Notification management
 */

import { supabase } from '../lib/supabase';
import { FinancialDataService } from './FinancialDataService';

export interface ProofOfPayment {
  id: string;
  preschool_id: string;
  student_id: string;
  submitted_by: string;
  parent_name: string;
  parent_email?: string;
  parent_phone?: string;
  
  // Payment details
  payment_amount: number;
  payment_date: string;
  payment_method: 'bank_transfer' | 'eft' | 'cash' | 'cheque' | 'mobile_payment' | 'card' | 'other';
  payment_reference?: string;
  bank_name?: string;
  account_number_last_4?: string;
  
  // Purpose
  payment_purpose: string;
  fee_type?: 'tuition' | 'registration' | 'activity' | 'transport' | 'meals' | 'uniform' | 'other';
  month_year?: string;
  
  // Documents
  receipt_image_path?: string;
  bank_statement_path?: string;
  additional_documents?: string[];
  
  // Status
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'requires_info' | 'matched';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  rejection_reason?: string;
  
  // Auto-matching
  matched_payment_id?: string;
  auto_matched: boolean;
  matching_confidence?: number;
  
  // Timestamps
  submitted_at: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  
  // Student info (joined)
  student_name?: string;
  student_grade?: string;
}

export interface PettyCashRequest {
  id: string;
  preschool_id: string;
  requested_by: string;
  requestor_name: string;
  requestor_role: string;
  
  // Request details
  amount: number;
  category: string;
  description: string;
  justification: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  
  // Budget
  budget_category_id?: string;
  estimated_total_cost?: number;
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'requires_info' | 'disbursed' | 'completed' | 'cancelled';
  approved_by?: string;
  approved_at?: string;
  approval_notes?: string;
  rejection_reason?: string;
  approved_amount?: number;
  
  // Disbursement
  disbursed_by?: string;
  disbursed_at?: string;
  disbursement_method?: 'cash' | 'bank_transfer' | 'petty_cash_float';
  
  // Receipt
  receipt_required: boolean;
  receipt_deadline?: string;
  receipt_submitted: boolean;
  receipt_image_path?: string;
  actual_amount_spent?: number;
  
  // Change tracking
  change_amount: number;
  change_returned: boolean;
  
  // Timestamps
  requested_at: string;
  needed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovalSummary {
  pending_pops: number;
  pending_petty_cash: number;
  total_pending_amount: number;
  urgent_requests: number;
  overdue_receipts: number;
}

export class ApprovalWorkflowService {
  
  // ============================================================================
  // PROOF OF PAYMENT (POP) METHODS
  // ============================================================================
  
  /**
   * Submit a new proof of payment
   */
  static async submitProofOfPayment(
    preschoolId: string,
    studentId: string,
    submittedBy: string,
    popData: {
      parent_name: string;
      parent_email?: string;
      parent_phone?: string;
      payment_amount: number;
      payment_date: string;
      payment_method: string;
      payment_reference?: string;
      bank_name?: string;
      account_number_last_4?: string;
      payment_purpose: string;
      fee_type?: string;
      month_year?: string;
      receipt_image_path?: string;
      bank_statement_path?: string;
    }
  ): Promise<ProofOfPayment | null> {
    try {
      const { data, error } = await supabase
        .from('proof_of_payments')
        .insert({
          preschool_id: preschoolId,
          student_id: studentId,
          submitted_by: submittedBy,
          ...popData,
          status: 'submitted',
        })
        .select(`
          *,
          students (
            first_name,
            last_name,
            grade_level
          )
        `)
        .single();

      if (error) {
        console.error('Error submitting POP:', error);
        return null;
      }

      // Log the action
      await this.logApprovalAction(
        preschoolId,
        'proof_of_payment',
        data.id,
        submittedBy,
        popData.parent_name,
        'parent',
        'submit',
        null,
        'submitted',
        `POP submitted for ${popData.payment_purpose}`
      );

      // Send notification to principal
      await this.notifyPrincipalOfNewPOP(data);

      return {
        ...data,
        student_name: data.students ? `${data.students.first_name} ${data.students.last_name}` : undefined,
        student_grade: data.students?.grade_level,
      };
    } catch (error) {
      console.error('Error in submitProofOfPayment:', error);
      return null;
    }
  }

  /**
   * Get POPs for principal review
   */
  static async getPendingPOPs(preschoolId: string, limit = 50): Promise<ProofOfPayment[]> {
    try {
      const { data, error } = await supabase
        .from('proof_of_payments')
        .select(`
          *,
          students (
            first_name,
            last_name,
            grade_level,
            parent_email,
            parent_id
          )
        `)
        .eq('preschool_id', preschoolId)
        .in('status', ['submitted', 'under_review', 'requires_info'])
        .order('submitted_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error loading pending POPs:', error);
        return [];
      }

      return data.map(pop => ({
        ...pop,
        student_name: pop.students ? `${pop.students.first_name} ${pop.students.last_name}` : 'Unknown Student',
        student_grade: pop.students?.grade_level,
      }));
    } catch (error) {
      console.error('Error in getPendingPOPs:', error);
      return [];
    }
  }

  /**
   * Approve a proof of payment
   */
  static async approvePOP(
    popId: string,
    approvedBy: string,
    approverName: string,
    reviewNotes?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('proof_of_payments')
        .update({
          status: 'approved',
          reviewed_by: approvedBy,
          reviewed_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq('id', popId)
        .select()
        .single();

      if (error) {
        console.error('Error approving POP:', error);
        return false;
      }

      // Log the action
      await this.logApprovalAction(
        data.preschool_id,
        'proof_of_payment',
        popId,
        approvedBy,
        approverName,
        'principal_admin',
        'approve',
        'submitted',
        'approved',
        reviewNotes
      );

      // Send notification to parent
      await this.notifyParentPOPApproved(data);

      return true;
    } catch (error) {
      console.error('Error in approvePOP:', error);
      return false;
    }
  }

  /**
   * Reject a proof of payment
   */
  static async rejectPOP(
    popId: string,
    rejectedBy: string,
    rejectorName: string,
    rejectionReason: string,
    reviewNotes?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('proof_of_payments')
        .update({
          status: 'rejected',
          reviewed_by: rejectedBy,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          review_notes: reviewNotes,
        })
        .eq('id', popId)
        .select()
        .single();

      if (error) {
        console.error('Error rejecting POP:', error);
        return false;
      }

      // Log the action
      await this.logApprovalAction(
        data.preschool_id,
        'proof_of_payment',
        popId,
        rejectedBy,
        rejectorName,
        'principal_admin',
        'reject',
        'submitted',
        'rejected',
        reviewNotes,
        rejectionReason
      );

      // Send notification to parent
      await this.notifyParentPOPRejected(data);

      return true;
    } catch (error) {
      console.error('Error in rejectPOP:', error);
      return false;
    }
  }

  // ============================================================================
  // PETTY CASH REQUEST METHODS
  // ============================================================================

  /**
   * Submit a new petty cash request
   */
  static async submitPettyCashRequest(
    preschoolId: string,
    requestedBy: string,
    requestorName: string,
    requestorRole: string,
    requestData: {
      amount: number;
      category: string;
      description: string;
      justification: string;
      urgency: 'low' | 'normal' | 'high' | 'urgent';
      budget_category_id?: string;
      estimated_total_cost?: number;
      needed_by?: string;
      receipt_required?: boolean;
    }
  ): Promise<PettyCashRequest | null> {
    try {
      // Set receipt deadline (7 days from needed_by or 7 days from now)
      const receiptDeadline = requestData.needed_by 
        ? new Date(new Date(requestData.needed_by).getTime() + 7 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('petty_cash_requests')
        .insert({
          preschool_id: preschoolId,
          requested_by: requestedBy,
          requestor_name: requestorName,
          requestor_role: requestorRole,
          ...requestData,
          receipt_required: requestData.receipt_required ?? true,
          receipt_deadline: receiptDeadline.toISOString().split('T')[0],
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('Error submitting petty cash request:', error);
        return null;
      }

      // Log the action
      await this.logApprovalAction(
        preschoolId,
        'petty_cash_request',
        data.id,
        requestedBy,
        requestorName,
        requestorRole,
        'submit',
        null,
        'pending',
        `Petty cash request for ${requestData.description}`
      );

      // Send notification to principal
      await this.notifyPrincipalOfNewPettyCashRequest(data);

      return data;
    } catch (error) {
      console.error('Error in submitPettyCashRequest:', error);
      return null;
    }
  }

  /**
   * Get pending petty cash requests for principal review
   */
  static async getPendingPettyCashRequests(preschoolId: string, limit = 50): Promise<PettyCashRequest[]> {
    try {
      const { data, error } = await supabase
        .from('petty_cash_requests')
        .select('*')
        .eq('preschool_id', preschoolId)
        .in('status', ['pending', 'requires_info'])
        .order('requested_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error loading pending petty cash requests:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getPendingPettyCashRequests:', error);
      return [];
    }
  }

  /**
   * Approve a petty cash request
   */
  static async approvePettyCashRequest(
    requestId: string,
    approvedBy: string,
    approverName: string,
    approvedAmount?: number,
    approvalNotes?: string
  ): Promise<boolean> {
    try {
      const { data: request, error: fetchError } = await supabase
        .from('petty_cash_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        console.error('Error fetching petty cash request:', fetchError);
        return false;
      }

      const finalApprovedAmount = approvedAmount ?? request.amount;

      const { data, error } = await supabase
        .from('petty_cash_requests')
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          approved_amount: finalApprovedAmount,
          approval_notes: approvalNotes,
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        console.error('Error approving petty cash request:', error);
        return false;
      }

      // Log the action
      await this.logApprovalAction(
        data.preschool_id,
        'petty_cash_request',
        requestId,
        approvedBy,
        approverName,
        'principal_admin',
        'approve',
        'pending',
        'approved',
        approvalNotes
      );

      // Send notification to teacher
      await this.notifyTeacherPettyCashApproved(data);

      return true;
    } catch (error) {
      console.error('Error in approvePettyCashRequest:', error);
      return false;
    }
  }

  /**
   * Reject a petty cash request
   */
  static async rejectPettyCashRequest(
    requestId: string,
    rejectedBy: string,
    rejectorName: string,
    rejectionReason: string,
    approvalNotes?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('petty_cash_requests')
        .update({
          status: 'rejected',
          approved_by: rejectedBy,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          approval_notes: approvalNotes,
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        console.error('Error rejecting petty cash request:', error);
        return false;
      }

      // Log the action
      await this.logApprovalAction(
        data.preschool_id,
        'petty_cash_request',
        requestId,
        rejectedBy,
        rejectorName,
        'principal_admin',
        'reject',
        'pending',
        'rejected',
        approvalNotes,
        rejectionReason
      );

      // Send notification to teacher
      await this.notifyTeacherPettyCashRejected(data);

      return true;
    } catch (error) {
      console.error('Error in rejectPettyCashRequest:', error);
      return false;
    }
  }

  // ============================================================================
  // DASHBOARD AND SUMMARY METHODS
  // ============================================================================

  /**
   * Get approval summary for principal dashboard
   */
  static async getApprovalSummary(preschoolId: string): Promise<ApprovalSummary> {
    try {
      // Count pending POPs
      const { count: pendingPOPs } = await supabase
        .from('proof_of_payments')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .in('status', ['submitted', 'under_review', 'requires_info']);

      // Count pending petty cash requests
      const { count: pendingPettyCash } = await supabase
        .from('petty_cash_requests')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .in('status', ['pending', 'requires_info']);

      // Get total pending amount
      const { data: pendingAmounts } = await supabase
        .from('petty_cash_requests')
        .select('amount')
        .eq('preschool_id', preschoolId)
        .in('status', ['pending', 'requires_info']);

      const totalPendingAmount = (pendingAmounts || []).reduce((sum, req) => sum + req.amount, 0);

      // Count urgent requests
      const { count: urgentRequests } = await supabase
        .from('petty_cash_requests')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .eq('urgency', 'urgent')
        .in('status', ['pending', 'approved']);

      // Count overdue receipts
      const today = new Date().toISOString().split('T')[0];
      const { count: overdueReceipts } = await supabase
        .from('petty_cash_requests')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .eq('status', 'disbursed')
        .eq('receipt_submitted', false)
        .lt('receipt_deadline', today);

      return {
        pending_pops: pendingPOPs || 0,
        pending_petty_cash: pendingPettyCash || 0,
        total_pending_amount: totalPendingAmount,
        urgent_requests: urgentRequests || 0,
        overdue_receipts: overdueReceipts || 0,
      };
    } catch (error) {
      console.error('Error getting approval summary:', error);
      return {
        pending_pops: 0,
        pending_petty_cash: 0,
        total_pending_amount: 0,
        urgent_requests: 0,
        overdue_receipts: 0,
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Log approval actions for audit trail
   */
  static async logApprovalAction(
    preschoolId: string,
    entityType: 'proof_of_payment' | 'petty_cash_request' | 'expense' | 'payment' | 'progress_report',
    entityId: string,
    performedBy: string,
    performerName: string,
    performerRole: string,
    action: 'submit' | 'review' | 'approve' | 'reject' | 'request_info' | 'resubmit' | 'cancel',
    previousStatus: string | null,
    newStatus: string,
    notes?: string,
    reason?: string
  ): Promise<void> {
    try {
      await supabase
        .from('approval_logs')
        .insert({
          preschool_id: preschoolId,
          entity_type: entityType,
          entity_id: entityId,
          performed_by: performedBy,
          performer_name: performerName,
          performer_role: performerRole,
          action,
          previous_status: previousStatus,
          new_status: newStatus,
          notes,
          reason,
        });
    } catch (error) {
      console.error('Error logging approval action:', error);
    }
  }

  // ============================================================================
  // NOTIFICATION METHODS (PLACEHOLDER - IMPLEMENT WITH YOUR NOTIFICATION SYSTEM)
  // ============================================================================

  static async notifyPrincipalOfNewPOP(pop: any): Promise<void> {
    // TODO: Implement notification to principal about new POP submission
    console.log(`📧 NOTIFICATION: New POP submitted by ${pop.parent_name} for amount ${FinancialDataService.formatCurrency(pop.payment_amount)}`);
  }

  static async notifyParentPOPApproved(pop: any): Promise<void> {
    // TODO: Implement notification to parent about POP approval
    console.log(`✅ NOTIFICATION: POP approved for ${pop.parent_name} - amount ${FinancialDataService.formatCurrency(pop.payment_amount)}`);
  }

  static async notifyParentPOPRejected(pop: any): Promise<void> {
    // TODO: Implement notification to parent about POP rejection
    console.log(`❌ NOTIFICATION: POP rejected for ${pop.parent_name} - reason: ${pop.rejection_reason}`);
  }

  static async notifyPrincipalOfNewPettyCashRequest(request: any): Promise<void> {
    // TODO: Implement notification to principal about new petty cash request
    console.log(`💰 NOTIFICATION: New petty cash request from ${request.requestor_name} for ${FinancialDataService.formatCurrency(request.amount)}`);
  }

  static async notifyTeacherPettyCashApproved(request: any): Promise<void> {
    // TODO: Implement notification to teacher about petty cash approval
    console.log(`✅ NOTIFICATION: Petty cash approved for ${request.requestor_name} - amount ${FinancialDataService.formatCurrency(request.approved_amount || request.amount)}`);
  }

  static async notifyTeacherPettyCashRejected(request: any): Promise<void> {
    // TODO: Implement notification to teacher about petty cash rejection
    console.log(`❌ NOTIFICATION: Petty cash rejected for ${request.requestor_name} - reason: ${request.rejection_reason}`);
  }

  // ============================================================================
  // PROGRESS REPORT NOTIFICATIONS
  // ============================================================================

  static async notifyPrincipalOfNewReport(report: any): Promise<void> {
    // TODO: Implement notification to principal about new report submission
    console.log(`📋 NOTIFICATION: New progress report submitted for review - Report ID: ${report.id}`);
  }

  static async notifyTeacherReportApproved(report: any): Promise<void> {
    // TODO: Implement notification to teacher about report approval
    console.log(`✅ NOTIFICATION: Progress report approved - Report ID: ${report.id}`);
  }

  static async notifyTeacherReportRejected(report: any): Promise<void> {
    // TODO: Implement notification to teacher about report rejection
    console.log(`❌ NOTIFICATION: Progress report rejected - Report ID: ${report.id} - Reason: ${report.rejection_reason}`);
  }

  static async notifyTeacherReportSent(report: any): Promise<void> {
    // TODO: Implement notification to teacher about report sent to parent
    console.log(`📧 NOTIFICATION: Progress report sent to parent - Report ID: ${report.id}`);
  }

  // ============================================================================
  // FORMATTING HELPERS
  // ============================================================================

  static formatCurrency = FinancialDataService.formatCurrency;

  static getStatusColor(status: string): string {
    switch (status) {
      case 'approved': 
      case 'matched': 
        return '#10B981'; // Green
      case 'pending': 
      case 'submitted': 
      case 'under_review': 
        return '#F59E0B'; // Yellow
      case 'rejected': 
        return '#EF4444'; // Red
      case 'requires_info': 
        return '#8B5CF6'; // Purple
      case 'disbursed': 
        return '#06B6D4'; // Cyan
      case 'completed': 
        return '#10B981'; // Green
      case 'urgent': 
        return '#DC2626'; // Dark red
      default: 
        return '#6B7280'; // Gray
    }
  }

  static getDisplayStatus(status: string): string {
    switch (status) {
      case 'submitted': return 'Submitted';
      case 'under_review': return 'Under Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'requires_info': return 'Info Required';
      case 'matched': return 'Matched';
      case 'pending': return 'Pending';
      case 'disbursed': return 'Disbursed';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status.replace('_', ' ').toUpperCase();
    }
  }

  static getUrgencyColor(urgency: string): string {
    switch (urgency) {
      case 'urgent': return '#DC2626'; // Dark red
      case 'high': return '#F59E0B'; // Orange
      case 'normal': return '#10B981'; // Green
      case 'low': return '#6B7280'; // Gray
      default: return '#6B7280';
    }
  }
}