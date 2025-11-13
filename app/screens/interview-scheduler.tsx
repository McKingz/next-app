import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import HiringHubService from '@/lib/services/HiringHubService';

export default function InterviewSchedulerScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<any>(null);

  // Form fields
  const [interviewDate, setInterviewDate] = useState(new Date());
  const [interviewTime, setInterviewTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadApplication();
  }, [applicationId]);

  const loadApplication = async () => {
    if (!applicationId) return;

    try {
      setLoading(true);
      const data = await HiringHubService.getApplicationById(applicationId);
      setApplication(data);
    } catch (error: any) {
      console.error('Error loading application:', error);
      Alert.alert('Error', error.message || 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setInterviewDate(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setInterviewTime(selectedTime);
    }
  };

  const generateTimeSlots = () => {
    const slots: Date[] = [];
    const startHour = 8; // 8 AM
    const endHour = 17; // 5 PM
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date();
        time.setHours(hour, minute, 0, 0);
        slots.push(time);
      }
    }
    return slots;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const validateForm = (): boolean => {
    // Check if interview is in the past
    const selectedDateTime = new Date(interviewDate);
    selectedDateTime.setHours(interviewTime.getHours(), interviewTime.getMinutes());
    
    if (selectedDateTime < new Date()) {
      Alert.alert('Validation Error', 'Interview date and time must be in the future');
      return false;
    }

    // Either meeting link OR location must be provided
    if (!meetingLink.trim() && !location.trim()) {
      Alert.alert('Validation Error', 'Please provide either a meeting link or location');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!application || !user?.id) return;

    setSubmitting(true);
    try {
      const interviewDateStr = interviewDate.toISOString().split('T')[0];
      const interviewTimeStr = formatTime(interviewTime);

      await HiringHubService.scheduleInterview(
        {
          application_id: application.id,
          interview_date: interviewDateStr,
          interview_time: interviewTimeStr,
          meeting_link: meetingLink.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        user.id
      );

      Alert.alert(
        'Success',
        'Interview scheduled successfully. The candidate will receive an email notification.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error scheduling interview:', error);
      Alert.alert('Error', error.message || 'Failed to schedule interview');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading application...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.error} />
          <Text style={styles.errorText}>Application not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Schedule Interview', headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule Interview</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Candidate Info */}
        <View style={styles.candidateCard}>
          <Text style={styles.candidateLabel}>Interviewing:</Text>
          <Text style={styles.candidateName}>{application.candidate_name}</Text>
          <Text style={styles.candidateEmail}>{application.candidate_email}</Text>
        </View>

        {/* Date Picker */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Interview Date <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={24} color={theme.primary} />
            <Text style={styles.dateButtonText}>{formatDate(interviewDate)}</Text>
            <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={interviewDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Time Picker */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Interview Time <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Ionicons name="time-outline" size={24} color={theme.primary} />
            <Text style={styles.dateButtonText}>{formatTime(interviewTime)}</Text>
            <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.hint}>30-minute intervals, 8:00 AM - 5:00 PM</Text>
        </View>

        {showTimePicker && (
          <DateTimePicker
            value={interviewTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
            minuteInterval={30}
          />
        )}

        {/* Meeting Link */}
        <View style={styles.field}>
          <Text style={styles.label}>Meeting Link (Optional)</Text>
          <TextInput
            style={styles.input}
            value={meetingLink}
            onChangeText={setMeetingLink}
            placeholder="https://zoom.us/j/123456789 or Google Meet link"
            placeholderTextColor={theme.textSecondary}
            keyboardType="url"
            autoCapitalize="none"
          />
          <Text style={styles.hint}>For virtual interviews</Text>
        </View>

        {/* Location */}
        <View style={styles.field}>
          <Text style={styles.label}>Location (Optional)</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. School Office, Room 101"
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={styles.hint}>For in-person interviews</Text>
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional instructions for the candidate..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="calendar-sharp" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Schedule Interview</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={theme.info} />
          <Text style={styles.infoText}>
            The candidate will receive an email with interview details and calendar invite.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      marginTop: 16,
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    backButton: {
      marginTop: 24,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: theme.primary,
      borderRadius: 8,
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerBackButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
    },
    candidateCard: {
      padding: 16,
      backgroundColor: theme.primary + '10',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.primary + '30',
      marginBottom: 24,
    },
    candidateLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 4,
    },
    candidateName: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    candidateEmail: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    field: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    required: {
      color: theme.error,
    },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
    },
    textArea: {
      minHeight: 100,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      gap: 12,
    },
    dateButtonText: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
    },
    hint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    submitButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.info + '10',
      borderRadius: 8,
      padding: 12,
      marginTop: 16,
      gap: 8,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
    },
  });
