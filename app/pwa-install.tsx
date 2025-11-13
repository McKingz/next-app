/**
 * PWA Installation Page
 * 
 * Guides mobile web users to install the app as a PWA:
 * - Android: Shows "Install App" button (beforeinstallprompt API)
 * - iOS: Shows manual "Add to Home Screen" instructions
 * - Already installed: Shows "Open app" button
 * - Fallback: Deep link to edudashpro://
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { isStandalonePWA } from '@/lib/utils/pwa';

// TypeScript type for beforeinstallprompt event
type BeforeInstallPromptEvent = {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
};

export default function PWAInstallPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installChoice, setInstallChoice] = useState<
    'accepted' | 'dismissed' | null
  >(null);

  // Check if already running as installed PWA
  const isStandalone = useMemo(() => isStandalonePWA(), []);

  // Detect iOS Safari (iPad excluded as it's treated as tablet)
  const isIOS = useMemo(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    const ua = (window.navigator?.userAgent || '').toLowerCase();
    return /iphone|ipod/.test(ua);
  }, []);

  // Listen for Android beforeinstallprompt event
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handler = (e: any) => {
      try {
        e?.preventDefault?.(); // Prevent default browser install UI
      } catch {}
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    (window as any).addEventListener?.('beforeinstallprompt', handler);
    return () => {
      (window as any).removeEventListener?.('beforeinstallprompt', handler);
    };
  }, []);

  // Handle Android install button click
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const res = await deferredPrompt.userChoice;
      setInstallChoice(res.outcome);
      setDeferredPrompt(null);
    } catch {
      setInstallChoice('dismissed');
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  // Handle open app button (deep link fallback)
  const handleOpenApp = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Try deep link first (if native app is installed)
      (window as any).location.href = 'edudashpro://';
      // Fallback to dashboards after delay
      setTimeout(() => {
        try {
          router.replace('/screens');
        } catch {}
      }, 400);
    }
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* App icon placeholder */}
        <View style={styles.iconContainer}>
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>📱</Text>
          </View>
        </View>

        <Text style={styles.title}>{t('pwa.title')}</Text>

        {isStandalone ? (
          // Already installed - show open button
          <>
            <Text style={styles.subtitle}>{t('pwa.alreadyInstalled')}</Text>
            <Pressable onPress={handleOpenApp} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{t('pwa.openApp')}</Text>
            </Pressable>
          </>
        ) : (
          // Not installed - show installation instructions
          <>
            <Text style={styles.subtitle}>{t('pwa.benefits')}</Text>

            {/* Android install button (if beforeinstallprompt fired) */}
            {deferredPrompt ? (
              <Pressable onPress={handleInstall} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>{t('pwa.install')}</Text>
              </Pressable>
            ) : null}

            {/* iOS manual instructions */}
            {isIOS ? (
              <View style={styles.instructionsBox}>
                <Text style={styles.instructionsTitle}>
                  {t('pwa.iosTitle')}
                </Text>
                <Text style={styles.instructions}>{t('pwa.iosStep1')}</Text>
                <Text style={styles.instructions}>{t('pwa.iosStep2')}</Text>
                <Text style={styles.instructions}>{t('pwa.iosStep3')}</Text>
              </View>
            ) : null}

            {/* Fallback open button */}
            <Pressable onPress={handleOpenApp} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>
                {t('pwa.openFallback')}
              </Text>
            </Pressable>

            {/* Install result message */}
            {installChoice ? (
              <Text style={styles.resultText}>
                {installChoice === 'accepted'
                  ? t('pwa.installAccepted')
                  : t('pwa.installDismissed')}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0f172a',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2a44',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  primaryBtn: {
    backgroundColor: '#06b6d4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  primaryBtnText: {
    color: '#0c1220',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  secondaryBtnText: {
    color: '#22d3ee',
    fontWeight: '600',
    fontSize: 16,
  },
  instructionsBox: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  instructionsTitle: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
  },
  instructions: {
    color: '#cbd5e1',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  resultText: {
    color: '#22d3ee',
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
  },
});
