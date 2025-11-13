import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth, usePermissions } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DesktopLayoutProps {
  children: React.ReactNode;
  role?: 'principal' | 'teacher' | 'parent' | 'super_admin';
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  roles?: string[];
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  // Dashboard items
  { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline', route: '/screens/principal-dashboard', roles: ['principal'] },
  { id: 'teacher-dash', label: 'Dashboard', icon: 'grid-outline', route: '/screens/teacher-dashboard', roles: ['teacher'] },
  { id: 'parent-dash', label: 'Dashboard', icon: 'grid-outline', route: '/screens/parent-dashboard', roles: ['parent'] },
  { id: 'super-admin-dash', label: 'Dashboard', icon: 'shield-checkmark-outline', route: '/screens/super-admin-dashboard', roles: ['super_admin'] },
  
  // Principal/Teacher items
  { id: 'students', label: 'Students', icon: 'people-outline', route: '/screens/student-management', roles: ['principal', 'teacher'] },
  { id: 'teachers', label: 'Teachers', icon: 'school-outline', route: '/screens/teacher-management', roles: ['principal'] },
  { id: 'classes', label: 'Classes', icon: 'book-outline', route: '/screens/class-details', roles: ['principal', 'teacher'] },
  { id: 'attendance', label: 'Attendance', icon: 'checkmark-circle-outline', route: '/screens/attendance', roles: ['principal', 'teacher'] },
  { id: 'messages', label: 'Messages', icon: 'mail-outline', route: '/screens/teacher-messages', roles: ['principal', 'teacher'] },
  { id: 'financials', label: 'Financials', icon: 'cash-outline', route: '/screens/financial-dashboard', roles: ['principal'] },
  { id: 'reports', label: 'Reports', icon: 'document-text-outline', route: '/screens/teacher-reports', roles: ['principal', 'teacher'] },
  
  // Parent items
  { id: 'parent-messages', label: 'Messages', icon: 'mail-outline', route: '/screens/parent-messages', roles: ['parent'] },
  { id: 'children', label: 'My Children', icon: 'heart-outline', route: '/screens/parent-children', roles: ['parent'] },
  
  // Super Admin items
  { id: 'users', label: 'Users', icon: 'people-circle-outline', route: '/screens/super-admin-users', roles: ['super_admin'] },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'card-outline', route: '/screens/super-admin-subscriptions', roles: ['super_admin'] },
  { id: 'analytics', label: 'Analytics', icon: 'analytics-outline', route: '/screens/super-admin-analytics', roles: ['super_admin'] },
  { id: 'monitoring', label: 'Monitoring', icon: 'pulse-outline', route: '/screens/super-admin-system-monitoring', roles: ['super_admin'] },
  { id: 'ai-quotas', label: 'AI Quotas', icon: 'flash-outline', route: '/screens/super-admin-ai-quotas', roles: ['super_admin'] },
  
  // Common items
  { id: 'settings', label: 'Settings', icon: 'settings-outline', route: '/screens/settings', roles: ['principal', 'teacher', 'parent', 'super_admin'] },
];

/**
 * DesktopLayout - PWA-optimized layout with side navigation
 * 
 * Features:
 * - Collapsible side navigation (240px expanded, 64px collapsed)
 * - Role-based navigation items
 * - Active route highlighting
 * - Keyboard shortcuts (Cmd/Ctrl + K for search)
 * - Responsive breakpoints (hides on mobile < 768px)
 * - Theme-aware styling
 * 
 * Usage:
 * <DesktopLayout role="principal">
 *   <YourScreenContent />
 * </DesktopLayout>
 */
export function DesktopLayout({ children, role }: DesktopLayoutProps) {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const permissions = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Determine user role from profile if not provided
  const userRole = role || (profile?.role as string) || 'parent';
  
  // Filter nav items by role
  const filteredNavItems = NAV_ITEMS.filter(item => 
    !item.roles || item.roles.includes(userRole)
  );

  // Check if current route matches nav item
  const isActive = (route: string) => {
    return pathname === route || pathname?.startsWith(route);
  };

  const styles = React.useMemo(() => createStyles(theme, sidebarCollapsed, insets), [theme, sidebarCollapsed, insets]);

  // Resolve tenant slug from enhanced profile (organization membership)
  const org: any = (permissions as any)?.enhancedProfile?.organization_membership || {};
  const tenantSlug: string = org?.organization_slug || org?.tenant_slug || org?.slug || org?.organization_name || 'EduDash Pro';

  // Only render desktop layout on web
  // On mobile, wrap in flex container to ensure bottom nav is visible
  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {children}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Side Navigation - Hidden on mobile via CSS */}
      <View style={styles.sidebar}>
        {/* Logo & Toggle */}
        <View style={styles.sidebarHeader}>
          {!sidebarCollapsed && (
            <View style={styles.logoContainer}>
              <Ionicons name="school" size={28} color={theme.primary} />
              <Text style={styles.logoText} numberOfLines={1}>{tenantSlug}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Ionicons
              name={sidebarCollapsed ? 'chevron-forward' : 'chevron-back'}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Navigation Items */}
        <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.navItems}>
            {filteredNavItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.navItem,
                  isActive(item.route) && styles.navItemActive,
                ]}
                onPress={() => router.push(item.route as any)}
              >
                <Ionicons
                  name={item.icon as any}
                  size={22}
                  color={isActive(item.route) ? theme.primary : theme.textSecondary}
                />
                {!sidebarCollapsed && (
                  <>
                    <Text
                      style={[
                        styles.navItemText,
                        isActive(item.route) && styles.navItemTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.badge && item.badge > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Powered by (above separator line) */}
        {!sidebarCollapsed && (
          <View style={styles.poweredByBar}>
            <Text style={styles.poweredBy} numberOfLines={1}>Powered by EduDash Pro</Text>
          </View>
        )}

        {/* User Profile Footer */}
        <View style={styles.sidebarFooter}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/screens/account')}
          >
            <Avatar
              name={`${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim() || user?.email || 'User'}
              imageUri={(profile as any)?.avatar_url || null}
              size={sidebarCollapsed ? 36 : 40}
            />
            {!sidebarCollapsed && (
              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {user?.user_metadata?.first_name || 'User'}
                </Text>
                <Text style={styles.profileRole} numberOfLines={1}>
                  {userRole}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {children}
      </View>
    </View>
  );
}

const createStyles = (theme: any, collapsed: boolean, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: theme.background,
      minHeight: '100vh' as any,
    },
    sidebar: {
      width: collapsed ? 64 : 240,
      backgroundColor: theme.surface,
      borderRightWidth: 1,
      borderRightColor: theme.border,
      flexDirection: 'column',
      transition: 'width 0.3s ease' as any,
      // Hide on mobile screens
      ['@media (max-width: 767px)' as any]: {
        display: 'none' as any,
      },
    },
    sidebarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      paddingTop: insets.top + 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    logoText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    collapseButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.surfaceVariant,
    },
    navScroll: {
      flex: 1,
    },
    navItems: {
      padding: 12,
      gap: 4,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      gap: 12,
      cursor: 'pointer' as any,
      transition: 'background-color 0.2s ease' as any,
    },
    navItemActive: {
      backgroundColor: theme.primaryLight + '20',
    },
    navItemText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    navItemTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    badge: {
      backgroundColor: theme.error,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 2,
      minWidth: 20,
      alignItems: 'center',
    },
    badgeText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '600',
    },
    sidebarFooter: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      padding: 12,
    },
    poweredByBar: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    poweredBy: {
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'center' as any,
    },
    profileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 10,
      gap: 12,
      cursor: 'pointer' as any,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 2,
    },
    profileRole: {
      fontSize: 12,
      color: theme.textSecondary,
      textTransform: 'capitalize' as any,
    },
    mainContent: {
      flex: 1,
      overflow: 'hidden' as any,
      // Full width on mobile
      ['@media (max-width: 767px)' as any]: {
        width: '100%' as any,
      },
    },
  });
