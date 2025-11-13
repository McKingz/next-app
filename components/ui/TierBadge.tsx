import React, { useMemo, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, Animated } from 'react-native'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useAuth } from '@/contexts/AuthContext'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { LinearGradient } from 'expo-linear-gradient'

export type TierBadgeProps = {
  tier?: string | null
  showManageButton?: boolean
  containerStyle?: ViewStyle
  size?: 'sm' | 'md'
}

function getTierMeta(t?: string) {
  const tt = String(t || 'free').toLowerCase()
  switch (tt) {
    case 'starter': return { label: 'Starter', color: '#059669' }
    case 'premium': return { label: 'Premium', color: '#7C3AED' }
    case 'enterprise': return { label: 'Enterprise', color: '#DC2626' }
    case 'parent-starter': return { label: 'Parent Starter', color: '#06B6D4' }
    case 'parent-plus': return { label: 'Parent Plus', color: '#22C55E' }
    case 'free':
    default: return { label: 'Free', color: '#6B7280' }
  }
}

export const TierBadge: React.FC<TierBadgeProps> = ({ tier, showManageButton = false, containerStyle, size = 'md' }) => {
  const { t } = useTranslation()
  const { tier: ctxTier, tierSource } = useSubscription()
  const { profile } = useAuth()
  const effectiveTier = tier || ctxTier || 'free'
  const meta = useMemo(() => getTierMeta(effectiveTier), [effectiveTier])

  // Pulse animation for non-free tiers
  const shouldPulse = String(effectiveTier).toLowerCase() !== 'free'
  const pulse = React.useRef(new Animated.Value(0)).current
  React.useEffect(() => {
    if (!shouldPulse) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [shouldPulse, pulse])

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] })
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] })

  const canManage = profile?.role === 'principal' || profile?.role === 'principal_admin' || profile?.role === 'super_admin'

  const height = size === 'sm' ? 22 : 24
  const fontSize = size === 'sm' ? 11 : 12

  const tierKey = String(effectiveTier || 'free').toLowerCase()
  const label = t(`subscription.tiers.${tierKey}`, { defaultValue: meta.label })

  // Only show source info if we have a valid source
  const hasValidSource = tierSource && tierSource !== 'unknown'
  const tierSourceKey = `subscription.tierSource.${tierSource || 'unknown'}`
  const tierSourceText = hasValidSource ? t(tierSourceKey, { defaultValue: tierSource }) : null
  const sourceCaption = tierSourceText ? t('subscription.tierSource.caption', { source: tierSourceText, defaultValue: `Source: ${tierSourceText}` }) : null

  const [showTip, setShowTip] = useState(false)

  useEffect(() => {
    if (!showTip) return
    const id = setTimeout(() => setShowTip(false), 3000)
    return () => clearTimeout(id)
  }, [showTip])

  return (
    <View style={[styles.row, containerStyle]}>
      {/* Pulsing glow ring */}
      {shouldPulse && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: glowOpacity,
            transform: [{ scale }],
          }}
        >
          <LinearGradient
            colors={[meta.color + '55', meta.color + '00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glow}
          />
        </Animated.View>
      )}

      <Animated.View style={{ transform: [{ scale }] }}>
      <LinearGradient
        colors={[meta.color + 'AA', meta.color + '40']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.chip,
          {
            borderColor: meta.color,
            height,
            shadowColor: meta.color,
            shadowOpacity: 0.6,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 6,
          },
        ]}
      >
        <Text
          style={[
            styles.chipText,
            {
              color: '#001014',
              fontSize,
              textShadowColor: meta.color + '66',
              textShadowRadius: 8,
              textShadowOffset: { width: 0, height: 0 },
            },
          ]}
        >
          {label}
        </Text>
      </LinearGradient>
      </Animated.View>
      {showManageButton && canManage && (
        <TouchableOpacity
          style={[styles.manageBtn, { borderColor: meta.color, height }]}
          onPress={() => {
            if (profile?.role === 'super_admin') {
              router.push('/screens/super-admin-subscriptions')
            } else {
              // Principals/admins go to subscription setup to manage/upgrade
              router.push('/screens/subscription-setup')
            }
          }}
          accessibilityLabel={t('subscription.managePlan', { defaultValue: 'Manage plan' })}
        >
          <Ionicons name="pricetags-outline" size={12} color={meta.color} />
          <Text style={[styles.manageText, { color: meta.color, fontSize: fontSize - 1 }]}>{t('subscription.managePlan', { defaultValue: 'Manage plan' })}</Text>
        </TouchableOpacity>
      )}
      {canManage && hasValidSource && sourceCaption && (
        <View style={styles.sourceWrap}>
          <TouchableOpacity
            onPress={() => setShowTip(prev => !prev)}
            accessibilityRole="button"
            accessibilityLabel={sourceCaption}
            accessibilityState={{ expanded: showTip }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="information-circle-outline" size={12} color={meta.color} />
          </TouchableOpacity>
          {showTip && (
            <View style={[styles.tooltip, { borderColor: meta.color }]}>
              <Text style={styles.tooltipText}>{sourceCaption}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginLeft: 8,
    gap: 4,
  },
  manageText: {
    fontWeight: '600',
  },
  sourceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 4,
    position: 'relative',
  },
  sourceText: {
    fontWeight: '500',
    opacity: 0.85,
  },
  tooltip: {
    position: 'absolute',
    top: -30,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxWidth: 240,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    width: '110%',
    height: '140%',
  },
})

export default TierBadge
