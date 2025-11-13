import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useWhatsAppConnection } from '../../hooks/useWhatsAppConnection'
import { useTheme } from '../../contexts/ThemeContext'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'

interface WhatsAppStatusChipProps {
  onPress?: () => void
  size?: 'small' | 'medium' | 'large'
  showText?: boolean
}

export const WhatsAppStatusChip: React.FC<WhatsAppStatusChipProps> = ({
  onPress,
  size = 'medium',
  showText = true
}) => {
  const { theme, isDark } = useTheme()
  const { connectionStatus, isLoading } = useWhatsAppConnection()
  const { isEnabled } = useFeatureFlags()

  // Don't show if WhatsApp integration is not enabled
  if (!isEnabled('whatsapp_integration')) {
    return null
  }

  const getStatusConfig = () => {
    if (isLoading) {
      return {
        icon: 'ellipsis-horizontal' as const,
        text: 'Checking...',
        backgroundColor: theme.border,
        textColor: theme.textSecondary,
        borderColor: theme.border,
      }
    }

    if (connectionStatus.isConnected) {
      return {
        icon: 'logo-whatsapp' as const,
        text: 'Connected',
        backgroundColor: '#25D366', // WhatsApp green
        textColor: '#FFFFFF',
        borderColor: '#25D366',
      }
    }

    return {
      icon: 'logo-whatsapp' as const,
      text: 'Not Connected',
      backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
      textColor: theme.textSecondary,
      borderColor: theme.border,
    }
  }

  const config = getStatusConfig()

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: 8,
          paddingVertical: 4,
          iconSize: 12,
          fontSize: 11,
        }
      case 'large':
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          iconSize: 18,
          fontSize: 15,
        }
      default: // medium
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          iconSize: 14,
          fontSize: 13,
        }
    }
  }

  const sizeStyles = getSizeStyles()

  const styles = StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: config.backgroundColor,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: config.borderColor,
      paddingHorizontal: sizeStyles.paddingHorizontal,
      paddingVertical: sizeStyles.paddingVertical,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    chipPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    icon: {
      marginRight: showText ? 6 : 0,
    },
    text: {
      fontSize: sizeStyles.fontSize,
      fontWeight: '600',
      color: config.textColor,
    },
    dotIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: connectionStatus.isConnected ? '#25D366' : theme.textSecondary,
      marginLeft: 4,
    },
  })

  const ChipContent = (
    <View style={styles.chip}>
      <Ionicons
        name={config.icon}
        size={sizeStyles.iconSize}
        color={config.textColor}
        style={styles.icon}
      />
      {showText && (
        <Text style={styles.text}>
          {config.text}
        </Text>
      )}
      {!showText && <View style={styles.dotIndicator} />}
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={styles.chipPressed}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`WhatsApp status: ${config.text}`}
        accessibilityHint="Tap to manage WhatsApp connection"
      >
        {ChipContent}
      </TouchableOpacity>
    )
  }

  return ChipContent
}

export default WhatsAppStatusChip