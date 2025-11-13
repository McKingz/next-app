import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { marketingTokens } from '../tokens';
import { Section } from '../Section';
import { SectionHeader } from '../SectionHeader';
import { GlassCard } from '../GlassCard';
import { useResponsive } from '../useResponsive';

const capabilities = [
  { icon: 'mic.fill', label: 'Voice Commands' },
  { icon: 'doc.text.fill', label: 'Smart Reports' },
  { icon: 'chart.bar.fill', label: 'Analytics' },
  { icon: 'sparkles', label: 'AI Insights' },
];

export function DashAISection() {
  const { isSM } = useResponsive();

  return (
    <Section style={styles.section}>
      <SectionHeader
        overline="Dash AI Assistant"
        title="Your Intelligent Teaching Partner"
        subtitle="AI-powered tools that understand South African education"
      />

      {/* Glow background */}
      <View style={styles.glowContainer}>
        <LinearGradient
          colors={marketingTokens.gradients.glow}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.glow}
        />
      </View>

      <View style={[styles.content, isSM && styles.contentMobile]}>
        {/* Main showcase card */}
        <GlassCard intensity="strong" style={styles.showcaseCard}>
          <View style={styles.aiIconContainer}>
            <LinearGradient
              colors={marketingTokens.gradients.primary}
              style={styles.aiIcon}
            >
              <IconSymbol name="sparkles" size={32} color={marketingTokens.colors.fg.inverse} />
            </LinearGradient>
          </View>
          
          <Text style={styles.showcaseTitle}>Dash AI</Text>
          <Text style={styles.showcaseSubtitle}>
            Generate lesson plans, grade assignments, and gain insights—all powered by AI trained for preschool education.
          </Text>
        </GlassCard>

        {/* Capabilities grid */}
        <View style={styles.capabilitiesGrid}>
          {capabilities.map((cap, index) => (
            <GlassCard key={index} intensity="soft" style={styles.capabilityChip}>
              <View style={styles.capabilityContent}>
                <View style={styles.capabilityDot} />
                <IconSymbol 
                  name={cap.icon as any} 
                  size={18} 
                  color={marketingTokens.colors.accent.cyan400} 
                />
                <Text style={styles.capabilityLabel}>{cap.label}</Text>
              </View>
            </GlassCard>
          ))}
        </View>

        {/* Security callout */}
        <View style={styles.securityCallout}>
          <IconSymbol name="lock.shield.fill" size={16} color={marketingTokens.colors.accent.green400} />
          <Text style={styles.securityText}>
            Secure by design — PII redaction, RLS enforced (Supabase)
          </Text>
        </View>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: marketingTokens.colors.bg.elevated,
    position: 'relative',
    overflow: 'hidden',
  },
  glowContainer: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    height: 200,
    opacity: 0.3,
  },
  glow: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: marketingTokens.spacing.xl,
  },
  contentMobile: {
    gap: marketingTokens.spacing.lg,
  },
  showcaseCard: {
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 400,
  },
  aiIconContainer: {
    marginBottom: marketingTokens.spacing.lg,
  },
  aiIcon: {
    width: 72,
    height: 72,
    borderRadius: marketingTokens.radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showcaseTitle: {
    ...marketingTokens.typography.h1,
    color: marketingTokens.colors.fg.primary,
    marginBottom: marketingTokens.spacing.sm,
  },
  showcaseSubtitle: {
    ...marketingTokens.typography.body,
    color: marketingTokens.colors.fg.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  capabilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: marketingTokens.spacing.md,
    maxWidth: 500,
  },
  capabilityChip: {
    paddingHorizontal: marketingTokens.spacing.lg,
    paddingVertical: marketingTokens.spacing.md,
  },
  capabilityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: marketingTokens.spacing.sm,
  },
  capabilityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: marketingTokens.colors.accent.cyan400,
  },
  capabilityLabel: {
    ...marketingTokens.typography.caption,
    color: marketingTokens.colors.fg.primary,
    fontWeight: '600',
  },
  securityCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: marketingTokens.spacing.sm,
    paddingVertical: marketingTokens.spacing.sm,
  },
  securityText: {
    ...marketingTokens.typography.caption,
    color: marketingTokens.colors.fg.tertiary,
    fontStyle: 'italic',
  },
});
