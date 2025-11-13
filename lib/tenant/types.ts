/**
 * Organization type system for multi-organizational support
 * Supports preschools, K-12 schools, universities, corporate training, sports clubs, etc.
 */

/**
 * Supported organization types
 */
export type OrganizationType =
  | 'preschool'
  | 'k12_school'
  | 'university'
  | 'corporate'
  | 'sports_club'
  | 'community_org'
  | 'training_center'
  | 'tutoring_center';

/**
 * Organization information
 */
export interface OrganizationInfo {
  id: string;
  name: string;
  type: OrganizationType;
  plan_tier: 'free' | 'starter' | 'premium' | 'enterprise';
  subscription_status?: string;
  tenant_slug?: string;
  features?: Record<string, boolean>;
  config?: Record<string, any>;
}

/**
 * Terminology mapping for UI labels
 * Different organization types use different terminology
 */
export interface TerminologyMap {
  member: string;               // e.g., "Student", "Employee", "Member"
  members: string;              // e.g., "Students", "Employees", "Members"
  instructor: string;           // e.g., "Teacher", "Trainer", "Coach"
  instructors: string;          // e.g., "Teachers", "Trainers", "Coaches"
  guardian: string;             // e.g., "Parent", "Guardian", "Sponsor"
  guardians: string;            // e.g., "Parents", "Guardians", "Sponsors"
  group: string;                // e.g., "Class", "Department", "Team"
  groups: string;               // e.g., "Classes", "Departments", "Teams"
  institution: string;          // e.g., "School", "Company", "Club"
  level: string;                // e.g., "Grade", "Level", "Year"
}

/**
 * Extended organization context with terminology
 */
export interface OrganizationContext {
  organization: OrganizationInfo;
  terminology: TerminologyMap;
}

/**
 * Legacy compatibility: map old field names
 */
export interface LegacySchoolCompat {
  /** @deprecated Use organizationId */
  schoolId: string;
  /** @deprecated Use organizationName */
  schoolName?: string;
  organizationId: string;
  organizationName?: string;
  organizationType: OrganizationType;
}
