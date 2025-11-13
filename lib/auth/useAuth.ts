import { useState, useEffect, useCallback } from 'react';
import { authService, AuthState, LoginCredentials, RegisterCredentials } from './AuthService';

/**
 * Primary authentication hook
 * Provides authentication state and methods for React components
 */
export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>(() => authService.getState());

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authService.subscribe((newState) => {
      setAuthState(newState);
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  // Memoized authentication methods
  const login = useCallback(async (credentials: LoginCredentials) => {
    return await authService.login(credentials);
  }, []);

  const registerStudent = useCallback(async (credentials: RegisterCredentials) => {
    return await authService.registerStudent(credentials);
  }, []);

  const logout = useCallback(async () => {
    return await authService.logout();
  }, []);

  const refreshSession = useCallback(async () => {
    return await authService.refreshSession();
  }, []);

  // Computed properties
  const isAuthenticated = authState.user !== null && authState.session !== null && authState.profile !== null;
  const isLoading = authState.loading;
  const isInitialized = authState.initialized;

  return {
    // State
    user: authState.user,
    session: authState.session,
    profile: authState.profile,
    loading: isLoading,
    initialized: isInitialized,
    authenticated: isAuthenticated,

    // Role helpers
    isAdmin: authState.profile?.role === 'admin',
    isInstructor: authState.profile?.role === 'instructor',
    isStudent: authState.profile?.role === 'student',
    role: authState.profile?.role,

    // Methods
    login,
    registerStudent,
    logout,
    refreshSession,

    // Utility methods
    hasRole: (role: string) => authState.profile?.role === role,
    hasCapability: (capability: string) => 
      authState.profile?.capabilities?.includes(capability) ?? false,
  };
};

/**
 * Hook for login functionality
 * Provides login state and methods with loading states
 */
export const useLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.login(credentials);
      
      if (!result.success) {
        setError(result.error || 'Login failed');
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data };
    } catch (err) {
      const errorMessage = 'Login failed due to an unexpected error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    login,
    isLoading,
    error,
    clearError,
  };
};

/**
 * Hook for registration functionality
 * Provides registration state and methods with loading states
 */
export const useRegister = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.registerStudent(credentials);
      
      if (!result.success) {
        setError(result.error || 'Registration failed');
        return { success: false, error: result.error };
      }

      return { 
        success: true, 
        data: result.data,
        requiresEmailVerification: result.requiresEmailVerification 
      };
    } catch (err) {
      const errorMessage = 'Registration failed due to an unexpected error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    register,
    isLoading,
    error,
    clearError,
  };
};

/**
 * Hook for logout functionality
 * Provides logout method with loading state
 */
export const useLogout = () => {
  const [isLoading, setIsLoading] = useState(false);

  const logout = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const result = await authService.logout();
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    logout,
    isLoading,
  };
};

/**
 * Hook for session management
 * Provides session refresh and validation methods
 */
export const useSession = () => {
  const { session, authenticated } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshSession = useCallback(async () => {
    setIsRefreshing(true);
    
    try {
      const result = await authService.refreshSession();
      return result;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const isSessionExpired = useCallback(() => {
    if (!session?.expires_at) return true;
    return Date.now() / 1000 > session.expires_at;
  }, [session]);

  const timeUntilExpiry = useCallback(() => {
    if (!session?.expires_at) return 0;
    return Math.max(0, session.expires_at - Date.now() / 1000);
  }, [session]);

  return {
    session,
    authenticated,
    isRefreshing,
    isSessionExpired: isSessionExpired(),
    timeUntilExpiry: timeUntilExpiry(),
    refreshSession,
  };
};

/**
 * Hook for role-based access control
 * Provides utilities for checking permissions and roles
 */
export const usePermissions = () => {
  const { profile, authenticated } = useAuth();

  const hasRole = useCallback((role: string) => {
    return authenticated && profile?.role === role;
  }, [authenticated, profile?.role]);

  const hasAnyRole = useCallback((roles: string[]) => {
    return authenticated && profile?.role && roles.includes(profile.role);
  }, [authenticated, profile?.role]);

  const hasCapability = useCallback((capability: string) => {
    return authenticated && profile?.capabilities?.includes(capability) === true;
  }, [authenticated, profile?.capabilities]);

  const hasAnyCapability = useCallback((capabilities: string[]) => {
    return authenticated && capabilities.some(cap => 
      profile?.capabilities?.includes(cap) === true
    );
  }, [authenticated, profile?.capabilities]);

  const hasAllCapabilities = useCallback((capabilities: string[]) => {
    return authenticated && capabilities.every(cap => 
      profile?.capabilities?.includes(cap) === true
    );
  }, [authenticated, profile?.capabilities]);

  return {
    // Role checks
    isAdmin: hasRole('admin'),
    isInstructor: hasRole('instructor'),
    isStudent: hasRole('student'),
    
    // Permission checks
    hasRole,
    hasAnyRole,
    hasCapability,
    hasAnyCapability,
    hasAllCapabilities,
    
    // Current user info
    currentRole: profile?.role,
    capabilities: profile?.capabilities || [],
    authenticated,
  };
};

/**
 * Hook for authentication status with loading and error states
 * Useful for app initialization and route guards
 */
export const useAuthStatus = () => {
  const { loading, initialized, authenticated, profile } = useAuth();

  return {
    isLoading: loading,
    isInitialized: initialized,
    isAuthenticated: authenticated,
    isReady: initialized && !loading,
    role: profile?.role,
    
    // Convenience getters for common states
    canProceed: initialized && !loading,
    needsAuth: initialized && !loading && !authenticated,
    hasAuth: initialized && !loading && authenticated,
  };
};

/**
 * Hook for automatic session refresh
 * Automatically refreshes session when it's about to expire
 */
export const useAutoRefresh = (refreshThreshold: number = 300) => { // 5 minutes default
  const { session } = useSession();
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  useEffect(() => {
    if (!session?.expires_at) return;

    const timeUntilExpiry = session.expires_at - Date.now() / 1000;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    
    if (timeUntilExpiry <= refreshThreshold && timeUntilExpiry > 0) {
      refreshTimer = setTimeout(async () => {
        setIsAutoRefreshing(true);
        try {
          await authService.refreshSession();
        } catch (error) {
          console.error('Auto refresh failed:', error);
        } finally {
          setIsAutoRefreshing(false);
        }
      }, Math.max(0, (timeUntilExpiry - refreshThreshold) * 1000));
    }

    // Always return cleanup function to prevent memory leaks
    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [session?.expires_at, refreshThreshold]);

  return {
    isAutoRefreshing,
    session,
  };
};

/**
 * Type exports for TypeScript usage
 */
export type {
  AuthState,
  LoginCredentials,
  RegisterCredentials,
  UserProfile,
} from './AuthService';