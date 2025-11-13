import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import WhatsAppStatusChip from '../whatsapp/WhatsAppStatusChip'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useAuth } from '@/contexts/AuthContext'
import { router } from 'expo-router'
import TierBadge from '@/components/ui/TierBadge'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
// Colors import removed - now using theme colors

interface EnhancedHeaderProps {
  userName?: string
  userRole?: string
  tier?: 'free' | 'pro' | 'enterprise'
  childrenCount?: number
  onWhatsAppPress?: () => void
}

export const EnhancedHeader: React.FC<EnhancedHeaderProps> = ({
  userName = 'Parent',
  // userRole removed as it's not used in component
  tier = 'free',
  childrenCount = 0,
  onWhatsAppPress
}) => {
  const { tier: ctxTier } = useSubscription()
  const { profile } = useAuth()
  const effectiveTier = (tier || ctxTier || 'free') as 'free' | 'pro' | 'enterprise' | 'starter' | 'basic' | 'premium'
  const { theme, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weatherGreeting, setWeatherGreeting] = useState('')

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    // Time-based greeting
    const hour = new Date().getHours()
    if (hour < 12) {
      setWeatherGreeting(t('dashboard.good_morning'))
    } else if (hour < 17) {
      setWeatherGreeting(t('dashboard.good_afternoon'))  
    } else {
      setWeatherGreeting(t('dashboard.good_evening'))
    }

    return () => clearInterval(timer)
  }, [t])

  const getTierInfo = () => {
    switch (effectiveTier) {
      case 'pro':
        return {
          label: t('dashboard.tierPro'),
          color: '#FFB000', // SA Gold
          icon: 'star' as const
        }
      case 'enterprise':
        return {
          label: t('dashboard.tierEnterprise'),
          color: '#C41E3A', // Protea red
          icon: 'diamond' as const
        }
      default:
        return {
          label: t('dashboard.tierFree'),
          color: theme.textSecondary,
          icon: 'heart' as const
        }
    }
  }

  const tierInfo = getTierInfo()
  // Removed unused isAndroid variable

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      <LinearGradient
        colors={isDark 
          ? ['#1a1a1a', '#2a2a2a', '#1a1a1a']
          : ['#ffffff', '#f8f9fa', '#ffffff']
        }
        style={styles.headerCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Top Row - Simplified without profile avatar */}
        <View style={styles.topRow}>
          <View style={styles.leftSection}>
            <View style={styles.greetingContainer}>
              <Text style={[styles.weatherGreeting, { color: theme.textSecondary }]}>
                {weatherGreeting}
              </Text>
              <Text style={[styles.timeText, { color: theme.textTertiary }]}>
                {currentTime.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: false 
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeText, { color: theme.text }]}>
              {t('dashboard.welcome', { name: userName })} 👨‍👩‍👧‍👦
            </Text>

            {/* Children Count */}
            {childrenCount > 0 && (
              <Text style={[styles.childrenInfo, { color: theme.textSecondary }]}>
                {childrenCount === 1 
                  ? t('dashboard.managingChildren', { count: childrenCount })
                  : t('dashboard.managingChildrenPlural', { count: childrenCount })
                }
              </Text>
            )}
          </View>
        </View>

        {/* Bottom Row */}
        <View style={styles.bottomRow}>
          <View style={styles.statusSection}>
            <TouchableOpacity 
              style={styles.whatsappContainer}
              onPress={onWhatsAppPress}
            >
              <WhatsAppStatusChip 
                size="small" 
                showText={true}
                onPress={onWhatsAppPress}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.quickActions}>
            {/* Sync Status */}
            <View style={styles.syncStatus}>
              <View style={[styles.syncDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.syncText, { color: theme.textTertiary }]}>
                {t('dashboard.syncStatus')}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  )
}

export default EnhancedHeader

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  leftSection: {
    flex: 1,
  },
  greetingContainer: {
    // No additional styles
  },
  weatherGreeting: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mainContent: {
    marginBottom: 16,
  },
  welcomeSection: {
    // No additional styles
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    lineHeight: 30,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '600',
  },
  upgradeHint: {
    backgroundColor: 'rgba(255, 176, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  upgradeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFB000',
  },
  managePlanBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  managePlanText: {
    fontSize: 12,
    fontWeight: '600',
  },
  childrenInfo: {
    fontSize: 13,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusSection: {
    flex: 1,
  },
  whatsappContainer: {
    alignSelf: 'flex-start',
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  syncText: {
    fontSize: 11,
    fontWeight: '600',
  },
})