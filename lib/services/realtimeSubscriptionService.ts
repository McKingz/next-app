/**
 * Real-time Subscription Service
 * 
 * Handles Supabase real-time subscriptions for live data updates
 * across dashboards, notifications, and user interfaces.
 */

import { assertSupabase } from '@/lib/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Types for real-time events
export interface RealtimeEvent<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  new: T;
  old?: T;
  timestamp: string;
  schoolId?: string;
}

export interface StudentEnrollmentEvent {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  status: 'active' | 'pending' | 'withdrawn';
  school_id: string;
  created_at: string;
}

export interface PaymentEvent {
  id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  payment_method: string;
  student_id: string;
  school_id: string;
  created_at: string;
}

export interface TeacherActivityEvent {
  id: string;
  teacher_id: string;
  activity_type: 'login' | 'lesson_plan' | 'grade_submission' | 'message_sent';
  description: string;
  school_id: string;
  created_at: string;
}

export interface AttendanceEvent {
  id: string;
  student_id: string;
  date: string;
  present: boolean;
  reason?: string;
  school_id: string;
}

export interface MeetingEvent {
  id: string;
  title: string;
  start_time: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  host_id: string;
  school_id: string;
}

// Callback types
export type StudentEnrollmentCallback = (event: RealtimeEvent<StudentEnrollmentEvent>) => void;
export type PaymentCallback = (event: RealtimeEvent<PaymentEvent>) => void;
export type TeacherActivityCallback = (event: RealtimeEvent<TeacherActivityEvent>) => void;
export type AttendanceCallback = (event: RealtimeEvent<AttendanceEvent>) => void;
export type MeetingCallback = (event: RealtimeEvent<MeetingEvent>) => void;

/**
 * Real-time Subscription Manager
 * Centralizes all real-time subscriptions and provides a clean API
 */
export class RealtimeSubscriptionService {
  private static channels: Map<string, RealtimeChannel> = new Map();
  private static subscriptions: Map<string, Set<string>> = new Map();

  /**
   * Subscribe to student enrollment changes
   */
  static subscribeToStudentEnrollments(
    schoolId: string, 
    callback: StudentEnrollmentCallback,
    subscriptionId?: string
  ): string {
    const id = subscriptionId || `student_enrollments_${Date.now()}`;
    const channelName = `students_${schoolId}`;

    if (!this.channels.has(channelName)) {
      const channel = assertSupabase()
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'students',
            filter: `school_id=eq.${schoolId}`
          },
          (payload: RealtimePostgresChangesPayload<StudentEnrollmentEvent>) => {
            const event: RealtimeEvent<StudentEnrollmentEvent> = {
              eventType: payload.eventType,
              table: 'students',
              new: payload.new as StudentEnrollmentEvent,
              old: payload.old as StudentEnrollmentEvent,
              timestamp: new Date().toISOString(),
              schoolId
            };

            // Notify all subscribers
            this.notifySubscribers(channelName, event);
          }
        )
        .subscribe();

      this.channels.set(channelName, channel);
      this.subscriptions.set(channelName, new Set());
    }

    // Store callback
    this.subscriptions.get(channelName)?.add(id);
    this.storeCallback(channelName, id, callback);

    return id;
  }

  /**
   * Subscribe to payment updates
   */
  static subscribeToPayments(
    schoolId: string,
    callback: PaymentCallback,
    subscriptionId?: string
  ): string {
    const id = subscriptionId || `payments_${Date.now()}`;
    const channelName = `payments_${schoolId}`;

    if (!this.channels.has(channelName)) {
      const channel = assertSupabase()
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payments',
            filter: `school_id=eq.${schoolId}`
          },
          (payload: RealtimePostgresChangesPayload<PaymentEvent>) => {
            const event: RealtimeEvent<PaymentEvent> = {
              eventType: payload.eventType,
              table: 'payments',
              new: payload.new as PaymentEvent,
              old: payload.old as PaymentEvent,
              timestamp: new Date().toISOString(),
              schoolId
            };

            this.notifySubscribers(channelName, event);
          }
        )
        .subscribe();

      this.channels.set(channelName, channel);
      this.subscriptions.set(channelName, new Set());
    }

    this.subscriptions.get(channelName)?.add(id);
    this.storeCallback(channelName, id, callback);

    return id;
  }

  /**
   * Subscribe to teacher activities
   */
  static subscribeToTeacherActivities(
    schoolId: string,
    callback: TeacherActivityCallback,
    subscriptionId?: string
  ): string {
    const id = subscriptionId || `teacher_activities_${Date.now()}`;
    const channelName = `teacher_activities_${schoolId}`;

    if (!this.channels.has(channelName)) {
      const channel = assertSupabase()
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'teacher_activities',
            filter: `school_id=eq.${schoolId}`
          },
          (payload: RealtimePostgresChangesPayload<TeacherActivityEvent>) => {
            const event: RealtimeEvent<TeacherActivityEvent> = {
              eventType: payload.eventType,
              table: 'teacher_activities',
              new: payload.new as TeacherActivityEvent,
              old: payload.old as TeacherActivityEvent,
              timestamp: new Date().toISOString(),
              schoolId
            };

            this.notifySubscribers(channelName, event);
          }
        )
        .subscribe();

      this.channels.set(channelName, channel);
      this.subscriptions.set(channelName, new Set());
    }

    this.subscriptions.get(channelName)?.add(id);
    this.storeCallback(channelName, id, callback);

    return id;
  }

  /**
   * Subscribe to attendance updates
   */
  static subscribeToAttendance(
    schoolId: string,
    callback: AttendanceCallback,
    subscriptionId?: string
  ): string {
    const id = subscriptionId || `attendance_${Date.now()}`;
    const channelName = `attendance_${schoolId}`;

    if (!this.channels.has(channelName)) {
      const channel = assertSupabase()
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance',
            filter: `school_id=eq.${schoolId}`
          },
          (payload: RealtimePostgresChangesPayload<AttendanceEvent>) => {
            const event: RealtimeEvent<AttendanceEvent> = {
              eventType: payload.eventType,
              table: 'attendance',
              new: payload.new as AttendanceEvent,
              old: payload.old as AttendanceEvent,
              timestamp: new Date().toISOString(),
              schoolId
            };

            this.notifySubscribers(channelName, event);
          }
        )
        .subscribe();

      this.channels.set(channelName, channel);
      this.subscriptions.set(channelName, new Set());
    }

    this.subscriptions.get(channelName)?.add(id);
    this.storeCallback(channelName, id, callback);

    return id;
  }

  /**
   * Subscribe to meeting updates
   */
  static subscribeToMeetings(
    schoolId: string,
    callback: MeetingCallback,
    subscriptionId?: string
  ): string {
    const id = subscriptionId || `meetings_${Date.now()}`;
    const channelName = `meetings_${schoolId}`;

    if (!this.channels.has(channelName)) {
      const channel = assertSupabase()
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'meetings',
            filter: `school_id=eq.${schoolId}`
          },
          (payload: RealtimePostgresChangesPayload<MeetingEvent>) => {
            const event: RealtimeEvent<MeetingEvent> = {
              eventType: payload.eventType,
              table: 'meetings',
              new: payload.new as MeetingEvent,
              old: payload.old as MeetingEvent,
              timestamp: new Date().toISOString(),
              schoolId
            };

            this.notifySubscribers(channelName, event);
          }
        )
        .subscribe();

      this.channels.set(channelName, channel);
      this.subscriptions.set(channelName, new Set());
    }

    this.subscriptions.get(channelName)?.add(id);
    this.storeCallback(channelName, id, callback);

    return id;
  }

  /**
   * Subscribe to multiple data types for a comprehensive dashboard
   */
  static subscribeToDashboardData(
    schoolId: string,
    callbacks: {
      onStudentEnrollment?: StudentEnrollmentCallback;
      onPayment?: PaymentCallback;
      onTeacherActivity?: TeacherActivityCallback;
      onAttendance?: AttendanceCallback;
      onMeeting?: MeetingCallback;
    }
  ): string[] {
    const subscriptionIds: string[] = [];

    if (callbacks.onStudentEnrollment) {
      subscriptionIds.push(
        this.subscribeToStudentEnrollments(schoolId, callbacks.onStudentEnrollment)
      );
    }

    if (callbacks.onPayment) {
      subscriptionIds.push(
        this.subscribeToPayments(schoolId, callbacks.onPayment)
      );
    }

    if (callbacks.onTeacherActivity) {
      subscriptionIds.push(
        this.subscribeToTeacherActivities(schoolId, callbacks.onTeacherActivity)
      );
    }

    if (callbacks.onAttendance) {
      subscriptionIds.push(
        this.subscribeToAttendance(schoolId, callbacks.onAttendance)
      );
    }

    if (callbacks.onMeeting) {
      subscriptionIds.push(
        this.subscribeToMeetings(schoolId, callbacks.onMeeting)
      );
    }

    return subscriptionIds;
  }

  /**
   * Unsubscribe from a specific subscription
   */
  static unsubscribe(subscriptionId: string): void {
    // Find the channel containing this subscription
    for (const [channelName, subscriptionSet] of this.subscriptions.entries()) {
      if (subscriptionSet.has(subscriptionId)) {
        subscriptionSet.delete(subscriptionId);
        this.removeCallback(channelName, subscriptionId);

        // If no more subscriptions for this channel, clean up
        if (subscriptionSet.size === 0) {
          const channel = this.channels.get(channelName);
          if (channel) {
            assertSupabase().removeChannel(channel);
            this.channels.delete(channelName);
            this.subscriptions.delete(channelName);
            this.cleanupCallbacks(channelName);
          }
        }
        break;
      }
    }
  }

  /**
   * Unsubscribe from all subscriptions for a school
   */
  static unsubscribeFromSchool(schoolId: string): void {
    const channelsToRemove: string[] = [];

    for (const [channelName] of this.channels.entries()) {
      if (channelName.endsWith(`_${schoolId}`)) {
        channelsToRemove.push(channelName);
      }
    }

    channelsToRemove.forEach(channelName => {
      const channel = this.channels.get(channelName);
      if (channel) {
        assertSupabase().removeChannel(channel);
        this.channels.delete(channelName);
        this.subscriptions.delete(channelName);
        this.cleanupCallbacks(channelName);
      }
    });
  }

  /**
   * Unsubscribe from all active subscriptions
   */
  static unsubscribeAll(): void {
for (const [, channel] of this.channels.entries()) {
      assertSupabase().removeChannel(channel);
    }

    this.channels.clear();
    this.subscriptions.clear();
    this.callbackStorage.clear();
  }

  /**
   * Get active subscription count for monitoring
   */
  static getActiveSubscriptions(): { 
    channels: number; 
    subscriptions: number;
    details: { [channelName: string]: number };
  } {
    const details: { [channelName: string]: number } = {};
    let totalSubscriptions = 0;

    for (const [channelName, subscriptionSet] of this.subscriptions.entries()) {
      details[channelName] = subscriptionSet.size;
      totalSubscriptions += subscriptionSet.size;
    }

    return {
      channels: this.channels.size,
      subscriptions: totalSubscriptions,
      details
    };
  }

  // Private helper methods

  private static callbackStorage: Map<string, Map<string, Function>> = new Map();

  private static storeCallback(channelName: string, subscriptionId: string, callback: Function): void {
    if (!this.callbackStorage.has(channelName)) {
      this.callbackStorage.set(channelName, new Map());
    }
    this.callbackStorage.get(channelName)?.set(subscriptionId, callback);
  }

  private static removeCallback(channelName: string, subscriptionId: string): void {
    this.callbackStorage.get(channelName)?.delete(subscriptionId);
  }

  private static cleanupCallbacks(channelName: string): void {
    this.callbackStorage.delete(channelName);
  }

  private static notifySubscribers(channelName: string, event: RealtimeEvent): void {
    const callbacks = this.callbackStorage.get(channelName);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in realtime callback:', error);
        }
      });
    }
  }
}

/**
 * React Hook for Dashboard Real-time Data
 * Provides a convenient hook for React components to subscribe to real-time updates
 */
class DashboardRealtimeHook {
  
  /**
   * Subscribe to dashboard real-time data with automatic cleanup
   */
  static useDashboardSubscriptions(
    schoolId: string,
    callbacks: {
      onStudentEnrollment?: StudentEnrollmentCallback;
      onPayment?: PaymentCallback;
      onTeacherActivity?: TeacherActivityCallback;
      onAttendance?: AttendanceCallback;
      onMeeting?: MeetingCallback;
    },
    enabled: boolean = true
  ): {
    subscriptions: string[];
    unsubscribe: () => void;
    isConnected: boolean;
  } {
    
    if (!enabled || !schoolId) {
      return {
        subscriptions: [],
        unsubscribe: () => {},
        isConnected: false
      };
    }

    const subscriptions = RealtimeSubscriptionService.subscribeToDashboardData(
      schoolId,
      callbacks
    );

    const unsubscribe = () => {
      subscriptions.forEach(id => {
        RealtimeSubscriptionService.unsubscribe(id);
      });
    };

    return {
      subscriptions,
      unsubscribe,
      isConnected: true
    };
  }
}

/**
 * Notification Handler for Real-time Events
 * Provides smart notification logic based on real-time events
 */
class RealtimeNotificationHandler {
  
  /**
   * Create notification handlers for different event types
   */
  static createNotificationHandlers(onNotification: (notification: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    data?: any;
  }) => void) {
    
    const studentEnrollmentHandler: StudentEnrollmentCallback = (event) => {
      if (event.eventType === 'INSERT') {
        onNotification({
          title: 'New Student Enrollment',
          message: `${event.new.first_name} ${event.new.last_name} has enrolled in ${event.new.grade_level}`,
          type: 'success',
          data: event.new
        });
      } else if (event.eventType === 'UPDATE' && event.new.status === 'withdrawn') {
        onNotification({
          title: 'Student Withdrawal',
          message: `${event.new.first_name} ${event.new.last_name} has withdrawn`,
          type: 'warning',
          data: event.new
        });
      }
    };

    const paymentHandler: PaymentCallback = (event) => {
      if (event.eventType === 'UPDATE') {
        if (event.new.status === 'completed' && event.old?.status !== 'completed') {
          onNotification({
            title: 'Payment Received',
            message: `Payment of R${event.new.amount} has been processed successfully`,
            type: 'success',
            data: event.new
          });
        } else if (event.new.status === 'failed') {
          onNotification({
            title: 'Payment Failed',
            message: `Payment of R${event.new.amount} has failed`,
            type: 'error',
            data: event.new
          });
        }
      }
    };

    const teacherActivityHandler: TeacherActivityCallback = (event) => {
      if (event.eventType === 'INSERT' && event.new.activity_type === 'login') {
        onNotification({
          title: 'Teacher Login',
          message: event.new.description,
          type: 'info',
          data: event.new
        });
      }
    };

    const attendanceHandler: AttendanceCallback = (event) => {
      // Only notify for critical attendance issues
      if (event.eventType === 'INSERT' && !event.new.present && event.new.reason === 'unauthorized') {
        onNotification({
          title: 'Attendance Alert',
          message: 'Unauthorized absence recorded',
          type: 'warning',
          data: event.new
        });
      }
    };

    const meetingHandler: MeetingCallback = (event) => {
      if (event.eventType === 'UPDATE' && event.new.status === 'in-progress') {
        onNotification({
          title: 'Meeting Started',
          message: `${event.new.title} is now in progress`,
          type: 'info',
          data: event.new
        });
      }
    };

    return {
      onStudentEnrollment: studentEnrollmentHandler,
      onPayment: paymentHandler,
      onTeacherActivity: teacherActivityHandler,
      onAttendance: attendanceHandler,
      onMeeting: meetingHandler
    };
  }
}

export {
  RealtimeSubscriptionService as default,
  DashboardRealtimeHook,
  RealtimeNotificationHandler
};
