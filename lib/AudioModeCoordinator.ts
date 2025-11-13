/**
 * AudioModeCoordinator - Central audio mode management
 * 
 * Coordinates all expo-av Audio.setAudioModeAsync calls to prevent conflicts
 * between WebRTC streaming, TTS playback, and notification sounds.
 * 
 * Priority order (highest to lowest):
 * 1. streaming - WebRTC voice input (requires allowsRecordingIOS: true)
 * 2. tts - Text-to-speech playback
 * 3. notification - System notification sounds
 * 4. idle - Default state
 * 
 * Usage:
 * ```typescript
 * const coordinator = AudioModeCoordinator.getInstance();
 * 
 * // Start streaming session
 * const session = await coordinator.requestAudioMode('streaming');
 * // ... do streaming work ...
 * await session.release(); // Always release when done
 * 
 * // Or use auto-release pattern
 * await coordinator.withAudioMode('tts', async () => {
 *   // TTS code here
 * });
 * ```
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export type AudioMode = 'idle' | 'notification' | 'tts' | 'streaming';

export interface AudioModeSession {
  mode: AudioMode;
  id: string;
  release: () => Promise<void>;
}

interface AudioModeConfig {
  allowsRecordingIOS: boolean;
  playsInSilentModeIOS: boolean;
  shouldDuckAndroid: boolean;
  playThroughEarpieceAndroid: boolean;
  staysActiveInBackground?: boolean;
}

/**
 * Central coordinator for all audio mode changes
 * Singleton pattern ensures single source of truth
 */
export class AudioModeCoordinator {
  private static instance: AudioModeCoordinator;

  private currentMode: AudioMode = 'idle';
  private activeSessions = new Map<string, AudioMode>();
  private sessionCounter = 0;
  private isInitialized = false;

  // Priority levels for conflict resolution
  private readonly modePriority: Record<AudioMode, number> = {
    streaming: 4, // Highest - needs mic access
    tts: 3,
    notification: 2,
    idle: 1,
  };

  // Audio mode configurations for each state
  private readonly modeConfigs: Record<AudioMode, AudioModeConfig> = {
    streaming: {
      allowsRecordingIOS: true, // CRITICAL: WebRTC needs this
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false, // Don't duck during streaming
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    },
    tts: {
      allowsRecordingIOS: true, // Keep recording enabled for quick transitions
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false, // TTS shouldn't be ducked
      playThroughEarpieceAndroid: false,
    },
    notification: {
      allowsRecordingIOS: true, // Keep recording enabled (safe default)
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true, // Notifications can duck other audio
      playThroughEarpieceAndroid: false,
    },
    idle: {
      allowsRecordingIOS: true, // Always keep recording available
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    },
  };

  private constructor() {}

  public static getInstance(): AudioModeCoordinator {
    if (!AudioModeCoordinator.instance) {
      AudioModeCoordinator.instance = new AudioModeCoordinator();
    }
    return AudioModeCoordinator.instance;
  }

  /**
   * Initialize the coordinator
   * Sets up default audio mode
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.applyAudioMode('idle');
      this.isInitialized = true;
      console.log('[AudioModeCoordinator] ✅ Initialized with idle mode');
    } catch (error) {
      console.error('[AudioModeCoordinator] ❌ Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Request an audio mode session
   * Returns a session object that MUST be released when done
   */
  public async requestAudioMode(mode: AudioMode): Promise<AudioModeSession> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const sessionId = `${mode}_${++this.sessionCounter}_${Date.now()}`;
    this.activeSessions.set(sessionId, mode);

    console.log(
      `[AudioModeCoordinator] 📝 Session requested: ${sessionId} (${mode})`
    );

    // Apply the highest priority mode
    await this.updateAudioMode();

    return {
      mode,
      id: sessionId,
      release: async () => {
        await this.releaseSession(sessionId);
      },
    };
  }

  /**
   * Execute code with automatic audio mode management
   * Automatically releases the session when done or on error
   */
  public async withAudioMode<T>(
    mode: AudioMode,
    callback: () => Promise<T>
  ): Promise<T> {
    const session = await this.requestAudioMode(mode);
    try {
      return await callback();
    } finally {
      await session.release();
    }
  }

  /**
   * Release a session and restore appropriate audio mode
   */
  private async releaseSession(sessionId: string): Promise<void> {
    const hadMode = this.activeSessions.get(sessionId);
    this.activeSessions.delete(sessionId);

    console.log(
      `[AudioModeCoordinator] 🔓 Session released: ${sessionId} (${hadMode})`
    );

    // Update to next highest priority mode
    await this.updateAudioMode();
  }

  /**
   * Update audio mode based on active sessions
   * Applies the highest priority mode among all active sessions
   */
  private async updateAudioMode(): Promise<void> {
    // Find highest priority mode among active sessions
    let highestPriority = this.modePriority.idle;
    let targetMode: AudioMode = 'idle';

    for (const mode of this.activeSessions.values()) {
      const priority = this.modePriority[mode];
      if (priority > highestPriority) {
        highestPriority = priority;
        targetMode = mode;
      }
    }

    // Only change if needed
    if (targetMode !== this.currentMode) {
      console.log(
        `[AudioModeCoordinator] 🔄 Mode transition: ${this.currentMode} → ${targetMode}`
      );
      await this.applyAudioMode(targetMode);
    }
  }

  /**
   * Apply audio mode configuration
   */
  private async applyAudioMode(mode: AudioMode): Promise<void> {
    const config = this.modeConfigs[mode];

    try {
      await Audio.setAudioModeAsync(config);
      this.currentMode = mode;
      console.log(
        `[AudioModeCoordinator] ✅ Applied mode: ${mode}`,
        config
      );
    } catch (error) {
      console.error(
        `[AudioModeCoordinator] ❌ Failed to apply mode ${mode}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get current audio mode
   */
  public getCurrentMode(): AudioMode {
    return this.currentMode;
  }

  /**
   * Get active session count
   */
  public getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get active sessions breakdown
   */
  public getActiveSessions(): Record<AudioMode, number> {
    const breakdown: Record<AudioMode, number> = {
      idle: 0,
      notification: 0,
      tts: 0,
      streaming: 0,
    };

    for (const mode of this.activeSessions.values()) {
      breakdown[mode]++;
    }

    return breakdown;
  }

  /**
   * Debug info
   */
  public getDebugInfo(): {
    currentMode: AudioMode;
    activeSessionCount: number;
    sessionBreakdown: Record<AudioMode, number>;
    isInitialized: boolean;
  } {
    return {
      currentMode: this.currentMode,
      activeSessionCount: this.activeSessions.size,
      sessionBreakdown: this.getActiveSessions(),
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Emergency reset - use only in error recovery
   */
  public async reset(): Promise<void> {
    console.warn(
      '[AudioModeCoordinator] ⚠️ Emergency reset - clearing all sessions'
    );
    this.activeSessions.clear();
    await this.applyAudioMode('idle');
  }
}

export default AudioModeCoordinator.getInstance();
