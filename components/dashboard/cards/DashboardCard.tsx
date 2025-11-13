import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export interface DashboardCardProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  children: React.ReactNode;
  loading?: boolean;
  error?: string;
}

export function DashboardCard({
  title,
  icon,
  onPress,
  children,
  loading,
  error,
}: DashboardCardProps) {
  const { theme } = useTheme();

  const cardContent = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {icon && (
            <Ionicons name={icon} size={20} color={theme.colors.primary} style={styles.icon} />
          )}
          <ThemedText
            style={[styles.title, onPress && styles.linkTitle, onPress && { color: theme.colors.primary }]}
            accessibilityRole={onPress ? 'link' : undefined}
          >
            {title}
          </ThemedText>
          {onPress && (
            <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} style={styles.chevron} />
          )}
        </View>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ThemedText style={styles.placeholder}>Loading...</ThemedText>
        ) : error ? (
          <ThemedText style={[styles.placeholder, { color: theme.colors.error }]}>
            {error}
          </ThemedText>
        ) : (
          children
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkTitle: {
    textDecorationLine: 'underline',
  },
  chevron: {
    marginLeft: 6,
  },
  content: {
    minHeight: 60,
  },
  placeholder: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
