import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useWhatsAppConnection } from '../../hooks/useWhatsAppConnection'
import { useTheme } from '../../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'
import WhatsAppOptInModal from './WhatsAppOptInModal'
import { track } from '../../lib/analytics'

interface WhatsAppQuickActionProps {
  onPress?: () => void
  style?: any
  size?: 'small' | 'medium' | 'large'
}

export const WhatsAppQuickAction: React.FC<WhatsAppQuickActionProps> = ({
  onPress,
  style,
  size = 'medium'
}) => {
  const { theme, isDark } = useTheme()
  const { t } = useTranslation()
  const { isEnabled } = useFeatureFlags()
  const {
    connectionStatus,
    isLoading,
    getWhatsAppDeepLink,
    isWhatsAppEnabled,
  } = useWhatsAppConnection()

  const [showOptInModal, setShowOptInModal] = useState(false)

  // Don't show if WhatsApp integration is not enabled
  if (!isEnabled('whatsapp_integration') || !isWhatsAppEnabled()) {
    return null
  }

  const handlePress = async () => {
    // Track interaction
    track('edudash.whatsapp.quick_action_pressed', {
      connected: connectionStatus.isConnected,
      timestamp: new Date().toISOString()
    })

    if (onPress) {
      onPress()
      return
    }

    if (connectionStatus.isConnected) {
      // Open WhatsApp directly
      handleOpenWhatsApp()
    } else {
      // Show opt-in modal
      setShowOptInModal(true)
    }
  }

  const handleOpenWhatsApp = () => {
    const deepLink = getWhatsAppDeepLink()
    
    if (deepLink) {
      Linking.openURL(deepLink).catch(err => {
        console.error('Failed to open WhatsApp:', err)
        Alert.alert(
          t('whatsapp:openFailed'),
          t('whatsapp:openFailedMessage'),
          [{ text: t('common.ok') }]
        )
      })
    } else {
      Alert.alert(
        t('whatsapp:noSchoolNumber'),
        t('whatsapp:noSchoolNumberMessage'),
        [{ text: t('common.ok') }]
      )
    }
  }

  const handleOptInSuccess = () => {
    setShowOptInModal(false)
    // Automatically open WhatsApp after successful connection
    setTimeout(() => {
      handleOpenWhatsApp()
    }, 500)
  }

  const getActionConfig = () => {
    if (isLoading) {
      return {
        icon: 'ellipsis-horizontal' as const,
        title: t('whatsapp:checking'),
        subtitle: t('whatsapp:pleaseWait'),
        backgroundColor: theme.border,
        textColor: theme.textSecondary,
        iconColor: theme.textSecondary,
        disabled: true,
      }
    }

    if (connectionStatus.isConnected) {
      return {
        icon: 'logo-whatsapp' as const,
        title: t('whatsapp:openWhatsApp'),
        subtitle: t('whatsapp:chatWithSchool'),
        backgroundColor: '#25D366',
        textColor: '#FFFFFF',
        iconColor: '#FFFFFF',
        disabled: false,
      }
    }

    return {
      icon: 'logo-whatsapp' as const,
      title: t('whatsapp:connectWhatsApp'),
      subtitle: t('whatsapp:getInstantUpdates'),
      backgroundColor: isDark ? '#2A2A2A' : '#F8F9FA',
      textColor: theme.text,
      iconColor: '#25D366',
      disabled: false,
    }
  }

  const config = getActionConfig()

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          padding: 12,
          iconSize: 20,
          titleFontSize: 14,
          subtitleFontSize: 12,
        }
      case 'large':
        return {
          padding: 20,
          iconSize: 28,
          titleFontSize: 18,
          subtitleFontSize: 16,
        }
      default: // medium
        return {
          padding: 16,
          iconSize: 24,
          titleFontSize: 16,
          subtitleFontSize: 14,
        }
    }
  }

  const sizeStyles = getSizeStyles()

  const styles = StyleSheet.create({
    container: {
      backgroundColor: config.backgroundColor,
      borderRadius: 12,
      padding: sizeStyles.padding,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    containerPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    containerDisabled: {
      opacity: 0.6,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: sizeStyles.iconSize + 8,
      height: sizeStyles.iconSize + 8,
      borderRadius: (sizeStyles.iconSize + 8) / 2,
      backgroundColor: connectionStatus.isConnected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(37, 211, 102, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      fontSize: sizeStyles.titleFontSize,
      fontWeight: '600',
      color: config.textColor,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: sizeStyles.subtitleFontSize,
      color: connectionStatus.isConnected 
        ? 'rgba(255, 255, 255, 0.8)' 
        : theme.textSecondary,
      lineHeight: sizeStyles.subtitleFontSize + 4,
    },
    statusChip: {
      backgroundColor: connectionStatus.isConnected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(37, 211, 102, 0.2)',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginLeft: 8,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
      color: connectionStatus.isConnected ? '#FFFFFF' : '#25D366',
    },
    upgradeHint: {
      fontSize: 10,
      color: theme.textSecondary,
      fontStyle: 'italic',
      marginTop: 4,
    },
  })

  // Show upgrade hint for free tier users
  const showUpgradeHint = !connectionStatus.isConnected && !isWhatsAppEnabled()

  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          config.disabled && styles.containerDisabled,
          style,
        ]}
        onPress={handlePress}
        disabled={config.disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={config.title}
        accessibilityHint={config.subtitle}
        accessibilityState={{ disabled: config.disabled }}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={config.icon}
              size={sizeStyles.iconSize}
              color={config.iconColor}
            />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {config.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {config.subtitle}
            </Text>
            {showUpgradeHint && (
              <Text style={styles.upgradeHint}>
                {t('whatsapp:upgradeRequired')}
              </Text>
            )}
          </View>

          {connectionStatus.isConnected && (
            <View style={styles.statusChip}>
              <Text style={styles.statusText}>
                {t('whatsapp:connected')}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <WhatsAppOptInModal
        visible={showOptInModal}
        onClose={() => setShowOptInModal(false)}
        onSuccess={handleOptInSuccess}
      />
    </>
  )
}

export default WhatsAppQuickAction