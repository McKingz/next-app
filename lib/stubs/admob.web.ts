/**
 * Web stub for react-native-google-mobile-ads
 * Prevents errors when AdMob components are rendered on web
 */

import { ComponentType } from 'react';

export const BannerAd: ComponentType<any> | null = null;

export const InterstitialAd = {
  createForAdRequest: () => ({
    load: () => {},
    show: () => {},
    addAdEventListener: () => () => {}
  })
};

export const RewardedAd: ComponentType<any> | null = null;

export const BannerAdSize = {
  BANNER: 'BANNER',
  FULL_BANNER: 'FULL_BANNER',
  LARGE_BANNER: 'LARGE_BANNER',
  LEADERBOARD: 'LEADERBOARD',
  MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
  ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
};

export const AdEventType = {
  LOADED: 'loaded',
  CLOSED: 'closed',
  OPENED: 'opened',
  ERROR: 'error',
  CLICKED: 'clicked',
  IMPRESSION: 'impression',
};

export const RewardedAdEventType = {
  LOADED: 'loaded',
  EARNED_REWARD: 'earned_reward',
};

export const TestIds = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  REWARDED_INTERSTITIAL: 'ca-app-pub-3940256099942544/5354046379',
};

export const MaxAdContentRating = {
  G: 'G',
  PG: 'PG',
  T: 'T',
  MA: 'MA',
};

// Default export stub
const mobileAds = () => ({
  setRequestConfiguration: (config: any) => Promise.resolve(),
  initialize: () => Promise.resolve({}),
});

export default mobileAds;
