/* eslint-disable i18next/no-literal-string */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const FinancialReports: React.FC = () => {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');

  const reports = [
    {
      title: 'Revenue Report',
      description: 'Detailed analysis of fee collections and revenue streams',
      icon: 'trending-up',
      color: '#10B981',
      comingSoon: false,
    },
    {
      title: 'Expense Report',
      description: 'Breakdown of operational expenses and cost analysis',
      icon: 'trending-down',
      color: '#EF4444',
      comingSoon: false,
    },
    {
      title: 'Profit & Loss Statement',
      description: 'Comprehensive P&L statement with comparisons',
      icon: 'bar-chart',
      color: '#007AFF',
      comingSoon: false,
    },
    {
      title: 'Cash Flow Report',
      description: 'Track money in and out with cash flow analysis',
      icon: 'swap-horizontal',
      color: '#8B5CF6',
      comingSoon: true,
    },
    {
      title: 'Outstanding Payments',
      description: 'List of pending payments and overdue fees',
      icon: 'time',
      color: '#F59E0B',
      comingSoon: false,
    },
    {
      title: 'Tax Summary',
      description: 'Tax-related income and expense summaries',
      icon: 'document-text',
      color: '#6B7280',
      comingSoon: true,
    },
  ];

  const periods = [
    { key: 'monthly', label: 'Monthly' },
    { key: 'quarterly', label: 'Quarterly' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'custom', label: 'Custom Range' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial Reports</Text>
<TouchableOpacity onPress={() => router.push('/screens/financial-dashboard')}>
          <Ionicons name="download" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Period Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Period</Text>
          <View style={styles.periodContainer}>
            {periods.map((period) => (
              <TouchableOpacity
                key={period.key}
                style={[
                  styles.periodButton,
                  selectedPeriod === period.key && styles.periodButtonActive,
                ]}
                onPress={() => setSelectedPeriod(period.key)}
              >
                <Text
                  style={[
                    styles.periodText,
                    selectedPeriod === period.key && styles.periodTextActive,
                  ]}
                >
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Available Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Reports</Text>
          {reports.map((report, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.reportCard,
                report.comingSoon && styles.reportCardDisabled,
              ]}
              onPress={() => {
                if (!report.comingSoon) {
                  // Navigate to specific report screen
router.push('/screens/financial-dashboard');
                }
              }}
              disabled={report.comingSoon}
            >
              <View style={[styles.reportIcon, { backgroundColor: report.color }]}>
                <Ionicons name={report.icon as any} size={24} color="#fff" />
              </View>
              <View style={styles.reportContent}>
                <View style={styles.reportHeader}>
                  <Text style={[
                    styles.reportTitle,
                    report.comingSoon && styles.reportTitleDisabled,
                  ]}>
                    {report.title}
                  </Text>
                  {report.comingSoon && (
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>Coming Soon</Text>
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.reportDescription,
                  report.comingSoon && styles.reportDescriptionDisabled,
                ]}>
                  {report.description}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={report.comingSoon ? "#ccc" : "#666"}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionCard}
onPress={() => router.push('/screens/financial-reports')}
            >
              <Ionicons name="download" size={32} color="#007AFF" />
              <Text style={styles.actionText}>Export All Data</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
onPress={() => router.push('/screens/financial-transactions')}
            >
              <Ionicons name="calendar" size={32} color="#10B981" />
              <Text style={styles.actionText}>Schedule Reports</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
onPress={() => router.push('/screens/financial-transactions')}
            >
              <Ionicons name="document" size={32} color="#8B5CF6" />
              <Text style={styles.actionText}>Custom Templates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/screens/financial-dashboard')}
            >
              <Ionicons name="analytics" size={32} color="#F59E0B" />
              <Text style={styles.actionText}>Live Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <View style={styles.helpCard}>
            <Ionicons name="help-circle" size={24} color="#007AFF" />
            <View style={styles.helpContent}>
              <Text style={styles.helpTitle}>Report Guide</Text>
              <Text style={styles.helpText}>
                Learn how to generate, customize, and interpret your financial reports
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/help/financial-reports')}>
              <Ionicons name="chevron-forward" size={20} color="#666" />
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  periodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  periodText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#fff',
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
  },
  reportCardDisabled: {
    opacity: 0.6,
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  reportContent: {
    flex: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  reportTitleDisabled: {
    color: '#999',
  },
  reportDescription: {
    fontSize: 14,
    color: '#666',
  },
  reportDescriptionDisabled: {
    color: '#999',
  },
  comingSoonBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  comingSoonText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
    textTransform: 'uppercase',
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
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  helpContent: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
  },
});

export default FinancialReports;