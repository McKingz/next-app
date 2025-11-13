/**
 * Organization Terminology System
 * 
 * Provides dynamic terminology mapping based on organization type,
 * enabling EduDash Pro to adapt labels for different contexts
 * (preschools, universities, corporate training, sports clubs, etc.)
 */

import type { OrganizationType, TerminologyMap } from './types';

/**
 * Terminology mappings for each organization type
 */
export const TERMINOLOGY_MAPS: Record<OrganizationType, TerminologyMap> = {
  preschool: {
    member: 'Student',
    members: 'Students',
    instructor: 'Teacher',
    instructors: 'Teachers',
    guardian: 'Parent',
    guardians: 'Parents',
    group: 'Classroom',
    groups: 'Classrooms',
    institution: 'Preschool',
    level: 'Grade',
  },
  
  k12_school: {
    member: 'Student',
    members: 'Students',
    instructor: 'Teacher',
    instructors: 'Teachers',
    guardian: 'Parent',
    guardians: 'Parents',
    group: 'Class',
    groups: 'Classes',
    institution: 'School',
    level: 'Grade',
  },
  
  university: {
    member: 'Student',
    members: 'Students',
    instructor: 'Professor',
    instructors: 'Professors',
    guardian: 'Guardian',
    guardians: 'Guardians',
    group: 'Course',
    groups: 'Courses',
    institution: 'University',
    level: 'Year',
  },
  
  corporate: {
    member: 'Employee',
    members: 'Employees',
    instructor: 'Trainer',
    instructors: 'Trainers',
    guardian: 'Manager',
    guardians: 'Managers',
    group: 'Department',
    groups: 'Departments',
    institution: 'Organization',
    level: 'Level',
  },
  
  sports_club: {
    member: 'Athlete',
    members: 'Athletes',
    instructor: 'Coach',
    instructors: 'Coaches',
    guardian: 'Parent/Guardian',
    guardians: 'Parents/Guardians',
    group: 'Team',
    groups: 'Teams',
    institution: 'Club',
    level: 'Level',
  },
  
  community_org: {
    member: 'Member',
    members: 'Members',
    instructor: 'Leader',
    instructors: 'Leaders',
    guardian: 'Guardian',
    guardians: 'Guardians',
    group: 'Group',
    groups: 'Groups',
    institution: 'Organization',
    level: 'Level',
  },
  
  training_center: {
    member: 'Trainee',
    members: 'Trainees',
    instructor: 'Instructor',
    instructors: 'Instructors',
    guardian: 'Sponsor',
    guardians: 'Sponsors',
    group: 'Cohort',
    groups: 'Cohorts',
    institution: 'Training Center',
    level: 'Level',
  },
  
  tutoring_center: {
    member: 'Student',
    members: 'Students',
    instructor: 'Tutor',
    instructors: 'Tutors',
    guardian: 'Parent',
    guardians: 'Parents',
    group: 'Session',
    groups: 'Sessions',
    institution: 'Tutoring Center',
    level: 'Level',
  },
};

/**
 * Get terminology map for an organization type
 * Falls back to 'preschool' if type not found
 */
export function getTerminologyWithFallback(orgType: OrganizationType): TerminologyMap {
  return TERMINOLOGY_MAPS[orgType] || TERMINOLOGY_MAPS.preschool;
}

/**
 * Get role-specific display name based on organization type
 * Handles dynamic role mapping (e.g., "teacher" -> "Coach" for sports clubs)
 */
export function getRoleDisplayName(role: string, orgType: OrganizationType): string {
  const terminology = getTerminologyWithFallback(orgType);
  
  // Map common roles to terminology keys
  const roleMap: Record<string, keyof TerminologyMap> = {
    teacher: 'instructor',
    parent: 'guardian',
    student: 'member',
    principal: 'instructor', // Principals are senior instructors
    coach: 'instructor',
  };
  
  const termKey = roleMap[role.toLowerCase()];
  if (termKey && terminology[termKey]) {
    return terminology[termKey];
  }
  
  // Fallback: capitalize role
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Get plural form of role display name
 */
export function getRolePluralName(role: string, orgType: OrganizationType): string {
  const terminology = getTerminologyWithFallback(orgType);
  
  const roleMap: Record<string, keyof TerminologyMap> = {
    teacher: 'instructors',
    parent: 'guardians',
    student: 'members',
    principal: 'instructors',
    coach: 'instructors',
  };
  
  const termKey = roleMap[role.toLowerCase()];
  if (termKey && terminology[termKey]) {
    return terminology[termKey];
  }
  
  // Fallback: add 's'
  return role.charAt(0).toUpperCase() + role.slice(1) + 's';
}

/**
 * Get all available organization types
 */
export function getAvailableOrganizationTypes(): OrganizationType[] {
  return Object.keys(TERMINOLOGY_MAPS) as OrganizationType[];
}

/**
 * Check if an organization type is valid
 */
export function isValidOrganizationType(type: string): type is OrganizationType {
  return type in TERMINOLOGY_MAPS;
}
