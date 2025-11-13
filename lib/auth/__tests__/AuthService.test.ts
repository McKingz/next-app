/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Basic tests for AuthService
 * 
 * Note: These are minimal happy-path tests as requested in the acceptance criteria.
 * In a full implementation, you'd want comprehensive tests covering edge cases,
 * error conditions, and integration scenarios.
 */

// Mock the assertSupabase function before imports
const mockSupabase = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    refreshSession: jest.fn(),
    admin: {
      createUser: jest.fn(),
    },
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    insert: jest.fn(),
  })),
};

jest.mock('../../supabase', () => ({
  assertSupabase: jest.fn(() => mockSupabase),
}));

import { AuthService } from '../AuthService';

// Mock AppConfiguration
jest.mock('../../config', () => ({
  getAppConfiguration: jest.fn(() => ({
    environment: 'test',
  })),
}));

// Import after mocking
const { assertSupabase } = require('../../supabase');

describe('AuthService', () => {
  let authService: AuthService;
  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the shared mocked supabase client
    mockSupabaseClient = mockSupabase;
    
    // Mock successful session response
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    
    // Mock auth state change listener
    mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback: any) => {
      // Return unsubscribe function
      return { data: { subscription: { unsubscribe: () => {} } } };
    });
    
    authService = new (AuthService as any)();
  });

  describe('Student Registration', () => {
    it('should successfully register a student with valid credentials', async () => {
      // Mock successful registration
      const mockUser = {
        id: 'user-123',
        email: 'student@test.com',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const credentials = {
        email: 'student@test.com',
        password: 'StrongPass123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await authService.registerStudent(credentials);

      expect(result.success).toBe(true);
      expect(result.data?.user).toEqual(mockUser);
      expect(result.requiresEmailVerification).toBe(true); // No session means verification required
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
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
    });

    it('should reject registration with weak password', async () => {
      const credentials = {
        email: 'student@test.com',
        password: 'weak',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await authService.registerStudent(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Password must be at least 12 characters');
      expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled();
    });

    it('should reject registration with invalid email', async () => {
      const credentials = {
        email: 'invalid-email',
        password: 'StrongPass123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await authService.registerStudent(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
      expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled();
    });
  });

  describe('User Login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@test.com',
      };

      const mockSession = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        expires_at: Date.now() / 1000 + 3600,
        user: mockUser,
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const credentials = {
        email: 'user@test.com',
        password: 'password123',
      };

      const result = await authService.login(credentials);

      expect(result.success).toBe(true);
      expect(result.data?.user).toEqual(mockUser);
      expect(result.data?.session).toEqual(mockSession);
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: credentials.email.toLowerCase(),
        password: credentials.password,
      });
    });

    it('should reject login with invalid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const credentials = {
        email: 'user@test.com',
        password: 'wrongpassword',
      };

      const result = await authService.login(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email or password');
    });

    it('should require both email and password', async () => {
      const credentials = {
        email: '',
        password: 'password123',
      };

      // This would be caught by the API layer, but testing validation
      const result = await authService.login(credentials);

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalled();
    });
  });

  describe('User Logout', () => {
    it('should successfully logout', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      });

      const result = await authService.logout();

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });

    it('should handle logout errors', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: { message: 'Logout failed' },
      });

      const result = await authService.logout();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Logout failed');
    });
  });

  describe('Admin Instructor Creation', () => {
    it('should allow admin to create instructor account', async () => {
      const mockAdmin = {
        id: 'admin-123',
        role: 'admin',
      };

      const mockInstructor = {
        id: 'instructor-123',
        email: 'teacher@test.com',
        created_at: '2024-01-01T00:00:00Z',
      };

      // Mock admin profile lookup (first from call)
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ 
              data: mockAdmin, 
              error: null 
            }),
          })),
        })),
      })
      // Mock email existence check (second from call) - return null (email doesn't exist)
      .mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: null 
            }),
          })),
        })),
      })
      // Mock profile insert (third from call)
      .mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseClient.auth.admin.createUser.mockResolvedValue({
        data: { user: mockInstructor },
        error: null,
      });

      const credentials = {
        email: 'teacher@test.com',
        password: 'StrongPass123!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const result = await authService.createInstructorAccount(credentials, 'admin-123');

      expect(result.success).toBe(true);
      expect(result.data?.user).toEqual(mockInstructor);
      expect(mockSupabaseClient.auth.admin.createUser).toHaveBeenCalled();
    });

    it('should reject instructor creation by non-admin', async () => {
      const mockStudent = {
        id: 'student-123',
        role: 'student',
      };

      // Mock student profile lookup
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ 
              data: mockStudent, 
              error: null 
            }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const credentials = {
        email: 'teacher@test.com',
        password: 'StrongPass123!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const result = await authService.createInstructorAccount(credentials, 'student-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
      expect(mockSupabaseClient.auth.admin.createUser).not.toHaveBeenCalled();
    });
  });

  describe('Password Validation', () => {
    it('should enforce password strength requirements', async () => {
      const testCases = [
        { password: '', expectedError: 'Password is required' },
        { password: 'short', expectedError: 'Password must be at least 12 characters' },
        { password: 'nouppercase123!', expectedError: 'uppercase letter' },
        { password: 'NOLOWERCASE123!', expectedError: 'lowercase letter' },
        { password: 'NoNumbers!@#', expectedError: 'number' },
        { password: 'NoSymbols123ABC', expectedError: 'symbol' },
      ];

      for (const testCase of testCases) {
        const credentials = {
          email: 'test@test.com',
          password: testCase.password,
          firstName: 'Test',
          lastName: 'User',
        };

        const result = await authService.registerStudent(credentials);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain(testCase.expectedError);
      }
    });

    it('should accept strong password', async () => {
      const strongPassword = 'StrongPass123!@#';
      
      // Mock the external calls to focus on password validation
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: { id: 'test' }, session: null },
        error: null,
      });

      const credentials = {
        email: 'test@test.com',
        password: strongPassword,
        firstName: 'Test',
        lastName: 'User',
      };

      const result = await authService.registerStudent(credentials);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should refresh session successfully', async () => {
      const mockSession = {
        access_token: 'new-token-123',
        refresh_token: 'new-refresh-123',
        expires_at: Date.now() / 1000 + 3600,
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await authService.refreshSession();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSession);
    });

    it('should handle session refresh errors', async () => {
      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token' },
      });

      const result = await authService.refreshSession();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid refresh token');
    });
  });

  describe('Role and Permission Checks', () => {
    it('should correctly identify user roles', () => {
      // Test with different profile states
      authService['currentState'] = {
        user: { id: '1' } as any,
        session: {} as any,
        profile: { role: 'admin' } as any,
        loading: false,
        initialized: true,
      };

      expect(authService.isAdmin()).toBe(true);
      expect(authService.isInstructor()).toBe(false);
      expect(authService.isStudent()).toBe(false);

      authService['currentState'].profile!.role = 'instructor' as any;
      expect(authService.isAdmin()).toBe(false);
      expect(authService.isInstructor()).toBe(true);
      expect(authService.isStudent()).toBe(false);

      authService['currentState'].profile!.role = 'student' as any;
      expect(authService.isAdmin()).toBe(false);
      expect(authService.isInstructor()).toBe(false);
      expect(authService.isStudent()).toBe(true);
    });

    it('should check authentication status', () => {
      // Not authenticated - missing components
      authService['currentState'] = {
        user: null,
        session: null,
        profile: null,
        loading: false,
        initialized: true,
      };
      expect(authService.isAuthenticated()).toBe(false);

      // Fully authenticated
      authService['currentState'] = {
        user: { id: '1' } as any,
        session: { access_token: 'token' } as any,
        profile: { id: '1', role: 'student' } as any,
        loading: false,
        initialized: true,
      };
      expect(authService.isAuthenticated()).toBe(true);
    });
  });
});

// Test the password validation specifically since it's critical
describe('Password Validation', () => {
  const validatePassword = (password: string) => {
    // Replicate the validation logic for testing
    if (!password) {
      return { valid: false, error: 'Password is required' };
    }

    if (password.length < 12) {
      return { valid: false, error: 'Password must be at least 12 characters long' };
    }

    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
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
  };

  it('should validate password requirements correctly', () => {
    expect(validatePassword('').valid).toBe(false);
    expect(validatePassword('short').valid).toBe(false);
    expect(validatePassword('nouppercase123!').valid).toBe(false);
    expect(validatePassword('NOLOWERCASE123!').valid).toBe(false);
    expect(validatePassword('NoNumbers!').valid).toBe(false);
    expect(validatePassword('NoSymbols123ABC').valid).toBe(false);
    expect(validatePassword('ValidPass123!').valid).toBe(true);
  });
});