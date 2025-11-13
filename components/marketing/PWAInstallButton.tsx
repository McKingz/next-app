import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { marketingTokens } from './tokens';
import { GlassCard } from './GlassCard';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA Install Button
 * Shows install prompt on web when PWA is installable
 */
export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      
      // Animate in
      opacity.value = withSpring(1);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Pulse animation
    scale.value = withSequence(
      withSpring(0.95),
      withSpring(1.05),
      withSpring(1)
    );

    // Show install prompt
    await deferredPrompt.prompt();
    
    // Wait for user choice
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstallable(false);
      opacity.value = withSpring(0);
    }
    
    setDeferredPrompt(null);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!isInstallable) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable
        onPress={handleInstallClick}
        accessibilityRole="button"
        accessibilityLabel="Install EduDash Pro as PWA"
      >
        <GlassCard intensity="medium" style={styles.card}>
          <View style={styles.content}>
            <IconSymbol 
              name="arrow.down.circle.fill" 
              size={24} 
              color={marketingTokens.colors.accent.cyan400} 
            />
            <View style={styles.textContainer}>
              <Text style={styles.title}>Install App</Text>
              <Text style={styles.subtitle}>Use offline & get faster access</Text>
            </View>
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'fixed' as any,
    bottom: 80,
    right: 16,
    zIndex: 1000,
    maxWidth: 320,
  },
  card: {
    paddingHorizontal: marketingTokens.spacing.lg,
    paddingVertical: marketingTokens.spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: marketingTokens.spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...marketingTokens.typography.body,
    fontWeight: '700',
    color: marketingTokens.colors.fg.primary,
    marginBottom: 2,
  },
  subtitle: {
    ...marketingTokens.typography.caption,
    color: marketingTokens.colors.fg.secondary,
    fontSize: 12,
  },
});
