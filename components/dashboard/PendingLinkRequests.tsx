import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ParentJoinService, type GuardianRequestWithStudent } from '@/lib/services/parentJoinService';
import { format } from 'date-fns';
import { enZA } from 'date-fns/locale';

export function PendingLinkRequests() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Fetch parent's link requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ['guardian-requests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return await ParentJoinService.myRequestsWithStudents(user.id);
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Cancel/withdraw a pending request
  const handleCancel = async (requestId: string, childName: string) => {
    Alert.alert(
      'Withdraw Request?',
      `Are you sure you want to withdraw your request to link ${childName}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Withdraw',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            
            setCancellingId(requestId);
            try {
              await ParentJoinService.cancel(requestId, user.id);
              
              // Invalidate queries to refresh
              queryClient.invalidateQueries({ queryKey: ['guardian-requests', user.id] });
              
              Alert.alert('Request Withdrawn', 'Your link request has been cancelled.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to withdraw request');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  // Filter requests by status
  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const approvedRequests = requests?.filter(r => r.status === 'approved') || [];
  const rejectedRequests = requests?.filter(r => r.status === 'rejected') || [];

  // Don't show if no requests
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

  // Render status badge
  const renderStatusBadge = (status: string) => {
    const config = {
      pending: { icon: 'time-outline', color: '#F59E0B', label: 'Pending' },
      approved: { icon: 'checkmark-circle', color: '#059669', label: 'Approved' },
      rejected: { icon: 'close-circle', color: '#DC2626', label: 'Rejected' },
      cancelled: { icon: 'ban', color: '#6B7280', label: 'Withdrawn' },
    }[status] || { icon: 'help-circle', color: theme.textSecondary, label: status };

    return (
      <View style={[styles.badge, { backgroundColor: `${config.color}15` }]}>
        <Ionicons name={config.icon as any} size={14} color={config.color} />
        <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  };

  // Render a single request card
  const renderRequest = (request: GuardianRequestWithStudent) => {
    const childName = request.student 
      ? `${request.student.first_name} ${request.student.last_name}`
      : request.child_full_name || 'Unknown Child';
    
    const requestDate = format(new Date(request.created_at), 'dd MMM yyyy', { locale: enZA });
    const approvedDate = request.approved_at 
      ? format(new Date(request.approved_at), 'dd MMM yyyy', { locale: enZA })
      : null;

    return (
      <View key={request.id} style={[styles.requestCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <Text style={[styles.childName, { color: theme.text }]}>{childName}</Text>
            {request.child_class && (
              <Text style={[styles.childClass, { color: theme.textSecondary }]}>
                🎓 {request.child_class}
              </Text>
            )}
            {request.relationship && (
              <Text style={[styles.relationship, { color: theme.textSecondary }]}>
                Relationship: {request.relationship.charAt(0).toUpperCase() + request.relationship.slice(1)}
              </Text>
            )}
          </View>
          {renderStatusBadge(request.status)}
        </View>

        <View style={styles.requestMeta}>
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            Submitted: {requestDate}
          </Text>
          {approvedDate && request.status !== 'pending' && (
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
              {request.status === 'approved' ? 'Approved' : 'Reviewed'}: {approvedDate}
            </Text>
          )}
        </View>

        {/* Pending: Show cancel button */}
        {request.status === 'pending' && (
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.error }]}
            onPress={() => handleCancel(request.id, childName)}
            disabled={cancellingId === request.id}
          >
            {cancellingId === request.id ? (
              <ActivityIndicator size="small" color={theme.error} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={16} color={theme.error} />
                <Text style={[styles.cancelButtonText, { color: theme.error }]}>Withdraw</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Approved: Show success message */}
        {request.status === 'approved' && (
          <View style={[styles.messageBox, { backgroundColor: '#05966915', borderColor: '#059669' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#059669" />
            <Text style={[styles.messageText, { color: theme.text }]}>
              You can now view {childName.split(' ')[0]}'s progress and updates!
            </Text>
          </View>
        )}

        {/* Rejected: Show reason if available */}
        {request.status === 'rejected' && (
          <View style={[styles.messageBox, { backgroundColor: '#DC262615', borderColor: '#DC2626' }]}>
            <Ionicons name="information-circle" size={16} color="#DC2626" />
            <Text style={[styles.messageText, { color: theme.text }]}>
              {(request as any).rejection_reason || 'Request was not approved. Please contact the school for more information.'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Link Requests</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {pendingRequests.length} pending · {approvedRequests.length} approved
          </Text>
        </View>
        {pendingRequests.length > 0 && (
          <View style={[styles.pendingBadge, { backgroundColor: '#F59E0B' }]}>
            <Text style={styles.pendingBadgeText}>{pendingRequests.length}</Text>
          </View>
        )}
      </View>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>⏳ Awaiting Approval</Text>
          {pendingRequests.map(renderRequest)}
        </View>
      )}

      {/* Approved Requests (Show max 3) */}
      {approvedRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>✅ Approved</Text>
          {approvedRequests.slice(0, 3).map(renderRequest)}
          {approvedRequests.length > 3 && (
            <Text style={[styles.moreText, { color: theme.textSecondary }]}>
              +{approvedRequests.length - 3} more
            </Text>
          )}
        </View>
      )}

      {/* Rejected Requests (Show max 2) */}
      {rejectedRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>❌ Not Approved</Text>
          {rejectedRequests.slice(0, 2).map(renderRequest)}
          {rejectedRequests.length > 2 && (
            <Text style={[styles.moreText, { color: theme.textSecondary }]}>
              +{rejectedRequests.length - 2} more
            </Text>
          )}
        </View>
      )}
    </View>
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
    backgroundColor: '#F59E0B',
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
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  requestCard: {
    backgroundColor: '#0b1220',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a3442',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requestInfo: {
    flex: 1,
    marginRight: 12,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  childClass: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  relationship: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  requestMeta: {
    marginBottom: 8,
  },
  metaText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 6,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 12,
    color: '#fff',
    lineHeight: 16,
  },
  moreText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
