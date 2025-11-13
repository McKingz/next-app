import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { marketingTokens } from '../tokens';
import { useResponsive } from '../useResponsive';

export function FooterSection() {
  const { padX } = useResponsive();

  return (
    <View style={[styles.container, { paddingHorizontal: padX }]}>
      {/* Divider */}
      <View style={styles.divider} />

      {/* Logo and tagline */}
      <View style={styles.brand}>
        <LinearGradient
          colors={marketingTokens.gradients.primary}
          style={styles.logoGradient}
        >
          <IconSymbol name="graduationcap" size={24} color={marketingTokens.colors.fg.inverse} />
        </LinearGradient>
        <Text style={styles.brandName}>EduDash Pro</Text>
        <Text style={styles.tagline}>AI-Powered Education Platform</Text>
      </View>

      {/* Legal links */}
      <View style={styles.legalLinks}>
        <Pressable 
          style={styles.link}
          onPress={() => router.push('/(public)/privacy-policy')}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
        >
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Pressable>

        <View style={styles.linkDivider} />

        <Pressable 
          style={styles.link}
          onPress={() => router.push('/(public)/terms-of-service')}
          accessibilityRole="link"
          accessibilityLabel="Terms of Service"
        >
          <Text style={styles.linkText}>Terms of Service</Text>
        </Pressable>

        <View style={styles.linkDivider} />

        <Pressable 
          style={styles.link}
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.open('/data-deletion.html', '_blank');
            }
          }}
          accessibilityRole="link"
          accessibilityLabel="Data Deletion"
        >
          <Text style={styles.linkText}>Data Deletion</Text>
        </Pressable>

        <View style={styles.linkDivider} />

        <Pressable 
          style={styles.link}
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.open('/data-safety-details.html', '_blank');
            }
          }}
          accessibilityRole="link"
          accessibilityLabel="Data Safety"
        >
          <Text style={styles.linkText}>Data Safety</Text>
        </Pressable>
      </View>

      {/* Copyright */}
      <Text style={styles.copyright}>
        © {new Date().getFullYear()} EduDash Pro. All rights reserved.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: marketingTokens.spacing['4xl'],
    paddingBottom: marketingTokens.spacing.xl,
    backgroundColor: marketingTokens.colors.bg.base,
    alignItems: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: marketingTokens.colors.stroke.soft,
    marginBottom: marketingTokens.spacing['3xl'],
  },
  brand: {
    alignItems: 'center',
    marginBottom: marketingTokens.spacing.xl,
  },
  logoGradient: {
    width: 48,
    height: 48,
    borderRadius: marketingTokens.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: marketingTokens.spacing.md,
  },
  brandName: {
    ...marketingTokens.typography.h3,
    color: marketingTokens.colors.fg.primary,
    marginBottom: marketingTokens.spacing.xs,
  },
  tagline: {
    ...marketingTokens.typography.caption,
    color: marketingTokens.colors.fg.tertiary,
    fontWeight: '600',
  },
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: marketingTokens.spacing.lg,
    marginBottom: marketingTokens.spacing.lg,
  },
  link: {
    paddingVertical: marketingTokens.spacing.sm,
    paddingHorizontal: marketingTokens.spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    ...marketingTokens.typography.caption,
    color: marketingTokens.colors.fg.secondary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  linkDivider: {
    width: 1,
    height: 16,
    backgroundColor: marketingTokens.colors.stroke.soft,
  },
  copyright: {
    ...marketingTokens.typography.caption,
    fontSize: 12,
    color: marketingTokens.colors.fg.tertiary,
    opacity: 0.6,
  },
});
