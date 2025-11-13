// ================================================
// Profile Invoice Notification Types
// TypeScript interfaces for invoice notification preferences and signatures
// ================================================

export type NotificationChannel = 'email' | 'push' | 'sms';

export type NotificationEvent =
  | 'new_invoice'
  | 'invoice_sent'
  | 'overdue_reminder'
  | 'payment_confirmed'
  | 'invoice_viewed';

export interface EventPreference {
  email: boolean;
  push?: boolean;
  sms?: boolean;
  // For overdue reminders, configurable cadence in days
  cadence_days?: number[];
}

export interface InvoiceNotificationPreferences {
  channels: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  events: {
    new_invoice: EventPreference;
    invoice_sent: EventPreference;
    overdue_reminder: EventPreference;
    payment_confirmed: EventPreference;
    invoice_viewed: EventPreference;
  };
  email_include_signature: boolean;
  pdf_include_signature: boolean;
  digest: {
    overdue_daily: boolean;
    weekly_summary: boolean;
  };
}

export interface SignatureInfo {
  url?: string;
  public_id?: string;
  updated_at?: string;
}

export interface UserInvoiceNotificationSettings {
  preferences: InvoiceNotificationPreferences;
  signature?: SignatureInfo;
}

export interface UpdateInvoiceNotificationPreferencesRequest {
  preferences: Partial<InvoiceNotificationPreferences>;
}

export interface TestNotificationRequest {
  event: NotificationEvent;
  channel: NotificationChannel;
  // Optional target; defaults to current user
  target_user_id?: string;
}

// ================================================
// Extended Profile Types
// ================================================

export interface ProfileWithNotifications {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'parent' | 'teacher' | 'principal' | 'principal_admin' | 'superadmin';
  preschool_id?: string;
  is_active: boolean;
  // Notification preferences
  invoice_notification_preferences: InvoiceNotificationPreferences;
  signature_url?: string;
  signature_public_id?: string;
  signature_updated_at?: string;
  created_at: string;
  updated_at: string;
}

// ================================================
// Default Values
// ================================================

export const DEFAULT_INVOICE_NOTIFICATION_PREFERENCES: InvoiceNotificationPreferences = {
  channels: {
    email: true,
    push: false,
    sms: false,
  },
  events: {
    new_invoice: {
      email: true,
      push: false,
    },
    invoice_sent: {
      email: true,
      push: false,
    },
    overdue_reminder: {
      email: true,
      push: false,
      cadence_days: [1, 3, 7],
    },
    payment_confirmed: {
      email: true,
      push: false,
    },
    invoice_viewed: {
      email: false,
      push: false,
    },
  },
  email_include_signature: true,
  pdf_include_signature: true,
  digest: {
    overdue_daily: false,
    weekly_summary: false,
  },
};

// ================================================
// Utility Functions
// ================================================

/**
 * Get role-appropriate default preferences
 */
export function getRoleBasedDefaults(role: string): Partial<InvoiceNotificationPreferences> {
  switch (role) {
    case 'parent':
      return {
        events: {
          new_invoice: { email: true, push: false },
          invoice_sent: { email: true, push: false },
          overdue_reminder: { email: true, push: false, cadence_days: [1, 3, 7] },
          payment_confirmed: { email: true, push: false },
          invoice_viewed: { email: false, push: false }, // Parents typically don't need this
        },
        digest: {
          overdue_daily: false,
          weekly_summary: false,
        },
      };

    case 'teacher':
      return {
        events: {
          new_invoice: { email: true, push: false }, // For their class invoices
          invoice_sent: { email: true, push: false },
          overdue_reminder: { email: false, push: false }, // Teachers might not need overdue alerts
          payment_confirmed: { email: false, push: false }, // Teachers don't usually handle payments
          invoice_viewed: { email: false, push: false },
        },
        digest: {
          overdue_daily: false,
          weekly_summary: false,
        },
      };

    case 'principal':
    case 'principal_admin':
      return {
        events: {
          new_invoice: { email: true, push: false },
          invoice_sent: { email: true, push: false },
          overdue_reminder: { email: true, push: false, cadence_days: [1, 3, 7] },
          payment_confirmed: { email: true, push: false },
          invoice_viewed: { email: false, push: false },
        },
        digest: {
          overdue_daily: true, // Principals benefit from daily overdue summaries
          weekly_summary: true,
        },
      };

    case 'superadmin':
      return {
        events: {
          new_invoice: { email: false, push: false }, // Superadmins don't need individual school notifications
          invoice_sent: { email: false, push: false },
          overdue_reminder: { email: false, push: false },
          payment_confirmed: { email: false, push: false },
          invoice_viewed: { email: false, push: false },
        },
        digest: {
          overdue_daily: false,
          weekly_summary: false,
        },
      };

    default:
      return {};
  }
}

/**
 * Merge partial preferences with defaults
 */
export function mergeWithDefaults(
  partial: Partial<InvoiceNotificationPreferences>,
  role?: string
): InvoiceNotificationPreferences {
  const roleDefaults = role ? getRoleBasedDefaults(role) : {};
  
  return {
    ...DEFAULT_INVOICE_NOTIFICATION_PREFERENCES,
    ...roleDefaults,
    ...partial,
    channels: {
      ...DEFAULT_INVOICE_NOTIFICATION_PREFERENCES.channels,
      ...roleDefaults.channels,
      ...partial.channels,
    },
    events: {
      ...DEFAULT_INVOICE_NOTIFICATION_PREFERENCES.events,
      ...roleDefaults.events,
      ...partial.events,
    },
    digest: {
      ...DEFAULT_INVOICE_NOTIFICATION_PREFERENCES.digest,
      ...roleDefaults.digest,
      ...partial.digest,
    },
  };
}

/**
 * Get user-friendly labels for notification events
 */
export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  new_invoice: 'New Invoice Created',
  invoice_sent: 'Invoice Sent',
  overdue_reminder: 'Overdue Reminders',
  payment_confirmed: 'Payment Confirmed',
  invoice_viewed: 'Invoice Viewed',
};

/**
 * Get user-friendly labels for notification channels
 */
export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  push: 'Push Notifications',
  sms: 'SMS/Text Messages',
};

// ================================================
// Validation Helpers
// ================================================

/**
 * Validate cadence days for overdue reminders
 */
export function validateCadenceDays(days: number[]): boolean {
  return (
    Array.isArray(days) &&
    days.length > 0 &&
    days.every(day => Number.isInteger(day) && day > 0 && day <= 30) &&
    days.every((day, index) => index === 0 || day > days[index - 1]) // Sorted ascending
  );
}

/**
 * Sanitize and validate preferences before saving
 */
export function sanitizePreferences(
  prefs: Partial<InvoiceNotificationPreferences>
): Partial<InvoiceNotificationPreferences> {
  const sanitized: Partial<InvoiceNotificationPreferences> = {};

  // Validate channels
  if (prefs.channels) {
    sanitized.channels = {
      email: Boolean(prefs.channels.email),
      push: Boolean(prefs.channels.push),
      sms: Boolean(prefs.channels.sms),
    };
  }

  // Validate events
  if (prefs.events) {
    const eventsSanitized: Partial<typeof DEFAULT_INVOICE_NOTIFICATION_PREFERENCES.events> = {};
    Object.entries(prefs.events).forEach(([event, eventPrefs]) => {
      if (eventPrefs && typeof eventPrefs === 'object') {
        const sanitizedEvent: EventPreference = {
          email: Boolean(eventPrefs.email),
        };
        
        if ('push' in eventPrefs) sanitizedEvent.push = Boolean(eventPrefs.push);
        if ('sms' in eventPrefs) sanitizedEvent.sms = Boolean(eventPrefs.sms);
        
        // Special handling for overdue cadence days
        if (event === 'overdue_reminder' && eventPrefs.cadence_days) {
          if (validateCadenceDays(eventPrefs.cadence_days)) {
            sanitizedEvent.cadence_days = eventPrefs.cadence_days;
          }
        }
        
        (eventsSanitized as any)[event as NotificationEvent] = sanitizedEvent;
      }
    });
    // Assign sanitized events if any were processed
    if (Object.keys(eventsSanitized as any).length > 0) {
      sanitized.events = eventsSanitized as any;
    }
  }
  
  // Validate signature preferences
  if ('email_include_signature' in prefs) {
    sanitized.email_include_signature = Boolean(prefs.email_include_signature);
  }
  if ('pdf_include_signature' in prefs) {
    sanitized.pdf_include_signature = Boolean(prefs.pdf_include_signature);
  }

  // Validate digest preferences
  if (prefs.digest) {
    sanitized.digest = {
      overdue_daily: Boolean(prefs.digest.overdue_daily),
      weekly_summary: Boolean(prefs.digest.weekly_summary),
    };
  }

  return sanitized;
}