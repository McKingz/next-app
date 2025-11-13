import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { featuresContent } from '@/constants/marketing';
import { marketingTokens } from '../tokens';
import { Section } from '../Section';
import { SectionHeader } from '../SectionHeader';
import { GlassCard } from '../GlassCard';

interface FeaturesSectionProps {
  setSelectedFeature: (feature: any) => void;
  columns: number;
}

export function FeaturesSection({ setSelectedFeature, columns }: FeaturesSectionProps) {
  return (
    <Section style={styles.section}>
      <SectionHeader
        overline="Platform Features"
        title="Everything You Need"
        subtitle="Comprehensive tools designed for South African preschools"
      />
      
      <View style={[styles.grid, { gap: columns > 1 ? 20 : 16 }]}>
        {featuresContent.slice(0, 6).map((feature, index) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            onPress={() => setSelectedFeature(feature)}
            width={columns === 1 ? '100%' : columns === 2 ? '48%' : '31%'}
          />
        ))}
      </View>
    </Section>
  );
}

interface FeatureCardProps {
  feature: any;
  onPress: () => void;
  width: string;
}

function FeatureCard({ feature, onPress, width }: FeatureCardProps) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(scale.value, { duration: 120 }) }],
  }));

  return (
    <Animated.View style={[styles.cardWrapper, { width }, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = 0.98; }}
        onPressOut={() => { scale.value = 1; }}
        accessibilityRole="button"
        accessibilityLabel={`Learn more about ${feature.title}`}
      >
        <GlassCard style={styles.card}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconRing}>
              <IconSymbol 
                name="sparkles" 
                size={20} 
                color={marketingTokens.colors.accent.cyan400} 
              />
            </View>
          </View>

          {/* Content */}
          <Text style={styles.title}>{feature.title}</Text>
          <Text style={styles.subtitle}>{feature.subtitle}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {feature.description}
          </Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Learn more */}
          <View style={styles.learnMore}>
            <Text style={styles.learnMoreText}>Learn more</Text>
            <IconSymbol 
              name="chevron.right" 
              size={14} 
              color={marketingTokens.colors.accent.cyan400} 
            />
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
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
    minHeight: 200,
  },
  iconContainer: {
    marginBottom: marketingTokens.spacing.lg,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: marketingTokens.radii.full,
    borderWidth: 2,
    borderColor: marketingTokens.colors.accent.cyan400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(43, 217, 239, 0.1)',
  },
  title: {
    ...marketingTokens.typography.h3,
    color: marketingTokens.colors.fg.primary,
    marginBottom: marketingTokens.spacing.xs,
  },
  subtitle: {
    ...marketingTokens.typography.caption,
    color: marketingTokens.colors.accent.cyan400,
    fontWeight: '600',
    marginBottom: marketingTokens.spacing.sm,
  },
  description: {
    ...marketingTokens.typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: marketingTokens.colors.fg.secondary,
    marginBottom: marketingTokens.spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: marketingTokens.colors.stroke.soft,
    marginBottom: marketingTokens.spacing.md,
  },
  learnMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: marketingTokens.spacing.xs,
  },
  learnMoreText: {
    ...marketingTokens.typography.body,
    fontSize: 14,
    color: marketingTokens.colors.accent.cyan400,
    fontWeight: '600',
  },
});
