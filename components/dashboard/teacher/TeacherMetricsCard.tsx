/**
 * TeacherMetricsCard - Reusable metric display component
 * 
 * Shared by both legacy and new enhanced teacher dashboards.
 * Displays a metric with icon, value, title, and optional trend indicator.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;
const containerWidth = width - (cardPadding * 2);
const cardWidth = isTablet ? (containerWidth - (cardGap * 3)) / 4 : (containerWidth - cardGap) / 2;

interface TeacherMetricsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: string;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export const TeacherMetricsCard: React.FC<TeacherMetricsCardProps> = ({
  title,
  value,
  icon,
  color,
  trend,
  onPress,
  size = 'medium'
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = getStyles(theme);

  return (
    <TouchableOpacity
      style={[
        styles.metricCard,
        size === 'large' && styles.metricCardLarge,
        size === 'small' && styles.metricCardSmall,
        { marginHorizontal: cardGap / 2, marginBottom: cardGap, borderLeftColor: color, shadowColor: color }
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.metricContent}>
        <View style={styles.metricHeader}>
          <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
            <Ionicons
              name={icon as any}
              size={isSmallScreen ? (size === 'large' ? 24 : 20) : (size === 'large' ? 28 : 24)}
              color={color}
            />
          </View>
          {trend && (
            <View style={styles.trendContainer}>
              <Text style={[styles.trendText, getTrendColor(trend, theme)]}>
                {getTrendIcon(trend)} {getTrendText(trend, t)}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Trend helper functions
export const getTrendColor = (trend: string, theme: any) => {
  switch (trend) {
    case 'up': case 'good': case 'excellent': case 'stable': return { color: theme.success };
    case 'warning': case 'attention': case 'high': return { color: theme.warning };
    case 'down': case 'low': case 'needs_attention': return { color: theme.error };
    default: return { color: theme.textSecondary };
  }
};

export const getTrendIcon = (trend: string): string => {
  switch (trend) {
    case 'up': case 'good': case 'excellent': return '↗️';
    case 'down': case 'low': return '↘️';
    case 'warning': case 'attention': case 'needs_attention': return '⚠️';
    default: return '➡️';
  }
};

export const getTrendText = (trend: string, t: any): string => {
  switch (trend) {
    case 'up': return t('trends.up', { defaultValue: 'Up' });
    case 'down': return t('trends.down', { defaultValue: 'Down' });
    case 'good': return t('trends.good', { defaultValue: 'Good' });
    case 'excellent': return t('trends.excellent', { defaultValue: 'Excellent' });
    case 'warning': return t('trends.warning', { defaultValue: 'Warning' });
    case 'attention': return t('trends.attention', { defaultValue: 'Attention' });
    case 'needs_attention': return t('trends.needs_attention', { defaultValue: 'Needs attention' });
    case 'low': return t('trends.low', { defaultValue: 'Low' });
    case 'stable': return t('trends.stable', { defaultValue: 'Stable' });
    case 'high': return t('trends.high', { defaultValue: 'High' });
    default: return trend;
  }
};

const getStyles = (theme: any) => StyleSheet.create({
  metricCard: {
    width: cardWidth,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: cardPadding,
    borderLeftWidth: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  metricCardLarge: {
    width: containerWidth,
  },
  metricCardSmall: {
    width: (containerWidth - cardGap) / 3,
  },
  metricContent: {
    flex: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: isSmallScreen ? 40 : 48,
    height: isSmallScreen ? 40 : 48,
    borderRadius: isSmallScreen ? 20 : 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexShrink: 1,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: isTablet ? 28 : isSmallScreen ? 22 : 24,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: isTablet ? 16 : isSmallScreen ? 12 : 14,
    color: theme.textSecondary,
    lineHeight: isTablet ? 22 : isSmallScreen ? 16 : 18,
  },
});
