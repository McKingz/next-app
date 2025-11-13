import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { format } from 'date-fns';
import { enZA } from 'date-fns/locale';

interface RegistrationRequest {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_birth_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  requested_at: string;
  rejection_reason?: string | null;
}

export const PendingRegistrationRequests: React.FC = () => {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch pending registration requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ['child-registration-requests', user?.id],
    queryFn: async () => {
      const supabase = assertSupabase();
      
      // Get internal user ID
      const { data: userData } = await supabase
        .from('users')
        .select('id, preschool_id')
        .eq('auth_user_id', user!.id)
        .single();

      if (!userData?.id) return [];

      const { data, error } = await supabase
        .from('child_registration_requests')
        .select('*')
        .eq('parent_id', userData.id)
        .eq('preschool_id', userData.preschool_id!)
        .in('status', ['pending', 'approved', 'rejected'])
        .order('requested_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as RegistrationRequest[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation to withdraw request
  const withdrawMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const supabase = assertSupabase();
      const { error } = await supabase
        .from('child_registration_requests')
        .update({ status: 'withdrawn' })
        .eq('id', requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['child-registration-requests'] });
      Alert.alert('Success', 'Registration request withdrawn');
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.message || 'Failed to withdraw request');
    },
  });

  const handleWithdraw = (requestId: string, childName: string) => {
    Alert.alert(
      'Withdraw Request?',
      `Are you sure you want to withdraw the registration request for ${childName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () => withdrawMutation.mutate(requestId),
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return theme.warning || '#f59e0b';
      case 'approved':
        return theme.success;
      case 'rejected':
        return theme.error;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.primary + '10',
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primary,
      marginLeft: 4,
    },
    requestCard: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderLeftWidth: 4,
    },
    requestHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    childName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginLeft: 8,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 4,
      textTransform: 'capitalize',
    },
    requestDetails: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    rejectionReason: {
      fontSize: 13,
      color: theme.error,
      fontStyle: 'italic',
      marginTop: 4,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 6,
      borderWidth: 1,
    },
    withdrawButton: {
      borderColor: theme.error + '40',
      backgroundColor: theme.error + '10',
    },
    withdrawButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.error,
      marginLeft: 4,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    loadingContainer: {
      paddingVertical: 24,
      alignItems: 'center',
    },
  });

  if (!user?.id || !profile?.organization_id) return null;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      </View>
    );
  }

  if (!requests || requests.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Registration Requests</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/screens/parent-child-registration')}
        >
          <Ionicons name="add-circle" size={16} color={theme.primary} />
          <Text style={styles.addButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      {requests.map((request) => {
        const statusColor = getStatusColor(request.status);
        const childName = `${request.child_first_name} ${request.child_last_name}`;
        const requestDate = format(new Date(request.requested_at), 'dd MMM yyyy', { locale: enZA });
        const childAge = Math.floor(
          (Date.now() - new Date(request.child_birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );

        return (
          <View
            key={request.id}
            style={[styles.requestCard, { borderLeftColor: statusColor }]}
          >
            <View style={styles.requestHeader}>
              <Text style={styles.childName}>{childName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <Ionicons name={getStatusIcon(request.status)} size={14} color={statusColor} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {request.status}
                </Text>
              </View>
            </View>

            <Text style={styles.requestDetails}>
              Age: {childAge} years • Requested {requestDate}
            </Text>

            {request.status === 'pending' && (
              <Text style={styles.requestDetails}>
                ⏳ Your request is being reviewed by the school
              </Text>
            )}

            {request.status === 'rejected' && request.rejection_reason && (
              <Text style={styles.rejectionReason}>
                Reason: {request.rejection_reason}
              </Text>
            )}

            {request.status === 'approved' && (
              <Text style={[styles.requestDetails, { color: theme.success }]}>
                ✓ Approved! Your child will be added to the system soon.
              </Text>
            )}

            {request.status === 'pending' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.withdrawButton]}
                  onPress={() => handleWithdraw(request.id, childName)}
                  disabled={withdrawMutation.isPending}
                >
                  {withdrawMutation.isPending ? (
                    <ActivityIndicator size="small" color={theme.error} />
                  ) : (
                    <>
                      <Ionicons name="close" size={16} color={theme.error} />
                      <Text style={styles.withdrawButtonText}>Withdraw</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};
