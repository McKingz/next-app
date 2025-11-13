import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// Optional RevenueCat integration with graceful fallback when SDK not installed
export default function ManageSubscriptionScreen() {
  const [loading, setLoading] = useState(true);
  const [rcAvailable, setRcAvailable] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Try to require RevenueCat SDK
        const Purchases = require('react-native-purchases');
        setRcAvailable(true);
        // Configure if not already configured (no-op if already set)
        // Support multiple env var names for convenience
        const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_SDK_KEY
          || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_PUBLIC_KEY
          || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
        const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_SDK_KEY
          || process.env.EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_KEY
          || process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
        const key = Platform.OS === 'ios' ? iosKey : androidKey;
        if (!key) {
          setLoading(false);
          return;
        }
        try { Purchases.configure({ apiKey: key }); } catch { /* Intentional: non-fatal */ }
        const info = await Purchases.getCustomerInfo();
        if (active) setCustomerInfo(info);
      } catch {
        setRcAvailable(false);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Manage Subscription' }} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator />
          ) : rcAvailable ? (
            customerInfo ? (
              <>
                <Text style={styles.title}>Current Entitlements</Text>
                <Text style={styles.text}>{JSON.stringify(customerInfo?.entitlements?.active || {}, null, 2)}</Text>
                <TouchableOpacity style={styles.btn} onPress={async () => {
                  try {
                    const Purchases = require('react-native-purchases');
                    await Purchases.presentCodeRedemptionSheet?.();
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || 'Unable to manage subscription');
                  }
                }}>
                  <Text style={styles.btnText}>Open subscription management</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.title}>RevenueCat configured</Text>
                <Text style={styles.text}>No entitlements found yet.</Text>
              </>
            )
          ) : (
            <>
              <Text style={styles.title}>RevenueCat not installed</Text>
              <Text style={styles.text}>
                To enable in-app subscriptions, add the RevenueCat SDK and set EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  content: { padding: 16 },
  title: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  text: { color: '#9CA3AF' },
  btn: { backgroundColor: '#00f5ff', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#000', fontWeight: '700' },
});
