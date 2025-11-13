import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { marketingTokens } from '../tokens';
import { Section } from '../Section';
import { GradientButton } from '../GradientButton';

export function CTASection() {
  return (
    <Section style={styles.section}>
      <LinearGradient
        colors={['#0EA5E9', '#2BD9EF', '#4C6FFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={styles.title}>Ready to Transform Your Preschool?</Text>
        
        <Text style={styles.subtitle}>
          Join hundreds of educators using EduDash Pro to enhance learning outcomes
        </Text>

        <View style={styles.ctaButtons}>
          <GradientButton
            label="Start Free Trial"
            onPress={() => router.push('/(auth)/sign-in')}
            size="lg"
            variant="indigo"
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />
        </View>

        <Text style={styles.note}>
          No credit card required • 14-day free trial
        </Text>
      </LinearGradient>
    </Section>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: marketingTokens.colors.bg.surface,
  },
  gradient: {
    paddingVertical: marketingTokens.spacing['5xl'],
    paddingHorizontal: marketingTokens.spacing.xl,
    borderRadius: marketingTokens.radii.xl,
    alignItems: 'center',
  },
  title: {
    ...marketingTokens.typography.h1,
    fontSize: 32,
    color: marketingTokens.colors.fg.inverse,
    textAlign: 'center',
    marginBottom: marketingTokens.spacing.lg,
  },
  subtitle: {
    ...marketingTokens.typography.body,
    color: marketingTokens.colors.fg.inverse,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: marketingTokens.spacing['3xl'],
    maxWidth: 480,
  },
  ctaButtons: {
    width: '100%',
    maxWidth: 320,
    marginBottom: marketingTokens.spacing.lg,
  },
  primaryButton: {
    backgroundColor: marketingTokens.colors.fg.inverse,
  },
  primaryButtonText: {
    color: marketingTokens.colors.accent.cyan400,
  },
  note: {
    ...marketingTokens.typography.caption,
    color: marketingTokens.colors.fg.inverse,
    opacity: 0.7,
    textAlign: 'center',
  },
});
