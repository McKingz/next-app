import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { marketingTokens } from '../tokens';
import { useResponsive } from '../useResponsive';

const badges = [
  { icon: 'checkmark.shield.fill', label: 'COPPA Compliant' },
  { icon: 'lock.shield.fill', label: 'Bank-Level Security' },
  { icon: 'globe', label: 'South African Built' },
  { icon: 'star.fill', label: '5-Star Rated' },
];

export function TrustBadgesSection() {
  const { padX } = useResponsive();

  return (
    <View style={[styles.container, { paddingHorizontal: padX }]}>
      <View style={styles.badgesContainer}>
        {badges.map((badge, index) => (
          <View key={index} style={styles.badge}>
            <IconSymbol 
              name={badge.icon as any} 
              size={28} 
              color={marketingTokens.colors.accent.cyan400} 
            />
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: marketingTokens.spacing['3xl'],
    backgroundColor: marketingTokens.colors.bg.elevated,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: marketingTokens.spacing.xl,
  },
  badge: {
    alignItems: 'center',
    minWidth: 100,
    opacity: 0.8,
  },
  badgeText: {
    ...marketingTokens.typography.caption,
    fontSize: 11,
    color: marketingTokens.colors.fg.secondary,
    marginTop: marketingTokens.spacing.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
});
