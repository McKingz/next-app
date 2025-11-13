import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface TabItem {
  id: string;
  label: string;
  icon: string;
  activeIcon: string;
  route: string;
  roles?: string[];
}

const TAB_ITEMS: TabItem[] = [
  // Parent tabs
  { 
    id: 'parent-dashboard', 
    label: 'Home', 
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/parent-dashboard', 
    roles: ['parent'] 
  },
  { 
    id: 'parent-children', 
    label: 'Children', 
    icon: 'heart-outline', 
    activeIcon: 'heart', 
    route: '/screens/parent-children', 
    roles: ['parent'] 
  },
  { 
    id: 'parent-messages', 
    label: 'Messages', 
    icon: 'chatbubble-outline', 
    activeIcon: 'chatbubble', 
    route: '/screens/parent-messages', 
    roles: ['parent'] 
  },
  { 
    id: 'parent-calendar', 
    label: 'Calendar', 
    icon: 'calendar-outline', 
    activeIcon: 'calendar', 
    route: '/screens/calendar', 
    roles: ['parent'] 
  },
  { 
    id: 'parent-settings', 
    label: 'Settings', 
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/settings', 
    roles: ['parent'] 
  },
  
  // Teacher tabs
  { 
    id: 'teacher-dashboard', 
    label: 'Home', 
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/teacher-dashboard', 
    roles: ['teacher'] 
  },
  { 
    id: 'students', 
    label: 'Students', 
    icon: 'people-outline', 
    activeIcon: 'people', 
    route: '/screens/student-management', 
    roles: ['teacher'] 
  },
  { 
    id: 'teacher-messages', 
    label: 'Messages', 
    icon: 'chatbubble-outline', 
    activeIcon: 'chatbubble', 
    route: '/screens/teacher-messages', 
    roles: ['teacher'] 
  },
  { 
    id: 'teacher-calendar', 
    label: 'Calendar', 
    icon: 'calendar-outline', 
    activeIcon: 'calendar', 
    route: '/screens/calendar', 
    roles: ['teacher'] 
  },
  { 
    id: 'teacher-settings', 
    label: 'Settings', 
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/settings', 
    roles: ['teacher'] 
  },
  
  // Principal tabs
  { 
    id: 'principal-dashboard', 
    label: 'Home', 
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/principal-dashboard', 
    roles: ['principal', 'principal_admin'] 
  },
  { 
    id: 'principal-students', 
    label: 'Students', 
    icon: 'people-outline', 
    activeIcon: 'people', 
    route: '/screens/student-management', 
    roles: ['principal', 'principal_admin'] 
  },
  { 
    id: 'principal-messages', 
    label: 'Messages', 
    icon: 'chatbubble-outline', 
    activeIcon: 'chatbubble', 
    route: '/screens/teacher-messages', 
    roles: ['principal', 'principal_admin'] 
  },
  { 
    id: 'principal-reports', 
    label: 'Reports', 
    icon: 'document-text-outline', 
    activeIcon: 'document-text', 
    route: '/screens/teacher-reports', 
    roles: ['principal', 'principal_admin'] 
  },
  { 
    id: 'principal-settings', 
    label: 'Settings', 
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/settings', 
    roles: ['principal', 'principal_admin'] 
  },
];

export function BottomTabBar() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Determine user role
  const userRole = (profile?.role as string) || 'parent';
  
  // Filter tabs by role
  const visibleTabs = TAB_ITEMS.filter(
    item => !item.roles || item.roles.includes(userRole)
  );

  // Check if current route matches tab
  const isActive = (route: string) => {
    return pathname === route || pathname?.startsWith(route);
  };

  // Don't show on web (DesktopLayout handles navigation)
  if (Platform.OS === 'web') {
    return null;
  }

  // Don't show on auth/onboarding/landing screens only
  const shouldHide = 
    !pathname ||
    pathname === '/' ||
    pathname.includes('/(auth)') ||
    pathname.includes('/sign-in') ||
    pathname.includes('/register') ||
    pathname.includes('/landing') ||
    pathname.includes('/onboarding') ||
    pathname.includes('/auth-callback') ||
    pathname.includes('/invite/');

  if (shouldHide) {
    return null;
  }

  // Safety check: if no tabs are visible, don't render
  if (visibleTabs.length === 0) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingBottom: insets.bottom,
      paddingTop: 8,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      minHeight: 56,
    },
    iconContainer: {
      marginBottom: 4,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
      marginTop: 2,
    },
    labelActive: {
      color: theme.primary,
    },
  });

  return (
    <View style={styles.container}>
      {visibleTabs.map((tab) => {
        const active = isActive(tab.route);
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={(active ? tab.activeIcon : tab.icon) as any}
                size={24}
                color={active ? theme.primary : theme.textSecondary}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>
              {t(`navigation.${tab.label.toLowerCase()}`, { defaultValue: tab.label })}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
