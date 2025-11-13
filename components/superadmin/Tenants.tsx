import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { WireframeCard } from '@/components/wireframes/NavigationShells';

interface TenantsProps {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const Tenants: React.FC<TenantsProps> = () => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <WireframeCard 
        title="Organization Management"
        actions={[
          { 
            label: 'Manage Subscriptions', 
            onPress: () => router.push('/screens/super-admin-subscriptions'),
            primary: true 
          },
          { 
            label: 'User Management', 
            onPress: () => router.push('/screens/super-admin-users') 
          },
        ]}
      >
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          Manage schools, organizations, and their subscriptions across the platform.
        </Text>
        <Text style={[styles.hint, { color: theme.textTertiary }]}>
          Hint: Subscriptions are managed here (removed from the Sales tab).
        </Text>
      </WireframeCard>

      <WireframeCard title="Quick Actions">
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push('/screens/super-admin-users')}
          >
            <Text style={[styles.actionButtonText, { color: theme.onPrimary }]}>👥 Users</Text>
          </TouchableOpacity>
        </View>
      </WireframeCard>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
});

export default Tenants;