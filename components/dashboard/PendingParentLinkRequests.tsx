import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ParentJoinService } from '@/lib/services/parentJoinService';
import { format } from 'date-fns';
import { enZA } from 'date-fns/locale';

interface RequestWithDetails {
  id: string;
  parent_auth_id: string;
  student_id: string;
  status: string;
  relationship?: string;
  child_full_name?: string;
  child_class?: string;
  created_at: string;
  parent_email: string;
  parent_profile?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    avatar_url?: string | null;
  } | null;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    age_group?: { name: string };
  };
}

export function PendingParentLinkRequests() {
  const { user, session, profile } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestWithDetails | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Get organization/preschool ID from profile
  const organizationId = profile?.organization_id || (profile as any)?.preschool_id;

  // Fetch pending requests for school
  const { data: requests, isLoading } = useQuery({
    queryKey: ['pending-parent-link-requests', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      return await ParentJoinService.listPendingForSchoolWithDetails(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000, // 30 seconds (more frequent refresh for staff)
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });

  // Show approve confirmation modal
  const handleApprovePress = (request: RequestWithDetails) => {
    setSelectedRequest(request);
    setApproveModalVisible(true);
  };

  // Approve a link request
  const handleApprove = async () => {
    if (!selectedRequest || !user?.id) return;
    
    const childName = selectedRequest.student 
      ? `${selectedRequest.student.first_name} ${selectedRequest.student.last_name}`
      : selectedRequest.child_full_name || 'Unknown Child';
    
    setProcessingId(selectedRequest.id);
    setApproveModalVisible(false);
    
    try {
      await ParentJoinService.approve(selectedRequest.id, user.id);
      
      // Invalidate queries to refresh
      queryClient.invalidateQueries({ queryKey: ['pending-parent-link-requests', organizationId] });
      
      // Show success (web-compatible)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`✅ Approved: ${selectedRequest.parent_email} can now access ${childName.split(' ')[0]}'s information.`);
      }
    } catch (error: any) {
      // Show error (web-compatible)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`❌ Error: ${error.message || 'Failed to approve request'}`);
      }
    } finally {
      setProcessingId(null);
      setSelectedRequest(null);
    }
  };

  // Open rejection modal
  const handleRejectPress = (request: RequestWithDetails) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  // Reject a link request
  const handleReject = async () => {
    if (!selectedRequest || !user?.id) return;

    const childName = selectedRequest.student 
      ? `${selectedRequest.student.first_name} ${selectedRequest.student.last_name}`
      : selectedRequest.child_full_name || 'Unknown Child';

    setProcessingId(selectedRequest.id);
    setRejectModalVisible(false);

    try {
      await ParentJoinService.reject(selectedRequest.id, user.id, rejectionReason.trim() || undefined);
      
      // Invalidate queries to refresh
      queryClient.invalidateQueries({ queryKey: ['pending-parent-link-requests', organizationId] });
      
      // Show success (web-compatible)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`❌ Request Rejected: ${selectedRequest.parent_email}'s request for ${childName} has been rejected.`);
      }
    } catch (error: any) {
      // Show error (web-compatible)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`❌ Error: ${error.message || 'Failed to reject request'}`);
      }
    } finally {
      setProcessingId(null);
      setSelectedRequest(null);
      setRejectionReason('');
    }
  };

  // Don't show if no pending requests
  if (!isLoading && (!requests || requests.length === 0)) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  // Render a single request card
  const renderRequest = (request: RequestWithDetails) => {
    const childName = request.student 
      ? `${request.student.first_name} ${request.student.last_name}`
      : request.child_full_name || 'Unknown Child';
    
    const ageGroup = request.student?.age_group?.name || request.child_class || 'Unknown Class';
    const requestDate = format(new Date(request.created_at), 'dd MMM yyyy · HH:mm', { locale: enZA });
    const isProcessing = processingId === request.id;

    return (
      <View key={request.id} style={[styles.requestCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <Text style={[styles.parentEmail, { color: theme.text }]}>
              👤 {request.parent_profile?.first_name || ''} {request.parent_profile?.last_name || ''}
            </Text>
            <Text style={[styles.parentSub, { color: theme.textSecondary }]}>
              {request.parent_email}{request.parent_profile?.phone ? ` • 📞 ${request.parent_profile.phone}` : ''}
            </Text>
            <Text style={[styles.childName, { color: theme.primary }]}>
              wants to link: {childName}
            </Text>
            {request.relationship && (
              <Text style={[styles.relationship, { color: theme.textSecondary }]}>
                as {request.relationship.charAt(0).toUpperCase() + request.relationship.slice(1)}
              </Text>
            )}
            <Text style={[styles.classInfo, { color: theme.textSecondary }]}>
              🎓 {ageGroup}
            </Text>
            <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
              ⏰ {requestDate}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton, { borderColor: theme.error }]}
            onPress={() => handleRejectPress(request)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={theme.error} />
            ) : (
              <>
                <Ionicons name="close-circle" size={18} color={theme.error} />
                <Text style={[styles.actionButtonText, { color: theme.error }]}>Reject</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton, { backgroundColor: '#059669' }]}
            onPress={() => handleApprovePress(request)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Parent Link Requests</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {requests?.length || 0} pending approval
            </Text>
          </View>
          {requests && requests.length > 0 && (
            <View style={[styles.pendingBadge, { backgroundColor: '#DC2626' }]}>
              <Text style={styles.pendingBadgeText}>{requests.length}</Text>
            </View>
          )}
        </View>

        {/* Request List */}
        <View style={styles.requestList}>
          {requests?.map(renderRequest)}
        </View>

        {/* Helper Text */}
        <View style={[styles.helperBox, { backgroundColor: '#3B82F615', borderColor: '#3B82F6' }]}>
          <Ionicons name="information-circle" size={16} color="#3B82F6" />
          <Text style={[styles.helperText, { color: theme.text }]}>
            Review each request carefully. Approved parents will gain access to their child's information.
          </Text>
        </View>
      </View>

      {/* Approve Confirmation Modal */}
      <Modal
        visible={approveModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setApproveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Approve Link Request?</Text>
            
            {selectedRequest && (
              <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
                Are you sure you want to approve {selectedRequest.parent_email} as {selectedRequest.relationship || 'guardian'} for{' '}
                {selectedRequest.student 
                  ? `${selectedRequest.student.first_name} ${selectedRequest.student.last_name}`
                  : selectedRequest.child_full_name || 'this child'}?
              </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { borderColor: theme.border }]}
                onPress={() => setApproveModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalApproveButton, { backgroundColor: '#059669' }]}
                onPress={handleApprove}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>✓ Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Reject Request</Text>
            
            <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
              Optionally provide a reason for rejection. This will be shown to the parent.
            </Text>

            <TextInput
              style={[styles.reasonInput, { 
                backgroundColor: theme.background, 
                borderColor: theme.border,
                color: theme.text 
              }]}
              placeholder="Reason for rejection (optional)"
              placeholderTextColor={theme.textSecondary}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={3}
              maxLength={200}
            />

            <Text style={[styles.charCounter, { color: theme.textSecondary }]}>
              {rejectionReason.length} / 200
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { borderColor: theme.border }]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalRejectButton, { backgroundColor: '#DC2626' }]}
                onPress={handleReject}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Reject Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a2332',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a3442',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  pendingBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  requestList: {
    marginBottom: 12,
  },
  requestCard: {
    backgroundColor: '#0b1220',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a3442',
  },
  requestHeader: {
    marginBottom: 12,
  },
  requestInfo: {
    gap: 4,
  },
  parentEmail: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  childName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
    marginTop: 6,
  },
  parentSub: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  relationship: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  classInfo: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: 'transparent',
  },
  approveButton: {
    backgroundColor: '#059669',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
  },
  helperText: {
    flex: 1,
    fontSize: 12,
    color: '#fff',
    lineHeight: 16,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a2332',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
    lineHeight: 20,
  },
  reasonInput: {
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#2a3442',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: '#2a3442',
    backgroundColor: 'transparent',
  },
  modalRejectButton: {
    backgroundColor: '#DC2626',
  },
  modalApproveButton: {
    backgroundColor: '#059669',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
