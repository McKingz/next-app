import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import MarketingLanding from '@/components/marketing/MarketingLanding';

/**
 * Root index route - shows marketing landing for unauthenticated users,
 * redirects authenticated users to their dashboard
 */
export default function Index() {
  const { session, loading } = useAuth();

  useEffect(() => {
    // Only redirect if auth is loaded and user is authenticated
    if (!loading && session) {
      console.log('[Index] User is authenticated, redirecting to profiles-gate');
      router.replace('/profiles-gate');
    }
  }, [session, loading]);

  // Show landing page for unauthenticated users or while loading
  return <MarketingLanding />;
}
