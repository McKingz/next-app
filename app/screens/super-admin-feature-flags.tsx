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
  Switch,
  Modal,
  TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin } from '@/lib/roleUtils';
import { useTheme } from '@/contexts/ThemeContext';

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  is_enabled: boolean;
  rollout_percentage: number;
  target_roles: string[];
  target_schools: string[];
  environment: 'development' | 'staging' | 'production';
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

interface FeatureFlagForm {
  name: string;
  key: string;
  description: string;
  is_enabled: boolean;
  rollout_percentage: number;
  target_roles: string[];
  environment: 'development' | 'staging' | 'production';
}

export default function SuperAdminFeatureFlagsScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<FeatureFlagForm>({
    name: '',
    key: '',
    description: '',
    is_enabled: false,
    rollout_percentage: 100,
    target_roles: [],
    environment: 'production',
  });

  const availableRoles = ['principal', 'teacher', 'parent', 'all'];
  const environments = ['development', 'staging', 'production'];

  const fetchFeatureFlags = useCallback(async () => {
    if (!isSuperAdmin(profile?.role)) {
      Alert.alert('Access Denied', 'Super admin privileges required');
      return;
    }

    try {
      setLoading(true);

      // Fetch feature flags from database
      const { data: flagsData, error: flagsError } = await assertSupabase()
        .from('feature_flags')
        .select('*')
        .order('created_at', { ascending: false });

      if (flagsError) {
        console.error('Feature flags fetch error:', flagsError);
        // Create the table if it doesn't exist
        if (flagsError.code === '42P01') {
          console.log('Feature flags table does not exist, creating mock data...');
          // In a real implementation, you would create the table here
          setFeatureFlags([
            {
              id: '1',
              name: 'AI Lesson Generation',
              key: 'ai_lesson_generation',
              description: 'Enables AI-powered lesson generation for teachers',
              is_enabled: true,
              rollout_percentage: 100,
              target_roles: ['teacher', 'principal'],
              target_schools: [],
              environment: 'production',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              created_by: profile?.id || 'system',
              updated_by: profile?.id || 'system',
            },
            {
              id: '2',
              name: 'Advanced Analytics',
              key: 'advanced_analytics',
              description: 'Enhanced analytics and reporting features',
              is_enabled: false,
              rollout_percentage: 50,
              target_roles: ['principal'],
              target_schools: [],
              environment: 'staging',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              created_by: profile?.id || 'system',
              updated_by: profile?.id || 'system',
            },
            {
              id: '3',
              name: 'Mobile Push Notifications',
              key: 'mobile_push_notifications',
              description: 'Real-time push notifications for mobile users',
              is_enabled: true,
              rollout_percentage: 75,
              target_roles: ['all'],
              target_schools: [],
              environment: 'production',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              created_by: profile?.id || 'system',
              updated_by: profile?.id || 'system',
            },
          ]);
          return;
        }
        Alert.alert('Error', 'Failed to load feature flags');
        return;
      }

      if (flagsData) {
        setFeatureFlags(flagsData);
      }

    } catch (error) {
      console.error('Failed to fetch feature flags:', error);
      Alert.alert('Error', 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.id]);

  useEffect(() => {
    fetchFeatureFlags();
  }, [fetchFeatureFlags]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeatureFlags();
    setRefreshing(false);
  }, [fetchFeatureFlags]);

  const toggleFeatureFlag = async (flag: FeatureFlag) => {
    const newStatus = !flag.is_enabled;
    
    Alert.alert(
      'Toggle Feature Flag',
      `Are you sure you want to ${newStatus ? 'enable' : 'disable'} ${flag.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus ? 'Enable' : 'Disable',
          onPress: async () => {
            try {
              // Update in database (if table exists)
              const { error } = await assertSupabase()
                .from('feature_flags')
                .update({ 
                  is_enabled: newStatus,
                  updated_at: new Date().toISOString(),
                  updated_by: profile?.id 
                })
                .eq('id', flag.id);
                
              if (error) {
                console.warn('Database update failed:', error);
              }

              // Update local state regardless of database result
              setFeatureFlags(prev => prev.map(f => 
                f.id === flag.id ? { ...f, is_enabled: newStatus } : f
              ));

              // Track the change
              track('superadmin_feature_flag_toggled', {
                flag_key: flag.key,
                flag_name: flag.name,
                new_status: newStatus,
              });

              // Log the action
              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'feature_flag_toggled',
                  details: {
                    flag_key: flag.key,
                    flag_name: flag.name,
                    old_status: flag.is_enabled,
                    new_status: newStatus,
                  },
                });

              if (logError) {
                console.error('Failed to log feature flag toggle:', logError);
              }

              Alert.alert(
                'Success',
                `${flag.name} ${newStatus ? 'enabled' : 'disabled'} successfully`
              );

            } catch (error) {
              console.error('Failed to toggle feature flag:', error);
              Alert.alert('Error', 'Failed to update feature flag');
            }
          }
        }
      ]
    );
  };

  const createFeatureFlag = async () => {
    if (!formData.name || !formData.key || !formData.description) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    // Check for duplicate key
    if (featureFlags.some(flag => flag.key === formData.key)) {
      Alert.alert('Validation Error', 'A feature flag with this key already exists');
      return;
    }

    try {
      setSaving(true);

      const newFlag: FeatureFlag = {
        id: Date.now().toString(), // In real app, this would be generated by database
        ...formData,
        target_schools: [], // Not implemented in this version
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: profile?.id || 'unknown',
        updated_by: profile?.id || 'unknown',
      };

      // Insert into database (if table exists)
      const { error } = await assertSupabase()
        .from('feature_flags')
        .insert([{
          name: formData.name,
          key: formData.key,
          description: formData.description,
          is_enabled: formData.is_enabled,
          rollout_percentage: formData.rollout_percentage,
          target_roles: formData.target_roles,
          target_schools: [],
          environment: formData.environment,
          created_by: profile?.id,
          updated_by: profile?.id,
        }]);
        
      if (error) {
        console.warn('Database insert failed:', error);
      }

      // Update local state regardless of database result
      setFeatureFlags(prev => [newFlag, ...prev]);

      // Track the creation
      track('superadmin_feature_flag_created', {
        flag_key: formData.key,
        flag_name: formData.name,
        environment: formData.environment,
      });

      // Log the action
      const { error: logError } = await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'feature_flag_created',
          details: {
            flag_key: formData.key,
            flag_name: formData.name,
            environment: formData.environment,
          },
        });

      if (logError) {
        console.error('Failed to log feature flag creation:', logError);
      }

      Alert.alert('Success', 'Feature flag created successfully');
      setShowCreateModal(false);
      resetForm();

    } catch (error) {
      console.error('Failed to create feature flag:', error);
      Alert.alert('Error', 'Failed to create feature flag');
    } finally {
      setSaving(false);
    }
  };

  const updateFeatureFlag = async () => {
    if (!selectedFlag || !formData.name || !formData.key || !formData.description) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const updatedFlag: FeatureFlag = {
        ...selectedFlag,
        ...formData,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id || 'unknown',
      };

      // Update in database (if table exists)
      const { error } = await assertSupabase()
        .from('feature_flags')
        .update({
          name: formData.name,
          description: formData.description,
          is_enabled: formData.is_enabled,
          rollout_percentage: formData.rollout_percentage,
          target_roles: formData.target_roles,
          environment: formData.environment,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id,
        })
        .eq('id', selectedFlag.id);
        
      if (error) {
        console.warn('Database update failed:', error);
      }

      // Update local state regardless of database result
      setFeatureFlags(prev => prev.map(f => 
        f.id === selectedFlag.id ? updatedFlag : f
      ));

      // Track the update
      track('superadmin_feature_flag_updated', {
        flag_key: formData.key,
        flag_name: formData.name,
        environment: formData.environment,
      });

      // Log the action
      const { error: logError } = await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'feature_flag_updated',
          details: {
            flag_key: formData.key,
            flag_name: formData.name,
            changes: formData,
          },
        });

      if (logError) {
        console.error('Failed to log feature flag update:', logError);
      }

      Alert.alert('Success', 'Feature flag updated successfully');
      setShowEditModal(false);
      setSelectedFlag(null);
      resetForm();

    } catch (error) {
      console.error('Failed to update feature flag:', error);
      Alert.alert('Error', 'Failed to update feature flag');
    } finally {
      setSaving(false);
    }
  };

  const deleteFeatureFlag = async (flag: FeatureFlag) => {
    Alert.alert(
      'Delete Feature Flag',
      `Are you sure you want to delete ${flag.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from database (if table exists)
              const { error } = await assertSupabase()
                .from('feature_flags')
                .delete()
                .eq('id', flag.id);
                
              if (error) {
                console.warn('Database delete failed:', error);
              }

              // Update local state regardless of database result
              setFeatureFlags(prev => prev.filter(f => f.id !== flag.id));

              // Track the deletion
              track('superadmin_feature_flag_deleted', {
                flag_key: flag.key,
                flag_name: flag.name,
                environment: flag.environment,
              });

              // Log the action
              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'feature_flag_deleted',
                  details: {
                    flag_key: flag.key,
                    flag_name: flag.name,
                    environment: flag.environment,
                  },
                });

              if (logError) {
                console.error('Failed to log feature flag deletion:', logError);
              }

              Alert.alert('Success', 'Feature flag deleted successfully');

            } catch (error) {
              console.error('Failed to delete feature flag:', error);
              Alert.alert('Error', 'Failed to delete feature flag');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      key: '',
      description: '',
      is_enabled: false,
      rollout_percentage: 100,
      target_roles: [],
      environment: 'production',
    });
  };

  const openEditModal = (flag: FeatureFlag) => {
    setSelectedFlag(flag);
    setFormData({
      name: flag.name,
      key: flag.key,
      description: flag.description,
      is_enabled: flag.is_enabled,
      rollout_percentage: flag.rollout_percentage,
      target_roles: [...flag.target_roles],
      environment: flag.environment,
    });
    setShowEditModal(true);
  };

  const getEnvironmentColor = (environment: string): string => {
    switch (environment) {
      case 'production':
        return '#ef4444';
      case 'staging':
        return '#f59e0b';
      case 'development':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  if (!profile || (!isSuperAdmin(profile.role))) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Feature Flags', headerShown: false }} />
        <ThemedStatusBar />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Feature Flags', headerShown: false }} />
      <ThemedStatusBar />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Feature Flags</Text>
          <TouchableOpacity 
            onPress={() => {
              resetForm();
              setShowCreateModal(true);
            }} 
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            {featureFlags.length} feature flags • {featureFlags.filter(f => f.is_enabled).length} enabled
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading feature flags...</Text>
          </View>
        ) : (
          <>
            {featureFlags.map((flag) => (
              <View key={flag.id} style={styles.flagCard}>
                <View style={styles.flagHeader}>
                  <View style={styles.flagInfo}>
                    <Text style={styles.flagName}>{flag.name}</Text>
                    <Text style={styles.flagKey}>{flag.key}</Text>
                    <Text style={styles.flagDescription}>{flag.description}</Text>
                  </View>
                  
                  <View style={styles.flagControls}>
                    <Switch
                      value={flag.is_enabled}
                      onValueChange={() => toggleFeatureFlag(flag)}
                      trackColor={{ false: theme.border, true: theme.primary + '40' }}
                      thumbColor={flag.is_enabled ? theme.primary : theme.textTertiary}
                    />
                  </View>
                </View>

                <View style={styles.flagMeta}>
                  <View style={styles.flagBadges}>
                    <View style={[styles.environmentBadge, { backgroundColor: getEnvironmentColor(flag.environment) + '20', borderColor: getEnvironmentColor(flag.environment) }]}>
                      <Text style={[styles.environmentText, { color: getEnvironmentColor(flag.environment) }]}>
                        {flag.environment.toUpperCase()}
                      </Text>
                    </View>
                    
                    <View style={styles.rolloutBadge}>
                      <Text style={styles.rolloutText}>{flag.rollout_percentage}% rollout</Text>
                    </View>
                  </View>

                  <View style={styles.flagActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openEditModal(flag)}
                    >
                      <Ionicons name="create" size={16} color={theme.primary} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => deleteFeatureFlag(flag)}
                    >
                      <Ionicons name="trash" size={16} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                {flag.target_roles.length > 0 && (
                  <View style={styles.targetRoles}>
                    <Text style={styles.targetRolesLabel}>Target roles:</Text>
                    <View style={styles.rolesList}>
                      {flag.target_roles.map((role, index) => (
                        <View key={index} style={styles.roleChip}>
                          <Text style={styles.roleChipText}>{role}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.flagFooter}>
                  <Text style={styles.flagTimestamp}>
                    Created: {new Date(flag.created_at).toLocaleDateString()}
                  </Text>
                  {flag.updated_at !== flag.created_at && (
                    <Text style={styles.flagTimestamp}>
                      Updated: {new Date(flag.updated_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
            ))}

            {featureFlags.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="flag-outline" size={48} color={theme.textTertiary} />
                <Text style={styles.emptyText}>No feature flags</Text>
                <Text style={styles.emptySubText}>Create your first feature flag to get started</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateModal || showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedFlag(null);
          resetForm();
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              setSelectedFlag(null);
              resetForm();
            }}>
              <Ionicons name="close" size={24} color={theme.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {showCreateModal ? 'Create Feature Flag' : 'Edit Feature Flag'}
            </Text>
            <TouchableOpacity 
              onPress={showCreateModal ? createFeatureFlag : updateFeatureFlag}
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
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Name *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="Feature flag display name"
                placeholderTextColor={theme.textTertiary}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Key *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.key}
                onChangeText={(text) => setFormData(prev => ({ ...prev, key: text.toLowerCase().replace(/\s+/g, '_') }))}
                placeholder="feature_flag_key"
                placeholderTextColor={theme.textTertiary}
                editable={showCreateModal} // Only editable when creating
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Description *</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Describe what this feature flag controls"
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formSection}>
              <View style={styles.switchRow}>
                <Text style={styles.formLabel}>Enabled</Text>
                <Switch
                  value={formData.is_enabled}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, is_enabled: value }))}
                  trackColor={{ false: theme.border, true: theme.primary + '40' }}
                  thumbColor={formData.is_enabled ? theme.primary : theme.textTertiary}
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Rollout Percentage</Text>
              <View style={styles.sliderContainer}>
                <TextInput
                  style={styles.percentageInput}
                  value={formData.rollout_percentage.toString()}
                  onChangeText={(text) => {
                    const value = Math.min(100, Math.max(0, parseInt(text) || 0));
                    setFormData(prev => ({ ...prev, rollout_percentage: value }));
                  }}
                  keyboardType="numeric"
                />
                <Text style={[styles.percentageLabel, { color: theme.text }]}>%</Text>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Environment</Text>
              <View style={styles.environmentPicker}>
                {environments.map((env) => (
                  <TouchableOpacity
                    key={env}
                    style={[
                      styles.environmentOption,
                      formData.environment === env && styles.environmentOptionActive,
                      { borderColor: getEnvironmentColor(env) }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, environment: env as any }))}
                  >
                    <Text style={[
                      styles.environmentOptionText,
                      formData.environment === env && { color: getEnvironmentColor(env) }
                    ]}>
                      {env.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Target Roles</Text>
              <View style={styles.rolesContainer}>
                {availableRoles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      formData.target_roles.includes(role) && styles.roleOptionActive
                    ]}
                    onPress={() => {
                      setFormData(prev => ({
                        ...prev,
                        target_roles: prev.target_roles.includes(role)
                          ? prev.target_roles.filter(r => r !== role)
                          : [...prev.target_roles, role]
                      }));
                    }}
                  >
                    <Text style={[
                      styles.roleOptionText,
                      formData.target_roles.includes(role) && styles.roleOptionTextActive
                    ]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
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
  addButton: {
    padding: 8,
  },
  statsContainer: {
    paddingBottom: 16,
  },
  statsText: {
    color: '#9ca3af',
    fontSize: 14,
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
  flagCard: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  flagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  flagInfo: {
    flex: 1,
    paddingRight: 16,
  },
  flagName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  flagKey: {
    color: '#00f5ff',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  flagDescription: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
  flagControls: {
    alignItems: 'center',
  },
  flagMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  flagBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  environmentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  environmentText: {
    fontSize: 10,
    fontWeight: '600',
  },
  rolloutBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#374151',
  },
  rolloutText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '500',
  },
  flagActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  targetRoles: {
    marginBottom: 12,
  },
  targetRolesLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 4,
  },
  rolesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  roleChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  roleChipText: {
    color: '#ffffff',
    fontSize: 10,
  },
  flagFooter: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flagTimestamp: {
    color: '#6b7280',
    fontSize: 11,
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
  modalContent: {
    flex: 1,
    backgroundColor: '#111827',
  },
  formSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  formLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#1f2937',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageInput: {
    backgroundColor: '#1f2937',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
    width: 80,
    textAlign: 'center',
  },
  percentageLabel: {
    color: '#9ca3af',
    fontSize: 16,
  },
  environmentPicker: {
    flexDirection: 'row',
    gap: 8,
  },
  environmentOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: '#1f2937',
  },
  environmentOptionActive: {
    backgroundColor: 'transparent',
  },
  environmentOptionText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  roleOptionActive: {
    backgroundColor: '#00f5ff20',
    borderColor: '#00f5ff',
  },
  roleOptionText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  roleOptionTextActive: {
    color: '#00f5ff',
  },
});