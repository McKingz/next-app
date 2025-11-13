import React from 'react';
import { Platform } from 'react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface SubscriptionAdGateProps {
  children: React.ReactNode;
  /**
   * Optional override for subscription readiness check.
   * Useful for testing or specific conditions.
   */
  forceReady?: boolean;
  /**
   * Optional override for tier check.
   * Useful for testing or specific conditions.
   */
  forceTier?: 'free' | 'starter' | 'premium' | 'enterprise';
}

/**
 * SubscriptionAdGate - A gating component that only renders ad-related children
 * when the user is on the free tier and ads are enabled.
 * 
 * This component respects:
 * - Subscription tier (only free tier sees ads)
 * - Platform restrictions (web excluded, Android-first in development)
 * - Environment flags (EXPO_PUBLIC_ENABLE_ADS)
 * 
 * Usage:
 * ```tsx
 * <SubscriptionAdGate>
 *   <AdBanner />
 * </SubscriptionAdGate>
 * ```
 */
export default function SubscriptionAdGate({
  children,
  forceReady,
  forceTier,
}: SubscriptionAdGateProps) {
  const { ready: subscriptionReady, tier } = useSubscription();

  // Use overrides if provided (useful for testing)
  const isReady = forceReady ?? subscriptionReady;
  const currentTier = forceTier ?? tier;

  // Gate conditions that must all be true for ads to show
  const shouldShowAds = (
    isReady && // Subscription context is ready
    currentTier === 'free' && // Only free tier users see ads
    Platform.OS !== 'web' && // Exclude web platform
    process.env.EXPO_PUBLIC_ENABLE_ADS !== '0' // Environment flag check
  );

  // Only render children (ads) if all conditions are met
  if (!shouldShowAds) {
    return null;
  }

  return <>{children}</>;
}