import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

/**
 * Calendar Screen - Shared across all roles
 * 
 * Shows upcoming events, schedules, and important dates
 * for parents, teachers, and principals
 */
export default function CalendarScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const userRole = (profile?.role as string) || 'parent';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.primaryLight + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    featureList: {
      width: '100%',
      maxWidth: 400,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    featureIcon: {
      marginRight: 16,
    },
    featureText: {
      fontSize: 15,
      color: theme.text,
      flex: 1,
    },
    badge: {
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.onPrimary,
    },
  });

  const upcomingFeatures = [
    { icon: 'calendar-outline', text: 'View monthly calendar', coming: false },
    { icon: 'time-outline', text: 'Schedule events and reminders', coming: true },
    { icon: 'notifications-outline', text: 'Event notifications', coming: true },
    { icon: 'people-outline', text: 'Shared calendar with team', coming: true },
    { icon: 'repeat-outline', text: 'Recurring events', coming: true },
  ];

  return (
    <DesktopLayout role={userRole as any}>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <RoleBasedHeader 
          title={t('navigation.calendar', { defaultValue: 'Calendar' })} 
          showBackButton={false} 
        />
        
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="calendar" size={64} color={theme.primary} />
          </View>

          <Text style={styles.title}>
            {t('calendar.coming_soon_title', { defaultValue: 'Calendar Coming Soon' })}
          </Text>
          
          <Text style={styles.subtitle}>
            {t('calendar.coming_soon_message', { 
              defaultValue: 'Stay organized with our upcoming calendar feature. Track events, schedules, and important dates all in one place.' 
            })}
          </Text>

          <View style={styles.featureList}>
            {upcomingFeatures.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons 
                  name={feature.icon as any} 
                  size={24} 
                  color={feature.coming ? theme.textSecondary : theme.primary}
                  style={styles.featureIcon}
                />
                <Text 
                  style={[
                    styles.featureText, 
                    feature.coming && { color: theme.textSecondary }
                  ]}
                >
                  {feature.text}
                </Text>
                {feature.coming && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>SOON</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </DesktopLayout>
  );
}
