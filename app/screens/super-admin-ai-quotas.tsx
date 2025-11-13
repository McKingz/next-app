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
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { isSuperAdmin } from '@/lib/roleUtils';

interface AIQuotaSettings {
  id: string;
  school_id: string;
  school_name: string;
  plan_type: 'free' | 'basic' | 'pro' | 'enterprise';
  monthly_limit: number;
  current_usage: number;
  reset_date: string;
  overage_allowed: boolean;
  overage_limit?: number;
  cost_per_overage: number;
  warnings_enabled: boolean;
  warning_thresholds: number[];
  is_suspended: boolean;
  last_updated: string;
}

interface GlobalQuotaConfig {
  free_tier_limit: number;
  basic_tier_limit: number;
  pro_tier_limit: number;
  enterprise_tier_limit: number;
  overage_rate: number;
  warning_thresholds: number[];
  suspension_threshold: number;
  auto_reset_enabled: boolean;
  cost_alerts_enabled: boolean;
}

interface UsageStatistics {
  total_tokens_used: number;
  total_cost: number;
  average_cost_per_school: number;
  schools_over_limit: number;
  schools_suspended: number;
  projected_monthly_cost: number;
  top_consuming_schools: Array<{
    school_name: string;
    usage: number;
    cost: number;
    percentage: number;
  }>;
}

export default function SuperAdminAIQuotasScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolQuotas, setSchoolQuotas] = useState<AIQuotaSettings[]>([]);
  const [globalConfig, setGlobalConfig] = useState<GlobalQuotaConfig>({
    free_tier_limit: 1000,
    basic_tier_limit: 5000,
    pro_tier_limit: 25000,
    enterprise_tier_limit: 100000,
    overage_rate: 0.002,
    warning_thresholds: [75, 90, 95],
    suspension_threshold: 120,
    auto_reset_enabled: true,
    cost_alerts_enabled: true,
  });
  const [usageStats, setUsageStats] = useState<UsageStatistics>({
    total_tokens_used: 0,
    total_cost: 0,
    average_cost_per_school: 0,
    schools_over_limit: 0,
    schools_suspended: 0,
    projected_monthly_cost: 0,
    top_consuming_schools: [],
  });
  
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<AIQuotaSettings | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [filters, setFilters] = useState({
    plan: 'all',
    status: 'all',
    search: '',
  });

  const fetchAIQuotas = useCallback(async () => {
    if (!isSuperAdmin(profile?.role)) {
      Alert.alert('Access Denied', 'Super admin privileges required');
      return;
    }

    try {
      setLoading(true);

      // Fetch real AI quota data from database
      const quotasResponse = await assertSupabase().rpc('get_superadmin_ai_quotas');
      
      if (quotasResponse.error) {
        console.error('AI quotas RPC error:', quotasResponse.error);
        throw new Error('Failed to fetch AI quota data');
      }

      if (!quotasResponse.data?.success) {
        throw new Error(quotasResponse.data?.error || 'Failed to fetch AI quota data');
      }

      const responseData = quotasResponse.data.data;
      
      // Set real school quotas from database
      const realQuotas: AIQuotaSettings[] = (responseData.school_quotas || []).map((quota: any) => ({
        id: quota.id,
        school_id: quota.school_id,
        school_name: quota.school_name,
        plan_type: quota.plan_type,
        monthly_limit: quota.monthly_limit,
        current_usage: quota.current_usage,
        reset_date: quota.reset_date,
        overage_allowed: quota.overage_allowed,
        overage_limit: quota.overage_limit,
        cost_per_overage: quota.cost_per_overage,
        warnings_enabled: quota.warnings_enabled,
        warning_thresholds: quota.warning_thresholds,
        is_suspended: quota.is_suspended,
        last_updated: quota.last_updated,
      }));

      setSchoolQuotas(realQuotas);

      // Update global config from database
      if (responseData.global_config) {
        setGlobalConfig({
          free_tier_limit: responseData.global_config.free_tier_limit,
          basic_tier_limit: responseData.global_config.basic_tier_limit,
          pro_tier_limit: responseData.global_config.pro_tier_limit,
          enterprise_tier_limit: responseData.global_config.enterprise_tier_limit,
          overage_rate: responseData.global_config.overage_rate,
          warning_thresholds: responseData.global_config.warning_thresholds,
          suspension_threshold: responseData.global_config.suspension_threshold,
          auto_reset_enabled: responseData.global_config.auto_reset_enabled,
          cost_alerts_enabled: responseData.global_config.cost_alerts_enabled,
        });
      }

      // Update usage statistics from database
      if (responseData.usage_stats) {
        setUsageStats({
          total_tokens_used: responseData.usage_stats.total_tokens_used,
          total_cost: responseData.usage_stats.total_cost,
          average_cost_per_school: responseData.usage_stats.average_cost_per_school,
          schools_over_limit: responseData.usage_stats.schools_over_limit,
          schools_suspended: responseData.usage_stats.schools_suspended,
          projected_monthly_cost: responseData.usage_stats.projected_monthly_cost,
          top_consuming_schools: responseData.usage_stats.top_consuming_schools,
        });
      }

      console.log(`AI Quotas: Loaded ${realQuotas.length} schools, ${responseData.usage_stats?.total_tokens_used || 0} tokens used`);

    } catch (error) {
      console.error('Failed to fetch AI quotas:', error);
      Alert.alert('Error', 'Failed to load AI quota settings');
    } finally {
      setLoading(false);
    }
  }, [profile?.role]);

  useEffect(() => {
    fetchAIQuotas();
  }, [fetchAIQuotas]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAIQuotas();
    setRefreshing(false);
  }, [fetchAIQuotas]);

  // Function for updating individual school quotas (used in future versions)
  const updateSchoolQuota = useCallback(async (school: AIQuotaSettings, newLimit: number, overageAllowed: boolean) => {
    try {
      setSaving(true);

      const updatedSchool: AIQuotaSettings = {
        ...school,
        monthly_limit: newLimit,
        overage_allowed: overageAllowed,
        last_updated: new Date().toISOString(),
      };

      setSchoolQuotas(prev => prev.map(s => 
        s.id === school.id ? updatedSchool : s
      ));

      // Track the quota update
      track('superadmin_ai_quota_updated', {
        school_id: school.school_id,
        school_name: school.school_name,
        old_limit: school.monthly_limit,
        new_limit: newLimit,
        overage_allowed: overageAllowed,
      });

      // Log the action
      const { error: logError } = await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'ai_quota_updated',
          target_user_id: school.school_id,
          details: {
            school_name: school.school_name,
            old_limit: school.monthly_limit,
            new_limit: newLimit,
            overage_allowed: overageAllowed,
          },
        });

      if (logError) {
        console.error('Failed to log quota update:', logError);
      }

      Alert.alert('Success', 'AI quota updated successfully');

    } catch (error) {
      console.error('Failed to update AI quota:', error);
      Alert.alert('Error', 'Failed to update AI quota');
    } finally {
      setSaving(false);
    }
  }, [profile?.id]);

  const suspendSchool = async (school: AIQuotaSettings) => {
    const action = school.is_suspended ? 'reactivate' : 'suspend';
    
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} School`,
      `Are you sure you want to ${action} AI access for ${school.school_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: action === 'suspend' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const updatedSchool: AIQuotaSettings = {
                ...school,
                is_suspended: !school.is_suspended,
                last_updated: new Date().toISOString(),
              };

              setSchoolQuotas(prev => prev.map(s => 
                s.id === school.id ? updatedSchool : s
              ));

              // Track the suspension/reactivation
              track('superadmin_ai_access_toggled', {
                school_id: school.school_id,
                school_name: school.school_name,
                action: action,
                reason: action === 'suspend' ? 'manual_admin_action' : 'admin_reactivation',
              });

              // Log the action
              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: `ai_access_${action}ed`,
                  target_user_id: school.school_id,
                  details: {
                    school_name: school.school_name,
                    reason: `Manual ${action} by super admin`,
                    current_usage: school.current_usage,
                    monthly_limit: school.monthly_limit,
                  },
                });

              if (logError) {
                console.error('Failed to log AI access toggle:', logError);
              }

              Alert.alert('Success', `AI access ${action}ed for ${school.school_name}`);

            } catch (error) {
              console.error(`Failed to ${action} AI access:`, error);
              Alert.alert('Error', `Failed to ${action} AI access`);
            }
          }
        }
      ]
    );
  };

  const resetSchoolUsage = async (school: AIQuotaSettings) => {
    Alert.alert(
      'Reset Usage',
      `Are you sure you want to reset AI usage for ${school.school_name}? This will set their current usage to 0.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              const updatedSchool: AIQuotaSettings = {
                ...school,
                current_usage: 0,
                is_suspended: false,
                last_updated: new Date().toISOString(),
              };

              setSchoolQuotas(prev => prev.map(s => 
                s.id === school.id ? updatedSchool : s
              ));

              // Track the reset
              track('superadmin_ai_usage_reset', {
                school_id: school.school_id,
                school_name: school.school_name,
                previous_usage: school.current_usage,
              });

              // Log the action
              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'ai_usage_reset',
                  target_user_id: school.school_id,
                  details: {
                    school_name: school.school_name,
                    previous_usage: school.current_usage,
                    reset_reason: 'Manual admin reset',
                  },
                });

              if (logError) {
                console.error('Failed to log usage reset:', logError);
              }

              Alert.alert('Success', 'AI usage reset successfully');

            } catch (error) {
              console.error('Failed to reset AI usage:', error);
              Alert.alert('Error', 'Failed to reset AI usage');
            }
          }
        }
      ]
    );
  };

  const updateGlobalConfig = async () => {
    try {
      setSaving(true);

      // In a real app, this would update the global configuration
      // For now, we'll just update the local state

      // Track the global config update
      track('superadmin_global_ai_config_updated', {
        free_tier_limit: globalConfig.free_tier_limit,
        basic_tier_limit: globalConfig.basic_tier_limit,
        pro_tier_limit: globalConfig.pro_tier_limit,
        enterprise_tier_limit: globalConfig.enterprise_tier_limit,
        overage_rate: globalConfig.overage_rate,
      });

      // Log the action
      const { error: logError } = await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'global_ai_config_updated',
          details: {
            config_changes: globalConfig,
          },
        });

      if (logError) {
        console.error('Failed to log global config update:', logError);
      }

      Alert.alert('Success', 'Global AI configuration updated successfully');
      setShowConfigModal(false);

    } catch (error) {
      console.error('Failed to update global config:', error);
      Alert.alert('Error', 'Failed to update global configuration');
    } finally {
      setSaving(false);
    }
  };

  const getUsagePercentage = (current: number, limit: number): number => {
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 100) return '#dc2626';
    if (percentage >= 90) return '#ea580c';
    if (percentage >= 75) return '#d97706';
    return '#059669';
  };

  const getPlanColor = (plan: string): string => {
    switch (plan) {
      case 'enterprise':
        return '#7c3aed';
      case 'pro':
        return '#059669';
      case 'basic':
        return '#0ea5e9';
      case 'free':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  const filteredSchools = schoolQuotas.filter(school => {
    if (filters.plan !== 'all' && school.plan_type !== filters.plan) return false;
    if (filters.status !== 'all') {
      if (filters.status === 'over_limit' && school.current_usage <= school.monthly_limit) return false;
      if (filters.status === 'suspended' && !school.is_suspended) return false;
      if (filters.status === 'normal' && (school.current_usage > school.monthly_limit || school.is_suspended)) return false;
    }
    if (filters.search && !school.school_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  if (!profile || (!isSuperAdmin(profile.role))) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'AI Quota Management', headerShown: false }} />
        <StatusBar style="light" />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'AI Quota Management', headerShown: false }} />
      <StatusBar style="light" />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/screens/super-admin-dashboard');
              }
            }} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>AI Quota Management</Text>
          <TouchableOpacity 
            onPress={() => setShowConfigModal(true)} 
            style={styles.configButton}
          >
            <Ionicons name="settings" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatNumber(usageStats.total_tokens_used)}</Text>
            <Text style={styles.statLabel}>Total Tokens Used</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(usageStats.total_cost)}</Text>
            <Text style={styles.statLabel}>Total Overage Cost</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{usageStats.schools_over_limit}</Text>
            <Text style={styles.statLabel}>Schools Over Limit</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{usageStats.schools_suspended}</Text>
            <Text style={styles.statLabel}>Suspended Schools</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search schools..."
                placeholderTextColor={theme.textTertiary}
          value={filters.search}
          onChangeText={(text) => setFilters(prev => ({ ...prev, search: text }))}
        />
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
          {(['all', 'free', 'basic', 'pro', 'enterprise'] as const).map((plan) => (
            <TouchableOpacity
              key={plan}
              style={[styles.filterTab, filters.plan === plan && styles.filterTabActive]}
              onPress={() => setFilters(prev => ({ ...prev, plan }))}
            >
              <Text style={[styles.filterTabText, filters.plan === plan && styles.filterTabTextActive]}>
                {plan === 'all' ? 'All Plans' : plan.charAt(0).toUpperCase() + plan.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
          {(['all', 'normal', 'over_limit', 'suspended'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterTab, filters.status === status && styles.filterTabActive]}
              onPress={() => setFilters(prev => ({ ...prev, status }))}
            >
              <Text style={[styles.filterTabText, filters.status === status && styles.filterTabTextActive]}>
                {status === 'all' ? 'All Status' : 
                 status === 'over_limit' ? 'Over Limit' :
                 status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading AI quotas...</Text>
          </View>
        ) : (
          <>
            {filteredSchools.map((school) => {
              const usagePercentage = getUsagePercentage(school.current_usage, school.monthly_limit);
              const isOverLimit = school.current_usage > school.monthly_limit;
              
              return (
                <TouchableOpacity
                  key={school.id}
                  style={[
                    styles.schoolCard,
                    school.is_suspended && styles.schoolCardSuspended,
                    isOverLimit && styles.schoolCardOverLimit
                  ]}
                  onPress={() => {
                    setSelectedSchool(school);
                    setShowSchoolModal(true);
                  }}
                >
                  <View style={styles.schoolHeader}>
                    <View style={styles.schoolInfo}>
                      <Text style={styles.schoolName}>{school.school_name}</Text>
                      <View style={styles.schoolMeta}>
                        <View style={[styles.planBadge, { backgroundColor: getPlanColor(school.plan_type) + '20', borderColor: getPlanColor(school.plan_type) }]}>
                          <Text style={[styles.planBadgeText, { color: getPlanColor(school.plan_type) }]}>
                            {school.plan_type.toUpperCase()}
                          </Text>
                        </View>
                        {school.is_suspended && (
                          <View style={styles.suspendedBadge}>
                            <Text style={styles.suspendedBadgeText}>SUSPENDED</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    
                    <View style={styles.usageInfo}>
                      <Text style={[styles.usageText, { color: getUsageColor(usagePercentage) }]}>
                        {formatNumber(school.current_usage)} / {formatNumber(school.monthly_limit)}
                      </Text>
                      <Text style={styles.usagePercentage}>
                        {usagePercentage.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill,
                          { 
                            width: `${Math.min(usagePercentage, 100)}%`,
                            backgroundColor: getUsageColor(usagePercentage)
                          }
                        ]} 
                      />
                      {isOverLimit && (
                        <View 
                          style={[
                            styles.overageFill,
                            { 
                              width: `${Math.min(((school.current_usage - school.monthly_limit) / school.monthly_limit) * 100, 100)}%`
                            }
                          ]} 
                        />
                      )}
                    </View>
                  </View>

                  <View style={styles.schoolFooter}>
                    <Text style={styles.resetDate}>
                      Resets: {new Date(school.reset_date).toLocaleDateString()}
                    </Text>
                    {isOverLimit && school.overage_allowed && (
                      <Text style={styles.overageCost}>
                        Overage: {formatCurrency((school.current_usage - school.monthly_limit) * school.cost_per_overage)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {filteredSchools.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="bar-chart-outline" size={48} color={theme.textTertiary} />
                <Text style={styles.emptyText}>No schools found</Text>
                <Text style={styles.emptySubText}>Try adjusting your search or filters</Text>
              </View>
            )}

            {/* Top Consuming Schools */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Consuming Schools</Text>
              {usageStats.top_consuming_schools.map((school, index) => (
                <View key={index} style={styles.topSchoolItem}>
                  <View style={styles.topSchoolInfo}>
                    <Text style={styles.topSchoolRank}>#{index + 1}</Text>
                    <Text style={styles.topSchoolName}>{school.school_name}</Text>
                  </View>
                  <View style={styles.topSchoolStats}>
                    <Text style={styles.topSchoolUsage}>{formatNumber(school.usage)} tokens</Text>
                    <Text style={styles.topSchoolPercentage}>{school.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Global Config Modal */}
      <Modal
        visible={showConfigModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowConfigModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowConfigModal(false)}>
              <Ionicons name="close" size={24} color={theme.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Global AI Configuration</Text>
            <TouchableOpacity 
              onPress={updateGlobalConfig}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.configSection}>
              <Text style={styles.configSectionTitle}>Plan Limits (tokens/month)</Text>
              
              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Free Tier</Text>
                <TextInput
                  style={styles.configInput}
                  value={globalConfig.free_tier_limit.toString()}
                  onChangeText={(text) => setGlobalConfig(prev => ({ 
                    ...prev, 
                    free_tier_limit: parseInt(text) || 0 
                  }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Basic Tier</Text>
                <TextInput
                  style={styles.configInput}
                  value={globalConfig.basic_tier_limit.toString()}
                  onChangeText={(text) => setGlobalConfig(prev => ({ 
                    ...prev, 
                    basic_tier_limit: parseInt(text) || 0 
                  }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Pro Tier</Text>
                <TextInput
                  style={styles.configInput}
                  value={globalConfig.pro_tier_limit.toString()}
                  onChangeText={(text) => setGlobalConfig(prev => ({ 
                    ...prev, 
                    pro_tier_limit: parseInt(text) || 0 
                  }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Enterprise Tier</Text>
                <TextInput
                  style={styles.configInput}
                  value={globalConfig.enterprise_tier_limit.toString()}
                  onChangeText={(text) => setGlobalConfig(prev => ({ 
                    ...prev, 
                    enterprise_tier_limit: parseInt(text) || 0 
                  }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.configSection}>
              <Text style={styles.configSectionTitle}>Overage Settings</Text>
              
              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Cost per Token ($)</Text>
                <TextInput
                  style={styles.configInput}
                  value={globalConfig.overage_rate.toString()}
                  onChangeText={(text) => setGlobalConfig(prev => ({ 
                    ...prev, 
                    overage_rate: parseFloat(text) || 0 
                  }))}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Suspension Threshold (%)</Text>
                <TextInput
                  style={styles.configInput}
                  value={globalConfig.suspension_threshold.toString()}
                  onChangeText={(text) => setGlobalConfig(prev => ({ 
                    ...prev, 
                    suspension_threshold: parseInt(text) || 0 
                  }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.configSection}>
              <Text style={styles.configSectionTitle}>System Settings</Text>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Auto-reset monthly</Text>
                <Switch
                  value={globalConfig.auto_reset_enabled}
                  onValueChange={(value) => setGlobalConfig(prev => ({ 
                    ...prev, 
                    auto_reset_enabled: value 
                  }))}
                  trackColor={{ false: '#374151', true: '#00f5ff40' }}
                  thumbColor={globalConfig.auto_reset_enabled ? '#00f5ff' : '#9ca3af'}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Cost alerts enabled</Text>
                <Switch
                  value={globalConfig.cost_alerts_enabled}
                  onValueChange={(value) => setGlobalConfig(prev => ({ 
                    ...prev, 
                    cost_alerts_enabled: value 
                  }))}
                  trackColor={{ false: '#374151', true: '#00f5ff40' }}
                  thumbColor={globalConfig.cost_alerts_enabled ? '#00f5ff' : '#9ca3af'}
                />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* School Detail Modal */}
      <Modal
        visible={showSchoolModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowSchoolModal(false);
          setSelectedSchool(null);
        }}
      >
        {selectedSchool && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                setShowSchoolModal(false);
                setSelectedSchool(null);
              }}>
                <Ionicons name="close" size={24} color="#00f5ff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedSchool.school_name}</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.schoolDetailSection}>
                <Text style={styles.modalSectionTitle}>Usage Overview</Text>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Current Usage</Text>
                  <Text style={styles.detailValue}>
                    {formatNumber(selectedSchool.current_usage)} tokens
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Monthly Limit</Text>
                  <Text style={styles.detailValue}>
                    {formatNumber(selectedSchool.monthly_limit)} tokens
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Usage Percentage</Text>
                  <Text style={[
                    styles.detailValue, 
                    { color: getUsageColor(getUsagePercentage(selectedSchool.current_usage, selectedSchool.monthly_limit)) }
                  ]}>
                    {getUsagePercentage(selectedSchool.current_usage, selectedSchool.monthly_limit).toFixed(1)}%
                  </Text>
                </View>

                {selectedSchool.current_usage > selectedSchool.monthly_limit && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Overage Cost</Text>
                    <Text style={[styles.detailValue, { color: '#ef4444' }]}>
                      {formatCurrency((selectedSchool.current_usage - selectedSchool.monthly_limit) * selectedSchool.cost_per_overage)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.schoolDetailSection}>
                <Text style={styles.modalSectionTitle}>Settings</Text>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Plan Type</Text>
                  <View style={[styles.planBadge, { backgroundColor: getPlanColor(selectedSchool.plan_type) + '20', borderColor: getPlanColor(selectedSchool.plan_type) }]}>
                    <Text style={[styles.planBadgeText, { color: getPlanColor(selectedSchool.plan_type) }]}>
                      {selectedSchool.plan_type.toUpperCase()}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Overage Allowed</Text>
                  <Text style={styles.detailValue}>
                    {selectedSchool.overage_allowed ? 'Yes' : 'No'}
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Reset Date</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedSchool.reset_date).toLocaleDateString()}
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={[
                    styles.detailValue, 
                    { color: selectedSchool.is_suspended ? '#ef4444' : '#10b981' }
                  ]}>
                    {selectedSchool.is_suspended ? 'Suspended' : 'Active'}
                  </Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => resetSchoolUsage(selectedSchool)}
                >
                  <Ionicons name="refresh" size={20} color="#00f5ff" />
                  <Text style={styles.modalActionText}>Reset Usage</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalActionButton,
                    selectedSchool.is_suspended ? styles.reactivateButton : styles.suspendButton
                  ]}
                  onPress={() => suspendSchool(selectedSchool)}
                >
                  <Ionicons 
                    name={selectedSchool.is_suspended ? "play" : "pause"} 
                    size={20} 
                    color={selectedSchool.is_suspended ? "#10b981" : "#ef4444"} 
                  />
                  <Text style={[
                    styles.modalActionText, 
                    { color: selectedSchool.is_suspended ? "#10b981" : "#ef4444" }
                  ]}>
                    {selectedSchool.is_suspended ? 'Reactivate' : 'Suspend'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  deniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b1220',
  },
  deniedText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#0b1220',
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  configButton: {
    padding: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  statValue: {
    color: '#00f5ff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 10,
    textAlign: 'center',
  },
  filtersContainer: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  searchInput: {
    backgroundColor: '#374151',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  filterTabs: {
    marginBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#374151',
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#00f5ff',
  },
  filterTabText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#0b1220',
  },
  content: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
  },
  schoolCard: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  schoolCardSuspended: {
    borderColor: '#ef4444',
    backgroundColor: '#7f1d1d10',
  },
  schoolCardOverLimit: {
    borderColor: '#f59e0b',
    backgroundColor: '#92400e10',
  },
  schoolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  schoolMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  suspendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#ef444420',
  },
  suspendedBadgeText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '600',
  },
  usageInfo: {
    alignItems: 'flex-end',
  },
  usageText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  usagePercentage: {
    color: '#9ca3af',
    fontSize: 12,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  overageFill: {
    height: '100%',
    backgroundColor: '#dc2626',
    position: 'absolute',
    left: '100%',
    top: 0,
  },
  schoolFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resetDate: {
    color: '#9ca3af',
    fontSize: 12,
  },
  overageCost: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  topSchoolItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  topSchoolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  topSchoolRank: {
    color: '#00f5ff',
    fontSize: 14,
    fontWeight: '600',
    width: 24,
  },
  topSchoolName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  topSchoolStats: {
    alignItems: 'flex-end',
  },
  topSchoolUsage: {
    color: '#9ca3af',
    fontSize: 12,
  },
  topSchoolPercentage: {
    color: '#9ca3af',
    fontSize: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#00f5ff',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    width: 24,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#111827',
  },
  configSection: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  configSectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  configItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  configLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  configInput: {
    backgroundColor: '#374151',
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    fontSize: 14,
    minWidth: 80,
    textAlign: 'right',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  schoolDetailSection: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  modalSectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  detailValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  reactivateButton: {
    borderColor: '#10b981',
  },
  suspendButton: {
    borderColor: '#ef4444',
  },
  modalActionText: {
    color: '#00f5ff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});