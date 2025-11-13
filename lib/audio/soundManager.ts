/**
 * Sound Manager - Society 5.0 Futuristic Audio System
 * 
 * Manages preloading, playback, and caching of UI sounds for optimal performance.
 * Designed for low-latency audio feedback (<50ms) with memory efficiency.
 */

import { Audio, AVPlaybackStatus } from 'expo-av';
import { Platform } from 'react-native';

export type OrbSound = 
  | 'awaken'      // FAB tap - AI waking up
  | 'pulse'       // Long press start
  | 'listening'   // Voice mode activated
  | 'thinking'    // Processing (loopable)
  | 'response'    // AI ready to respond
  | 'confirm'     // Action confirmed
  | 'error'       // Error state
  | 'dismiss';    // Modal close

interface SoundConfig {
  file: any;  // require() asset
  volume: number;
  loopable?: boolean;
}

const SOUND_ASSETS: Record<OrbSound, SoundConfig> = {
  // Using existing notification.wav as placeholder for all sounds
  // TODO: Replace with actual futuristic sound files when available
  awaken: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.4 
  },
  pulse: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.3 
  },
  listening: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.3,
    loopable: true 
  },
  thinking: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.2,
    loopable: true 
  },
  response: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.4 
  },
  confirm: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.3 
  },
  error: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.4 
  },
  dismiss: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.2 
  },
};

class SoundManagerClass {
  private sounds: Map<OrbSound, Audio.Sound> = new Map();
  private initialized = false;
  private loopingSounds: Set<OrbSound> = new Set();

  /**
   * Initialize audio system and preload sounds
   * Call this once during app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Configure audio mode for UI sounds (not music)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      console.log('[SoundManager] Audio mode configured');
      this.initialized = true;

      // Preload sounds in background (non-blocking)
      this.preloadSounds().catch(e => 
        console.warn('[SoundManager] Preload failed (non-critical):', e)
      );
    } catch (error) {
      console.error('[SoundManager] Initialization failed:', error);
    }
  }

  /**
   * Preload all sounds for instant playback
   */
  private async preloadSounds(): Promise<void> {
    console.log('[SoundManager] 🔊 Preloading sounds...');
    const startTime = Date.now();

    const loadPromises = Object.entries(SOUND_ASSETS).map(async ([key, config]) => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          config.file,
          { 
            volume: config.volume,
            shouldPlay: false,
          }
        );
        
        this.sounds.set(key as OrbSound, sound);
        console.log(`[SoundManager] ✅ Loaded: ${key}`);
      } catch (error) {
        console.warn(`[SoundManager] ❌ Failed to load ${key}:`, error);
      }
    });

    await Promise.all(loadPromises);
    
    const duration = Date.now() - startTime;
    console.log(`[SoundManager] 🎵 Preloaded ${this.sounds.size} sounds in ${duration}ms`);
  }

  /**
   * Play a sound with optional callback
   */
  async play(soundType: OrbSound, options?: { 
    loop?: boolean;
    onFinish?: () => void;
  }): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      let sound = this.sounds.get(soundType);
      
      // If sound not preloaded, load it on-demand
      if (!sound) {
        console.log(`[SoundManager] Loading ${soundType} on-demand...`);
        const config = SOUND_ASSETS[soundType];
        const { sound: newSound } = await Audio.Sound.createAsync(
          config.file,
          { volume: config.volume }
        );
        sound = newSound;
        this.sounds.set(soundType, sound);
      }

      // Stop and reset if already playing
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await sound.stopAsync();
      }
      await sound.setPositionAsync(0);

      // Configure looping
      if (options?.loop || SOUND_ASSETS[soundType].loopable) {
        await sound.setIsLoopingAsync(true);
        this.loopingSounds.add(soundType);
      } else {
        await sound.setIsLoopingAsync(false);
      }

      // Set up finish callback
      if (options?.onFinish) {
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            options.onFinish?.();
          }
        });
      }

      // Play sound
      await sound.playAsync();
      
      // Auto-cleanup for non-looping sounds
      if (!options?.loop && !SOUND_ASSETS[soundType].loopable) {
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync().catch(() => {});
          }
        });
      }
    } catch (error) {
      console.warn(`[SoundManager] Failed to play ${soundType}:`, error);
    }
  }

  /**
   * Stop a looping sound
   */
  async stop(soundType: OrbSound): Promise<void> {
    try {
      const sound = this.sounds.get(soundType);
      if (sound) {
        await sound.stopAsync();
        await sound.setPositionAsync(0);
        this.loopingSounds.delete(soundType);
      }
    } catch (error) {
      console.warn(`[SoundManager] Failed to stop ${soundType}:`, error);
    }
  }

  /**
   * Stop all looping sounds
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.loopingSounds).map(soundType => 
      this.stop(soundType)
    );
    await Promise.all(stopPromises);
  }

  /**
   * Cleanup all sounds (call on app unmount)
   */
  async cleanup(): Promise<void> {
    console.log('[SoundManager] Cleaning up...');
    
    const unloadPromises = Array.from(this.sounds.values()).map(sound =>
      sound.unloadAsync().catch(() => {})
    );
    
    await Promise.all(unloadPromises);
    this.sounds.clear();
    this.loopingSounds.clear();
    this.initialized = false;
    
    console.log('[SoundManager] Cleanup complete');
  }

  /**
   * Check if sound manager is ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Get preloaded sound count
   */
  getLoadedCount(): number {
    return this.sounds.size;
  }
}

// Singleton instance
export const SoundManager = new SoundManagerClass();

// Convenience functions
export const playOrbSound = (sound: OrbSound, options?: Parameters<typeof SoundManager.play>[1]) => 
  SoundManager.play(sound, options);

export const stopOrbSound = (sound: OrbSound) => 
  SoundManager.stop(sound);

export const stopAllOrbSounds = () => 
  SoundManager.stopAll();

// Initialize on import (non-blocking)
if (Platform.OS !== 'web') {
  SoundManager.initialize().catch(console.warn);
}
