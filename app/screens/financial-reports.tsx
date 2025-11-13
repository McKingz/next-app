/**
 * Comprehensive Financial Reports Screen
 * 
 * Features:
 * - Advanced analytics with multiple chart types
 * - Custom date range selection
 * - Drill-down capabilities for detailed analysis
 * - Comparison views and trend analysis
 * - Export functionality with custom reports
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { navigateBack } from '@/lib/navigation';

import { FinancialDataService } from '@/services/FinancialDataService';
import { ChartDataService } from '@/lib/services/finance/ChartDataService';
import { ExportService } from '@/lib/services/finance/ExportService';
import type { FinanceOverviewData, TransactionRecord } from '@/services/FinancialDataService';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 32;

type ReportPeriod = '7days' | '30days' | '90days' | '1year';
type ReportType = 'overview' | 'trends' | 'categories' | 'comparison';

export default function FinancialReportsScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [overview, setOverview] = useState<FinanceOverviewData | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('30days');
  const [activeReport, setActiveReport] = useState<ReportType>('overview');

  useEffect(() => {
    loadReportData();
  }, [selectedPeriod]);

  const canAccessFinances = (): boolean => {
    return profile?.role === 'principal' || profile?.role === 'principal_admin';
  };

  const loadReportData = async (forceRefresh = false) => {
    try {
      setLoading(!forceRefresh);
      if (forceRefresh) setRefreshing(true);

      // Calculate date range based on selected period
      const days = {
        '7days': 7,
        '30days': 30,
        '90days': 90,
        '1year': 365,
      }[selectedPeriod];

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      // Load data
      const [overviewData, transactionData] = await Promise.all([
        FinancialDataService.getOverview(),
        FinancialDataService.getTransactions({
          from: fromDate.toISOString(),
          to: new Date().toISOString(),
        }),
      ]);

      setOverview(overviewData);
      setTransactions(transactionData);

    } catch (error) {
      console.error('Failed to load report data:', error);
      Alert.alert('Error', 'Failed to load financial reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleExportReport = () => {
    if (!overview || !transactions.length) {
      Alert.alert('No Data', 'No financial data available to export');
      return;
    }

    Alert.alert(
      'Export Report',
      'Choose export format:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'PDF Report',
          onPress: () => {
            const summary = {
              revenue: overview.keyMetrics.monthlyRevenue,
              expenses: overview.keyMetrics.monthlyExpenses,
              cashFlow: overview.keyMetrics.cashFlow,
            };
            ExportService.exportFinancialData(transactions, summary, {
              format: 'pdf',
              dateRange: {
                from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                to: new Date().toISOString(),
              },
              includeCharts: true,
            });
          }
        },
        {
          text: 'Excel Report',
          onPress: () => {
            const summary = {
              revenue: overview.keyMetrics.monthlyRevenue,
              expenses: overview.keyMetrics.monthlyExpenses,
              cashFlow: overview.keyMetrics.cashFlow,
            };
            ExportService.exportFinancialData(transactions, summary, {
              format: 'excel',
              dateRange: {
                from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                to: new Date().toISOString(),
              },
              includeCharts: false,
            });
          }
        },
      ]
    );
  };

  const formatCurrency = (amount: number): string => {
    return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  };

  const calculateSummaryStats = () => {
    if (!transactions.length || !overview) return null;

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netCashFlow = totalIncome - totalExpenses;

    // Calculate averages based on period
    const days = {
      '7days': 7,
      '30days': 30,
      '90days': 90,
      '1year': 365,
    }[selectedPeriod];

    const avgDailyIncome = totalIncome / days;
    const avgDailyExpenses = totalExpenses / days;

    return {
      totalIncome,
      totalExpenses,
      netCashFlow,
      avgDailyIncome,
      avgDailyExpenses,
      transactionCount: transactions.length,
    };
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {[
        { key: '7days', label: '7 Days' },
        { key: '30days', label: '30 Days' },
        { key: '90days', label: '90 Days' },
        { key: '1year', label: '1 Year' },
      ].map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={[
            styles.periodOption,
            selectedPeriod === key && styles.periodOptionActive,
          ]}
          onPress={() => setSelectedPeriod(key as ReportPeriod)}
        >
          <Text
            style={[
              styles.periodOptionText,
              selectedPeriod === key && styles.periodOptionTextActive,
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderReportTabs = () => (
    <View style={styles.reportTabs}>
      {[
        { key: 'overview', label: 'Overview', icon: 'analytics' },
        { key: 'trends', label: 'Trends', icon: 'trending-up' },
        { key: 'categories', label: 'Categories', icon: 'pie-chart' },
        { key: 'comparison', label: 'Compare', icon: 'bar-chart' },
      ].map(({ key, label, icon }) => (
        <TouchableOpacity
          key={key}
          style={[
            styles.reportTab,
            activeReport === key && styles.reportTabActive,
          ]}
          onPress={() => setActiveReport(key as ReportType)}
        >
          <Ionicons
            name={icon as any}
            size={16}
            color={activeReport === key ? (theme?.primary || '#007AFF') : (theme?.textSecondary || '#666')}
          />
          <Text
            style={[
              styles.reportTabText,
              activeReport === key && styles.reportTabTextActive,
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSummaryCards = () => {
    const stats = calculateSummaryStats();
    if (!stats) return null;

    return (
      <View style={styles.summaryCards}>
        <View style={[styles.summaryCard, { width: (screenWidth - 48) / 2 }]}>
          <Text style={styles.summaryCardTitle}>Total Income</Text>
          <Text style={[styles.summaryCardValue, { color: theme?.success || '#059669' }]}>
            {formatCurrency(stats.totalIncome)}
          </Text>
          <Text style={styles.summaryCardSubtitle}>
            {formatCurrency(stats.avgDailyIncome)}/day avg
          </Text>
        </View>

        <View style={[styles.summaryCard, { width: (screenWidth - 48) / 2 }]}>
          <Text style={styles.summaryCardTitle}>Total Expenses</Text>
          <Text style={[styles.summaryCardValue, { color: theme?.error || '#DC2626' }]}>
            {formatCurrency(stats.totalExpenses)}
          </Text>
          <Text style={styles.summaryCardSubtitle}>
            {formatCurrency(stats.avgDailyExpenses)}/day avg
          </Text>
        </View>

        <View style={[styles.summaryCard, { width: (screenWidth - 48) / 2 }]}>
          <Text style={styles.summaryCardTitle}>Net Cash Flow</Text>
          <Text style={[
            styles.summaryCardValue,
            { color: stats.netCashFlow >= 0 ? (theme?.success || '#059669') : (theme?.error || '#DC2626') }
          ]}>
            {formatCurrency(stats.netCashFlow)}
          </Text>
          <Text style={styles.summaryCardSubtitle}>
            {stats.netCashFlow >= 0 ? 'Positive' : 'Negative'} flow
          </Text>
        </View>

        <View style={[styles.summaryCard, { width: (screenWidth - 48) / 2 }]}>
          <Text style={styles.summaryCardTitle}>Transactions</Text>
          <Text style={[styles.summaryCardValue, { color: theme?.primary || '#4F46E5' }]}>
            {stats.transactionCount}
          </Text>
          <Text style={styles.summaryCardSubtitle}>
            {selectedPeriod.replace(/\d+/, m => `${m} `)}
          </Text>
        </View>
      </View>
    );
  };

  const renderReportContent = () => {
    if (!overview) return null;

    const chartConfig = ChartDataService.getCommonChartConfig();

    switch (activeReport) {
      case 'overview':
        return renderSummaryCards();

      case 'trends': {
        const trendData = ChartDataService.formatTransactionVolume(transactions);
        return (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Transaction Volume Trends</Text>
            <LineChart
              data={trendData}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </View>
        );
      }

      case 'categories': {
        const categoriesData = ChartDataService.formatCategoriesBreakdown(overview);
        return (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Expense Breakdown by Category</Text>
            <PieChart
              data={categoriesData}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              center={[10, 0]}
              style={styles.chart}
            />
          </View>
        );
      }

      case 'comparison': {
        const comparisonData = ChartDataService.formatMonthlyComparison(overview);
        return (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Revenue vs Expenses Comparison</Text>
            <BarChart
              data={comparisonData}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              style={styles.chart}
              yAxisLabel="R"
              yAxisSuffix="k"
            />
          </View>
        );
      }

      default:
        return null;
    }
  };

  if (!canAccessFinances()) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={64} color={theme?.textSecondary || '#666'} />
        <Text style={styles.accessDeniedTitle}>Access Denied</Text>
        <Text style={styles.accessDeniedText}>
          Only school principals can access financial reports.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigateBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
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
        <Text style={styles.title}>Financial Reports</Text>
        <TouchableOpacity onPress={handleExportReport}>
          <Ionicons name="download" size={24} color={theme?.text || '#333'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadReportData(true)} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Period Selector */}
        {renderPeriodSelector()}

        {/* Report Type Tabs */}
        {renderReportTabs()}

        {/* Report Content */}
        {renderReportContent()}

        {/* Additional Insights */}
        <View style={styles.insightsContainer}>
          <Text style={styles.insightsTitle}>Key Insights</Text>
          <View style={styles.insightsList}>
            <View style={styles.insightItem}>
              <Ionicons name="trending-up" size={20} color={theme?.success || '#059669'} />
              <Text style={styles.insightText}>
                Revenue is {(overview?.keyMetrics?.cashFlow ?? 0) >= 0 ? 'exceeding' : 'below'} expenses this period
              </Text>
            </View>
            <View style={styles.insightItem}>
              <Ionicons name="pie-chart" size={20} color={theme?.primary || '#4F46E5'} />
              <Text style={styles.insightText}>
                Largest expense category: {overview?.categoriesBreakdown[0]?.name || 'N/A'}
              </Text>
            </View>
            <View style={styles.insightItem}>
              <Ionicons name="analytics" size={20} color={theme?.warning || '#EA580C'} />
              <Text style={styles.insightText}>
                {transactions.length} transactions processed in selected period
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  content: {
    flex: 1,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: theme?.surface || 'white',
    margin: 16,
    borderRadius: 8,
    padding: 4,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  periodOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 4,
  },
  periodOptionActive: {
    backgroundColor: (theme?.primary || '#007AFF') + '20',
  },
  periodOptionText: {
    fontSize: 14,
    color: theme?.textSecondary || '#666',
  },
  periodOptionTextActive: {
    color: theme?.primary || '#007AFF',
    fontWeight: '600',
  },
  reportTabs: {
    flexDirection: 'row',
    backgroundColor: theme?.surface || 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 8,
    padding: 4,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reportTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 4,
    gap: 4,
  },
  reportTabActive: {
    backgroundColor: (theme?.primary || '#007AFF') + '20',
  },
  reportTabText: {
    fontSize: 12,
    color: theme?.textSecondary || '#666',
  },
  reportTabTextActive: {
    color: theme?.primary || '#007AFF',
    fontWeight: '600',
  },
  summaryCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryCardTitle: {
    fontSize: 14,
    color: theme?.textSecondary || '#666',
    marginBottom: 8,
  },
  summaryCardValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryCardSubtitle: {
    fontSize: 12,
    color: theme?.textSecondary || '#666',
  },
  chartContainer: {
    backgroundColor: theme?.cardBackground || 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  insightsContainer: {
    backgroundColor: theme?.cardBackground || 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginBottom: 12,
  },
  insightsList: {
    gap: 12,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insightText: {
    fontSize: 14,
    color: theme?.text || '#333',
    flex: 1,
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
