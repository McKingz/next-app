import { supabase } from '@/lib/supabase'

/**
 * Notification Service
 * 
 * Handles triggering notifications via the Supabase Edge Function notifications-dispatcher
 */

export interface NotificationOptions {
  eventType: 
    | 'report_submitted_for_review'
    | 'report_approved'
    | 'report_rejected'
    | 'new_message'
    | 'new_announcement'
    | 'homework_graded'
  preschoolId?: string
  reportId?: string
  studentId?: string
  rejectionReason?: string
  customPayload?: any
}

/**
 * Send a notification via the notifications-dispatcher Edge Function
 */
export async function sendNotification(options: NotificationOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: session } = await supabase.auth.getSession()
    if (!session?.session?.access_token) {
      return { success: false, error: 'No active session' }
    }

    const payload: any = {
      event_type: options.eventType,
      preschool_id: options.preschoolId,
      report_id: options.reportId,
      student_id: options.studentId,
      rejection_reason: options.rejectionReason,
      custom_payload: options.customPayload,
      send_immediately: true,
    }

    const { data, error } = await supabase.functions.invoke('notifications-dispatcher', {
      body: payload,
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
      },
    })

    if (error) {
      console.error('Error sending notification:', error)
      return { success: false, error: error.message }
    }

    console.log('Notification sent successfully:', data)
    return { success: true }
  } catch (error: any) {
    console.error('Exception sending notification:', error)
    return { success: false, error: error?.message || 'Unknown error' }
  }
}

/**
 * Notify principals that a progress report has been submitted for review
 */
export async function notifyReportSubmittedForReview(
  reportId: string,
  studentId: string,
  preschoolId: string
): Promise<{ success: boolean; error?: string }> {
  return sendNotification({
    eventType: 'report_submitted_for_review',
    reportId,
    studentId,
    preschoolId,
  })
}

/**
 * Notify teacher that their progress report has been approved
 */
export async function notifyReportApproved(
  reportId: string,
  studentId: string,
  preschoolId: string
): Promise<{ success: boolean; error?: string }> {
  return sendNotification({
    eventType: 'report_approved',
    reportId,
    studentId,
    preschoolId,
  })
}

/**
 * Notify teacher that their progress report needs revision
 */
export async function notifyReportRejected(
  reportId: string,
  studentId: string,
  preschoolId: string,
  rejectionReason: string
): Promise<{ success: boolean; error?: string }> {
  return sendNotification({
    eventType: 'report_rejected',
    reportId,
    studentId,
    preschoolId,
    rejectionReason,
  })
}
