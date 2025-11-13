/**
 * SuperAdmin Dashboard - Main Dashboard Component
 * 
 * Integrates with deployed RPC functions to show real platform metrics,
 * user statistics, and system health status for superadmin oversight.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

interface SuperAdminDashboardProps {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

interface DashboardData {
  user_stats: {
    total_users: number;
    active_users: number;
    inactive_users: number;
    superadmins: number;
    principals: number;
    teachers: number;
    parents: number;
  };
  generated_at: string;
  success: boolean;
}

interface SystemTestResult {
  test_suite: string;
  run_at: string;
  superadmin_count: number;
  current_user_role: string;
  current_user_id: string;
  is_superadmin: boolean;
  system_status: string;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ loading, setLoading }) => {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Call the deployed RPC function to get dashboard data
      const { data: dashboardResult, error: dashboardError } = await assertSupabase()
        .rpc('get_superadmin_dashboard_data');

      if (dashboardError) {
        throw new Error(`Dashboard data error: ${dashboardError.message}`);
      }

      if (dashboardResult && dashboardResult.success) {
        setDashboardData(dashboardResult.data ? {
          user_stats: dashboardResult.data.user_stats,
          generated_at: dashboardResult.data.generated_at || dashboardResult.generated_at,
          success: dashboardResult.success,
        } : dashboardResult);
      } else {
        throw new Error('Dashboard data fetch was not successful');
      }

      // Test system health
      const { data: systemResult, error: systemError } = await assertSupabase()
        .rpc('test_superadmin_system');

      if (systemError) {
        console.warn('System test error:', systemError.message);
        // Don't throw here, as dashboard data might still be valid
      } else if (systemResult) {
        setSystemStatus(systemResult);
      }

      // Track dashboard access
      track('superadmin.dashboard.accessed', {
        user_id: user?.id,
        platform: Platform.OS,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error.message || 'Failed to load dashboard');
      Alert.alert('Error', 'Failed to load dashboard data. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [setLoading, user?.id]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [fetchDashboardData, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  const handleQuickAction = useCallback((action: string, route?: string) => {
    track('superadmin.quick_action', {
      action,
      user_id: user?.id,
      platform: Platform.OS,
    });

    if (route) {
      router.push(route as any);
    } else {
      Alert.alert('Coming Soon', `${action} functionality will be available soon.`);
    }
  }, [user?.id]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'operational':
        return theme.success || '#10b981';
      case 'no_superadmins':
        return theme.error || '#ef4444';
      default:
        return theme.warning || '#f59e0b';
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SkeletonLoader height={120} style={{ margin: 16 }} />
        <SkeletonLoader height={200} style={{ margin: 16 }} />
        <SkeletonLoader height={150} style={{ margin: 16 }} />
      </View>
    );
  }

  if (error && !dashboardData) {
    return (
      <View style={[styles.container, styles.errorContainer, { backgroundColor: theme.background }]}>
        <Ionicons name="warning" size={48} color={theme.error} />
        <Text style={[styles.errorTitle, { color: theme.text }]}>Dashboard Error</Text>
        <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={onRefresh}
        >
          <Text style={[styles.retryButtonText, { color: theme.onPrimary }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    >
      {/* System Status Card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="pulse" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>System Status</Text>
        </View>
        
        {systemStatus ? (
          <View style={styles.systemStatusContainer}>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Overall Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(systemStatus.system_status)}20` }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(systemStatus.system_status) }]} />
                <Text style={[styles.statusText, { color: getStatusColor(systemStatus.system_status) }]}>
                  {systemStatus.system_status.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>SuperAdmins Online</Text>
              <Text style={[styles.statusValue, { color: theme.text }]}>{systemStatus.superadmin_count}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Your Access Level</Text>
              <Text style={[styles.statusValue, { color: systemStatus.is_superadmin ? theme.success : theme.warning }]}>
                {systemStatus.is_superadmin ? 'SuperAdmin' : 'Limited'}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Last Health Check</Text>
              <Text style={[styles.statusValue, { color: theme.text }]}>
                {new Date(systemStatus.run_at).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.statusLoadingContainer}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.statusLoadingText, { color: theme.textSecondary }]}>
              Checking system status...
            </Text>
          </View>
        )}
      </View>

      {/* User Statistics */}
      {dashboardData && (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="people" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Platform Users</Text>
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatNumber(dashboardData.user_stats.total_users)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Users</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.success }]}>
                {formatNumber(dashboardData.user_stats.active_users)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active Users</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.warning }]}>
                {formatNumber(dashboardData.user_stats.inactive_users)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Inactive Users</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.error }]}>
                {formatNumber(dashboardData.user_stats.superadmins)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>SuperAdmins</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>
                {formatNumber(dashboardData.user_stats.principals)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Principals</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatNumber(dashboardData.user_stats.teachers)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Teachers</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatNumber(dashboardData.user_stats.parents)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Parents</Text>
            </View>
          </View>
          
          <Text style={[styles.dataTimestamp, { color: theme.textTertiary }]}>
            Last updated: {new Date(dashboardData.generated_at).toLocaleString()}
          </Text>
        </View>
      )}

      {/* Quick Actions */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="flash" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Quick Actions</Text>
        </View>
        
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[styles.quickActionButton, { borderColor: theme.divider }]}
            onPress={() => handleQuickAction('User Management', '/screens/super-admin-users')}
          >
            <Ionicons name="people-outline" size={24} color={theme.primary} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>User Management</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickActionButton, { borderColor: theme.divider }]}
            onPress={() => handleQuickAction('AI Quotas', '/screens/super-admin-ai-quotas')}
          >
            <Ionicons name="flash-outline" size={24} color={theme.primary} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>AI Quotas</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickActionButton, { borderColor: theme.divider }]}
            onPress={() => handleQuickAction('System Health', '/screens/super-admin-system-monitor')}
          >
            <Ionicons name="pulse-outline" size={24} color={theme.primary} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>System Health</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickActionButton, { borderColor: theme.divider }]}
            onPress={() => handleQuickAction('Settings', '/screens/super-admin-settings')}
          >
            <Ionicons name="settings-outline" size={24} color={theme.primary} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity (Mock data for now) */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="time" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Recent Activity</Text>
        </View>
        
        <View style={styles.activityList}>
          <View style={styles.activityItem}>
            <View style={[styles.activityDot, { backgroundColor: theme.success }]} />
            <View style={styles.activityContent}>
              <Text style={[styles.activityText, { color: theme.text }]}>System health check completed</Text>
              <Text style={[styles.activityTime, { color: theme.textSecondary }]}>2 minutes ago</Text>
            </View>
          </View>
          
          <View style={styles.activityItem}>
            <View style={[styles.activityDot, { backgroundColor: theme.primary }]} />
            <View style={styles.activityContent}>
              <Text style={[styles.activityText, { color: theme.text }]}>Dashboard data refreshed</Text>
              <Text style={[styles.activityTime, { color: theme.textSecondary }]}>5 minutes ago</Text>
            </View>
          </View>
          
          <View style={styles.activityItem}>
            <View style={[styles.activityDot, { backgroundColor: theme.warning }]} />
            <View style={styles.activityContent}>
              <Text style={[styles.activityText, { color: theme.text }]}>User management system accessed</Text>
              <Text style={[styles.activityTime, { color: theme.textSecondary }]}>12 minutes ago</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  systemStatusContainer: {
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  statusLoadingText: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  dataTimestamp: {
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    minWidth: 140,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
  },
});

export default SuperAdminDashboard;