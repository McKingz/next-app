/**
 * Native SecureStore Wrapper
 * 
 * Uses expo-secure-store for secure credential storage on iOS/Android
 */

import * as SecureStore from 'expo-secure-store';

export const secureStore = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  deleteItem: SecureStore.deleteItemAsync,
};
