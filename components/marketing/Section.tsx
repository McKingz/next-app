import React, { PropsWithChildren } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { marketingTokens } from './tokens';
import { useResponsive } from './useResponsive';

interface SectionProps {
  style?: ViewStyle;
  maxWidth?: number;
  noPadding?: boolean;
}

/**
 * Standard section wrapper with responsive padding
 * Ensures consistent spacing across all marketing sections
 */

export function Section({ children, style, maxWidth, noPadding = false }: PropsWithChildren<SectionProps>) {
  const { padX, sectionSpacing } = useResponsive();
  
  return (
    <View 
      style={[
        styles.container,
        {
          paddingHorizontal: noPadding ? 0 : padX,
          paddingVertical: sectionSpacing,
          maxWidth: maxWidth || undefined,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
});
