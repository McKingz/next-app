/**
 * LoadingState Component
 * 
 * Consistent loading state indicator with EduDashPro branding
 */

import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from './Text';
import EduDashProLoader, { EduDashProInlineLoader } from './EduDashProLoader';

export interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
  style?: any;
  testID?: string;
  variant?: 'default' | 'branded' | 'simple';
  showIcon?: boolean;
}

export function LoadingState({
  message = 'Loading...',
  size = 'large',
  color = '#007AFF',
  style,
  testID,
  variant = 'branded',
  showIcon = true,
  ...props
}: LoadingStateProps) {
  // Use branded loader by default
  if (variant === 'branded') {
    return (
      <EduDashProInlineLoader
        message={message}
        showIcon={showIcon}
        iconSize={size === 'small' ? 60 : 80}
        style={style}
        testID={testID}
        {...props}
      />
    );
  }

  // Fallback to simple loader
  return (
    <View style={[styles.container, style]} testID={testID} {...props}>
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text variant="body" color="secondary" style={styles.message}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    marginTop: 16,
    textAlign: 'center',
  },
});