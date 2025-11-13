// Route file to handle edudashpro://subscription-upgrade deep link
// This redirects to the actual subscription upgrade screen

import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

export default function SubscriptionUpgradeRedirect() {
  const params = useLocalSearchParams();

  useEffect(() => {
    // Redirect to the actual subscription upgrade screen with all params preserved
    router.replace({
      pathname: '/screens/subscription-upgrade-post',
      params: params as any
    });
  }, [params]);

  // Return null since this is just a redirect
  return null;
}