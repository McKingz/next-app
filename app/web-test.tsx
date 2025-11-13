/**
 * Route alias for web: show the marketing landing page here.
 * Loads lazily and shows diagnostics if something fails.
 */

import React from 'react';
import { View, Text } from 'react-native';

export default function WebTest() {
  const [Comp, setComp] = React.useState<React.ComponentType | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        console.log('[WebTest] Lazy-loading MarketingLanding...');
        const mod = await import('@/components/marketing/MarketingLanding');
        setComp(() => mod.default || null);
        console.log('[WebTest] Landing loaded');
      } catch (e: any) {
        console.error('[WebTest] Failed to load Landing:', e);
        setErr(e?.message || String(e));
      }
    })();
  }, []);

  if (err) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f', padding: 24 }}>
        <Text style={{ color: '#ff6b6b', fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Landing failed to render</Text>
        <Text style={{ color: '#94a3b8', textAlign: 'center' }}>{err}</Text>
      </View>
    );
  }

  if (!Comp) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' }}>
        <Text style={{ color: '#00f5ff' }}>Loading landing...</Text>
      </View>
    );
  }

  return <Comp />;
}
