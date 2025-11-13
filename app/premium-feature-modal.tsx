import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PremiumFeatureBanner from '@/components/ui/PremiumFeatureBanner';

/**
 * Premium Feature Modal Screen
 * 
 * This modal screen shows when users try to access premium-only features.
 * It displays the PremiumFeatureBanner in fullscreen mode with upgrade options.
 */
export default function PremiumFeatureModal() {
  const params = useLocalSearchParams<{
    featureName?: string;
    description?: string;
    screen?: string;
    icon?: string;
  }>();

  return (
    <PremiumFeatureBanner
      featureName={params.featureName || 'Premium Feature'}
      description={params.description || 'This feature requires a premium subscription.'}
      screen={params.screen || 'unknown'}
      icon={(params.icon as any) || 'star'}
      variant="fullscreen"
    />
  );
}