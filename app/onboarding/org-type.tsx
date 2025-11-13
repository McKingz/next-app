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
import { OrganizationType } from '@/lib/types/organization';

interface OrgTypeOption {
  type: OrganizationType;
  displayName: string;
  description: string;
  icon: string;
}

const ORG_TYPE_OPTIONS: OrgTypeOption[] = [
  {
    type: 'preschool',
    displayName: 'Preschool / Nursery',
    description: 'Early childhood education for ages 0-6',
    icon: '👶',
  },
  {
    type: 'k12_school',
    displayName: 'K-12 School',
    description: 'Primary and secondary education',
    icon: '🎒',
  },
  {
    type: 'university',
    displayName: 'University / College',
    description: 'Higher education and degree programs',
    icon: '🎓',
  },
  {
    type: 'corporate',
    displayName: 'Corporate Training',
    description: 'Employee development and training programs',
    icon: '💼',
  },
  {
    type: 'sports_club',
    displayName: 'Sports Club / Academy',
    description: 'Athletic training and team management',
    icon: '⚽',
  },
  {
    type: 'community_org',
    displayName: 'Community Organization',
    description: 'NGOs, clubs, and community programs',
    icon: '🤝',
  },
  {
    type: 'training_center',
    displayName: 'Training Center',
    description: 'Skills development and certification programs',
    icon: '📚',
  },
  {
    type: 'tutoring_center',
    displayName: 'Tutoring Center',
    description: 'Private tutoring and academic support',
    icon: '✏️',
  },
];

export default function OrgTypeSelectionScreen() {
  const router = useRouter();
  const { state, updateState, completeStep } = useOnboarding();
  const [selectedType, setSelectedType] = useState<OrganizationType | null>(
    state.organizationType || null
  );

  const handleSelect = (type: OrganizationType) => {
    setSelectedType(type);
  };

  const handleContinue = async () => {
    if (!selectedType) return;

    // Compute age group from DOB if already exists
    let ageGroup: 'child' | 'teen' | 'adult' | undefined;
    let isMinor = false;

    if (state.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(state.dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age <= 12) {
        ageGroup = 'child';
        isMinor = true;
      } else if (age <= 17) {
        ageGroup = 'teen';
        isMinor = true;
      } else {
        ageGroup = 'adult';
        isMinor = false;
      }
    }

    await updateState({
      organizationType: selectedType,
      ageGroup,
      isMinor,
    });
    await completeStep('org_type');

    // Navigate to next step
    if (!state.role) {
      router.push('/onboarding/role');
    } else if (!state.dateOfBirth) {
      router.push('/onboarding/dob');
    } else if (isMinor && !state.guardianInviteSent) {
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
          <Text style={styles.title}>What type of organization are you?</Text>
          <Text style={styles.subtitle}>
            This helps us customize your experience
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          {ORG_TYPE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.type}
              style={[
                styles.optionCard,
                selectedType === option.type && styles.optionCardSelected,
              ]}
              onPress={() => handleSelect(option.type)}
              activeOpacity={0.7}
            >
              <Text style={styles.optionIcon}>{option.icon}</Text>
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionTitle,
                    selectedType === option.type && styles.optionTitleSelected,
                  ]}
                >
                  {option.displayName}
                </Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              {selectedType === option.type && (
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
            !selectedType && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedType}
        >
          <Text
            style={[
              styles.continueButtonText,
              !selectedType && styles.continueButtonTextDisabled,
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
