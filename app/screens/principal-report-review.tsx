/**
 * Principal Report Review Screen
 * 
 * Allows principals to review, approve, or reject pending progress reports
 * with digital signature capture
 * 
 * References:
 * - React Native 0.79: https://reactnative.dev/docs/0.79/
 * - Expo Router v5: https://docs.expo.dev/router/introduction/
 * - TanStack Query v5: https://tanstack.com/query/v5/docs/framework/react/overview
 * - FlashList: https://shopify.github.io/flash-list/docs/
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ProgressReportService, type ProgressReport } from '@/services/ProgressReportService';
import { ReportApprovalCard } from '@/components/progress-report/ReportApprovalCard';
import { ApprovalStatusBadge } from '@/components/progress-report/ApprovalStatusBadge';
import { SignatureDisplay } from '@/components/progress-report/SignatureDisplay';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { notifyReportApproved, notifyReportRejected } from '@/services/notification-service';

/**
 * PrincipalReportReview - Screen for reviewing pending reports
 * 
 * Features:
 * - List of pending reports (status='pending_review')
 * - FlashList for performance
 * - Modal for detailed review
 * - Approve flow with principal signature
 * - Reject flow with required reason
 * - Role-based access control
 * 
 * Security:
 * - Only accessible to principals
 * - Multi-tenant filtered by preschool_id
 * - RLS enforced server-side
 */
export default function PrincipalReportReviewScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Derive preschool/school ID robustly (profiles may use organization_id on web)
  const schoolId = (profile as any)?.preschool_id || profile?.organization_id || (user as any)?.user_metadata?.preschool_id || null;

  // State
  const [selectedReport, setSelectedReport] = useState<ProgressReport | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [principalSignature, setPrincipalSignature] = useState<string>('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Fetch pending reports
  const { data: reports = [], isLoading, error, refetch } = useQuery({
    queryKey: ['pending-reports', schoolId],
    queryFn: async () => {
      if (!schoolId || !user?.id) return [];
      return ProgressReportService.getReportsForReview(
        schoolId as string,
        user.id
      );
    },
    enabled: !!schoolId && !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Poll every minute as backup
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!schoolId) return;

    const channel = supabase
      .channel('progress_reports_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'progress_reports',
          filter: `preschool_id=eq.${schoolId}`,
        },
        (payload) => {
          console.log('[PrincipalReview] Real-time update:', payload);
          // Refetch reports when any change occurs
          queryClient.invalidateQueries({ queryKey: ['pending-reports', schoolId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [schoolId, queryClient]);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReport || !principalSignature || !profile?.preschool_id || !user?.id) {
        throw new Error('Missing required data');
      }
      const success = await ProgressReportService.approveReport(
        selectedReport.id,
        schoolId as string,
        user.id,
        principalSignature,
        approvalNotes || undefined
      );
      if (!success) throw new Error('Failed to approve report');
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['pending-reports', schoolId] });
      
      // Send notification to teacher
      if (selectedReport && schoolId) {
        try {
          await notifyReportApproved(
            selectedReport.id,
            selectedReport.student_id,
            schoolId as string
          );
          console.log('Approval notification sent to teacher');
        } catch (notifError: any) {
          console.error('Failed to send notification:', notifError);
        }
      }
      
      setShowApproveModal(false);
      setSelectedReport(null);
      setPrincipalSignature('');
      setApprovalNotes('');
      Alert.alert('Success', 'Report approved successfully. Teacher has been notified.');
    },
    onError: (error: Error) => {
      Alert.alert('Error', `Failed to approve report: ${error.message}`);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReport || !rejectionReason.trim() || !profile?.preschool_id || !user?.id) {
        throw new Error('Missing required data');
      }
      if (rejectionReason.trim().length < 10) {
        throw new Error('Rejection reason must be at least 10 characters');
      }
      const success = await ProgressReportService.rejectReport(
        selectedReport.id,
        schoolId as string,
        user.id,
        rejectionReason,
        approvalNotes || undefined
      );
      if (!success) throw new Error('Failed to reject report');
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['pending-reports', schoolId] });
      
      // Send notification to teacher
      if (selectedReport && schoolId && rejectionReason) {
        try {
          await notifyReportRejected(
            selectedReport.id,
            selectedReport.student_id,
            schoolId as string,
            rejectionReason
          );
          console.log('Rejection notification sent to teacher');
        } catch (notifError: any) {
          console.error('Failed to send notification:', notifError);
        }
      }
      
      setShowRejectModal(false);
      setSelectedReport(null);
      setRejectionReason('');
      setApprovalNotes('');
      Alert.alert('Success', 'Report rejected. Teacher has been notified.');
    },
    onError: (error: Error) => {
      Alert.alert('Error', `Failed to reject report: ${error.message}`);
    },
  });

  // Handlers
  const handleReportPress = useCallback((report: ProgressReport) => {
    setSelectedReport(report);
  }, []);

  const handleApprovePress = useCallback(() => {
    setShowApproveModal(true);
  }, []);

  const handleRejectPress = useCallback(() => {
    setShowRejectModal(true);
  }, []);

  const handleSignatureSaved = useCallback((signature: string) => {
    setPrincipalSignature(signature);
    setShowSignaturePad(false);
  }, []);

  const handleConfirmApprove = useCallback(() => {
    if (!principalSignature) {
      Alert.alert('Signature Required', 'Please sign before approving the report.');
      return;
    }
    approveMutation.mutate();
  }, [principalSignature, approveMutation]);

  const handleConfirmReject = useCallback(() => {
    if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
      Alert.alert('Reason Required', 'Please provide a rejection reason (minimum 10 characters).');
      return;
    }
    rejectMutation.mutate();
  }, [rejectionReason, rejectMutation]);

  const handleCloseDetail = useCallback(() => {
    setSelectedReport(null);
    setPrincipalSignature('');
    setApprovalNotes('');
    setRejectionReason('');
  }, []);

  // Security: Check if user is principal (after all hooks)
  const isPrincipal = ['principal', 'principal_admin', 'superadmin'].includes(
    profile?.role || ''
  );

  // Get full name for signature display
  const principalName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Principal';

  if (!isPrincipal) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>
            Access denied. This screen is only available to principals.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state with pull-to-refresh
  if (!isLoading && reports.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.emptyState}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={theme.primary}
            />
          }
        >
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No Pending Reports
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            There are no reports awaiting your review at this time.
          </Text>
          <Text style={[styles.emptyHint, { color: theme.textSecondary, marginTop: 8 }]}>
            Pull down to refresh
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Review Reports
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          {reports.length} pending {reports.length === 1 ? 'report' : 'reports'}
        </Text>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlashList
          data={reports}
          renderItem={({ item }) => (
            <ReportApprovalCard report={item} onPress={() => handleReportPress(item)} />
          )}
          keyExtractor={(item) => item.id}
          estimatedItemSize={120}
          contentContainerStyle={styles.listContent}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {/* Detail Modal */}
      {selectedReport && (
        <Modal
          visible={!!selectedReport}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleCloseDetail}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Review Report
                </Text>
                <TouchableOpacity onPress={handleCloseDetail} style={styles.closeButton}>
                  <Text style={[styles.closeButtonText, { color: theme.primary }]}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Student Info */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Student: {selectedReport.student_name}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Teacher: {selectedReport.teacher_name}
                </Text>
                <ApprovalStatusBadge status={selectedReport.status} />
              </View>

              {/* Teacher Signature */}
              {selectedReport.teacher_signature_data && selectedReport.teacher_signed_at && (
                <View style={styles.section}>
                  <SignatureDisplay
                    signatureData={selectedReport.teacher_signature_data}
                    signerName={selectedReport.teacher_name || 'Teacher'}
                    signerRole="teacher"
                    signedAt={selectedReport.teacher_signed_at}
                  />
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  onPress={handleRejectPress}
                  style={[styles.button, styles.rejectButton, { borderColor: theme.error }]}
                >
                  <Text style={[styles.buttonText, { color: theme.error }]}>
                    Reject
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleApprovePress}
                  style={[styles.button, styles.approveButton, { backgroundColor: theme.primary }]}
                >
                  <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                    Approve & Sign
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Approve Modal */}
      <Modal visible={showApproveModal} animationType="slide" transparent>
        <View style={styles.overlayModal}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalCardTitle, { color: theme.text }]}>
              Approve Report
            </Text>
            
            {principalSignature ? (
              <SignatureDisplay
                signatureData={principalSignature}
                signerName={principalName}
                signerRole="principal"
                signedAt={new Date().toISOString()}
                height={60}
              />
            ) : (
              <TouchableOpacity
                onPress={() => setShowSignaturePad(true)}
                style={[styles.signButton, { borderColor: theme.primary }]}
              >
                <Text style={[styles.signButtonText, { color: theme.primary }]}>
                  Add Signature
                </Text>
              </TouchableOpacity>
            )}

            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.border,
              }]}
              placeholder="Optional approval notes"
              placeholderTextColor={theme.textSecondary}
              value={approvalNotes}
              onChangeText={setApprovalNotes}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowApproveModal(false)}
                style={[styles.modalButton, { borderColor: theme.border }]}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmApprove}
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: theme.primary }]}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} animationType="slide" transparent>
        <View style={styles.overlayModal}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalCardTitle, { color: theme.text }]}>
              Reject Report
            </Text>
            
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.border,
              }]}
              placeholder="Rejection reason (required, min 10 characters)"
              placeholderTextColor={theme.textSecondary}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
            />

            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.border,
              }]}
              placeholder="Optional notes"
              placeholderTextColor={theme.textSecondary}
              value={approvalNotes}
              onChangeText={setApprovalNotes}
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowRejectModal(false)}
                style={[styles.modalButton, { borderColor: theme.border }]}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmReject}
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: theme.error }]}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Signature Pad */}
      <SignaturePad
        visible={showSignaturePad}
        signerName={principalName}
        signerRole="principal"
        onSave={handleSignatureSaved}
        onCancel={() => setShowSignaturePad(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  modalContainer: {
    flex: 1,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  rejectButton: {
    backgroundColor: 'transparent',
  },
  approveButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  overlayModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  signButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  signButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  confirmButton: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

/**
 * Documentation Sources:
 * - React Native 0.79 Modal: https://reactnative.dev/docs/0.79/modal
 * - Expo Router v5: https://docs.expo.dev/router/reference/hooks/
 * - TanStack Query v5 useMutation: https://tanstack.com/query/v5/docs/framework/react/reference/useMutation
 * - FlashList: https://shopify.github.io/flash-list/docs/fundamentals/performant-components
 */
