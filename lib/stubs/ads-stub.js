// Stub implementation for react-native-google-mobile-ads on web platform
// This prevents bundling errors while maintaining mobile functionality

export const BannerAd = null;
export const InterstitialAd = {
  createForAdRequest: () => ({
    load: () => {},
    show: () => {},
    addAdEventListener: () => () => {}
  })
};
export const RewardedAd = null;
export const BannerAdSize = {};
export const AdEventType = {
  LOADED: 'loaded',
  CLOSED: 'closed',
  ERROR: 'error'
};
export const RewardedAdEventType = {};
export const TestIds = {
  BANNER: 'test-banner-id',
  INTERSTITIAL: 'test-interstitial-id',
  REWARDED: 'test-rewarded-id'
};
export const MaxAdContentRating = {
  G: 'G'
};

// Default export stub
const mobileAds = () => ({
  setRequestConfiguration: () => ({
    then: (callback) => callback()
  }),
  initialize: () => Promise.resolve()
});

export default mobileAds;