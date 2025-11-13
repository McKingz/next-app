/**
 * PDF Notification Banner Component
 * 
 * Non-blocking notification banner for status messages
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface PDFNotificationBannerProps {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  dismissible: boolean;
  timeout?: number;
  onDismiss?: () => void;
}

export function PDFNotificationBanner({
  id,
  type,
  message,
  dismissible,
  timeout,
  onDismiss,
}: PDFNotificationBannerProps) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const styles = useThemedStyles((theme) => {
    const getTypeColors = () => {
      switch (type) {
        case 'success':
          return {
            backgroundColor: theme.successLight,
            borderColor: theme.success,
            textColor: theme.onSuccess,
            iconColor: theme.success,
          };
        case 'warning':
          return {
            backgroundColor: theme.warningLight,
            borderColor: theme.warning,
            textColor: theme.onWarning,
            iconColor: theme.warning,
          };
        case 'error':
          return {
            backgroundColor: theme.errorLight,
            borderColor: theme.error,
            textColor: theme.onError,
            iconColor: theme.error,
          };
        case 'info':
        default:
          return {
            backgroundColor: theme.infoLight,
            borderColor: theme.info,
            textColor: theme.onInfo,
            iconColor: theme.info,
          };
      }
    };

    const colors = getTypeColors();

    return {
      container: {
        backgroundColor: colors.backgroundColor,
        borderLeftWidth: 4,
        borderLeftColor: colors.borderColor,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 16,
        marginVertical: 4,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'flex-start',
        ...Platform.select({
          ios: {
            shadowColor: colors.borderColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          android: {
            elevation: 2,
          },
        }),
      },
      iconContainer: {
        marginRight: 12,
        paddingTop: 2,
      },
      contentContainer: {
        flex: 1,
      },
      message: {
        fontSize: 14,
        lineHeight: 20,
        color: colors.textColor,
      },
      dismissButton: {
        marginLeft: 12,
        padding: 4,
      },
      colors,
    };
  });

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'warning':
        return 'warning';
      case 'error':
        return 'alert-circle';
      case 'info':
      default:
        return 'information-circle';
    }
  };

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss if timeout is set
    if (timeout && onDismiss) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [timeout, onDismiss]);

  const handleDismiss = () => {
    if (onDismiss) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss();
      });
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={getIcon()}
          size={20}
          color={styles.colors.iconColor}
        />
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
      </View>

      {dismissible && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
        >
          <Ionicons
            name="close"
            size={18}
            color={styles.colors.iconColor}
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}