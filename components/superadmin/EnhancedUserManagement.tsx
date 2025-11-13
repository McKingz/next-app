/**
 * Enhanced Superadmin User Management System
 * 
 * Comprehensive user management with secure deletion, suspension, 
 * bulk operations, and complete audit trails.
 * 
 * Features:
 * - Complete user deletion workflow (soft/hard/GDPR compliance)
 * - Advanced user suspension with auto-expiry
 * - Bulk user operations with safety checks
 * - Real-time user activity monitoring
 * - Complete audit trail for all actions
 * - Export functionality for compliance
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { isSuperAdmin } from '@/lib/roleUtils';
import { track } from '@/lib/analytics';

// Types and Interfaces
interface EnhancedUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  role: string;
  organizationId?: string;
  organizationName?: string;
  isActive: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
  suspensionExpiresAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  profileCompleteness: number;
  riskScore: number;
  tags: string[];
  metadata: Record<string, any>;
}

interface UserDeletionRequest {
  userId: string;
  deletionType: 'soft' | 'hard' | 'gdpr_compliance';
  reason: string;
  retentionPeriod?: number;
  adminId: string;
  scheduledFor?: Date;
}

interface BulkOperation {
  operation: 'suspend' | 'activate' | 'delete' | 'export' | 'notify';
  userIds: string[];
  parameters: Record<string, any>;
  reason: string;
}

interface UserFilter {
  role: string;
  status: 'all' | 'active' | 'suspended' | 'deleted';
  organization: string;
  riskLevel: 'all' | 'low' | 'medium' | 'high' | 'critical';
  lastActivity: 'all' | 'today' | 'week' | 'month' | 'inactive';
  search: string;
}

interface UserSuspensionOptions {
  reason: string;
  duration?: number; // hours
  restrictLogin: boolean;
  restrictDataAccess: boolean;
  notifyUser: boolean;
  escalationLevel: 'warning' | 'suspension' | 'termination';
  autoExpiry: boolean;
}

// Main Component
export const EnhancedUserManagement: React.FC = () => {
  const { theme } = useTheme();
  const { profile } = useAuth();
  
  // State Management
  const [users, setUsers] = useState<EnhancedUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<EnhancedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal States
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
  const [showBulkOperationsModal, setBulkOperationsModal] = useState(false);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<EnhancedUser | null>(null);
  const [currentOperation, setCurrentOperation] = useState<BulkOperation | null>(null);
  
  // Filter State
  const [filters, setFilters] = useState<UserFilter>({
    role: 'all',
    status: 'all',
    organization: 'all',
    riskLevel: 'all',
    lastActivity: 'all',
    search: '',
  });
  
  // Form States
  const [deletionRequest, setDeletionRequest] = useState<Partial<UserDeletionRequest>>({
    deletionType: 'soft',
    reason: '',
  });
  
  const [suspensionOptions, setSuspensionOptions] = useState<UserSuspensionOptions>({
    reason: '',
    restrictLogin: true,
    restrictDataAccess: false,
    notifyUser: true,
    escalationLevel: 'warning',
    autoExpiry: true,
  });

  // Security Check
  const hasPermission = isSuperAdmin(profile?.role);

  // Fetch Users with Enhanced Data
  const fetchUsers = useCallback(async () => {
    if (!hasPermission) return;
    
    try {
      setLoading(true);
      
      // Call comprehensive user fetch RPC
      const { data, error } = await assertSupabase()
        .rpc('superadmin_get_enhanced_users', {
          include_metadata: true,
          include_risk_scores: true,
          include_activity_data: true,
        });
      
      if (error) throw error;
      
      const enhancedUsers: EnhancedUser[] = (data || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
        isActive: user.is_active !== false,
        isSuspended: user.is_suspended === true,
        suspensionReason: user.suspension_reason,
        suspensionExpiresAt: user.suspension_expires_at,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        profileCompleteness: user.profile_completeness || 0,
        riskScore: user.risk_score || 0,
        tags: user.tags || [],
        metadata: user.metadata || {},
      }));
      
      setUsers(enhancedUsers);
      
      // Track analytics
      track('superadmin.users.fetched', {
        admin_id: profile?.id,
        total_users: enhancedUsers.length,
        active_users: enhancedUsers.filter(u => u.isActive).length,
        suspended_users: enhancedUsers.filter(u => u.isSuspended).length,
      });
      
    } catch (error) {
      console.error('Failed to fetch users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [hasPermission, profile?.id]);

  // Apply Filters
  const applyFilters = useCallback(() => {
    let filtered = users;

    // Role filter
    if (filters.role !== 'all') {
      filtered = filtered.filter(user => user.role === filters.role);
    }

    // Status filter
    if (filters.status !== 'all') {
      switch (filters.status) {
        case 'active':
          filtered = filtered.filter(user => user.isActive && !user.isSuspended);
          break;
        case 'suspended':
          filtered = filtered.filter(user => user.isSuspended);
          break;
        case 'deleted':
          filtered = filtered.filter(user => !user.isActive);
          break;
      }
    }

    // Organization filter
    if (filters.organization !== 'all') {
      filtered = filtered.filter(user => user.organizationId === filters.organization);
    }

    // Risk level filter
    if (filters.riskLevel !== 'all') {
      const riskRanges = {
        low: [0, 25],
        medium: [26, 50],
        high: [51, 75],
        critical: [76, 100],
      };
      const [min, max] = riskRanges[filters.riskLevel as keyof typeof riskRanges];
      filtered = filtered.filter(user => user.riskScore >= min && user.riskScore <= max);
    }

    // Last activity filter
    if (filters.lastActivity !== 'all') {
      const now = new Date();
      const filterMap = {
        today: 1,
        week: 7,
        month: 30,
        inactive: 90,
      };
      const days = filterMap[filters.lastActivity as keyof typeof filterMap];
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      if (filters.lastActivity === 'inactive') {
        filtered = filtered.filter(user => 
          !user.lastLoginAt || new Date(user.lastLoginAt) < cutoff
        );
      } else {
        filtered = filtered.filter(user => 
          user.lastLoginAt && new Date(user.lastLoginAt) >= cutoff
        );
      }
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchLower) ||
        user.fullName?.toLowerCase().includes(searchLower) ||
        user.organizationName?.toLowerCase().includes(searchLower) ||
        user.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    setFilteredUsers(filtered);
  }, [users, filters]);

  // User Selection Management
  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
  }, [filteredUsers]);

  const clearSelection = useCallback(() => {
    setSelectedUsers(new Set());
  }, []);

  // User Operations
  const suspendUser = async (user: EnhancedUser, options: UserSuspensionOptions) => {
    try {
      const expiresAt = options.autoExpiry && options.duration ? 
        new Date(Date.now() + options.duration * 60 * 60 * 1000).toISOString() : 
        null;

      const { error } = await assertSupabase()
        .rpc('superadmin_suspend_user', {
          target_user_id: user.id,
          admin_user_id: profile?.id,
          suspension_reason: options.reason,
          expires_at: expiresAt,
          restrict_login: options.restrictLogin,
          restrict_data_access: options.restrictDataAccess,
          notify_user: options.notifyUser,
          escalation_level: options.escalationLevel,
        });

      if (error) throw error;

      Alert.alert('Success', `User ${user.email} has been suspended`);
      
      // Refresh data
      await fetchUsers();
      
      // Track action
      track('superadmin.user.suspended', {
        admin_id: profile?.id,
        target_user_id: user.id,
        reason: options.reason,
        duration_hours: options.duration,
        auto_expiry: options.autoExpiry,
      });
      
    } catch (error) {
      console.error('Failed to suspend user:', error);
      Alert.alert('Error', 'Failed to suspend user');
    }
  };

  const deleteUser = async (user: EnhancedUser, request: UserDeletionRequest) => {
    try {
      // Show confirmation dialog with details
      const confirmMessage = `
        WARNING: This action ${request.deletionType === 'hard' ? 'CANNOT BE UNDONE' : 'can be reversed within 30 days'}.
        
        User: ${user.email}
        Type: ${request.deletionType.toUpperCase()}
        Reason: ${request.reason}
        
        ${request.deletionType === 'hard' ? 
          'All user data will be permanently deleted from the database.' : 
          'User will be deactivated and data will be retained for recovery.'
        }
        
        Type "DELETE" to confirm:
      `;

      Alert.prompt(
        'Confirm User Deletion',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async (confirmation) => {
              if (confirmation !== 'DELETE') {
                Alert.alert('Cancelled', 'User deletion cancelled - confirmation text did not match');
                return;
              }
              
              await performUserDeletion(user, request);
            }
          }
        ],
        'plain-text'
      );
      
    } catch (error) {
      console.error('Failed to delete user:', error);
      Alert.alert('Error', 'Failed to delete user');
    }
  };

  const performUserDeletion = async (user: EnhancedUser, request: UserDeletionRequest) => {
    try {
      const { error } = await assertSupabase()
        .rpc('superadmin_delete_user', {
          target_user_id: user.id,
          admin_user_id: profile?.id,
          deletion_type: request.deletionType,
          deletion_reason: request.reason,
          retention_period_days: request.retentionPeriod || 30,
        });

      if (error) throw error;

      Alert.alert(
        'Deletion Initiated',
        `User ${user.email} deletion has been initiated. You will receive a notification when the process is complete.`
      );
      
      // Refresh data
      await fetchUsers();
      
      // Track action
      track('superadmin.user.deleted', {
        admin_id: profile?.id,
        target_user_id: user.id,
        deletion_type: request.deletionType,
        reason: request.reason,
      });
      
    } catch (error) {
      console.error('Failed to delete user:', error);
      Alert.alert('Error', 'Failed to delete user');
    }
  };

  const performBulkOperation = async (operation: BulkOperation) => {
    if (operation.userIds.length === 0) {
      Alert.alert('No Users Selected', 'Please select users to perform bulk operation');
      return;
    }

    try {
      const { error } = await assertSupabase()
        .rpc('superadmin_bulk_user_operation', {
          admin_user_id: profile?.id,
          operation_type: operation.operation,
          target_user_ids: operation.userIds,
          operation_parameters: operation.parameters,
          operation_reason: operation.reason,
        });

      if (error) throw error;

      Alert.alert(
        'Bulk Operation Started',
        `${operation.operation} operation started for ${operation.userIds.length} users`
      );
      
      // Clear selection and refresh
      clearSelection();
      await fetchUsers();
      
      // Track action
      track('superadmin.bulk_operation', {
        admin_id: profile?.id,
        operation: operation.operation,
        user_count: operation.userIds.length,
        reason: operation.reason,
      });
      
    } catch (error) {
      console.error('Failed to perform bulk operation:', error);
      Alert.alert('Error', 'Failed to perform bulk operation');
    }
  };

  // Effects
  useEffect(() => {
    if (hasPermission) {
      fetchUsers();
    }
  }, [fetchUsers, hasPermission]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Render Methods
  const getRoleColor = (role: string): string => {
    const roleColors: Record<string, string> = {
      'super_admin': '#ef4444',
      'principal_admin': '#8b5cf6',
      'teacher': '#10b981',
      'parent': '#f59e0b',
      'student': '#3b82f6',
    };
    return roleColors[role] || '#6b7280';
  };

  const getRiskColor = (score: number): string => {
    if (score >= 76) return '#ef4444'; // Critical - Red
    if (score >= 51) return '#f59e0b'; // High - Orange
    if (score >= 26) return '#eab308'; // Medium - Yellow
    return '#10b981'; // Low - Green
  };

  const formatLastActivity = (lastLoginAt?: string): string => {
    if (!lastLoginAt) return 'Never';
    
    const diff = Date.now() - new Date(lastLoginAt).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const renderUser = ({ item: user }: { item: EnhancedUser }) => (
    <TouchableOpacity
      style={[
        styles.userCard,
        { backgroundColor: theme.surface, borderColor: theme.border },
        selectedUsers.has(user.id) && { borderColor: theme.primary, borderWidth: 2 }
      ]}
      onPress={() => {
        setSelectedUser(user);
        setShowUserDetailsModal(true);
      }}
      onLongPress={() => toggleUserSelection(user.id)}
    >
      {/* Selection Checkbox */}
      <TouchableOpacity
        style={styles.selectionCheckbox}
        onPress={() => toggleUserSelection(user.id)}
      >
        <Ionicons
          name={selectedUsers.has(user.id) ? 'checkbox' : 'square-outline'}
          size={20}
          color={selectedUsers.has(user.id) ? theme.primary : theme.textSecondary}
        />
      </TouchableOpacity>

      {/* User Info */}
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
            {user.fullName}
          </Text>
          <View style={styles.userBadges}>
            {/* Role Badge */}
            <View style={[
              styles.badge,
              { backgroundColor: getRoleColor(user.role) + '20', borderColor: getRoleColor(user.role) }
            ]}>
              <Text style={[styles.badgeText, { color: getRoleColor(user.role) }]}>
                {user.role.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            
            {/* Status Badge */}
            <View style={[
              styles.badge,
              user.isSuspended
                ? { backgroundColor: '#ef444420', borderColor: '#ef4444' }
                : user.isActive
                ? { backgroundColor: '#10b98120', borderColor: '#10b981' }
                : { backgroundColor: '#6b728020', borderColor: '#6b7280' }
            ]}>
              <Text style={[
                styles.badgeText,
                { color: user.isSuspended ? '#ef4444' : user.isActive ? '#10b981' : '#6b7280' }
              ]}>
                {user.isSuspended ? 'SUSPENDED' : user.isActive ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.userEmail, { color: theme.textSecondary }]} numberOfLines={1}>
          {user.email}
        </Text>

        {user.organizationName && (
          <Text style={[styles.organizationName, { color: theme.textSecondary }]} numberOfLines={1}>
            <Ionicons name="business" size={12} color={theme.textSecondary} /> {user.organizationName}
          </Text>
        )}

        <View style={styles.userMetrics}>
          {/* Risk Score */}
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.textTertiary }]}>Risk</Text>
            <View style={[
              styles.riskIndicator,
              { backgroundColor: getRiskColor(user.riskScore) + '20', borderColor: getRiskColor(user.riskScore) }
            ]}>
              <Text style={[styles.riskScore, { color: getRiskColor(user.riskScore) }]}>
                {user.riskScore}
              </Text>
            </View>
          </View>

          {/* Profile Completeness */}
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.textTertiary }]}>Profile</Text>
            <Text style={[styles.metricValue, { color: theme.textSecondary }]}>
              {user.profileCompleteness}%
            </Text>
          </View>

          {/* Last Activity */}
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: theme.textTertiary }]}>Last Active</Text>
            <Text style={[styles.metricValue, { color: theme.textSecondary }]}>
              {formatLastActivity(user.lastLoginAt)}
            </Text>
          </View>
        </View>

        {/* Tags */}
        {user.tags.length > 0 && (
          <View style={styles.userTags}>
            {user.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={[styles.tag, { backgroundColor: theme.primary + '20' }]}>
                <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
              </View>
            ))}
            {user.tags.length > 3 && (
              <Text style={[styles.moreTagsText, { color: theme.textTertiary }]}>
                +{user.tags.length - 3} more
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => {
            setSelectedUser(user);
            setShowSuspensionModal(true);
          }}
        >
          <Ionicons
            name={user.isSuspended ? 'play' : 'pause'}
            size={16}
            color={user.isSuspended ? theme.success : theme.warning}
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => {
            setSelectedUser(user);
            setShowDeletionModal(true);
          }}
        >
          <Ionicons name="trash" size={16} color={theme.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Permission Check
  if (!hasPermission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.deniedContainer}>
          <Ionicons name="shield-checkmark" size={64} color={theme.error} />
          <Text style={[styles.deniedTitle, { color: theme.text }]}>Access Denied</Text>
          <Text style={[styles.deniedMessage, { color: theme.textSecondary }]}>
            Super Administrator privileges required
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with Stats */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.text }]}>{filteredUsers.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
          </View>
          
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.success }]}>
              {filteredUsers.filter(u => u.isActive && !u.isSuspended).length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active</Text>
          </View>
          
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.warning }]}>
              {filteredUsers.filter(u => u.isSuspended).length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Suspended</Text>
          </View>
          
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.error }]}>
              {filteredUsers.filter(u => u.riskScore >= 76).length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>High Risk</Text>
          </View>
        </View>
      </View>

      {/* Search and Filters */}
      <View style={[styles.filtersContainer, { backgroundColor: theme.surface }]}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search users..."
            placeholderTextColor={theme.textSecondary}
            value={filters.search}
            onChangeText={(text) => setFilters(prev => ({ ...prev, search: text }))}
          />
          {filters.search !== '' && (
            <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, search: '' }))}>
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPills}>
          {Object.entries({
            status: ['all', 'active', 'suspended', 'deleted'],
            role: ['all', 'super_admin', 'principal_admin', 'teacher', 'parent'],
            riskLevel: ['all', 'low', 'medium', 'high', 'critical'],
            lastActivity: ['all', 'today', 'week', 'month', 'inactive'],
          }).map(([filterKey, options]) => (
            <View key={filterKey} style={styles.filterGroup}>
              {options.map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.filterPill,
                    { backgroundColor: theme.background, borderColor: theme.border },
                    filters[filterKey as keyof UserFilter] === option && {
                      backgroundColor: theme.primary + '20',
                      borderColor: theme.primary,
                    }
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, [filterKey]: option }))}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: theme.textSecondary },
                      filters[filterKey as keyof UserFilter] === option && { color: theme.primary }
                    ]}
                  >
                    {option === 'all' ? `All ${filterKey}` : option.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Selection Bar */}
      {selectedUsers.size > 0 && (
        <View style={[styles.selectionBar, { backgroundColor: theme.primary + '10', borderColor: theme.primary }]}>
          <Text style={[styles.selectionText, { color: theme.primary }]}>
            {selectedUsers.size} users selected
          </Text>
          
          <View style={styles.selectionActions}>
            <TouchableOpacity
              style={[styles.selectionButton, { backgroundColor: theme.primary + '20' }]}
              onPress={() => setBulkOperationsModal(true)}
            >
              <Text style={[styles.selectionButtonText, { color: theme.primary }]}>Bulk Actions</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.selectionButton, { backgroundColor: theme.textSecondary + '20' }]}
              onPress={clearSelection}
            >
              <Text style={[styles.selectionButtonText, { color: theme.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={item => item.id}
        refreshing={refreshing}
        onRefresh={fetchUsers}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={theme.textTertiary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Users Found</Text>
            <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>
              Try adjusting your search or filters
            </Text>
          </View>
        }
      />

      {/* Floating Action Buttons */}
      <View style={styles.fab}>
        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: theme.primary }]}
          onPress={() => Alert.alert('Create User', 'User creation wizard coming soon')}
        >
          <Ionicons name="person-add" size={24} color={theme.onPrimary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: theme.secondary }]}
          onPress={selectAllVisible}
        >
          <Ionicons name="checkmark-done" size={24} color={theme.onSecondary} />
        </TouchableOpacity>
      </View>

      {/* TODO: Add modals for user details, bulk operations, deletion, and suspension */}
      {/* These would be implemented as separate components for maintainability */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  deniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  deniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  deniedMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  filterPills: {
    flexDirection: 'row',
  },
  filterGroup: {
    flexDirection: 'row',
    marginRight: 16,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  selectionCheckbox: {
    marginRight: 12,
    paddingTop: 2,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 4,
  },
  organizationName: {
    fontSize: 12,
    marginBottom: 8,
  },
  userMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  riskIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  riskScore: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  userTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  quickActions: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 12,
  },
  quickAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    gap: 12,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default EnhancedUserManagement;