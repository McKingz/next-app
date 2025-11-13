/**
 * Navigation utilities for consistent back button behavior across the app
 */

import { safeRouter } from '@/lib/navigation/safeRouter';

/**
 * Smart back navigation that handles different scenarios:
 * - Uses back if can go back
 * - Falls back to appropriate main screen based on user context
 */
export function navigateBack(fallbackRoute?: string) {
  try {
    const canGoBack = safeRouter.canGoBack();
    
    if (canGoBack) {
      safeRouter.back();
      return;
    }
    
    if (fallbackRoute) {
      safeRouter.replace(fallbackRoute as any);
      return;
    }
    
    safeRouter.replace('/');
  } catch (error) {
    console.error('Navigation back failed:', error);
    safeRouter.replace('/');
  }
}

/**
 * Navigate to main dashboard based on user role
 */
export function navigateToMainDashboard() {
  try {
    // For now, navigate to root - this will be enhanced with role-based routing
    safeRouter.replace('/');
  } catch (error) {
    console.error('Navigation to main dashboard failed:', error);
    // Try alternative approach
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }
}

/**
 * Type-safe navigation helpers for common routes
 */
export const navigateTo = {
  back: (fallbackRoute?: string) => navigateBack(fallbackRoute),
  dashboard: () => navigateToMainDashboard(),
  teacherManagement: () => safeRouter.push('/screens/teacher-management' as any),
  studentManagement: () => safeRouter.push('/screens/student-management' as any),
  account: () => safeRouter.push('/screens/account' as any),
  settings: () => safeRouter.push('/screens/settings' as any),
  
  // Detail screens
  studentDetail: (id: string) => safeRouter.push(`/screens/student-detail?id=${id}` as any),
  teacherDetail: (id: string) => safeRouter.push(`/screens/teachers-detail?id=${id}` as any),
  activityDetail: (id: string) => safeRouter.push(`/screens/activity-detail?id=${id}` as any),
  
  // Financial screens
  financialDashboard: () => safeRouter.push('/screens/financial-dashboard' as any),
  financialReports: () => safeRouter.push('/screens/financial-reports' as any),
  pettyCash: () => safeRouter.push('/screens/petty-cash' as any),
  
  // Admin screens
  schoolSettings: () => safeRouter.push('/screens/admin/school-settings' as any),
  
  // PDF Generator
  pdfGenerator: (params?: { tab?: 'prompt' | 'template' | 'structured'; templateId?: string; documentType?: string }) => {
    let url = '/screens/pdf-generator';
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.tab) searchParams.set('initialTab', params.tab);
      if (params.templateId) searchParams.set('templateId', params.templateId);
      if (params.documentType) searchParams.set('documentType', params.documentType);
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }
    }
    safeRouter.push(url as any);
  },
};

/**
 * Helper function to identify main dashboard and root routes where back buttons should be hidden
 */
function isMainDashboardRoute(routeName: string): boolean {
  const n = (routeName || '').toLowerCase();
  
  // Root/landing routes
  if (n === 'index' || n === 'landing' || n === '(tabs)' || n === '' || n === 'home') {
    return true;
  }
  
  // Dashboard routes - covers parent-dashboard, teacher-dashboard, principal-dashboard, super-admin-dashboard, etc.
  if (n.includes('dashboard')) {
    return true;
  }
  
  // Screens-based dashboard routes
  if (n.startsWith('screens/') && (n.endsWith('-dashboard') || n.endsWith('/dashboard'))) {
    return true;
  }
  
  return false;
}

/**
 * Helper function to identify routes that should always show a back button
 */
function shouldAlwaysShowBackButton(routeName: string): boolean {
  const n = (routeName || '').toLowerCase();
  
  // Modal screens and detail screens should always have back buttons
  if (n.includes('modal') || n.includes('-modal') || n.includes('premium-feature')) {
    return true;
  }
  
  // Detail screens
  if (n.includes('detail') || n.includes('-detail') || n.endsWith('detail')) {
    return true;
  }
  
  // Settings and configuration screens
  if (n.includes('settings') || n.includes('config') || n.includes('preferences')) {
    return true;
  }
  
  // Account and profile screens
  if (n.includes('account') || n.includes('profile') || n.includes('subscription')) {
    return true;
  }
  
  // Invite and request management screens
  if (n.includes('invite') || n.includes('request') || n.includes('parent-invite') || n.includes('parent-request')) {
    return true;
  }
  
  // Principal management screens
  if (n.includes('principal-parent') || n.includes('school-wide')) {
    return true;
  }
  
  return false;
}

/**
 * Determine if a back button should be shown based on current route
 * Updated to treat all dashboards as main screens (no back button)
 */
export function shouldShowBackButton(routeName: string, isUserSignedIn: boolean): boolean {
  // Some routes should always show a back button regardless of navigation stack
  if (shouldAlwaysShowBackButton(routeName)) {
    return true;
  }
  
  // Never show back button on main dashboard routes
  if (isMainDashboardRoute(routeName)) {
    return false;
  }
  
  // Always check if we can go back first
  let canGoBack = false;
  try {
    canGoBack = safeRouter.canGoBack();
  } catch (error) {
    // If there's an error checking canGoBack, assume we can't
    console.debug('Error checking canGoBack:', error);
    canGoBack = false;
  }
  
  // If we can't go back in the stack, don't show the button
  if (!canGoBack) {
    return false;
  }
  
  // For all other screens, show back button if we can go back
  return true;
}
