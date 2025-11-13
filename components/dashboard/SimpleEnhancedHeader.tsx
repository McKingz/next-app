import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useAuth } from '@/contexts/AuthContext'
import { router } from 'expo-router'
import TierBadge from '@/components/ui/TierBadge'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface SimpleEnhancedHeaderProps {
  userName?: string
  tier?: 'free' | 'pro' | 'enterprise'
  childrenCount?: number
  onWhatsAppPress?: () => void
  onProfilePress?: () => void
}

export const SimpleEnhancedHeader: React.FC<SimpleEnhancedHeaderProps> = ({
  userName = 'Parent',
  tier = 'free',
  childrenCount = 0,
  onWhatsAppPress,
  onProfilePress
}) => {
  const { tier: ctxTier } = useSubscription()
  const { profile } = useAuth()
  const effectiveTier = (tier || ctxTier || 'free') as 'free' | 'pro' | 'enterprise' | 'starter' | 'basic' | 'premium'
  const { t } = useTranslation('common')
  const insets = useSafeAreaInsets()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weatherGreeting, setWeatherGreeting] = useState('')

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    // Set weather-based greeting
    const hour = new Date().getHours()
    if (hour < 12) {
      setWeatherGreeting('🌅 ' + t('dashboard.good_morning'))
    } else if (hour < 17) {
      setWeatherGreeting('☀️ ' + t('dashboard.good_afternoon'))  
    } else {
      setWeatherGreeting('🌙 ' + t('dashboard.good_evening'))
    }

    return () => clearInterval(timer)
  }, [t])

  const getTierInfo = () => {
    switch (effectiveTier) {
      case 'pro':
        return {
          label: 'Pro',
          color: '#FFB000', // SA Gold
          icon: 'star' as const
        }
      case 'enterprise':
        return {
          label: 'Enterprise',
          color: '#C41E3A', // Protea red
          icon: 'diamond' as const
        }
      default:
        return {
          label: 'Free',
          color: '#9CA3AF',
          icon: 'heart' as const
        }
    }
  }

  const tierInfo = getTierInfo()

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      <LinearGradient
        colors={['#1a1a1a', '#2a2a2a', '#1a1a1a']}
        style={styles.headerCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Top Row */}
        <View style={styles.topRow}>
          <View style={styles.leftSection}>
            <View style={styles.greetingContainer}>
              <Text style={styles.weatherGreeting}>
                {weatherGreeting}
              </Text>
              <Text style={styles.timeText}>
                {currentTime.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: false 
                })}
              </Text>
            </View>
          </View>

          <View style={styles.rightSection}>
            {/* Profile Avatar */}
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={onProfilePress}
              accessibilityLabel="Open profile settings"
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>
              {t('dashboard.welcome', { name: userName })} 👨‍👩‍👧‍👦
            </Text>

            {/* Children Count */}
            {childrenCount > 0 && (
              <Text style={styles.childrenInfo}>
                {childrenCount === 1 
                  ? t('dashboard.managingChildren', { count: childrenCount })
                  : t('dashboard.managingChildrenPlural', { count: childrenCount })}
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
              <View style={styles.whatsappChip}>
                <Ionicons name="logo-whatsapp" size={12} color="#25D366" />
                <Text style={styles.whatsappText}>{t('dashboard.whatsapp_not_connected', { defaultValue: 'Not Connected' })}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.quickActions}>
            {/* Sync Status */}
            <View style={styles.syncStatus}>
              <View style={[styles.syncDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.syncText}>
                {t('dashboard.syncStatus')}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  )
}

export default SimpleEnhancedHeader

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
    color: '#9CA3AF',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
  childrenInfo: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusSection: {
    flex: 1,
  },
  whatsappContainer: {
    alignSelf: 'flex-start',
  },
  whatsappChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 211, 102, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  whatsappText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#25D366',
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#6B7280',
  },
})