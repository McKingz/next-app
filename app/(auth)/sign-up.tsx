import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function SignUpAlias() {
  const params = useLocalSearchParams<{ planTier?: string; billing?: 'monthly' | 'annual' }>();

  useEffect(() => {
    // Forward plan context to sign-in so it can be preserved through auth
    const nextParams: any = {};
    if (params?.planTier) nextParams.planTier = String(params.planTier);
    if (params?.billing) nextParams.billing = params.billing === 'annual' ? 'annual' : 'monthly';

    router.replace({ pathname: '/(auth)/sign-in' as any, params: nextParams } as any);
  }, [params?.planTier, params?.billing]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' }}>
      <ActivityIndicator color="#00f5ff" />
    </View>
  );
}
