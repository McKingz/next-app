import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useOnboarding } from '@/contexts/OnboardingContext';

export default function OnboardingIndex() {
  const router = useRouter();
  const { state, isOnboardingComplete } = useOnboarding();

  useEffect(() => {
    // Determine which step to navigate to
    if (isOnboardingComplete) {
      router.replace('/onboarding/complete');
    } else if (!state.organizationType) {
      router.replace('/onboarding/org-type');
    } else if (!state.role) {
      router.replace('/onboarding/role');
    } else if (!state.dateOfBirth) {
      router.replace('/onboarding/dob');
    } else if (state.isMinor && !state.guardianInviteSent) {
      router.replace('/onboarding/guardian');
    } else {
      router.replace('/onboarding/complete');
    }
  }, [state, isOnboardingComplete]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4F46E5" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
