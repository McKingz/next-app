/**
 * Native Storage Adapter
 * Uses React Native AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  getItem: AsyncStorage.getItem,
  setItem: AsyncStorage.setItem,
  removeItem: AsyncStorage.removeItem,
};
