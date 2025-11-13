/**
 * Advanced Transaction List Screen
 * 
 * Features:
 * - Comprehensive transaction filtering and search
 * - Date range picker for custom periods
 * - Real-time search with debouncing
 * - Export functionality per transaction selection
 * - Pull-to-refresh and pagination
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { navigateBack } from '@/lib/navigation';
import { derivePreschoolId } from '@/lib/roleUtils';

import { FinancialDataService } from '@/services/FinancialDataService';
import { ExportService } from '@/lib/services/finance/ExportService';
import type { TransactionRecord, DateRange } from '@/services/FinancialDataService';

interface FilterOptions {
  type: 'all' | 'income' | 'expense';
  category: string;
  status: string;
  dateRange: DateRange;
  searchTerm: string;
}

export default function TransactionsScreen() {
  const { t } = useTranslation('common');
  const { profile } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<FilterOptions>({
    type: 'all',
    category: 'all',
    status: 'all',
    dateRange: {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    },
    searchTerm: '',
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [transactions, filters]);

  const canAccessFinances = (): boolean => {
    return profile?.role === 'principal' || profile?.role === 'principal_admin';
  };

  const loadTransactions = async (forceRefresh = false) => {
    try {
      setLoading(!forceRefresh);
      if (forceRefresh) setRefreshing(true);

      const preschoolId = derivePreschoolId(profile);

      const data = await FinancialDataService.getTransactions(filters.dateRange, preschoolId || undefined);
      setTransactions(data);

    } catch (error) {
      console.error('Failed to load transactions:', error);
      Alert.alert(t('common.error'), t('transactions.load_failed', { defaultValue: 'Failed to load transactions' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    // Search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term)
      );
    }

    setFilteredTransactions(filtered);
  };

  const handleExport = () => {
    if (!filteredTransactions.length) {
      Alert.alert(t('transactions.no_data', { defaultValue: 'No Data' }), t('transactions.no_transactions_export', { defaultValue: 'No transactions available to export' }));
      return;
    }

    const totalRevenue = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const summary = {
      revenue: totalRevenue,
      expenses: totalExpenses,
      cashFlow: totalRevenue - totalExpenses,
    };

    ExportService.exportFinancialData(filteredTransactions, summary, {
      format: 'excel',
      dateRange: filters.dateRange,
      includeCharts: false,
    });
  };

  const formatCurrency = (amount: number): string => {
    return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return '#059669';
      case 'pending': return '#EA580C';
      case 'overdue': return '#DC2626';
      case 'approved': return '#4F46E5';
      case 'rejected': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const renderTransaction = ({ item }: { item: TransactionRecord }) => {
    const hasEvidence = Boolean(
      (item as any).attachmentUrl || (item as any).hasReceipt || ((item as any).receiptCount ?? 0) > 0
    );
    return (
      <TouchableOpacity style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionIcon}>
            <Ionicons 
              name={item.type === 'income' ? 'trending-up' : 'trending-down'} 
              size={20} 
              color={item.type === 'income' ? '#059669' : '#DC2626'} 
            />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDescription}>{item.description}</Text>
            <Text style={styles.transactionCategory}>{item.category} • {formatDate(item.date)}</Text>
          </View>
          <View style={styles.transactionAmount}>
            <Text style={[
              styles.amountText,
              { color: item.type === 'income' ? '#059669' : '#DC2626' }
            ]}>
              {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
            </Text>
            {hasEvidence && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Ionicons name="document-attach" size={16} color={theme?.primary || '#4F46E5'} />
                <Text style={{ fontSize: 11, color: theme?.textSecondary || '#6B7280' }}>
                  {(item as any).receiptCount ? `${(item as any).receiptCount} ${t('receipt.view_receipts', { defaultValue: 'View Receipts' })}` : t('receipt.attach_receipt', { defaultValue: 'Attach Receipt' })}
                </Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterModal = () => (
    <Modal visible={showFilters} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('transactions.filter_title', { defaultValue: 'Filter Transactions' })}</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={theme?.text || '#333'} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>{t('transactions.type', { defaultValue: 'Transaction Type' })}</Text>
            <View style={styles.filterOptions}>
              {[
                { key: 'all', label: t('transactions.all_types', { defaultValue: 'All Types' }) },
                { key: 'income', label: t('transactions.income', { defaultValue: 'Income' }) },
                { key: 'expense', label: t('transactions.expenses', { defaultValue: 'Expenses' }) },
              ].map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterOption,
                    filters.type === key && styles.filterOptionActive,
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, type: key as any }))}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.type === key && styles.filterOptionTextActive,
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>{t('transactions.category', { defaultValue: 'Category' })}</Text>
            <View style={styles.filterOptions}>
              {[
                { key: 'all', label: t('transactions.all_categories', { defaultValue: 'All Categories' }) },
                { key: 'Tuition', label: t('transactions.cat_tuition', { defaultValue: 'Tuition' }) },
                { key: 'Supplies', label: t('transactions.cat_supplies', { defaultValue: 'Supplies' }) },
                { key: 'Salaries', label: t('transactions.cat_salaries', { defaultValue: 'Salaries' }) },
                { key: 'Maintenance', label: t('transactions.cat_maintenance', { defaultValue: 'Maintenance' }) },
                { key: 'Utilities', label: t('transactions.cat_utilities', { defaultValue: 'Utilities' }) },
              ].map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterOption,
                    filters.category === key && styles.filterOptionActive,
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, category: key }))}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.category === key && styles.filterOptionTextActive,
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setFilters({
                type: 'all',
                category: 'all',
                status: 'all',
                dateRange: {
                  from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                  to: new Date().toISOString(),
                },
                searchTerm: '',
              })}
            >
              <Text style={styles.clearButtonText}>{t('transactions.clear_all', { defaultValue: 'Clear All' })}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>{t('transactions.apply_filters', { defaultValue: 'Apply Filters' })}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (!canAccessFinances()) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={64} color={theme?.textSecondary || '#666'} />
        <Text style={styles.accessDeniedTitle}>{t('dashboard.accessDenied', { defaultValue: 'Access Denied' })}</Text>
        <Text style={styles.accessDeniedText}>
          {t('transactions.access_denied_text', { defaultValue: 'Only school principals can access transaction details.' })}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigateBack()}>
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateBack()}>
          <Ionicons name="arrow-back" size={24} color={theme?.text || '#333'} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('transactions.title', { defaultValue: 'Transactions' })}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={20} color={theme?.text || '#333'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={handleExport}
          >
            <Ionicons name="download" size={20} color={theme?.text || '#333'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme?.textSecondary || '#666'} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('transactions.search_placeholder', { defaultValue: 'Search transactions...' })}
          value={filters.searchTerm}
          onChangeText={(text) => setFilters(prev => ({ ...prev, searchTerm: text }))}
          placeholderTextColor={theme?.textSecondary || '#666'}
        />
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>
          {t('transactions.summary_count', { defaultValue: '{{count}} of {{total}} transactions', count: filteredTransactions.length, total: transactions.length })}
        </Text>
        <Text style={styles.summaryAmount}>
          {t('transactions.total', { defaultValue: 'Total' })}: {formatCurrency(
            filteredTransactions.reduce((sum, t) => 
              sum + (t.type === 'income' ? t.amount : -t.amount), 0
            )
          )}
        </Text>
      </View>

      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadTransactions(true)} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Filter Modal */}
      {renderFilterModal()}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    backgroundColor: theme?.surface || 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerAction: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme?.surface || 'white',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: theme?.text || '#333',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryText: {
    fontSize: 14,
    color: theme?.textSecondary || '#666',
  },
  summaryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  transactionCard: {
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme?.surfaceVariant || '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: theme?.text || '#333',
    marginBottom: 4,
  },
  transactionCategory: {
    fontSize: 14,
    color: theme?.textSecondary || '#666',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
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
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme?.surface || 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  filterSection: {
    padding: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme?.surfaceVariant || '#f1f5f9',
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
  },
  filterOptionActive: {
    backgroundColor: (theme?.primary || '#007AFF') + '20',
    borderColor: theme?.primary || '#007AFF',
  },
  filterOptionText: {
    fontSize: 14,
    color: theme?.textSecondary || '#666',
  },
  filterOptionTextActive: {
    color: theme?.primary || '#007AFF',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme?.border || '#e2e8f0',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme?.textSecondary || '#666',
    alignItems: 'center',
  },
  clearButtonText: {
    color: theme?.textSecondary || '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme?.primary || '#007AFF',
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    color: theme?.textSecondary || '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: theme?.primary || '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
