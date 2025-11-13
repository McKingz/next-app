/**
 * Petty Cash Management System
 * 
 * Essential Principal Hub feature for managing:
 * - Small daily expenses (stationery, maintenance, refreshments)
 * - Cash on hand tracking
 * - Expense categories and receipts
 * - Reimbursements and float management
 * - Monthly reconciliation
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { navigateBack } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
// import * as DocumentPicker from 'expo-document-picker';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
// Removed Picker import to fix ViewManager error

interface PettyCashTransaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: 'expense' | 'replenishment' | 'adjustment';
  receipt_number?: string;
  created_at: string;
  created_by: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface PettyCashSummary {
  opening_balance: number;
  current_balance: number;
  total_expenses: number;
  total_replenishments: number;
  pending_approval: number;
}

const EXPENSE_CATEGORIES = [
  // Office & Educational
  'Stationery & Supplies',
  'Teaching Materials',
  'Art & Craft Supplies',
  'Books & Educational Resources',
  'Printing & Photocopying',

  // Food & Refreshments
  'Groceries',
  'Refreshments',
  'Staff Tea & Coffee',
  'Student Snacks',
  'Kitchen Supplies',

  // Maintenance & Facilities
  'Maintenance & Repairs',
  'Cleaning Supplies',
  'Cleaning Services',
  'Pest Control',
  'Waste Removal',
  'Minor Repairs',

  // Utilities & Services
  'Utilities (small amounts)',
  'Electricity (top-ups)',
  'Water (top-ups)',
  'Internet & Wi-Fi',
  'Telephone & Mobile',
  'Airtime (Mobile)',
  'Data Bundles',

  // Medical & Safety
  'Medical & First Aid',
  'First Aid Supplies',
  'Sanitizers & Disinfectants',
  'Safety Equipment',

  // Transport & Logistics
  'Transport',
  'Travel & Transport',
  'Fuel (petty amounts)',
  'Parking Fees',
  'Taxi/Uber Fares',
  'Vehicle Maintenance',

  // Communication & Marketing
  'Communication',
  'Postage & Courier',
  'Advertising Materials',
  'Signage & Banners',

  // Staff & Administration
  'Staff Welfare',
  'Staff Uniforms',
  'Staff Training Materials',
  'Office Furniture (small items)',

  // Events & Activities
  'Events & Celebrations',
  'Birthday Parties',
  'Sports Day Supplies',
  'Field Trip Expenses',
  'Parent Meeting Refreshments',

  // Emergency & Miscellaneous
  'Emergency Expenses',
  'Bank Charges',
  'Petty Licensing Fees',
  'Subscriptions (small)',
  'Other',
];

export default function PettyCashScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const router = useRouter();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
  const [summary, setSummary] = useState<PettyCashSummary>({
    opening_balance: 0,
    current_balance: 0,
    total_expenses: 0,
    total_replenishments: 0,
    pending_approval: 0,
  });
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // const [selectedPeriod, setSelectedPeriod] = useState('current_month'); // For future period filtering
  
  // Modals
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showReplenishment, setShowReplenishment] = useState(false);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  // Category picker modal state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  
  // Form states
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    category: '',
    receipt_number: '',
  });
  
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Receipts viewing state
  const [receiptsVisible, setReceiptsVisible] = useState(false);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptItems, setReceiptItems] = useState<Array<{ id: string; url: string; fileName?: string }>>([]);

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  // Date range filter
  const [selectedRange, setSelectedRange] = useState<'7d' | '30d' | 'all' | 'custom'>('30d');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const loadPettyCashData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's preschool
      const { data: userProfile } = await assertSupabase()
        .from('users')
        .select('preschool_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userProfile?.preschool_id) {
        Alert.alert(t('common.error'), t('petty_cash.error_no_school'));
        return;
      }

      // Ensure petty cash account exists and capture account id
      try {
        const { data: ensuredId } = await assertSupabase()
          .rpc('ensure_petty_cash_account', { school_uuid: userProfile.preschool_id });
        if (ensuredId) setAccountId(String(ensuredId));
      } catch {
        // Fallback: try fetch an active account
        const { data: acct } = await assertSupabase()
          .from('petty_cash_accounts')
          .select('id')
          .eq('school_id', userProfile.preschool_id)
          .eq('is_active', true)
          .maybeSingle();
        if (acct?.id) setAccountId(String(acct.id));
      }

      // Load petty cash transactions
        const { data: transactionsData, error: transError } = await assertSupabase()
        .from('petty_cash_transactions')
        .select('*')
        .eq('school_id', userProfile.preschool_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (transError) {
        console.error('Error loading transactions:', transError);
      } else {
        setTransactions(transactionsData || []);
      }

      // Calculate summary
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);

      const monthlyTransactions = (transactionsData || []).filter(t => 
        new Date(t.created_at) >= currentMonthStart
      );

      const expenses = monthlyTransactions
        .filter(t => t.type === 'expense' && t.status === 'approved')
        .reduce((sum, t) => sum + t.amount, 0);

      const replenishments = monthlyTransactions
        .filter(t => t.type === 'replenishment' && t.status === 'approved')
        .reduce((sum, t) => sum + t.amount, 0);

      const pending = monthlyTransactions
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + t.amount, 0);

      // Compute balances directly from accounts + approved transactions
      const { data: accountRow } = await assertSupabase()
        .from('petty_cash_accounts')
        .select('opening_balance, low_balance_threshold')
        .eq('school_id', userProfile.preschool_id)
        .eq('is_active', true)
        .maybeSingle();

      const openingBalance = Number(accountRow?.opening_balance ?? 0);

      const { data: approvedAll } = await assertSupabase()
        .from('petty_cash_transactions')
        .select('amount, type, status')
        .eq('school_id', userProfile.preschool_id)
        .eq('status', 'approved')
        .limit(1000);
      const totalSignedAll = (approvedAll || []).reduce((sum, t: any) => {
        const amt = Number(t.amount || 0);
        if (t.type === 'expense') return sum - amt;
        if (t.type === 'replenishment') return sum + amt;
        if (t.type === 'adjustment') return sum - amt; // Adjustments reduce balance
        return sum;
      }, 0);
      const currentBalance = openingBalance + totalSignedAll;

      setSummary({
        opening_balance: openingBalance,
        current_balance: currentBalance,
        total_expenses: expenses,
        total_replenishments: replenishments,
        pending_approval: pending,
      });

    } catch (error) {
      console.error('Error loading petty cash data:', error);
      Alert.alert(t('common.error'), t('petty_cash.error_failed_load'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, t]);

  const handleAddExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description || !expenseForm.category) {
      Alert.alert(t('common.error'), t('petty_cash.error_fill_fields'));
      return;
    }

    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('common.error'), t('petty_cash.error_valid_amount'));
      return;
    }

    if (amount > summary.current_balance) {
      Alert.alert(t('common.error'), t('petty_cash.error_insufficient_balance'));
      return;
    }

    try {
      setUploadingReceipt(true);
      
const { data: userProfile } = await assertSupabase()
        .from('users')
        .select('preschool_id')
        .eq('auth_user_id', user?.id)
        .single();

      // First, insert the transaction
const { data: transactionData, error: transactionError } = await assertSupabase()
        .from('petty_cash_transactions')
        .insert({
          school_id: userProfile?.preschool_id,
          account_id: accountId,
          amount,
          description: expenseForm.description.trim(),
          category: expenseForm.category,
          type: 'expense',
          reference_number: expenseForm.receipt_number.trim() || null,
          created_by: user?.id,
          status: 'approved', // In a real system, this might need approval
        })
        .select()
        .single();

      if (transactionError) {
        Alert.alert(t('common.error'), t('petty_cash.error_failed_add'));
        return;
      }

      // Upload receipt if one was selected
      let receiptPath = null;
      if (receiptImage && transactionData) {
        receiptPath = await uploadReceiptImage(receiptImage, transactionData.id);
      }

      Alert.alert(t('common.success'), t('petty_cash.success_expense_added') + (receiptPath ? t('petty_cash.success_expense_receipt') : ''));
      setShowAddExpense(false);
      setExpenseForm({
        amount: '',
        description: '',
        category: '',
        receipt_number: '',
      });
      setReceiptImage(null);
      loadPettyCashData();
    } catch {
      Alert.alert(t('common.error'), t('petty_cash.error_failed_add'));
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleReplenishment = async () => {
    if (!expenseForm.amount) {
      Alert.alert(t('common.error'), t('petty_cash.error_replenishment_amount'));
      return;
    }

    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('common.error'), t('petty_cash.error_valid_amount'));
      return;
    }

if (!assertSupabase) {
      Alert.alert(t('common.error'), t('petty_cash.error_db_unavailable'));
      return;
    }

    try {
const { data: userProfile } = await assertSupabase()
        .from('users')
        .select('preschool_id')
        .eq('auth_user_id', user?.id)
        .single();

const { error } = await assertSupabase()
        .from('petty_cash_transactions')
        .insert({
          school_id: userProfile?.preschool_id,
          account_id: accountId,
          amount,
          description: `Petty cash replenishment - ${new Date().toLocaleDateString()}`,
          category: 'Replenishment',
          type: 'replenishment',
          created_by: user?.id,
          status: 'approved',
        });

      if (error) {
        Alert.alert(t('common.error'), t('petty_cash.error_failed_record'));
        return;
      }

      Alert.alert(t('common.success'), t('petty_cash.success_replenishment'));
      setShowReplenishment(false);
      setExpenseForm({
        amount: '',
        description: '',
        category: '',
        receipt_number: '',
      });
      loadPettyCashData();
    } catch {
      Alert.alert(t('common.error'), t('petty_cash.error_failed_record'));
    }
  };

  const handleWithdrawal = async () => {
    if (!expenseForm.amount || !expenseForm.description) {
      Alert.alert(t('common.error'), t('petty_cash.error_amount_description'));
      return;
    }

    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('common.error'), t('petty_cash.error_valid_amount'));
      return;
    }

    if (amount > summary.current_balance) {
      Alert.alert(t('common.error'), t('petty_cash.error_withdrawal_exceeds'));
      return;
    }

    // Confirm withdrawal
    Alert.alert(
      t('petty_cash.confirm_withdrawal'),
      t('petty_cash.confirm_withdrawal_message', { amount: formatCurrency(amount) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('petty_cash.withdraw'), style: 'destructive', onPress: performWithdrawal }
      ]
    );

    async function performWithdrawal() {
      try {
        const { data: userProfile } = await assertSupabase()
          .from('users')
          .select('preschool_id')
          .eq('auth_user_id', user?.id)
          .single();

        const { error } = await assertSupabase()
          .from('petty_cash_transactions')
          .insert({
            school_id: userProfile?.preschool_id,
            account_id: accountId,
            amount,
            description: expenseForm.description.trim(),
            category: 'Withdrawal/Adjustment',
            type: 'adjustment',
            reference_number: expenseForm.receipt_number.trim() || null,
            created_by: user?.id,
            status: 'approved',
          });

        if (error) {
          Alert.alert(t('common.error'), t('petty_cash.error_failed_withdrawal'));
          return;
        }

        Alert.alert(t('common.success'), t('petty_cash.success_withdrawal'));
        setShowWithdrawal(false);
        setExpenseForm({
          amount: '',
          description: '',
          category: '',
          receipt_number: '',
        });
        loadPettyCashData();
      } catch {
        Alert.alert(t('common.error'), t('petty_cash.error_failed_withdrawal'));
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return theme?.success || '#10B981';
      case 'pending': return theme?.warning || '#F59E0B';
      case 'rejected': return theme?.error || '#EF4444';
      default: return theme?.textSecondary || '#6B7280';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Stationery & Supplies': return 'library';
      case 'Refreshments': return 'cafe';
      case 'Maintenance & Repairs': return 'construct';
      case 'Travel & Transport': return 'car';
      case 'Communication': return 'call';
      case 'Medical & First Aid': return 'medical';
      case 'Cleaning Supplies': return 'sparkles';
      case 'Utilities (small amounts)': return 'flash';
      case 'Airtime (Mobile)': return 'phone-portrait';
      case 'Data Bundles': return 'wifi';
      case 'Groceries': return 'cart';
      case 'Transport': return 'car';
      case 'Emergency Expenses': return 'alert-circle';
      case 'Replenishment': return 'add-circle';
      case 'Withdrawal/Adjustment': return 'arrow-down-circle';
      default: return 'receipt';
    }
  };

  const uploadReceiptImage = async (imageUri: string, transactionId: string) => {
    try {
      // Determine school for path prefix
      const { data: userProfile } = await assertSupabase()
        .from('users')
        .select('preschool_id')
        .eq('auth_user_id', user?.id)
        .single();

      const schoolId = userProfile?.preschool_id;

      // Handle different URI formats for web/mobile compatibility
      let blob: Blob;
      try {
        if (imageUri.startsWith('file://') && typeof window !== 'undefined') {
          // Web environment with file:// URI - this shouldn't happen but handle gracefully
          console.warn('File URI detected in web environment, cannot process:', imageUri);
          return null;
        }
        
        const response = await fetch(imageUri);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        blob = await response.blob();
      } catch (fetchError) {
        console.error('Error fetching image:', fetchError);
        return null;
      }
      const fileExt = String(imageUri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `receipt_${transactionId}_${Date.now()}.${fileExt}`;
      const storagePath = `${schoolId}/${transactionId}/${fileName}`;

      const { data, error } = await assertSupabase().storage
        .from('petty-cash-receipts')
        .upload(storagePath, blob, {
          contentType: `image/${fileExt}`,
          cacheControl: '3600',
        });
      
      if (error) throw error;

      try {
        await assertSupabase()
          .from('petty_cash_receipts')
          .insert({
            school_id: schoolId,
            transaction_id: transactionId,
            storage_path: data.path,
            file_name: fileName,
            created_by: user?.id,
          });
      } catch (e) {
        // Non-blocking: log and continue
        console.warn('Failed to record petty cash receipt row:', e);
      }
      
      return data.path;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      return null;
    }
  };

  const attachReceiptToTransaction = async (transactionId: string) => {
    try {
      // Choose method
      Alert.alert(
        t('receipt.attach_receipt', { defaultValue: 'Attach Receipt' }),
        t('receipt.choose_method', { defaultValue: 'Choose how to add your receipt:' }),
        [
          {
            text: t('receipt.take_photo', { defaultValue: 'Take Photo' }),
            onPress: async () => {
              try {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert(t('receipt.permission_required'), t('receipt.camera_permission'));
                  return;
                }
                const result = await ImagePicker.launchCameraAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                });
                if (!result.canceled && result.assets[0]) {
                  const path = await uploadReceiptImage(result.assets[0].uri, transactionId);
                  if (path) Alert.alert(t('common.success'), t('receipt.attached_success', { defaultValue: 'Receipt attached' }));
                }
              } catch (e) {
                Alert.alert(t('common.error'), t('receipt.attached_failed', { defaultValue: 'Failed to attach receipt' }));
              }
            },
          },
          {
            text: t('receipt.choose_from_gallery', { defaultValue: 'Choose from Gallery' }),
            onPress: async () => {
              try {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert(t('receipt.permission_required'), t('receipt.gallery_permission'));
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                });
                if (!result.canceled && result.assets[0]) {
                  const path = await uploadReceiptImage(result.assets[0].uri, transactionId);
                  if (path) Alert.alert(t('common.success'), t('receipt.attached_success', { defaultValue: 'Receipt attached' }));
                }
              } catch (e) {
                Alert.alert(t('common.error'), t('receipt.attached_failed', { defaultValue: 'Failed to attach receipt' }));
              }
            },
          },
          { text: t('common.cancel'), style: 'cancel' },
        ]
      );
    } catch { /* Intentional: non-fatal */ }
  };

  const viewReceiptsForTransaction = async (transactionId: string) => {
    try {
      setReceiptsLoading(true);
      setReceiptsVisible(true);

      // Find receipts for the transaction
      const { data: rows, error } = await assertSupabase()
        .from('petty_cash_receipts')
        .select('id, storage_path, file_name')
        .eq('transaction_id', transactionId)
        .limit(10);

      if (error) throw error;

      const list = rows || [];
      if (list.length === 0) {
        setReceiptsVisible(false);
        Alert.alert(t('common.info'), t('receipt.no_receipts', { defaultValue: 'No receipts attached for this transaction.' }));
        return;
      }

      // Generate signed URLs
      const items: Array<{ id: string; url: string; fileName?: string }> = [];
      for (const r of list) {
        try {
          const { data: signed } = await assertSupabase()
            .storage
            .from('petty-cash-receipts')
            .createSignedUrl(r.storage_path, 3600);
          if (signed?.signedUrl) {
            items.push({ id: r.id, url: signed.signedUrl, fileName: r.file_name });
          }
        } catch (e) {
          // skip failed items
        }
      }

      setReceiptItems(items);
    } catch {
      setReceiptsVisible(false);
      Alert.alert(t('common.error'), t('receipt.error_select_image', { defaultValue: 'Failed to load receipts' }));
    } finally {
      setReceiptsLoading(false);
    }
  };

  const selectReceiptImage = () => {
    Alert.alert(
      t('petty_cash.attach_receipt'),
      t('receipt.choose_method'),
      [
        { 
          text: t('receipt.take_photo'), 
          onPress: () => takeReceiptPhoto() 
        },
        { 
          text: t('receipt.choose_from_gallery'), 
          onPress: () => pickReceiptFromGallery() 
        },
        { 
          text: t('common.cancel'), 
          style: 'cancel' 
        }
      ]
    );
  };

  const takeReceiptPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('receipt.permission_required'), t('receipt.camera_permission'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('common.error'), t('receipt.error_take_photo'));
    }
  };

  const pickReceiptFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('receipt.permission_required'), t('receipt.gallery_permission'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error'), t('receipt.error_select_image'));
    }
  };

  const removeReceiptImage = () => {
    setReceiptImage(null);
  };

  useEffect(() => {
    loadPettyCashData();
  }, [loadPettyCashData]);

  // Helpers for cancel/delete/reverse
  const canDelete = async (): Promise<boolean> => {
    try {
      const { data } = await assertSupabase()
        .from('users')
        .select('role')
        .eq('auth_user_id', user?.id)
        .single();
      return data?.role === 'principal_admin';
    } catch {
      return false;
    }
  };

  const handleCancelTransaction = async (transactionId: string) => {
    try {
      const { error } = await assertSupabase()
        .from('petty_cash_transactions')
        .update({ status: 'rejected' })
        .eq('id', transactionId)
        .eq('status', 'pending');
      if (error) throw error;
      loadPettyCashData();
    } catch {
      Alert.alert(t('common.error'), t('transaction.failed_cancel', 'Failed to cancel transaction'));
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      const allowed = await canDelete();
      if (!allowed) {
        Alert.alert(t('common.not_allowed', 'Not allowed'), t('transaction.principals_only_delete', 'Only principals can delete transactions'));
        return;
      }

      const { error } = await assertSupabase()
        .from('petty_cash_transactions')
        .delete()
        .eq('id', transactionId);
      if (error) throw error;
      loadPettyCashData();
    } catch {
      Alert.alert(t('common.error'), t('transaction.failed_delete', 'Failed to delete transaction'));
    }
  };

  const handleReverseTransaction = async (transaction: PettyCashTransaction) => {
    try {
      const { data: userProfile } = await assertSupabase()
        .from('users')
        .select('preschool_id')
        .eq('auth_user_id', user?.id)
        .single();

      const oppositeType = transaction.type === 'expense' ? 'replenishment' : 'expense';
      const { error } = await assertSupabase()
        .from('petty_cash_transactions')
        .insert({
          school_id: userProfile?.preschool_id,
          account_id: accountId,
          amount: transaction.amount,
          description: `Reversal of ${transaction.type} (${transaction.id.substring(0, 8)}) - ${transaction.description}`,
          category: 'Other',
          type: oppositeType as any,
          created_by: user?.id,
          status: 'approved',
        });
      if (error) {
        console.error('Error reversing transaction:', error);
        throw error;
      }
      Alert.alert(t('common.success'), t('transaction.reversal_success', 'Transaction reversed successfully'));
      loadPettyCashData();
    } catch (error: any) {
      console.error('Reversal error:', error);
      Alert.alert(t('common.error'), error?.message || t('transaction.failed_reverse', 'Failed to create reversal'));
    }
  };

  const filteredCategoriesList = React.useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return EXPENSE_CATEGORIES;
    return EXPENSE_CATEGORIES.filter(c => c.toLowerCase().includes(q));
  }, [categorySearch]);

  const filteredTransactions = React.useMemo(() => {
    let list = transactions;

    if (selectedCategory !== 'All') {
      list = list.filter(tx => tx.category === selectedCategory);
    }

    if (selectedRange === '7d' || selectedRange === '30d') {
      const now = Date.now();
      const cutoff = selectedRange === '7d' ? now - 7 * 24 * 60 * 60 * 1000 : now - 30 * 24 * 60 * 60 * 1000;
      list = list.filter(tx => new Date(tx.created_at).getTime() >= cutoff);
    } else if (selectedRange === 'custom') {
      const from = customFrom ? new Date(customFrom).getTime() : NaN;
      const to = customTo ? new Date(customTo).getTime() : NaN;
      list = list.filter(tx => {
        const ts = new Date(tx.created_at).getTime();
        const afterFrom = isNaN(from) ? true : ts >= from;
        const beforeTo = isNaN(to) ? true : ts <= to;
        return afterFrom && beforeTo;
      });
    }

    return list;
  }, [transactions, selectedCategory, selectedRange, customFrom, customTo]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPettyCashData();
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="wallet-outline" size={48} color="#6B7280" />
          <Text style={styles.loadingText}>{t('petty_cash.loading_data', 'Loading petty cash data...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateBack('/screens/financial-dashboard')}>
          <Ionicons name="arrow-back" size={24} color={theme?.text || '#333'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('petty_cash.petty_cash')}</Text>
<TouchableOpacity onPress={() => router.push('/screens/financial-reports')}>
          <Ionicons name="document-text" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Balance Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('petty_cash.current_balance')}</Text>
          <Text style={[
            styles.currentBalance,
            { color: summary.current_balance < 1000 ? '#EF4444' : '#10B981' }
          ]}>
            {formatCurrency(summary.current_balance)}
          </Text>
          
          {summary.current_balance < 1000 && (
            <View style={styles.lowBalanceWarning}>
              <Ionicons name="warning" size={16} color="#F59E0B" />
              <Text style={styles.warningText}>{t('petty_cash.low_balance_warning', 'Low balance - consider replenishment')}</Text>
            </View>
          )}

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary.total_expenses)}
              </Text>
              <Text style={styles.summaryLabel}>{t('petty_cash.total_expenses')}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary.pending_approval)}
              </Text>
              <Text style={styles.summaryLabel}>{t('petty_cash.pending_approval')}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>{t('petty_cash.quick_actions')}</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowAddExpense(true)}
            >
              <Ionicons name="remove-circle" size={24} color="#EF4444" />
              <Text style={styles.actionText}>{t('petty_cash.add_expense')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowReplenishment(true)}
            >
              <Ionicons name="add-circle" size={24} color="#10B981" />
              <Text style={styles.actionText}>{t('petty_cash.replenish_cash')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowWithdrawal(true)}
            >
              <Ionicons name="arrow-down-circle" size={24} color="#F59E0B" />
              <Text style={styles.actionText}>{t('petty_cash.withdraw_cash')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                try {
                  const { safeRouter } = require('@/lib/navigation/safeRouter');
                  safeRouter.push('/screens/petty-cash-reconcile');
                } catch {
                  // Fallback to default if safeRouter unavailable
                  router.push('/screens/petty-cash-reconcile');
                }
              }}
            >
              <Ionicons name="calculator" size={24} color="#8B5CF6" />
              <Text style={styles.actionText}>{t('petty_cash.reconcile')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsCard}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.transactionsTitle}>{t('petty_cash.recent_transactions')}</Text>
            <TouchableOpacity onPress={() => router.push('/screens/financial-transactions')}>
              <Text style={styles.viewAllText}>{t('petty_cash.view_all')}</Text>
            </TouchableOpacity>
          </View>

          {/* Category Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {['All', ...EXPENSE_CATEGORIES, 'Replenishment', 'Withdrawal/Adjustment'].map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, selectedCategory === cat && styles.filterChipTextActive]}>
                  {cat === 'All' ? t('common.all', { defaultValue: 'All' }) :
                   cat === 'Replenishment' ? t('petty_cash.replenishment') :
                   cat === 'Withdrawal/Adjustment' ? t('petty_cash.withdrawal_adjustment', { defaultValue: 'Withdrawal/Adjustment' }) : cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Date Range Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row' }}>
              {[
                { key: '7d', label: t('common.last_7_days', { defaultValue: 'Last 7 days' }) },
                { key: '30d', label: t('common.last_30_days', { defaultValue: 'Last 30 days' }) },
                { key: 'all', label: t('common.all_time', { defaultValue: 'All time' }) },
                { key: 'custom', label: t('common.custom_range', { defaultValue: 'Custom range' }) },
              ].map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    if (key === 'custom') { setShowCustomRange(true); } else { setSelectedRange(key as any); }
                }}
                style={[styles.filterChip, selectedRange === key && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, selectedRange === key && styles.filterChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
            </View>
          </ScrollView>

          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>{t('petty_cash.no_transactions_yet')}</Text>
              <Text style={styles.emptySubtitle}>{t('petty_cash.add_first_expense')}</Text>
            </View>
          ) : (
            filteredTransactions.slice(0, 10).map((transaction) => (
              <View 
                key={transaction.id} 
                style={styles.transactionItem}
                onTouchEnd={() => {}}
                onStartShouldSetResponder={() => false}
                onResponderRelease={() => {}}
              >
                <View style={styles.transactionLeft}>
                  <Ionicons
                    name={getCategoryIcon(transaction.category) as any}
                    size={20}
                    color={(transaction.type === 'expense' || transaction.type === 'adjustment') ? '#EF4444' : '#10B981'}
                  />
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionDescription}>
                      {transaction.description}
                    </Text>
                    <Text style={styles.transactionCategory}>
                      {transaction.category}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {new Date(transaction.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      })}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.transactionRight}>
                  <View style={styles.rightTopRow}>
                    <Text style={[
                      styles.transactionAmount,
                      { color: (transaction.type === 'expense' || transaction.type === 'adjustment') ? '#EF4444' : '#10B981' }
                    ]}>
                      {(transaction.type === 'expense' || transaction.type === 'adjustment') ? '-' : '+'}
                      {formatCurrency(transaction.amount)}
                    </Text>
                    <TouchableOpacity
                      style={{ marginLeft: 8, padding: 4 }}
                      onPress={async () => {
                        const options: any[] = [];
                    options.push({ text: t('receipt.view_receipts', { defaultValue: 'View Receipts' }), onPress: () => viewReceiptsForTransaction(transaction.id) });
                    options.push({ text: t('receipt.attach_receipt', { defaultValue: 'Attach Receipt' }), onPress: () => attachReceiptToTransaction(transaction.id) });
                    if (transaction.status === 'pending') {
                      options.push({ text: t('petty_cash.cancel', { defaultValue: 'Cancel' }) + ' (reject)', onPress: () => handleCancelTransaction(transaction.id) });
                    }
                    options.push({ text: 'Reverse', onPress: () => handleReverseTransaction(transaction) });
                        const allowDelete = await canDelete();
                        if (allowDelete) {
                          options.push({ text: t('common.delete', { defaultValue: 'Delete' }), style: 'destructive', onPress: () => handleDeleteTransaction(transaction.id) });
                        }
                        options.push({ text: t('common.close', { defaultValue: 'Close' }), style: 'cancel' });
                        Alert.alert(t('transaction.options', { defaultValue: 'Transaction Options' }), t('transaction.choose_action', { defaultValue: 'Choose an action' }), options, { cancelable: true });
                      }}
                      accessibilityLabel={t('transaction.options', { defaultValue: 'Transaction Options' })}
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color={theme?.textSecondary || '#6B7280'} />
                    </TouchableOpacity>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(transaction.status) }
                  ]}>
                    <Text style={styles.statusText}>{t(`petty_cash.${transaction.status}`)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal
        visible={showAddExpense}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddExpense(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddExpense(false)}>
              <Text style={styles.modalCancel}>{t('petty_cash.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('petty_cash.add_expense')}</Text>
            <TouchableOpacity 
              onPress={handleAddExpense}
              disabled={uploadingReceipt}
            >
              <Text style={[styles.modalSave, uploadingReceipt && { opacity: 0.5 }]}>
                {uploadingReceipt ? t('common.uploading', 'Uploading...') : t('common.add', 'Add')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.amount')} (ZAR) *</Text>
              <TextInput
                style={styles.formInput}
                value={expenseForm.amount}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, amount: text }))}
                placeholder={t('petty_cash.enter_amount')}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.description')} *</Text>
              <TextInput
                style={[styles.formInput, { height: 80 }]}
                value={expenseForm.description}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, description: text }))}
                placeholder={t('petty_cash.enter_description')}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.category')} *</Text>
              <TouchableOpacity 
                style={styles.categorySelector}
                onPress={() => {
                  setCategorySearch('');
                  setShowCategoryPicker(true);
                }}
              >
                <Text style={[styles.categoryText, !expenseForm.category && styles.placeholder]}>
                  {expenseForm.category || t('petty_cash.select_category')}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.receipt_number')} ({t('common.optional', 'Optional')})</Text>
              <TextInput
                style={styles.formInput}
                value={expenseForm.receipt_number}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, receipt_number: text }))}
                placeholder={t('petty_cash.enter_receipt_number')}
              />
            </View>

            {/* Receipt Upload Section */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('receipt.receipt_image', 'Receipt Image')} ({t('common.optional', 'Optional')})</Text>
              
              {receiptImage ? (
                <View style={styles.receiptPreviewContainer}>
                  <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
                  <TouchableOpacity 
                    style={styles.removeReceiptButton}
                    onPress={removeReceiptImage}
                  >
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.uploadReceiptButton}
                  onPress={selectReceiptImage}
                >
                  <Ionicons name="camera" size={24} color="#6B7280" />
                  <Text style={styles.uploadReceiptText}>{t('receipt.add_receipt_photo', 'Add Receipt Photo')}</Text>
                  <Text style={styles.uploadReceiptSubtext}>{t('receipt.tap_to_photo_gallery', 'Tap to take photo or select from gallery')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>{t('petty_cash.available_balance', 'Available Balance')}:</Text>
              <Text style={styles.balanceAmount}>
                {formatCurrency(summary.current_balance)}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Custom Range Modal */}
      <Modal
        visible={showCustomRange}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCustomRange(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCustomRange(false)}>
              <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('common.custom_range', { defaultValue: 'Custom range' })}</Text>
            <TouchableOpacity onPress={() => {
              setSelectedRange('custom');
              setShowCustomRange(false);
            }}>
              <Text style={styles.modalSave}>{t('common.apply', { defaultValue: 'Apply' })}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('common.start_date', { defaultValue: 'Start date' })}</Text>
              <TextInput
                style={styles.formInput}
                value={customFrom}
                onChangeText={setCustomFrom}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('common.end_date', { defaultValue: 'End date' })}</Text>
              <TextInput
                style={styles.formInput}
                value={customTo}
                onChangeText={setCustomTo}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Receipts Modal */}
      <Modal
        visible={receiptsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReceiptsVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReceiptsVisible(false)}>
              <Text style={styles.modalCancel}>{t('common.close', { defaultValue: 'Close' })}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('receipt.receipt_image', { defaultValue: 'Receipt Image' })}</Text>
            <View style={{ width: 48 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {receiptsLoading ? (
              <View style={{ alignItems: 'center', padding: 24 }}>
                <Ionicons name="time-outline" size={24} color={theme?.textSecondary || '#6B7280'} />
                <Text style={{ marginTop: 8, color: theme?.textSecondary || '#6B7280' }}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
              </View>
            ) : (
              receiptItems.map(item => (
                <View key={item.id} style={{ marginBottom: 16 }}>
                  <Image source={{ uri: item.url }} style={styles.receiptPreview} />
                  {!!item.fileName && (
                    <Text style={{ marginTop: 6, textAlign: 'center', color: theme?.textSecondary || '#6B7280' }}>{item.fileName}</Text>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
              <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('petty_cash.select_category')}</Text>
            <View style={{ width: 48 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formGroup}>
              <TextInput
                style={styles.formInput}
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder={t('category.search_categories', { defaultValue: 'Search categories' })}
              />
            </View>

            <ScrollView style={styles.categoryList} keyboardShouldPersistTaps="handled">
              {filteredCategoriesList.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryItem}
                  onPress={() => {
                    setExpenseForm(prev => ({ ...prev, category }));
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.categoryItemText}>{category}</Text>
                  {expenseForm.category === category && (
                    <Ionicons name="checkmark-circle" size={20} color={theme?.primary || '#007AFF'} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Replenishment Modal */}
      <Modal
        visible={showReplenishment}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReplenishment(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReplenishment(false)}>
              <Text style={styles.modalCancel}>{t('petty_cash.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('petty_cash.replenish_cash')}</Text>
            <TouchableOpacity onPress={handleReplenishment}>
              <Text style={styles.modalSave}>{t('common.record', 'Record')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.replenishment_amount', 'Replenishment Amount')} (ZAR) *</Text>
              <TextInput
                style={styles.formInput}
                value={expenseForm.amount}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, amount: text }))}
                placeholder={t('petty_cash.enter_amount')}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.replenishmentInfo}>
              <Text style={styles.infoTitle}>{t('petty_cash.current_status', 'Current Status')}</Text>
              <Text style={styles.infoText}>
                {t('petty_cash.current_balance')}: {formatCurrency(summary.current_balance)}
              </Text>
              <Text style={styles.infoText}>
                {t('petty_cash.replenishment_recommendation', 'Recommended replenishment when balance falls below R1,000')}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Withdrawal Modal */}
      <Modal
        visible={showWithdrawal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWithdrawal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowWithdrawal(false)}>
              <Text style={styles.modalCancel}>{t('petty_cash.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('petty_cash.withdraw_cash')}</Text>
            <TouchableOpacity onPress={handleWithdrawal}>
              <Text style={styles.modalSave}>{t('petty_cash.withdraw')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.withdrawal_amount', 'Withdrawal Amount')} (ZAR) *</Text>
              <TextInput
                style={styles.formInput}
                value={expenseForm.amount}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, amount: text }))}
                placeholder={t('petty_cash.enter_amount')}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.withdrawal_reason', 'Reason for Withdrawal')} *</Text>
              <TextInput
                style={[styles.formInput, { height: 80 }]}
                value={expenseForm.description}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, description: text }))}
                placeholder={t('petty_cash.withdrawal_reason_placeholder', 'Why are you withdrawing this cash?')}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>{t('petty_cash.reference_number', 'Reference Number')} ({t('common.optional', 'Optional')})</Text>
              <TextInput
                style={styles.formInput}
                value={expenseForm.receipt_number}
                onChangeText={(text) => setExpenseForm(prev => ({ ...prev, receipt_number: text }))}
                placeholder={t('petty_cash.reference_placeholder', 'Bank deposit slip, reference number, etc.')}
              />
            </View>

            <View style={styles.replenishmentInfo}>
              <Text style={styles.infoTitle}>⚠️ {t('common.important', 'Important')}</Text>
              <Text style={styles.infoText}>
                {t('petty_cash.current_balance')}: {formatCurrency(summary.current_balance)}
              </Text>
              <Text style={styles.infoText}>
                {t('petty_cash.withdrawal_notice', 'This withdrawal will reduce your petty cash balance. Use this when cash needs to be deposited back to the main account or removed for other reasons.')}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme?.surface || '#fff',
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#e1e5e9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  scrollView: {
    flex: 1,
  },
  summaryCard: {
    margin: 16,
    backgroundColor: theme?.cardBackground || '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 16,
    color: theme?.textSecondary || '#6B7280',
    marginBottom: 8,
  },
  currentBalance: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
  },
  lowBalanceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme?.warningLight || '#FEF3C7',
    padding: 8,
    borderRadius: 6,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 12,
    color: theme?.warning || '#92400E',
    marginLeft: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme?.textSecondary || '#6B7280',
  },
  actionsCard: {
    margin: 16,
    backgroundColor: theme?.cardBackground || '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme?.surfaceVariant || '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
  },
  actionText: {
    fontSize: 12,
    color: theme?.text || '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  transactionsCard: {
    margin: 16,
    backgroundColor: theme?.cardBackground || '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  transactionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  viewAllText: {
    color: theme?.primary || '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#111827',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme?.textSecondary || '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme?.surfaceVariant || '#eef2f7',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme?.primary || '#007AFF',
  },
  filterChipText: {
    color: theme?.textSecondary || '#6B7280',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#f3f4f6',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionDetails: {
    marginLeft: 12,
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: theme?.text || '#333',
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 12,
    color: theme?.accent || '#8B5CF6',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 11,
    color: theme?.textSecondary || '#6B7280',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  rightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme?.modalBackground || '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme?.surface || '#fff',
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#e1e5e9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  modalCancel: {
    fontSize: 16,
    color: theme?.textSecondary || '#6B7280',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.primary || '#007AFF',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  categoryList: {
    flex: 1,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme?.surface || '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme?.border || '#e1e5e9',
    marginBottom: 8,
  },
  categoryItemText: {
    fontSize: 16,
    color: theme?.text || '#333',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme?.text || '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: theme?.inputBorder || '#e1e5e9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: theme?.inputBackground || '#fff',
    color: theme?.inputText || '#111827',
  },
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme?.inputBorder || '#e1e5e9',
    borderRadius: 8,
    padding: 12,
    backgroundColor: theme?.inputBackground || '#fff',
  },
  categoryText: {
    fontSize: 16,
    color: theme?.inputText || '#333',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  uploadReceiptButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme?.border || '#e1e5e9',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    backgroundColor: theme?.surfaceVariant || '#f8f9fa',
  },
  uploadReceiptText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme?.text || '#333',
    marginTop: 8,
  },
  uploadReceiptSubtext: {
    fontSize: 12,
    color: theme?.textSecondary || '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  receiptPreviewContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  receiptPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeReceiptButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 2,
  },
  balanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme?.surfaceVariant || '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: theme?.textSecondary || '#6B7280',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  replenishmentInfo: {
    backgroundColor: theme?.surfaceVariant || '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: theme?.textSecondary || '#6B7280',
    marginBottom: 4,
  },
});
