// 🔐 Enhanced Authentication Types
// Comprehensive type definitions for the multi-role authentication system

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface PasswordValidation extends ValidationResult {
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
  score: number; // 0-100
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    notCommon: boolean;
    noUserInfo: boolean;
  };
  feedback: string[];
}

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

export type SecurityEventType = 
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'registration_attempt'
  | 'registration_success'
  | 'password_change'
  | 'email_verification'
  | 'account_lockout'
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'role_change'
  | 'suspicious_activity'
  | 'rate_limit_exceeded';

// Enhanced User Roles with hierarchy
export type EnhancedUserRole = 'principal' | 'teacher' | 'parent' | 'student';

export interface UserHierarchy {
  role: EnhancedUserRole;
  level: number; // 1=Principal, 2=Teacher, 3=Parent, 4=Student
  canInvite: EnhancedUserRole[];
  permissions: string[];
}

// Organization Structure
export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  address: Address;
  contactInfo: ContactInfo;
  settings: OrganizationSettings;
  createdBy: string; // Principal user ID
  createdAt: Date;
  status: 'active' | 'inactive' | 'pending';
}

export type OrganizationType = 
  | 'elementary_school'
  | 'middle_school' 
  | 'high_school'
  | 'k12_school'
  | 'university'
  | 'training_center'
  | 'other';

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ContactInfo {
  phone: string;
  email: string;
  website?: string;
}

export interface OrganizationSettings {
  allowStudentSelfRegistration: boolean;
  requireParentApproval: boolean;
  enableGuestAccess: boolean;
  maxStudentsPerClass: number;
  academicYear: {
    start: Date;
    end: Date;
  };
}

// Multi-Role Registration Interfaces
export interface BaseRegistration {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone?: string;
  acceptTerms: boolean;
  marketingConsent?: boolean;
}

export interface PrincipalRegistration extends BaseRegistration {
  role: 'principal';
  organization: {
    name: string;
    type: OrganizationType;
    address: Address;
    phone: string;
  };
  jobTitle: string;
  yearsExperience?: number;
}

export interface TeacherRegistration extends BaseRegistration {
  role: 'teacher';
  organizationId?: string;
  invitationToken?: string;
  subjects: string[];
  gradeLevel: string[];
  qualifications?: string[];
  bio?: string;
}

export interface ParentRegistration extends BaseRegistration {
  role: 'parent';
  invitationToken?: string;
  children: {
    firstName: string;
    lastName: string;
    grade?: string;
    studentId?: string;
  }[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface StudentRegistration extends BaseRegistration {
  role: 'student';
  grade?: string;
  dateOfBirth?: Date;
  parentEmail?: string;
  schoolCode?: string;
  interests?: string[];
}

export type EnhancedRegistration = 
  | PrincipalRegistration 
  | TeacherRegistration 
  | ParentRegistration 
  | StudentRegistration;

// Invitation System
export interface BaseInvitation {
  id: string;
  invitedBy: string; // User ID who sent invitation
  invitedEmail: string;
  organizationId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date;
  status: InvitationStatus;
  message?: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface TeacherInvitation extends BaseInvitation {
  role: 'teacher';
  invitedName: string;
  subjects: string[];
  gradeLevel: string[];
  permissions?: string[];
}

export interface ParentInvitation extends BaseInvitation {
  role: 'parent';
  invitedName: string;
  studentConnections: {
    studentId: string;
    studentName: string;
    relationship: 'parent' | 'guardian';
  }[];
}

export type EnhancedInvitation = TeacherInvitation | ParentInvitation;

// Authentication Responses
export interface EnhancedAuthResponse {
  success: boolean;
  user?: EnhancedUser;
  token?: string;
  refreshToken?: string;
  requiresVerification?: boolean;
  verificationSent?: boolean;
  message: string;
  errors?: string[];
  nextStep?: AuthFlowStep;
}

export interface EnhancedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: EnhancedUserRole;
  organizationId?: string;
  profileComplete: boolean;
  emailVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  settings: UserSettings;
  permissions: string[];
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  marketing: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'organization' | 'private';
  showEmail: boolean;
  showPhone: boolean;
  dataCollection: boolean;
}

// Registration Flow Management
export interface RegistrationFlow {
  id: string;
  role: EnhancedUserRole;
  steps: RegistrationStep[];
  currentStep: number;
  completed: boolean;
  data: Partial<EnhancedRegistration>;
  errors: Record<string, string[]>;
  startedAt: Date;
  completedAt?: Date;
}

export interface RegistrationStep {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  validation: ValidationRule[];
  optional: boolean;
  completed: boolean;
}

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required: boolean;
  validation?: ValidationRule[];
  options?: SelectOption[];
  dependsOn?: string;
  hint?: string;
}

export type FieldType = 
  | 'text' 
  | 'email' 
  | 'password' 
  | 'phone' 
  | 'select' 
  | 'multiselect'
  | 'checkbox' 
  | 'radio' 
  | 'textarea' 
  | 'date' 
  | 'number';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface ValidationRule {
  type: ValidationType;
  value?: any;
  message: string;
}

export type ValidationType = 
  | 'required' 
  | 'email' 
  | 'phone' 
  | 'minLength' 
  | 'maxLength' 
  | 'pattern' 
  | 'custom';

// Authentication Flow Steps
export type AuthFlowStep = 
  | 'role_selection'
  | 'personal_info'
  | 'organization_setup'
  | 'security_setup'
  | 'email_verification'
  | 'profile_completion'
  | 'onboarding';

// Rate Limiting
export interface RateLimit {
  identifier: string; // IP or email
  action: RateLimitAction;
  attempts: number;
  firstAttempt: Date;
  lastAttempt: Date;
  blockedUntil?: Date;
}

export type RateLimitAction = 'login' | 'registration' | 'password_reset' | 'email_verification';

// Password Policy
export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfoInPassword: boolean;
  preventRecentPasswords: number;
  specialChars: string[];
}

// Email Verification
export interface EmailVerification {
  id: string;
  userId: string;
  email: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  verifiedAt?: Date;
  attempts: number;
  maxAttempts: number;
}

// Onboarding Data
export interface OnboardingData {
  userId: string;
  role: EnhancedUserRole;
  steps: OnboardingStep[];
  currentStep: number;
  completed: boolean;
  skipped: boolean;
  completedAt?: Date;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: string;
  completed: boolean;
  required: boolean;
  data?: any;
}

// API Responses
export interface AuthApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  errors?: Record<string, string[]>;
  meta?: {
    timestamp: Date;
    requestId: string;
    rateLimit?: {
      remaining: number;
      resetAt: Date;
    };
  };
}

// Form State Management
export interface AuthFormState {
  values: Record<string, any>;
  errors: Record<string, string[]>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  step: number;
  totalSteps: number;
}

// Authentication Context
export interface AuthContextType {
  user: EnhancedUser | null;
  loading: boolean;
  register: (data: EnhancedRegistration) => Promise<EnhancedAuthResponse>;
  login: (email: string, password: string) => Promise<EnhancedAuthResponse>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<EnhancedAuthResponse>;
  sendInvitation: (invitation: Omit<EnhancedInvitation, 'id' | 'token' | 'createdAt'>) => Promise<boolean>;
  validateField: (field: string, value: any) => ValidationResult;
  checkEmailAvailability: (email: string) => Promise<boolean>;
  updateProfile: (data: Partial<EnhancedUser>) => Promise<boolean>;
}

// Component Props
export interface AuthComponentProps {
  onSuccess?: (user: EnhancedUser) => void;
  onError?: (error: string) => void;
  redirectTo?: string;
  theme?: 'light' | 'dark';
  showRoleSelection?: boolean;
  allowedRoles?: EnhancedUserRole[];
}

export interface RegistrationFormProps extends AuthComponentProps {
  role?: EnhancedUserRole;
  invitationToken?: string;
  organizationId?: string;
}

export interface RoleSelectionProps {
  onRoleSelect: (role: EnhancedUserRole) => void;
  allowedRoles?: EnhancedUserRole[];
  showHierarchy?: boolean;
}

// Error Types
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ValidationError extends AuthError {
  constructor(message: string, field: string, public value?: any) {
    super(message, 'VALIDATION_ERROR', field);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends AuthError {
  constructor(message: string, public retryAfter: number) {
    super(message, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export class InvitationError extends AuthError {
  constructor(message: string, public invitationId?: string) {
    super(message, 'INVITATION_ERROR');
    this.name = 'InvitationError';
  }
}