import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import HiringHubService from '@/lib/services/HiringHubService';
import { EmploymentType } from '@/types/hiring';

export default function JobPostingCreateScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const preschoolId = profile?.organization_id || (profile as any)?.preschool_id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>(EmploymentType.FULL_TIME);
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Job title is required');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Job description is required');
      return false;
    }
    if (!employmentType) {
      Alert.alert('Validation Error', 'Employment type is required');
      return false;
    }

    const minSalary = salaryMin ? parseFloat(salaryMin) : null;
    const maxSalary = salaryMax ? parseFloat(salaryMax) : null;

    if (minSalary && isNaN(minSalary)) {
      Alert.alert('Validation Error', 'Minimum salary must be a valid number');
      return false;
    }
    if (maxSalary && isNaN(maxSalary)) {
      Alert.alert('Validation Error', 'Maximum salary must be a valid number');
      return false;
    }
    if (minSalary && maxSalary && minSalary > maxSalary) {
      Alert.alert('Validation Error', 'Minimum salary cannot be greater than maximum salary');
      return false;
    }

    return true;
  };

  const handleWhatsAppShare = async (jobPosting: any) => {
    try {
      // Format job details for WhatsApp message
      const jobTitle = jobPosting.title || title;
      const jobLocation = jobPosting.location || location || 'Location TBA';
      const salaryRange =
        jobPosting.salary_range_min && jobPosting.salary_range_max
          ? `R${jobPosting.salary_range_min} - R${jobPosting.salary_range_max}`
          : jobPosting.salary_range_min
          ? `From R${jobPosting.salary_range_min}`
          : 'Negotiable';
      const employmentTypeDisplay =
        jobPosting.employment_type === 'full_time'
          ? 'Full-Time'
          : jobPosting.employment_type === 'part_time'
          ? 'Part-Time'
          : jobPosting.employment_type === 'contract'
          ? 'Contract'
          : 'Employment Type TBA';

      // Generate application link (assuming web app URL pattern)
      const appUrl = process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://edudashpro.app';
      const applicationLink = `${appUrl}/jobs/${jobPosting.id}/apply`;

      // Compose WhatsApp message
      const whatsappMessage = `🎓 *New Teaching Opportunity!*\n\n` +
        `*Position:* ${jobTitle}\n` +
        `*Type:* ${employmentTypeDisplay}\n` +
        `*Location:* ${jobLocation}\n` +
        `*Salary:* ${salaryRange}\n\n` +
        `📝 *Apply Now:* ${applicationLink}\n\n` +
        `Posted via EduDash Pro Hiring Hub`;

      // Call WhatsApp broadcast service
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          message_type: 'text',
          content: whatsappMessage,
          broadcast: true, // Indicates broadcast to contact list
          preschool_id: preschoolId,
          job_posting_id: jobPosting.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send WhatsApp broadcast');
      }

      // Track distribution event
      await HiringHubService.trackJobDistribution({
        job_posting_id: jobPosting.id,
        channel: 'whatsapp',
        distributed_by: user.id,
        recipients_count: 0, // Will be updated by backend with actual count
      });

      Alert.alert(
        'Success! 🎉',
        'Job posting has been shared via WhatsApp to your contact list.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error sharing on WhatsApp:', error);
      Alert.alert(
        'Sharing Failed',
        'Could not share job posting via WhatsApp. You can still share it manually.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!preschoolId || !user?.id) {
      Alert.alert('Error', 'Missing user or school information');
      return;
    }

    setSubmitting(true);
    try {
      const minSalary = salaryMin ? parseFloat(salaryMin) : undefined;
      const maxSalary = salaryMax ? parseFloat(salaryMax) : undefined;

      const newJobPosting = await HiringHubService.createJobPosting(
        {
          preschool_id: preschoolId,
          title: title.trim(),
          description: description.trim(),
          requirements: requirements.trim() || undefined,
          salary_range_min: minSalary,
          salary_range_max: maxSalary,
          location: location.trim() || undefined,
          employment_type: employmentType,
          expires_at: expiresAt || undefined,
        },
        user.id
      );

      // Offer to share on WhatsApp
      Alert.alert(
        'Job Posted Successfully! 🎉',
        'Would you like to share this job posting via WhatsApp?',
        [
          {
            text: 'Share on WhatsApp',
            onPress: () => handleWhatsAppShare(newJobPosting),
          },
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating job posting:', error);
      Alert.alert('Error', error.message || 'Failed to create job posting');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Create Job Posting', headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Job Posting</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Job Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Early Childhood Teacher"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the role, responsibilities, and expectations..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Requirements */}
        <View style={styles.field}>
          <Text style={styles.label}>Requirements</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={requirements}
            onChangeText={setRequirements}
            placeholder="List qualifications, experience, certifications..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Salary Range */}
        <View style={styles.field}>
          <Text style={styles.label}>Salary Range (R)</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={salaryMin}
                onChangeText={setSalaryMin}
                placeholder="Min"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>
            <Text style={[styles.separator, { color: theme.textSecondary }]}>to</Text>
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={salaryMax}
                onChangeText={setSalaryMax}
                placeholder="Max"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Location */}
        <View style={styles.field}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Johannesburg, Gauteng"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Employment Type */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Employment Type <Text style={styles.required}>*</Text>
          </Text>
          <View style={[styles.pickerContainer, { backgroundColor: theme.surface }]}>
            <Picker
              selectedValue={employmentType}
              onValueChange={(value) => setEmploymentType(value as EmploymentType)}
              style={styles.picker}
              dropdownIconColor={theme.text}
            >
              <Picker.Item label="Full-Time" value={EmploymentType.FULL_TIME} />
              <Picker.Item label="Part-Time" value={EmploymentType.PART_TIME} />
              <Picker.Item label="Contract" value={EmploymentType.CONTRACT} />
              <Picker.Item label="Temporary" value={EmploymentType.TEMPORARY} />
            </Picker>
          </View>
        </View>

        {/* Expires At */}
        <View style={styles.field}>
          <Text style={styles.label}>Expires At (Optional)</Text>
          <TextInput
            style={styles.input}
            value={expiresAt}
            onChangeText={setExpiresAt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={styles.hint}>Leave blank for no expiration</Text>
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
            <Text style={styles.submitButtonText}>Create Job Posting</Text>
          )}
        </TouchableOpacity>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    separator: {
      fontSize: 14,
      paddingHorizontal: 4,
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    picker: {
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
      alignItems: 'center',
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
  });
