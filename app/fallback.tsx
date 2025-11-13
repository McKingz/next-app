import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

// Fallback component for blank screen issues
export default function FallbackScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('app.fullName', { defaultValue: 'EduDash Pro' })}</Text>
        <Text style={styles.subtitle}>{t('fallback.loading_issue', { defaultValue: 'Loading issue detected' })}</Text>
        <Text style={styles.description}>
          {t('fallback.description', { defaultValue: 'The app is having trouble loading. This might be due to network connectivity or configuration issues.' })}
        </Text>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => router.replace('/(auth)/sign-in')}
        >
          <Text style={styles.buttonText}>{t('fallback.go_to_sign_in', { defaultValue: 'Go to Sign In' })}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.retryButton]} 
          onPress={() => router.replace('/')}
        >
          <Text style={styles.buttonText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#00f5ff',
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#00f5ff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 16,
    minWidth: 200,
  },
  retryButton: {
    backgroundColor: '#8000ff',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});