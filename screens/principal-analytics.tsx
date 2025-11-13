/* eslint-disable i18next/no-literal-string */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTheme } from '../contexts/ThemeContext';

interface AnalyticsData {
  enrollment: {
    totalStudents: number;
    newEnrollments: number;
    withdrawals: number;
    retentionRate: number;
    ageGroupDistribution: { ageGroup: string; count: number }[];
  };
  attendance: {
    averageAttendance: number;
    todayAttendance: number;
    weeklyTrend: { day: string; rate: number }[];
    lowAttendanceAlerts: number;
  };
  finance: {
    monthlyRevenue: number;
    outstandingFees: number;
    paymentRate: number;
    expenseRatio: number;
  };
  staff: {
    totalStaff: number;
    activeTeachers: number;
    studentTeacherRatio: number;
    performanceScore: number;
  };
  academic: {
    averageGrade: number;
    improvingStudents: number;
    strugglingStudents: number;
    parentEngagement: number;
  };
}

const PrincipalAnalytics: React.FC = () => {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const { tier, ready: subscriptionReady } = useSubscription();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  
  // Check if user has premium analytics access
  const hasAdvancedAnalytics = tier === 'enterprise' || tier === 'pro' || profile?.role === 'super_admin';

  const loadAnalytics = async () => {
    if (!user || !supabase) return;

    try {
      setLoading(true);

      // Get school info based on the current user's assigned preschool
      const schoolId = (profile as any)?.preschool_id || (profile as any)?.organization_id;
      if (!schoolId) return;
      const { data: school } = await supabase!
        .from('preschools')
        .select('id, name')
        .eq('id', schoolId)
        .maybeSingle();

      if (!school) return;

      // Get enrollment data
      const { data: students, count: totalStudents } = await supabase!
        .from('students')
        .select(`
          id,
          created_at,
          status,
          date_of_birth,
          age_groups (name)
        `)
        .eq('preschool_id', school.id);

      // Calculate enrollment metrics
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      const newEnrollments = students?.filter(s => new Date(s.created_at) >= lastMonth).length || 0;
      const activeStudents = students?.filter(s => s.status === 'active').length || 0;
      const withdrawnStudents = students?.filter(s => s.status === 'withdrawn').length || 0;
      const retentionRate = totalStudents ? ((activeStudents / totalStudents) * 100) : 0;

      // Age group distribution
      const ageGroupCounts: { [key: string]: number } = {};
      students?.forEach(s => {
        const ageGroup = (s.age_groups as any)?.name || 'Unknown';
        ageGroupCounts[ageGroup] = (ageGroupCounts[ageGroup] || 0) + 1;
      });
      const ageGroupDistribution = Object.entries(ageGroupCounts).map(([ageGroup, count]) => ({
        ageGroup,
        count,
      }));

      // Get attendance data (current month)
      const { data: attendanceRecords } = await supabase!
        .from('attendance_records')
        .select('status, date')
        .eq('preschool_id', school.id)
        .gte('date', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());

      const totalAttendanceRecords = attendanceRecords?.length || 0;
      const presentRecords = attendanceRecords?.filter(a => a.status === 'present').length || 0;
      const averageAttendance = totalAttendanceRecords > 0 ? (presentRecords / totalAttendanceRecords) * 100 : 0;

      // Compute weekly trend (Sun-Sat) from current month's records
      const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const weeklyTrend = dayLabels.map((label, idx) => {
        const recs = (attendanceRecords || []).filter(r => new Date(r.date).getDay() === idx);
        const present = recs.filter(r => r.status === 'present').length;
        const rate = recs.length > 0 ? Math.round((present / recs.length) * 100) : 0;
        return { day: label, rate };
      });

      // Low attendance alerts in last 7 days (daily rate < 85%)
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      const recent = (attendanceRecords || []).filter(r => new Date(r.date) >= sevenDaysAgo);
      const byDay: Record<string, { present: number; total: number }> = {};
      for (const r of recent) {
        const key = new Date(r.date).toISOString().split('T')[0];
        if (!byDay[key]) byDay[key] = { present: 0, total: 0 };
        byDay[key].total += 1;
        if (r.status === 'present') byDay[key].present += 1;
      }
      const lowAttendanceAlerts = Object.values(byDay).reduce((count, d) => {
        const rate = d.total > 0 ? (d.present / d.total) * 100 : 0;
        return count + (rate < 85 ? 1 : 0);
      }, 0);

      // Today's attendance
      const today = new Date().toISOString().split('T')[0];
      const { data: todayAttendance } = await supabase!
        .from('attendance_records')
        .select('status')
        .eq('preschool_id', school.id)
        .gte('date', today + 'T00:00:00')
        .lt('date', today + 'T23:59:59');

      const todayPresent = todayAttendance?.filter(a => a.status === 'present').length || 0;
      const todayTotal = todayAttendance?.length || 0;
      const todayAttendanceRate = todayTotal > 0 ? (todayPresent / todayTotal) * 100 : 0;

      // Get financial data
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const { data: monthlyRevenue } = await supabase!
        .from('financial_transactions')
        .select('amount')
        .eq('preschool_id', school.id)
        .eq('type', 'fee_payment')
        .eq('status', 'completed')
        .gte('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('created_at', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

      const totalRevenue = monthlyRevenue?.reduce((sum, t) => sum + t.amount, 0) || 0;

      const { data: outstanding } = await supabase!
        .from('financial_transactions')
        .select('amount')
        .eq('preschool_id', school.id)
        .eq('type', 'fee_payment')
        .eq('status', 'pending');

      const totalOutstanding = outstanding?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const paymentRate = totalRevenue > 0 ? (totalRevenue / (totalRevenue + totalOutstanding)) * 100 : 0;

      // Get staff data from users table
      const { data: teachers, count: totalStaff } = await supabase!
        .from('users')
        .select('id, role')
        .eq('preschool_id', school.id)
        .eq('role', 'teacher');

      const activeTeachers = teachers?.length || 0;
      const studentTeacherRatio = activeTeachers > 0 ? activeStudents / activeTeachers : 0;

      // Build analytics object from real data (no mocks)
      const analyticsData: AnalyticsData = {
        enrollment: {
          totalStudents: totalStudents || 0,
          newEnrollments,
          withdrawals: withdrawnStudents,
          retentionRate,
          ageGroupDistribution,
        },
        attendance: {
          averageAttendance,
          todayAttendance: todayAttendanceRate,
          weeklyTrend,
          lowAttendanceAlerts,
        },
        finance: {
          monthlyRevenue: totalRevenue,
          outstandingFees: totalOutstanding,
          paymentRate,
          expenseRatio: 0, // Unknown here; can be derived from expenses table later
        },
        staff: {
          totalStaff: totalStaff || 0,
          activeTeachers,
          studentTeacherRatio,
          performanceScore: 0, // Placeholder - performance evaluations not yet configured
        },
        academic: {
          averageGrade: 0, // Placeholder - waiting for assessment data
          improvingStudents: 0, // Placeholder - waiting for assessment data
          strugglingStudents: 0, // Placeholder - waiting for assessment data 
          parentEngagement: 0, // Placeholder - waiting for engagement tracking
        },
      };

      setAnalytics(analyticsData);
    } catch {
      console.error('Error loading analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (value: number, good: number, excellent: number) => {
    if (value >= excellent) return '#10B981';
    if (value >= good) return '#F59E0B';
    return '#EF4444';
  };

  // Premium entitlement check for upsell banner
  const isPremiumOrHigher = ['premium', 'pro', 'enterprise'].includes(String(tier || ''));

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!analytics) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="analytics-outline" size={64} color="#ccc" />
          <Text style={styles.errorText}>No analytics data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme?.background || '#f8f9fa' }]}>
      {/* Simple Header with Back Button */}
      <View style={[styles.header, { backgroundColor: theme?.cardBackground || '#fff' }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme?.text || '#333'} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: theme?.text || '#333' }]}>School Analytics</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/screens/export-analytics')}>
            <Ionicons name="download" size={24} color={theme?.primary || '#007AFF'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Period Selection */}
      <View style={styles.periodContainer}>
        {['week', 'month', 'quarter', 'year'].map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text
              style={[
                styles.periodText,
                selectedPeriod === period && styles.periodTextActive,
              ]}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!isPremiumOrHigher && (
          <View style={{ margin: 16, padding: 12, borderRadius: 12, backgroundColor: '#7C3AED10', borderWidth: 1, borderColor: '#7C3AED30', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#7C3AED', fontWeight: '600', flex: 1, marginRight: 12 }}>
              Unlock AI Insights & advanced analytics on the Premium plan
            </Text>
            <TouchableOpacity style={{ backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }} onPress={() => router.push('/screens/subscription-upgrade-post?reason=analytics')}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Key Metrics Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{analytics.enrollment.totalStudents}</Text>
              <Text style={styles.metricLabel}>Total Students</Text>
              <Text style={[styles.metricChange, { color: analytics.enrollment.newEnrollments > 0 ? '#10B981' : '#EF4444' }]}>
                +{analytics.enrollment.newEnrollments} this month
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{analytics.attendance.averageAttendance.toFixed(1)}%</Text>
              <Text style={styles.metricLabel}>Avg Attendance</Text>
              <Text style={[styles.metricChange, { color: getStatusColor(analytics.attendance.averageAttendance, 85, 95) }]}>
                {analytics.attendance.averageAttendance >= 90 ? '↗ Excellent' : analytics.attendance.averageAttendance >= 80 ? '→ Good' : '↘ Needs Attention'}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{formatCurrency(analytics.finance.monthlyRevenue)}</Text>
              <Text style={styles.metricLabel}>Monthly Revenue</Text>
              <Text style={[styles.metricChange, { color: '#10B981' }]}>
                {analytics.finance.paymentRate.toFixed(0)}% payment rate
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{analytics.staff.studentTeacherRatio.toFixed(1)}:1</Text>
              <Text style={styles.metricLabel}>Student:Teacher</Text>
              <Text style={[styles.metricChange, { color: getStatusColor(20 - analytics.staff.studentTeacherRatio, 5, 10) }]}>
                {analytics.staff.studentTeacherRatio <= 15 ? '✓ Optimal' : '⚠ Review needed'}
              </Text>
            </View>
          </View>
        </View>

        {/* Enrollment Analytics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enrollment Analytics</Text>
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsValue}>{analytics.enrollment.retentionRate.toFixed(1)}%</Text>
              <Text style={styles.analyticsLabel}>Retention Rate</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsValue}>{analytics.enrollment.newEnrollments}</Text>
              <Text style={styles.analyticsLabel}>New Enrollments</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsValue}>{analytics.enrollment.withdrawals}</Text>
              <Text style={styles.analyticsLabel}>Withdrawals</Text>
            </View>
          </View>

          {/* Age Group Distribution */}
          <Text style={styles.subsectionTitle}>Age Group Distribution</Text>
          {analytics.enrollment.ageGroupDistribution.map((group, index) => (
            <View key={index} style={styles.distributionRow}>
              <Text style={styles.distributionLabel}>{group.ageGroup}</Text>
              <View style={styles.distributionBar}>
                <View
                  style={[
                    styles.distributionFill,
                    { width: `${(group.count / analytics.enrollment.totalStudents) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.distributionValue}>{group.count}</Text>
            </View>
          ))}
        </View>

        {/* Financial Analytics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Performance</Text>
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsCard}>
              <Text style={[styles.analyticsValue, { color: '#10B981' }]}>
                {formatCurrency(analytics.finance.monthlyRevenue)}
              </Text>
              <Text style={styles.analyticsLabel}>Revenue</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={[styles.analyticsValue, { color: '#EF4444' }]}>
                {formatCurrency(analytics.finance.outstandingFees)}
              </Text>
              <Text style={styles.analyticsLabel}>Outstanding</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsValue}>{analytics.finance.paymentRate.toFixed(1)}%</Text>
              <Text style={styles.analyticsLabel}>Payment Rate</Text>
            </View>
          </View>
        </View>

        {/* Academic Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Academic Insights</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>Assessment Data Coming Soon</Text>
            <Text style={styles.insightText}>
              • Academic assessments and progress tracking are being set up
            </Text>
            <Text style={styles.insightText}>
              • Parent engagement metrics will be available once configured
            </Text>
            <Text style={styles.insightText}>
              • Connect with support to enable detailed academic insights
            </Text>
            <TouchableOpacity
              style={styles.insightButton}
              onPress={() => {
                Alert.alert(
                  'Academic Insights Setup',
                  'Contact our support team to enable detailed academic tracking and assessment analytics for your school.',
                  [
                    { text: 'Contact Support', onPress: () => {
                      const message = encodeURIComponent('Hi, I need help setting up academic insights and assessment tracking for my school.');
                      const waUrl = `whatsapp://send?phone=27674770975&text=${message}`;
                      const webUrl = `https://wa.me/27674770975?text=${message}`;
                      Linking.canOpenURL('whatsapp://send').then(supported => {
                        if (supported) {
                          Linking.openURL(waUrl);
                        } else {
                          Linking.openURL(webUrl);
                        }
                      }).catch(() => {
                        Alert.alert('Error', 'Unable to open WhatsApp. Please contact support@edudashpro.com');
                      });
                    }},
                    { text: 'Later', style: 'cancel' }
                  ]
                );
              }}
            >
              <Text style={styles.insightButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended Actions</Text>
          <View style={styles.actionsList}>
            {analytics.attendance.lowAttendanceAlerts > 0 && (
              <View style={styles.actionItem}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
                <Text style={styles.actionText}>
                  {analytics.attendance.lowAttendanceAlerts} students have low attendance - consider parent meetings
                </Text>
              </View>
            )}
            {analytics.finance.paymentRate < 90 && (
              <View style={styles.actionItem}>
                <Ionicons name="card" size={20} color="#EF4444" />
                <Text style={styles.actionText}>
                  Payment rate below 90% - send payment reminders
                </Text>
              </View>
            )}
            {analytics.staff.studentTeacherRatio > 20 && (
              <View style={styles.actionItem}>
                <Ionicons name="people" size={20} color="#7C3AED" />
                <Text style={styles.actionText}>
                  Consider hiring additional teachers to improve ratios
                </Text>
              </View>
            )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
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
  periodContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
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
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
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
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 10,
    fontWeight: '500',
  },
  analyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  analyticsCard: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  analyticsValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  analyticsLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  distributionLabel: {
    width: 80,
    fontSize: 12,
    color: '#333',
  },
  distributionBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginHorizontal: 8,
  },
  distributionFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  distributionValue: {
    width: 30,
    fontSize: 12,
    color: '#333',
    textAlign: 'right',
  },
  insightCard: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  insightButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  insightButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  actionsList: {
    gap: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  actionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
  },
  
  // Enhanced Header Styles
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  greetingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greetingContent: {
    flex: 1,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  greetingSubtext: {
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Subscription Badge Styles
  subscriptionBadgeContainer: {
    alignItems: 'flex-end',
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  premiumSubscriptionBadge: {
    backgroundColor: '#8B5CF6' + '15',
    borderWidth: 1,
    borderColor: '#8B5CF6' + '30',
  },
  basicSubscriptionBadge: {
    backgroundColor: '#F59E0B' + '15',
    borderWidth: 1,
    borderColor: '#F59E0B' + '30',
  },
  subscriptionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  premiumBadgeText: {
    color: '#8B5CF6',
  },
  basicBadgeText: {
    color: '#F59E0B',
  },
  
  // Enhanced CTA Section
  ctaSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#8B5CF6' + '20',
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B5CF6' + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  ctaTextContainer: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ctaSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  upgradeCTAButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  upgradeCTAButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Premium Status Section
  premiumStatusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#10B981' + '10',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981' + '20',
  },
  premiumStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  premiumStatusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },
  manageSubscriptionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  manageSubscriptionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default PrincipalAnalytics;