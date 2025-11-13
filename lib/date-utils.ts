/**
 * Centralized Date Utilities
 * Phase 12: Dependency Optimization
 * 
 * Optimized imports from date-fns for better tree-shaking
 * All date-related functions centralized here
 */

// Optimized imports (tree-shakeable)
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
import { subDays } from 'date-fns/subDays';
import { addWeeks } from 'date-fns/addWeeks';
import { subWeeks } from 'date-fns/subWeeks';
import { addMonths } from 'date-fns/addMonths';
import { subMonths } from 'date-fns/subMonths';
import { startOfDay } from 'date-fns/startOfDay';
import { endOfDay } from 'date-fns/endOfDay';
import { startOfWeek } from 'date-fns/startOfWeek';
import { endOfWeek } from 'date-fns/endOfWeek';
import { startOfMonth } from 'date-fns/startOfMonth';
import { endOfMonth } from 'date-fns/endOfMonth';
import { differenceInDays } from 'date-fns/differenceInDays';
import { differenceInWeeks } from 'date-fns/differenceInWeeks';
import { differenceInMonths } from 'date-fns/differenceInMonths';
import { isValid } from 'date-fns/isValid';
import { isBefore } from 'date-fns/isBefore';
import { isAfter } from 'date-fns/isAfter';
import { isSameDay } from 'date-fns/isSameDay';
import { isToday } from 'date-fns/isToday';
import { isYesterday } from 'date-fns/isYesterday';
import { isTomorrow } from 'date-fns/isTomorrow';
import { isWeekend } from 'date-fns/isWeekend';
import { formatDistance } from 'date-fns/formatDistance';
import { formatRelative } from 'date-fns/formatRelative';

// Re-export core functions
export {
  format,
  parseISO,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  isValid,
  isBefore,
  isAfter,
  isSameDay,
  isToday,
  isYesterday,
  isTomorrow,
  isWeekend,
  formatDistance,
  formatRelative,
};

// ============================================================================
// Custom Helper Functions
// ============================================================================

/**
 * Safe format date with fallback
 */
export function formatDate(date: Date | string | null | undefined, pattern = 'PP'): string {
  if (!date) return '';
  
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d) ? format(d, pattern) : '';
  } catch {
    return '';
  }
}

/**
 * Format date and time
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, 'PPp'); // e.g., "Apr 29, 2023, 11:30 AM"
}

/**
 * Format date only (no time)
 */
export function formatDateOnly(date: Date | string | null | undefined): string {
  return formatDate(date, 'PP'); // e.g., "Apr 29, 2023"
}

/**
 * Format time only (no date)
 */
export function formatTimeOnly(date: Date | string | null | undefined): string {
  return formatDate(date, 'p'); // e.g., "11:30 AM"
}

/**
 * Format short date
 */
export function formatShortDate(date: Date | string | null | undefined): string {
  return formatDate(date, 'MMM d, yyyy'); // e.g., "Apr 29, 2023"
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '';
    
    return formatDistance(d, new Date(), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Format relative with context (e.g., "yesterday at 3:00 PM")
 */
export function formatRelativeWithTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '';
    
    return formatRelative(d, new Date());
  } catch {
    return '';
  }
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d) && isBefore(d, new Date());
  } catch {
    return false;
  }
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return isValid(d) && isAfter(d, new Date());
  } catch {
    return false;
  }
}

/**
 * Get start of today
 */
export function getToday(): Date {
  return startOfDay(new Date());
}

/**
 * Get yesterday
 */
export function getYesterday(): Date {
  return subDays(getToday(), 1);
}

/**
 * Get tomorrow
 */
export function getTomorrow(): Date {
  return addDays(getToday(), 1);
}

/**
 * Get start of this week
 */
export function getThisWeekStart(): Date {
  return startOfWeek(new Date(), { weekStartsOn: 0 }); // Sunday
}

/**
 * Get end of this week
 */
export function getThisWeekEnd(): Date {
  return endOfWeek(new Date(), { weekStartsOn: 0 });
}

/**
 * Get start of this month
 */
export function getThisMonthStart(): Date {
  return startOfMonth(new Date());
}

/**
 * Get end of this month
 */
export function getThisMonthEnd(): Date {
  return endOfMonth(new Date());
}

/**
 * Get date range for common periods
 */
export function getDateRange(period: 'today' | 'yesterday' | 'week' | 'month' | 'custom', customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const now = new Date();
  
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    
    case 'yesterday': {
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
    
    case 'week':
      return { start: getThisWeekStart(), end: getThisWeekEnd() };
    
    case 'month':
      return { start: getThisMonthStart(), end: getThisMonthEnd() };
    
    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('Custom range requires start and end dates');
      }
      return { start: startOfDay(customStart), end: endOfDay(customEnd) };
    
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

/**
 * Calculate age from birthdate
 */
export function calculateAge(birthdate: Date | string | null | undefined): number | null {
  if (!birthdate) return null;
  
  try {
    const d = typeof birthdate === 'string' ? parseISO(birthdate) : birthdate;
    if (!isValid(d)) return null;
    
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const monthDiff = today.getMonth() - d.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) {
      age--;
    }
    
    return age;
  } catch {
    return null;
  }
}

/**
 * Check if date is within range
 */
export function isDateInRange(date: Date | string, start: Date | string, end: Date | string): boolean {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    const s = typeof start === 'string' ? parseISO(start) : start;
    const e = typeof end === 'string' ? parseISO(end) : end;
    
    return isValid(d) && isValid(s) && isValid(e) && !isBefore(d, s) && !isAfter(d, e);
  } catch {
    return false;
  }
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(startDate: Date | string, endDate: Date | string): string {
  try {
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
    
    if (!isValid(start) || !isValid(end)) return '';
    
    const days = differenceInDays(end, start);
    
    if (days === 0) return 'Same day';
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    
    const weeks = differenceInWeeks(end, start);
    if (weeks < 4) return weeks === 1 ? '1 week' : `${weeks} weeks`;
    
    const months = differenceInMonths(end, start);
    return months === 1 ? '1 month' : `${months} months`;
  } catch {
    return '';
  }
}

/**
 * Get academic year from date
 */
export function getAcademicYear(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth();
  
  // Academic year typically starts in August/September
  if (month >= 7) {
    return `${year}/${year + 1}`;
  } else {
    return `${year - 1}/${year}`;
  }
}

/**
 * Format for calendar display
 */
export function formatForCalendar(date: Date | string | null | undefined): { day: string; month: string; year: string } {
  if (!date) return { day: '', month: '', year: '' };
  
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return { day: '', month: '', year: '' };
    
    return {
      day: format(d, 'd'),
      month: format(d, 'MMM'),
      year: format(d, 'yyyy'),
    };
  } catch {
    return { day: '', month: '', year: '' };
  }
}

/**
 * Get business days between dates (excluding weekends)
 */
export function getBusinessDays(start: Date | string, end: Date | string): number {
  try {
    const s = typeof start === 'string' ? parseISO(start) : start;
    const e = typeof end === 'string' ? parseISO(end) : end;
    
    if (!isValid(s) || !isValid(e)) return 0;
    
    let count = 0;
    let currentDate = s;
    
    while (!isAfter(currentDate, e)) {
      if (!isWeekend(currentDate)) {
        count++;
      }
      currentDate = addDays(currentDate, 1);
    }
    
    return count;
  } catch {
    return 0;
  }
}

// ============================================================================
// Constants
// ============================================================================

export const DATE_FORMATS = {
  FULL: 'PPPPpppp',         // e.g., "Friday, April 29th, 2023 at 11:30:00 AM GMT"
  LONG: 'PPPp',             // e.g., "April 29th, 2023 at 11:30 AM"
  MEDIUM: 'PP p',           // e.g., "Apr 29, 2023 11:30 AM"
  SHORT: 'P',               // e.g., "04/29/2023"
  DATE_ONLY: 'PP',          // e.g., "Apr 29, 2023"
  TIME_ONLY: 'p',           // e.g., "11:30 AM"
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
  FILE_SAFE: 'yyyy-MM-dd_HH-mm-ss',
} as const;

export const DEFAULT_WEEK_START = 0; // Sunday

// ============================================================================
// Exports
// ============================================================================

export default {
  // Core functions
  format,
  parseISO,
  isValid,
  // Custom helpers
  formatDate,
  formatDateTime,
  formatDateOnly,
  formatTimeOnly,
  formatShortDate,
  formatRelativeTime,
  formatRelativeWithTime,
  isPast,
  isFuture,
  getToday,
  getYesterday,
  getTomorrow,
  getDateRange,
  calculateAge,
  isDateInRange,
  formatDuration,
  getAcademicYear,
  formatForCalendar,
  getBusinessDays,
  // Constants
  DATE_FORMATS,
};
