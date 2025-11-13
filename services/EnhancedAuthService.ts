/* eslint-disable @typescript-eslint/no-unused-vars */

// 🔐 Enhanced Authentication Service
// Multi-role registration, invitation system, and advanced security features

import { AuthService, AuthResponse } from '../lib/auth/AuthService';
import { 
  EnhancedRegistration,
  EnhancedAuthResponse,
  EnhancedUser,
  TeacherInvitation,
  ParentInvitation,
  SecurityEventType,
  AuthFlowStep,
  EmailVerification,
  ValidationResult,
  InvitationError,
  AuthError,
  RateLimitError
} from '../types/auth-enhanced';
import { AuthValidation } from '../lib/auth/AuthValidation';
import { passwordPolicyEnforcer } from '../lib/auth/PasswordPolicy';
import { securityLogger } from '../lib/auth/SecurityEventLogger';
import { assertSupabase } from '../lib/supabase';

/**
 * Enhanced Authentication Service
 * Extends the base AuthService with comprehensive features
 */
export class EnhancedAuthService extends AuthService {
  private invitationTokens: Map<string, any> = new Map();

  constructor() {
    super();
  }

  /**
   * Multi-role registration with enhanced validation and security
   */
  async registerUser(registration: EnhancedRegistration): Promise<EnhancedAuthResponse> {
    const startTime = Date.now();
    const ipAddress = await this.getClientIP();
    const userAgent = await this.getUserAgent();

    try {
      // Rate limiting check
      const rateLimitResult = securityLogger.checkRateLimit(ipAddress, 'registration');
      if (!rateLimitResult.allowed) {
        throw new RateLimitError(
          `Registration limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 60000)} minutes.`,
          Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000)
        );
      }

      // Log registration attempt
      await securityLogger.logEvent('registration_attempt', {
        email: registration.email,
        ipAddress,
        userAgent,
        metadata: {
          role: registration.role,
          registrationType: (registration as any).invitationToken ? 'invitation' : 'self-service'
        }
      });

      // Comprehensive validation
      const validationResult = await this.validateRegistration(registration);
      if (!validationResult.isValid) {
        return {
          success: false,
          message: 'Registration validation failed',
          errors: validationResult.errors
        };
      }

      // Role-specific registration flow
      switch (registration.role) {
        case 'principal':
          return await this.registerPrincipal(registration as any);
        case 'teacher':
          return await this.registerTeacher(registration as any);
        case 'parent':
          return await this.registerParent(registration as any);
        case 'student':
          return await this.registerStudentEnhanced(registration as any);
        default:
          throw new AuthError('Invalid role specified', 'INVALID_ROLE');
      }

    } catch (error) {
      // Log registration failure
      await securityLogger.logEvent('registration_attempt', {
        email: registration.email,
        ipAddress,
        userAgent,
        success: false,
        errorCode: error instanceof AuthError ? error.code : 'UNKNOWN_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          role: registration.role,
          duration: Date.now() - startTime
        }
      });

      if (error instanceof RateLimitError) {
        return {
          success: false,
          message: error.message,
          errors: ['Rate limit exceeded']
        };
      }

      if (error instanceof AuthError) {
        return {
          success: false,
          message: error.message,
          errors: [error.message],
          nextStep: this.getNextStepAfterError(error)
        };
      }

      return {
        success: false,
        message: 'Registration failed due to an unexpected error',
        errors: ['An unexpected error occurred. Please try again.']
      };
    }
  }

  /**
   * Register Principal with organization setup
   */
  private async registerPrincipal(registration: any): Promise<EnhancedAuthResponse> {
    // Validate organization data
    const orgValidation = AuthValidation.validateOrganization(registration.organization);
    if (!orgValidation.isValid) {
      return {
        success: false,
        message: 'Organization validation failed',
        errors: orgValidation.errors
      };
    }

    // Create user account
const { data, error } = await assertSupabase().auth.signUp({
      email: registration.email.toLowerCase(),
      password: registration.password,
      options: {
        emailRedirectTo: 'https://www.edudashpro.org.za/landing?flow=email-confirm',
        data: {
          first_name: registration.firstName,
          last_name: registration.lastName,
          role: 'principal',
          organization: registration.organization
        }
      }
    });

    if (error) {
      throw new AuthError(error.message, 'REGISTRATION_FAILED');
    }

    if (!data.user) {
      throw new AuthError('User creation failed', 'USER_CREATION_FAILED');
    }

    // Create organization record
const { data: orgData, error: orgError } = await assertSupabase()
      .from('organizations')
      .insert({
        name: registration.organization.name,
        type: registration.organization.type,
        address: registration.organization.address,
        phone: registration.organization.phone,
        created_by: data.user.id,
        status: 'active'
      })
      .select()
      .single();

    if (orgError) {
      console.error('Organization creation failed:', orgError);
    }

    // Create profile
    await this.createEnhancedProfile(data.user, {
      ...registration,
      organizationId: orgData?.id
    });

    // Log successful registration
    await securityLogger.logEvent('registration_success', {
      userId: data.user.id,
      email: registration.email,
      ipAddress: await this.getClientIP(),
      userAgent: await this.getUserAgent(),
      success: true,
      metadata: {
        role: 'principal',
        organizationCreated: !!orgData
      }
    });

    return {
      success: true,
      user: this.transformUser(data.user, registration.role),
      requiresVerification: !data.session,
      verificationSent: !data.session,
      message: 'Principal account created successfully',
      nextStep: !data.session ? 'email_verification' : 'profile_completion'
    };
  }

  /**
   * Register Teacher (invitation-based or self-service)
   */
  private async registerTeacher(registration: any): Promise<EnhancedAuthResponse> {
    let organizationId: string | undefined;
    let invitationData: any = null;

    // Check for invitation token
    if (registration.invitationToken) {
      invitationData = await this.validateInvitationToken(registration.invitationToken, 'teacher');
      if (!invitationData) {
        throw new InvitationError('Invalid or expired invitation token');
      }
      organizationId = invitationData.organizationId;
    }

    // Create user account
const { data, error } = await assertSupabase().auth.signUp({
      email: registration.email.toLowerCase(),
      password: registration.password,
      options: {
        emailRedirectTo: 'https://www.edudashpro.org.za/landing?flow=email-confirm',
        data: {
          first_name: registration.firstName,
          last_name: registration.lastName,
          role: 'teacher',
          organization_id: organizationId,
          invitation_token: registration.invitationToken
        }
      }
    });

    if (error) {
      throw new AuthError(error.message, 'REGISTRATION_FAILED');
    }

    if (!data.user) {
      throw new AuthError('User creation failed', 'USER_CREATION_FAILED');
    }

    // Create profile
    await this.createEnhancedProfile(data.user, {
      ...registration,
      organizationId,
      subjects: registration.subjects || [],
      gradeLevel: registration.gradeLevel || []
    });

    // Mark invitation as accepted if applicable
    if (invitationData) {
      await this.acceptInvitation(registration.invitationToken, data.user.id);
    }

    // Log successful registration
    await securityLogger.logEvent('registration_success', {
      userId: data.user.id,
      email: registration.email,
      ipAddress: await this.getClientIP(),
      userAgent: await this.getUserAgent(),
      success: true,
      metadata: {
        role: 'teacher',
        invitationBased: !!registration.invitationToken,
        organizationId
      }
    });

    return {
      success: true,
      user: this.transformUser(data.user, registration.role),
      requiresVerification: !data.session,
      verificationSent: !data.session,
      message: 'Teacher account created successfully',
      nextStep: !data.session ? 'email_verification' : 'profile_completion'
    };
  }

  /**
   * Register Parent (invitation-based)
   */
  private async registerParent(registration: any): Promise<EnhancedAuthResponse> {
    // Parents must have invitation token
    if (!registration.invitationToken) {
      throw new AuthError('Parent registration requires an invitation', 'INVITATION_REQUIRED');
    }

    const invitationData = await this.validateInvitationToken(registration.invitationToken, 'parent');
    if (!invitationData) {
      throw new InvitationError('Invalid or expired invitation token');
    }

    // Create user account
const { data, error } = await assertSupabase().auth.signUp({
      email: registration.email.toLowerCase(),
      password: registration.password,
      options: {
        emailRedirectTo: 'https://www.edudashpro.org.za/landing?flow=email-confirm',
        data: {
          first_name: registration.firstName,
          last_name: registration.lastName,
          role: 'parent',
          organization_id: invitationData.organizationId,
          invitation_token: registration.invitationToken
        }
      }
    });

    if (error) {
      throw new AuthError(error.message, 'REGISTRATION_FAILED');
    }

    if (!data.user) {
      throw new AuthError('User creation failed', 'USER_CREATION_FAILED');
    }

    // Create profile with children connections
    await this.createEnhancedProfile(data.user, {
      ...registration,
      organizationId: invitationData.organizationId,
      children: registration.children || []
    });

    // Mark invitation as accepted
    await this.acceptInvitation(registration.invitationToken, data.user.id);

    // Log successful registration
    await securityLogger.logEvent('registration_success', {
      userId: data.user.id,
      email: registration.email,
      ipAddress: await this.getClientIP(),
      userAgent: await this.getUserAgent(),
      success: true,
      metadata: {
        role: 'parent',
        organizationId: invitationData.organizationId,
        childrenCount: registration.children?.length || 0
      }
    });

    return {
      success: true,
      user: this.transformUser(data.user, registration.role),
      requiresVerification: !data.session,
      verificationSent: !data.session,
      message: 'Parent account created successfully',
      nextStep: !data.session ? 'email_verification' : 'profile_completion'
    };
  }

  /**
   * Register Student (enhanced self-service)
   */
  private async registerStudentEnhanced(registration: any): Promise<EnhancedAuthResponse> {
    // Use the enhanced student registration from base class
    const baseResult = await super.registerStudent({
      email: registration.email,
      password: registration.password,
      firstName: registration.firstName,
      lastName: registration.lastName,
      role: 'student'
    });

    if (!baseResult.success || !baseResult.data) {
      return {
        success: false,
        message: baseResult.error || 'Student registration failed',
        errors: [baseResult.error || 'Registration failed']
      };
    }

    // Log successful registration with enhanced details
    await securityLogger.logEvent('registration_success', {
      userId: baseResult.data.user.id,
      email: registration.email,
      ipAddress: await this.getClientIP(),
      userAgent: await this.getUserAgent(),
      success: true,
      metadata: {
        role: 'student',
        grade: registration.grade,
        interests: registration.interests || []
      }
    });

    return {
      success: true,
      user: this.transformUser(baseResult.data.user, 'student'),
      requiresVerification: baseResult.requiresEmailVerification,
      verificationSent: baseResult.requiresEmailVerification,
      message: 'Student account created successfully',
      nextStep: baseResult.requiresEmailVerification ? 'email_verification' : 'profile_completion'
    };
  }

  /**
   * Send teacher invitation
   */
  async inviteTeacher(invitation: Omit<TeacherInvitation, 'id' | 'token' | 'createdAt'>): Promise<boolean> {
    try {
      const token = this.generateInvitationToken();
      const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days

      // Store invitation in database
      const { error } = await assertSupabase()
        .from('invitations')
        .insert({
          id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          invited_by: invitation.invitedBy,
          invited_email: invitation.invitedEmail,
          invited_name: invitation.invitedName,
          organization_id: invitation.organizationId,
          role: 'teacher',
          token,
          expires_at: expiresAt.toISOString(),
          subjects: invitation.subjects,
          grade_level: invitation.gradeLevel,
          permissions: invitation.permissions,
          message: invitation.message,
          status: 'pending'
        });

      if (error) {
        throw new Error(`Failed to create invitation: ${error.message}`);
      }

      // Send invitation email (implement email service)
      await this.sendInvitationEmail(invitation.invitedEmail, {
        inviterName: await this.getInviterName(invitation.invitedBy),
        role: 'teacher',
        token,
        subjects: invitation.subjects,
        gradeLevel: invitation.gradeLevel
      });

      // Log invitation sent
      await securityLogger.logEvent('invitation_sent', {
        userId: invitation.invitedBy,
        email: invitation.invitedEmail,
        ipAddress: await this.getClientIP(),
        userAgent: await this.getUserAgent(),
        success: true,
        metadata: {
          role: 'teacher',
          subjects: invitation.subjects,
          gradeLevel: invitation.gradeLevel
        }
      });

      return true;

    } catch (error) {
      console.error('Teacher invitation failed:', error);
      return false;
    }
  }

  /**
   * Send parent invitation
   */
  async inviteParent(invitation: Omit<ParentInvitation, 'id' | 'token' | 'createdAt'>): Promise<boolean> {
    try {
      const token = this.generateInvitationToken();
      const expiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days

      // Store invitation in database
const { error } = await assertSupabase()
        .from('invitations')
        .insert({
          id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          invited_by: invitation.invitedBy,
          invited_email: invitation.invitedEmail,
          invited_name: invitation.invitedName,
          organization_id: invitation.organizationId,
          role: 'parent',
          token,
          expires_at: expiresAt.toISOString(),
          student_connections: invitation.studentConnections,
          message: invitation.message,
          status: 'pending'
        });

      if (error) {
        throw new Error(`Failed to create invitation: ${error.message}`);
      }

      // Send invitation email
      await this.sendInvitationEmail(invitation.invitedEmail, {
        inviterName: await this.getInviterName(invitation.invitedBy),
        role: 'parent',
        token,
        studentConnections: invitation.studentConnections
      });

      // Log invitation sent
      await securityLogger.logEvent('invitation_sent', {
        userId: invitation.invitedBy,
        email: invitation.invitedEmail,
        ipAddress: await this.getClientIP(),
        userAgent: await this.getUserAgent(),
        success: true,
        metadata: {
          role: 'parent',
          studentCount: invitation.studentConnections.length
        }
      });

      return true;

    } catch (error) {
      console.error('Parent invitation failed:', error);
      return false;
    }
  }

  /**
   * Verify email with enhanced tracking
   */
  async verifyEmail(token: string): Promise<EnhancedAuthResponse> {
    const ipAddress = await this.getClientIP();
    const userAgent = await this.getUserAgent();

    try {
      // Rate limiting check
      const rateLimitResult = securityLogger.checkRateLimit(ipAddress, 'email_verification');
      if (!rateLimitResult.allowed) {
        throw new RateLimitError(
          'Too many verification attempts. Please try again later.',
          Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000)
        );
      }

const { data, error } = await assertSupabase().auth.verifyOtp({
        token_hash: token,
        type: 'email'
      });

      if (error) {
        // Log failed verification
        await securityLogger.logEvent('email_verification', {
          ipAddress,
          userAgent,
          success: false,
          errorMessage: error.message,
          metadata: { token: token.substring(0, 8) + '...' }
        });

        throw new AuthError(error.message, 'VERIFICATION_FAILED');
      }

      // Log successful verification
      await securityLogger.logEvent('email_verification', {
        userId: data.user?.id,
        email: data.user?.email,
        ipAddress,
        userAgent,
        success: true,
        metadata: { verificationMethod: 'email' }
      });

      return {
        success: true,
        user: data.user ? this.transformUser(data.user, 'student') : undefined,
        message: 'Email verified successfully',
        nextStep: 'profile_completion'
      };

    } catch (error) {
      if (error instanceof RateLimitError) {
        return {
          success: false,
          message: error.message,
          errors: ['Rate limit exceeded']
        };
      }

      return {
        success: false,
        message: 'Email verification failed',
        errors: [error instanceof Error ? error.message : 'Verification failed']
      };
    }
  }

  /**
   * Check email availability
   */
  async checkEmailAvailability(email: string): Promise<boolean> {
    try {
      const { data } = await assertSupabase()
        .from('profiles')
        .select('email')
        .eq('email', email.toLowerCase())
        .single();

      return !data; // Available if no existing record found
    } catch (error) {
      return false; // Assume not available on error
    }
  }

  /**
   * Private helper methods
   */

  private async validateRegistration(registration: EnhancedRegistration): Promise<ValidationResult> {
    const errors: string[] = [];

    // Email validation
    const emailValidation = AuthValidation.validateEmail(registration.email);
    if (!emailValidation.isValid) {
      errors.push(...emailValidation.errors);
    } else {
      // Check availability
      const isAvailable = await this.checkEmailAvailability(registration.email);
      if (!isAvailable) {
        errors.push('An account with this email already exists');
      }
    }

    // Password validation with user context
    const passwordValidation = passwordPolicyEnforcer.validatePassword(
      registration.password,
      {
        email: registration.email,
        firstName: registration.firstName,
        lastName: registration.lastName
      }
    );
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }

    // Password confirmation
    const confirmValidation = AuthValidation.validateConfirmPassword(
      registration.password,
      registration.confirmPassword
    );
    if (!confirmValidation.isValid) {
      errors.push(...confirmValidation.errors);
    }

    // Name validations
    const firstNameValidation = AuthValidation.validateName(registration.firstName, 'First name');
    if (!firstNameValidation.isValid) {
      errors.push(...firstNameValidation.errors);
    }

    const lastNameValidation = AuthValidation.validateName(registration.lastName, 'Last name');
    if (!lastNameValidation.isValid) {
      errors.push(...lastNameValidation.errors);
    }

    // Terms acceptance
    const termsValidation = AuthValidation.validateTermsAcceptance(registration.acceptTerms);
    if (!termsValidation.isValid) {
      errors.push(...termsValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async validateInvitationToken(token: string, role: string): Promise<any> {
    try {
      const { data, error } = await assertSupabase()
        .from('invitations')
        .select('*')
        .eq('token', token)
        .eq('role', role)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      return error ? null : data;
    } catch (error) {
      return null;
    }
  }

  private async acceptInvitation(token: string, userId: string): Promise<void> {
    try {
await assertSupabase()
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_by: userId
        })
        .eq('token', token);

      // Log invitation acceptance
      await securityLogger.logEvent('invitation_accepted', {
        userId,
        ipAddress: await this.getClientIP(),
        userAgent: await this.getUserAgent(),
        success: true,
        metadata: { token: token.substring(0, 8) + '...' }
      });

    } catch (error) {
      console.error('Failed to accept invitation:', error);
    }
  }

  private async createEnhancedProfile(user: any, registration: any): Promise<void> {
    const profileData = {
      id: user.id,
      email: registration.email.toLowerCase(),
      first_name: registration.firstName,
      last_name: registration.lastName,
      role: registration.role,
      organization_id: registration.organizationId,
      capabilities: this.getRoleCapabilities(registration.role),
      metadata: {
        registration_method: registration.invitationToken ? 'invitation' : 'self-service',
        account_type: registration.role,
        created_via: 'enhanced_auth_system',
        ...registration.role === 'teacher' && {
          subjects: registration.subjects,
          grade_level: registration.gradeLevel,
          qualifications: registration.qualifications
        },
        ...registration.role === 'parent' && {
          children: registration.children,
          emergency_contact: registration.emergencyContact
        },
        ...registration.role === 'student' && {
          grade: registration.grade,
          interests: registration.interests,
          parent_email: registration.parentEmail
        },
        ...registration.role === 'principal' && {
          job_title: registration.jobTitle,
          years_experience: registration.yearsExperience
        }
      }
    };

const { error } = await assertSupabase()
      .from('profiles')
      .insert(profileData);

    if (error) {
      console.error('Enhanced profile creation failed:', error);
      throw new AuthError('Profile creation failed', 'PROFILE_CREATION_FAILED');
    }
  }

  private getRoleCapabilities(role: string): string[] {
    const capabilities = {
      principal: [
        'access_mobile_app',
        'manage_organization',
        'manage_users',
        'invite_teachers',
        'manage_classes',
        'view_analytics',
        'manage_settings',
        'export_data'
      ],
      teacher: [
        'access_mobile_app',
        'manage_classes',
        'create_assignments',
        'grade_assignments',
        'view_student_progress',
        'manage_courses',
        'manage_enrollments',
        'invite_parents'
      ],
      parent: [
        'access_mobile_app',
        'view_child_progress',
        'communicate_teachers',
        'view_assignments',
        'view_grades',
        'view_announcements',
        'update_profile'
      ],
      student: [
        'access_mobile_app',
        'view_assignments',
        'submit_assignments',
        'view_grades',
        'view_courses',
        'update_profile'
      ]
    };

    return capabilities[role as keyof typeof capabilities] || [];
  }

  private transformUser(user: any, role: string): EnhancedUser {
    return {
      id: user.id,
      email: user.email!,
      firstName: user.user_metadata?.first_name || '',
      lastName: user.user_metadata?.last_name || '',
      role: role as any,
      organizationId: user.user_metadata?.organization_id,
      profileComplete: false,
      emailVerified: !!user.email_confirmed_at,
      lastLogin: user.last_sign_in_at ? new Date(user.last_sign_in_at) : undefined,
      createdAt: new Date(user.created_at),
      settings: {
        theme: 'system',
        language: 'en',
        notifications: {
          email: true,
          push: true,
          sms: false,
          marketing: false
        },
        privacy: {
          profileVisibility: 'organization',
          showEmail: false,
          showPhone: false,
          dataCollection: true
        }
      },
      permissions: this.getRoleCapabilities(role)
    };
  }

  private generateInvitationToken(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private async getInviterName(userId: string): Promise<string> {
    try {
const { data, error } = await assertSupabase()
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .single();

      return data ? `${data.first_name} ${data.last_name}` : 'Someone';
    } catch (error) {
      return 'Someone';
    }
  }

  private async sendInvitationEmail(email: string, data: any): Promise<void> {
    // TODO: Implement email service integration
    // For now, just log the invitation
    console.log(`Invitation email would be sent to: ${email}`, data);
  }

  private async getClientIP(): Promise<string> {
    // In a real app, this would get the actual client IP
    return '127.0.0.1';
  }

  private async getUserAgent(): Promise<string> {
    // In a real app, this would get the actual user agent
    return 'EduDash-Mobile/1.0';
  }

  private getNextStepAfterError(error: AuthError): AuthFlowStep | undefined {
    switch (error.code) {
      case 'EMAIL_NOT_CONFIRMED':
        return 'email_verification';
      case 'VALIDATION_ERROR':
        return 'personal_info';
      case 'INVITATION_REQUIRED':
        return 'role_selection';
      default:
        return undefined;
    }
  }
}

// Export singleton instance
export const enhancedAuthService = new EnhancedAuthService();