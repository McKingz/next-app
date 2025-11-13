import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';
import { useTheme } from '@/contexts/ThemeContext';
import { isSuperAdmin } from '@/lib/roleUtils';
import { assertSupabase } from '@/lib/supabase';
import { DesktopLayout } from '@/components/layout/DesktopLayout';

interface DashboardStats {
  total_users: number;
  active_users: number;
  total_organizations: number;
  active_seats: number;
  monthly_revenue: number;
  ai_usage_cost: number;
  system_health: 'healthy' | 'degraded' | 'down';
  pending_issues: number;
}

interface RecentAlert {
  id: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: string;
}

interface SystemStatus {
  database: { status: string; color: string; };
  api: { status: string; color: string; };
  security: { status: string; color: string; };
}

interface FeatureFlag {
  name: string;
  percentage: number;
  color: string;
  enabled: boolean;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  badge?: number;
}

export default function SuperAdminDashboardScreen() {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);

  // Quick actions configuration
  const quickActions: QuickAction[] = [
    {
      id: 'school-onboarding',
      title: 'School Onboarding',
      description: 'Create and onboard new schools',
      icon: 'school',
      route: '/screens/super-admin/school-onboarding-wizard',
      color: '#00f5ff',
      badge: 0,
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'Manage users, roles, and permissions',
      icon: 'people',
      route: '/screens/super-admin-users',
      color: '#3b82f6',
      badge: dashboardStats?.pending_issues || 0,
    },
    {
      id: 'admin-management',
      title: 'Admin Management',
      description: 'Create and manage admin users',
      icon: 'people-circle',
      route: '/screens/super-admin-admin-management',
      color: '#6366f1',
    },
    {
      id: 'ai-quotas',
      title: 'AI Quota Management',
      description: 'Monitor and manage AI usage quotas',
      icon: 'hardware-chip',
      route: '/screens/super-admin-ai-quotas',
      color: '#10b981',
    },
    {
      id: 'content-moderation',
      title: 'Content Moderation',
      description: 'Review and moderate user content',
      icon: 'shield-checkmark',
      route: '/screens/super-admin-moderation',
      color: '#f59e0b',
    },
    {
      id: 'announcements',
      title: 'Announcements',
      description: 'Broadcast messages to all schools',
      icon: 'megaphone',
      route: '/screens/super-admin-announcements',
      color: '#ec4899',
    },
    {
      id: 'whatsapp-integration',
      title: 'WhatsApp Hub',
      description: 'Manage WhatsApp communications',
      icon: 'logo-whatsapp',
      route: '/screens/super-admin-whatsapp',
      color: '#25d366',
    },
    {
      id: 'system-monitoring',
      title: 'System Monitoring',
      description: 'View system health and performance',
      icon: 'analytics',
      route: '/screens/super-admin-system-monitoring',
      color: '#f59e0b',
    },
    {
      id: 'system-test',
      title: 'System Tests',
      description: 'Run comprehensive system validation',
      icon: 'checkmark-circle',
      route: '/screens/super-admin-system-test',
      color: '#8b5cf6',
    },
  ];

  // Fetch dashboard data with real system health
  const fetchDashboardData = useCallback(async () => {
    if (!isSuperAdmin(profile?.role)) return;

    try {
      setLoading(true);
      
      // Fetch dashboard data, system health, subscriptions, error logs, and AI costs
      const [dashboardResponse, healthResponse, logsResponse, aiCostResponse] = await Promise.all([
        assertSupabase().rpc('get_superadmin_dashboard_data'),
        assertSupabase().rpc('get_system_health_metrics'),
        assertSupabase().rpc('get_recent_error_logs', { hours_back: 24 }),
        assertSupabase().rpc('get_superadmin_ai_usage_cost', { days_back: 30 })
      ]);
      
      let systemHealthStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
      let pendingIssues = 0;
      let totalOrgs = 0;
      let activeSeats = 0;
      let monthlyRevenue = 0;
      let aiUsageCost = 0;
      
      // Process system health
      if (healthResponse.data?.success) {
        const dbStatus = healthResponse.data.data.database_status;
        const errorCount = healthResponse.data.data.recent_errors_24h || 0;
        
        if (dbStatus === 'critical' || errorCount > 10) {
          systemHealthStatus = 'down';
          pendingIssues += 3;
        } else if (dbStatus === 'degraded' || errorCount > 5) {
          systemHealthStatus = 'degraded';
          pendingIssues += 1;
        }
      }
      
      // Process AI usage cost data
      if (aiCostResponse.data?.success && aiCostResponse.data.data) {
        aiUsageCost = aiCostResponse.data.data.monthly_cost || 0;
        console.log(`AI usage cost for last 30 days: $${aiUsageCost}`);
      } else if (aiCostResponse.error) {
        console.warn('AI cost RPC error:', aiCostResponse.error);
      }
      
      // Fetch data in parallel - hybrid system for preschools AND K-12 schools
      const [preschoolsResponse, schoolsResponse, subscriptionsResponse, usersResponse] = await Promise.all([
        // Get active preschools
        assertSupabase().from('preschools').select('id').eq('is_active', true),
        // Get active K-12 schools 
        assertSupabase().from('schools').select('id').eq('is_active', true),
        // Get active subscriptions with billing info
        assertSupabase().from('subscriptions').select('id,seats_total,plan_id,status,billing_frequency').eq('status', 'active'),
        // Get total users count (with limit for performance)
        assertSupabase().from('users').select('id').limit(1000)
      ]);
      
      // Process hybrid tenant count (preschools + K-12 schools)
      const preschoolCount = (preschoolsResponse.data || []).length;
      const schoolCount = (schoolsResponse.data || []).length;
      totalOrgs = preschoolCount + schoolCount;
      
      console.log(`Dashboard tenant count: ${preschoolCount} preschools + ${schoolCount} K-12 schools = ${totalOrgs} total`);
      
      // Process subscriptions for seats and revenue (supports both preschools and K-12 schools)
      const subscriptions = subscriptionsResponse.data || [];
      if (subscriptions.length > 0) {
        // Count total active seats across all educational institutions
        activeSeats = subscriptions.reduce((sum, sub: any) => sum + (sub.seats_total || 0), 0);
        
        // Get pricing data for revenue calculation
        const planIds = Array.from(new Set(subscriptions.map((s: any) => s.plan_id).filter(Boolean)));
        if (planIds.length > 0) {
          const { data: plans } = await assertSupabase()
            .from('subscription_plans')
            .select('id, price_monthly, price_annual')
            .in('id', planIds);
            
          // Build price map like the old dashboard
          const priceByPlanId: Record<string, { monthly: number; annual: number | null }> = {};
          (plans || []).forEach((p: any) => {
            priceByPlanId[p.id] = {
              monthly: Number(p.price_monthly || 0),
              annual: p.price_annual != null ? Number(p.price_annual) : null
            };
          });
          
          // Calculate monthly revenue: annual plans normalized to monthly by dividing by 12
          // This works for both preschools and K-12 schools
          monthlyRevenue = subscriptions.reduce((sum, sub: any) => {
            const price = priceByPlanId[sub.plan_id];
            if (!price) return sum;
            if (String(sub.billing_frequency) === 'annual' && price.annual && price.annual > 0) {
              return sum + (price.annual / 12);
            }
            return sum + (price.monthly || 0);
          }, 0);
        }
      }
      
      console.log(`Dashboard subscription summary: ${subscriptions.length} active subscriptions, ${activeSeats} seats, R${Math.round(monthlyRevenue)} monthly revenue`);
      
      // Process recent alerts from error logs
      const alerts: RecentAlert[] = [];
      if (logsResponse.data?.success && logsResponse.data.data?.logs) {
        const errorLogs = logsResponse.data.data.logs.slice(0, 3);
        alerts.push(...errorLogs.map((log: any, index: number) => ({
          id: `log_${index}`,
          message: log.message || 'System error occurred',
          severity: log.level === 'error' ? 'high' : log.level === 'warning' ? 'medium' : 'low',
          timestamp: log.timestamp
        })));
      }
      
      // Add some system-generated alerts
      if (systemHealthStatus === 'down') {
        alerts.unshift({
          id: 'sys_down',
          message: 'System health degraded - immediate attention required',
          severity: 'high',
          timestamp: new Date().toISOString()
        });
      }
      
      setRecentAlerts(alerts);
      
      if (dashboardResponse.error) {
        console.error('Dashboard RPC error:', dashboardResponse.error);
      }
      
      // Use direct user count like old dashboard, with RPC as backup
      const totalUsers = (usersResponse.data || []).length;
      const stats = dashboardResponse.data?.data?.user_stats;
      
      setDashboardStats({
        total_users: totalUsers || stats?.total_users || 0,
        active_users: stats?.active_users || 0,
        total_organizations: totalOrgs,
        active_seats: activeSeats,
        monthly_revenue: monthlyRevenue,
        ai_usage_cost: aiUsageCost,
        system_health: systemHealthStatus,
        pending_issues: pendingIssues,
      });
      
      // Set system status based on health data
      const dbStatus = healthResponse.data?.data?.database_status || 'unknown';
      const dbColor = dbStatus === 'healthy' ? '#10b981' : dbStatus === 'degraded' ? '#f59e0b' : '#ef4444';
      
      setSystemStatus({
        database: {
          status: dbStatus === 'healthy' ? 'Operational' : dbStatus === 'degraded' ? 'Degraded' : 'Issues',
          color: dbColor
        },
        api: {
          status: systemHealthStatus === 'healthy' ? 'All Systems Go' : 'Some Issues',
          color: systemHealthStatus === 'healthy' ? '#10b981' : '#f59e0b'
        },
        security: {
          status: healthResponse.data?.data?.rls_enabled ? 'Protected' : 'Warning',
          color: healthResponse.data?.data?.rls_enabled ? '#10b981' : '#f59e0b'
        }
      });
      
      // Get real feature flags from database config_kv table
      const { data: configData } = await assertSupabase()
        .from('config_kv')
        .select('key, value')
        .in('key', [
          'ai_gateway_enabled',
          'principal_hub_rollout',
          'stem_generator_enabled',
          'mobile_app_rollout',
          'payment_gateway_enabled'
        ]);

      const configMap = (configData || []).reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, any>);

      const flags: FeatureFlag[] = [
        {
          name: 'AI Gateway',
          percentage: configMap.ai_gateway_enabled === true || process.env.EXPO_PUBLIC_AI_ENABLED === 'true' ? 100 : 0,
          color: configMap.ai_gateway_enabled === true || process.env.EXPO_PUBLIC_AI_ENABLED === 'true' ? '#10b981' : '#ef4444',
          enabled: configMap.ai_gateway_enabled === true || process.env.EXPO_PUBLIC_AI_ENABLED === 'true'
        },
        {
          name: 'Principal Hub',
          percentage: totalOrgs > 0 ? (configMap.principal_hub_rollout?.percentage || 85) : 0,
          color: totalOrgs > 0 ? '#f59e0b' : '#6b7280',
          enabled: totalOrgs > 0
        },
        {
          name: 'STEM Generator',
          percentage: configMap.stem_generator_enabled === true ? 100 : 50, // Gradual rollout
          color: configMap.stem_generator_enabled === true ? '#10b981' : '#f59e0b',
          enabled: configMap.stem_generator_enabled === true
        },
        {
          name: 'Payment Gateway',
          percentage: activeSeats > 0 ? 100 : 0, // Enable if we have active subscriptions
          color: activeSeats > 0 ? '#10b981' : '#6b7280',
          enabled: activeSeats > 0
        },
        {
          name: 'Mobile App',
          percentage: configMap.mobile_app_rollout?.percentage || 75,
          color: (configMap.mobile_app_rollout?.percentage || 75) > 50 ? '#10b981' : '#f59e0b',
          enabled: (configMap.mobile_app_rollout?.percentage || 75) > 0
        },
      ];
      
      setFeatureFlags(flags);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Minimal fallback
      setDashboardStats({
        total_users: 0,
        active_users: 0,
        total_organizations: 0,
        active_seats: 0,
        monthly_revenue: 0,
        ai_usage_cost: 0,
        system_health: 'degraded',
        pending_issues: 1,
      });
      setRecentAlerts([{
        id: 'error',
        message: 'Failed to load dashboard data',
        severity: 'high',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  }, [profile?.role]);

  useEffect(() => {
    fetchDashboardData();
    
    // Track dashboard opening
    if (user?.id) {
      track('edudash.superadmin.dashboard_opened', {
        user_id: user.id,
        platform: Platform.OS,
      });
    }
  }, [fetchDashboardData, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  const handleQuickAction = (action: QuickAction) => {
    track('edudash.superadmin.quick_action', {
      user_id: user?.id,
      action_id: action.id,
      route: action.route,
    });
    
    router.push(action.route as any);
  };

  const getAlertColor = (severity: 'high' | 'medium' | 'low'): string => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatAlertTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return `${Math.floor(diffMins / 1440)} day ago`;
  };

  // Show loading state while checking authentication
  if (authLoading || profileLoading) {
    return (
      <View style={styles.container}>
        <ThemedStatusBar />
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading admin profile…
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  // Access control: Check if user has super admin access
  if (!profile || !isSuperAdmin(profile.role)) {
    return (
      <View style={styles.container}>
        <ThemedStatusBar />
        <SafeAreaView style={styles.accessDeniedContainer}>
          <Ionicons name="shield-checkmark" size={64} color={theme.error} />
          <Text style={[styles.accessDeniedText, { color: theme.text }]}>
            Access Denied
          </Text>
          <Text style={[styles.accessDeniedSubtext, { color: theme.textSecondary }]}>
            Super Admin privileges required
          </Text>
          <Text style={[styles.debugText, { color: theme.textTertiary }]}>
            Current role: {profile?.role || 'undefined'}
          </Text>
          <TouchableOpacity 
            style={[styles.signOutButton, { backgroundColor: theme.error }]}
            onPress={() => router.replace('/(auth)/sign-in' as any)}
          >
            <Text style={[styles.signOutButtonText, { color: theme.onError }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <DesktopLayout role="superadmin">
      <View style={styles.container}>
        <ThemedStatusBar />
      
      {/* Header */}
      <SafeAreaView style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.titleSection}>
              <Text style={[styles.titleText, { color: theme.text }]}>Super Admin</Text>
              <Text style={[styles.subtitleText, { color: theme.textTertiary }]}>
                EduDash Pro Management
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.notificationBell}
              onPress={() => {
                track('superadmin_notifications_opened');
                Alert.alert('Notifications', 'Notification center coming soon!');
              }}
            >
              <Ionicons name="notifications-outline" size={22} color={theme.text} />
              {/* Notification badge */}
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>3</Text>
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Health indicator moved below header */}
          <View style={[styles.healthIndicator, { 
            backgroundColor: dashboardStats?.system_health === 'healthy' ? '#10b98108' : '#f59e0b08',
            borderColor: dashboardStats?.system_health === 'healthy' ? '#10b981' : '#f59e0b'
          }]}>
            <Ionicons 
              name={dashboardStats?.system_health === 'healthy' ? 'checkmark-circle' : 'warning'} 
              size={14} 
              color={dashboardStats?.system_health === 'healthy' ? '#10b981' : '#f59e0b'} 
            />
            <Text style={[styles.healthText, { 
              color: dashboardStats?.system_health === 'healthy' ? '#10b981' : '#f59e0b'
            }]}>
              {dashboardStats?.system_health === 'healthy' ? 'All Systems Operational' : 'System Issues'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Global Platform Overview */}
        {dashboardStats && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Global Platform Overview</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Serving preschools and K-12 educational institutions</Text>
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="business" size={24} color="#3b82f6" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dashboardStats.total_organizations}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active Tenants</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Preschools + K-12</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="card" size={24} color="#10b981" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  R{Math.round(dashboardStats.monthly_revenue).toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Monthly Revenue</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Subscriptions</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="alert-circle" size={24} color="#f59e0b" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dashboardStats.pending_issues}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Critical Issues</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Needs attention</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="flash" size={24} color="#8b5cf6" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  ${Math.round(dashboardStats.ai_usage_cost).toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>AI Usage Cost</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Last 30 days</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="people" size={24} color="#06b6d4" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dashboardStats.total_users}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Users</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>
                  {dashboardStats.active_users} active
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="person-add" size={24} color="#ec4899" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dashboardStats.active_seats}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active Seats</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Licensed</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Alerts */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Alerts</Text>
          <View style={[styles.alertsContainer, { backgroundColor: theme.surface }]}>
            {recentAlerts.length > 0 ? (
              recentAlerts.map((alert) => (
                <View key={alert.id} style={[styles.alertItem, { borderBottomColor: theme.divider }]}>
                  <View style={[
                    styles.alertIndicator, 
                    { backgroundColor: getAlertColor(alert.severity) }
                  ]} />
                  <View style={styles.alertContent}>
                    <Text style={[styles.alertText, { color: theme.text }]}>{alert.message}</Text>
                    <Text style={[styles.alertTime, { color: theme.textSecondary }]}>
                      {formatAlertTime(alert.timestamp)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyAlertsText, { color: theme.textSecondary }]}>No recent alerts</Text>
            )}
          </View>
        </View>

        {/* Feature Flag Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Feature Flag Status</Text>
          <View style={[styles.featureFlagsContainer, { backgroundColor: theme.surface }]}>
            {featureFlags.map((flag, index) => (
              <View 
                key={flag.name} 
                style={[styles.featureFlag, { 
                  borderBottomColor: index === featureFlags.length - 1 ? 'transparent' : theme.divider 
                }]}
              >
                <Text style={[styles.featureName, { color: theme.text }]}>{flag.name}</Text>
                <View style={[styles.featureStatusBadge, { backgroundColor: flag.color }]}>
                  <Text style={[styles.featureStatusText, { color: '#ffffff' }]}>
                    {flag.percentage}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionCard, { backgroundColor: theme.surface }]}
                onPress={() => handleQuickAction(action)}
              >
                <View style={styles.actionHeader}>
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  {action.badge !== undefined && action.badge > 0 && (
                    <View style={[styles.actionBadge, { backgroundColor: theme.error }]}>
                      <Text style={[styles.actionBadgeText, { color: theme.onError }]}>
                        {action.badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: theme.text }]}>{action.title}</Text>
                <Text style={[styles.actionDescription, { color: theme.textSecondary }]}>
                  {action.description}
                </Text>
                <View style={styles.actionFooter}>
                  <Ionicons name="arrow-forward" size={16} color={action.color} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* System Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>System Status</Text>
          <View style={[styles.statusCard, { backgroundColor: theme.surface }]}>
            {systemStatus ? (
              <>
                <View style={styles.statusItem}>
                  <Ionicons name="server" size={20} color={systemStatus.database.color} />
                  <View style={styles.statusInfo}>
                    <Text style={[styles.statusLabel, { color: theme.text }]}>Database</Text>
                    <Text style={[styles.statusValue, { color: systemStatus.database.color }]}>
                      {systemStatus.database.status}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.statusItem}>
                  <Ionicons name="cloud" size={20} color={systemStatus.api.color} />
                  <View style={styles.statusInfo}>
                    <Text style={[styles.statusLabel, { color: theme.text }]}>API Services</Text>
                    <Text style={[styles.statusValue, { color: systemStatus.api.color }]}>
                      {systemStatus.api.status}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.statusItem}>
                  <Ionicons name="shield-checkmark" size={20} color={systemStatus.security.color} />
                  <View style={styles.statusInfo}>
                    <Text style={[styles.statusLabel, { color: theme.text }]}>Security</Text>
                    <Text style={[styles.statusValue, { color: systemStatus.security.color }]}>
                      {systemStatus.security.status}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.statusItem}>
                <ActivityIndicator size="small" color={theme.primary} />
                <View style={styles.statusInfo}>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Loading system status...</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading dashboard data...
            </Text>
          </View>
        )}
      </ScrollView>
      </View>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedSubtext: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 12,
    marginBottom: 24,
    textAlign: 'center',
  },
  signOutButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerContent: {
    gap: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleSection: {
    flex: 1,
  },
  notificationBell: {
    position: 'relative',
    padding: 8,
    marginRight: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
    opacity: 0.7,
  },
  healthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    alignSelf: 'flex-start',
  },
  healthText: {
    fontSize: 11,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%', // Mobile-first: 2 cards per row
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 24,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 18,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    padding: 14,
    borderRadius: 12,
    minHeight: 130,
    marginBottom: 12,
    // Better touch targets for mobile
    minWidth: 160,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  actionFooter: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    minHeight: 52, // Better touch target
  },
  statusInfo: {
    marginLeft: 12,
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingOverlay: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  alertsContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    minHeight: 60, // Better touch target
  },
  alertIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    lineHeight: 20,
  },
  alertTime: {
    fontSize: 12,
  },
  emptyAlertsText: {
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 24,
  },
  featureFlagsContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  featureFlag: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    minHeight: 56, // Better touch target
  },
  featureName: {
    fontSize: 14,
    fontWeight: '600',
  },
  featureStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  featureStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
