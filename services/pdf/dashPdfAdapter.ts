/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Dash PDF Adapter
 * 
 * Reactive wrapper around DashPDFGenerator service that provides:
 * - Observable progress events
 * - Normalized error handling
 * - UI-friendly data structures
 * - Graceful fallbacks and retries
 */

import { BehaviorSubject, Subject, Observable, combineLatest } from 'rxjs';
import { map, distinctUntilChanged, debounceTime, catchError, retry, timeout } from 'rxjs/operators';
import { getDashPDFGenerator } from '@/services/DashPDFGenerator';
import type {
  DocumentType,
  PDFGenerationRequest,
  PDFGenerationResult,
  ProgressPhase,
  ProgressCallback,
  UserPDFPreferences,
  CustomTemplate,
  BrandingOptions,
} from '@/services/DashPDFGenerator';
import type {
  GenerationJob,
  TemplateGalleryItem,
  PreferenceSet,
  HistoryItem,
  PDFGeneratorState,
} from '@/types/pdf';
import { logger } from '@/lib/logger';

// Progress event interface
export interface PDFProgressEvent {
  jobId: string;
  phase: ProgressPhase;
  percentage: number;
  message?: string;
  timeElapsed: number;
  timeRemaining?: number;
  status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
  error?: string;
}

// Generation options with UI defaults
export interface GenerationOptions {
  enablePreview?: boolean;
  timeout?: number;
  retries?: number;
  priority?: 'low' | 'normal' | 'high';
  onProgress?: (event: PDFProgressEvent) => void;
}

/**
 * Reactive PDF Generator Adapter
 */
export class DashPDFAdapter {
  private generator = getDashPDFGenerator();
  
  // Reactive state streams
  private _progressSubject = new BehaviorSubject<PDFProgressEvent | null>(null);
  private _jobsSubject = new BehaviorSubject<Map<string, GenerationJob>>(new Map());
  private _templatesSubject = new BehaviorSubject<TemplateGalleryItem[]>([]);
  private _preferencesSubject = new BehaviorSubject<PreferenceSet | null>(null);
  private _historySubject = new BehaviorSubject<HistoryItem[]>([]);
  
  // Public observables
  public readonly progress$ = this._progressSubject.asObservable().pipe(
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
  );
  
  public readonly jobs$ = this._jobsSubject.asObservable().pipe(
    map(jobMap => Array.from(jobMap.values())),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
  );
  
  public readonly templates$ = this._templatesSubject.asObservable();
  public readonly preferences$ = this._preferencesSubject.asObservable();
  public readonly history$ = this._historySubject.asObservable();
  
  // Combined state stream
  public readonly state$ = combineLatest([
    this.progress$,
    this.jobs$,
    this.templates$,
    this.preferences$,
    this.history$
  ]).pipe(
    map(([progress, jobs, templates, preferences, history]) => ({
      currentProgress: progress,
      activeJobs: jobs.filter(job => job.status === 'processing'),
      recentJobs: jobs.slice(0, 10),
      templates,
      preferences,
      history: history.slice(0, 50), // Recent history
    })),
    debounceTime(100), // Prevent excessive updates
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
  );

  constructor() {
    // Initialize preferences on startup
    this.loadUserPreferences();
  }

  /**
   * Generate PDF from prompt with reactive progress
   */
  generateFromPrompt(
    prompt: string,
    options: GenerationOptions = {}
  ): Observable<PDFProgressEvent> {
    const jobId = this.generateJobId();
    const startTime = Date.now();
    
    // Create initial job
    const job: GenerationJob = {
      id: jobId,
      userId: '', // Will be set by generator
      type: 'prompt',
      title: this.extractTitleFromPrompt(prompt),
      status: 'pending',
      input: {
        type: 'general',
        title: this.extractTitleFromPrompt(prompt),
        prompt,
      },
      progress: {
        phase: 'parse',
        percentage: 0,
        message: 'Preparing to generate...',
        timeElapsed: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update job state
    this.updateJob(job);

    return new Observable<PDFProgressEvent>(subscriber => {
      let isCancelled = false;

      // Progress callback
      const onProgress: ProgressCallback = (phase, percentage, message) => {
        if (isCancelled) return;

        const timeElapsed = Date.now() - startTime;
        const timeRemaining = percentage > 0 
          ? (timeElapsed / percentage) * (100 - percentage)
          : undefined;

        const progressEvent: PDFProgressEvent = {
          jobId,
          phase,
          percentage,
          message,
          timeElapsed,
          timeRemaining,
          status: 'running',
        };

        // Update job progress
        job.status = 'processing';
        job.progress = {
          phase,
          percentage,
          message,
          timeElapsed,
          timeRemaining,
        };
        job.updatedAt = new Date().toISOString();
        this.updateJob(job);

        // Emit progress event
        this._progressSubject.next(progressEvent);
        subscriber.next(progressEvent);
        options.onProgress?.(progressEvent);
      };

      // Execute generation
      this.generator.generateFromPrompt(prompt, {}, onProgress)
        .then(result => {
          if (isCancelled) return;

          const finalEvent: PDFProgressEvent = {
            jobId,
            phase: 'upload',
            percentage: 100,
            message: result.success ? 'Generation completed!' : 'Generation failed',
            timeElapsed: Date.now() - startTime,
            status: result.success ? 'completed' : 'error',
            error: result.error,
          };

          // Update final job state
          job.status = result.success ? 'completed' : 'failed';
          job.result = result;
          job.completedAt = new Date().toISOString();
          job.error = result.error;
          this.updateJob(job);

          // Add to history if successful
          if (result.success) {
            this.addToHistory(job);
          }

          this._progressSubject.next(finalEvent);
          subscriber.next(finalEvent);
          subscriber.complete();
        })
        .catch(error => {
          if (isCancelled) return;

          const errorEvent: PDFProgressEvent = {
            jobId,
            phase: 'upload',
            percentage: 0,
            message: 'Generation failed',
            timeElapsed: Date.now() - startTime,
            status: 'error',
            error: error.message,
          };

          job.status = 'failed';
          job.error = error.message;
          this.updateJob(job);

          this._progressSubject.next(errorEvent);
          subscriber.error(error);
        });

      // Return cancellation function
      return () => {
        isCancelled = true;
        job.status = 'cancelled';
        this.updateJob(job);
      };
    }).pipe(
      timeout(options.timeout || 120000), // 2 minute timeout
      retry(options.retries || 0),
      catchError(error => {
        logger.error('[DashPDFAdapter] Generation failed:', error);
        throw error;
      })
    );
  }

  /**
   * Generate PDF from template
   */
  generateFromTemplate(
    templateId: string,
    data: Record<string, any>,
    options: GenerationOptions = {}
  ): Observable<PDFProgressEvent> {
    const jobId = this.generateJobId();
    
    return new Observable<PDFProgressEvent>(subscriber => {
      let isCancelled = false;
      const startTime = Date.now();

      // Get template asynchronously
      this.getTemplate(templateId).then(template => {
        if (isCancelled) return;
        
        if (!template) {
          subscriber.error(new Error(`Template not found: ${templateId}`));
          return;
        }

        const job: GenerationJob = {
          id: jobId,
          userId: '',
          type: 'template',
          title: `${template.name} - ${data.title || 'Document'}`,
          status: 'pending',
          input: {
            type: template.documentType,
            title: data.title || template.name,
            templateId,
            data,
          },
          progress: {
            phase: 'retrieve',
            percentage: 0,
            message: 'Loading template...',
            timeElapsed: 0,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        this.updateJob(job);

        const onProgress: ProgressCallback = (phase, percentage, message) => {
          if (isCancelled) return;

          const progressEvent: PDFProgressEvent = {
            jobId,
            phase,
            percentage,
            message,
            timeElapsed: Date.now() - startTime,
            status: 'running',
          };

          job.status = 'processing';
          job.progress = {
            phase,
            percentage,
            message,
            timeElapsed: Date.now() - startTime,
          };
          this.updateJob(job);

          this._progressSubject.next(progressEvent);
          subscriber.next(progressEvent);
          options.onProgress?.(progressEvent);
        };

        this.generator.generateFromTemplate(templateId, data, {}, onProgress)
          .then(result => {
            if (isCancelled) return;

            const finalEvent: PDFProgressEvent = {
              jobId,
              phase: 'upload',
              percentage: 100,
              message: result.success ? 'Generation completed!' : 'Generation failed',
              timeElapsed: Date.now() - startTime,
              status: result.success ? 'completed' : 'error',
              error: result.error,
            };

            job.status = result.success ? 'completed' : 'failed';
            job.result = result;
            job.completedAt = new Date().toISOString();
            job.error = result.error;
            this.updateJob(job);

            if (result.success) {
              this.addToHistory(job);
            }

            subscriber.next(finalEvent);
            subscriber.complete();
          })
          .catch(error => {
            if (isCancelled) return;
            subscriber.error(error);
          });
      })
      .catch(error => {
        if (isCancelled) return;
        subscriber.error(error);
      });

      return () => {
        isCancelled = true;
      };
    });
  }

  /**
   * Generate preview HTML
   */
  async generatePreview(request: PDFGenerationRequest): Promise<{ html: string; warnings: string[] }> {
    try {
      return await this.generator.previewHTML(request);
    } catch (error) {
      logger.error('[DashPDFAdapter] Preview generation failed:', error);
      throw error;
    }
  }

  /**
   * Load user preferences
   */
  async loadUserPreferences(): Promise<PreferenceSet | null> {
    try {
      const prefs = await this.generator.loadUserPreferences();
      const preferenceSet = prefs ? this.mapToPreferenceSet(prefs) : null;
      this._preferencesSubject.next(preferenceSet);
      return preferenceSet;
    } catch (error) {
      logger.error('[DashPDFAdapter] Failed to load preferences:', error);
      return null;
    }
  }

  /**
   * Save user preferences
   */
  async saveUserPreferences(preferences: Partial<PreferenceSet>): Promise<boolean> {
    try {
      const userPrefs = this.mapToUserPDFPreferences(preferences);
      const success = await this.generator.saveUserPreferences(userPrefs);
      
      if (success) {
        await this.loadUserPreferences(); // Refresh
      }
      
      return success;
    } catch (error) {
      logger.error('[DashPDFAdapter] Failed to save preferences:', error);
      return false;
    }
  }

  /**
   * Load templates
   */
  async loadTemplates(filters?: {
    documentType?: DocumentType;
    orgShared?: boolean;
    publicOnly?: boolean;
  }): Promise<TemplateGalleryItem[]> {
    try {
      const templates = await this.generator.listCustomTemplates(filters);
      const galleryItems = templates.map(this.mapToTemplateGalleryItem);
      this._templatesSubject.next(galleryItems);
      return galleryItems;
    } catch (error) {
      logger.error('[DashPDFAdapter] Failed to load templates:', error);
      return [];
    }
  }

  /**
   * Get single template
   */
  async getTemplate(templateId: string): Promise<TemplateGalleryItem | null> {
    try {
      const template = await this.generator.getTemplate(templateId);
      return template ? this.mapToTemplateGalleryItem(template) : null;
    } catch (error) {
      logger.error('[DashPDFAdapter] Failed to get template:', error);
      return null;
    }
  }

  /**
   * Cancel active job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const jobs = this._jobsSubject.value;
    const job = jobs.get(jobId);
    
    if (job && job.status === 'processing') {
      job.status = 'cancelled';
      job.updatedAt = new Date().toISOString();
      this.updateJob(job);
      return true;
    }
    
    return false;
  }

  /**
   * Get current state synchronously
   */
  getState() {
    const jobs = Array.from(this._jobsSubject.value.values());
    const currentJob = jobs.find(job => job.status === 'processing' || job.status === 'completed');
    
    return {
      currentProgress: this._progressSubject.value,
      currentJob,
      activeJobs: jobs.filter(job => job.status === 'processing'),
      recentJobs: jobs.slice(0, 10),
      templates: this._templatesSubject.value,
      preferences: this._preferencesSubject.value,
      history: this._historySubject.value.slice(0, 50),
    };
  }

  // Private utility methods
  private generateJobId(): string {
    return `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractTitleFromPrompt(prompt: string): string {
    const firstLine = prompt.split('\n')[0].trim();
    if (firstLine.length > 0 && firstLine.length <= 100) {
      return firstLine;
    }
    
    const firstSentence = prompt.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 0 && firstSentence.length <= 100) {
      return firstSentence;
    }
    
    return 'Untitled Document';
  }

  private updateJob(job: GenerationJob): void {
    const jobs = new Map(this._jobsSubject.value);
    jobs.set(job.id, job);
    this._jobsSubject.next(jobs);
  }

  private addToHistory(job: GenerationJob): void {
    if (!job.result?.success) return;

    const historyItem: HistoryItem = {
      id: `history_${job.id}`,
      userId: job.userId,
      organizationId: job.organizationId,
      jobId: job.id,
      title: job.title,
      documentType: job.input.type,
      generationType: job.type,
      templateId: job.input.templateId,
      fileUri: job.result.uri,
      storagePath: job.result.storagePath,
      filename: job.result.filename,
      pageCount: job.result.pageCount,
      status: 'completed',
      createdAt: job.completedAt || new Date().toISOString(),
      isFavorite: false,
    };

    const history = [historyItem, ...this._historySubject.value.slice(0, 49)];
    this._historySubject.next(history);
  }

  private mapToPreferenceSet(prefs: UserPDFPreferences): PreferenceSet {
    return {
      id: prefs.id,
      userId: prefs.userId,
      organizationId: prefs.organizationId,
      name: 'Default',
      isDefault: true,
      theme: prefs.defaultTheme || 'professional',
      paperSize: 'A4', // Default since not in UserPDFPreferences
      orientation: 'portrait', // Default since not in UserPDFPreferences
      branding: prefs.defaultBranding || {},
      fonts: {
        primary: prefs.defaultFont || 'Arial, sans-serif',
      },
      margins: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20,
      },
      enablePageNumbers: true,
      enableWatermark: false,
      headerHtml: prefs.headerHtmlSafe,
      footerHtml: prefs.footerHtmlSafe,
      createdAt: prefs.createdAt || new Date().toISOString(),
      updatedAt: prefs.updatedAt || new Date().toISOString(),
    };
  }

  private mapToUserPDFPreferences(prefs: Partial<PreferenceSet>): Partial<UserPDFPreferences> {
    return {
      defaultTheme: prefs.theme,
      defaultFont: prefs.fonts?.primary,
      defaultBranding: prefs.branding,
      headerHtmlSafe: prefs.headerHtml,
      footerHtmlSafe: prefs.footerHtml,
    };
  }

  private mapToTemplateGalleryItem(template: CustomTemplate): TemplateGalleryItem {
    return {
      id: template.id || '',
      name: template.name,
      description: template.description,
      documentType: template.documentType,
      thumbnailUrl: template.thumbnailUrl,
      ownerUserId: template.ownerUserId,
      ownerName: 'User', // Would need to fetch from user service
      organizationId: template.organizationId,
      organizationName: 'Organization', // Would need to fetch
      isPublic: template.isPublic || false,
      isOrgShared: template.isOrgShared || false,
      isFavorited: false, // Would need to check user favorites
      usageCount: 0, // Would need to track usage
      tags: [],
      createdAt: template.createdAt || new Date().toISOString(),
      updatedAt: template.updatedAt || new Date().toISOString(),
      inputSchema: template.inputSchema,
      version: 1,
    };
  }
}

// Singleton instance
let adapterInstance: DashPDFAdapter | null = null;

export function getDashPDFAdapter(): DashPDFAdapter {
  if (!adapterInstance) {
    adapterInstance = new DashPDFAdapter();
  }
  return adapterInstance;
}

export default getDashPDFAdapter;