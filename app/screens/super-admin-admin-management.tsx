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
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin } from '@/lib/roleUtils';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'content_moderator' | 'support_admin' | 'billing_admin' | 'system_admin';
  department: string;
  permissions: string[];
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  created_by: string;
  schools_assigned?: string[];
  avatar_url?: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  color: string;
}

const ADMIN_ROLES = [
  {
    value: 'admin',
    label: 'General Admin',
    description: 'Full administrative access across all areas',
    color: '#3b82f6',
    permissions: ['user_management', 'content_moderation', 'billing', 'system_config', 'analytics']
  },
  {
    value: 'content_moderator',
    label: 'Content Moderator',
    description: 'Moderate user content and communications',
    color: '#f59e0b',
    permissions: ['content_moderation', 'user_communication']
  },
  {
    value: 'support_admin',
    label: 'Support Admin',
    description: 'Handle user support and troubleshooting',
    color: '#10b981',
    permissions: ['user_support', 'system_diagnostics', 'user_management']
  },
  {
    value: 'billing_admin',
    label: 'Billing Admin',
    description: 'Manage subscriptions and billing',
    color: '#ec4899',
    permissions: ['billing', 'subscriptions', 'payments', 'analytics']
  },
  {
    value: 'system_admin',
    label: 'System Admin',
    description: 'Technical system administration',
    color: '#8b5cf6',
    permissions: ['system_config', 'database_access', 'analytics', 'system_diagnostics']
  }
];

const DEPARTMENTS = [
  {
    id: 'customer_success',
    name: 'Customer Success',
    description: 'User support and satisfaction',
    permissions: ['user_support', 'user_communication', 'analytics'],
    color: '#10b981'
  },
  {
    id: 'product',
    name: 'Product Team',
    description: 'Product development and features',
    permissions: ['system_config', 'analytics', 'content_moderation'],
    color: '#3b82f6'
  },
  {
    id: 'operations',
    name: 'Operations',
    description: 'Business operations and billing',
    permissions: ['billing', 'subscriptions', 'analytics', 'user_management'],
    color: '#ec4899'
  },
  {
    id: 'engineering',
    name: 'Engineering',
    description: 'Technical systems and infrastructure',
    permissions: ['system_config', 'database_access', 'system_diagnostics'],
    color: '#8b5cf6'
  },
  {
    id: 'content',
    name: 'Content Team',
    description: 'Content moderation and curation',
    permissions: ['content_moderation', 'user_communication'],
    color: '#f59e0b'
  }
];

export default function SuperAdminAdminManagementScreen() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Form state for creating/editing admin users
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'admin' as AdminUser['role'],
    department: 'customer_success',
    is_active: true,
    schools_assigned: [] as string[],
  });

  const fetchAdminUsers = useCallback(async () => {
    if (!isSuperAdmin(profile?.role)) {
      Alert.alert('Access Denied', 'Super admin privileges required');
      return;
    }

    try {
      setLoading(true);
      
      // Mock admin users data - replace with real Supabase query
      const mockAdminUsers: AdminUser[] = [
        {
          id: '1',
          email: 'sarah.johnson@edudashpro.com',
          full_name: 'Sarah Johnson',
          role: 'admin',
          department: 'operations',
          permissions: ['user_management', 'billing', 'analytics'],
          is_active: true,
          last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: profile?.id || '',
          schools_assigned: ['school_1', 'school_2'],
        },
        {
          id: '2',
          email: 'mike.chen@edudashpro.com',
          full_name: 'Mike Chen',
          role: 'content_moderator',
          department: 'content',
          permissions: ['content_moderation', 'user_communication'],
          is_active: true,
          last_login: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: profile?.id || '',
        },
        {
          id: '3',
          email: 'lisa.rodriguez@edudashpro.com',
          full_name: 'Lisa Rodriguez',
          role: 'support_admin',
          department: 'customer_success',
          permissions: ['user_support', 'system_diagnostics'],
          is_active: false,
          last_login: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: profile?.id || '',
          schools_assigned: ['school_3'],
        },
        {
          id: '4',
          email: 'alex.kumar@edudashpro.com',
          full_name: 'Alex Kumar',
          role: 'system_admin',
          department: 'engineering',
          permissions: ['system_config', 'database_access', 'analytics'],
          is_active: true,
          last_login: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: profile?.id || '',
        },
      ];

      setAdminUsers(mockAdminUsers);

    } catch (error) {
      console.error('Failed to fetch admin users:', error);
      Alert.alert('Error', 'Failed to load admin users');
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.id]);

  useEffect(() => {
    fetchAdminUsers();
  }, [fetchAdminUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAdminUsers();
    setRefreshing(false);
  }, [fetchAdminUsers]);

  const handleCreateAdmin = async () => {
    try {
      // Validate form
      if (!formData.email || !formData.full_name) {
        Alert.alert('Validation Error', 'Please fill in all required fields');
        return;
      }

      // TODO: Create admin user via Supabase
      Alert.alert('Success', `Admin user ${formData.full_name} created successfully!`);
      
      track('superadmin_admin_user_created', {
        role: formData.role,
        department: formData.department,
        created_by: profile?.id,
      });
      
      setShowCreateModal(false);
      setFormData({
        email: '',
        full_name: '',
        role: 'admin',
        department: 'customer_success',
        is_active: true,
        schools_assigned: [],
      });
      await fetchAdminUsers();
      
    } catch (error) {
      console.error('Failed to create admin user:', error);
      Alert.alert('Error', 'Failed to create admin user');
    }
  };

  const handleToggleUserStatus = (user: AdminUser) => {
    Alert.alert(
      `${user.is_active ? 'Deactivate' : 'Activate'} Admin User`,
      `Are you sure you want to ${user.is_active ? 'deactivate' : 'activate'} ${user.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: user.is_active ? 'Deactivate' : 'Activate',
          style: user.is_active ? 'destructive' : 'default',
          onPress: () => {
            // TODO: Update user status via Supabase
            track('superadmin_admin_user_status_changed', {
              user_id: user.id,
              new_status: !user.is_active,
              changed_by: profile?.id,
            });
            Alert.alert('Success', `${user.full_name} has been ${user.is_active ? 'deactivated' : 'activated'}`);
          }
        }
      ]
    );
  };

  const handleDeleteUser = (user: AdminUser) => {
    Alert.alert(
      'Delete Admin User',
      `Are you sure you want to permanently delete ${user.full_name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Delete user via Supabase
            track('superadmin_admin_user_deleted', {
              user_id: user.id,
              user_role: user.role,
              deleted_by: profile?.id,
            });
            Alert.alert('Success', `${user.full_name} has been deleted`);
          }
        }
      ]
    );
  };

  const getRoleInfo = (role: AdminUser['role']) => {
    return ADMIN_ROLES.find(r => r.value === role) || ADMIN_ROLES[0];
  };

  const getDepartmentInfo = (departmentId: string) => {
    return DEPARTMENTS.find(d => d.id === departmentId) || DEPARTMENTS[0];
  };

  const formatLastLogin = (lastLogin: string | null): string => {
    if (!lastLogin) return 'Never';
    
    const date = new Date(lastLogin);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  };

  if (!profile || !isSuperAdmin(profile.role)) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Admin Management', headerShown: false }} />
        <ThemedStatusBar />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Admin Management', headerShown: false }} />
      <ThemedStatusBar />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="people" size={28} color="#3b82f6" />
            <Text style={styles.title}>Admin Management</Text>
          </View>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading admin users...</Text>
          </View>
        ) : (
          <>
            {/* Admin Users List */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Admin Users ({adminUsers.length})</Text>
                <Text style={styles.sectionSubtitle}>
                  Manage administrative users and their permissions
                </Text>
              </View>
              
              {adminUsers.map((user) => {
                const roleInfo = getRoleInfo(user.role);
                const deptInfo = getDepartmentInfo(user.department);
                
                return (
                  <View key={user.id} style={styles.userCard}>
                    <View style={styles.userHeader}>
                      <View style={styles.userInfo}>
                        <View style={styles.userAvatarContainer}>
                          <View style={[styles.userAvatar, { backgroundColor: roleInfo.color }]}>
                            <Text style={styles.userAvatarText}>
                              {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </Text>
                          </View>
                          <View style={[
                            styles.userStatusIndicator,
                            { backgroundColor: user.is_active ? '#10b981' : '#6b7280' }
                          ]} />
                        </View>
                        
                        <View style={styles.userDetails}>
                          <Text style={styles.userName}>{user.full_name}</Text>
                          <Text style={styles.userEmail}>{user.email}</Text>
                          <View style={styles.userMeta}>
                            <View style={[styles.roleBadge, { backgroundColor: roleInfo.color + '20', borderColor: roleInfo.color }]}>
                              <Text style={[styles.roleText, { color: roleInfo.color }]}>
                                {roleInfo.label}
                              </Text>
                            </View>
                            <View style={[styles.deptBadge, { backgroundColor: deptInfo.color + '20', borderColor: deptInfo.color }]}>
                              <Text style={[styles.deptText, { color: deptInfo.color }]}>
                                {deptInfo.name}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.userStats}>
                      <Text style={styles.statItem}>
                        <Ionicons name="time" size={12} color="#6b7280" /> Last login: {formatLastLogin(user.last_login)}
                      </Text>
                      <Text style={styles.statItem}>
                        <Ionicons name="calendar" size={12} color="#6b7280" /> Created: {new Date(user.created_at).toLocaleDateString()}
                      </Text>
                      {user.schools_assigned && user.schools_assigned.length > 0 && (
                        <Text style={styles.statItem}>
                          <Ionicons name="school" size={12} color="#6b7280" /> {user.schools_assigned.length} schools assigned
                        </Text>
                      )}
                    </View>

                    <View style={styles.userActions}>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => {
                          setSelectedUser(user);
                          setShowEditModal(true);
                        }}
                      >
                        <Ionicons name="create" size={16} color="#3b82f6" />
                        <Text style={styles.actionButtonText}>Edit</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: user.is_active ? '#f59e0b20' : '#10b98120' }]}
                        onPress={() => handleToggleUserStatus(user)}
                      >
                        <Ionicons 
                          name={user.is_active ? "pause" : "play"} 
                          size={16} 
                          color={user.is_active ? '#f59e0b' : '#10b981'} 
                        />
                        <Text style={[styles.actionButtonText, { 
                          color: user.is_active ? '#f59e0b' : '#10b981' 
                        }]}>
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: '#ef444420' }]}
                        onPress={() => handleDeleteUser(user)}
                      >
                        <Ionicons name="trash" size={16} color="#ef4444" />
                        <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              
              {adminUsers.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people" size={48} color="#6b7280" />
                  <Text style={styles.emptyText}>No admin users</Text>
                  <Text style={styles.emptySubText}>Create your first admin user to get started</Text>
                  <TouchableOpacity 
                    style={styles.createButton}
                    onPress={() => setShowCreateModal(true)}
                  >
                    <Text style={styles.createButtonText}>Create Admin User</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Departments Overview */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Departments & Roles</Text>
              <Text style={styles.sectionSubtitle}>Available departments and their permissions</Text>
              
              {DEPARTMENTS.map((dept) => (
                <View key={dept.id} style={styles.deptCard}>
                  <View style={styles.deptHeader}>
                    <View style={[styles.deptIcon, { backgroundColor: dept.color + '20' }]}>
                      <Ionicons name="business" size={20} color={dept.color} />
                    </View>
                    <View style={styles.deptInfo}>
                      <Text style={styles.deptName}>{dept.name}</Text>
                      <Text style={styles.deptDescription}>{dept.description}</Text>
                    </View>
                  </View>
                  <View style={styles.permissionsList}>
                    {dept.permissions.map((permission) => (
                      <View key={permission} style={styles.permissionChip}>
                        <Text style={styles.permissionText}>{permission.replace(/_/g, ' ')}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Create Admin Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Admin User</Text>
            <TouchableOpacity onPress={handleCreateAdmin}>
              <Text style={styles.saveButton}>Create</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Full Name *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.full_name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, full_name: text }))}
                placeholder="Enter full name"
                placeholderTextColor="#6b7280"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Email Address *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                placeholder="admin@edudashpro.com"
                placeholderTextColor="#6b7280"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Admin Role</Text>
              {ADMIN_ROLES.map((role) => (
                <TouchableOpacity
                  key={role.value}
                  style={[
                    styles.roleOption,
                    { 
                      backgroundColor: formData.role === role.value ? role.color + '20' : 'transparent',
                      borderColor: formData.role === role.value ? role.color : '#374151'
                    }
                  ]}
onPress={() => setFormData(prev => ({ ...prev, role: role.value as any }))}
                >
                  <View style={styles.roleOptionContent}>
                    <Text style={[styles.roleOptionTitle, { 
                      color: formData.role === role.value ? role.color : '#ffffff' 
                    }]}>
                      {role.label}
                    </Text>
                    <Text style={styles.roleOptionDescription}>{role.description}</Text>
                  </View>
                  <View style={[
                    styles.radioButton,
                    { 
                      borderColor: formData.role === role.value ? role.color : '#6b7280',
                      backgroundColor: formData.role === role.value ? role.color : 'transparent'
                    }
                  ]}>
                    {formData.role === role.value && (
                      <Ionicons name="checkmark" size={12} color="#ffffff" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Department</Text>
              {DEPARTMENTS.map((dept) => (
                <TouchableOpacity
                  key={dept.id}
                  style={[
                    styles.deptOption,
                    { 
                      backgroundColor: formData.department === dept.id ? dept.color + '20' : 'transparent',
                      borderColor: formData.department === dept.id ? dept.color : '#374151'
                    }
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, department: dept.id }))}
                >
                  <View style={styles.deptOptionContent}>
                    <Text style={[styles.deptOptionTitle, { 
                      color: formData.department === dept.id ? dept.color : '#ffffff' 
                    }]}>
                      {dept.name}
                    </Text>
                    <Text style={styles.deptOptionDescription}>{dept.description}</Text>
                  </View>
                  <View style={[
                    styles.radioButton,
                    { 
                      borderColor: formData.department === dept.id ? dept.color : '#6b7280',
                      backgroundColor: formData.department === dept.id ? dept.color : 'transparent'
                    }
                  ]}>
                    {formData.department === dept.id && (
                      <Ionicons name="checkmark" size={12} color="#ffffff" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formSection}>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.formLabel}>Active Status</Text>
                  <Text style={styles.switchDescription}>User can log in and access assigned features</Text>
                </View>
                <Switch
                  value={formData.is_active}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, is_active: value }))}
                  trackColor={{ false: '#374151', true: '#3b82f620' }}
                  thumbColor={formData.is_active ? '#3b82f6' : '#9ca3af'}
                />
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    padding: 8,
    backgroundColor: '#3b82f620',
    borderRadius: 8,
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
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
  },
  userCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  userHeader: {
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  userAvatarContainer: {
    position: 'relative',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  userStatusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#1f2937',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
  },
  deptBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  deptText: {
    fontSize: 10,
    fontWeight: '600',
  },
  userStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    color: '#6b7280',
    fontSize: 12,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  deptCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  deptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  deptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deptInfo: {
    flex: 1,
  },
  deptName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  deptDescription: {
    color: '#9ca3af',
    fontSize: 14,
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  permissionChip: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  permissionText: {
    color: '#e5e7eb',
    fontSize: 10,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
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
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
  saveButton: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  roleOptionContent: {
    flex: 1,
  },
  roleOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  roleOptionDescription: {
    color: '#9ca3af',
    fontSize: 12,
  },
  deptOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  deptOptionContent: {
    flex: 1,
  },
  deptOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  deptOptionDescription: {
    color: '#9ca3af',
    fontSize: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchDescription: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
});