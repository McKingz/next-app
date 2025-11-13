/**
 * DashAIVoiceFacade
 * 
 * Facade for voice-related operations: recording, transcription, and text-to-speech.
 * Delegates to DashVoiceService.
 */

import { DashVoiceService, type TranscriptionResult, type SpeechCallbacks } from '../DashVoiceService';

export class DashAIVoiceFacade {
  constructor(private voiceService: DashVoiceService) {}

  /**
   * Start voice recording
   */
  public async startRecording(): Promise<void> {
    return this.voiceService.startRecording();
  }

  /**
   * Stop recording and return audio URI
   */
  public async stopRecording(): Promise<string> {
    return this.voiceService.stopRecording();
  }

  /**
   * Check if currently recording
   */
  public isCurrentlyRecording(): boolean {
    return this.voiceService.isCurrentlyRecording();
  }

  /**
   * Transcribe audio file
   */
  public async transcribeAudio(audioUri: string, userId?: string): Promise<TranscriptionResult> {
    return this.voiceService.transcribeAudio(audioUri, userId);
  }

  /**
   * Speak text using TTS
   */
  public async speakText(
    text: string, 
    callbacks?: SpeechCallbacks, 
    opts?: { language?: string }
  ): Promise<void> {
    return this.voiceService.speakText(text, callbacks, opts);
  }

  /**
   * Stop speaking
   */
  public async stopSpeaking(): Promise<void> {
    return this.voiceService.stopSpeaking();
  }

  /**
   * Dispose voice service resources
   */
  public dispose(): void {
    this.voiceService.dispose();
  }
}
