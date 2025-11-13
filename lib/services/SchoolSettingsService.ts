// School Settings Service
// Centralized service for reading/writing school-level settings

import { assertSupabase } from '@/lib/supabase';

export type DashboardLayout = 'grid' | 'list';
export type BackupFrequency = 'daily' | 'weekly' | 'monthly';
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type TimeFormat = '12h' | '24h';

export interface SchoolSettings {
  // Basic School Info
  schoolName: string;
  schoolLogo?: string;
  primaryColor: string;
  secondaryColor: string;
  timezone: string;
  currency: string;

  // Feature Toggles
  features: {
    activityFeed: {
      enabled: boolean;
      allowTeacherDelete: boolean;
      allowParentComment: boolean;
      showPriorityBadges: boolean;
    };
    studentsDirectory: {
      enabled: boolean;
      showPhotos: boolean;
      showMedicalInfo: boolean;
      allowTeacherEdit: boolean;
      showPaymentStatus: boolean;
    };
    teachersDirectory: {
      enabled: boolean;
      showSalaries: boolean;
      showPerformanceRatings: boolean;
      allowParentContact: boolean;
      showQualifications: boolean;
    };
    financialReports: {
      enabled: boolean;
      showTeacherView: boolean;
      allowExport: boolean;
      showDetailedBreakdown: boolean;
      requireApprovalLimit: number;
    };
    pettyCash: {
      enabled: boolean;
      dailyLimit: number;
      requireApprovalAbove: number;
      allowedCategories: string[];
      requireReceipts: boolean;
    };
  };

  // Display Options
  display: {
    dashboardLayout: DashboardLayout;
    showWeatherWidget: boolean;
    showCalendarWidget: boolean;
    defaultLanguage: string;
    dateFormat: DateFormat;
    timeFormat: TimeFormat;
  };

  // Permissions & Roles
  permissions: {
    allowTeacherReports: boolean;
    allowParentMessaging: boolean;
    requireTwoFactorAuth: boolean;
    sessionTimeout: number;
  };

  // Notifications
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    dailyReports: boolean;
    urgentAlertsOnly: boolean;
  };

  // Backup & Data
  backup: {
    autoBackupEnabled: boolean;
    backupFrequency: BackupFrequency;
    dataRetentionMonths: number;
  };

  // Integrations
  whatsapp_number?: string; // Stored in preschools.settings for WA integration
}

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolName: 'My School',
  primaryColor: '#4F46E5',
  secondaryColor: '#6B7280',
  timezone: 'Africa/Johannesburg',
  currency: 'ZAR',
  features: {
    activityFeed: {
      enabled: true,
      allowTeacherDelete: false,
      allowParentComment: true,
      showPriorityBadges: true,
    },
    studentsDirectory: {
      enabled: true,
      showPhotos: true,
      showMedicalInfo: true,
      allowTeacherEdit: true,
      showPaymentStatus: true,
    },
    teachersDirectory: {
      enabled: true,
      showSalaries: false,
      showPerformanceRatings: true,
      allowParentContact: true,
      showQualifications: true,
    },
    financialReports: {
      enabled: true,
      showTeacherView: false,
      allowExport: true,
      showDetailedBreakdown: true,
      requireApprovalLimit: 1000,
    },
    pettyCash: {
      enabled: true,
      dailyLimit: 500,
      requireApprovalAbove: 200,
      allowedCategories: ['Office Supplies', 'Maintenance', 'Emergency', 'Utilities'],
      requireReceipts: true,
    },
  },
  display: {
    dashboardLayout: 'grid',
    showWeatherWidget: true,
    showCalendarWidget: true,
    defaultLanguage: 'en',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
  },
  permissions: {
    allowTeacherReports: true,
    allowParentMessaging: true,
    requireTwoFactorAuth: false,
    sessionTimeout: 30,
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    dailyReports: true,
    urgentAlertsOnly: false,
  },
  backup: {
    autoBackupEnabled: true,
    backupFrequency: 'daily',
    dataRetentionMonths: 12,
  },
};

function deepMerge<T>(base: T, overrides: Partial<T>): T {
  if (!overrides) return base;
  const result: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const key of Object.keys(overrides)) {
    const v: any = (overrides as any)[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      (result as any)[key] = deepMerge((base as any)[key] ?? {}, v);
    } else {
      (result as any)[key] = v;
    }
  }
  return result as T;
}

export class SchoolSettingsService {
  static async get(schoolId: string): Promise<SchoolSettings> {
    const { data, error } = await assertSupabase()
      .from('preschools')
      .select('settings, name')
      .eq('id', schoolId)
      .single();

    if (error) throw error;
    const merged = deepMerge(DEFAULT_SCHOOL_SETTINGS, (data?.settings || {}) as Partial<SchoolSettings>);
    // If the merged name is the default sentinel or missing, prefer the DB school name
    if ((merged.schoolName === DEFAULT_SCHOOL_SETTINGS.schoolName || !merged.schoolName) && data?.name) {
      merged.schoolName = data.name;
    }
    return merged;
  }

  static async update(
    schoolId: string,
    updates: Partial<SchoolSettings>
  ): Promise<SchoolSettings> {
    // Use RBAC-safe RPC to update allowed keys server-side
    const { data, error } = await assertSupabase().rpc('update_school_settings', {
      p_preschool_id: schoolId,
      p_patch: updates as any,
    });
    if (error) throw error;
    // Deep merge defaults client-side for completeness
    const merged = deepMerge(DEFAULT_SCHOOL_SETTINGS, (data || {}) as Partial<SchoolSettings>);
    return merged;
  }

  static async updateWhatsAppNumber(schoolId: string, whatsappE164: string): Promise<void> {
    const { error } = await assertSupabase().rpc('update_school_settings', {
      p_preschool_id: schoolId,
      p_patch: { whatsapp_number: whatsappE164 } as any,
    });
    if (error) throw error;
  }
}

export default SchoolSettingsService;
