import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEnhancedUserProfile, type EnhancedUserProfile } from '@/lib/rbac';
import { detectRoleAndSchool, routeAfterLogin } from '@/lib/routeAfterLogin';

export default function DebugUser() {
  const { user, profile } = useAuth();
  const [enhancedProfile, setEnhancedProfile] = useState<EnhancedUserProfile | null>(null);
  const [legacyRole, setLegacyRole] = useState<{ role: string | null; school: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDebugData();
  }, [user, loadDebugData]);

  const loadDebugData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Get legacy role detection
      const legacy = await detectRoleAndSchool(user);
      setLegacyRole(legacy);

      // Get enhanced profile
      const enhanced = await fetchEnhancedUserProfile(user.id);
      setEnhancedProfile(enhanced);
    } catch (error) {
      console.error('Debug data loading failed:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const testRouting = async () => {
    try {
      await routeAfterLogin(user, enhancedProfile);
    } catch (error) {
      console.error('Test routing failed:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Debug User Info' }} />
        <Text style={styles.loadingText}>Loading debug info...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Debug User Info', headerShown: true }} />
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Auth Info</Text>
          <Text style={styles.text}>ID: {user?.id || 'null'}</Text>
          <Text style={styles.text}>Email: {user?.email || 'null'}</Text>
          <Text style={styles.text}>User Metadata: {JSON.stringify(user?.user_metadata, null, 2)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auth Context Profile</Text>
          <Text style={styles.text}>{JSON.stringify(profile, null, 2)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legacy Role Detection</Text>
          <Text style={styles.text}>Role: {legacyRole?.role || 'null'}</Text>
          <Text style={styles.text}>School: {legacyRole?.school || 'null'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enhanced Profile</Text>
          {enhancedProfile ? (
            <>
              <Text style={styles.text}>Role: {enhancedProfile.role || 'null'}</Text>
              <Text style={styles.text}>Organization ID: {enhancedProfile.organization_id || 'null'}</Text>
              <Text style={styles.text}>Seat Status: {enhancedProfile.seat_status || 'null'}</Text>
              <Text style={styles.text}>Has Mobile Access: {enhancedProfile.hasCapability('access_mobile_app') ? 'Yes' : 'No'}</Text>
              <Text style={styles.text}>Capabilities: {JSON.stringify(enhancedProfile.capabilities, null, 2)}</Text>
            </>
          ) : (
            <Text style={styles.text}>No enhanced profile found</Text>
          )}
        </View>

        <TouchableOpacity style={styles.button} onPress={testRouting}>
          <Text style={styles.buttonText}>Test Routing Logic</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => router.push('/screens/parent-dashboard')}>
          <Text style={styles.buttonText}>Direct to Parent Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00f5ff',
    marginBottom: 8,
  },
  text: {
    fontSize: 12,
    color: '#ffffff',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 100,
  },
  button: {
    backgroundColor: '#00f5ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
