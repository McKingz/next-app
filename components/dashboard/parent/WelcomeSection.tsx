import React from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { getGreeting } from '@/lib/dashboard/parentDashboardHelpers';
import TierBadge from '@/components/ui/TierBadge';

interface WelcomeSectionProps {
  userName: string;
  subtitle: string;
  isDark: boolean;
  onThemeToggle: () => Promise<void>;
  showTierBadge?: boolean;
  tierBadgePlacement?: 'subtitle-inline' | 'header-right';
  tierBadgeSize?: 'sm' | 'md';
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({ 
  userName, 
  subtitle, 
  isDark,
  onThemeToggle,
  showTierBadge = true,
  tierBadgePlacement = 'subtitle-inline',
          tierBadgeSize="md"
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const handleThemeToggle = async () => {
    await onThemeToggle();
    try { 
      if (Platform.OS !== 'web') {
        // Use platform-appropriate haptics
        if (Platform.OS === 'ios') {
          await require('expo-haptics').impactAsync(require('expo-haptics').ImpactFeedbackStyle.Light);
        } else {
          require('react-native').Vibration.vibrate(15);
        }
      }
    } catch {}
  };

  const styles = StyleSheet.create({
    welcomeSection: {
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginBottom: 8,
    },
    welcomeHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    greeting: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.onPrimary,
    },
    welcomeSubtitle: {
      fontSize: 14,
      color: theme.onPrimary,
      opacity: 0.9,
      marginTop: 4,
    },
    themeToggleButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    tierBadgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: 6,
    },
  });

  return (
    <View style={styles.welcomeSection}>
      <View style={styles.welcomeHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {getGreeting(t)}, {userName}! 👋
          </Text>
          <Text style={styles.welcomeSubtitle}>{subtitle}</Text>
          
          {/* TierBadge - Inline placement below subtitle */}
          {showTierBadge && tierBadgePlacement === 'subtitle-inline' && (
            <View style={styles.tierBadgeContainer}>
              <TierBadge size={tierBadgeSize} showManageButton={false} />
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.themeToggleButton}
          onPress={handleThemeToggle}
        >
          <Ionicons 
            name={isDark ? 'sunny' : 'moon'} 
            size={18} 
            color={theme.primary} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};
