/**
 * SuperAdmin Dashboard Loading Handler
 * 
 * Provides enhanced loading state management specifically for superadmin users
 * with retry logic and session validation to prevent infinite loading states.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

interface SuperAdminLoadingHandlerProps {
  children: React.ReactNode;
  timeout?: number; // ms - how long to wait before showing retry options
}

export const SuperAdminLoadingHandler: React.FC<SuperAdminLoadingHandlerProps> = ({
  children,
  timeout = 8000, // 8 seconds
}) => {
  const { profile, loading, profileLoading, refreshProfile, user, session } = useAuth();
  const [showRetryOptions, setShowRetryOptions] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if we should show loading state
  const shouldShowLoading = loading || profileLoading || (!profile && user);

  // Reset retry options when loading stops or profile loads
  useEffect(() => {
    if (!shouldShowLoading || profile) {
      setShowRetryOptions(false);
      setRetryCount(0);
    }
  }, [shouldShowLoading, profile]);

  // Set up timeout to show retry options
  useEffect(() => {
    if (!shouldShowLoading) return;

    const timeoutId = setTimeout(() => {
      if (shouldShowLoading && !profile) {
        setShowRetryOptions(true);
        track('superadmin.loading_timeout', {
          timeout_duration: timeout,
          has_user: !!user,
          has_session: !!session,
          retry_count: retryCount,
        });
      }
    }, timeout);

    return () => clearTimeout(timeoutId);
  }, [shouldShowLoading, profile, timeout, user, session, retryCount]);

  // Manual retry function
  const handleRetry = useCallback(async () => {
    setIsRefreshing(true);
    setRetryCount(prev => prev + 1);
    
    try {
      // Track retry attempt
      track('superadmin.manual_retry', {
        retry_count: retryCount + 1,
        has_session: !!session,
        timestamp: new Date().toISOString(),
      });

      // Try to refresh the session first
      const { error: sessionError } = await assertSupabase().auth.refreshSession();
      if (sessionError) {
        console.warn('Session refresh failed during retry:', sessionError);
      }

      // Wait a moment for session to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Then refresh profile
      await refreshProfile();
    } catch (error) {
      console.error('Manual retry failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProfile, retryCount, session]);

  // Force redirect to sign-in if session is completely invalid
  const handleForceSignOut = useCallback(async () => {
    try {
      track('superadmin.force_signout', {
        retry_count: retryCount,
        reason: 'manual_user_action',
      });

      // Import router dynamically to avoid circular dependencies
      const { router } = await import('expo-router');
      const { signOut } = await import('@/lib/sessionManager');
      
      await signOut();
      router.replace('/sign-in');
    } catch (error) {
      console.error('Force sign out failed:', error);
      // Fallback: reload the page
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  }, [retryCount]);

  // If not loading, render children
  if (!shouldShowLoading && profile) {
    return <>{children}</>;
  }

  // If loading but no retry options yet, show standard loading
  if (!showRetryOptions) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00f5ff" />
        <Text style={styles.loadingText}>Loading admin profile...</Text>
      </View>
    );
  }

  // Show enhanced loading with retry options
  return (
    <View style={styles.container}>
      <View style={styles.loadingContainer}>
        {isRefreshing ? (
          <>
            <ActivityIndicator size="large" color="#00f5ff" />
            <Text style={styles.loadingText}>Retrying...</Text>
          </>
        ) : (
          <>
            <Ionicons name="warning-outline" size={48} color="#f59e0b" />
            <Text style={styles.timeoutTitle}>Loading is taking longer than expected</Text>
            <Text style={styles.timeoutMessage}>
              This might be due to a connection issue or session timeout.
            </Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.retryButton]} 
                onPress={handleRetry}
                disabled={isRefreshing}
              >
                <Ionicons name="refresh" size={20} color="#ffffff" />
                <Text style={styles.buttonText}>
                  {retryCount > 0 ? `Retry (${retryCount})` : 'Retry'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.signOutButton]} 
                onPress={handleForceSignOut}
                disabled={isRefreshing}
              >
                <Ionicons name="log-out" size={20} color="#ffffff" />
                <Text style={styles.buttonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
            
            {retryCount > 2 && (
              <Text style={styles.helpText}>
                Still having issues? Try refreshing the page or clearing your browser cache.
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b1220',
    padding: 32,
  },
  loadingContainer: {
    alignItems: 'center',
    maxWidth: 400,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  timeoutTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  timeoutMessage: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryButton: {
    backgroundColor: '#00f5ff',
  },
  signOutButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
});