import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { marketingTokens } from '../tokens';
import { Section } from '../Section';
import { SectionHeader } from '../SectionHeader';
import { GlassCard } from '../GlassCard';

const roles = [
  {
    icon: 'person.2.fill',
    title: 'For Teachers',
    color: marketingTokens.colors.accent.cyan400,
    benefits: [
      'AI-powered lesson planning',
      'Automated grading & feedback',
      'Real-time progress tracking',
      'Instant parent communication',
      'CAPS curriculum alignment',
    ],
  },
  {
    icon: 'house.fill',
    title: 'For Parents',
    color: marketingTokens.colors.accent.blue500,
    benefits: [
      'Daily updates on child progress',
      'Direct messaging with teachers',
      'Photo & video sharing',
      'Homework tracking',
      'Event notifications',
    ],
  },
  {
    icon: 'building.2.fill',
    title: 'For Principals',
    color: marketingTokens.colors.accent.indigo500,
    benefits: [
      'School-wide analytics dashboard',
      'Teacher performance insights',
      'Enrollment management',
      'Financial reporting',
      'Compliance tracking',
    ],
  },
];

interface RoleBasedBenefitsSectionProps {
  columns: number;
}

export function RoleBasedBenefitsSection({ columns }: RoleBasedBenefitsSectionProps) {
  return (
    <Section style={styles.section}>
      <SectionHeader
        overline="Built for Everyone"
        title="Tailored for Each Role"
        subtitle="Designed with teachers, parents, and administrators in mind"
      />

      <View style={[styles.grid, { gap: columns > 1 ? 20 : 16 }]}>
        {roles.map((role, index) => (
          <RoleCard
            key={index}
            role={role}
            width={columns === 1 ? '100%' : columns === 2 ? '48%' : '31%'}
          />
        ))}
      </View>
    </Section>
  );
}

interface RoleCardProps {
  role: typeof roles[0];
  width: string;
}

function RoleCard({ role, width }: RoleCardProps) {
  return (
    <View style={[styles.cardWrapper, { width }]}>
      <GlassCard style={styles.card}>
        {/* Gradient hairline on top */}
        <LinearGradient
          colors={[role.color, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topHairline}
        />

        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: `${role.color}20` }]}>
          <IconSymbol name={role.icon as any} size={32} color={role.color} />
        </View>

        {/* Title */}
        <Text style={styles.title}>{role.title}</Text>

        {/* Benefits */}
        <View style={styles.benefits}>
          {role.benefits.map((benefit, idx) => (
            <View key={idx} style={styles.benefitRow}>
              <IconSymbol 
                name="checkmark.circle.fill" 
                size={16} 
                color={marketingTokens.colors.accent.green400} 
              />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: marketingTokens.colors.bg.surface,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardWrapper: {
    marginBottom: marketingTokens.spacing.lg,
  },
  card: {
    position: 'relative',
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: marketingTokens.radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: marketingTokens.spacing.lg,
  },
  title: {
    ...marketingTokens.typography.h3,
    color: marketingTokens.colors.fg.primary,
    marginBottom: marketingTokens.spacing.lg,
  },
  benefits: {
    gap: marketingTokens.spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: marketingTokens.spacing.sm,
  },
  benefitText: {
    ...marketingTokens.typography.body,
    fontSize: 14,
    color: marketingTokens.colors.fg.secondary,
    flex: 1,
    lineHeight: 20,
  },
});
