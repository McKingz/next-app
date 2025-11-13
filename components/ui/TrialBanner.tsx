import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTrialStatus, getTrialUrgency, isTrialExpiringSoon } from '@/hooks/useTrialStatus';

/**
 * Trial Banner Component
 * 
 * Displays trial status and days remaining with appropriate urgency styling.
 * Shows upgrade CTA when trial is expiring soon.
 * 
 * Urgency levels:
 * - none: 8+ days (no banner)
 * - low: 4-7 days (blue/info)
 * - medium: 2-3 days (orange/warning)
 * - high: 1 day (red/danger)
 * - critical: 0 days (urgent red)
 */
export function TrialBanner() {
  const { theme } = useTheme();
  const { data: trialStatus, isLoading } = useTrialStatus();
  
  // Don't show banner if not in trial or data is loading
  if (isLoading || !trialStatus?.is_trial) {
    return null;
  }
  
  const daysRemaining = trialStatus.days_remaining;
  const urgency = getTrialUrgency(daysRemaining);
  
  // Don't show banner if no urgency (more than 7 days left)
  if (urgency === 'none') {
    return null;
  }
  
  // Get banner colors based on urgency
  const getBannerColors = () => {
    switch (urgency) {
      case 'critical':
        return {
          background: '#DC2626',
          text: '#FFFFFF',
          icon: 'alert-circle' as const,
        };
      case 'high':
        return {
          background: '#EF4444',
          text: '#FFFFFF',
          icon: 'warning' as const,
        };
      case 'medium':
        return {
          background: '#F59E0B',
          text: '#FFFFFF',
          icon: 'time' as const,
        };
      case 'low':
      default:
        return {
          background: theme.primary,
          text: '#FFFFFF',
          icon: 'information-circle' as const,
        };
    }
  };
  
  const colors = getBannerColors();
  
  const getMessage = () => {
    if (daysRemaining === 0) {
      return 'Your trial ends today! Upgrade now to continue using premium features.';
    }
    if (daysRemaining === 1) {
      return '1 day left in your trial. Upgrade to continue with full access.';
    }
    return `${daysRemaining} days left in your ${trialStatus.plan_name} trial.`;
  };
  
  const handleUpgrade = () => {
    router.push('/pricing' as any);
  };
  
  return (
    <View style={[styles.banner, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Ionicons name={colors.icon} size={20} color={colors.text} style={styles.icon} />
        
        <View style={styles.textContainer}>
          <Text style={[styles.message, { color: colors.text }]}>
            {getMessage()}
          </Text>
        </View>
        
        {isTrialExpiringSoon(daysRemaining) && (
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.text }]}
            onPress={handleUpgrade}
          >
            <Text style={[styles.upgradeText, { color: colors.background }]}>
              Upgrade
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  upgradeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  upgradeText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
