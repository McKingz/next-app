import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface RoleOption {
  role: string;
  displayName: string;
  description: string;
  icon: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'student',
    displayName: 'Student / Learner',
    description: "I'm here to learn and participate in activities",
    icon: '🎓',
  },
  {
    role: 'teacher',
    displayName: 'Teacher / Instructor',
    description: 'I teach, train, or coach learners',
    icon: '👨‍🏫',
  },
  {
    role: 'parent',
    displayName: 'Parent / Guardian',
    description: 'I oversee and support a learner',
    icon: '👪',
  },
  {
    role: 'employee',
    displayName: 'Employee',
    description: "I'm participating in company training",
    icon: '💼',
  },
  {
    role: 'athlete',
    displayName: 'Athlete / Player',
    description: "I'm part of a sports team or club",
    icon: '⚽',
  },
  {
    role: 'member',
    displayName: 'Member',
    description: "I'm a community or organization member",
    icon: '🤝',
  },
];

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { state, updateState, completeStep } = useOnboarding();
  const [selectedRole, setSelectedRole] = useState<string | null>(
    state.role || null
  );

  const handleSelect = (role: string) => {
    setSelectedRole(role);
  };

  const handleContinue = async () => {
    if (!selectedRole) return;

    await updateState({
      role: selectedRole as any,
    });
    await completeStep('role');

    // Navigate to next step
    if (!state.dateOfBirth) {
      router.push('/onboarding/dob');
    } else if (state.isMinor && !state.guardianInviteSent) {
      router.push('/onboarding/guardian');
    } else {
      router.replace('/onboarding/complete');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>What's your role?</Text>
          <Text style={styles.subtitle}>
            This helps us show you the right features and content
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          {ROLE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.role}
              style={[
                styles.optionCard,
                selectedRole === option.role && styles.optionCardSelected,
              ]}
              onPress={() => handleSelect(option.role)}
              activeOpacity={0.7}
            >
              <Text style={styles.optionIcon}>{option.icon}</Text>
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionTitle,
                    selectedRole === option.role && styles.optionTitleSelected,
                  ]}
                >
                  {option.displayName}
                </Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              {selectedRole === option.role && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedRole && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedRole}
        >
          <Text
            style={[
              styles.continueButtonText,
              !selectedRole && styles.continueButtonTextDisabled,
            ]}
          >
            Continue
          </Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  optionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: '#4F46E5',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  continueButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  continueButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
