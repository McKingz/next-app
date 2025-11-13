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
  TextInput,
  Modal,
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

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  role: 'principal' | 'teacher' | 'parent' | 'superadmin' | 'super_admin';
  school_id: string | null;
  school_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_active: boolean;
  avatar_url: string | null;
}

interface UserFilters {
  role: 'all' | 'principal' | 'teacher' | 'parent' | 'superadmin';
  status: 'all' | 'active' | 'inactive';
  school: string;
  search: string;
}

export default function SuperAdminUsersScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserRecord[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  
  const [filters, setFilters] = useState<UserFilters>({
    role: 'all',
    status: 'all',
    school: '',
    search: '',
  });


  const fetchUsers = useCallback(async () => {
    if (!isSuperAdmin(profile?.role)) {
      Alert.alert('Access Denied', 'Super admin privileges required');
      return;
    }

    try {
      setLoading(true);

      // Use the existing super admin function to get all users
      const { data: usersData, error: usersError } = await assertSupabase()
        .rpc('get_all_users_for_superadmin');

      if (usersError) {
        console.error('Users fetch error:', usersError);
        Alert.alert('Error', 'Failed to load users');
        return;
      }

      if (usersData) {
        const userRecords: UserRecord[] = usersData.map((user: any) => ({
          id: user.id,
          email: user.email || '',
          name: user.name || user.full_name || null,
          role: user.role || 'parent',
          school_id: user.school_id,
          school_name: user.school_name,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          is_active: user.is_active !== false,
          avatar_url: user.avatar_url,
        }));

        setUsers(userRecords);
        setTotalUsers(userRecords.length);
      }

      // Get schools for filtering (reserved for future use)
      // const { data: schoolsData } = await assertSupabase()
      //   .rpc('get_all_schools_for_superadmin');

    } catch (error) {
      console.error('Failed to fetch users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [profile?.role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    let filtered = users;

    // Filter by role
    if (filters.role !== 'all') {
      filtered = filtered.filter(user => user.role === filters.role);
    }

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(user => 
        filters.status === 'active' ? user.is_active : !user.is_active
      );
    }

    // Filter by school
    if (filters.school) {
      filtered = filtered.filter(user => 
        user.school_name?.toLowerCase().includes(filters.school.toLowerCase())
      );
    }

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchLower) ||
        user.name?.toLowerCase().includes(searchLower) ||
        user.school_name?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredUsers(filtered);
  }, [users, filters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const impersonateUser = async (user: UserRecord) => {
    if (!user || user.role === 'superadmin' || user.role === 'super_admin') {
      Alert.alert('Error', 'Cannot impersonate super admin users');
      return;
    }

    Alert.alert(
      'Impersonate User',
      `Are you sure you want to impersonate ${user.email}? This will log you in as this user.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Impersonate',
          style: 'destructive',
          onPress: async () => {
            try {
              setImpersonating(true);

              // Track the impersonation
              track('superadmin_user_impersonation', {
                impersonated_user_id: user.id,
                impersonated_user_email: user.email,
                impersonated_user_role: user.role,
                impersonated_school_id: user.school_id,
              });

              // Log the impersonation for audit trail
              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'user_impersonation_start',
                  target_user_id: user.id,
                  details: {
                    impersonated_email: user.email,
                    impersonated_role: user.role,
                    impersonated_school: user.school_name,
                  },
                });

              if (logError) {
                console.error('Failed to log impersonation:', logError);
              }

              // In a real implementation, this would involve:
              // 1. Creating a temporary session token for the target user
              // 2. Storing the original admin session for restoration
              // 3. Switching the context to the impersonated user
              
              Alert.alert(
                'Impersonation Started',
                `You are now impersonating ${user.email}. In a production app, you would be redirected to their dashboard with full access.`,
                [
                  {
                    text: 'Return to Admin',
                    onPress: () => {
                      // Log end of impersonation
                      assertSupabase()
                        .from('audit_logs')
                        .insert({
                          admin_user_id: profile?.id,
                          action: 'user_impersonation_end',
                          target_user_id: user.id,
                          details: {
                            duration: 'immediate_return',
                          },
                        });
                    }
                  }
                ]
              );

            } catch (error) {
              console.error('Impersonation failed:', error);
              Alert.alert('Error', 'Failed to impersonate user');
            } finally {
              setImpersonating(false);
            }
          }
        }
      ]
    );
  };

  const suspendUser = async (user: UserRecord) => {
    Alert.alert(
      'Suspend User',
      `Are you sure you want to ${user.is_active ? 'suspend' : 'reactivate'} ${user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: user.is_active ? 'Suspend' : 'Reactivate',
          style: user.is_active ? 'destructive' : 'default',
          onPress: async () => {
            try {
              if (user.is_active) {
                // Suspend user using RPC function
                const { data: suspendResult, error: suspendError } = await assertSupabase()
                  .rpc('superadmin_suspend_user', {
target_user_id: (user as any).auth_user_id,
                    reason: 'Administrative suspension by super admin'
                  });

                if (suspendError) {
                  throw suspendError;
                }

                if (!suspendResult?.success) {
                  throw new Error(suspendResult?.error || 'Failed to suspend user');
                }
              } else {
                // Reactivate user using RPC function
                const { data: reactivateResult, error: reactivateError } = await assertSupabase()
                  .rpc('superadmin_reactivate_user', {
target_user_id: (user as any).auth_user_id,
                    reason: 'Administrative reactivation by super admin'
                  });

                if (reactivateError) {
                  throw reactivateError;
                }

                if (!reactivateResult?.success) {
                  throw new Error(reactivateResult?.error || 'Failed to reactivate user');
                }
              }

              // Track the action
              track('superadmin_user_status_changed', {
                user_id: user.id,
                user_email: user.email,
                new_status: user.is_active ? 'suspended' : 'active',
              });

              Alert.alert(
                'Success',
                `User ${user.is_active ? 'suspended' : 'reactivated'} successfully`
              );

              // Refresh the list
              fetchUsers();

            } catch (error) {
              console.error('Failed to update user status:', error);
              Alert.alert('Error', 'Failed to update user status');
            }
          }
        }
      ]
    );
  };

  const updateUserRole = async (user: UserRecord, newRole: string) => {
    Alert.alert(
      'Update User Role',
      `Change ${user.email}'s role from ${user.role} to ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update Role',
          onPress: async () => {
            try {
              // Update user role using RPC function
              const { data: updateResult, error: updateError } = await assertSupabase()
                .rpc('superadmin_update_user_role', {
target_user_id: (user as any).auth_user_id,
                  new_role: newRole,
                  reason: 'Administrative role change by super admin'
                });

              if (updateError) {
                throw updateError;
              }

              if (!updateResult?.success) {
                throw new Error(updateResult?.error || 'Failed to update user role');
              }

              // Track the action
              track('superadmin_user_role_updated', {
                user_id: user.id,
                user_email: user.email,
                old_role: user.role,
                new_role: newRole,
              });

              Alert.alert('Success', `User role updated to ${newRole} successfully`);

              // Refresh the list
              fetchUsers();

            } catch (error) {
              console.error('Failed to update user role:', error);
              Alert.alert('Error', 'Failed to update user role');
            }
          }
        }
      ]
    );
  };

  const requestUserDeletion = async (user: UserRecord) => {
    Alert.alert(
      'Request User Deletion',
      `Request deletion of ${user.email}? This will schedule the user for deletion in 7 days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Deletion',
          style: 'destructive',
          onPress: async () => {
            try {
              // Request user deletion using RPC function
              const { data: deleteResult, error: deleteError } = await assertSupabase()
                .rpc('superadmin_request_user_deletion', {
target_user_id: (user as any).auth_user_id,
                  deletion_reason: 'Administrative deletion request by super admin'
                });

              if (deleteError) {
                throw deleteError;
              }

              if (!deleteResult?.success) {
                throw new Error(deleteResult?.error || 'Failed to request user deletion');
              }

              // Track the action
              track('superadmin_user_deletion_requested', {
                user_id: user.id,
                user_email: user.email,
                request_id: deleteResult?.request_id,
              });

              Alert.alert('Success', 'User deletion request submitted successfully');

              // Refresh the list
              fetchUsers();

            } catch (error) {
              console.error('Failed to request user deletion:', error);
              Alert.alert('Error', 'Failed to request user deletion');
            }
          }
        }
      ]
    );
  };

  const resetUserPassword = async (user: UserRecord) => {
    Alert.alert(
      'Reset Password',
      `Send password reset email to ${user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Reset Email',
          onPress: async () => {
            try {
              const { error } = await assertSupabase().auth.resetPasswordForEmail(user.email, {
                redirectTo: 'https://edudashpro.com/reset-password',
              });

              if (error) {
                throw error;
              }

              // Track the action
              track('superadmin_password_reset_sent', {
                user_id: user.id,
                user_email: user.email,
              });

              // Log the action
              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'password_reset_sent',
                  target_user_id: user.id,
                  details: {
                    user_email: user.email,
                  },
                });

              if (logError) {
                console.error('Failed to log password reset:', logError);
              }

              Alert.alert('Success', 'Password reset email sent successfully');

            } catch (error) {
              console.error('Failed to send password reset:', error);
              Alert.alert('Error', 'Failed to send password reset email');
            }
          }
        }
      ]
    );
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'superadmin':
      case 'super_admin':
        return '#ef4444';
      case 'principal':
        return '#8b5cf6';
      case 'teacher':
        return '#10b981';
      case 'parent':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const formatLastSeen = (lastSignIn: string | null): string => {
    if (!lastSignIn) return 'Never';
    const date = new Date(lastSignIn);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  if (!profile || !isSuperAdmin(profile.role)) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'User Management', headerShown: false }} />
        <ThemedStatusBar />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'User Management', headerShown: false }} />
      <ThemedStatusBar />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => router.canGoBack() ? router.back() : router.push('/screens/super-admin-dashboard')} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#00f5ff" />
          </TouchableOpacity>
          <Text style={styles.title}>User Management</Text>
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterButton}>
            <Ionicons name="filter" size={24} color="#00f5ff" />
          </TouchableOpacity>
        </View>
        
        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            Showing {filteredUsers.length} of {totalUsers} users
          </Text>
        </View>
      </SafeAreaView>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#9ca3af"
            value={filters.search}
            onChangeText={(text) => setFilters(prev => ({ ...prev, search: text }))}
          />
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
            {(['all', 'principal', 'teacher', 'parent', 'superadmin'] as const).map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.filterTab, filters.role === role && styles.filterTabActive]}
                onPress={() => setFilters(prev => ({ ...prev, role }))}
              >
                <Text style={[styles.filterTabText, filters.role === role && styles.filterTabTextActive]}>
                  {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
            {(['all', 'active', 'inactive'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.filterTab, filters.status === status && styles.filterTabActive]}
                onPress={() => setFilters(prev => ({ ...prev, status }))}
              >
                <Text style={[styles.filterTabText, filters.status === status && styles.filterTabTextActive]}>
                  {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        ) : (
          <>
            {filteredUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.userCard}
                onPress={() => {
                  setSelectedUser(user);
                  setShowUserModal(true);
                }}
              >
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <View style={styles.avatarContainer}>
                      {user.avatar_url ? (
                        <Text style={styles.avatarText}>{user.name?.charAt(0) || user.email.charAt(0)}</Text>
                      ) : (
                        <Ionicons name="person" size={20} color={theme.textTertiary} />
                      )}
                    </View>
                    <View style={styles.userDetails}>
                      <Text style={styles.userName}>{user.name || user.email}</Text>
                      <Text style={styles.userEmail}>{user.email}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.userMeta}>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) + '20', borderColor: getRoleColor(user.role) }]}>
                      <Text style={[styles.roleText, { color: getRoleColor(user.role) }]}>
                        {user.role.toUpperCase()}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, user.is_active ? styles.statusActive : styles.statusInactive]}>
                      <Text style={[styles.statusText, user.is_active ? styles.statusActiveText : styles.statusInactiveText]}>
                        {user.is_active ? 'Active' : 'Suspended'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.userFooter}>
                  {user.school_name && (
                    <Text style={styles.schoolText}>
                      <Ionicons name="school" size={12} color={theme.textTertiary} />
                    </Text>
                  )}
                  <Text style={styles.lastSeenText}>
                    Last seen: {formatLastSeen(user.last_sign_in_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {filteredUsers.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#6b7280" />
                <Text style={styles.emptyText}>No users found</Text>
                <Text style={styles.emptySubText}>Try adjusting your search or filters</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* User Details Modal */}
      <Modal
        visible={showUserModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowUserModal(false)}
      >
        {selectedUser && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <Ionicons name="close" size={24} color="#00f5ff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>User Details</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.modalUserInfo}>
                <View style={styles.modalAvatar}>
                  {selectedUser.avatar_url ? (
                    <Text style={styles.modalAvatarText}>
                      {selectedUser.name?.charAt(0) || selectedUser.email.charAt(0)}
                    </Text>
                  ) : (
                    <Ionicons name="person" size={32} color="#6b7280" />
                  )}
                </View>
                <Text style={styles.modalUserName}>{selectedUser.name || selectedUser.email}</Text>
                <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
                
                <View style={styles.modalBadges}>
                  <View style={[styles.modalRoleBadge, { backgroundColor: getRoleColor(selectedUser.role) + '20', borderColor: getRoleColor(selectedUser.role) }]}>
                    <Text style={[styles.modalRoleText, { color: getRoleColor(selectedUser.role) }]}>
                      {selectedUser.role.toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.modalStatusBadge, selectedUser.is_active ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.modalStatusText, selectedUser.is_active ? styles.statusActiveText : styles.statusInactiveText]}>
                      {selectedUser.is_active ? 'Active' : 'Suspended'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Account Information</Text>
                <View style={styles.modalInfoItem}>
                  <Text style={styles.modalInfoLabel}>User ID</Text>
                  <Text style={styles.modalInfoValue}>{selectedUser.id}</Text>
                </View>
                <View style={styles.modalInfoItem}>
                  <Text style={styles.modalInfoLabel}>Created</Text>
                  <Text style={styles.modalInfoValue}>
                    {new Date(selectedUser.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.modalInfoItem}>
                  <Text style={styles.modalInfoLabel}>Last Sign In</Text>
                  <Text style={styles.modalInfoValue}>
                    {formatLastSeen(selectedUser.last_sign_in_at)}
                  </Text>
                </View>
                {selectedUser.school_name && (
                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>School</Text>
                    <Text style={styles.modalInfoValue}>{selectedUser.school_name}</Text>
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => impersonateUser(selectedUser)}
                  disabled={impersonating}
                >
                  {impersonating ? (
                    <ActivityIndicator size="small" color="#00f5ff" />
                  ) : (
                    <Ionicons name="person-circle" size={20} color="#00f5ff" />
                  )}
                  <Text style={styles.modalActionText}>Impersonate User</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => resetUserPassword(selectedUser)}
                >
                  <Ionicons name="key" size={20} color="#f59e0b" />
                  <Text style={[styles.modalActionText, { color: '#f59e0b' }]}>Reset Password</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => suspendUser(selectedUser)}
                >
                  <Ionicons 
                    name={selectedUser.is_active ? "ban" : "checkmark-circle"} 
                    size={20} 
                    color={selectedUser.is_active ? "#ef4444" : "#10b981"} 
                  />
                  <Text style={[styles.modalActionText, { color: selectedUser.is_active ? "#ef4444" : "#10b981" }]}>
                    {selectedUser.is_active ? 'Suspend User' : 'Reactivate User'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => {
                    Alert.alert(
                      'Update User Role',
                      'Select new role for this user:',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Principal', onPress: () => updateUserRole(selectedUser, 'principal') },
                        { text: 'Teacher', onPress: () => updateUserRole(selectedUser, 'teacher') },
                        { text: 'Parent', onPress: () => updateUserRole(selectedUser, 'parent') },
                      ]
                    );
                  }}
                >
                  <Ionicons name="person-add" size={20} color="#8b5cf6" />
                  <Text style={[styles.modalActionText, { color: '#8b5cf6' }]}>Update Role</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => requestUserDeletion(selectedUser)}
                >
                  <Ionicons name="trash" size={20} color="#dc2626" />
                  <Text style={[styles.modalActionText, { color: '#dc2626' }]}>Request Deletion</Text>
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
  filterButton: {
    padding: 8,
  },
  statsContainer: {
    paddingBottom: 16,
  },
  statsText: {
    color: '#9ca3af',
    fontSize: 14,
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
  userCard: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    color: '#9ca3af',
    fontSize: 14,
  },
  userMeta: {
    alignItems: 'flex-end',
    gap: 4,
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
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: '#10b98120',
  },
  statusInactive: {
    backgroundColor: '#ef444420',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  statusActiveText: {
    color: '#10b981',
  },
  statusInactiveText: {
    color: '#ef4444',
  },
  userFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  schoolText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  lastSeenText: {
    color: '#6b7280',
    fontSize: 12,
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
  placeholder: {
    width: 24,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#111827',
  },
  modalUserInfo: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1f2937',
    marginBottom: 16,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalAvatarText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '600',
  },
  modalUserName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalUserEmail: {
    color: '#9ca3af',
    fontSize: 16,
    marginBottom: 16,
  },
  modalBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  modalRoleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  modalRoleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalSection: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  modalSectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalInfoLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  modalInfoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  modalActions: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalActionText: {
    color: '#00f5ff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
});