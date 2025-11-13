/**
 * Route Configuration for Code Splitting
 * 
 * All app routes registered with:
 * - Import paths
 * - Prefetch strategies
 * - Priority levels
 * - Estimated bundle sizes
 * - Role-based access
 */

import { registerRoutes, type RouteConfig } from './route-splitting';

// ============================================================================
// Route Definitions
// ============================================================================

const routes: RouteConfig[] = [
  // ========== Critical Routes (Pre-loaded) ==========
  {
    id: 'learner-dashboard',
    importFn: () => import('../app/screens/learner-dashboard'),
    priority: 'critical',
    estimatedSize: 80,
    prefetchRoutes: ['lessons-hub', 'dash-assistant'],
    roles: ['learner', 'student'],
  },
  {
    id: 'parent-dashboard',
    importFn: () => import('../app/screens/parent-dashboard'),
    priority: 'critical',
    estimatedSize: 90,
    prefetchRoutes: ['parent-children', 'parent-messages'],
    roles: ['parent'],
  },
  {
    id: 'org-admin-dashboard',
    importFn: () => import('../app/screens/org-admin-dashboard'),
    priority: 'critical',
    estimatedSize: 100,
    prefetchRoutes: ['financial-dashboard', 'attendance'],
    roles: ['principal', 'admin', 'org_admin'],
  },

  // ========== High Priority Routes ==========
  {
    id: 'lessons-hub',
    importFn: () => import('../app/screens/lessons-hub'),
    priority: 'high',
    estimatedSize: 120,
    prefetchRoutes: ['lessons-category', 'lessons-search'],
    roles: ['learner', 'teacher'],
  },
  {
    id: 'dash-assistant',
    importFn: () => import('../app/screens/dash-assistant'),
    priority: 'high',
    estimatedSize: 150,
    prefetchRoutes: ['dash-conversations-history', 'ai-homework-helper'],
    roles: ['learner', 'teacher', 'parent'],
  },
  {
    id: 'financial-dashboard',
    importFn: () => import('../app/screens/financial-dashboard'),
    priority: 'high',
    estimatedSize: 200,
    prefetchRoutes: ['financial-transactions', 'financial-reports'],
    roles: ['principal', 'admin', 'org_admin'],
  },
  {
    id: 'attendance',
    importFn: () => import('../app/screens/attendance'),
    priority: 'high',
    estimatedSize: 110,
    prefetchRoutes: ['class-details'],
    roles: ['teacher', 'principal'],
  },

  // ========== Normal Priority Routes ==========
  {
    id: 'lessons-category',
    importFn: () => import('../app/screens/lessons-category'),
    priority: 'normal',
    estimatedSize: 100,
    prefetchRoutes: ['lesson-detail'],
  },
  {
    id: 'lessons-search',
    importFn: () => import('../app/screens/lessons-search'),
    priority: 'normal',
    estimatedSize: 90,
  },
  {
    id: 'lesson-detail',
    importFn: () => import('../app/screens/lesson-detail'),
    priority: 'normal',
    estimatedSize: 130,
  },
  {
    id: 'class-details',
    importFn: () => import('../app/screens/class-details'),
    priority: 'normal',
    estimatedSize: 110,
    prefetchRoutes: ['attendance'],
  },
  {
    id: 'account',
    importFn: () => import('../app/screens/account'),
    priority: 'normal',
    estimatedSize: 70,
  },
  {
    id: 'parent-children',
    importFn: () => import('../app/screens/parent-children'),
    priority: 'normal',
    estimatedSize: 85,
    prefetchRoutes: ['parent-picture-of-progress'],
    roles: ['parent'],
  },
  {
    id: 'parent-messages',
    importFn: () => import('../app/screens/parent-messages'),
    priority: 'normal',
    estimatedSize: 95,
    prefetchRoutes: ['parent-message-thread'],
    roles: ['parent'],
  },

  // ========== AI Features (Normal Priority) ==========
  {
    id: 'ai-homework-helper',
    importFn: () => import('../app/screens/ai-homework-helper'),
    priority: 'normal',
    estimatedSize: 140,
    prefetchRoutes: ['ai-homework-grader-live'],
  },
  {
    id: 'ai-homework-grader-live',
    importFn: () => import('../app/screens/ai-homework-grader-live'),
    priority: 'normal',
    estimatedSize: 160,
  },
  {
    id: 'ai-lesson-generator',
    importFn: () => import('../app/screens/ai-lesson-generator'),
    priority: 'normal',
    estimatedSize: 150,
    prefetchRoutes: ['create-lesson'],
    roles: ['teacher', 'principal'],
  },
  {
    id: 'ai-progress-analysis',
    importFn: () => import('../app/screens/ai-progress-analysis'),
    priority: 'normal',
    estimatedSize: 130,
    roles: ['teacher', 'principal', 'parent'],
  },
  {
    id: 'dash-ai-settings',
    importFn: () => import('../app/screens/dash-ai-settings-enhanced'),
    priority: 'normal',
    estimatedSize: 90,
  },
  {
    id: 'dash-conversations-history',
    importFn: () => import('../app/screens/dash-conversations-history'),
    priority: 'normal',
    estimatedSize: 100,
  },

  // ========== Financial Routes (Low Priority, Heavy) ==========
  {
    id: 'financial-transactions',
    importFn: () => import('../app/screens/financial-transactions'),
    priority: 'low',
    estimatedSize: 150,
    roles: ['principal', 'admin', 'org_admin'],
  },
  {
    id: 'financial-reports',
    importFn: () => import('../app/screens/financial-reports'),
    priority: 'low',
    estimatedSize: 180,
    roles: ['principal', 'admin', 'org_admin'],
  },

  // ========== Teacher & Admin Routes ==========
  {
    id: 'create-lesson',
    importFn: () => import('../app/screens/create-lesson'),
    priority: 'normal',
    estimatedSize: 120,
    roles: ['teacher', 'principal'],
  },
  {
    id: 'assign-homework',
    importFn: () => import('../app/screens/assign-homework'),
    priority: 'normal',
    estimatedSize: 110,
    roles: ['teacher', 'principal'],
  },
  {
    id: 'class-teacher-management',
    importFn: () => import('../app/screens/class-teacher-management'),
    priority: 'normal',
    estimatedSize: 100,
    roles: ['principal', 'admin'],
  },

  // ========== Parent Routes ==========
  {
    id: 'parent-picture-of-progress',
    importFn: () => import('../app/screens/parent-picture-of-progress'),
    priority: 'normal',
    estimatedSize: 120,
    prefetchRoutes: ['parent-pop-history'],
    roles: ['parent'],
  },
  {
    id: 'parent-pop-history',
    importFn: () => import('../app/screens/parent-pop-history'),
    priority: 'low',
    estimatedSize: 90,
    roles: ['parent'],
  },
  {
    id: 'parent-pop-upload',
    importFn: () => import('../app/screens/parent-pop-upload'),
    priority: 'low',
    estimatedSize: 100,
    roles: ['parent'],
  },
  {
    id: 'parent-message-thread',
    importFn: () => import('../app/screens/parent-message-thread'),
    priority: 'normal',
    estimatedSize: 95,
    roles: ['parent'],
  },
  {
    id: 'parent-link-child',
    importFn: () => import('../app/screens/parent-link-child'),
    priority: 'low',
    estimatedSize: 80,
    roles: ['parent'],
  },
  {
    id: 'parent-join-by-code',
    importFn: () => import('../app/screens/parent-join-by-code'),
    priority: 'low',
    estimatedSize: 70,
    roles: ['parent'],
  },

  // ========== Admin & Setup Routes (Low Priority) ==========
  {
    id: 'application-review',
    importFn: () => import('../app/screens/application-review'),
    priority: 'low',
    estimatedSize: 130,
    roles: ['principal', 'admin'],
  },
  {
    id: 'hiring-hub',
    importFn: () => import('../app/screens/hiring-hub'),
    priority: 'low',
    estimatedSize: 140,
    prefetchRoutes: ['job-posting-create', 'interview-scheduler'],
    roles: ['principal', 'admin', 'org_admin'],
  },
  {
    id: 'job-posting-create',
    importFn: () => import('../app/screens/job-posting-create'),
    priority: 'low',
    estimatedSize: 110,
    roles: ['principal', 'admin', 'org_admin'],
  },
  {
    id: 'interview-scheduler',
    importFn: () => import('../app/screens/interview-scheduler'),
    priority: 'low',
    estimatedSize: 120,
    roles: ['principal', 'admin', 'org_admin'],
  },
  {
    id: 'admin-ai-allocation',
    importFn: () => import('../app/screens/admin-ai-allocation'),
    priority: 'low',
    estimatedSize: 100,
    roles: ['principal', 'admin', 'org_admin'],
  },
  {
    id: 'manage-subscription',
    importFn: () => import('../app/screens/manage-subscription'),
    priority: 'low',
    estimatedSize: 110,
    roles: ['principal', 'admin', 'org_admin'],
  },
  {
    id: 'org-onboarding',
    importFn: () => import('../app/screens/org-onboarding'),
    priority: 'low',
    estimatedSize: 150,
    roles: ['org_admin'],
  },

  // ========== Category Routes ==========
  {
    id: 'lessons-categories',
    importFn: () => import('../app/screens/lessons-categories'),
    priority: 'normal',
    estimatedSize: 85,
  },

  // ========== Super Admin Routes ==========
  {
    id: 'school-onboarding-wizard',
    importFn: () => import('../app/screens/super-admin/school-onboarding-wizard'),
    priority: 'low',
    estimatedSize: 160,
    roles: ['super_admin'],
  },

  // ========== Admin Sub-Routes ==========
  {
    id: 'admin-data-export',
    importFn: () => import('../app/screens/admin/data-export'),
    priority: 'low',
    estimatedSize: 120,
    roles: ['principal', 'admin', 'org_admin'],
  },
  {
    id: 'admin-school-settings',
    importFn: () => import('../app/screens/admin/school-settings'),
    priority: 'low',
    estimatedSize: 130,
    roles: ['principal', 'admin', 'org_admin'],
  },

  // ========== Utility Routes ==========
  {
    id: 'activity-detail',
    importFn: () => import('../app/screens/activity-detail'),
    priority: 'low',
    estimatedSize: 70,
  },
];

// ============================================================================
// Initialize Route Splitting
// ============================================================================

/**
 * Register all routes for code splitting
 */
export function initializeRoutes() {
  registerRoutes(routes);
  
  if (__DEV__) {
    console.log(`📦 Registered ${routes.length} routes for code splitting`);
  }
}

// Auto-initialize on import
initializeRoutes();

// ============================================================================
// Route Groups for Batch Prefetching
// ============================================================================

export const RouteGroups = {
  CRITICAL: routes.filter(r => r.priority === 'critical').map(r => r.id),
  LEARNER: routes.filter(r => r.roles?.includes('learner')).map(r => r.id),
  PARENT: routes.filter(r => r.roles?.includes('parent')).map(r => r.id),
  TEACHER: routes.filter(r => r.roles?.includes('teacher')).map(r => r.id),
  ADMIN: routes.filter(r => r.roles?.includes('principal') || r.roles?.includes('admin')).map(r => r.id),
  AI_FEATURES: routes.filter(r => r.id.startsWith('ai-')).map(r => r.id),
  FINANCIAL: routes.filter(r => r.id.startsWith('financial-')).map(r => r.id),
};

export default routes;
