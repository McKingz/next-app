/* eslint-disable i18next/no-literal-string */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FinancialDataService, UnifiedTransaction, FinancialMetrics, MonthlyTrendData } from '../services/FinancialDataService';

// Define types locally
interface School {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

const FinancialDashboard: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [school, setSchool] = useState<School | null>(null);
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    monthlyRevenue: 0,
    outstandingPayments: 0,
    totalStudents: 0,
    averageFeePerStudent: 0,
    paymentCompletionRate: 0,
    monthlyExpenses: 0,
    netIncome: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<UnifiedTransaction[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFinancialData = async () => {
    if (!user || !supabase) return;

    try {
      setLoading(true);

      // Get school info
      const { data: schoolData, error: schoolError } = await supabase
        .from('preschools')
        .select('*')
        .eq('created_by', user.id)
        .single();

      if (schoolError && schoolError.code !== 'PGRST116') {
        console.error('Error loading school:', schoolError);
        return;
      }

      if (schoolData) {
        setSchool(schoolData);

        // Load financial metrics using the new service
        const financialMetrics = await FinancialDataService.getFinancialMetrics(schoolData.id);
        setMetrics(financialMetrics);

        // Load recent transactions
        const transactions = await FinancialDataService.getRecentTransactions(schoolData.id, 10);
        setRecentTransactions(transactions);

        // Load monthly trend data
        const trendData = await FinancialDataService.getMonthlyTrendData(schoolData.id);
        setMonthlyData(trendData);
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
      Alert.alert('Error', 'Failed to load financial data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFinancialData();
  };

  const formatCurrency = FinancialDataService.formatCurrency;
  const getStatusColor = FinancialDataService.getStatusColor;
  const getDisplayStatus = FinancialDataService.getDisplayStatus;

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading financial data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial Dashboard</Text>
        <TouchableOpacity onPress={() => router.push('/screens/financial-reports')}>
          <Ionicons name="document-text" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{formatCurrency(metrics.monthlyRevenue)}</Text>
              <Text style={styles.metricLabel}>Monthly Revenue</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{formatCurrency(metrics.outstandingPayments)}</Text>
              <Text style={styles.metricLabel}>Outstanding</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{formatCurrency(metrics.netIncome)}</Text>
              <Text style={[styles.metricLabel, { color: metrics.netIncome >= 0 ? '#10B981' : '#EF4444' }]}>Net Income</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{metrics.paymentCompletionRate.toFixed(1)}%</Text>
              <Text style={styles.metricLabel}>Payment Rate</Text>
            </View>
          </View>
        </View>

        {/* Monthly Trend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6-Month Trend</Text>
          <View style={styles.trendContainer}>
            {monthlyData.map((month, index) => (
              <View key={index} style={styles.monthColumn}>
                <Text style={styles.monthLabel}>{month.month}</Text>
                <View style={[styles.revenueBar, { height: Math.max(month.revenue / 1000, 10) }]} />
                <Text style={styles.monthValue}>{formatCurrency(month.revenue)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/screens/financial-transactions')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentTransactions.length > 0 ? (
            recentTransactions.map((transaction, index) => (
              <View key={index} style={styles.transactionCard}>
                <View style={styles.transactionLeft}>
                  <Text style={styles.transactionDescription}>
                    {transaction.description}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {new Date(transaction.date).toLocaleDateString()}
                  </Text>
                  {transaction.reference && (
                    <Text style={styles.transactionReference}>
                      Ref: {transaction.reference}
                    </Text>
                  )}
                </View>
                <View style={styles.transactionRight}>
                  <Text style={[
                    styles.transactionAmount,
                    { color: transaction.type === 'expense' ? '#EF4444' : transaction.type === 'outstanding' ? '#F59E0B' : '#10B981' }
                  ]}>
                    {transaction.type === 'expense' ? '-' : '+'}{formatCurrency(transaction.amount)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(transaction.status) }]}>
                    <Text style={styles.statusText}>{getDisplayStatus(transaction.status)}</Text>
                  </View>
                  <Text style={styles.transactionSource}>
                    {transaction.source === 'payment' ? 'Payment' : 'Petty Cash'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/screens/add-transaction')}
            >
              <Ionicons name="add-circle" size={32} color="#007AFF" />
              <Text style={styles.actionText}>Add Transaction</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/screens/payment-reminders')}
            >
              <Ionicons name="notifications" size={32} color="#F59E0B" />
              <Text style={styles.actionText}>Send Reminders</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/screens/financial-reports')}
            >
              <Ionicons name="bar-chart" size={32} color="#10B981" />
              <Text style={styles.actionText}>Generate Report</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/screens/expense-categories')}
            >
              <Ionicons name="pie-chart" size={32} color="#8B5CF6" />
              <Text style={styles.actionText}>Expenses</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  viewAllText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingBottom: 20,
  },
  monthColumn: {
    alignItems: 'center',
    flex: 1,
  },
  monthLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  revenueBar: {
    width: 20,
    backgroundColor: '#007AFF',
    borderRadius: 2,
    marginBottom: 8,
  },
  monthValue: {
    fontSize: 10,
    color: '#333',
    textAlign: 'center',
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionReference: {
    fontSize: 10,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
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
    color: '#fff',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  transactionSource: {
    fontSize: 9,
    color: '#888',
    marginTop: 4,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 12,
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default FinancialDashboard;