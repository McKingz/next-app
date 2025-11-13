import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { assertSupabase } from '@/lib/supabase';

export default function OnboardingCompleteScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { state, resetOnboarding } = useOnboarding();
  const [isUpdating, setIsUpdating] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    updateProfileWithOnboardingData();
  }, []);

  const updateProfileWithOnboardingData = async () => {
    if (!user?.id) {
      setError('No user found');
      setIsUpdating(false);
      return;
    }

    try {
      // Update profile with onboarding data
      const { error: updateError } = await assertSupabase()
        .from('profiles')
        .update({
          date_of_birth: state.dateOfBirth?.toISOString().split('T')[0],
          // Note: age_group will be auto-computed by trigger
          // guardian_profile_id will be set when guardian accepts invite
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Clear onboarding state
      await resetOnboarding();

      setIsUpdating(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to save profile data');
      setIsUpdating(false);
    }
  };

  const handleGetStarted = () => {
    // Navigate based on role
    if (state.role === 'teacher' || state.role === 'parent') {
      router.replace('/(parent)');
    } else {
      router.replace('/screens/parent-hub');
    }
  };

  if (isUpdating) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Setting up your account...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={updateProfileWithOnboardingData}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.successIcon}>🎉</Text>
        </View>

        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.subtitle}>
          Your profile has been configured. Welcome to{' '}
          {state.organizationType?.replace('_', ' ')}.
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Organization Type</Text>
            <Text style={styles.summaryValue}>
              {state.organizationType?.replace('_', ' ') || 'Not set'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Role</Text>
            <Text style={styles.summaryValue}>
              {state.role?.charAt(0).toUpperCase() + (state.role?.slice(1) || '')}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Age Group</Text>
            <Text style={styles.summaryValue}>
              {state.ageGroup?.charAt(0).toUpperCase() + (state.ageGroup?.slice(1) || '')}
            </Text>
          </View>
          {state.isMinor && state.guardianEmail && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Guardian</Text>
              <Text style={styles.summaryValue}>{state.guardianEmail}</Text>
            </View>
          )}
        </View>

        {state.isMinor && !state.guardianInviteSent && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              ℹ️ Some features may be limited until your guardian accepts the invitation
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted}>
          <Text style={styles.getStartedButtonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 64,
  },
  errorIcon: {
    fontSize: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: '#666666',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 15,
    color: '#666666',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  warningCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#EA580C',
    lineHeight: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  getStartedButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  getStartedButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
