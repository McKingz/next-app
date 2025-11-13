// Feedback utility for haptic feedback
// Uses Expo Haptics for vibration feedback

import * as Haptics from 'expo-haptics';

let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch { /* Intentional: non-fatal */ }

async function isEnabled(key: string, defaultVal = true): Promise<boolean> {
  try {
    const v = await AsyncStorage?.getItem(key);
    if (v === 'false') return false;
    if (v === 'true') return true;
    return defaultVal;
  } catch {
    return defaultVal;
  }
}

const Feedback = {
  async playSuccess() {
    try {
      const enabled = await isEnabled('pref_haptics_enabled', true);
      if (!enabled) return;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      // Haptics not available; ignore
    }
  },
  async vibrate(ms = 30) {
    try {
      const enabled = await isEnabled('pref_haptics_enabled', true);
      if (!enabled) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics not available; ignore
    }
  }
};

export default Feedback;
