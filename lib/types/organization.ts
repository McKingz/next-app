/**
 * Organization Type System
 * 
 * Provides a flexible, type-safe system for supporting multiple organization types
 * beyond just preschools (universities, corporate, K-12, sports clubs, etc.)
 * 
 * Part of Phase 3A: Organization Generalization Refactor
 */

/**
 * Supported organization types
 * Extensible to support new organization types without code changes
 */
export enum OrganizationType {
  PRESCHOOL = 'preschool',
  K12_SCHOOL = 'k12_school',
  UNIVERSITY = 'university',
  CORPORATE = 'corporate',
  SPORTS_CLUB = 'sports_club',
  COMMUNITY_ORG = 'community_org',
  TRAINING_CENTER = 'training_center',
  TUTORING_CENTER = 'tutoring_center',
}

/**
 * Role definition for dynamic role systems
 * Allows each organization type to define its own roles
 */
export interface RoleDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  hierarchy_level: number; // 0 = lowest (member), higher = more authority
  capabilities: string[];
}

/**
 * Terminology mapping for organization-specific language
 * Maps generic terms to organization-specific terms
 */
export interface TerminologyMap {
  // Primary entity terminology
  member: string;           // e.g., "student", "employee", "athlete", "member"
  memberPlural: string;     // e.g., "students", "employees", "athletes"
  leader: string;           // e.g., "teacher", "manager", "coach", "instructor"
  leaderPlural: string;     // e.g., "teachers", "managers", "coaches"
  admin: string;            // e.g., "principal", "director", "club_admin"
  adminPlural: string;      // e.g., "principals", "directors", "admins"
  
  // Group terminology
  group: string;            // e.g., "class", "team", "department", "cohort"
  groupPlural: string;      // e.g., "classes", "teams", "departments"
  
  // Parent/Guardian terminology
  guardian: string;         // e.g., "parent", "sponsor", "manager"
  guardianPlural: string;   // e.g., "parents", "sponsors", "managers"
  
  // Activity terminology
  activity: string;         // e.g., "lesson", "training", "practice", "session"
  activityPlural: string;   // e.g., "lessons", "trainings", "practices"
  
  // Assessment terminology
  assessment: string;       // e.g., "grade", "evaluation", "performance_review"
  assessmentPlural: string; // e.g., "grades", "evaluations", "reviews"
  
  // Curriculum/Program terminology
  curriculum: string;       // e.g., "curriculum", "program", "training_plan"
  
  // Organization terminology
  organization: string;     // e.g., "school", "company", "club"
}

/**
 * AI personality configuration per organization type
 * Defines how Dash should behave and speak for each org type
 */
export interface AIPersonalityConfig {
  greeting: string;
  tone: 'formal' | 'casual' | 'professional' | 'friendly' | 'encouraging';
  expertiseAreas: string[];
  proactiveBehaviors: string[];
  taskCategories: string[];
}

/**
 * Organization configuration
 * Complete configuration for an organization type including terminology, roles, and AI behavior
 */
export interface OrganizationConfig {
  type: OrganizationType;
  displayName: string;
  description: string;
  
  // Terminology mapping
  terminology: TerminologyMap;
  
  // Role definitions
  roles: RoleDefinition[];
  
  // AI personality per role
  aiPersonalities: {
    [roleId: string]: AIPersonalityConfig;
  };
  
  // Feature flags
  features: {
    hasAttendance: boolean;
    hasGrading: boolean;
    hasScheduling: boolean;
    hasMessaging: boolean;
    hasReporting: boolean;
    hasCalendar: boolean;
    hasPayments: boolean;
    hasDocuments: boolean;
  };
  
  // UI customization
  ui: {
    primaryColor?: string;
    icon?: string;
    dashboardLayout: 'education' | 'corporate' | 'sports' | 'default';
  };
}

/**
 * Predefined organization configurations
 * Default configurations for each supported organization type
 */
export const ORGANIZATION_CONFIGS: Record<OrganizationType, OrganizationConfig> = {
  [OrganizationType.PRESCHOOL]: {
    type: OrganizationType.PRESCHOOL,
    displayName: 'Preschool',
    description: 'Early childhood education center',
    terminology: {
      member: 'student',
      memberPlural: 'students',
      leader: 'teacher',
      leaderPlural: 'teachers',
      admin: 'principal',
      adminPlural: 'principals',
      group: 'class',
      groupPlural: 'classes',
      guardian: 'parent',
      guardianPlural: 'parents',
      activity: 'lesson',
      activityPlural: 'lessons',
      assessment: 'grade',
      assessmentPlural: 'grades',
      curriculum: 'curriculum',
      organization: 'preschool',
    },
    roles: [
      {
        id: 'student',
        name: 'student',
        displayName: 'Student',
        description: 'Preschool student',
        permissions: ['view_own_profile', 'view_lessons'],
        hierarchy_level: 0,
        capabilities: ['learning', 'activities'],
      },
      {
        id: 'parent',
        name: 'parent',
        displayName: 'Parent',
        description: 'Parent or guardian',
        permissions: ['view_child_profile', 'message_teachers', 'view_reports'],
        hierarchy_level: 1,
        capabilities: ['messaging', 'monitoring'],
      },
      {
        id: 'teacher',
        name: 'teacher',
        displayName: 'Teacher',
        description: 'Classroom teacher',
        permissions: ['manage_class', 'grade_students', 'message_parents', 'create_lessons'],
        hierarchy_level: 2,
        capabilities: ['teaching', 'grading', 'planning', 'communication'],
      },
      {
        id: 'principal',
        name: 'principal',
        displayName: 'Principal',
        description: 'School principal',
        permissions: ['manage_school', 'view_all', 'manage_staff', 'reports'],
        hierarchy_level: 3,
        capabilities: ['management', 'analytics', 'administration'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      teacher: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'encouraging',
        expertiseAreas: ['education', 'lesson planning', 'classroom management', 'student assessment'],
        proactiveBehaviors: ['suggest_improvements', 'remind_deadlines', 'flag_concerns'],
        taskCategories: ['content', 'planning', 'communication'],
      },
      principal: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['school administration', 'staff management', 'analytics', 'policy'],
        proactiveBehaviors: ['monitor_metrics', 'suggest_strategies', 'track_goals'],
        taskCategories: ['management', 'strategic', 'operational'],
      },
      parent: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'friendly',
        expertiseAreas: ['parent communication', 'student progress', 'homework help'],
        proactiveBehaviors: ['remind_deadlines', 'suggest_activities', 'flag_updates'],
        taskCategories: ['organization', 'communication', 'personal'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: true,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: true,
      hasDocuments: true,
    },
    ui: {
      primaryColor: '#4A90E2',
      icon: 'school',
      dashboardLayout: 'education',
    },
  },
  
  [OrganizationType.UNIVERSITY]: {
    type: OrganizationType.UNIVERSITY,
    displayName: 'University',
    description: 'Higher education institution',
    terminology: {
      member: 'student',
      memberPlural: 'students',
      leader: 'professor',
      leaderPlural: 'professors',
      admin: 'dean',
      adminPlural: 'deans',
      group: 'course',
      groupPlural: 'courses',
      guardian: 'sponsor',
      guardianPlural: 'sponsors',
      activity: 'lecture',
      activityPlural: 'lectures',
      assessment: 'grade',
      assessmentPlural: 'grades',
      curriculum: 'program',
      organization: 'university',
    },
    roles: [
      {
        id: 'student',
        name: 'student',
        displayName: 'Student',
        description: 'University student',
        permissions: ['view_own_profile', 'view_courses', 'submit_assignments'],
        hierarchy_level: 0,
        capabilities: ['learning', 'research'],
      },
      {
        id: 'ta',
        name: 'teaching_assistant',
        displayName: 'Teaching Assistant',
        description: 'Teaching assistant',
        permissions: ['assist_teaching', 'grade_assignments', 'message_students'],
        hierarchy_level: 1,
        capabilities: ['assisting', 'grading'],
      },
      {
        id: 'professor',
        name: 'professor',
        displayName: 'Professor',
        description: 'Course professor',
        permissions: ['manage_course', 'grade_students', 'create_curriculum'],
        hierarchy_level: 2,
        capabilities: ['teaching', 'research', 'grading'],
      },
      {
        id: 'dean',
        name: 'dean',
        displayName: 'Dean',
        description: 'Department dean',
        permissions: ['manage_department', 'view_all', 'manage_faculty'],
        hierarchy_level: 3,
        capabilities: ['management', 'analytics', 'administration'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      professor: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['higher education', 'curriculum design', 'research', 'student assessment'],
        proactiveBehaviors: ['suggest_improvements', 'track_deadlines', 'recommend_resources'],
        taskCategories: ['teaching', 'research', 'administration'],
      },
      dean: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'formal',
        expertiseAreas: ['academic administration', 'faculty management', 'program development'],
        proactiveBehaviors: ['monitor_metrics', 'suggest_strategies', 'track_accreditation'],
        taskCategories: ['management', 'strategic', 'compliance'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: true,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: false,
      hasDocuments: true,
    },
    ui: {
      primaryColor: '#1A237E',
      icon: 'university',
      dashboardLayout: 'education',
    },
  },
  
  [OrganizationType.CORPORATE]: {
    type: OrganizationType.CORPORATE,
    displayName: 'Corporate',
    description: 'Corporate training and development',
    terminology: {
      member: 'employee',
      memberPlural: 'employees',
      leader: 'trainer',
      leaderPlural: 'trainers',
      admin: 'director',
      adminPlural: 'directors',
      group: 'team',
      groupPlural: 'teams',
      guardian: 'manager',
      guardianPlural: 'managers',
      activity: 'training',
      activityPlural: 'trainings',
      assessment: 'evaluation',
      assessmentPlural: 'evaluations',
      curriculum: 'training_program',
      organization: 'company',
    },
    roles: [
      {
        id: 'employee',
        name: 'employee',
        displayName: 'Employee',
        description: 'Company employee',
        permissions: ['view_own_profile', 'view_trainings', 'complete_courses'],
        hierarchy_level: 0,
        capabilities: ['learning', 'development'],
      },
      {
        id: 'trainer',
        name: 'trainer',
        displayName: 'Trainer',
        description: 'Corporate trainer',
        permissions: ['manage_trainings', 'evaluate_employees', 'create_content'],
        hierarchy_level: 2,
        capabilities: ['training', 'evaluation', 'content_creation'],
      },
      {
        id: 'manager',
        name: 'manager',
        displayName: 'Manager',
        description: 'Team manager',
        permissions: ['manage_team', 'view_reports', 'approve_trainings'],
        hierarchy_level: 2,
        capabilities: ['management', 'oversight'],
      },
      {
        id: 'director',
        name: 'director',
        displayName: 'Director',
        description: 'Training director',
        permissions: ['manage_all', 'view_analytics', 'budget_control'],
        hierarchy_level: 3,
        capabilities: ['strategic_management', 'analytics', 'budgeting'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      trainer: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['corporate training', 'employee development', 'performance evaluation'],
        proactiveBehaviors: ['suggest_improvements', 'track_completion', 'recommend_content'],
        taskCategories: ['training', 'development', 'evaluation'],
      },
      director: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['learning strategy', 'ROI analysis', 'program management'],
        proactiveBehaviors: ['monitor_kpis', 'suggest_strategies', 'forecast_needs'],
        taskCategories: ['strategic', 'analytics', 'optimization'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: true,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: false,
      hasDocuments: true,
    },
    ui: {
      primaryColor: '#2E7D32',
      icon: 'business',
      dashboardLayout: 'corporate',
    },
  },
  
  [OrganizationType.SPORTS_CLUB]: {
    type: OrganizationType.SPORTS_CLUB,
    displayName: 'Sports Club',
    description: 'Sports and athletics organization',
    terminology: {
      member: 'athlete',
      memberPlural: 'athletes',
      leader: 'coach',
      leaderPlural: 'coaches',
      admin: 'club_admin',
      adminPlural: 'club_admins',
      group: 'team',
      groupPlural: 'teams',
      guardian: 'parent',
      guardianPlural: 'parents',
      activity: 'practice',
      activityPlural: 'practices',
      assessment: 'performance_review',
      assessmentPlural: 'performance_reviews',
      curriculum: 'training_plan',
      organization: 'club',
    },
    roles: [
      {
        id: 'athlete',
        name: 'athlete',
        displayName: 'Athlete',
        description: 'Club athlete',
        permissions: ['view_own_profile', 'view_schedule', 'track_performance'],
        hierarchy_level: 0,
        capabilities: ['training', 'competing'],
      },
      {
        id: 'parent',
        name: 'parent',
        displayName: 'Parent',
        description: 'Athlete parent',
        permissions: ['view_child_profile', 'message_coaches', 'view_schedule'],
        hierarchy_level: 1,
        capabilities: ['monitoring', 'communication'],
      },
      {
        id: 'coach',
        name: 'coach',
        displayName: 'Coach',
        description: 'Team coach',
        permissions: ['manage_team', 'track_performance', 'create_plans'],
        hierarchy_level: 2,
        capabilities: ['coaching', 'planning', 'evaluation'],
      },
      {
        id: 'club_admin',
        name: 'club_admin',
        displayName: 'Club Admin',
        description: 'Club administrator',
        permissions: ['manage_club', 'view_all', 'manage_staff'],
        hierarchy_level: 3,
        capabilities: ['management', 'administration'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      coach: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'encouraging',
        expertiseAreas: ['sports training', 'performance tracking', 'team management'],
        proactiveBehaviors: ['suggest_drills', 'track_progress', 'remind_events'],
        taskCategories: ['training', 'planning', 'performance'],
      },
      club_admin: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['club management', 'scheduling', 'member engagement'],
        proactiveBehaviors: ['monitor_attendance', 'suggest_events', 'track_payments'],
        taskCategories: ['management', 'operations', 'engagement'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: false,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: true,
      hasDocuments: false,
    },
    ui: {
      primaryColor: '#D84315',
      icon: 'sports',
      dashboardLayout: 'sports',
    },
  },
  
  [OrganizationType.K12_SCHOOL]: {
    type: OrganizationType.K12_SCHOOL,
    displayName: 'K-12 School',
    description: 'Primary and secondary education',
    terminology: {
      member: 'student',
      memberPlural: 'students',
      leader: 'teacher',
      leaderPlural: 'teachers',
      admin: 'principal',
      adminPlural: 'principals',
      group: 'class',
      groupPlural: 'classes',
      guardian: 'parent',
      guardianPlural: 'parents',
      activity: 'lesson',
      activityPlural: 'lessons',
      assessment: 'grade',
      assessmentPlural: 'grades',
      curriculum: 'curriculum',
      organization: 'school',
    },
    roles: [
      {
        id: 'student',
        name: 'student',
        displayName: 'Student',
        description: 'K-12 student',
        permissions: ['view_own_profile', 'view_lessons', 'submit_assignments'],
        hierarchy_level: 0,
        capabilities: ['learning', 'studying'],
      },
      {
        id: 'parent',
        name: 'parent',
        displayName: 'Parent',
        description: 'Parent or guardian',
        permissions: ['view_child_profile', 'message_teachers', 'view_reports'],
        hierarchy_level: 1,
        capabilities: ['messaging', 'monitoring'],
      },
      {
        id: 'teacher',
        name: 'teacher',
        displayName: 'Teacher',
        description: 'Classroom teacher',
        permissions: ['manage_class', 'grade_students', 'message_parents', 'create_lessons'],
        hierarchy_level: 2,
        capabilities: ['teaching', 'grading', 'planning', 'communication'],
      },
      {
        id: 'principal',
        name: 'principal',
        displayName: 'Principal',
        description: 'School principal',
        permissions: ['manage_school', 'view_all', 'manage_staff', 'reports'],
        hierarchy_level: 3,
        capabilities: ['management', 'analytics', 'administration'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      teacher: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'friendly',
        expertiseAreas: ['K-12 education', 'lesson planning', 'student assessment', 'curriculum'],
        proactiveBehaviors: ['suggest_improvements', 'remind_deadlines', 'recommend_resources'],
        taskCategories: ['teaching', 'planning', 'grading'],
      },
      principal: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['school administration', 'staff management', 'analytics', 'compliance'],
        proactiveBehaviors: ['monitor_metrics', 'suggest_strategies', 'track_goals'],
        taskCategories: ['management', 'strategic', 'operational'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: true,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: true,
      hasDocuments: true,
    },
    ui: {
      primaryColor: '#1976D2',
      icon: 'school',
      dashboardLayout: 'education',
    },
  },
  
  [OrganizationType.COMMUNITY_ORG]: {
    type: OrganizationType.COMMUNITY_ORG,
    displayName: 'Community Organization',
    description: 'Community-based organization',
    terminology: {
      member: 'member',
      memberPlural: 'members',
      leader: 'coordinator',
      leaderPlural: 'coordinators',
      admin: 'director',
      adminPlural: 'directors',
      group: 'program',
      groupPlural: 'programs',
      guardian: 'sponsor',
      guardianPlural: 'sponsors',
      activity: 'session',
      activityPlural: 'sessions',
      assessment: 'feedback',
      assessmentPlural: 'feedback',
      curriculum: 'program',
      organization: 'organization',
    },
    roles: [
      {
        id: 'member',
        name: 'member',
        displayName: 'Member',
        description: 'Community member',
        permissions: ['view_own_profile', 'view_programs', 'participate'],
        hierarchy_level: 0,
        capabilities: ['participation', 'engagement'],
      },
      {
        id: 'volunteer',
        name: 'volunteer',
        displayName: 'Volunteer',
        description: 'Community volunteer',
        permissions: ['assist_programs', 'view_schedules', 'message_members'],
        hierarchy_level: 1,
        capabilities: ['assisting', 'organizing'],
      },
      {
        id: 'coordinator',
        name: 'coordinator',
        displayName: 'Coordinator',
        description: 'Program coordinator',
        permissions: ['manage_programs', 'track_participation', 'organize_events'],
        hierarchy_level: 2,
        capabilities: ['coordination', 'planning', 'execution'],
      },
      {
        id: 'director',
        name: 'director',
        displayName: 'Director',
        description: 'Organization director',
        permissions: ['manage_all', 'view_analytics', 'manage_staff'],
        hierarchy_level: 3,
        capabilities: ['management', 'strategic_planning'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      coordinator: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'friendly',
        expertiseAreas: ['community engagement', 'program planning', 'volunteer coordination'],
        proactiveBehaviors: ['suggest_events', 'track_participation', 'remind_deadlines'],
        taskCategories: ['planning', 'coordination', 'engagement'],
      },
      director: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['nonprofit management', 'community impact', 'program development'],
        proactiveBehaviors: ['monitor_impact', 'suggest_strategies', 'track_goals'],
        taskCategories: ['management', 'strategic', 'impact'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: false,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: false,
      hasDocuments: true,
    },
    ui: {
      primaryColor: '#7B1FA2',
      icon: 'people',
      dashboardLayout: 'default',
    },
  },
  
  [OrganizationType.TRAINING_CENTER]: {
    type: OrganizationType.TRAINING_CENTER,
    displayName: 'Training Center',
    description: 'Professional training and certification center',
    terminology: {
      member: 'trainee',
      memberPlural: 'trainees',
      leader: 'instructor',
      leaderPlural: 'instructors',
      admin: 'center_admin',
      adminPlural: 'center_admins',
      group: 'cohort',
      groupPlural: 'cohorts',
      guardian: 'sponsor',
      guardianPlural: 'sponsors',
      activity: 'training',
      activityPlural: 'trainings',
      assessment: 'certification',
      assessmentPlural: 'certifications',
      curriculum: 'training_program',
      organization: 'center',
    },
    roles: [
      {
        id: 'trainee',
        name: 'trainee',
        displayName: 'Trainee',
        description: 'Training participant',
        permissions: ['view_own_profile', 'view_trainings', 'complete_certifications'],
        hierarchy_level: 0,
        capabilities: ['learning', 'certification'],
      },
      {
        id: 'instructor',
        name: 'instructor',
        displayName: 'Instructor',
        description: 'Training instructor',
        permissions: ['manage_cohorts', 'evaluate_trainees', 'issue_certificates'],
        hierarchy_level: 2,
        capabilities: ['teaching', 'evaluation', 'certification'],
      },
      {
        id: 'center_admin',
        name: 'center_admin',
        displayName: 'Center Admin',
        description: 'Center administrator',
        permissions: ['manage_center', 'view_all', 'manage_instructors'],
        hierarchy_level: 3,
        capabilities: ['management', 'operations'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      instructor: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['professional training', 'skill development', 'certification'],
        proactiveBehaviors: ['suggest_courses', 'track_progress', 'recommend_certifications'],
        taskCategories: ['training', 'assessment', 'certification'],
      },
      center_admin: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['center management', 'program scheduling', 'certification tracking'],
        proactiveBehaviors: ['monitor_enrollments', 'track_completions', 'suggest_programs'],
        taskCategories: ['management', 'operations', 'scheduling'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: true,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: true,
      hasDocuments: true,
    },
    ui: {
      primaryColor: '#F57C00',
      icon: 'school',
      dashboardLayout: 'education',
    },
  },
  
  [OrganizationType.TUTORING_CENTER]: {
    type: OrganizationType.TUTORING_CENTER,
    displayName: 'Tutoring Center',
    description: 'Academic tutoring and support center',
    terminology: {
      member: 'student',
      memberPlural: 'students',
      leader: 'tutor',
      leaderPlural: 'tutors',
      admin: 'center_director',
      adminPlural: 'center_directors',
      group: 'group',
      groupPlural: 'groups',
      guardian: 'parent',
      guardianPlural: 'parents',
      activity: 'session',
      activityPlural: 'sessions',
      assessment: 'progress_report',
      assessmentPlural: 'progress_reports',
      curriculum: 'learning_plan',
      organization: 'center',
    },
    roles: [
      {
        id: 'student',
        name: 'student',
        displayName: 'Student',
        description: 'Tutoring student',
        permissions: ['view_own_profile', 'view_sessions', 'track_progress'],
        hierarchy_level: 0,
        capabilities: ['learning', 'homework'],
      },
      {
        id: 'parent',
        name: 'parent',
        displayName: 'Parent',
        description: 'Student parent',
        permissions: ['view_child_profile', 'message_tutors', 'view_progress'],
        hierarchy_level: 1,
        capabilities: ['monitoring', 'communication'],
      },
      {
        id: 'tutor',
        name: 'tutor',
        displayName: 'Tutor',
        description: 'Subject tutor',
        permissions: ['manage_sessions', 'track_progress', 'message_parents'],
        hierarchy_level: 2,
        capabilities: ['tutoring', 'assessment', 'planning'],
      },
      {
        id: 'center_director',
        name: 'center_director',
        displayName: 'Center Director',
        description: 'Center director',
        permissions: ['manage_center', 'view_all', 'manage_tutors'],
        hierarchy_level: 3,
        capabilities: ['management', 'operations', 'scheduling'],
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Admin',
        description: 'System administrator',
        permissions: ['full_access'],
        hierarchy_level: 4,
        capabilities: ['system_admin'],
      },
    ],
    aiPersonalities: {
      tutor: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'encouraging',
        expertiseAreas: ['academic tutoring', 'homework help', 'study skills', 'progress tracking'],
        proactiveBehaviors: ['suggest_topics', 'track_progress', 'remind_sessions'],
        taskCategories: ['tutoring', 'assessment', 'planning'],
      },
      center_director: {
        greeting: "Hello I am Dash. How can I assist you today?",
        tone: 'professional',
        expertiseAreas: ['center management', 'tutor scheduling', 'student progress'],
        proactiveBehaviors: ['monitor_attendance', 'track_progress', 'suggest_improvements'],
        taskCategories: ['management', 'operations', 'analytics'],
      },
    },
    features: {
      hasAttendance: true,
      hasGrading: true,
      hasScheduling: true,
      hasMessaging: true,
      hasReporting: true,
      hasCalendar: true,
      hasPayments: true,
      hasDocuments: false,
    },
    ui: {
      primaryColor: '#00897B',
      icon: 'school',
      dashboardLayout: 'education',
    },
  },
};

/**
 * Helper function to get organization config by type
 */
export function getOrganizationConfig(type: OrganizationType): OrganizationConfig {
  return ORGANIZATION_CONFIGS[type];
}

/**
 * Helper function to get terminology for an organization
 */
export function getTerminology(type: OrganizationType): TerminologyMap {
  return ORGANIZATION_CONFIGS[type].terminology;
}

/**
 * Helper function to get roles for an organization type
 */
export function getRoles(type: OrganizationType): RoleDefinition[] {
  return ORGANIZATION_CONFIGS[type].roles;
}

/**
 * Helper function to get AI personality for a specific role in an organization
 */
export function getAIPersonality(
  type: OrganizationType,
  roleId: string
): AIPersonalityConfig | undefined {
  return ORGANIZATION_CONFIGS[type].aiPersonalities[roleId];
}

/**
 * Helper function to translate a generic term to organization-specific term
 */
export function translateTerm(
  type: OrganizationType,
  genericTerm: keyof TerminologyMap
): string {
  return ORGANIZATION_CONFIGS[type].terminology[genericTerm];
}
