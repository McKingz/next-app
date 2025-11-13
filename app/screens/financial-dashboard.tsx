/**
 * Modern Financial Management Dashboard
 * 
 * Features:
 * - Interactive charts with react-native-chart-kit
 * - Real-time export functionality (CSV, PDF, Excel)
 * - Responsive design with touch interactions
 * - Clean architecture with service separation
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
  ActivityIndicator,
} from 'react-native';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { navigateBack } from '@/lib/navigation';
import { useTranslation } from 'react-i18next';
import { derivePreschoolId } from '@/lib/roleUtils';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';

import { FinancialDataService } from '@/services/FinancialDataService';
import { ChartDataService } from '@/lib/services/finance/ChartDataService';
import { ExportService } from '@/lib/services/finance/ExportService';
import type { FinanceOverviewData, TransactionRecord } from '@/services/FinancialDataService';
import type { ExportFormat } from '@/lib/services/finance/ExportService';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 32;

export default function FinanceDashboard() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation('common');
  
  const [overview, setOverview] = useState<FinanceOverviewData | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeChart, setActiveChart] = useState<'cashflow' | 'categories' | 'comparison'>('cashflow');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const canAccessFinances = (): boolean => {
    return profile?.role === 'principal' || profile?.role === 'principal_admin';
  };

  const loadDashboardData = async (forceRefresh = false) => {
    try {
      setLoading(!forceRefresh);
      if (forceRefresh) setRefreshing(true);

      const preschoolId = derivePreschoolId(profile);

      // Load financial overview (fallback works when preschoolId is undefined)
      const overviewData = await FinancialDataService.getOverview(preschoolId || undefined);
      setOverview(overviewData);

      // Load recent transactions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const transactionData = await FinancialDataService.getTransactions({
        from: thirtyDaysAgo.toISOString(),
        to: new Date().toISOString(),
      }, preschoolId || undefined);
      setTransactions(transactionData);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('finance_dashboard.load_failed', { defaultValue: 'Failed to load financial dashboard' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleExport = (format: ExportFormat) => {
    if (!overview || !transactions.length) {
      Alert.alert(t('transactions.no_data', { defaultValue: 'No Data' }), t('finance_dashboard.no_financial_data_export', { defaultValue: 'No financial data available to export' }));
      return;
    }

    const summary = {
      revenue: overview.keyMetrics.monthlyRevenue,
      expenses: overview.keyMetrics.monthlyExpenses,
      cashFlow: overview.keyMetrics.cashFlow,
    };

    ExportService.exportFinancialData(transactions, summary, {
      format,
      dateRange: {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
      },
      includeCharts: true,
    });
  };

  const formatCurrency = (amount: number): string => {
    return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  };

  const renderMetricCard = (title: string, value: string, subtitle: string, color: string, icon: string) => (
    <View style={[styles.metricCard, { width: (screenWidth - 48) / 2 }]}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon as any} size={24} color={color} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </View>
  );

  const renderChart = () => {
    if (!overview) return null;

    const chartConfig = ChartDataService.getCommonChartConfig();

    switch (activeChart) {
      case 'cashflow': {
        const cashFlowData = ChartDataService.formatCashFlowTrend(overview);
        return (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>{t('finance_dashboard.trend_title', { defaultValue: 'Cash Flow Trend (Last 6 Months)' })}</Text>
            <LineChart
              data={cashFlowData}
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
            <Text style={styles.chartTitle}>{t('finance_dashboard.categories_title', { defaultValue: 'Expense Categories' })}</Text>
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
            <Text style={styles.chartTitle}>{t('finance_dashboard.comparison_title', { defaultValue: 'Monthly Comparison' })}</Text>
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

  const renderChartSelector = () => (
    <View style={styles.chartSelector}>
      {[
        { key: 'cashflow', label: t('finance_dashboard.tab_cash_flow', { defaultValue: 'Cash Flow' }), icon: 'trending-up' },
        { key: 'categories', label: t('finance_dashboard.tab_categories', { defaultValue: 'Categories' }), icon: 'pie-chart' },
        { key: 'comparison', label: t('finance_dashboard.tab_comparison', { defaultValue: 'Compare' }), icon: 'bar-chart' },
      ].map(({ key, label, icon }) => (
        <TouchableOpacity
          key={key}
          style={[
            styles.chartTab,
            activeChart === key && styles.chartTabActive,
          ]}
          onPress={() => setActiveChart(key as any)}
        >
          <Ionicons 
            name={icon as any} 
            size={16} 
            color={activeChart === key ? (theme?.primary || Colors.light.tint) : (theme?.textSecondary || Colors.light.tabIconDefault)} 
          />
          <Text 
            style={[
              styles.chartTabText,
              activeChart === key && styles.chartTabTextActive,
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderExportOptions = () => (
    <View style={styles.exportContainer}>
      <Text style={styles.sectionTitle}>{t('finance_dashboard.export_title', { defaultValue: 'Export Data' })}</Text>
      <View style={styles.exportButtons}>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => handleExport('csv')}
        >
          <Ionicons name="document-text" size={20} color={theme?.primary || Colors.light.tint} />
          <Text style={styles.exportButtonText}>{t('finance_dashboard.csv', { defaultValue: 'CSV' })}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => handleExport('excel')}
        >
          <Ionicons name="grid" size={20} color={theme?.primary || Colors.light.tint} />
          <Text style={styles.exportButtonText}>{t('finance_dashboard.excel', { defaultValue: 'Excel' })}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => handleExport('pdf')}
        >
          <Ionicons name="document" size={20} color={theme?.primary || Colors.light.tint} />
          <Text style={styles.exportButtonText}>{t('finance_dashboard.pdf', { defaultValue: 'PDF' })}</Text>
        </TouchableOpacity>
        </View>

        {/* Error screen when data cannot be loaded (fallback/sample) */}
        {overview?.isSample && (
          <View style={styles.errorContainer}>
            <Ionicons name="cloud-offline" size={48} color={theme?.textSecondary || Colors.light.tabIconDefault} />
            <Text style={styles.errorTitle}>{t('finance_dashboard.load_failed', { defaultValue: 'Unable to load financial data' })}</Text>
            <Text style={styles.errorSubtitle}>{t('finance_dashboard.check_connection', { defaultValue: 'Please check your connection or try again.' })}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadDashboardData(true)}>
              <Text style={styles.retryButtonText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
            </TouchableOpacity>
          </View>
        )}
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActions}>
      <Text style={styles.sectionTitle}>{t('finance_dashboard.quick_actions_title', { defaultValue: 'Quick Actions' })}</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/screens/financial-transactions')}
        >
          <Ionicons name="list" size={24} color={theme?.primary || Colors.light.tint} />
          <Text style={styles.actionText}>{t('finance_dashboard.view_transactions', { defaultValue: 'View Transactions' })}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/screens/financial-reports')}
        >
          <Ionicons name="analytics" size={24} color={theme?.primary || Colors.light.tint} />
          <Text style={styles.actionText}>{t('finance_dashboard.detailed_reports', { defaultValue: 'Detailed Reports' })}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!canAccessFinances()) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={64} color={theme?.textSecondary || Colors.light.tabIconDefault} />
        <Text style={styles.accessDeniedTitle}>{t('dashboard.accessDenied', { defaultValue: 'Access Denied' })}</Text>
        <Text style={styles.accessDeniedText}>
          {t('finance_dashboard.access_denied_text', { defaultValue: 'Only school principals can access the financial dashboard.' })}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigateBack()}>
          <Text style={styles.backButtonText}>{t('navigation.back', { defaultValue: 'Back' })}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <Text style={styles.loadingText}>{t('finance_dashboard.loading', { defaultValue: 'Loading financial dashboard...' })}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RoleBasedHeader title={t('finance_dashboard.title', { defaultValue: 'Finance Dashboard' })} showBackButton={true} />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboardData(true)} />
        }
        showsVerticalScrollIndicator={false}
      >
        {overview && !overview.isSample && (
          <>
            {/* Key Metrics */}
            <View style={styles.metricsGrid}>
              {renderMetricCard(
                t('dashboard.monthly_revenue', { defaultValue: 'Monthly Revenue' }),
                formatCurrency(overview.keyMetrics.monthlyRevenue),
                t('dashboard.this_month', { defaultValue: 'This month' }),
                '#059669',
                'trending-up'
              )}
              {renderMetricCard(
                t('dashboard.monthly_expenses', { defaultValue: 'Monthly Expenses' }), 
                formatCurrency(overview.keyMetrics.monthlyExpenses),
                t('dashboard.this_month', { defaultValue: 'This month' }),
                '#DC2626',
                'trending-down'
              )}
              {renderMetricCard(
                t('finance_dashboard.net_cash_flow', { defaultValue: 'Net Cash Flow' }),
                formatCurrency(overview.keyMetrics.cashFlow),
                overview.keyMetrics.cashFlow >= 0 ? t('finance_dashboard.positive', { defaultValue: 'Positive' }) : t('finance_dashboard.negative', { defaultValue: 'Negative' }),
                overview.keyMetrics.cashFlow >= 0 ? '#059669' : '#DC2626',
                'wallet'
              )}
              {renderMetricCard(
                t('finance_dashboard.total_transactions', { defaultValue: 'Total Transactions' }),
                transactions.length.toString(),
                t('finance_dashboard.last_30_days', { defaultValue: 'Last 30 days' }),
                '#4F46E5',
                'receipt'
              )}
            </View>

            {/* Chart Section */}
            {renderChartSelector()}
            {renderChart()}

            {/* Export Options */}
            {renderExportOptions()}

            {/* Quick Actions */}
            {renderQuickActions()}
          </>
        )}
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
    color: theme?.text || Colors.light.text,
  },
  content: {
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 16,
  },
  metricCard: {
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
    marginLeft: 8,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
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
    color: theme?.text || Colors.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartSelector: {
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
  chartTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 4,
    gap: 4,
  },
  chartTabActive: {
    backgroundColor: (theme?.primary || Colors.light.tint) + '20',
  },
  chartTabText: {
    fontSize: 12,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
  },
  chartTabTextActive: {
    color: theme?.primary || Colors.light.tint,
    fontWeight: '600',
  },
  exportContainer: {
    backgroundColor: theme?.surface || 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: (theme?.primary || Colors.light.tint) + '10',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme?.primary || Colors.light.tint,
  },
  quickActions: {
    margin: 16,
    marginTop: 0,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme?.cardBackground || 'white',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme?.text || Colors.light.text,
    marginTop: 8,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || Colors.light.text,
    marginBottom: 12,
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
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    color: Colors.light.tabIconDefault,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme?.background || '#f8fafc',
  },
  loadingText: {
    fontSize: 16,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
    marginTop: 16,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: theme?.text || Colors.light.text,
  },
  errorSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: theme?.primary || Colors.light.tint,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme?.onPrimary || '#fff',
    fontWeight: '600',
  },
});
