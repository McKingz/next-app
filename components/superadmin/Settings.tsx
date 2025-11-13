import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { WireframeCard } from '@/components/wireframes/NavigationShells';

interface SettingsProps {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const Settings: React.FC<SettingsProps> = () => {
  const { theme } = useTheme();

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <WireframeCard 
        title="Platform Configuration"
        actions={[
          { 
            label: 'Feature Flags', 
            onPress: () => router.push('/screens/super-admin-feature-flags'),
            primary: true 
          },
          { 
            label: 'System Settings', 
            onPress: () => router.push('/screens/super-admin-settings') 
          },
        ]}
      >
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          Manage platform-wide settings, feature toggles, and system configuration.
        </Text>
      </WireframeCard>

      <WireframeCard title="Management Tools">
        <View style={styles.toolsGrid}>
          <TouchableOpacity
            style={[styles.toolButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/screens/super-admin-feature-flags')}
          >
            <Text style={styles.toolEmoji}>🚩</Text>
            <Text style={[styles.toolText, { color: theme.text }]}>Feature Flags</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/screens/super-admin-settings')}
          >
            <Text style={styles.toolEmoji}>⚙️</Text>
            <Text style={[styles.toolText, { color: theme.text }]}>System Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/screens/super-admin-moderation')}
          >
            <Text style={styles.toolEmoji}>🛡️</Text>
            <Text style={[styles.toolText, { color: theme.text }]}>Moderation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/screens/super-admin-announcements')}
          >
            <Text style={styles.toolEmoji}>📢</Text>
            <Text style={[styles.toolText, { color: theme.text }]}>Announcements</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/screens/super-admin-ai-quotas')}
          >
            <Text style={styles.toolEmoji}>🤖</Text>
            <Text style={[styles.toolText, { color: theme.text }]}>AI Quotas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/screens/super-admin-analytics')}
          >
            <Text style={styles.toolEmoji}>📊</Text>
            <Text style={[styles.toolText, { color: theme.text }]}>Analytics</Text>
          </TouchableOpacity>
        </View>
      </WireframeCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toolButton: {
    width: '45%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  toolEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  toolText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default Settings;