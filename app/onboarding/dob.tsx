import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  TextInput,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';

export default function DOBCaptureScreen() {
  const router = useRouter();
  const { state, updateState, completeStep } = useOnboarding();
  const [dateOfBirth, setDateOfBirth] = useState<Date>(
    state.dateOfBirth || new Date(2000, 0, 1)
  );
  const [showPicker, setShowPicker] = useState(false);
  const [ageGroup, setAgeGroup] = useState<'child' | 'teen' | 'adult' | null>(null);
  const [isMinor, setIsMinor] = useState(false);

  const computeAge = (dob: Date) => {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const computeAgeGroupFromDate = (dob: Date) => {
    const age = computeAge(dob);
    if (age <= 12) {
      setAgeGroup('child');
      setIsMinor(true);
    } else if (age <= 17) {
      setAgeGroup('teen');
      setIsMinor(true);
    } else {
      setAgeGroup('adult');
      setIsMinor(false);
    }
  };

  // Compute age group on mount for initial date
  useEffect(() => {
    computeAgeGroupFromDate(dateOfBirth);
  }, []);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateOfBirth(selectedDate);
      computeAgeGroupFromDate(selectedDate);
    }
  };

  // Web-only: handle date input change
  const handleWebDateChange = (dateString: string) => {
    try {
      const selected = new Date(dateString);
      if (!isNaN(selected.getTime())) {
        setDateOfBirth(selected);
        computeAgeGroupFromDate(selected);
      }
    } catch (e) {
      console.error('Invalid date:', e);
    }
  };

  const handleContinue = async () => {
    await updateState({
      dateOfBirth,
      ageGroup: ageGroup || undefined,
      isMinor,
    });
    await completeStep('dob');

    // Navigate to next step
    if (isMinor && !state.guardianInviteSent) {
      router.push('/onboarding/guardian');
    } else {
      router.replace('/onboarding/complete');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const age = computeAge(dateOfBirth);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>What's your date of birth?</Text>
          <Text style={styles.subtitle}>
            This helps us provide age-appropriate features and safety controls
          </Text>
        </View>

        <View style={styles.dateSection}>
          {Platform.OS === 'web' ? (
            // Web: native HTML date input
            <View style={styles.webDateInputContainer}>
              <Text style={styles.dateLabel}>Date of Birth</Text>
              <TextInput
                style={styles.webDateInput}
                value={dateOfBirth.toISOString().split('T')[0]}
                onChangeText={handleWebDateChange}
                placeholder="YYYY-MM-DD"
                // @ts-ignore - web-only prop
                type="date"
                max={new Date().toISOString().split('T')[0]}
                min="1920-01-01"
              />
            </View>
          ) : (
            // Native: TouchableOpacity with picker
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowPicker(true)}
            >
              <Text style={styles.dateLabel}>Date of Birth</Text>
              <Text style={styles.dateValue}>{formatDate(dateOfBirth)}</Text>
            </TouchableOpacity>
          )}

          {ageGroup && (
            <View style={styles.ageInfo}>
              <Text style={styles.ageInfoLabel}>Age: {age} years old</Text>
              <Text style={styles.ageInfoLabel}>
                Classification: {ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1)}
              </Text>
              {isMinor && (
                <View style={styles.minorNotice}>
                  <Text style={styles.minorNoticeText}>
                    ℹ️ You'll need to provide guardian information in the next step
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {Platform.OS !== 'web' && (showPicker || Platform.OS === 'ios') && (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={dateOfBirth}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
              minimumDate={new Date(1920, 0, 1)}
            />
          </View>
        )}

        {!showPicker && Platform.OS === 'android' && (
          <TouchableOpacity
            style={styles.androidPickerButton}
            onPress={() => setShowPicker(true)}
          >
            <Text style={styles.androidPickerButtonText}>Change Date</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !ageGroup && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!ageGroup}
        >
          <Text
            style={[
              styles.continueButtonText,
              !ageGroup && styles.continueButtonTextDisabled,
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
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
  dateSection: {
    marginBottom: 32,
  },
  dateButton: {
    backgroundColor: '#F8F9FA',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  dateLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  dateValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  ageInfo: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
  },
  ageInfoLabel: {
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: '500',
    marginBottom: 4,
  },
  minorNotice: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  minorNoticeText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  pickerContainer: {
    marginTop: 20,
  },
  androidPickerButton: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    alignItems: 'center',
  },
  androidPickerButtonText: {
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: '600',
  },
  footer: {
    padding: 20,
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
  webDateInputContainer: {
    backgroundColor: '#F8F9FA',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  webDateInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
});
