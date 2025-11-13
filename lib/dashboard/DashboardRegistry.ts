/**
 * Dashboard Registry System
 * 
 * Central registry for dynamic dashboard widget composition
 * Returns widget configurations based on organization type, role, and age group
 * 
 * Part of Multi-Organization Dashboard System (Phase 2)
 * See: /home/king/Desktop/MULTI_ORG_DASHBOARD_IMPLEMENTATION_PLAN.md
 */

import type { ComponentType } from 'react';
import type { OrganizationType } from '@/lib/types/organization';
import type { AgeGroup } from '@/lib/hooks/useAgeGroup';

/**
 * Widget definition in the registry
 */
export interface WidgetManifest {
  /** Unique identifier for the widget */
  key: string;
  
  /** Display name (can use terminology keys) */
  name: string;
  
  /** Short description of what the widget does */
  description?: string;
  
  /** The React component to render */
  Component: ComponentType<any>;
  
  /** Feature flag key to check for visibility */
  featureKey: string;
  
  /** Roles that can see this widget */
  roles: string[];
  
  /** Optional: specific organization types (null = all types) */
  orgTypes?: OrganizationType[] | null;
  
  /** Optional: specific age groups (null = all ages) */
  ageGroups?: AgeGroup[] | null;
  
  /** Display order (lower numbers appear first) */
  order: number;
  
  /** Optional: minimum subscription tier required */
  minTier?: 'free' | 'pro' | 'enterprise';
  
  /** Optional: props to pass to the component */
  defaultProps?: Record<string, any>;
}

/**
 * Hub type (role-based dashboard categories)
 */
export type HubType = 'learner' | 'instructor' | 'guardian' | 'admin';

/**
 * Get hub type from role name
 */
export function getHubType(role: string): HubType {
  // Map various role names to their hub
  const hubMapping: Record<string, HubType> = {
    // Learner hub
    student: 'learner',
    athlete: 'learner',
    employee: 'learner',
    trainee: 'learner',
    member: 'learner',
    
    // Instructor hub
    teacher: 'instructor',
    coach: 'instructor',
    trainer: 'instructor',
    professor: 'instructor',
    tutor: 'instructor',
    instructor: 'instructor',
    
    // Guardian hub
    parent: 'guardian',
    guardian: 'guardian',
    sponsor: 'guardian',
    
    // Admin hub
    principal: 'admin',
    dean: 'admin',
    director: 'admin',
    admin: 'admin',
    superadmin: 'admin',
    club_admin: 'admin',
    center_admin: 'admin',
    manager: 'admin',
  };
  
  return hubMapping[role.toLowerCase()] || 'learner';
}

/**
 * Widget registry by hub type
 * In a real implementation, these would be lazily loaded
 */
const widgetRegistry: Record<HubType, WidgetManifest[]> = {
  learner: [
    {
      key: 'announcements',
      name: 'Announcements',
      description: 'View important announcements',
      Component: require('@/components/dashboard/cards/AnnouncementsCard').default,
      featureKey: 'announcements',
      roles: ['student', 'athlete', 'employee', 'trainee', 'member'],
      order: 10,
    },
    {
      key: 'schedule',
      name: 'Schedule',
      description: 'View your schedule',
      Component: require('@/components/dashboard/cards/ScheduleCard').default,
      featureKey: 'schedule_timetable',
      roles: ['student', 'athlete', 'employee', 'trainee'],
      order: 20,
    },
    {
      key: 'assignments',
      name: 'Assignments',
      description: 'View and submit assignments',
      Component: require('@/components/dashboard/cards/AssignmentsCard').default,
      featureKey: 'assignments_tasks',
      roles: ['student', 'employee', 'trainee'],
      ageGroups: ['teen', 'adult'], // Children don't see this
      order: 30,
    },
    {
      key: 'grades',
      name: 'Grades',
      description: 'View your grades and progress',
      Component: require('@/components/dashboard/cards/GradesCard').default,
      featureKey: 'grades_reports',
      roles: ['student', 'employee'],
      ageGroups: ['teen', 'adult'],
      order: 40,
    },
    {
      key: 'fixtures',
      name: 'Fixtures',
      description: 'View upcoming games and events',
      Component: require('@/components/dashboard/cards/FixturesCard').default,
      featureKey: 'teams_fixtures',
      roles: ['athlete'],
      orgTypes: ['sports_club' as OrganizationType],
      order: 25,
    },
    {
      key: 'certifications',
      name: 'Certifications',
      description: 'View and download certificates',
      Component: require('@/components/dashboard/cards/CertificationsCard').default,
      featureKey: 'certifications',
      roles: ['employee', 'trainee'],
      orgTypes: ['corporate' as OrganizationType, 'training_center' as OrganizationType],
      ageGroups: ['adult'],
      order: 35,
    },
  ],
  
  instructor: [
    // Instructor widgets would go here
    // For now, empty - use existing dashboards
  ],
  
  guardian: [
    // Guardian widgets would go here
    // For now, empty - use existing dashboards
  ],
  
  admin: [
    // Admin widgets would go here
    // For now, empty - use existing dashboards
  ],
};

/**
 * Filter widgets based on context
 */
function filterWidgets(
  widgets: WidgetManifest[],
  context: {
    role: string;
    orgType: OrganizationType | string;
    ageGroup?: AgeGroup | null;
  }
): WidgetManifest[] {
  const { role, orgType, ageGroup } = context;
  
  return widgets.filter((widget) => {
    // Check role match
    if (!widget.roles.includes(role)) {
      return false;
    }
    
    // Check org type match (if specified)
    if (widget.orgTypes && !widget.orgTypes.includes(orgType as OrganizationType)) {
      return false;
    }
    
    // Check age group match (if specified)
    if (widget.ageGroups && ageGroup && !widget.ageGroups.includes(ageGroup)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Get widgets for a specific context
 * Returns filtered and sorted widget configurations
 * 
 * @param context - Organization type, role, and age group
 * @returns Array of widget manifests sorted by order
 * 
 * @example
 * ```tsx
 * const widgets = getWidgetsForContext({
 *   role: 'student',
 *   orgType: 'preschool',
 *   ageGroup: 'child'
 * });
 * // Returns: [announcements, schedule] (no assignments for children)
 * ```
 */
export function getWidgetsForContext(context: {
  role: string;
  orgType: OrganizationType | string;
  ageGroup?: AgeGroup | null;
}): WidgetManifest[] {
  const hubType = getHubType(context.role);
  const hubWidgets = widgetRegistry[hubType] || [];
  
  const filtered = filterWidgets(hubWidgets, context);
  
  // Sort by order
  return filtered.sort((a, b) => a.order - b.order);
}

/**
 * Get a specific widget by key
 */
export function getWidgetByKey(key: string): WidgetManifest | undefined {
  for (const hub of Object.values(widgetRegistry)) {
    const widget = hub.find((w) => w.key === key);
    if (widget) return widget;
  }
  return undefined;
}

/**
 * Get all available widgets for a hub
 */
export function getWidgetsForHub(hubType: HubType): WidgetManifest[] {
  return widgetRegistry[hubType] || [];
}
