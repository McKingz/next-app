/**
 * AI Quota Allocation Management Screen
 * 
 * Allows principals/admins to allocate AI quotas to teachers
 * Shows usage analytics and optimization suggestions
 * 
 * Complies with WARP.md:
 * - Mobile-first design with touch-friendly controls
 * - Accessibility (WCAG 2.1 AA compliant)
 * - No mock data - graceful empty states
 * - Multi-tenant security with role-based access
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  Pressable,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
// import Animated, {
//   useAnimatedStyle,
//   withSpring,
//   interpolateColor,
// } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
// import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

import { useAIAllocationManagement } from '@/lib/ai/hooks/useAIAllocation';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '@/contexts/ThemeContext';
import { canManageAllocationsRole, derivePreschoolId } from '@/lib/roleUtils';
import type { TeacherAIAllocation } from '@/lib/ai/allocation';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

// Colors will be replaced with theme

interface AllocationFormData {
  teacher_id: string;
  allocated_quotas: Record<string, number>;
  priority_level: 'low' | 'normal' | 'high';
  auto_renewal: boolean;
  reason: string;
}

export default function AllocationManagementScreen() {
  const { theme } = useTheme();
  const { profile, loading: authLoading } = useAuth();
  const { t } = useTranslation('common');
  const router = useRouter();
  const {
    schoolSubscription,
    teacherAllocations,
    canManageAllocations,
    isLoading,
    errors,
    allocateQuotas,
    // bulkAllocateQuotas, // TODO: Implement bulk allocation UI
    isAllocating,
    // isBulkAllocating, // TODO: Implement bulk allocation UI
    refetch,
  } = useAIAllocationManagement();

  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherAIAllocation | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Check profile data completeness and role permissions
  const preschoolId = derivePreschoolId(profile);
  const hasCompleteProfileData = !!(profile && preschoolId);
  const roleBasedAccess = canManageAllocationsRole(profile?.role);
  const showPartialDataBanner = roleBasedAccess && !hasCompleteProfileData;
  
  // Enhanced role checking - only principals, principal_admins, and super_admins can manage AI allocations
  const allowedRoles = ['principal', 'principal_admin', 'super_admin'];
  const hasValidRole = profile?.role && allowedRoles.includes(profile.role);

  // Filter teachers based on search
  const filteredTeachers = teacherAllocations.filter((teacher) =>
    teacher.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.teacher_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetch.schoolSubscription?.(),
      refetch.teacherAllocations?.(),
    ].filter(Boolean));
    setRefreshing(false);
  };

  // Create base container style first for early returns
  const baseContainerStyle = {
    flex: 1,
    backgroundColor: theme.background,
  };

  // Auth loading state
  if (authLoading) {
    return (
      <SafeAreaView style={baseContainerStyle}>
        <LoadingState message={t('ai_quota.loading_profile', { defaultValue: 'Loading your profile...' })} />
      </SafeAreaView>
    );
  }

  // Enhanced role-based access control
  if (!hasValidRole && !canManageAllocations) {
    return (
      <SafeAreaView style={baseContainerStyle}>
        <EmptyState
          icon="lock-closed-outline"
          title={t('ai_quota.access_restricted_title', { defaultValue: 'Access Restricted' })}
          description={t('ai_quota.access_restricted_desc', { defaultValue: "Only principals and administrators can manage AI allocations. Please contact your school administrator if you need access." })}
          action={
            <Button onPress={() => router.back()} variant="outline">
              {t('common.go_back', { defaultValue: 'Go Back' })}
            </Button>
          }
        />
      </SafeAreaView>
    );
  }

  // Loading state
  if (isLoading.schoolSubscription || isLoading.teacherAllocations) {
    return (
      <SafeAreaView style={baseContainerStyle}>
        <LoadingState message={t('ai_quota.loading_data', { defaultValue: 'Loading allocation data...' })} />
      </SafeAreaView>
    );
  }

  // Error state with more details
  if (errors.schoolSubscription || errors.teacherAllocations) {
    console.log('AI Allocation Errors:', {
      schoolSubscription: errors.schoolSubscription,
      teacherAllocations: errors.teacherAllocations,
      permissions: errors.permissions
    });
    
    return (
      <SafeAreaView style={baseContainerStyle}>
        <EmptyState
          icon="alert-circle-outline"
          title={t('ai_quota.failed_load_title', { defaultValue: 'Failed to Load AI Data' })}
          description={t('ai_quota.failed_load_desc', { defaultValue: 'Unable to load allocation data.' })}
          action={
            <Button onPress={handleRefresh} variant="outline">
              {t('ai_quota.retry', { defaultValue: 'Retry Loading' })}
            </Button>
          }
        />
      </SafeAreaView>
    );
  }

  // Create styles with theme inside component scope
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
    },
    header: {
      padding: 16,
      paddingBottom: 16,
    },
    title: {
      marginBottom: 4,
    },
    fallbackCard: {
      marginHorizontal: 16,
      marginVertical: 20,
      padding: 28,
      alignItems: 'center',
    },
    fallbackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    fallbackTitle: {
      marginLeft: 12,
    },
    fallbackDescription: {
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 20,
    },
    featureList: {
      width: '100%',
      marginBottom: 20,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      paddingLeft: 8,
    },
    featureText: {
      marginLeft: 8,
      flex: 1,
    },
    comingSoonText: {
      textAlign: 'center',
      fontStyle: 'italic',
    },
    subscriptionCard: {
      marginHorizontal: 16,
      marginVertical: 16,
      padding: 24,
    },
    subscriptionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    subscriptionTitle: {
      flex: 1,
    },
    quotaOverview: {
      marginBottom: 16,
    },
    quotaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    progressBar: {
      marginVertical: 8,
    },
    utilizationText: {
      textAlign: 'center',
    },
    quotaDetails: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 12,
    },
    quotaDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    serviceName: {
      flex: 1,
    },
    actionsContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 16,
      gap: 12,
    },
    primaryAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonIcon: {
      marginRight: 8,
    },
    searchContainer: {
      paddingHorizontal: 16,
      marginBottom: 24,
      marginTop: 12,
    },
    searchInput: {
      backgroundColor: theme.surface,
    },
    listContainer: {
      flex: 1,
    },
    sectionTitle: {
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    listContent: {
      paddingBottom: 32,
      paddingTop: 12,
    },
    teacherCard: {
      marginBottom: 48,
      marginTop: 12,
      marginHorizontal: 16,
    },
    teacherCardContent: {
      padding: 24,
    },
    teacherHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    teacherInfo: {
      flex: 1,
      marginRight: 12,
    },
    teacherName: {
      marginBottom: 2,
    },
    teacherStatus: {
      flexDirection: 'row',
      gap: 8,
    },
    priorityBadge: {
      marginLeft: 4,
    },
    usageOverview: {
      marginBottom: 16,
    },
    usageLabel: {
      marginBottom: 4,
    },
    usageProgress: {
      marginVertical: 4,
    },
    allocationDetails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 12,
      gap: 16,
    },
    serviceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minWidth: 80,
    },
    serviceLabel: {
      textTransform: 'capitalize',
    },
    serviceQuota: {
      fontWeight: '500',
    },
    lastUpdated: {
      marginTop: 8,
      fontStyle: 'italic',
    },
    sectionSeparator: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: 24,
      marginHorizontal: 16,
      opacity: 0.5,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalContent: {
      flex: 1,
      padding: 16,
    },
    modalButton: {
      marginTop: 16,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
    },
    bannerText: {
      marginLeft: 8,
      flex: 1,
      fontWeight: '500',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="title1" style={styles.title}>
            AI Quota Management
          </Text>
          <Text variant="caption1" color="secondary">
            {profile?.organization_name || 'Your School'}
          </Text>
        </View>
        
        {/* Partial data banner */}
        {showPartialDataBanner && (
          <View style={[styles.banner, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
            <Ionicons name="information-circle" size={20} color={theme.warning} />
            <Text variant="caption1" style={[styles.bannerText, { color: theme.warning }]}>
              We're finalizing your profile. You can still allocate by searching for teachers in your school.
            </Text>
          </View>
        )}

        {/* Show fallback UI only when there's no data AND no subscription */}
        {!schoolSubscription && filteredTeachers.length === 0 && (
          <Card style={styles.fallbackCard}>
            <View style={styles.fallbackHeader}>
              <Ionicons name="construct" size={32} color={theme.warning} />
              <Text variant="title2" style={styles.fallbackTitle}>
                AI Quota Management
              </Text>
            </View>
            
            <Text variant="body" style={styles.fallbackDescription}>
              This feature allows principals to allocate AI usage credits to teachers and manage AI resource distribution across your school.
            </Text>
            
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                <Text variant="caption1" style={styles.featureText}>Allocate AI credits to individual teachers</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                <Text variant="caption1" style={styles.featureText}>Monitor usage across your school</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                <Text variant="caption1" style={styles.featureText}>Set usage limits and priorities</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                <Text variant="caption1" style={styles.featureText}>View allocation history and analytics</Text>
              </View>
            </View>
            
            <Text variant="caption2" style={styles.comingSoonText}>
              📡 Setting up your school's AI quota system. You can start allocating quotas to your teachers.
            </Text>
          </Card>
        )}
        
        {/* Add Allocation Button - only show if user can manage allocations */}
        {canManageAllocations && (
          <View style={styles.actionsContainer}>
            <Button
              onPress={() => setShowAllocationModal(true)}
              variant="primary"
              style={styles.primaryAction}
            >
              Allocate Quotas
            </Button>
            <Button
              onPress={handleRefresh}
              variant="outline"
              style={styles.secondaryAction}
            >
              Refresh Data
            </Button>
          </View>
        )}

        {/* School Subscription Overview */}
        {schoolSubscription && (
          <>
            <SchoolSubscriptionCard subscription={schoolSubscription} theme={theme} styles={styles} />
            <View style={styles.sectionSeparator} />
          </>
        )}

        {/* Search */}
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search teachers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon="search"
            style={styles.searchInput}
            accessibilityLabel="Search teachers"
          />
        </View>

        {/* Teacher Allocations List */}
        <View style={styles.listContainer}>
          <Text variant="headline" style={styles.sectionTitle}>
            Teacher Allocations ({filteredTeachers.length})
          </Text>
          
          {filteredTeachers.length === 0 ? (
            <EmptyState
              icon={searchQuery ? "search" : "person-add-outline"}
              title={searchQuery ? "No matches found" : "No allocations yet"}
              description={
                searchQuery
                  ? "Try adjusting your search terms"
                  : "Start by allocating AI quotas to your teachers"
              }
              compact
            />
          ) : (
            <FlashList
              data={filteredTeachers}
              renderItem={({ item }) => (
                <TeacherAllocationCard
                  allocation={item}
                  theme={theme}
                  styles={styles}
                  onEdit={() => {
                    setSelectedTeacher(item);
                    setShowAllocationModal(true);
                  }}
                />
              )}
              keyExtractor={(item) => item.id}
              estimatedItemSize={120}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </ScrollView>

      {/* Allocation Modal */}
      <AllocationModal
        visible={showAllocationModal}
        teacher={selectedTeacher}
        schoolSubscription={schoolSubscription}
        onClose={() => {
          setShowAllocationModal(false);
          setSelectedTeacher(null);
        }}
        onSubmit={async (formData) => {
          try {
            await allocateQuotas({
              teacherId: formData.teacher_id || selectedTeacher?.user_id || '',
              quotas: formData.allocated_quotas,
              options: {
                reason: formData.reason,
                priority_level: formData.priority_level,
                auto_renew: formData.auto_renewal,
              },
            });
            
            setShowAllocationModal(false);
            setSelectedTeacher(null);
            
            Alert.alert(
              'Success',
              `AI quotas allocated to ${selectedTeacher?.teacher_name || 'teacher'}`,
              [{ text: 'OK' }]
            );
            
            // Refresh data after successful allocation
            await handleRefresh();
          } catch (error) {
            console.error('Allocation error:', error);
            Alert.alert(
              'Error',
              error instanceof Error ? error.message : 'Failed to allocate quotas',
              [{ text: 'OK' }]
            );
          }
        }}
        loading={isAllocating}
      />
    </SafeAreaView>
  );
}

// School Subscription Card Component
function SchoolSubscriptionCard({ subscription, theme, styles }: { subscription: any; theme: any; styles: any }) {
  const totalAllocated = (Object.values(subscription?.allocated_quotas || {}) as number[]).reduce(
    (sum: number, quota: number) => sum + quota,
    0
  );
  const totalAvailable = (Object.values(subscription?.total_quotas || {}) as number[]).reduce(
    (sum: number, quota: number) => sum + quota,
    0
  );
  const utilization = totalAvailable > 0 ? (totalAllocated / totalAvailable) * 100 : 0;

  return (
    <Card style={styles.subscriptionCard}>
      <View style={styles.subscriptionHeader}>
        <Text variant="headline" style={styles.subscriptionTitle}>
          Subscription Overview
        </Text>
        <Badge variant={subscription?.subscription_tier === 'enterprise' ? 'success' : 'primary'}>
          {subscription?.subscription_tier?.toUpperCase() || 'BASIC'}
        </Badge>
      </View>

      <View style={styles.quotaOverview}>
        <View style={styles.quotaRow}>
          <Text variant="subheadline" color="secondary">
            Total Quotas Allocated
          </Text>
          <Text variant="title3">
            {totalAllocated} / {totalAvailable}
          </Text>
        </View>
        
        <ProgressBar
          progress={utilization / 100}
          color={utilization > 90 ? theme.error : utilization > 70 ? theme.warning : theme.success}
          style={styles.progressBar}
        />
        
        <Text variant="caption1" color="secondary" style={styles.utilizationText}>
          {utilization.toFixed(1)}% allocated
        </Text>
      </View>

      <View style={styles.quotaDetails}>
        {Object.entries(subscription?.total_quotas || {}).map(([service, total]) => {
          const allocated = (subscription?.allocated_quotas as Record<string, number>)?.[service] || 0;
          const available = (total as number) - allocated;
          
          return (
            <View key={service} style={styles.quotaDetailRow}>
              <Text variant="footnote" style={styles.serviceName}>
                {service.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
              <Text variant="footnote" color="secondary">
                {available} available
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// Teacher Allocation Card Component
function TeacherAllocationCard({
  allocation,
  theme,
  styles,
  onEdit,
}: {
  allocation: TeacherAIAllocation;
  theme: any;
  styles: any;
  onEdit: () => void;
}) {
  const totalAllocated = (Object.values(allocation?.allocated_quotas || {}) as number[]).reduce(
    (sum: number, quota: number) => sum + quota,
    0
  );
  const totalUsed = (Object.values(allocation?.used_quotas || {}) as number[]).reduce(
    (sum: number, quota: number) => sum + quota,
    0
  );
  const utilization = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;

  return (
    <Card style={styles.teacherCard}>
      <Pressable
        onPress={onEdit}
        style={styles.teacherCardContent}
        accessibilityRole="button"
        accessibilityLabel={`Edit allocation for ${allocation.teacher_name}`}
      >
        <View style={styles.teacherHeader}>
          <View style={styles.teacherInfo}>
            <Text variant="headline" style={styles.teacherName}>
              {allocation.teacher_name || 'Unknown Teacher'}
            </Text>
            <Text variant="caption1" color="secondary">
              {allocation.teacher_email || 'No email'}
            </Text>
          </View>
          
          <View style={styles.teacherStatus}>
            <Badge
              variant={allocation.is_active ? 'success' : 'secondary'}
              size="small"
            >
              {allocation.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {allocation.priority_level !== 'normal' && allocation.priority_level && (
              <Badge
                variant={allocation.priority_level === 'high' ? 'error' : 'warning'}
                size="small"
                style={styles.priorityBadge}
              >
                {allocation.priority_level.toUpperCase()}
              </Badge>
            )}
          </View>
        </View>

        <View style={styles.usageOverview}>
          <Text variant="caption1" color="secondary" style={styles.usageLabel}>
            Quota Usage
          </Text>
          <ProgressBar
            progress={utilization / 100}
            color={utilization > 90 ? theme.error : utilization > 70 ? theme.warning : theme.success}
            style={styles.usageProgress}
          />
          <Text variant="caption2" color="secondary">
            {totalUsed} of {totalAllocated} used ({utilization.toFixed(1)}%)
          </Text>
        </View>

        <View style={styles.allocationDetails}>
          {Object.entries(allocation?.allocated_quotas || {}).map(([service, quota]) => {
            const used = (allocation?.used_quotas as Record<string, number>)?.[service] || 0;
            const remaining = (quota as number) - used;
            
            return (
              <View key={service} style={styles.serviceRow}>
                <Text variant="caption2" style={styles.serviceLabel}>
                  {service.replace('_', ' ')}
                </Text>
                <Text
                  variant="caption2"
                  color={remaining <= 0 ? 'error' : 'secondary'}
                  style={styles.serviceQuota}
                >
                  {remaining} left
                </Text>
              </View>
            );
          })}
        </View>

        <Text variant="caption2" color="secondary" style={styles.lastUpdated}>
          Updated recently
        </Text>
      </Pressable>
    </Card>
  );
}

// Allocation Modal Component
function AllocationModal({
  visible,
  teacher,
  schoolSubscription,
  onClose,
  onSubmit,
  loading,
}: {
  visible: boolean;
  teacher?: TeacherAIAllocation | null;
  schoolSubscription: any;
  onClose: () => void;
  onSubmit: (data: AllocationFormData) => void;
  loading: boolean;
}) {
  const { theme } = useTheme();
  
  // Form state
  const [quotas, setQuotas] = useState<Record<string, number>>({
'lesson_generation': (teacher?.allocated_quotas as Record<string, number>)?.['lesson_generation'] || 0,
'grading_assistance': (teacher?.allocated_quotas as Record<string, number>)?.['grading_assistance'] || 0,
'homework_help': (teacher?.allocated_quotas as Record<string, number>)?.['homework_help'] || 0,
'speech_to_text': 0,
  });
  const [priorityLevel, setPriorityLevel] = useState<string>(teacher?.priority_level || 'normal');
  const [autoRenewal, setAutoRenewal] = useState<boolean>(teacher?.auto_renew || false);
  const [reason, setReason] = useState<string>('');
  
// Available services and their max allocations based on subscription
const availableServices = [
    { key: 'lesson_generation', label: 'Lesson Generation', max: Math.floor((schoolSubscription?.total_quotas?.lesson_generation || 50) / 2) },
    { key: 'grading_assistance', label: 'Grading Assistance', max: Math.floor((schoolSubscription?.total_quotas?.grading_assistance || 25) / 2) },
    { key: 'homework_help', label: 'Homework Help', max: Math.floor((schoolSubscription?.total_quotas?.homework_help || 75) / 2) },
  ];
  
  const handleSubmit = () => {
    if (!teacher?.user_id && !teacher?.id) {
      Alert.alert('Error', 'Please select a teacher to allocate quotas to.');
      return;
    }
    
    const formData: AllocationFormData = {
      teacher_id: teacher?.user_id || teacher?.id || '',
      allocated_quotas: quotas,
      priority_level: priorityLevel as 'low' | 'normal' | 'high',
      auto_renewal: autoRenewal,
      reason,
    };
    
    onSubmit(formData);
  };
  
  const updateQuota = (service: string, value: number) => {
    setQuotas(prev => ({ ...prev, [service]: Math.max(0, value) }));
  };
  
  const modalStyles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalContent: {
      flex: 1,
      padding: 16,
    },
    scrollContent: {
      flexGrow: 1,
    },
    teacherInfo: {
      backgroundColor: theme.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
    },
    sectionTitle: {
      marginBottom: 16,
      marginTop: 24,
    },
    serviceRow: {
      marginBottom: 20,
    },
    serviceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    quotaControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    quotaButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quotaInput: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      minWidth: 80,
      textAlign: 'center',
      marginHorizontal: 16,
      color: theme.text,
    },
    priorityContainer: {
      marginBottom: 24,
    },
    priorityOptions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    priorityOption: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      marginHorizontal: 4,
      alignItems: 'center',
    },
    priorityOptionSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    reasonInput: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      minHeight: 100,
      textAlignVertical: 'top',
      color: theme.text,
      marginBottom: 24,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    button: {
      flex: 1,
    },
  });
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modalStyles.modalContainer}>
        <View style={modalStyles.modalHeader}>
          <Text variant="title2">
            {teacher ? 'Edit Allocation' : 'New Allocation'}
          </Text>
          <Pressable onPress={onClose} accessibilityLabel="Close modal">
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>
        
        <ScrollView style={modalStyles.modalContent} contentContainerStyle={modalStyles.scrollContent}>
          {teacher && (
            <View style={modalStyles.teacherInfo}>
              <Text variant="title3" style={{ marginBottom: 4 }}>
                {teacher.teacher_name || 'Unknown Teacher'}
              </Text>
              <Text variant="caption1" color="secondary">
                {teacher.teacher_email || 'No email'}
              </Text>
              <Text variant="caption2" color="secondary">
                Current Status: {teacher.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          )}
          
          <Text variant="title3" style={modalStyles.sectionTitle}>
            Service Quotas
          </Text>
          
          {availableServices.map(service => (
            <View key={service.key} style={modalStyles.serviceRow}>
              <View style={modalStyles.serviceHeader}>
                <Text variant="body" style={{ fontWeight: '600' }}>
                  {service.label}
                </Text>
                <Text variant="caption2" color="secondary">
                  Max: {service.max}
                </Text>
              </View>
              
              <View style={modalStyles.quotaControls}>
                <Pressable
                  style={modalStyles.quotaButton}
                  onPress={() => updateQuota(service.key, quotas[service.key] - 10)}
                >
                  <Ionicons name="remove" size={20} color="white" />
                </Pressable>
                
                <TextInput
                  style={modalStyles.quotaInput}
                  value={quotas[service.key].toString()}
                  onChangeText={(text) => {
                    const value = parseInt(text) || 0;
                    updateQuota(service.key, Math.min(value, service.max));
                  }}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
                
                <Pressable
                  style={modalStyles.quotaButton}
                  onPress={() => updateQuota(service.key, Math.min(quotas[service.key] + 10, service.max))}
                >
                  <Ionicons name="add" size={20} color="white" />
                </Pressable>
              </View>
            </View>
          ))}
          
          <Text variant="title3" style={modalStyles.sectionTitle}>
            Priority Level
          </Text>
          
          <View style={modalStyles.priorityContainer}>
            <View style={modalStyles.priorityOptions}>
              {[{ key: 'low', label: 'Low' }, { key: 'normal', label: 'Normal' }, { key: 'high', label: 'High' }].map(priority => (
                <Pressable
                  key={priority.key}
                  style={[
                    modalStyles.priorityOption,
                    priorityLevel === priority.key && modalStyles.priorityOptionSelected
                  ]}
                  onPress={() => setPriorityLevel(priority.key)}
                >
                  <Text
                    variant="body"
                    color={priorityLevel === priority.key ? 'white' : 'primary'}
                    style={{ fontWeight: '600' }}
                  >
                    {priority.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          
          <View style={modalStyles.switchRow}>
            <Text variant="body" style={{ fontWeight: '600' }}>
              Auto-Renewal
            </Text>
            <Switch
              value={autoRenewal}
              onValueChange={setAutoRenewal}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          
          <Text variant="title3" style={modalStyles.sectionTitle}>
            Reason (Optional)
          </Text>
          
          <TextInput
            style={modalStyles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Enter reason for this allocation..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
          />
        </ScrollView>
        
        <View style={modalStyles.buttonContainer}>
          <Button
            onPress={onClose}
            variant="outline"
            style={modalStyles.button}
            disabled={loading}
          >
            Cancel
          </Button>
          
          <Button
            onPress={handleSubmit}
            style={modalStyles.button}
            loading={loading}
            disabled={loading}
          >
            {teacher ? 'Update Allocation' : 'Create Allocation'}
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

