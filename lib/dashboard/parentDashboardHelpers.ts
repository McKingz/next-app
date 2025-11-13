/**
 * Helper utilities for Parent Dashboard
 * 
 * Extracted from ParentDashboard.tsx to improve modularity and reusability
 */

import type { TFunction } from 'i18next';

/**
 * Get greeting based on current time of day
 */
export function getGreeting(t: TFunction): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('dashboard.good_morning');
  if (hour < 18) return t('dashboard.good_afternoon');
  return t('dashboard.good_evening');
}

/**
 * Calculate and format child age from date of birth
 */
export function getChildAgeText(child: any, t: TFunction): string {
  if (!child.dateOfBirth && !child.date_of_birth) {
    return t('common.ageUnknown');
  }
  
  try {
    const birthDate = new Date(child.dateOfBirth || child.date_of_birth);
    const today = new Date();
    const ageInMs = today.getTime() - birthDate.getTime();
    const ageInYears = Math.floor(ageInMs / (365.25 * 24 * 60 * 60 * 1000));
    
    if (ageInYears < 0 || ageInYears > 10) {
      return t('common.ageUnknown');
    }
    
    return t('common.ageYears', { age: ageInYears });
  } catch {
    return t('common.ageUnknown');
  }
}

/**
 * Format currency in South African Rand (ZAR)
 */
export function formatCurrency(amount: number): string {
  return `R ${amount.toLocaleString()}`;
}

/**
 * Mock WhatsApp connection for graceful degradation
 */
export function getMockWhatsAppConnection() {
  return {
    connectionStatus: { isConnected: false, isLoading: false, error: undefined },
    isLoading: false,
    error: undefined,
    optIn: async () => {},
    optOut: () => {},
    sendTestMessage: () => {},
    isOptingIn: false,
    isOptingOut: false,
    isSendingTest: false,
    getWhatsAppDeepLink: () => null,
    formatPhoneNumber: (phone: string) => phone,
    isWhatsAppEnabled: () => false,
    optInError: null,
    optOutError: null,
    testMessageError: null,
  };
}

/**
 * Get attendance status color based on theme
 */
export function getAttendanceColor(
  status: 'present' | 'absent' | 'late' | 'unknown',
  theme: any
): string {
  switch (status) {
    case 'present': return theme.success;
    case 'absent': return theme.error;
    case 'late': return theme.warning;
    default: return theme.textSecondary;
  }
}

/**
 * Get attendance icon based on status
 */
export function getAttendanceIcon(
  status: 'present' | 'absent' | 'late' | 'unknown'
): 'checkmark-circle' | 'close-circle' | 'time' | 'help-circle' {
  switch (status) {
    case 'present': return 'checkmark-circle';
    case 'absent': return 'close-circle';
    case 'late': return 'time';
    default: return 'help-circle';
  }
}
