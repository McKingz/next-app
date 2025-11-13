import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { WireframeCard, WireframeMetric } from '@/components/wireframes/NavigationShells';

interface GlobalOverviewProps {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

interface PlatformStats {
  activeTenants: number;
  monthlyRevenue: number;
  criticalIssues: number;
  aiUsageCost: number;
  totalUsers: number;
  activeSeats: number;
}

const GlobalOverview: React.FC<GlobalOverviewProps> = ({ loading, setLoading }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<PlatformStats>({
    activeTenants: 0,
    monthlyRevenue: 0,
    criticalIssues: 0,
    aiUsageCost: 0,
    totalUsers: 0,
    activeSeats: 0,
  });
  const [alerts, setAlerts] = useState<Array<{ id: string; message: string; severity: 'high' | 'medium' | 'low' }>>([]);

  const fetchPlatformStats = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch active schools (tenants)
      const { data: schools } = await assertSupabase()
        .from('preschools')
        .select('id')
        .eq('is_active', true);
      
      // Fetch active subscriptions and revenue (use plan_id and join to subscription_plans for price)
      const { data: subscriptions } = await assertSupabase()
        .from('subscriptions')
        .select('id,seats_total,plan_id,status,billing_frequency')
        .eq('status', 'active');

      // Build price map for the active plans
      const planIds = Array.from(new Set((subscriptions || []).map((s: any) => s.plan_id).filter(Boolean)));
      let priceByPlanId: Record<string, { monthly: number; annual: number | null }> = {};
      if (planIds.length > 0) {
        const { data: plans } = await assertSupabase()
          .from('subscription_plans')
          .select('id, price_monthly, price_annual')
          .in('id', planIds);
        (plans || []).forEach((p: any) => {
          priceByPlanId[p.id] = { monthly: Number(p.price_monthly || 0), annual: p.price_annual != null ? Number(p.price_annual) : null };
        });
      }
      
      // Calculate monthly revenue: annual plans are normalized to monthly by dividing by 12
      const monthlyRevenue = (subscriptions || []).reduce((sum, sub: any) => {
        const price = priceByPlanId[sub.plan_id];
        if (!price) return sum;
        if (String(sub.billing_frequency) === 'annual' && price.annual && price.annual > 0) {
          return sum + (price.annual / 12);
        }
        return sum + (price.monthly || 0);
      }, 0);
      
      // Count total active seats
      const activeSeats = (subscriptions || []).reduce((sum, sub: any) => {
        return sum + (sub.seats_total || 0);
      }, 0);
      
      // Get total users count
      const { data: users } = await assertSupabase()
        .from('users')
        .select('id')
        .limit(1000); // Limit for performance
      
      // Mock AI usage cost (in a real app, this would come from AI usage logs)
      const aiUsageCost = Math.floor(Math.random() * 15000) + 8000;
      
      // Mock critical issues (in a real app, this would come from error logs)
      const criticalIssues = Math.floor(Math.random() * 5);
      
      setStats({
        activeTenants: (schools || []).length,
        monthlyRevenue,
        criticalIssues,
        aiUsageCost,
        totalUsers: (users || []).length,
        activeSeats,
      });
      
      // Mock recent alerts
      setAlerts([
        { id: '1', message: 'High error rate in AI Gateway', severity: 'high' },
        { id: '2', message: 'New enterprise lead: Lincoln School', severity: 'medium' },
        { id: '3', message: 'Server maintenance scheduled for tonight', severity: 'low' },
      ]);
      
    } catch (error) {
      console.error('Failed to fetch platform stats:', error);
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  useEffect(() => {
    fetchPlatformStats();
  }, [fetchPlatformStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlatformStats();
    setRefreshing(false);
  }, [fetchPlatformStats]);

  const handleQuickAction = (action: string) => {
    track('edudash.superadmin.quick_action', {
      action,
      user_id: user?.id,
      platform: Platform.OS,
    });

    switch (action) {
      case 'contact_sales':
        // Navigate to CRM or external sales tool
        break;
      case 'system_status':
        router.push('/screens/super-admin-settings');
        break;
      case 'logs':
        // Navigate to logging dashboard
        break;
      case 'announcements':
        router.push('/screens/super-admin-announcements');
        break;
    }
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
      {/* Platform Overview Stats */}
      <WireframeCard title="Global Platform Overview">
        <View style={styles.statsGrid}>
          <WireframeMetric
            label="Active Tenants"
            value={stats.activeTenants}
            trend="up"
          />
          <WireframeMetric
            label="Monthly Revenue"
            value={`R${Math.round(stats.monthlyRevenue).toLocaleString('en-ZA')}`}
            trend="up"
          />
          <WireframeMetric
            label="Critical Issues"
            value={stats.criticalIssues}
            trend={stats.criticalIssues > 2 ? "up" : "neutral"}
          />
          <WireframeMetric
            label="AI Usage Cost"
            value={`$${stats.aiUsageCost.toLocaleString()}`}
            trend="up"
          />
          <WireframeMetric
            label="Total Users"
            value={stats.totalUsers}
            trend="up"
          />
          <WireframeMetric
            label="Active Seats"
            value={stats.activeSeats}
            trend="up"
          />
        </View>
      </WireframeCard>

      {/* Recent Alerts */}
      <WireframeCard title="Recent Alerts">
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <View key={alert.id} style={[styles.alertItem, { borderBottomColor: theme.divider }]}>
              <View style={[styles.alertIndicator, { backgroundColor: getAlertColor(theme, alert.severity) }]} />
              <Text style={[styles.alertText, { color: theme.text }]}>{alert.message}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No recent alerts</Text>
        )}
      </WireframeCard>

      {/* Feature Flag Status */}
      <WireframeCard title="Feature Flag Status">
        <View style={[styles.featureFlag, { borderBottomColor: theme.divider }]}>
          <Text style={[styles.featureName, { color: theme.text }]}>AI Gateway</Text>
          <View style={[styles.statusBadge, { backgroundColor: theme.success }]}>
            <Text style={[styles.statusText, { color: theme.onSuccess }]}>100%</Text>
          </View>
        </View>
        <View style={[styles.featureFlag, { borderBottomColor: theme.divider }]}>
          <Text style={[styles.featureName, { color: theme.text }]}>Principal Hub</Text>
          <View style={[styles.statusBadge, { backgroundColor: theme.warning }]}>
            <Text style={[styles.statusText, { color: theme.onWarning }]}>25%</Text>
          </View>
        </View>
        <View style={[styles.featureFlag, { borderBottomColor: theme.divider }]}>
          <Text style={[styles.featureName, { color: theme.text }]}>STEM Generator</Text>
          <View style={[styles.statusBadge, { backgroundColor: theme.error }]}>
            <Text style={[styles.statusText, { color: theme.onError }]}>5%</Text>
          </View>
        </View>
      </WireframeCard>

      {/* Quick Actions */}
      <WireframeCard 
        title="Quick Actions"
        actions={[
          { label: 'Contact Sales', onPress: () => handleQuickAction('contact_sales'), primary: true },
          { label: 'System Status', onPress: () => handleQuickAction('system_status') },
          { label: 'View Logs', onPress: () => handleQuickAction('logs') },
        ]}
      >
        <Text style={[styles.quickActionText, { color: theme.textSecondary }]}>
          Manage platform operations and monitor system health
        </Text>
      </WireframeCard>
    </ScrollView>
  );
};

const getAlertColor = (theme: ReturnType<typeof useTheme>['theme'], severity: 'high' | 'medium' | 'low') => {
  switch (severity) {
    case 'high': return theme.error;
    case 'medium': return theme.warning;
    case 'low': return theme.success;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  alertIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  featureFlag: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  featureName: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {},
  statusPartial: {},
  statusLimited: {},
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickActionText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default GlobalOverview;