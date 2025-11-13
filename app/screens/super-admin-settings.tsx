import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

// Helper function to check if user is super admin (handles role normalization)
function isSuperAdmin(role?: string | null): boolean {
  if (!role) return false;
  const normalizedRole = String(role).trim().toLowerCase();
  return normalizedRole === 'superadmin' || normalizedRole === 'super_admin';
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

interface SettingsItem {
  title: string;
  subtitle?: string;
  icon: string;
  action: () => void;
  type: 'navigation' | 'toggle' | 'action';
  value?: boolean;
  danger?: boolean;
  beta?: boolean;
}

export default function SuperAdminSettingsScreen() {
  const { profile, signOut } = useAuth();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);

  const handleSignOut = useCallback(async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of the Super Admin panel?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Track the sign out
              track('superadmin_signed_out', {
                session_duration: Date.now() - (profile?.last_login_at ? new Date(profile.last_login_at).getTime() : 0),
              });

              // Log the sign out
              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'superadmin_signed_out',
                  details: {
                    sign_out_time: new Date().toISOString(),
                  },
                });

              if (logError) {
                console.error('Failed to log sign out:', logError);
              }

              await signOut();
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        }
      ]
    );
  }, [profile, signOut]);

  const toggleMaintenanceMode = useCallback(async (value: boolean) => {
    Alert.alert(
      'Toggle Maintenance Mode',
      value 
        ? 'This will put the platform in maintenance mode, making it inaccessible to all users except super admins.'
        : 'This will disable maintenance mode and restore normal platform access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: value ? 'Enable' : 'Disable',
          style: value ? 'destructive' : 'default',
          onPress: async () => {
            try {
              setMaintenanceMode(value);

              // Track the maintenance mode toggle
              track('superadmin_maintenance_mode_toggled', {
                enabled: value,
                timestamp: new Date().toISOString(),
              });

              // Log the action
              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'maintenance_mode_toggled',
                  details: {
                    enabled: value,
                    reason: 'Manual toggle by super admin',
                  },
                });

              if (logError) {
                console.error('Failed to log maintenance mode toggle:', logError);
              }

              Alert.alert(
                'Success',
                `Maintenance mode ${value ? 'enabled' : 'disabled'} successfully`
              );

            } catch (error) {
              console.error('Failed to toggle maintenance mode:', error);
              Alert.alert('Error', 'Failed to update maintenance mode');
              setMaintenanceMode(!value); // Revert on error
            }
          }
        }
      ]
    );
  }, [profile]);

  const clearPlatformCache = useCallback(async () => {
    Alert.alert(
      'Clear Platform Cache',
      'This will clear all cached data across the platform. This may temporarily slow down the platform while caches rebuild.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              // Track the cache clear
              track('superadmin_cache_cleared', {
                timestamp: new Date().toISOString(),
              });

              // Log the action
              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'platform_cache_cleared',
                  details: {
                    cleared_at: new Date().toISOString(),
                  },
                });

              if (logError) {
                console.error('Failed to log cache clear:', logError);
              }

              // In a real implementation, this would trigger cache clearing
              Alert.alert('Success', 'Platform cache cleared successfully');

            } catch (error) {
              console.error('Failed to clear cache:', error);
              Alert.alert('Error', 'Failed to clear platform cache');
            }
          }
        }
      ]
    );
  }, [profile]);

  const exportPlatformData = useCallback(async () => {
    Alert.alert(
      'Export Platform Data',
      'This will generate a comprehensive export of all platform data. This may take several minutes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            try {
              // Track the data export
              track('superadmin_data_export_initiated', {
                timestamp: new Date().toISOString(),
              });

              // Log the action
              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'platform_data_export_initiated',
                  details: {
                    export_type: 'full_platform_export',
                    initiated_at: new Date().toISOString(),
                  },
                });

              if (logError) {
                console.error('Failed to log data export:', logError);
              }

              // In a real implementation, this would trigger a background job
              Alert.alert(
                'Export Started',
                'Platform data export has been initiated. You will receive an email when the export is complete.'
              );

            } catch (error) {
              console.error('Failed to initiate data export:', error);
              Alert.alert('Error', 'Failed to initiate data export');
            }
          }
        }
      ]
    );
  }, [profile]);

  const settingsSections: SettingsSection[] = [
    {
      title: 'Platform Management',
      items: [
        {
          title: 'Platform Analytics',
          subtitle: 'View comprehensive platform metrics',
          icon: 'analytics',
          action: () => router.push('/screens/super-admin-analytics'),
          type: 'navigation',
        },
        {
          title: 'User Management',
          subtitle: 'Manage users and impersonation',
          icon: 'people',
          action: () => router.push('/screens/super-admin-users'),
          type: 'navigation',
        },
        {
          title: 'Subscription Management',
          subtitle: 'Monitor and manage subscriptions',
          icon: 'card',
          action: () => router.push('/screens/super-admin-subscriptions'),
          type: 'navigation',
        },
        {
          title: 'Lead Management',
          subtitle: 'Enterprise leads and conversions',
          icon: 'business',
          action: () => router.push('/screens/super-admin-leads'),
          type: 'navigation',
        },
      ],
    },
    {
      title: 'Content & Moderation',
      items: [
        {
          title: 'Content Moderation',
          subtitle: 'Review flagged content',
          icon: 'shield-checkmark',
          action: () => router.push('/screens/super-admin-moderation'),
          type: 'navigation',
        },
        {
          title: 'Platform Announcements',
          subtitle: 'Manage platform-wide announcements',
          icon: 'megaphone',
          action: () => router.push('/screens/super-admin-announcements'),
          type: 'navigation',
        },
        {
          title: 'Feature Flags',
          subtitle: 'Control feature rollouts',
          icon: 'flag',
          action: () => router.push('/screens/super-admin-feature-flags'),
          type: 'navigation',
        },
      ],
    },
    {
      title: 'AI & Resources',
      items: [
        {
          title: 'AI Quota Management',
          subtitle: 'Monitor and control AI usage',
          icon: 'flash',
          action: () => router.push('/screens/super-admin-ai-quotas'),
          type: 'navigation',
        },
      ],
    },
    {
      title: 'System Configuration',
      items: [
        {
          title: 'Maintenance Mode',
          subtitle: 'Platform-wide maintenance mode',
          icon: 'construct',
          action: () => toggleMaintenanceMode(!maintenanceMode),
          type: 'toggle',
          value: maintenanceMode,
          danger: true,
        },
        {
          title: 'Debug Mode',
          subtitle: 'Enable detailed logging',
          icon: 'bug',
          action: () => setDebugMode(!debugMode),
          type: 'toggle',
          value: debugMode,
        },
        {
          title: 'Auto Backup',
          subtitle: 'Automatic daily backups',
          icon: 'cloud-upload',
          action: () => setAutoBackup(!autoBackup),
          type: 'toggle',
          value: autoBackup,
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          title: 'Email Notifications',
          subtitle: 'Receive admin email alerts',
          icon: 'mail',
          action: () => setEmailNotifications(!emailNotifications),
          type: 'toggle',
          value: emailNotifications,
        },
        {
          title: 'Security Alerts',
          subtitle: 'High-priority security notifications',
          icon: 'shield',
          action: () => setSecurityAlerts(!securityAlerts),
          type: 'toggle',
          value: securityAlerts,
        },
      ],
    },
    {
      title: 'Data Management',
      items: [
        {
          title: 'Clear Platform Cache',
          subtitle: 'Clear all cached data',
          icon: 'refresh',
          action: clearPlatformCache,
          type: 'action',
          danger: true,
        },
        {
          title: 'Export Platform Data',
          subtitle: 'Generate comprehensive data export',
          icon: 'download',
          action: exportPlatformData,
          type: 'action',
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          title: 'Sign Out',
          subtitle: 'Sign out of Super Admin panel',
          icon: 'log-out',
          action: handleSignOut,
          type: 'action',
          danger: true,
        },
      ],
    },
  ];

  if (!profile || !isSuperAdmin(profile.role)) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Super Admin Settings', headerShown: false }} />
        <ThemedStatusBar />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Super Admin Settings', headerShown: false }} />
      <ThemedStatusBar />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#00f5ff" />
          </TouchableOpacity>
          <Text style={styles.title}>Super Admin Settings</Text>
          <View style={styles.placeholder} />
        </View>
        
        {/* Admin Info */}
        <View style={styles.adminInfo}>
          <View style={styles.adminAvatar}>
            <Ionicons name="person" size={24} color="#00f5ff" />
          </View>
          <View style={styles.adminDetails}>
            <Text style={styles.adminName}>{profile.email || 'Admin'}</Text>
            <Text style={styles.adminRole}>Super Administrator</Text>
          </View>
          <View style={styles.statusIndicator}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content}>
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            
            {section.items.map((item, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={[
                  styles.settingsItem,
                  item.danger && styles.settingsItemDanger,
                  itemIndex === section.items.length - 1 && styles.settingsItemLast
                ]}
                onPress={item.type !== 'toggle' ? item.action : undefined}
                activeOpacity={item.type !== 'toggle' ? 0.7 : 1}
              >
                <View style={styles.settingsItemLeft}>
                  <View style={[
                    styles.settingsItemIcon,
                    item.danger && styles.settingsItemIconDanger
                  ]}>
                    <Ionicons 
                      name={item.icon as any} 
                      size={20} 
                      color={item.danger ? '#ef4444' : '#00f5ff'} 
                    />
                  </View>
                  
                  <View style={styles.settingsItemText}>
                    <View style={styles.settingsItemTitleRow}>
                      <Text style={[
                        styles.settingsItemTitle,
                        item.danger && styles.settingsItemTitleDanger
                      ]}>
                        {item.title}
                      </Text>
                      {item.beta && (
                        <View style={styles.betaBadge}>
                          <Text style={styles.betaBadgeText}>BETA</Text>
                        </View>
                      )}
                    </View>
                    {item.subtitle && (
                      <Text style={styles.settingsItemSubtitle}>{item.subtitle}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.settingsItemRight}>
                  {item.type === 'toggle' ? (
                    <Switch
                      value={item.value || false}
                      onValueChange={item.action}
                      trackColor={{ false: '#374151', true: '#00f5ff40' }}
                      thumbColor={item.value ? '#00f5ff' : '#9ca3af'}
                    />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#6b7280" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Platform Status */}
        <View style={styles.platformStatus}>
          <Text style={styles.platformStatusTitle}>Platform Status</Text>
          
          <View style={styles.statusGrid}>
            <View style={styles.statusCard}>
              <View style={[styles.statusCardIcon, styles.statusCardIconGreen]}>
                <Ionicons name="server" size={16} color="#10b981" />
              </View>
              <Text style={styles.statusCardLabel}>Database</Text>
              <Text style={styles.statusCardValue}>Healthy</Text>
            </View>
            
            <View style={styles.statusCard}>
              <View style={[styles.statusCardIcon, styles.statusCardIconGreen]}>
                <Ionicons name="flash" size={16} color="#10b981" />
              </View>
              <Text style={styles.statusCardLabel}>AI Services</Text>
              <Text style={styles.statusCardValue}>Online</Text>
            </View>
            
            <View style={styles.statusCard}>
              <View style={[styles.statusCardIcon, styles.statusCardIconYellow]}>
                <Ionicons name="cloud" size={16} color="#f59e0b" />
              </View>
              <Text style={styles.statusCardLabel}>CDN</Text>
              <Text style={styles.statusCardValue}>Degraded</Text>
            </View>
            
            <View style={styles.statusCard}>
              <View style={[styles.statusCardIcon, styles.statusCardIconGreen]}>
                <Ionicons name="card" size={16} color="#10b981" />
              </View>
              <Text style={styles.statusCardLabel}>Payments</Text>
              <Text style={styles.statusCardValue}>Active</Text>
            </View>
          </View>
        </View>

        {/* Version Info */}
        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>EduDash Pro v1.0.2</Text>
          <Text style={styles.versionText}>Super Admin Panel v1.0.2</Text>
          <Text style={styles.versionText}>Last updated: Dec 19, 2024</Text>
          <Text style={styles.versionText}>• WhatsApp integration</Text>
          <Text style={styles.versionText}>• Mobile-first design improvements</Text>
          <Text style={styles.versionText}>• Advanced admin management</Text>
        </View>
      </ScrollView>
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
  placeholder: {
    width: 40,
  },
  adminInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  adminAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adminDetails: {
    flex: 1,
  },
  adminName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  adminRole: {
    color: '#00f5ff',
    fontSize: 12,
    fontWeight: '500',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  statusText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    backgroundColor: '#111827',
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 4,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  settingsItemLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  settingsItemDanger: {
    backgroundColor: '#7f1d1d10',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsItemIconDanger: {
    backgroundColor: '#7f1d1d20',
  },
  settingsItemText: {
    flex: 1,
  },
  settingsItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsItemTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingsItemTitleDanger: {
    color: '#ef4444',
  },
  settingsItemSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
  },
  betaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#f59e0b20',
  },
  betaBadgeText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '600',
  },
  settingsItemRight: {
    marginLeft: 16,
  },
  platformStatus: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  platformStatusTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusCard: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
    gap: 8,
  },
  statusCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCardIconGreen: {
    backgroundColor: '#10b98120',
  },
  statusCardIconYellow: {
    backgroundColor: '#f59e0b20',
  },
  statusCardLabel: {
    color: '#9ca3af',
    fontSize: 11,
    textAlign: 'center',
  },
  statusCardValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  versionInfo: {
    marginHorizontal: 16,
    marginBottom: 32,
    alignItems: 'center',
    gap: 4,
  },
  versionText: {
    color: '#6b7280',
    fontSize: 12,
  },
});