import React from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface WebCenteredContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
  backgroundColor?: string;
  noPadding?: boolean;
  noScroll?: boolean;
  safeAreaEdges?: ('top' | 'right' | 'bottom' | 'left')[];
  contentContainerStyle?: ViewStyle;
}

/**
 * WebCenteredContainer - A reusable layout component that:
 * - Centers content on web with max-width constraint
 * - Maintains mobile-first behavior on native
 * - Handles keyboard avoiding and scroll behavior
 * 
 * Usage:
 * <WebCenteredContainer maxWidth={600}>
 *   <YourScreenContent />
 * </WebCenteredContainer>
 */
export function WebCenteredContainer({
  children,
  maxWidth = 600,
  backgroundColor = '#ffffff',
  noPadding = false,
  noScroll = false,
  safeAreaEdges = ['top', 'left', 'right'],
  contentContainerStyle,
}: WebCenteredContainerProps) {
  const containerStyle = [
    styles.container,
    { backgroundColor },
    Platform.OS === 'web' && styles.webContainer,
  ];

  const keyboardViewStyle = [
    styles.keyboardView,
    Platform.OS === 'web' && { maxWidth, alignSelf: 'center' as const, width: '100%' },
  ];

  const scrollContentStyle = [
    styles.scrollContent,
    !noPadding && styles.scrollContentPadding,
    Platform.OS === 'web' && styles.webScrollContent,
    contentContainerStyle,
  ];

  const content = noScroll ? (
    <View style={styles.noScrollContent}>
      {children}
    </View>
  ) : (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={scrollContentStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );

  return (
    <SafeAreaView style={containerStyle} edges={safeAreaEdges}>
      <KeyboardAvoidingView
        style={keyboardViewStyle}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webContainer: {
    minHeight: '100vh' as any,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentPadding: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  webScrollContent: {
    minHeight: '100vh' as any,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noScrollContent: {
    flex: 1,
  },
});

export default WebCenteredContainer;
