/**
 * Voice Usage Quota Card
 * 
 * Displays current voice usage limits and remaining quota
 * Shows warnings when approaching limits
 * Provides upgrade prompts for free/starter tiers
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useVoiceUsageLimits } from '@/lib/voice/useVoiceUsageLimits';
import { useTheme } from '@/contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface VoiceUsageQuotaCardProps {
  onUpgradePress?: () => void;
}

export function VoiceUsageQuotaCard({ onUpgradePress }: VoiceUsageQuotaCardProps) {
  const { quota, loading, error, isNearDailyLimit, isNearMonthlyLimit, canUseVoice, refresh } = useVoiceUsageLimits();
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading usage information...
        </Text>
      </View>
    );
  }
  
  if (error || !quota) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <MaterialCommunityIcons name="alert-circle" size={24} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error || 'Unable to load usage information'}
        </Text>
        <TouchableOpacity onPress={refresh} style={styles.retryButton}>
          <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Determine tier color and badge
  const tierColors = {
    free: colors.textSecondary,
    starter: colors.info,
    professional: colors.primary,
    enterprise: colors.success,
  };
  
  const tierColor = tierColors[quota.tier];
  
  // Calculate usage percentages
  const dailySttUsagePercent = ((quota.daily.stt_minutes_total - quota.daily.stt_minutes_remaining) / quota.daily.stt_minutes_total) * 100;
  const monthlySttUsagePercent = ((quota.monthly.stt_minutes_total - quota.monthly.stt_minutes_remaining) / quota.monthly.stt_minutes_total) * 100;
  
  // Determine warning level
  const showWarning = isNearDailyLimit || isNearMonthlyLimit;
  const showError = !canUseVoice;
  
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="microphone" size={24} color={tierColor} />
          <Text style={[styles.title, { color: colors.text }]}>Voice Usage</Text>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: `${tierColor}20` }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>
            {quota.tier.toUpperCase()}
          </Text>
        </View>
      </View>
      
      {/* Warning Banner */}
      {showError && (
        <View style={[styles.banner, { backgroundColor: `${colors.error}20` }]}>
          <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error} />
          <Text style={[styles.bannerText, { color: colors.error }]}>
            Daily or monthly limit reached. Voice features unavailable until reset.
          </Text>
        </View>
      )}
      
      {showWarning && !showError && (
        <View style={[styles.banner, { backgroundColor: `${colors.warning}20` }]}>
          <MaterialCommunityIcons name="alert" size={20} color={colors.warning} />
          <Text style={[styles.bannerText, { color: colors.warning }]}>
            Approaching voice usage limit. Consider upgrading for more capacity.
          </Text>
        </View>
      )}
      
      {/* Daily Usage */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Today's Usage</Text>
        
        <View style={styles.usageRow}>
          <Text style={[styles.usageLabel, { color: colors.text }]}>Speech-to-Text</Text>
          <Text style={[styles.usageValue, { color: colors.text }]}>
            {quota.daily.stt_minutes_remaining.toFixed(1)} / {quota.daily.stt_minutes_total} min
          </Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBarFill, 
              { 
                width: `${dailySttUsagePercent}%`,
                backgroundColor: showError ? colors.error : showWarning ? colors.warning : colors.success
              }
            ]} 
          />
        </View>
        
        <View style={styles.usageRow}>
          <Text style={[styles.usageLabel, { color: colors.text }]}>Text-to-Speech</Text>
          <Text style={[styles.usageValue, { color: colors.text }]}>
            {Math.floor(quota.daily.tts_characters_remaining).toLocaleString()} / {quota.daily.tts_characters_total.toLocaleString()} chars
          </Text>
        </View>
      </View>
      
      {/* Monthly Usage */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>This Month</Text>
        
        <View style={styles.usageRow}>
          <Text style={[styles.usageLabel, { color: colors.text }]}>Speech-to-Text</Text>
          <Text style={[styles.usageValue, { color: colors.text }]}>
            {quota.monthly.stt_minutes_remaining.toFixed(1)} / {quota.monthly.stt_minutes_total} min
          </Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBarFill, 
              { 
                width: `${monthlySttUsagePercent}%`,
                backgroundColor: showError ? colors.error : showWarning ? colors.warning : colors.success
              }
            ]} 
          />
        </View>
        
        <View style={styles.usageRow}>
          <Text style={[styles.usageLabel, { color: colors.text }]}>Text-to-Speech</Text>
          <Text style={[styles.usageValue, { color: colors.text }]}>
            {Math.floor(quota.monthly.tts_characters_remaining).toLocaleString()} / {quota.monthly.tts_characters_total.toLocaleString()} chars
          </Text>
        </View>
      </View>
      
      {/* Upgrade Button for Free/Starter */}
      {(quota.tier === 'free' || quota.tier === 'starter') && onUpgradePress && (
        <TouchableOpacity 
          style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
          onPress={onUpgradePress}
        >
          <MaterialCommunityIcons name="arrow-up-circle" size={20} color="#FFFFFF" />
          <Text style={styles.upgradeButtonText}>
            Upgrade for More Voice Minutes
          </Text>
        </TouchableOpacity>
      )}
      
      {/* Info Text */}
      <Text style={[styles.infoText, { color: colors.textSecondary }]}>
        Voice usage resets daily at midnight UTC and monthly on the 1st.
        {quota.tier === 'free' && ' Upgrade for higher limits and premium voices.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  usageLabel: {
    fontSize: 14,
  },
  usageValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
