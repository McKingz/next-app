/**
 * TeacherQuickActionCard - Reusable quick action card component
 * 
 * Shared by both legacy and new enhanced teacher dashboards.
 * Displays an action button with icon, title, and optional subtitle.
 */

import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import Feedback from '@/lib/feedback';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;
const containerWidth = width - (cardPadding * 2);
const cardWidth = isTablet ? (containerWidth - (cardGap * 3)) / 4 : (containerWidth - cardGap) / 2;

interface TeacherQuickActionCardProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
  subtitle?: string;
  disabled?: boolean;
}

export const TeacherQuickActionCard: React.FC<TeacherQuickActionCardProps> = ({
  title,
  icon,
  color,
  onPress,
  subtitle,
  disabled
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const handlePress = async () => {
    if (disabled) return;
    try {
      await Feedback.vibrate(10);
      onPress();
    } catch {
      // Silently fail vibration
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.actionCard,
        disabled && styles.actionCardDisabled,
        { borderLeftColor: color, shadowColor: color }
      ]}
      onPress={handlePress}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons
          name={icon as any}
          size={isSmallScreen ? 20 : 24}
          color={disabled ? theme.textSecondary : color}
        />
      </View>
      <Text style={[styles.actionTitle, disabled && styles.actionTitleDisabled]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      )}
    </TouchableOpacity>
  );
};

const getStyles = (theme: any) => StyleSheet.create({
  actionCard: {
    width: cardWidth,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: cardPadding,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: cardGap / 2,
    marginBottom: cardGap,
    minHeight: isTablet ? 120 : isSmallScreen ? 90 : 100,
    borderLeftWidth: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    width: isSmallScreen ? 48 : 56,
    height: isSmallScreen ? 48 : 56,
    borderRadius: isSmallScreen ? 24 : 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: isTablet ? 16 : isSmallScreen ? 12 : 14,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  actionTitleDisabled: {
    color: theme.textSecondary,
  },
  actionSubtitle: {
    fontSize: isTablet ? 14 : isSmallScreen ? 10 : 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
});
