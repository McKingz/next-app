import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useTheme } from '@/contexts/ThemeContext';

// Form data interface
interface RegistrationData {
  schoolName: string;
  schoolType: 'preschool' | 'k12_school' | 'hybrid';
  gradelevels: string[];
  contactEmail: string;
  contactPhone: string;
  physicalAddress: string;
  principalName: string;
  principalEmail: string;
  selectedPlanId?: string;
}

// Separate error type allowing string messages per field
type RegistrationErrors = Partial<Record<keyof RegistrationData, string | string[]>>;

// Grade level options by school type
const GRADE_LEVELS = {
  preschool: [
    { id: 'infants', label: 'Infants (6m-12m)', description: 'Infant care programs' },
    { id: 'toddlers', label: 'Toddlers (1-2 years)', description: 'Toddler development programs' },
    { id: 'pre_k', label: 'Pre-K (3-4 years)', description: 'Pre-kindergarten preparation' },
    { id: 'reception', label: 'Reception (4-5 years)', description: 'School readiness programs' }
  ],
  k12_school: [
    { id: 'foundation', label: 'Foundation Phase (Grade R-3)', description: 'Ages 5-9' },
    { id: 'intermediate', label: 'Intermediate Phase (Grade 4-6)', description: 'Ages 9-12' },
    { id: 'senior', label: 'Senior Phase (Grade 7-9)', description: 'Ages 12-15' },
    { id: 'fet', label: 'FET Phase (Grade 10-12)', description: 'Ages 15-18' }
  ],
  hybrid: [
    { id: 'infants', label: 'Infants (6m-12m)', description: 'Infant care programs' },
    { id: 'toddlers', label: 'Toddlers (1-2 years)', description: 'Toddler development programs' },
    { id: 'pre_k', label: 'Pre-K (3-4 years)', description: 'Pre-kindergarten preparation' },
    { id: 'foundation', label: 'Foundation Phase (Grade R-3)', description: 'Ages 5-9' },
    { id: 'intermediate', label: 'Intermediate Phase (Grade 4-6)', description: 'Ages 9-12' },
    { id: 'senior', label: 'Senior Phase (Grade 7-9)', description: 'Ages 12-15' },
    { id: 'fet', label: 'FET Phase (Grade 10-12)', description: 'Ages 15-18' }
  ]
};

export default function SchoolRegistrationScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ schoolType?: string; from?: string }>();
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Form state
  const [formData, setFormData] = useState<RegistrationData>({
    schoolName: '',
    schoolType: (params.schoolType as RegistrationData['schoolType']) || 'preschool',
    gradelevels: [],
    contactEmail: '',
    contactPhone: '',
    physicalAddress: '',
    principalName: profile?.first_name && profile?.last_name 
      ? `${profile.first_name} ${profile.last_name}` 
      : '',
    principalEmail: profile?.email || user?.email || '',
    selectedPlanId: undefined
  });

// Validation state
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // Load saved form data
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        if (Platform.OS !== 'web') {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const savedData = await AsyncStorage.getItem('school_registration_data');
          if (savedData) {
            const parsed = JSON.parse(savedData);
            setFormData(prev => ({ ...prev, ...parsed }));
          }
        }
      } catch (e) {
        console.debug('Failed to load saved registration data', e);
      }
    };
    loadSavedData();
  }, []);

  // Save form data persistently
  const saveFormData = async (data: Partial<RegistrationData>) => {
    try {
      if (Platform.OS !== 'web') {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const updatedData = { ...formData, ...data };
        await AsyncStorage.setItem('school_registration_data', JSON.stringify(updatedData));
      }
    } catch (e) {
      console.debug('Failed to save registration data', e);
    }
  };

  // Update form field and save
  const updateField = (field: keyof RegistrationData, value: any) => {
    const updated = { [field]: value };
    setFormData(prev => ({ ...prev, ...updated }));
    saveFormData(updated);
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Get available grade levels for current school type
  const availableGradeLevels = useMemo(() => {
    return GRADE_LEVELS[formData.schoolType] || [];
  }, [formData.schoolType]);

  // Toggle grade level selection
  const toggleGradeLevel = (levelId: string) => {
    const updated = formData.gradelevels.includes(levelId)
      ? formData.gradelevels.filter(id => id !== levelId)
      : [...formData.gradelevels, levelId];
    updateField('gradelevels', updated);
  };

  // Validation functions
  const validateStep = (step: number): boolean => {
    const newErrors: RegistrationErrors = {};

    if (step >= 1) {
      if (!formData.schoolName.trim()) {
        newErrors.schoolName = 'School name is required';
      }
      if (formData.gradelevels.length === 0) {
        newErrors.gradelevels = 'At least one grade level must be selected';
      }
    }

    if (step >= 2) {
      if (!formData.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
        newErrors.contactEmail = 'Valid contact email is required';
      }
      if (!formData.contactPhone.trim()) {
        newErrors.contactPhone = 'Contact phone is required';
      }
    }

    if (step >= 3) {
      if (!formData.principalName.trim()) {
        newErrors.principalName = 'Principal name is required';
      }
      if (!formData.principalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.principalEmail)) {
        newErrors.principalEmail = 'Valid principal email is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step navigation
  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
      track('registration_step_completed', { 
        step: currentStep,
        school_type: formData.schoolType 
      });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Handle registration
  const handleRegister = async () => {
    if (!validateStep(totalSteps) || registering) return;

    setRegistering(true);

    try {
      // Call the register_new_school RPC function
      const { data, error } = await assertSupabase().rpc('register_new_school', {
        p_school_name: formData.schoolName.trim(),
        p_principal_email: formData.principalEmail.trim(),
        p_principal_name: formData.principalName.trim(),
        p_school_type: formData.schoolType,
        p_grade_levels: formData.gradelevels,
        p_contact_email: formData.contactEmail.trim(),
        p_contact_phone: formData.contactPhone.trim(),
        p_physical_address: formData.physicalAddress.trim() || null,
        p_selected_plan_id: formData.selectedPlanId || null
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Success! Clear saved form data
      if (Platform.OS !== 'web') {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.removeItem('school_registration_data');
      }

      track('school_registered', {
        school_type: formData.schoolType,
        grade_levels: formData.gradelevels,
        school_id: data.school_id
      });

      Alert.alert(
        'School Registered Successfully!',
        'Your school registration is complete. You will receive an email verification shortly. After verification, you can set up your subscription and start using the platform.',
        [
          {
            text: 'Continue to Verification',
            onPress: () => {
              router.push({
                pathname: '/screens/email-verification',
                params: {
                  schoolId: data.school_id,
                  email: formData.contactEmail,
                  verificationId: data.verification_id
                }
              });
            }
          }
        ]
      );

    } catch (error: any) {
      console.error('Registration failed:', error);
      
      Alert.alert(
        'Registration Failed',
        error.message || 'Failed to register school. Please try again.',
        [{ text: 'OK' }]
      );
      
      track('school_registration_failed', {
        error: error.message,
        school_type: formData.schoolType
      });
    } finally {
      setRegistering(false);
    }
  };

  // Step indicator component
  const StepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map(step => (
        <View key={step} style={styles.stepItem}>
          <View style={[
            styles.stepCircle,
            step <= currentStep && styles.stepCircleActive
          ]}>
            <Text style={[
              styles.stepNumber,
              step <= currentStep && styles.stepNumberActive
            ]}>
              {step}
            </Text>
          </View>
          <Text style={[
            styles.stepLabel,
            step === currentStep && styles.stepLabelActive
          ]}>
            {step === 1 && 'School Details'}
            {step === 2 && 'Contact Info'}
            {step === 3 && 'Principal Info'}
          </Text>
        </View>
      ))}
    </View>
  );

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>School Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>School Name *</Text>
              <TextInput
                style={[styles.textInput, errors.schoolName && styles.inputError]}
                value={formData.schoolName}
                onChangeText={(value) => updateField('schoolName', value)}
                placeholder="e.g. Bright Beginnings Preschool"
                placeholderTextColor="#6B7280"
                autoCapitalize="words"
              />
              {errors.schoolName && <Text style={styles.errorText}>{errors.schoolName}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>School Type</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>
                  {formData.schoolType === 'preschool' && 'Preschool'}
                  {formData.schoolType === 'k12_school' && 'K-12 School'}
                  {formData.schoolType === 'hybrid' && 'Hybrid Institution'}
                </Text>
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => router.push({
                    pathname: '/screens/school-type-selection',
                    params: { from: 'registration' }
                  })}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Grade Levels / Age Groups *</Text>
              <Text style={styles.inputHint}>Select all that apply to your school</Text>
              <View style={styles.gradeLevelContainer}>
                {availableGradeLevels.map(level => (
                  <TouchableOpacity
                    key={level.id}
                    style={[
                      styles.gradeLevelOption,
                      formData.gradelevels.includes(level.id) && styles.gradeLevelOptionSelected
                    ]}
                    onPress={() => toggleGradeLevel(level.id)}
                  >
                    <View style={[
                      styles.checkbox,
                      formData.gradelevels.includes(level.id) && styles.checkboxSelected
                    ]} />
                    <View style={styles.gradeLevelInfo}>
                      <Text style={styles.gradeLevelLabel}>{level.label}</Text>
                      <Text style={styles.gradeLevelDescription}>{level.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.gradelevels && <Text style={styles.errorText}>{errors.gradelevels}</Text>}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>School Email Address *</Text>
              <TextInput
                style={[styles.textInput, errors.contactEmail && styles.inputError]}
                value={formData.contactEmail}
                onChangeText={(value) => updateField('contactEmail', value)}
                placeholder="info@yourschool.com"
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={styles.inputHint}>This will be used for important notifications</Text>
              {errors.contactEmail && <Text style={styles.errorText}>{errors.contactEmail}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>School Phone Number *</Text>
              <TextInput
                style={[styles.textInput, errors.contactPhone && styles.inputError]}
                value={formData.contactPhone}
                onChangeText={(value) => updateField('contactPhone', value)}
                placeholder="+27 11 123 4567"
                placeholderTextColor="#6B7280"
                keyboardType="phone-pad"
              />
              {errors.contactPhone && <Text style={styles.errorText}>{errors.contactPhone}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Physical Address</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.physicalAddress}
                onChangeText={(value) => updateField('physicalAddress', value)}
                placeholder="123 Education Street, Learning City, Province, Postal Code"
                placeholderTextColor="#6B7280"
                multiline={true}
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Text style={styles.inputHint}>Complete physical address of your school</Text>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Principal/Administrator Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Principal Full Name *</Text>
              <TextInput
                style={[styles.textInput, errors.principalName && styles.inputError]}
                value={formData.principalName}
                onChangeText={(value) => updateField('principalName', value)}
                placeholder="Dr. Jane Smith"
                placeholderTextColor="#6B7280"
                autoCapitalize="words"
              />
              {errors.principalName && <Text style={styles.errorText}>{errors.principalName}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Principal Email Address *</Text>
              <TextInput
                style={[styles.textInput, errors.principalEmail && styles.inputError]}
                value={formData.principalEmail}
                onChangeText={(value) => updateField('principalEmail', value)}
                placeholder="principal@yourschool.com"
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={styles.inputHint}>This will be your login email for the platform</Text>
              {errors.principalEmail && <Text style={styles.errorText}>{errors.principalEmail}</Text>}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Registration Summary</Text>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>School:</Text>
                <Text style={styles.summaryValue}>{formData.schoolName}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Type:</Text>
                <Text style={styles.summaryValue}>
                  {formData.schoolType === 'preschool' && 'Preschool'}
                  {formData.schoolType === 'k12_school' && 'K-12 School'}
                  {formData.schoolType === 'hybrid' && 'Hybrid Institution'}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Levels:</Text>
                <Text style={styles.summaryValue}>{formData.gradelevels.length} selected</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Contact:</Text>
                <Text style={styles.summaryValue}>{formData.contactEmail}</Text>
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'School Registration',
        headerStyle: { backgroundColor: theme.headerBackground },
        headerTitleStyle: { color: theme.headerText },
        headerTintColor: theme.headerTint
      }} />
      <ThemedStatusBar />
      
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <StepIndicator />
            {renderStepContent()}
          </ScrollView>
          
          <View style={styles.navigationContainer}>
            {currentStep > 1 && (
              <TouchableOpacity style={styles.backButton} onPress={prevStep}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.nextButton,
                (currentStep === totalSteps && registering) && styles.nextButtonLoading
              ]}
              onPress={currentStep === totalSteps ? handleRegister : nextStep}
              disabled={registering}
            >
              {registering ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.nextButtonText}>
                  {currentStep === totalSteps ? 'Register School' : 'Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 100, // Space for navigation
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepCircleActive: {
    backgroundColor: '#00f5ff',
  },
  stepNumber: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  stepNumberActive: {
    color: '#000',
  },
  stepLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#00f5ff',
  },
  stepContent: {
    gap: 20,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  inputHint: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 16,
  },
  textInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
  },
  readOnlyText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  changeButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00f5ff',
  },
  changeButtonText: {
    color: '#00f5ff',
    fontSize: 12,
    fontWeight: '600',
  },
  gradeLevelContainer: {
    gap: 8,
    marginTop: 8,
  },
  gradeLevelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  gradeLevelOptionSelected: {
    borderColor: '#00f5ff',
    backgroundColor: '#0b1f26',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1f2937',
  },
  checkboxSelected: {
    backgroundColor: '#00f5ff',
    borderColor: '#00f5ff',
  },
  gradeLevelInfo: {
    flex: 1,
  },
  gradeLevelLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  gradeLevelDescription: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  navigationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#0b1220',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  backButtonText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#00f5ff',
  },
  nextButtonLoading: {
    opacity: 0.8,
  },
  nextButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});