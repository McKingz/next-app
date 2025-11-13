/**
 * Wake Word Model Loader
 * 
 * Handles loading of custom Porcupine wake word models for React Native
 */

import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

export class WakeWordModelLoader {
  private static modelCache: Map<string, string> = new Map();

  /**
   * Load the Hello Dash wake word model for the current platform
   */
  static async loadHelloDashModel(): Promise<string> {
    const cacheKey = `hello-dash-${Platform.OS}`;
    
    // Return cached model path if available
    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey)!;
    }

    try {
      let modelAsset: Asset;
      
      if (Platform.OS === 'android') {
        // Load Android-specific model
        modelAsset = Asset.fromModule(require('../../assets/wake-words/hello-dash_en_android_v3_0_0.ppn'));
      } else if (Platform.OS === 'ios') {
        // For iOS, use the Linux model (should work)
        modelAsset = Asset.fromModule(require('../../assets/wake-words/Hello-Dash_en_linux_v3_0_0.ppn'));
      } else {
        // Fallback for other platforms
        modelAsset = Asset.fromModule(require('../../assets/wake-words/Hello-Dash_en_linux_v3_0_0.ppn'));
      }

      // Ensure the asset is downloaded
      await modelAsset.downloadAsync();
      
      if (!modelAsset.localUri) {
        throw new Error('Failed to load wake word model asset');
      }

      // Cache the model path
      this.modelCache.set(cacheKey, modelAsset.localUri);
      
      console.log(`[WakeWordModelLoader] Loaded Hello Dash model for ${Platform.OS}:`, modelAsset.localUri);
      return modelAsset.localUri;
      
    } catch (error) {
      console.error('[WakeWordModelLoader] Failed to load Hello Dash model:', error);
      throw new Error(`Failed to load Hello Dash wake word model: ${error}`);
    }
  }

  /**
   * Clear the model cache (useful for debugging)
   */
  static clearCache(): void {
    this.modelCache.clear();
    console.log('[WakeWordModelLoader] Model cache cleared');
  }

  /**
   * Check if a model is cached
   */
  static isModelCached(platform: string = Platform.OS): boolean {
    return this.modelCache.has(`hello-dash-${platform}`);
  }
}