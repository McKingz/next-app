import { User, Session, AuthError } from '@supabase/supabase-js';
import { assertSupabase } from '../supabase';
import { getAppConfiguration } from '../config';
import { RoleId, ROLES } from '../rbac/types';

// Types for authentication
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'student'; // Only students can self-register
}

export interface CreateInstructorCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
}

export interface AuthResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  requiresEmailVerification?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  role: RoleId;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  capabilities?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
}

/**
 * Comprehensive Authentication Service for EduDash Pro
 * 
 * Features:
 * - Secure registration and login
 * - Role-based account creation
 * - Session management with security logging
 * - Password strength validation
 * - Email verification support
 * - Admin-only instructor creation
 */
export class AuthService {
  private supabase = assertSupabase();
  private listeners: Array<(state: AuthState) => void> = [];
  private currentState: AuthState = {
    user: null,
    session: null,
    profile: null,
    loading: true,
    initialized: false,
  };

  constructor() {
    this.initializeAuth();
  }

  /**
   * Initialize authentication state and listen for changes
   */
  private async initializeAuth(): Promise<void> {
    try {
      // Get current session
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.error('Failed to get session:', error);
      } else if (session) {
        // Load user profile
        const profile = await this.loadUserProfile(session.user.id);
        this.updateState({
          user: session.user,
          session,
          profile,
          loading: false,
          initialized: true,
        });
      } else {
        this.updateState({
          user: null,
          session: null,
          profile: null,
          loading: false,
          initialized: true,
        });
      }

      // Listen for auth state changes
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[AuthService] Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session) {
          const profile = await this.loadUserProfile(session.user.id);
          this.updateState({
            user: session.user,
            session,
            profile,
            loading: false,
            initialized: true,
          });
          
          // Record login success
          this.recordSecurityEvent(session.user.id, 'login_success', 'Authentication successful');
          
        } else if (event === 'SIGNED_OUT') {
          this.updateState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            initialized: true,
          });
        }
      });

    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.updateState({
        user: null,
        session: null,
        profile: null,
        loading: false,
        initialized: true,
      });
    }
  }

  /**
   * Update internal state and notify listeners
   */
  private updateState(newState: Partial<AuthState>): void {
    this.currentState = { ...this.currentState, ...newState };
    this.listeners.forEach(listener => listener(this.currentState));
  }

  /**
   * Subscribe to auth state changes
   */
  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    
    // Immediately call with current state
    listener(this.currentState);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current auth state
   */
  public getState(): AuthState {
    return { ...this.currentState };
  }

  /**
   * Student registration (self-service)
   */
  public async registerStudent(credentials: RegisterCredentials): Promise<AuthResponse<{ user: User; requiresVerification: boolean }>> {
    try {
      // Validate password strength
      const passwordValidation = this.validatePassword(credentials.password);
      if (!passwordValidation.valid) {
        return {
          success: false,
          error: passwordValidation.error,
        };
      }

      // Validate email format
      if (!this.isValidEmail(credentials.email)) {
        return {
          success: false,
          error: 'Please enter a valid email address',
        };
      }

      // Check if email already exists
      const { data: existingUser } = await this.supabase
        .from('profiles')
        .select('email')
        .eq('email', credentials.email.toLowerCase())
        .single();

      if (existingUser) {
        return {
          success: false,
          error: 'An account with this email already exists',
        };
      }

      // Create Supabase user
      const { data, error } = await this.supabase.auth.signUp({
        email: credentials.email.toLowerCase(),
        password: credentials.password,
        options: {
          emailRedirectTo: 'https://www.edudashpro.org.za/landing?flow=email-confirm',
          data: {
            first_name: credentials.firstName,
            last_name: credentials.lastName,
            role: 'student',
          },
        },
      });

      if (error) {
        // Record failed registration
        this.recordSecurityEvent(null, 'registration_failed', error.message);
        return {
          success: false,
          error: this.getFriendlyErrorMessage(error),
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: 'Registration failed - user not created',
        };
      }

      // Create profile record
      const { error: profileError } = await this.supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: credentials.email.toLowerCase(),
          first_name: credentials.firstName,
          last_name: credentials.lastName,
          role: 'student',
          capabilities: [
            'access_mobile_app',
            'view_assignments',
            'submit_assignments',
            'view_grades',
            'view_courses'
          ],
          metadata: {
            registration_method: 'self_service',
            account_type: 'student',
            created_via: 'mobile_app',
          },
        });

      if (profileError) {
        console.error('Profile creation failed:', profileError);
        // Don't return error as user is created, profile can be fixed later
      }

      // Record successful registration
      this.recordSecurityEvent(data.user.id, 'registration_success', 'Student account created');

      return {
        success: true,
        data: {
          user: data.user,
          requiresVerification: !data.session, // No session means email verification required
        },
        requiresEmailVerification: !data.session,
      };

    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Registration failed due to an unexpected error',
      };
    }
  }

  /**
   * User login
   */
  public async login(credentials: LoginCredentials): Promise<AuthResponse<{ user: User; session: Session }>> {
    try {
      // Record login attempt
      this.recordSecurityEvent(null, 'login_attempt', `Login attempt for ${credentials.email}`);

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email.toLowerCase(),
        password: credentials.password,
      });

      if (error) {
        // Record failed login
        this.recordSecurityEvent(null, 'login_failed', error.message);
        return {
          success: false,
          error: this.getFriendlyErrorMessage(error),
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: 'Login failed - invalid response',
        };
      }

      return {
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed due to an unexpected error',
      };
    }
  }

  /**
   * Create instructor account (Admin only)
   */
  public async createInstructorAccount(
    credentials: CreateInstructorCredentials,
    createdBy: string
  ): Promise<AuthResponse<{ user: User }>> {
    try {
      // Validate that creator is admin
      const creatorProfile = await this.loadUserProfile(createdBy);
      if (!creatorProfile || creatorProfile.role !== 'admin') {
        return {
          success: false,
          error: 'Unauthorized - only administrators can create instructor accounts',
        };
      }

      // Validate password strength
      const passwordValidation = this.validatePassword(credentials.password);
      if (!passwordValidation.valid) {
        return {
          success: false,
          error: passwordValidation.error,
        };
      }

      // Check if email already exists
      const { data: existingUser } = await this.supabase
        .from('profiles')
        .select('email')
        .eq('email', credentials.email.toLowerCase())
        .single();

      if (existingUser) {
        return {
          success: false,
          error: 'An account with this email already exists',
        };
      }

      // Create Supabase user using service role (admin operation)
      const { data, error } = await this.supabase.auth.admin.createUser({
        email: credentials.email.toLowerCase(),
        password: credentials.password,
        email_confirm: true, // Skip email verification for admin-created accounts
        user_metadata: {
          first_name: credentials.firstName,
          last_name: credentials.lastName,
          role: 'instructor',
          created_by: createdBy,
        },
      });

      if (error) {
        this.recordSecurityEvent(createdBy, 'instructor_creation_failed', error.message);
        return {
          success: false,
          error: this.getFriendlyErrorMessage(error),
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: 'Account creation failed - user not created',
        };
      }

      // Create profile record
      const { error: profileError } = await this.supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: credentials.email.toLowerCase(),
          first_name: credentials.firstName,
          last_name: credentials.lastName,
          role: 'instructor',
          capabilities: [
            'access_mobile_app',
            'manage_classes',
            'create_assignments',
            'grade_assignments',
            'view_student_progress',
            'manage_courses',
            'manage_enrollments'
          ],
          metadata: {
            registration_method: 'admin_created',
            account_type: 'instructor',
            created_by: createdBy,
            organization_id: credentials.organizationId,
          },
        });

      if (profileError) {
        console.error('Instructor profile creation failed:', profileError);
      }

      // Record successful creation
      this.recordSecurityEvent(createdBy, 'instructor_created', `Instructor account created for ${credentials.email}`);

      return {
        success: true,
        data: {
          user: data.user,
        },
      };

    } catch (error) {
      console.error('Instructor creation error:', error);
      return {
        success: false,
        error: 'Account creation failed due to an unexpected error',
      };
    }
  }

  /**
   * User logout
   */
  public async logout(): Promise<AuthResponse<void>> {
    try {
      const currentUserId = this.currentState.user?.id;
      
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        return {
          success: false,
          error: this.getFriendlyErrorMessage(error),
        };
      }

      // Record logout
      if (currentUserId) {
        this.recordSecurityEvent(currentUserId, 'logout', 'User logged out');
      }

      return {
        success: true,
      };

    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: 'Logout failed due to an unexpected error',
      };
    }
  }

  /**
   * Load user profile from database
   */
  private async loadUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Failed to load user profile:', error);
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      console.error('Profile loading error:', error);
      return null;
    }
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password) {
      return { valid: false, error: 'Password is required' };
    }

    if (password.length < 12) {
      return { valid: false, error: 'Password must be at least 12 characters long' };
    }

    // Check for required character types
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    // ASCII punctuation ranges to detect symbols reliably without unnecessary escapes
    const hasSymbols = /[!-/:-@[-`{-~]/.test(password);

    if (!hasLowerCase) {
      return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }

    if (!hasUpperCase) {
      return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }

    if (!hasNumbers) {
      return { valid: false, error: 'Password must contain at least one number' };
    }

    if (!hasSymbols) {
      return { valid: false, error: 'Password must contain at least one symbol' };
    }

    return { valid: true };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Convert Supabase errors to user-friendly messages
   */
  private getFriendlyErrorMessage(error: AuthError): string {
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Invalid email or password. Please check your credentials and try again.';
      case 'Email not confirmed':
        return 'Please check your email and click the confirmation link before signing in.';
      case 'User already registered':
        return 'An account with this email already exists. Try signing in instead.';
      case 'Password should be at least 6 characters':
        return 'Password must be at least 12 characters long for security.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Record security events for audit trail
   */
  private async recordSecurityEvent(
    userId: string | null,
    eventType: string,
    description: string
  ): Promise<void> {
    try {
      // Only record if we have the security system set up
      const { error } = await this.supabase
        .from('security_events')
        .insert({
          user_id: userId,
          event_type: eventType,
          event_category: 'authentication',
          severity: eventType.includes('failed') ? 'warning' : 'info',
          description,
          ip_address: null, // Will be populated by database trigger if available
          user_agent: null, // Will be populated by database trigger if available
          success: !eventType.includes('failed'),
          metadata: {
            timestamp: new Date().toISOString(),
app_version: getAppConfiguration().environment,
          },
        });

      if (error && !error.message.includes('relation "security_events" does not exist')) {
        console.error('Failed to record security event:', error);
      }
    } catch (error) {
      // Silently fail - security events are nice to have but not critical
      console.debug('Security event recording skipped:', error);
    }
  }

  /**
   * Refresh current session
   */
  public async refreshSession(): Promise<AuthResponse<Session>> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();
      
      if (error) {
        return {
          success: false,
          error: this.getFriendlyErrorMessage(error),
        };
      }

      return {
        success: true,
        data: data.session!,
      };
    } catch (error) {
      console.error('Session refresh error:', error);
      return {
        success: false,
        error: 'Failed to refresh session',
      };
    }
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!(this.currentState.user && this.currentState.session && this.currentState.profile);
  }

  /**
   * Check if user has specific role
   */
  public hasRole(role: RoleId): boolean {
    return this.currentState.profile?.role === role;
  }

  /**
   * Check if user is admin
   */
  public isAdmin(): boolean {
    return this.hasRole(ROLES.ADMIN);
  }

  /**
   * Check if user is instructor
   */
  public isInstructor(): boolean {
    return this.hasRole(ROLES.INSTRUCTOR);
  }

  /**
   * Check if user is student
   */
  public isStudent(): boolean {
    return this.hasRole(ROLES.STUDENT);
  }

  /**
   * Get current user profile
   */
  public getCurrentProfile(): UserProfile | null {
    return this.currentState.profile;
  }

  /**
   * Get current user
   */
  public getCurrentUser(): User | null {
    return this.currentState.user;
  }

  /**
   * Get current session
   */
  public getCurrentSession(): Session | null {
    return this.currentState.session;
  }
}

// Singleton instance
export const authService = new AuthService();