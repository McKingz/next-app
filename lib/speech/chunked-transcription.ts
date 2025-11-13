/**
 * Chunked Transcription Client
 * 
 * Implements real-time feel using batch transcription by sending 1-second audio chunks
 * to the transcribe-chunk Edge Function as they're recorded.
 * 
 * Features:
 * - MediaRecorder with 1s timeslice (web)
 * - Automatic chunk upload and transcription
 * - Out-of-order chunk handling
 * - Progressive transcript stitching
 * - Fallback handling
 */

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { logger } from '@/lib/logger';

export interface ChunkTranscriptResult {
  text: string;
  chunkIndex: number;
  latency: number;
  provider?: string;
}

export interface ChunkedTranscriptionConfig {
  sessionId?: string;
  chunkDurationMs?: number;
  language?: string;
  onChunkResult?: (result: ChunkTranscriptResult) => void;
  onError?: (error: Error, chunkIndex: number) => void;
}

export class ChunkedTranscription {
  private sessionId: string;
  private chunkIndex = 0;
  private chunkMap = new Map<number, string>();
  private mediaRecorder: any = null;
  private config: Required<ChunkedTranscriptionConfig>;
  private startTime: number = 0;
  private chunkLatencies: number[] = [];
  
  constructor(config: ChunkedTranscriptionConfig = {}) {
    // Generate unique session ID
    this.sessionId = config.sessionId || this.generateSessionId();
    
    // Default configuration
    this.config = {
      sessionId: this.sessionId,
      chunkDurationMs: config.chunkDurationMs || 1000,
      language: config.language || 'en',
      onChunkResult: config.onChunkResult || (() => {}),
      onError: config.onError || ((error) => console.error('Chunk error:', error)),
    };
  }
  
  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Check if MediaRecorder is supported with preferred codec
   */
  public static isSupported(): boolean {
    if (typeof MediaRecorder === 'undefined') {
      return false;
    }
    
    // Check for Opus codec support (best for speech)
    return MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ||
           MediaRecorder.isTypeSupported('audio/webm') ||
           MediaRecorder.isTypeSupported('audio/ogg;codecs=opus');
  }
  
  /**
   * Get best supported MIME type
   */
  private getBestMimeType(): string {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      return 'audio/ogg;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      return 'audio/webm';
    }
    return 'audio/webm'; // Fallback
  }
  
  /**
   * Start chunked recording and transcription
   */
  async startChunking(stream: MediaStream): Promise<void> {
    if (!ChunkedTranscription.isSupported()) {
      throw new Error('MediaRecorder not supported in this browser');
    }
    
    const mimeType = this.getBestMimeType();
    logger.info('Starting chunked transcription', {
      sessionId: this.sessionId,
      mimeType,
      chunkDurationMs: this.config.chunkDurationMs
    });
    
    try {
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 32000, // Optimized for speech
      });
      
      this.startTime = Date.now();
      
      // Handle chunk data
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0) {
          const chunkIdx = this.chunkIndex++;
          const chunkStartTime = Date.now();
          
          logger.debug(`Chunk ${chunkIdx} available`, { size: event.data.size });
          
          // Upload and transcribe chunk (don't await - process in parallel)
          this.uploadChunk(event.data, chunkIdx, chunkStartTime).catch((error) => {
            this.config.onError(error, chunkIdx);
          });
        }
      };
      
      // Handle errors
      this.mediaRecorder.onerror = (event: any) => {
        logger.error('MediaRecorder error:', event.error);
        this.config.onError(new Error(`MediaRecorder error: ${event.error?.message || 'Unknown'}`), -1);
      };
      
      // Start recording with timeslice
      this.mediaRecorder.start(this.config.chunkDurationMs);
      
      logger.info('MediaRecorder started');
      
      // Track start event
      track('chunked_transcription_started', {
        session_id: this.sessionId,
        chunk_duration_ms: this.config.chunkDurationMs,
        mime_type: mimeType
      });
      
    } catch (error: any) {
      logger.error('Failed to start MediaRecorder:', error);
      throw new Error(`Failed to start recording: ${error.message}`);
    }
  }
  
  /**
   * Upload and transcribe a single chunk
   */
  private async uploadChunk(
    blob: Blob,
    chunkIdx: number,
    chunkStartTime: number
  ): Promise<void> {
    try {
      const supabase = assertSupabase();
      
      // Create form data
      const formData = new FormData();
      (formData as any).append('audio', blob as any, `chunk-${chunkIdx}.webm`);
      formData.append('session_id', this.sessionId);
      formData.append('chunk_index', chunkIdx.toString());
      formData.append('language', this.config.language);
      
      logger.debug(`Uploading chunk ${chunkIdx}...`);
      
      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('transcribe-chunk', {
        body: formData,
      });
      
      if (error) {
        throw new Error(`Edge Function error: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('No data returned from transcription');
      }
      
      const latency = Date.now() - chunkStartTime;
      this.chunkLatencies.push(latency);
      
      logger.info(`Chunk ${chunkIdx} transcribed`, {
        latency_ms: latency,
        transcript_length: data.transcript?.length || 0,
        provider: data.provider
      });
      
      // Store transcript
      if (data.transcript) {
        this.chunkMap.set(chunkIdx, data.transcript);
        
        // Notify callback
        this.config.onChunkResult({
          text: data.transcript,
          chunkIndex: chunkIdx,
          latency,
          provider: data.provider
        });
      }
      
    } catch (error: any) {
      logger.error(`Chunk ${chunkIdx} failed:`, error);
      // Don't throw - allow other chunks to continue
      this.config.onError(error, chunkIdx);
    }
  }
  
  /**
   * Stop recording
   */
  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      logger.info('Stopping MediaRecorder');
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
      
      // Track session stats
      const totalDuration = Date.now() - this.startTime;
      const avgLatency = this.chunkLatencies.length > 0
        ? this.chunkLatencies.reduce((a, b) => a + b, 0) / this.chunkLatencies.length
        : 0;
      
      track('chunked_transcription_stopped', {
        session_id: this.sessionId,
        total_duration_ms: totalDuration,
        total_chunks: this.chunkIndex,
        avg_chunk_latency_ms: avgLatency,
        chunk_success_rate: this.chunkMap.size / Math.max(this.chunkIndex, 1)
      });
    }
  }
  
  /**
   * Get stitched transcript from all chunks in order
   */
  getStitchedTranscript(): string {
    const indices = Array.from(this.chunkMap.keys()).sort((a, b) => a - b);
    return indices
      .map(idx => this.chunkMap.get(idx))
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  
  /**
   * Get chunk map for debugging
   */
  getChunkMap(): Map<number, string> {
    return new Map(this.chunkMap);
  }
  
  /**
   * Get statistics
   */
  getStats() {
    const totalDuration = Date.now() - this.startTime;
    const avgLatency = this.chunkLatencies.length > 0
      ? this.chunkLatencies.reduce((a, b) => a + b, 0) / this.chunkLatencies.length
      : 0;
    
    return {
      sessionId: this.sessionId,
      totalChunks: this.chunkIndex,
      successfulChunks: this.chunkMap.size,
      totalDurationMs: totalDuration,
      avgChunkLatencyMs: avgLatency,
      chunkSuccessRate: this.chunkMap.size / Math.max(this.chunkIndex, 1),
      transcriptLength: this.getStitchedTranscript().length
    };
  }
}
