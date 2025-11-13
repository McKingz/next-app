import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { marketingTokens } from '../tokens';
import { useResponsive } from '../useResponsive';
import { GradientButton } from '../GradientButton';
import { GlassCard } from '../GlassCard';

interface HeroSectionProps {
  reduceMotion?: boolean;
}

export function HeroSection({ reduceMotion = false }: HeroSectionProps) {
  const { isSM, padX } = useResponsive();
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Fade-in animation on mount
  useEffect(() => {
    if (!reduceMotion) {
      opacity.value = withTiming(1, { duration: 600 });
      translateY.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 2000 }),
          withTiming(0, { duration: 2000 })
        ),
        -1,
        false
      );
    } else {
      opacity.value = 1;
    }
  }, [reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: reduceMotion ? 0 : translateY.value }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[marketingTokens.colors.bg.base, marketingTokens.colors.bg.elevated]}
        style={styles.gradient}
      >
        <SafeAreaView edges={['top']} style={[styles.content, { paddingHorizontal: padX }]}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={marketingTokens.gradients.primary}
              style={styles.logoGradient}
            >
              <IconSymbol name="graduationcap" size={24} color={marketingTokens.colors.fg.inverse} />
            </LinearGradient>
            <Text style={styles.logoText}>EduDash Pro</Text>
          </View>

          <Animated.View style={[styles.heroContent, animatedStyle]}>
            {/* Overline chip */}
            <GlassCard intensity="soft" style={styles.overlineChip}>
              <Text style={styles.overlineText}>MOBILE-FIRST PRESCHOOL PLATFORM</Text>
            </GlassCard>

            {/* Main headline */}
            <Text style={[styles.headline, isSM && styles.headlineSM]}>
              Empower Your Preschool with{'\n'}
              <Text style={styles.headlineAccent}>AI-Powered Education</Text>
            </Text>

            {/* Gradient underline */}
            <LinearGradient
              colors={marketingTokens.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.underline}
            />

            {/* Subtitle */}
            <Text style={styles.subtitle}>
              Streamline classroom management, track student progress, and enhance learning outcomes 
              with intelligent tools designed for South African early childhood education.
            </Text>

            {/* Trust signal */}
            <View style={styles.trustSignal}>
              <View style={styles.trustDot} />
              <Text style={styles.trustText}>Trusted by 120+ preschools across SA</Text>
            </View>

            {/* CTAs */}
            <View style={styles.ctaContainer}>
              <GradientButton
                label="Get Started Free"
                onPress={() => router.push('/(auth)/sign-up')}
                size="lg"
                testID="hero-cta-signup"
              />
              
              <Pressable
                style={styles.secondaryCTA}
                onPress={() => router.push('/(auth)/sign-in')}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryCTAText}>
                  Already have an account? Sign In
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 600,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: marketingTokens.spacing['2xl'],
    paddingBottom: marketingTokens.spacing['4xl'],
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: marketingTokens.spacing['4xl'],
  },
  logoGradient: {
    width: 40,
    height: 40,
    borderRadius: marketingTokens.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: marketingTokens.spacing.md,
  },
  logoText: {
    ...marketingTokens.typography.h3,
    color: marketingTokens.colors.fg.primary,
  },
  heroContent: {
    alignItems: 'center',
  },
  overlineChip: {
    paddingHorizontal: marketingTokens.spacing.lg,
    paddingVertical: marketingTokens.spacing.sm,
    marginBottom: marketingTokens.spacing.xl,
    alignSelf: 'center',
  },
  overlineText: {
    ...marketingTokens.typography.overline,
    color: marketingTokens.colors.accent.cyan400,
    fontWeight: '600',
  },
  headline: {
    ...marketingTokens.typography.display1,
    fontSize: 40,
    lineHeight: 48,
    color: marketingTokens.colors.fg.primary,
    textAlign: 'center',
    marginBottom: marketingTokens.spacing.lg,
  },
  headlineSM: {
    fontSize: 32,
    lineHeight: 38,
  },
  headlineAccent: {
    color: marketingTokens.colors.accent.cyan400,
  },
  underline: {
    width: 80,
    height: 3,
    borderRadius: marketingTokens.radii.full,
    marginBottom: marketingTokens.spacing.xl,
  },
  subtitle: {
    ...marketingTokens.typography.body,
    color: marketingTokens.colors.fg.secondary,
    textAlign: 'center',
    maxWidth: 560,
    marginBottom: marketingTokens.spacing.xl,
  },
  trustSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: marketingTokens.spacing['3xl'],
  },
  trustDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: marketingTokens.colors.accent.green400,
    marginRight: marketingTokens.spacing.sm,
  },
  trustText: {
    ...marketingTokens.typography.caption,
    color: marketingTokens.colors.fg.tertiary,
    fontWeight: '500',
  },
  ctaContainer: {
    width: '100%',
    alignItems: 'center',
    gap: marketingTokens.spacing.lg,
  },
  secondaryCTA: {
    paddingVertical: marketingTokens.spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryCTAText: {
    ...marketingTokens.typography.body,
    fontSize: 14,
    color: marketingTokens.colors.fg.secondary,
    textDecorationLine: 'underline',
  },
});
