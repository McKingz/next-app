import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import HiringHubService from '@/lib/services/HiringHubService';
import type { JobPosting, ApplicationWithDetails } from '@/types/hiring';
import {
  ApplicationStatus,
  getApplicationStatusColor,
  formatSalaryRange,
} from '@/types/hiring';

type TabType = 'new' | 'under_review' | 'shortlisted' | 'interview' | 'offered';

export default function HiringHubScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const preschoolId = profile?.organization_id || (profile as any)?.preschool_id;
  const [activeTab, setActiveTab] = useState<TabType>('new');

const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['hiring-hub-stats', preschoolId],
    queryFn: () => HiringHubService.getHiringHubStats(preschoolId!),
    enabled: !!preschoolId,
  });

  const { data: jobPostings, isLoading: postingsLoading, refetch: refetchPostings } = useQuery({
    queryKey: ['job-postings', preschoolId],
    queryFn: () => HiringHubService.getJobPostings(preschoolId!),
    enabled: !!preschoolId,
  });

  const { data: applications, isLoading: appsLoading, refetch: refetchApps } = useQuery({
    queryKey: ['applications', preschoolId],
    queryFn: () => HiringHubService.getApplicationsForSchool(preschoolId!),
    enabled: !!preschoolId,
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchPostings(), refetchApps()]);
    setRefreshing(false);
  }, [refetchStats, refetchPostings, refetchApps]);

  const filteredApplications = useMemo(() => {
    if (!applications) return [];
    const statusMap: Record<TabType, ApplicationStatus> = {
      new: ApplicationStatus.NEW,
      under_review: ApplicationStatus.UNDER_REVIEW,
      shortlisted: ApplicationStatus.SHORTLISTED,
      interview: ApplicationStatus.INTERVIEW_SCHEDULED,
      offered: ApplicationStatus.OFFERED,
    };
    return applications.filter((app) => app.status === statusMap[activeTab]);
  }, [applications, activeTab]);

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'new', label: 'New', count: stats?.pending_reviews || 0 },
    { key: 'under_review', label: 'Reviewing', count: 0 },
    { key: 'shortlisted', label: 'Shortlisted', count: stats?.shortlisted_candidates || 0 },
    { key: 'interview', label: 'Interview', count: stats?.scheduled_interviews || 0 },
    { key: 'offered', label: 'Offered', count: stats?.pending_offers || 0 },
  ];

  if (!preschoolId) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Hiring Hub', headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No school found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Hiring Hub', headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hiring Hub</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.active_job_postings || 0}</Text>
          <Text style={styles.statLabel}>Active Jobs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.total_applications || 0}</Text>
          <Text style={styles.statLabel}>Applications</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.pending_reviews || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Job Postings Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Job Postings</Text>
          <TouchableOpacity onPress={() => router.push('/screens/job-posting-create')}>
            <Text style={styles.linkText}>View All</Text>
          </TouchableOpacity>
        </View>
        {postingsLoading ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <FlatList
            horizontal
            data={(jobPostings || []).slice(0, 3)}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => <JobPostingCard job={item} theme={theme} styles={styles} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No job postings yet</Text>
            }
          />
        )}
      </View>

      {/* Applications Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          data={tabs}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tab, activeTab === item.key && styles.tabActive]}
              onPress={() => setActiveTab(item.key)}
            >
              <Text style={[styles.tabText, activeTab === item.key && styles.tabTextActive]}>
                {item.label}
              </Text>
              {item.count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Applications List */}
      {appsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredApplications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => (
            <ApplicationCard application={item} theme={theme} styles={styles} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No applications in this category</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/screens/job-posting-create')}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function JobPostingCard({ job, theme, styles }: { job: JobPosting; theme: any; styles: ReturnType<typeof createStyles> }) {
  return (
    <TouchableOpacity
      style={[styles.jobCard, { backgroundColor: theme.surface }]}
      onPress={() => console.log('Job detail view coming soon', job.id)}
    >
      <Text style={[styles.jobTitle, { color: theme.text }]} numberOfLines={1}>
        {job.title}
      </Text>
      <Text style={[styles.jobSalary, { color: theme.textSecondary }]}>
        {formatSalaryRange(job.salary_range_min, job.salary_range_max)}
      </Text>
      <View style={styles.jobFooter}>
        <Text style={[styles.jobLocation, { color: theme.textSecondary }]}>
          {job.location || 'Location not specified'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: theme.primary + '20' }]}>
          <Text style={[styles.statusText, { color: theme.primary }]}>{job.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ApplicationCard({ application, theme, styles }: { application: ApplicationWithDetails; theme: any; styles: ReturnType<typeof createStyles> }) {
  const statusColor = getApplicationStatusColor(application.status);
  
  return (
    <TouchableOpacity
      style={[styles.appCard, { backgroundColor: theme.surface }]}
      onPress={() => router.push(`/screens/application-review?id=${application.id}`)}
    >
      <View style={styles.appHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.appName, { color: theme.text }]}>
            {application.candidate_name}
          </Text>
          <Text style={[styles.appJob, { color: theme.textSecondary }]}>
            {application.job_title}
          </Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>
      <View style={styles.appFooter}>
        <Text style={[styles.appDate, { color: theme.textSecondary }]}>
          {new Date(application.applied_at).toLocaleDateString()}
        </Text>
        {application.has_resume && (
          <Ionicons name="document-attach" size={16} color={theme.primary} />
        )}
      </View>
    </TouchableOpacity>
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
    statsContainer: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    linkText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '600',
    },
    jobCard: {
      width: 200,
      padding: 16,
      borderRadius: 12,
      marginRight: 12,
    },
    jobTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    jobSalary: {
      fontSize: 14,
      marginBottom: 12,
    },
    jobFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    jobLocation: {
      fontSize: 12,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    tabsContainer: {
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginRight: 8,
      borderRadius: 20,
      backgroundColor: theme.surface,
      flexDirection: 'row',
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: theme.primary,
    },
    tabText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    tabTextActive: {
      color: '#FFFFFF',
    },
    badge: {
      marginLeft: 6,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      minWidth: 20,
      alignItems: 'center',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    listContent: {
      padding: 16,
      paddingBottom: 80,
    },
    appCard: {
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
    },
    appHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    appName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    appJob: {
      fontSize: 14,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginLeft: 8,
    },
    appFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    appDate: {
      fontSize: 12,
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: 16,
      color: theme.error,
    },
  });
