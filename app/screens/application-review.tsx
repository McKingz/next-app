import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import HiringHubService from '@/lib/services/HiringHubService';
import { ApplicationWithDetails, ApplicationStatus } from '@/types/hiring';

export default function ApplicationReviewScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<(ApplicationWithDetails & { resume_url?: string; created_at?: string }) | null>(null);
  const [updating, setUpdating] = useState(false);

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

  useEffect(() => {
    loadApplication();
     
  }, [applicationId]);


  const handleStatusChange = async (newStatus: ApplicationStatus, reason?: string) => {
    if (!application || !user?.id) return;

    setUpdating(true);
    try {
      await HiringHubService.updateApplicationStatus(
        application.id,
        newStatus,
        user.id,
        reason
      );

      setApplication({ ...application, status: newStatus });
      Alert.alert('Success', `Application status updated to ${newStatus}`);
    } catch (error: any) {
      console.error('Error updating application:', error);
      Alert.alert('Error', error.message || 'Failed to update application status');
    } finally {
      setUpdating(false);
    }
  };

  const handleShortlist = () => {
    Alert.alert(
      'Shortlist Candidate',
      'Move this candidate to the shortlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Shortlist',
          onPress: () => handleStatusChange(ApplicationStatus.SHORTLISTED),
        },
      ]
    );
  };

  const handleReject = () => {
    Alert.prompt(
      'Reject Application',
      'Please provide a reason (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: (reason) => handleStatusChange(ApplicationStatus.REJECTED, reason),
        },
      ],
      'plain-text'
    );
  };

  const handleUnderReview = () => {
    handleStatusChange(ApplicationStatus.UNDER_REVIEW);
  };

  const handleScheduleInterview = () => {
    if (!application) return;
    router.push({
      pathname: '/screens/interview-scheduler',
      params: { applicationId: application.id },
    });
  };

  const handleViewResume = async () => {
    if (!application?.resume_url) {
      Alert.alert('No Resume', 'This candidate has not uploaded a resume.');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(application.resume_url);
      if (supported) {
        await Linking.openURL(application.resume_url);
      } else {
        Alert.alert('Error', 'Unable to open resume URL');
      }
    } catch (error) {
      console.error('Error opening resume:', error);
      Alert.alert('Error', 'Failed to open resume');
    }
  };

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case ApplicationStatus.NEW:
        return theme.info;
      case ApplicationStatus.UNDER_REVIEW:
        return theme.warning;
      case ApplicationStatus.SHORTLISTED:
        return theme.success;
      case ApplicationStatus.INTERVIEW_SCHEDULED:
        return theme.primary;
      case ApplicationStatus.OFFERED:
        return theme.success;
      case ApplicationStatus.ACCEPTED:
        return '#00C853';
      case ApplicationStatus.REJECTED:
        return theme.error;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusActions = () => {
    if (!application) return [];

    switch (application.status) {
      case ApplicationStatus.NEW:
        return [
          { label: 'Review', onPress: handleUnderReview, color: theme.primary },
          { label: 'Reject', onPress: handleReject, color: theme.error },
        ];
      case ApplicationStatus.UNDER_REVIEW:
        return [
          { label: 'Shortlist', onPress: handleShortlist, color: theme.success },
          { label: 'Reject', onPress: handleReject, color: theme.error },
        ];
      case ApplicationStatus.SHORTLISTED:
        return [
          { label: 'Schedule Interview', onPress: handleScheduleInterview, color: theme.primary },
          { label: 'Reject', onPress: handleReject, color: theme.error },
        ];
      default:
        return [];
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

  const actions = getStatusActions();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Review Application', headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Application Review</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(application.status) + '20' },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(application.status) }]}>
            {application.status.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>

        {/* Candidate Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Candidate Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color={theme.textSecondary} />
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{application.candidate_name || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{application.candidate_email}</Text>
          </View>
          {application.candidate_phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color={theme.textSecondary} />
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{application.candidate_phone}</Text>
            </View>
          )}
        </View>

        {/* Cover Letter */}
        {application.cover_letter && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cover Letter</Text>
            <Text style={styles.coverLetterText}>{application.cover_letter}</Text>
          </View>
        )}

        {/* Resume */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resume</Text>
          {application.resume_url ? (
            <TouchableOpacity style={styles.resumeButton} onPress={handleViewResume}>
              <Ionicons name="document-text-outline" size={24} color={theme.primary} />
              <Text style={styles.resumeButtonText}>View Resume</Text>
              <Ionicons name="open-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.noResumeText}>No resume uploaded</Text>
          )}
        </View>

        {/* Application Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Application Details</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
            <Text style={styles.infoLabel}>Applied:</Text>
            <Text style={styles.infoValue}>
              {new Date(application.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Actions */}
        {actions.length > 0 && (
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionsRow}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.actionButton, { backgroundColor: action.color }]}
                  onPress={action.onPress}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.actionButtonText}>{action.label}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
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
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      marginBottom: 24,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    section: {
      marginBottom: 24,
      padding: 16,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    infoLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
      minWidth: 60,
    },
    infoValue: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
    },
    coverLetterText: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.text,
    },
    resumeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: theme.primary + '10',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary,
      gap: 8,
    },
    resumeButtonText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: theme.primary,
    },
    noResumeText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontStyle: 'italic',
      textAlign: 'center',
      padding: 16,
    },
    actionsSection: {
      marginTop: 8,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      flex: 1,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 50,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
