import { authService, LoginCredentials, RegisterCredentials, CreateInstructorCredentials, AuthResponse } from './AuthService';

/**
 * Authentication API layer
 * 
 * Provides the actual endpoint implementations that would be used in 
 * API routes or serverless functions. This abstracts the service layer
 * and provides standardized HTTP-style responses.
 */
export class AuthAPI {
  
  /**
   * POST /auth/register
   * Student self-registration endpoint
   */
  public static async register(credentials: RegisterCredentials): Promise<{
    status: number;
    data?: any;
    error?: string;
  }> {
    try {
      // Validate required fields
      const requiredFields = ['email', 'password', 'firstName', 'lastName'];
      for (const field of requiredFields) {
        if (!credentials[field as keyof RegisterCredentials]) {
          return {
            status: 400,
            error: `Missing required field: ${field}`,
          };
        }
      }

      const result = await authService.registerStudent(credentials);
      
      if (!result.success) {
        return {
          status: 400,
          error: result.error,
        };
      }

      return {
        status: result.requiresEmailVerification ? 201 : 200,
        data: {
          user: {
            id: result.data!.user.id,
            email: result.data!.user.email,
            created_at: result.data!.user.created_at,
          },
          message: result.requiresEmailVerification 
            ? 'Registration successful. Please check your email to verify your account.'
            : 'Registration and login successful.',
          requiresEmailVerification: result.requiresEmailVerification,
        },
      };
    } catch (error) {
      console.error('Registration endpoint error:', error);
      return {
        status: 500,
        error: 'Internal server error',
      };
    }
  }

  /**
   * POST /auth/login
   * User login endpoint
   */
  public static async login(credentials: LoginCredentials): Promise<{
    status: number;
    data?: any;
    error?: string;
  }> {
    try {
      // Validate required fields
      if (!credentials.email || !credentials.password) {
        return {
          status: 400,
          error: 'Email and password are required',
        };
      }

      const result = await authService.login(credentials);
      
      if (!result.success) {
        return {
          status: 401,
          error: result.error,
        };
      }

      // Get user profile for response
      const profile = authService.getCurrentProfile();
      
      return {
        status: 200,
        data: {
          user: {
            id: result.data!.user.id,
            email: result.data!.user.email,
            role: profile?.role,
            first_name: profile?.first_name,
            last_name: profile?.last_name,
          },
          session: {
            access_token: result.data!.session.access_token,
            refresh_token: result.data!.session.refresh_token,
            expires_at: result.data!.session.expires_at,
          },
          message: 'Login successful',
        },
      };
    } catch (error) {
      console.error('Login endpoint error:', error);
      return {
        status: 500,
        error: 'Internal server error',
      };
    }
  }

  /**
   * POST /auth/logout
   * User logout endpoint
   */
  public static async logout(): Promise<{
    status: number;
    data?: any;
    error?: string;
  }> {
    try {
      const result = await authService.logout();
      
      if (!result.success) {
        return {
          status: 400,
          error: result.error,
        };
      }

      return {
        status: 200,
        data: {
          message: 'Logout successful',
        },
      };
    } catch (error) {
      console.error('Logout endpoint error:', error);
      return {
        status: 500,
        error: 'Internal server error',
      };
    }
  }

  /**
   * POST /admin/users
   * Admin-only endpoint to create instructor accounts
   */
  public static async createInstructorAccount(
    credentials: CreateInstructorCredentials,
    createdBy: string
  ): Promise<{
    status: number;
    data?: any;
    error?: string;
  }> {
    try {
      // Validate required fields
      const requiredFields = ['email', 'password', 'firstName', 'lastName'];
      for (const field of requiredFields) {
        if (!credentials[field as keyof CreateInstructorCredentials]) {
          return {
            status: 400,
            error: `Missing required field: ${field}`,
          };
        }
      }

      if (!createdBy) {
        return {
          status: 400,
          error: 'Creator ID is required',
        };
      }

      const result = await authService.createInstructorAccount(credentials, createdBy);
      
      if (!result.success) {
        return {
          status: result.error?.includes('Unauthorized') ? 403 : 400,
          error: result.error,
        };
      }

      return {
        status: 201,
        data: {
          user: {
            id: result.data!.user.id,
            email: result.data!.user.email,
            created_at: result.data!.user.created_at,
          },
          message: 'Instructor account created successfully',
        },
      };
    } catch (error) {
      console.error('Instructor creation endpoint error:', error);
      return {
        status: 500,
        error: 'Internal server error',
      };
    }
  }

  /**
   * GET /auth/me
   * Get current user profile
   */
  public static async getCurrentUser(): Promise<{
    status: number;
    data?: any;
    error?: string;
  }> {
    try {
      if (!authService.isAuthenticated()) {
        return {
          status: 401,
          error: 'Not authenticated',
        };
      }

      const user = authService.getCurrentUser();
      const profile = authService.getCurrentProfile();
      const session = authService.getCurrentSession();

      return {
        status: 200,
        data: {
          user: {
            id: user!.id,
            email: user!.email,
            role: profile!.role,
            first_name: profile!.first_name,
            last_name: profile!.last_name,
            avatar_url: profile!.avatar_url,
            capabilities: profile!.capabilities || [],
            created_at: profile!.created_at,
          },
          session: {
            expires_at: session!.expires_at,
          },
        },
      };
    } catch (error) {
      console.error('Get current user endpoint error:', error);
      return {
        status: 500,
        error: 'Internal server error',
      };
    }
  }

  /**
   * POST /auth/refresh
   * Refresh authentication token
   */
  public static async refreshToken(): Promise<{
    status: number;
    data?: any;
    error?: string;
  }> {
    try {
      const result = await authService.refreshSession();
      
      if (!result.success) {
        return {
          status: 401,
          error: result.error,
        };
      }

      return {
        status: 200,
        data: {
          session: {
            access_token: result.data!.access_token,
            refresh_token: result.data!.refresh_token,
            expires_at: result.data!.expires_at,
          },
          message: 'Token refreshed successfully',
        },
      };
    } catch (error) {
      console.error('Token refresh endpoint error:', error);
      return {
        status: 500,
        error: 'Internal server error',
      };
    }
  }

  /**
   * GET /auth/session
   * Check if current session is valid
   */
  public static async checkSession(): Promise<{
    status: number;
    data?: any;
    error?: string;
  }> {
    try {
      const isAuthenticated = authService.isAuthenticated();
      const profile = authService.getCurrentProfile();
      
      if (!isAuthenticated || !profile) {
        return {
          status: 401,
          error: 'Session invalid or expired',
        };
      }

      return {
        status: 200,
        data: {
          authenticated: true,
          role: profile.role,
          permissions: profile.capabilities || [],
          expires_at: authService.getCurrentSession()?.expires_at,
        },
      };
    } catch (error) {
      console.error('Session check endpoint error:', error);
      return {
        status: 500,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Utility method to extract user from authorization header
   * This would be used in middleware to authenticate requests
   */
  public static async authenticateRequest(authHeader?: string): Promise<{
    authenticated: boolean;
    user?: any;
    profile?: any;
    error?: string;
  }> {
    try {
      if (!authHeader) {
        return {
          authenticated: false,
          error: 'No authorization header provided',
        };
      }

      // For Supabase, the token should be in the format: "Bearer <jwt_token>"
      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        return {
          authenticated: false,
          error: 'Invalid authorization header format',
        };
      }

      // The actual token validation would be done by Supabase middleware
      // This is a placeholder for the authentication logic
      const isAuthenticated = authService.isAuthenticated();
      
      if (!isAuthenticated) {
        return {
          authenticated: false,
          error: 'Invalid or expired token',
        };
      }

      return {
        authenticated: true,
        user: authService.getCurrentUser(),
        profile: authService.getCurrentProfile(),
      };
    } catch (error) {
      console.error('Request authentication error:', error);
      return {
        authenticated: false,
        error: 'Authentication failed',
      };
    }
  }
}

/**
 * Helper functions for API responses
 */
export const AuthResponseHelpers = {
  /**
   * Create standardized success response
   */
  success: (data: any, status: number = 200) => ({
    status,
    data,
  }),

  /**
   * Create standardized error response
   */
  error: (message: string, status: number = 400) => ({
    status,
    error: message,
  }),

  /**
   * Create validation error response
   */
  validationError: (field: string, message: string) => ({
    status: 400,
    error: `Validation failed for ${field}: ${message}`,
  }),

  /**
   * Create unauthorized response
   */
  unauthorized: (message: string = 'Unauthorized') => ({
    status: 401,
    error: message,
  }),

  /**
   * Create forbidden response
   */
  forbidden: (message: string = 'Forbidden') => ({
    status: 403,
    error: message,
  }),

  /**
   * Create internal server error response
   */
  internalError: (message: string = 'Internal server error') => ({
    status: 500,
    error: message,
  }),
};

/**
 * Type definitions for API responses
 */
export interface APIResponse<T = any> {
  status: number;
  data?: T;
  error?: string;
}

export interface AuthEndpointData {
  user?: {
    id: string;
    email: string;
    role?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    capabilities?: string[];
    created_at?: string;
  };
  session?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
  };
  message?: string;
  requiresEmailVerification?: boolean;
  authenticated?: boolean;
  permissions?: string[];
}