/**
 * Principal Approval Dashboard - Dark Mode Compatible
 * 
 * Centralized interface for principals to:
 * - Review and approve/reject parent payment proofs (POPs)
 * - Approve teacher petty cash requests
 * - View approval summaries and pending items
 * - Track urgent requests and overdue receipts
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ApprovalWorkflowService, 
  ProofOfPayment, 
  PettyCashRequest, 
  ApprovalSummary 
} from '../services/ApprovalWorkflowService';
import { supabase } from '../lib/supabase';

type TabType = 'summary' | 'pops' | 'petty_cash' | 'history';

interface School {
  id: string;
  name: string;
}

const PrincipalApprovalDashboard: React.FC = () => {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  
  const [school, setSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [summary, setSummary] = useState<ApprovalSummary>({
    pending_pops: 0,
    pending_petty_cash: 0,
    total_pending_amount: 0,
    urgent_requests: 0,
    overdue_receipts: 0,
  });
  const [pendingPOPs, setPendingPOPs] = useState<ProofOfPayment[]>([]);
  const [pendingPettyCash, setPendingPettyCash] = useState<PettyCashRequest[]>([]);
  
  // Modal states
  const [selectedPOP, setSelectedPOP] = useState<ProofOfPayment | null>(null);
  const [selectedPettyCash, setSelectedPettyCash] = useState<PettyCashRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');

  // Load school and approval data
  const loadApprovalData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get school info
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('preschool_id')
        .eq('auth_user_id', user.id)
        .single();

      if (profileError || !userProfile?.preschool_id) {
        Alert.alert('Error', 'No school assigned to your account');
        return;
      }

      const { data: schoolData, error: schoolError } = await supabase
        .from('preschools')
        .select('id, name')
        .eq('id', userProfile.preschool_id)
        .single();

      if (schoolError) {
        console.error('Error loading school:', schoolError);
        return;
      }

      setSchool(schoolData);

      // Load approval summary
      const approvalSummary = await ApprovalWorkflowService.getApprovalSummary(schoolData.id);
      setSummary(approvalSummary);

      // Load pending POPs
      const pops = await ApprovalWorkflowService.getPendingPOPs(schoolData.id);
      setPendingPOPs(pops);

      // Load pending petty cash requests
      const pettyCashRequests = await ApprovalWorkflowService.getPendingPettyCashRequests(schoolData.id);
      setPendingPettyCash(pettyCashRequests);

    } catch (error) {
      console.error('Error loading approval data:', error);
      Alert.alert('Error', 'Failed to load approval data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadApprovalData();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApprovalData();
  };

  // POP approval handlers
  const handleApprovePOP = async (pop: ProofOfPayment) => {
    if (!user || !school) return;

    const success = await ApprovalWorkflowService.approvePOP(
      pop.id,
      user.id,
      user.user_metadata?.name || 'Principal',
      reviewNotes
    );

    if (success) {
      Alert.alert('Success', 'Payment proof approved successfully');
      setSelectedPOP(null);
      setReviewNotes('');
      await loadApprovalData();
    } else {
      Alert.alert('Error', 'Failed to approve payment proof');
    }
  };

  const handleRejectPOP = async (pop: ProofOfPayment) => {
    if (!user || !school || !rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a rejection reason');
      return;
    }

    const success = await ApprovalWorkflowService.rejectPOP(
      pop.id,
      user.id,
      user.user_metadata?.name || 'Principal',
      rejectionReason,
      reviewNotes
    );

    if (success) {
      Alert.alert('Success', 'Payment proof rejected');
      setSelectedPOP(null);
      setReviewNotes('');
      setRejectionReason('');
      await loadApprovalData();
    } else {
      Alert.alert('Error', 'Failed to reject payment proof');
    }
  };

  // Petty cash approval handlers
  const handleApprovePettyCash = async (request: PettyCashRequest) => {
    if (!user || !school) return;

    const approvedAmountValue = approvedAmount ? parseFloat(approvedAmount) : undefined;
    
    const success = await ApprovalWorkflowService.approvePettyCashRequest(
      request.id,
      user.id,
      user.user_metadata?.name || 'Principal',
      approvedAmountValue,
      reviewNotes
    );

    if (success) {
      Alert.alert('Success', 'Petty cash request approved');
      setSelectedPettyCash(null);
      setReviewNotes('');
      setApprovedAmount('');
      await loadApprovalData();
    } else {
      Alert.alert('Error', 'Failed to approve petty cash request');
    }
  };

  const handleRejectPettyCash = async (request: PettyCashRequest) => {
    if (!user || !school || !rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a rejection reason');
      return;
    }

    const success = await ApprovalWorkflowService.rejectPettyCashRequest(
      request.id,
      user.id,
      user.user_metadata?.name || 'Principal',
      rejectionReason,
      reviewNotes
    );

    if (success) {
      Alert.alert('Success', 'Petty cash request rejected');
      setSelectedPettyCash(null);
      setReviewNotes('');
      setRejectionReason('');
      await loadApprovalData();
    } else {
      Alert.alert('Error', 'Failed to reject petty cash request');
    }
  };

  // Create theme-aware styles
  const createStyles = () => StyleSheet.create({
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
      fontSize: 16,
      color: theme.textSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: theme.primary,
    },
    tabText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    activeTabText: {
      color: theme.primary,
    },
    tabBadge: {
      marginLeft: 4,
      backgroundColor: theme.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBadgeText: {
      fontSize: 12,
      color: theme.onError,
      fontWeight: '600',
    },
    scrollView: {
      flex: 1,
    },
    summaryContainer: {
      padding: 16,
    },
    listContainer: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 16,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    summaryCard: {
      width: '48%',
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    summaryCardActive: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    summaryCardUrgent: {
      borderWidth: 2,
      borderColor: theme.error,
    },
    summaryIcon: {
      marginBottom: 8,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    summaryLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.errorLight,
      borderColor: theme.error,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
    },
    alertText: {
      flex: 1,
      marginLeft: 8,
      fontSize: 14,
      color: theme.error,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
    },
    emptyText: {
      fontSize: 16,
      color: theme.textSecondary,
      marginTop: 12,
      fontWeight: '500',
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.textTertiary,
      marginTop: 4,
    },
    itemCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    itemTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    itemSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    itemStatus: {
      alignItems: 'flex-end',
    },
    itemAmount: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginTop: 4,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginBottom: 4,
    },
    statusText: {
      fontSize: 10,
      color: '#fff',
      fontWeight: '600',
      textTransform: 'uppercase' as const,
    },
    itemDetails: {
      marginBottom: 12,
    },
    itemDetail: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    itemFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    itemDate: {
      fontSize: 12,
      color: theme.textTertiary,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.modalBackground,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    modalContent: {
      flex: 1,
      paddingHorizontal: 16,
    },
    detailSection: {
      marginVertical: 12,
    },
    detailLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    detailValue: {
      fontSize: 16,
      color: theme.text,
      marginBottom: 2,
    },
    detailSubvalue: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 1,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: theme.inputText,
      backgroundColor: theme.inputBackground,
      textAlignVertical: 'top',
    },
    receiptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: theme.surfaceVariant,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    receiptButtonText: {
      marginLeft: 8,
      fontSize: 14,
      color: theme.primary,
      fontWeight: '500',
    },
    modalActions: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      gap: 12,
    },
    rejectButton: {
      flex: 1,
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.error,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    rejectButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.error,
    },
    approveButton: {
      flex: 1,
      backgroundColor: theme.success,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    approveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.onSuccess,
    },
  });

  const styles = createStyles();

  // Render summary tab
  const renderSummaryTab = () => (
    <View style={styles.summaryContainer}>
      <Text style={styles.sectionTitle}>Approval Summary</Text>
      
      <View style={styles.summaryGrid}>
        <TouchableOpacity 
          style={[styles.summaryCard, summary.pending_pops > 0 && styles.summaryCardActive]}
          onPress={() => setActiveTab('pops')}
        >
          <View style={styles.summaryIcon}>
            <Ionicons name="document-text" size={24} color={summary.pending_pops > 0 ? theme.primary : theme.textSecondary} />
          </View>
          <Text style={styles.summaryValue}>{summary.pending_pops}</Text>
          <Text style={styles.summaryLabel}>Pending POPs</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.summaryCard, summary.pending_petty_cash > 0 && styles.summaryCardActive]}
          onPress={() => setActiveTab('petty_cash')}
        >
          <View style={styles.summaryIcon}>
            <Ionicons name="cash" size={24} color={summary.pending_petty_cash > 0 ? theme.primary : theme.textSecondary} />
          </View>
          <Text style={styles.summaryValue}>{summary.pending_petty_cash}</Text>
          <Text style={styles.summaryLabel}>Petty Cash Requests</Text>
        </TouchableOpacity>
        
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="wallet" size={24} color={theme.warning} />
          </View>
          <Text style={styles.summaryValue}>{ApprovalWorkflowService.formatCurrency(summary.total_pending_amount)}</Text>
          <Text style={styles.summaryLabel}>Pending Amount</Text>
        </View>
        
        <View style={[styles.summaryCard, summary.urgent_requests > 0 && styles.summaryCardUrgent]}>
          <View style={styles.summaryIcon}>
            <Ionicons name="alert-circle" size={24} color={summary.urgent_requests > 0 ? theme.error : theme.textSecondary} />
          </View>
          <Text style={styles.summaryValue}>{summary.urgent_requests}</Text>
          <Text style={styles.summaryLabel}>Urgent Requests</Text>
        </View>
      </View>
      
      {summary.overdue_receipts > 0 && (
        <View style={styles.alertCard}>
          <Ionicons name="warning" size={20} color={theme.error} />
          <Text style={styles.alertText}>
            {summary.overdue_receipts} overdue receipts require attention
          </Text>
        </View>
      )}
    </View>
  );

  // Render POPs tab
  const renderPOPsTab = () => (
    <View style={styles.listContainer}>
      <Text style={styles.sectionTitle}>Pending Payment Proofs ({pendingPOPs.length})</Text>
      
      {pendingPOPs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={theme.success} />
          <Text style={styles.emptyText}>No pending payment proofs</Text>
          <Text style={styles.emptySubtext}>All payments are up to date!</Text>
        </View>
      ) : (
        pendingPOPs.map((pop) => (
          <TouchableOpacity 
            key={pop.id} 
            style={styles.itemCard}
            onPress={() => setSelectedPOP(pop)}
          >
            <View style={styles.itemHeader}>
              <View>
                <Text style={styles.itemTitle}>{pop.student_name}</Text>
                <Text style={styles.itemSubtitle}>by {pop.parent_name}</Text>
              </View>
              <View style={styles.itemStatus}>
                <View style={[styles.statusBadge, { backgroundColor: ApprovalWorkflowService.getStatusColor(pop.status) }]}>
                  <Text style={styles.statusText}>{ApprovalWorkflowService.getDisplayStatus(pop.status)}</Text>
                </View>
                <Text style={styles.itemAmount}>{ApprovalWorkflowService.formatCurrency(pop.payment_amount)}</Text>
              </View>
            </View>
            
            <View style={styles.itemDetails}>
              <Text style={styles.itemDetail}>Purpose: {pop.payment_purpose}</Text>
              <Text style={styles.itemDetail}>Method: {pop.payment_method.replace('_', ' ').toUpperCase()}</Text>
              <Text style={styles.itemDetail}>Date: {new Date(pop.payment_date).toLocaleDateString()}</Text>
              {pop.payment_reference && (
                <Text style={styles.itemDetail}>Ref: {pop.payment_reference}</Text>
              )}
            </View>
            
            <View style={styles.itemFooter}>
              <Text style={styles.itemDate}>Submitted {new Date(pop.submitted_at).toLocaleDateString()}</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  // Render petty cash tab
  const renderPettyCashTab = () => (
    <View style={styles.listContainer}>
      <Text style={styles.sectionTitle}>Pending Petty Cash Requests ({pendingPettyCash.length})</Text>
      
      {pendingPettyCash.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={theme.success} />
          <Text style={styles.emptyText}>No pending petty cash requests</Text>
          <Text style={styles.emptySubtext}>All requests are processed!</Text>
        </View>
      ) : (
        pendingPettyCash.map((request) => (
          <TouchableOpacity 
            key={request.id} 
            style={styles.itemCard}
            onPress={() => setSelectedPettyCash(request)}
          >
            <View style={styles.itemHeader}>
              <View>
                <Text style={styles.itemTitle}>{request.requestor_name}</Text>
                <Text style={styles.itemSubtitle}>{request.requestor_role}</Text>
              </View>
              <View style={styles.itemStatus}>
                <View style={[styles.statusBadge, { backgroundColor: ApprovalWorkflowService.getUrgencyColor(request.urgency) }]}>
                  <Text style={styles.statusText}>{request.urgency.toUpperCase()}</Text>
                </View>
                <Text style={styles.itemAmount}>{ApprovalWorkflowService.formatCurrency(request.amount)}</Text>
              </View>
            </View>
            
            <View style={styles.itemDetails}>
              <Text style={styles.itemDetail}>Category: {request.category}</Text>
              <Text style={styles.itemDetail}>{request.description}</Text>
              {request.needed_by && (
                <Text style={styles.itemDetail}>Needed by: {new Date(request.needed_by).toLocaleDateString()}</Text>
              )}
            </View>
            
            <View style={styles.itemFooter}>
              <Text style={styles.itemDate}>Requested {new Date(request.requested_at).toLocaleDateString()}</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading approvals...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Approval Dashboard</Text>
<TouchableOpacity onPress={() => router.push('/screens/principal-analytics')}>
          <Ionicons name="time" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'summary' && styles.activeTab]}
          onPress={() => setActiveTab('summary')}
        >
          <Text style={[styles.tabText, activeTab === 'summary' && styles.activeTabText]}>Summary</Text>
          {(summary.pending_pops > 0 || summary.pending_petty_cash > 0) && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{summary.pending_pops + summary.pending_petty_cash}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pops' && styles.activeTab]}
          onPress={() => setActiveTab('pops')}
        >
          <Text style={[styles.tabText, activeTab === 'pops' && styles.activeTabText]}>POPs</Text>
          {summary.pending_pops > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{summary.pending_pops}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'petty_cash' && styles.activeTab]}
          onPress={() => setActiveTab('petty_cash')}
        >
          <Text style={[styles.tabText, activeTab === 'petty_cash' && styles.activeTabText]}>Petty Cash</Text>
          {summary.pending_petty_cash > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{summary.pending_petty_cash}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'summary' && renderSummaryTab()}
        {activeTab === 'pops' && renderPOPsTab()}
        {activeTab === 'petty_cash' && renderPettyCashTab()}
      </ScrollView>

      {/* POP Review Modal */}
      <Modal 
        visible={selectedPOP !== null} 
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {selectedPOP && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Payment Proof</Text>
              <TouchableOpacity onPress={() => {
                setSelectedPOP(null);
                setReviewNotes('');
                setRejectionReason('');
              }}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Student</Text>
                <Text style={styles.detailValue}>{selectedPOP.student_name}</Text>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Parent</Text>
                <Text style={styles.detailValue}>{selectedPOP.parent_name}</Text>
                {selectedPOP.parent_email && (
                  <Text style={styles.detailSubvalue}>{selectedPOP.parent_email}</Text>
                )}
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Payment Details</Text>
                <Text style={styles.detailValue}>{ApprovalWorkflowService.formatCurrency(selectedPOP.payment_amount)}</Text>
                <Text style={styles.detailSubvalue}>Method: {selectedPOP.payment_method.replace('_', ' ').toUpperCase()}</Text>
                <Text style={styles.detailSubvalue}>Date: {new Date(selectedPOP.payment_date).toLocaleDateString()}</Text>
                {selectedPOP.payment_reference && (
                  <Text style={styles.detailSubvalue}>Reference: {selectedPOP.payment_reference}</Text>
                )}
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Purpose</Text>
                <Text style={styles.detailValue}>{selectedPOP.payment_purpose}</Text>
                {selectedPOP.month_year && (
                  <Text style={styles.detailSubvalue}>Period: {selectedPOP.month_year}</Text>
                )}
              </View>
              
              {selectedPOP.receipt_image_path && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Receipt</Text>
                  <TouchableOpacity style={styles.receiptButton}>
                    <Ionicons name="image" size={20} color={theme.primary} />
                    <Text style={styles.receiptButtonText}>View Receipt</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Review Notes (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { color: theme.inputText }]}
                  value={reviewNotes}
                  onChangeText={setReviewNotes}
                  placeholder="Add any notes about this payment..."
                  placeholderTextColor={theme.inputPlaceholder}
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Rejection Reason (Required for rejection)</Text>
                <TextInput
                  style={[styles.textInput, { color: theme.inputText }]}
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder="Reason for rejection (if applicable)..."
                  placeholderTextColor={theme.inputPlaceholder}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.rejectButton}
                onPress={() => handleRejectPOP(selectedPOP)}
              >
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.approveButton}
                onPress={() => handleApprovePOP(selectedPOP)}
              >
                <Text style={styles.approveButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Modal>

      {/* Petty Cash Review Modal */}
      <Modal 
        visible={selectedPettyCash !== null} 
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {selectedPettyCash && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Petty Cash Request</Text>
              <TouchableOpacity onPress={() => {
                setSelectedPettyCash(null);
                setReviewNotes('');
                setRejectionReason('');
                setApprovedAmount('');
              }}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Requestor</Text>
                <Text style={styles.detailValue}>{selectedPettyCash.requestor_name}</Text>
                <Text style={styles.detailSubvalue}>{selectedPettyCash.requestor_role}</Text>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Request Details</Text>
                <Text style={styles.detailValue}>{ApprovalWorkflowService.formatCurrency(selectedPettyCash.amount)}</Text>
                <Text style={styles.detailSubvalue}>Category: {selectedPettyCash.category}</Text>
                <Text style={styles.detailSubvalue}>Urgency: {selectedPettyCash.urgency.toUpperCase()}</Text>
                {selectedPettyCash.needed_by && (
                  <Text style={styles.detailSubvalue}>Needed by: {new Date(selectedPettyCash.needed_by).toLocaleDateString()}</Text>
                )}
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailValue}>{selectedPettyCash.description}</Text>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Justification</Text>
                <Text style={styles.detailValue}>{selectedPettyCash.justification}</Text>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Approved Amount (Optional - defaults to requested amount)</Text>
                <TextInput
                  style={[styles.textInput, { color: theme.inputText }]}
                  value={approvedAmount}
                  onChangeText={setApprovedAmount}
                  placeholder={selectedPettyCash.amount.toString()}
                  placeholderTextColor={theme.inputPlaceholder}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Approval Notes (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { color: theme.inputText }]}
                  value={reviewNotes}
                  onChangeText={setReviewNotes}
                  placeholder="Add any notes about this request..."
                  placeholderTextColor={theme.inputPlaceholder}
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Rejection Reason (Required for rejection)</Text>
                <TextInput
                  style={[styles.textInput, { color: theme.inputText }]}
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder="Reason for rejection (if applicable)..."
                  placeholderTextColor={theme.inputPlaceholder}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.rejectButton}
                onPress={() => handleRejectPettyCash(selectedPettyCash)}
              >
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.approveButton}
                onPress={() => handleApprovePettyCash(selectedPettyCash)}
              >
                <Text style={styles.approveButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
};

export default PrincipalApprovalDashboard;