import React, { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, ViewStyle } from 'react-native';

export default function KeyboardScreen({ children, contentContainerStyle }: PropsWithChildren<{ contentContainerStyle?: ViewStyle }>) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={contentContainerStyle}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

