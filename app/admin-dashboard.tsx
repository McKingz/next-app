// 🎛️ Admin Dashboard Screen
// Main admin control panel with live user management, invitations, and analytics

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { EnhancedUser, SecurityEvent, EnhancedInvitation } from '../types/auth-enhanced';

const { width } = Dimensions.get('window');

// Mock data that updates in real-time
const MOCK_USERS: EnhancedUser[] = [
  {
    id: '1',
    email: 'john.principal@school.edu',
    firstName: 'John',
    lastName: 'Smith',
    role: 'principal',
    organizationId: 'org_1',
    profileComplete: true,
    emailVerified: true,
    lastLogin: new Date(),
    createdAt: new Date('2024-01-10'),
    settings: {
      theme: 'light',
      language: 'en',
      notifications: { email: true, push: true, sms: false, marketing: false },
      privacy: { profileVisibility: 'organization', showEmail: false, showPhone: false, dataCollection: true }
    },
    permissions: ['read', 'write', 'admin']
  },
  {
    id: '2',
    email: 'sarah.teacher@school.edu',
    firstName: 'Sarah',
    lastName: 'Johnson',
    role: 'teacher',
    organizationId: 'org_1',
    profileComplete: true,
    emailVerified: true,
    lastLogin: new Date(Date.now() - 3600000), // 1 hour ago
    createdAt: new Date('2024-01-12'),
    settings: {
      theme: 'dark',
      language: 'en',
      notifications: { email: true, push: true, sms: false, marketing: false },
      privacy: { profileVisibility: 'organization', showEmail: true, showPhone: false, dataCollection: true }
    },
    permissions: ['read', 'write']
  },
  {
    id: '3',
    email: 'mike.parent@gmail.com',
    firstName: 'Mike',
    lastName: 'Davis',
    role: 'parent',
    organizationId: 'org_1',
    profileComplete: false,
    emailVerified: true,
    lastLogin: new Date(Date.now() - 86400000), // 1 day ago
    createdAt: new Date('2024-01-15'),
    settings: {
      theme: 'system',
      language: 'en',
      notifications: { email: true, push: false, sms: true, marketing: false },
      privacy: { profileVisibility: 'private', showEmail: false, showPhone: false, dataCollection: false }
    },
    permissions: ['read']
  }
];

const MOCK_PENDING_INVITATIONS = [
  { id: 'inv_1', email: 'new.teacher@email.com', role: 'teacher', status: 'pending', sentDate: new Date() },
  { id: 'inv_2', email: 'another.parent@email.com', role: 'parent', status: 'pending', sentDate: new Date(Date.now() - 3600000) },
  { id: 'inv_3', email: 'expired.user@email.com', role: 'teacher', status: 'expired', sentDate: new Date(Date.now() - 86400000 * 7) }
];

const MOCK_RECENT_ACTIVITY: SecurityEvent[] = [
  {
    id: '1',
    type: 'login_success',
    email: 'sarah.teacher@school.edu',
    ipAddress: '192.168.1.105',
    userAgent: 'Mobile App',
    timestamp: new Date(Date.now() - 300000), // 5 minutes ago
    details: { device: 'iPhone 15', location: 'New York, NY' },
    riskLevel: 'low',
    resolved: true
  },
  {
    id: '2',
    type: 'invitation_sent',
    email: 'new.teacher@email.com',
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome',
    timestamp: new Date(Date.now() - 900000), // 15 minutes ago
    details: { invitedBy: 'John Smith', role: 'teacher' },
    riskLevel: 'low',
    resolved: true
  },
  {
    id: '3',
    type: 'login_failure',
    email: 'unknown@hacker.com',
    ipAddress: '203.0.113.1',
    userAgent: 'curl/7.68.0',
    timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
    details: { reason: 'Invalid credentials', attempts: 5 },
    riskLevel: 'high',
    resolved: false
  }
];

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);
  const [users, setUsers] = React.useState(MOCK_USERS);
  const [invitations, setInvitations] = React.useState(MOCK_PENDING_INVITATIONS);
  const [activity, setActivity] = React.useState(MOCK_RECENT_ACTIVITY);
  const [stats, setStats] = React.useState({
    totalUsers: MOCK_USERS.length,
    activeUsers: MOCK_USERS.filter(u => u.lastLogin && u.lastLogin > new Date(Date.now() - 86400000)).length,
    pendingInvitations: MOCK_PENDING_INVITATIONS.filter(i => i.status === 'pending').length,
    securityAlerts: MOCK_RECENT_ACTIVITY.filter(a => a.riskLevel === 'high' && !a.resolved).length
  });

  // Simulate real-time updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      // Update last seen times
      setUsers(prev => prev.map(user => ({
        ...user,
        lastLogin: user.id === '1' ? new Date() : user.lastLogin // Principal is always active
      })));

      // Update stats
      setStats(prev => ({
        ...prev,
        totalUsers: users.length,
        activeUsers: users.filter(u => u.lastLogin && u.lastLogin > new Date(Date.now() - 86400000)).length,
      }));
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [users]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Add a new activity item to show refresh worked
    const newActivity = {
      id: Date.now().toString(),
      type: 'login_success' as const,
      email: 'admin@school.edu',
      ipAddress: '192.168.1.200',
      userAgent: 'Admin Panel',
      timestamp: new Date(),
      details: { device: 'Web Dashboard', action: 'Data Refreshed' },
      riskLevel: 'low' as const,
      resolved: true
    };
    
    setActivity(prev => [newActivity, ...prev.slice(0, 9)]);
    setRefreshing(false);
    
    Alert.alert(t('admin.data_refreshed_title', { defaultValue: '✅ Data Refreshed' }), t('admin.data_refreshed_desc', { defaultValue: 'Dashboard data has been updated with the latest information.' }));
  };

  const handleUserAction = (userId: string, action: string) => {
    Alert.alert(
      t('admin.user_action_title', { defaultValue: '{{action}} User', action }),
      t('admin.user_action_confirm', { defaultValue: 'Are you sure you want to {{action}} this user?', action: action.toLowerCase() }),
      [
        { text: t('navigation.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        { 
          text: action, 
          style: action === 'Delete' ? 'destructive' : 'default',
          onPress: () => {
            if (action === 'Delete') {
              setUsers(prev => prev.filter(u => u.id !== userId));
              setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
            }
            Alert.alert(t('admin.action_completed_title', { defaultValue: '✅ Action Completed' }), t('admin.action_completed_desc', { defaultValue: 'User has been {{action}} successfully.', action: action.toLowerCase() + 'ed' }));
          }
        }
      ]
    );
  };

  const handleInvitationAction = (invitationId: string, action: string) => {
    if (action === 'Resend') {
      Alert.alert(t('admin.invitation_resent_title', { defaultValue: '📤 Invitation Resent' }), t('admin.invitation_resent_desc', { defaultValue: 'The invitation has been sent again to the user.' }));
    } else if (action === 'Cancel') {
      setInvitations(prev => prev.filter(i => i.id !== invitationId));
      setStats(prev => ({ ...prev, pendingInvitations: prev.pendingInvitations - 1 }));
      Alert.alert(t('admin.invitation_cancelled_title', { defaultValue: '❌ Invitation Cancelled' }), t('admin.invitation_cancelled_desc', { defaultValue: 'The invitation has been cancelled.' }));
    }
  };

  const renderStatCard = (title: string, value: number, icon: string, color: string) => (
    <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
      <View style={styles.statHeader}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
      <Text style={[styles.statTitle, { color: theme.textSecondary }]}>{title}</Text>
    </View>
  );

  const renderUserRow = (user: EnhancedUser) => {
    const isOnline = user.lastLogin && user.lastLogin > new Date(Date.now() - 300000); // Online if active in last 5 minutes
    const lastSeen = user.lastLogin ? formatTimeAgo(user.lastLogin) : 'Never';

    return (
      <View key={user.id} style={[styles.userRow, { backgroundColor: theme.surface }]}>
        <View style={styles.userInfo}>
          <View style={[styles.userAvatar, { backgroundColor: theme.primary }]}>
            <Text style={[styles.avatarText, { color: theme.onPrimary }]}>
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, { color: theme.text }]}>
                {user.firstName} {user.lastName}
              </Text>
              {isOnline && <View style={[styles.onlineIndicator, { backgroundColor: theme.success }]} />}
            </View>
            <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
              {user.email}
            </Text>
            <View style={styles.userMeta}>
              <View style={[styles.roleBadge, { 
                backgroundColor: user.role === 'principal' ? theme.primary : 
                                user.role === 'teacher' ? theme.secondary : theme.accent
              }]}>
                <Text style={[styles.roleText, { 
                  color: user.role === 'principal' ? theme.onPrimary : 
                         user.role === 'teacher' ? theme.onSecondary : theme.onPrimary
                }]}>
                  {user.role.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.lastSeen, { color: theme.textTertiary }]}>
                {t('admin.last_seen', { defaultValue: 'Last seen' })}: {lastSeen}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.userActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.primaryLight + '20' }]}
            onPress={() => handleUserAction(user.id, 'Edit')}
          >
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.errorLight + '20' }]}
            onPress={() => handleUserAction(user.id, 'Delete')}
          >
            <Text style={[styles.actionButtonText, { color: theme.error }]}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderActivityRow = (event: SecurityEvent) => {
    const riskColor = event.riskLevel === 'high' ? theme.error : 
                     event.riskLevel === 'medium' ? theme.warning : theme.success;
    const eventIcon = event.type === 'login_success' ? '✅' :
                     event.type === 'login_failure' ? '❌' :
                     event.type === 'invitation_sent' ? '📧' : '📝';

    return (
      <View key={event.id} style={[styles.activityRow, { backgroundColor: theme.surface }]}>
        <Text style={styles.activityIcon}>{eventIcon}</Text>
        <View style={styles.activityContent}>
          <Text style={[styles.activityTitle, { color: theme.text }]}>
            {event.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Text>
          <Text style={[styles.activityDetails, { color: theme.textSecondary }]}>
            {event.email} • {event.ipAddress} • {formatTimeAgo(event.timestamp)}
          </Text>
        </View>
        <View style={[styles.riskBadge, { backgroundColor: riskColor + '20' }]}>
          <Text style={[styles.riskText, { color: riskColor }]}>
            {event.riskLevel.toUpperCase()}
          </Text>
        </View>
      </View>
    );
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('time.just_now', { defaultValue: 'Just now' });
    if (diffMins < 60) return t('time.minutes_short_ago', { count: diffMins, defaultValue: '{{count}}m ago' });
    if (diffHours < 24) return t('time.hours_short_ago', { count: diffHours, defaultValue: '{{count}}h ago' });
    return t('time.days_short_ago', { count: diffDays, defaultValue: '{{count}}d ago' });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.background} 
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t('admin.header.title', { defaultValue: '🎛️ Admin Dashboard' })}
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          {t('admin.header.subtitle', { defaultValue: 'Real-time school management' })}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            {renderStatCard(t('admin.stats.total_users', { defaultValue: 'Total Users' }), stats.totalUsers, '👥', theme.primary)}
            {renderStatCard(t('admin.stats.active_today', { defaultValue: 'Active Today' }), stats.activeUsers, '🟢', theme.success)}
          </View>
          <View style={styles.statsRow}>
            {renderStatCard(t('admin.stats.pending_invites', { defaultValue: 'Pending Invites' }), stats.pendingInvitations, '📤', theme.warning)}
            {renderStatCard(t('admin.stats.security_alerts', { defaultValue: 'Security Alerts' }), stats.securityAlerts, '⚠️', theme.error)}
          </View>
        </View>

        {/* User Management Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTitleChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t('admin.user_management.title', { defaultValue: '👥 User Management' })}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={() => Alert.alert(t('admin.add_user_title', { defaultValue: 'Add User' }), t('common.coming_soon', { defaultValue: 'Coming Soon' }))}
            >
              <Text style={[styles.addButtonText, { color: theme.onPrimary }]}>{t('admin.add_user_btn', { defaultValue: '+ Add User' })}</Text>
            </TouchableOpacity>
          </View>
          
          {users.map(renderUserRow)}
        </View>

        {/* Pending Invitations */}
        <View style={styles.section}>
          <View style={[styles.sectionTitleChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('admin.pending_invitations', { defaultValue: '📤 Pending Invitations' })}
            </Text>
          </View>
          
          {invitations.filter(inv => inv.status === 'pending').map(invitation => (
            <View key={invitation.id} style={[styles.invitationRow, { backgroundColor: theme.surface }]}>
              <View style={styles.invitationInfo}>
                <Text style={[styles.invitationEmail, { color: theme.text }]}>
                  {invitation.email}
                </Text>
                <Text style={[styles.invitationRole, { color: theme.textSecondary }]}>
                  {invitation.role} • {t('admin.sent', { defaultValue: 'Sent' })} {formatTimeAgo(invitation.sentDate)}
                </Text>
              </View>
              <View style={styles.invitationActions}>
                <TouchableOpacity
                  style={[styles.inviteActionButton, { backgroundColor: theme.primary }]}
                  onPress={() => handleInvitationAction(invitation.id, 'Resend')}
                >
                  <Text style={[styles.inviteActionText, { color: theme.onPrimary }]}>
                    {t('admin.resend', { defaultValue: '📤 Resend' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inviteActionButton, { backgroundColor: theme.error }]}
                  onPress={() => handleInvitationAction(invitation.id, 'Cancel')}
                >
                  <Text style={[styles.inviteActionText, { color: theme.onError }]}>
                    {t('admin.cancel', { defaultValue: '❌ Cancel' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={[styles.sectionTitleChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('admin.recent_activity', { defaultValue: '📊 Recent Activity' })}
            </Text>
          </View>
          
          {activity.slice(0, 5).map(renderActivityRow)}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={[styles.sectionTitleChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('admin.quick_actions', { defaultValue: '⚡ Quick Actions' })}
            </Text>
          </View>
          
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: theme.primary }]}
              onPress={() => Alert.alert(t('admin.security_settings_title', { defaultValue: '🔐 Security Settings' }), t('admin.opening_security', { defaultValue: 'Opening security management...' }))}
            >
              <Text style={styles.quickActionIcon}>🔐</Text>
              <Text style={[styles.quickActionText, { color: theme.onPrimary }]}>
                {t('admin.security_settings_label', { defaultValue: 'Security Settings' })}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: theme.secondary }]}
              onPress={() => Alert.alert(t('admin.analytics_title', { defaultValue: '📊 Analytics' }), t('admin.opening_analytics', { defaultValue: 'Opening analytics dashboard...' }))}
            >
              <Text style={styles.quickActionIcon}>📊</Text>
              <Text style={[styles.quickActionText, { color: theme.onSecondary }]}>
                {t('admin.view_analytics', { defaultValue: 'View Analytics' })}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: theme.accent }]}
              onPress={() => Alert.alert(t('admin.backup_title', { defaultValue: '💾 Backup' }), t('admin.starting_backup', { defaultValue: 'Starting system backup...' }))}
            >
              <Text style={styles.quickActionIcon}>💾</Text>
              <Text style={[styles.quickActionText, { color: theme.onPrimary }]}>
                {t('admin.system_backup_label', { defaultValue: 'System Backup' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    padding: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  statHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statTitle: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'left',
    marginBottom: 12,
  },
  sectionTitleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  userEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
  },
  lastSeen: {
    fontSize: 12,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
  },
  invitationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationEmail: {
    fontSize: 16,
    fontWeight: '500',
  },
  invitationRole: {
    fontSize: 14,
    marginTop: 2,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  inviteActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inviteActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  activityIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  activityDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    minWidth: '30%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 40,
  },
});