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
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ApprovalWorkflowService, type ProofOfPayment, type PettyCashRequest, type ApprovalSummary } from '@/services/ApprovalWorkflowService';
import { assertSupabase } from '@/lib/supabase';

type TabType = 'summary' | 'pops' | 'petty_cash' | 'history';

interface School {
  id: string;
  name: string;
}

export default function PrincipalApprovalDashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [school, setSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState<ApprovalSummary>({
    pending_pops: 0,
    pending_petty_cash: 0,
    total_pending_amount: 0,
    urgent_requests: 0,
    overdue_receipts: 0,
  });
  const [pendingPOPs, setPendingPOPs] = useState<ProofOfPayment[]>([]);
  const [pendingPettyCash, setPendingPettyCash] = useState<PettyCashRequest[]>([]);

  const [selectedPOP, setSelectedPOP] = useState<ProofOfPayment | null>(null);
  const [selectedPettyCash, setSelectedPettyCash] = useState<PettyCashRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');

  const loadApprovalData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: userProfile, error: profileError } = await assertSupabase()
        .from('users')
        .select('preschool_id')
        .eq('auth_user_id', user.id)
        .single();

      if (profileError || !userProfile?.preschool_id) {
        Alert.alert('Error', 'No school assigned to your account');
        return;
      }

      const { data: schoolData, error: schoolError } = await assertSupabase()
        .from('preschools')
        .select('id, name')
        .eq('id', userProfile.preschool_id)
        .single();

      if (schoolError) {
        console.error('Error loading school:', schoolError);
        return;
      }

      setSchool(schoolData);

      const approvalSummary = await ApprovalWorkflowService.getApprovalSummary(schoolData.id);
      setSummary(approvalSummary);

      const pops = await ApprovalWorkflowService.getPendingPOPs(schoolData.id);
      setPendingPOPs(pops);

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
     
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApprovalData();
  };

  const handleApprovePOP = async (pop: ProofOfPayment) => {
    if (!user || !school) return;

    const success = await ApprovalWorkflowService.approvePOP(
      pop.id,
      user.id,
      (user as any)?.user_metadata?.name || 'Principal',
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
      (user as any)?.user_metadata?.name || 'Principal',
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

  const handleApprovePettyCash = async (request: PettyCashRequest) => {
    if (!user || !school) return;

    const approvedAmountValue = approvedAmount ? parseFloat(approvedAmount) : undefined;

    const success = await ApprovalWorkflowService.approvePettyCashRequest(
      request.id,
      user.id,
      (user as any)?.user_metadata?.name || 'Principal',
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
      (user as any)?.user_metadata?.name || 'Principal',
      rejectionReason,
      reviewNotes
    );

    if (success) {
      Alert.alert('Success', 'Petty cash request rejected');
      setSelectedPettyCash(null);
      setRejectionReason('');
      setReviewNotes('');
      await loadApprovalData();
    } else {
      Alert.alert('Error', 'Failed to reject petty cash request');
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ title: 'Principal Approvals', headerShown: true }} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Approvals</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Review and manage pending requests</Text>
      </View>

      <View style={styles.tabs}>
        {(['summary', 'pops', 'petty_cash', 'history'] as TabType[]).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && { borderBottomColor: theme.primary }]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, { color: activeTab === tab ? theme.primary : theme.textSecondary }]}>
              {tab.replace('_', ' ').toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {activeTab === 'summary' && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Summary</Text>
            <View style={styles.summaryGrid}>
              <SummaryItem label="Pending POPs" value={summary.pending_pops} theme={theme} icon="document-attach" />
              <SummaryItem label="Pending Petty Cash" value={summary.pending_petty_cash} theme={theme} icon="wallet" />
              <SummaryItem label="Total Pending" value={`R${summary.total_pending_amount.toFixed(2)}`} theme={theme} icon="cash" />
              <SummaryItem label="Urgent" value={summary.urgent_requests} theme={theme} icon="alert" />
              <SummaryItem label="Overdue Receipts" value={summary.overdue_receipts} theme={theme} icon="time" />
            </View>
          </View>
        )}

        {activeTab === 'pops' && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Payment Proofs</Text>
            {pendingPOPs.length === 0 ? (
              <Text style={{ color: theme.textSecondary }}>No pending POPs.</Text>
            ) : (
              pendingPOPs.map((pop) => (
                <TouchableOpacity key={pop.id} style={styles.listItem} onPress={() => setSelectedPOP(pop)}>
                  <View style={styles.listIcon}><Ionicons name="document-attach" size={18} color={theme.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '600' }}>{pop.student_name || 'Student'}</Text>
                    <Text style={{ color: theme.textSecondary }}>R{pop.payment_amount.toFixed(2)} • {new Date(pop.payment_date).toLocaleDateString()}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'petty_cash' && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Petty Cash Requests</Text>
            {pendingPettyCash.length === 0 ? (
              <Text style={{ color: theme.textSecondary }}>No pending petty cash requests.</Text>
            ) : (
              pendingPettyCash.map((req) => (
                <TouchableOpacity key={req.id} style={styles.listItem} onPress={() => setSelectedPettyCash(req)}>
                  <View style={styles.listIcon}><Ionicons name="wallet" size={18} color={theme.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '600' }}>{req.requestor_name}</Text>
                    <Text style={{ color: theme.textSecondary }}>R{req.amount.toFixed(2)} • {req.category}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* POP Review Modal */}
      <Modal visible={!!selectedPOP} animationType="slide" onRequestClose={() => setSelectedPOP(null)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}> 
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedPOP(null)}><Ionicons name="close" size={22} color={theme.text} /></TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Review Payment Proof</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <Text style={[styles.label, { color: theme.text }]}>Review Notes</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={reviewNotes}
              onChangeText={setReviewNotes}
              placeholder="Add any notes for this review"
              placeholderTextColor={theme.textSecondary}
              multiline
            />

            <Text style={[styles.label, { color: theme.text }]}>Rejection Reason (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Provide a reason if rejecting"
              placeholderTextColor={theme.textSecondary}
              multiline
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#EF4444' }]} onPress={() => selectedPOP && handleRejectPOP(selectedPOP)}>
              <Text style={styles.btnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={() => selectedPOP && handleApprovePOP(selectedPOP)}>
              <Text style={[styles.btnText, { color: theme.onPrimary }]}>Approve</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Petty Cash Review Modal */}
      <Modal visible={!!selectedPettyCash} animationType="slide" onRequestClose={() => setSelectedPettyCash(null)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}> 
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedPettyCash(null)}><Ionicons name="close" size={22} color={theme.text} /></TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Review Petty Cash</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <Text style={[styles.label, { color: theme.text }]}>Approval Notes</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={reviewNotes}
              onChangeText={setReviewNotes}
              placeholder="Add any notes for this review"
              placeholderTextColor={theme.textSecondary}
              multiline
            />

            <Text style={[styles.label, { color: theme.text }]}>Approved Amount (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={approvedAmount}
              onChangeText={setApprovedAmount}
              placeholder="e.g. 500.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.label, { color: theme.text }]}>Rejection Reason (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Provide a reason if rejecting"
              placeholderTextColor={theme.textSecondary}
              multiline
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#EF4444' }]} onPress={() => selectedPettyCash && handleRejectPettyCash(selectedPettyCash)}>
              <Text style={styles.btnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={() => selectedPettyCash && handleApprovePettyCash(selectedPettyCash)}>
              <Text style={[styles.btnText, { color: theme.onPrimary }]}>Approve</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryItem({ label, value, theme, icon }: { label: string; value: string | number; theme: any; icon: any }) {
  return (
    <View style={{ alignItems: 'center', padding: 12, flex: 1 }}>
      <Ionicons name={icon} size={20} color={theme.primary} />
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 6 }}>{String(value)}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { marginTop: 4 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontWeight: '700' },
  card: { margin: 16, padding: 16, borderRadius: 12, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
  listIcon: { marginRight: 10, backgroundColor: theme.elevated, borderRadius: 10, padding: 8 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 44 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 16 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});