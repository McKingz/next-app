import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { initializeAdMob, showInterstitialAd, showRewardedAd } from '@/lib/adMob';
import { track } from '@/lib/analytics';
import { debug, warn } from '@/lib/debug';

interface AdsContextType {
  ready: boolean;
  canShowBanner: boolean;
  maybeShowInterstitial: (tag: string) => Promise<boolean>;
  offerRewarded: (tag: string) => Promise<{ shown: boolean; rewarded: boolean }>;
}

const AdsContext = createContext<AdsContextType>({
  ready: false,
  canShowBanner: false,
  maybeShowInterstitial: async () => false,
  offerRewarded: async () => ({ shown: false, rewarded: false }),
});

// Storage keys for frequency control
const STORAGE_KEYS = {
  lastInterstitialAt: 'ads:lastInterstitialAt',
  interstitialCount: (date: string) => `ads:interstitialCount:${date}`,
  rewardedOffersCount: (date: string) => `ads:rewardedOffersCount:${date}`,
  appStartTime: 'ads:appStartTime',
};

// Rate limiting constants
const RATE_LIMITS = {
  interstitialMinInterval: 2 * 60 * 1000, // 2 minutes
  interstitialMaxPerDay: 3,
  rewardedMaxPerDay: 2,
  initialGracePeriod: 60 * 1000, // 1 minute after app start
};

export function AdsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [appStartTime, setAppStartTime] = useState<number>(Date.now());
  const { ready: subscriptionReady, tier } = useSubscription();

  // Determine if ads should be enabled
  const shouldEnableAds = useMemo(() => {
    return (
      subscriptionReady &&
      tier === 'free' &&
      Platform.OS === 'android' && // Respect Android-only development mode
      process.env.EXPO_PUBLIC_ENABLE_ADS !== '0'
    );
  }, [subscriptionReady, tier]);

  const canShowBanner = shouldEnableAds;

  useEffect(() => {
    let mounted = true;

    const initializeAds = async () => {
      try {
        // Set app start time for grace period
        const startTime = Date.now();
        setAppStartTime(startTime);
        await AsyncStorage.setItem(STORAGE_KEYS.appStartTime, startTime.toString());

        if (shouldEnableAds) {
          debug('[AdsProvider] Initializing AdMob for free tier user');
          const initialized = await initializeAdMob();
          
          track('ads.context_initialized', {
            success: initialized,
            tier,
            platform: Platform.OS,
          });

          if (mounted) {
            setReady(true);
          }
        } else {
          debug('[AdsProvider] Skipping AdMob initialization', { 
            shouldEnableAds, 
            subscriptionReady, 
            tier, 
            platform: Platform.OS 
          });
          
          if (mounted) {
            setReady(true);
          }
        }
      } catch (error) {
        warn('[AdsProvider] Failed to initialize ads:', error);
        if (mounted) {
          setReady(true); // Always set ready to avoid blocking UI
        }
      }
    };

    if (subscriptionReady) {
      initializeAds();
    }

    return () => {
      mounted = false;
    };
  }, [shouldEnableAds, tier, subscriptionReady]);

  const getTodayString = () => {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const isWithinGracePeriod = async (): Promise<boolean> => {
    try {
      const startTimeStr = await AsyncStorage.getItem(STORAGE_KEYS.appStartTime);
      const startTime = startTimeStr ? parseInt(startTimeStr, 10) : appStartTime;
      const elapsed = Date.now() - startTime;
      return elapsed < RATE_LIMITS.initialGracePeriod;
    } catch {
      return false;
    }
  };

  const canShowInterstitial = async (): Promise<{ allowed: boolean; reason?: string }> => {
    if (!shouldEnableAds) {
      return { allowed: false, reason: 'ads_disabled' };
    }

    // Check grace period
    const inGracePeriod = await isWithinGracePeriod();
    if (inGracePeriod) {
      return { allowed: false, reason: 'grace_period' };
    }

    try {
      // Check time-based rate limit
      const lastInterstitialStr = await AsyncStorage.getItem(STORAGE_KEYS.lastInterstitialAt);
      if (lastInterstitialStr) {
        const lastInterstitialTime = parseInt(lastInterstitialStr, 10);
        const timeSinceLastInterstitial = Date.now() - lastInterstitialTime;
        
        if (timeSinceLastInterstitial < RATE_LIMITS.interstitialMinInterval) {
          return { allowed: false, reason: 'rate_limit' };
        }
      }

      // Check daily count limit
      const today = getTodayString();
      const dailyCountStr = await AsyncStorage.getItem(STORAGE_KEYS.interstitialCount(today));
      const dailyCount = dailyCountStr ? parseInt(dailyCountStr, 10) : 0;
      
      if (dailyCount >= RATE_LIMITS.interstitialMaxPerDay) {
        return { allowed: false, reason: 'daily_limit' };
      }

      return { allowed: true };
    } catch (error) {
      warn('[AdsProvider] Error checking interstitial limits:', error);
      return { allowed: false, reason: 'error' };
    }
  };

  const canShowRewarded = async (): Promise<{ allowed: boolean; reason?: string }> => {
    if (!shouldEnableAds) {
      return { allowed: false, reason: 'ads_disabled' };
    }

    try {
      const today = getTodayString();
      const dailyCountStr = await AsyncStorage.getItem(STORAGE_KEYS.rewardedOffersCount(today));
      const dailyCount = dailyCountStr ? parseInt(dailyCountStr, 10) : 0;
      
      if (dailyCount >= RATE_LIMITS.rewardedMaxPerDay) {
        return { allowed: false, reason: 'daily_limit' };
      }

      return { allowed: true };
    } catch (error) {
      warn('[AdsProvider] Error checking rewarded limits:', error);
      return { allowed: false, reason: 'error' };
    }
  };

  const maybeShowInterstitial = async (tag: string): Promise<boolean> => {
    try {
      const { allowed, reason } = await canShowInterstitial();
      
      // Track attempt regardless of outcome
      track('ads.interstitial_attempt', {
        tag,
        allowed,
        reason_blocked: reason,
        tier,
        platform: Platform.OS,
      });

      if (!allowed) {
        debug(`[AdsProvider] Interstitial blocked: ${reason}`, { tag });
        return false;
      }

      // Attempt to show interstitial
      const shown = await showInterstitialAd();
      
      if (shown) {
        // Update rate limiting storage
        const now = Date.now();
        const today = getTodayString();
        
        await AsyncStorage.setItem(STORAGE_KEYS.lastInterstitialAt, now.toString());
        
        const dailyCountStr = await AsyncStorage.getItem(STORAGE_KEYS.interstitialCount(today));
        const dailyCount = dailyCountStr ? parseInt(dailyCountStr, 10) : 0;
        await AsyncStorage.setItem(STORAGE_KEYS.interstitialCount(today), (dailyCount + 1).toString());

        track('ads.interstitial_shown', {
          tag,
          tier,
          platform: Platform.OS,
        });

        debug(`[AdsProvider] Interstitial shown successfully`, { tag });
      } else {
        debug(`[AdsProvider] Interstitial failed to show`, { tag });
      }

      return shown;
    } catch (error) {
      warn('[AdsProvider] Error showing interstitial:', error);
      track('ads.interstitial_error', {
        tag,
        error: error instanceof Error ? error.message : 'Unknown error',
        tier,
        platform: Platform.OS,
      });
      return false;
    }
  };

  const offerRewarded = async (tag: string): Promise<{ shown: boolean; rewarded: boolean }> => {
    try {
      const { allowed, reason } = await canShowRewarded();
      
      if (!allowed) {
        debug(`[AdsProvider] Rewarded ad blocked: ${reason}`, { tag });
        track('ads.rewarded_blocked', {
          tag,
          reason_blocked: reason,
          tier,
          platform: Platform.OS,
        });
        return { shown: false, rewarded: false };
      }

      // Attempt to show rewarded ad
      const result = await showRewardedAd();
      
      if (result.shown) {
        // Update daily count
        const today = getTodayString();
        const dailyCountStr = await AsyncStorage.getItem(STORAGE_KEYS.rewardedOffersCount(today));
        const dailyCount = dailyCountStr ? parseInt(dailyCountStr, 10) : 0;
        await AsyncStorage.setItem(STORAGE_KEYS.rewardedOffersCount(today), (dailyCount + 1).toString());

        track('ads.rewarded_offer_shown', {
          tag,
          tier,
          platform: Platform.OS,
        });

        if (result.rewarded) {
          track('ads.rewarded_completed', {
            tag,
            reward: result.reward,
            tier,
            platform: Platform.OS,
          });
          debug(`[AdsProvider] Rewarded ad completed`, { tag, reward: result.reward });
        }
      }

      return result;
    } catch (error) {
      warn('[AdsProvider] Error with rewarded ad:', error);
      track('ads.rewarded_error', {
        tag,
        error: error instanceof Error ? error.message : 'Unknown error',
        tier,
        platform: Platform.OS,
      });
      return { shown: false, rewarded: false };
    }
  };

  const value = useMemo<AdsContextType>(
    () => ({
      ready,
      canShowBanner,
      maybeShowInterstitial,
      offerRewarded,
    }),
    [ready, canShowBanner]
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export function useAds() {
  const context = useContext(AdsContext);
  if (!context) {
    throw new Error('useAds must be used within an AdsProvider');
  }
  return context;
}