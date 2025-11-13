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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/contexts/ThemeContext';
import HiringHubService from '@/lib/services/HiringHubService';
import { JobPosting } from '@/types/hiring';
import { useTranslation } from 'react-i18next';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function PublicJobApplicationScreen() {
  const { job_id } = useLocalSearchParams<{ job_id: string }>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState<any>(null);

  useEffect(() => {
    loadJobPosting();
     
  }, [job_id]);

  const loadJobPosting = async () => {
    if (!job_id) return;

    try {
      setLoading(true);
      const data = await HiringHubService.getJobPostingById(job_id);
      
if (!data || data.status !== 'active') {
        Alert.alert(t('apply.jobNotAvailableTitle'), t('apply.jobNotAvailableDesc'));
        return;
      }

      // Check if expired
if (data.expires_at && new Date(data.expires_at) < new Date()) {
        Alert.alert(t('apply.jobExpiredTitle'), t('apply.jobExpiredDesc'));
        return;
      }

      setJobPosting(data);
    } catch (error: any) {
console.error('Error loading job posting:', error);
      Alert.alert(t('common.error'), error.message || t('apply.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handlePickResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_MIME_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      // Validate file size
if (file.size && file.size > MAX_FILE_SIZE) {
        Alert.alert(t('apply.fileTooLargeTitle'), t('apply.fileTooLargeDesc'));
        return;
      }

      // Validate file type
if (file.mimeType && !ALLOWED_MIME_TYPES.includes(file.mimeType)) {
        Alert.alert(t('apply.invalidFileTypeTitle'), t('apply.invalidFileTypeDesc'));
        return;
      }

      setResumeFile(file);
    } catch (error) {
console.error('Error picking document:', error);
      Alert.alert(t('common.error'), t('apply.pickDocumentError'));
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
if (!firstName.trim()) {
      Alert.alert(t('apply.validationErrorTitle'), t('validation.required', { field: t('auth.firstName') }));
      return false;
    }

if (!lastName.trim()) {
      Alert.alert(t('apply.validationErrorTitle'), t('validation.required', { field: t('auth.lastName') }));
      return false;
    }

if (!email.trim()) {
      Alert.alert(t('apply.validationErrorTitle'), t('validation.required', { field: t('auth.email') }));
      return false;
    }

if (!validateEmail(email)) {
      Alert.alert(t('apply.validationErrorTitle'), t('validation.email_invalid'));
      return false;
    }

if (!phone.trim()) {
      Alert.alert(t('apply.validationErrorTitle'), t('validation.required', { field: t('apply.phoneNumber') }));
      return false;
    }

if (!experienceYears.trim() || isNaN(Number(experienceYears))) {
      Alert.alert(t('apply.validationErrorTitle'), t('apply.error.yearsExperienceNumber'));
      return false;
    }

if (!resumeFile) {
      Alert.alert(t('apply.validationErrorTitle'), t('apply.error.resumeRequired'));
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!jobPosting) return;

    setSubmitting(true);
    try {
      // Step 1: Create or get candidate profile
      const candidateProfile = await HiringHubService.createOrGetCandidateProfile({
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        experience_years: Number(experienceYears),
        qualifications: qualifications.trim() ? [{ field: qualifications.trim() }] : undefined,
      });

      // Step 2: Upload resume
      let resumeFilePath: string | undefined;
      if (resumeFile) {
        // Convert DocumentPicker result to blob/file
        const response = await fetch(resumeFile.uri);
        const blob = await response.blob();
        
        resumeFilePath = await HiringHubService.uploadResume(
          blob,
          email.trim().toLowerCase(),
          resumeFile.name
        );
      }

      // Step 3: Submit application
      await HiringHubService.submitApplication(
        {
          job_posting_id: jobPosting.id,
          candidate_profile_id: candidateProfile.id,
          cover_letter: coverLetter.trim() || undefined,
        },
        resumeFilePath
      );

      // Success!
Alert.alert(
        t('apply.submittedTitle'),
        t('apply.submittedDesc'),
        [
          {
            text: t('common.ok'),
            onPress: () => {
              // Clear form
              setFirstName('');
              setLastName('');
              setEmail('');
              setPhone('');
              setExperienceYears('');
              setQualifications('');
              setCoverLetter('');
              setResumeFile(null);
            },
          },
        ]
      );
    } catch (error: any) {
console.error('Error submitting application:', error);
      Alert.alert(t('common.error'), error.message || t('apply.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
<ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t('apply.loadingPosting')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!jobPosting) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.error} />
<Text style={styles.errorText}>{t('apply.notFoundTitle')}</Text>
          <Text style={styles.errorSubtext}>
            {t('apply.notFoundDesc')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
<Stack.Screen options={{ title: t('apply.screenTitle'), headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="briefcase-outline" size={24} color={theme.primary} />
<Text style={styles.headerTitle}>{t('apply.headerTitle')}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Job Info Card */}
        <View style={styles.jobCard}>
          <Text style={styles.jobTitle}>{jobPosting.title}</Text>
          <View style={styles.jobMetaRow}>
            <Ionicons name="business-outline" size={16} color={theme.textSecondary} />
<Text style={styles.jobMeta}>{t('apply.schoolPosition')}</Text>
          </View>
          {jobPosting.location && (
            <View style={styles.jobMetaRow}>
              <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
              <Text style={styles.jobMeta}>{jobPosting.location}</Text>
            </View>
          )}
          {(jobPosting.salary_range_min || jobPosting.salary_range_max) && (
            <View style={styles.jobMetaRow}>
              <Ionicons name="cash-outline" size={16} color={theme.textSecondary} />
<Text style={styles.jobMeta}>
                {t('currency.symbol', { defaultValue: 'R' })}{jobPosting.salary_range_min?.toLocaleString()} - {t('currency.symbol', { defaultValue: 'R' })}
                {jobPosting.salary_range_max?.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

<Text style={styles.sectionTitle}>{t('apply.personalInfo')}</Text>

        {/* First Name */}
        <View style={styles.field}>
<Text style={styles.label}>
            {t('auth.firstName')} <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
placeholder={t('apply.placeholder.firstName')}
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Last Name */}
        <View style={styles.field}>
<Text style={styles.label}>
            {t('auth.lastName')} <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
placeholder={t('apply.placeholder.lastName')}
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Email */}
        <View style={styles.field}>
<Text style={styles.label}>
            {t('auth.email')} <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
placeholder={t('apply.placeholder.email')}
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Phone */}
        <View style={styles.field}>
<Text style={styles.label}>
            {t('apply.phoneNumber')} <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
placeholder={t('apply.placeholder.phone')}
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
          />
        </View>

        {/* Experience Years */}
        <View style={styles.field}>
<Text style={styles.label}>
            {t('apply.yearsExperience')} <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={experienceYears}
            onChangeText={setExperienceYears}
placeholder={t('apply.placeholder.years')}
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />
        </View>

<Text style={styles.sectionTitle}>{t('apply.qualificationsTitle')}</Text>

        {/* Qualifications */}
        <View style={styles.field}>
<Text style={styles.label}>{t('apply.educationOptionalLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={qualifications}
            onChangeText={setQualifications}
placeholder={t('apply.placeholder.qualificationsText')}
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Resume Upload */}
        <View style={styles.field}>
<Text style={styles.label}>
            {t('apply.resumeLabel')} <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity style={styles.uploadButton} onPress={handlePickResume}>
            <Ionicons
              name={resumeFile ? 'document-text' : 'cloud-upload-outline'}
              size={24}
              color={resumeFile ? theme.success : theme.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadButtonText}>
{resumeFile ? resumeFile.name : t('apply.uploadResumeCta')}
              </Text>
              {!resumeFile && (
<Text style={styles.uploadButtonHint}>{t('apply.uploadHint')}</Text>
              )}
            </View>
            {resumeFile && (
              <TouchableOpacity onPress={() => setResumeFile(null)}>
                <Ionicons name="close-circle" size={24} color={theme.error} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {/* Cover Letter */}
        <View style={styles.field}>
<Text style={styles.label}>{t('apply.coverLetterOptional')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={coverLetter}
            onChangeText={setCoverLetter}
placeholder={t('apply.placeholder.coverLetterLong')}
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={6}
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
              <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
<Text style={styles.submitButtonText}>{t('apply.submitCta')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="shield-checkmark-outline" size={18} color={theme.textSecondary} />
<Text style={styles.privacyText}>
            {t('apply.privacyNotice')}
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
    errorSubtext: {
      marginTop: 8,
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 12,
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
    jobCard: {
      padding: 16,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 24,
    },
    jobTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 12,
    },
    jobMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
      gap: 8,
    },
    jobMeta: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 16,
      marginTop: 8,
    },
    field: {
      marginBottom: 20,
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
      minHeight: 80,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.border,
      borderStyle: 'dashed',
      borderRadius: 8,
      padding: 16,
      gap: 12,
    },
    uploadButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    uploadButtonHint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
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
    privacyNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      marginTop: 16,
      gap: 8,
    },
    privacyText: {
      flex: 1,
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
  });
