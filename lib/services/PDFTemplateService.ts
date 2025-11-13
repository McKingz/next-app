/**
 * PDF Template Service
 * 
 * Registry and rendering engine for educational PDF templates.
 * Supports multiple document types with theming and branding.
 */

import { getPDFConfig, PDFDocumentType, PDFTheme, type PDFBranding, DEFAULT_BRANDING } from '@/lib/config/pdfConfig';
import { EducationalPDFService } from './EducationalPDFService';

// ====================================================================
// DATA MODELS
// ====================================================================

export interface StudyGuideData {
  topic: string;
  gradeLevel: number;
  subject?: string;
  introduction: string;
  objectives: string[];
  sections: Array<{
    title: string;
    content: string;
    keyPoints?: string[];
  }>;
  vocabulary: Array<{
    term: string;
    definition: string;
    example?: string;
  }>;
  practiceQuestions: Array<{
    question: string;
    type: 'multiple-choice' | 'short-answer' | 'essay';
    options?: string[];
    answer?: string;
  }>;
  answerKey?: boolean;
  additionalResources?: string[];
}

export interface LessonPlanData {
  topic: string;
  subject: string;
  gradeLevel: number;
  duration: number; // minutes
  objectives: string[];
  standards?: string[];
  materials: string[];
  procedure: Array<{
    title: string;
    description: string;
    duration?: string;
  }>;
  differentiation?: {
    support: string[];
    extension: string[];
  };
  assessment: {
    formative: string[];
    summative?: string;
  };
  exitTicket?: string;
  reflectionNotes?: string;
}

export interface ProgressReportData {
  student: {
    name: string;
    grade: number;
    id?: string;
    photo?: string; // base64 or URL
  };
  reportingPeriod: string;
  subjects: Array<{
    name: string;
    grade: string; // A, B, C or percentage
    progress: number; // 0-100
    strengths: string[];
    areasForGrowth: string[];
    teacherComments: string;
  }>;
  overallProgress: number;
  achievements: string[];
  recommendations: string[];
  attendance?: {
    present: number;
    absent: number;
    tardy: number;
  };
  teacherName: string;
  teacherSignature?: string;
  parentComments?: string;
}

export interface AssessmentData {
  title: string;
  subject: string;
  gradeLevel: number;
  duration: number; // minutes
  totalPoints: number;
  instructions: string;
  sections: Array<{
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    points: number;
    questions: Array<{
      id: number;
      question: string;
      type: 'multiple-choice' | 'short-answer' | 'essay' | 'true-false';
      points: number;
      options?: string[];
      answer?: string;
    }>;
  }>;
  rubric?: Array<{
    name: string;
    levels: Array<{
      label: string;
      description: string;
      points: number;
    }>;
  }>;
  answerKey?: boolean;
}

export interface CertificateData {
  recipientName: string;
  achievement: string;
  description?: string;
  date: string;
  signatures: Array<{
    name: string;
    title: string;
  }>;
  seal?: string; // base64 or URL
  customMessage?: string;
}

export interface NewsletterData {
  title: string;
  issueNumber?: number;
  date: string;
  announcements: Array<{
    title: string;
    content: string;
    icon?: string;
  }>;
  highlights: Array<{
    title: string;
    description: string;
    image?: string;
  }>;
  upcomingEvents: Array<{
    date: string;
    title: string;
    description: string;
  }>;
  importantDates: Array<{
    date: string;
    event: string;
  }>;
  contactInfo?: {
    name: string;
    email: string;
    phone: string;
  };
}

export interface EnhancedWorksheetData {
  title: string;
  subject: string;
  gradeLevel: number;
  objectives: string[];
  instructions: string;
  activities: Array<{
    title: string;
    type: 'practice' | 'creative' | 'problem-solving';
    content: string;
    materials?: string[];
  }>;
  vocabulary?: Array<{
    term: string;
    definition: string;
  }>;
  bonusChallenge?: string;
  parentNotes?: string;
}

export type TemplateData = 
  | StudyGuideData 
  | LessonPlanData 
  | ProgressReportData 
  | AssessmentData 
  | CertificateData 
  | NewsletterData 
  | EnhancedWorksheetData;

// ====================================================================
// TEMPLATE SYSTEM
// ====================================================================

export interface TemplateOptions {
  theme?: 'professional' | 'colorful' | 'minimalist';
  branding?: PDFBranding;
  paperSize?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  enablePageNumbers?: boolean;
  enableWatermark?: boolean;
  enableTableOfContents?: boolean;
}

export interface TemplateDescriptor {
  id: string;
  documentType: PDFDocumentType;
  displayName: string;
  description: string;
  defaultTheme: 'professional' | 'colorful' | 'minimalist';
  supports: {
    tableOfContents: boolean;
    multiPage: boolean;
    charts: boolean;
    images: boolean;
  };
  estimatedPages: { min: number; max: number };
}

export interface TemplateRenderResult {
  html: string;
  metadata: {
    documentType: PDFDocumentType;
    title: string;
    pageCount: number;
    generatedAt: string;
    theme: string;
  };
}

// ====================================================================
// VALIDATION
// ====================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// ====================================================================
// TEMPLATE REGISTRY
// ====================================================================

class TemplateRegistry {
  private templates: Map<string, TemplateDescriptor> = new Map();

  constructor() {
    this.registerDefaultTemplates();
  }

  private registerDefaultTemplates(): void {
    // Study Guide Template
    this.register({
      id: 'study-guide-comprehensive',
      documentType: PDFDocumentType.STUDY_GUIDE,
      displayName: 'Comprehensive Study Guide',
      description: 'Multi-page study guide with TOC, key concepts, vocabulary, and practice questions',
      defaultTheme: 'colorful',
      supports: {
        tableOfContents: true,
        multiPage: true,
        charts: false,
        images: true,
      },
      estimatedPages: { min: 6, max: 12 },
    });

    // Lesson Plan Template
    this.register({
      id: 'lesson-plan-standard',
      documentType: PDFDocumentType.LESSON_PLAN,
      displayName: 'Standard Lesson Plan',
      description: 'Professional lesson plan with objectives, materials, procedure timeline, and assessment',
      defaultTheme: 'professional',
      supports: {
        tableOfContents: false,
        multiPage: true,
        charts: false,
        images: false,
      },
      estimatedPages: { min: 4, max: 8 },
    });

    // Progress Report Template
    this.register({
      id: 'progress-report-detailed',
      documentType: PDFDocumentType.PROGRESS_REPORT,
      displayName: 'Detailed Progress Report',
      description: 'Student progress report with visualizations, achievements, and recommendations',
      defaultTheme: 'professional',
      supports: {
        tableOfContents: false,
        multiPage: true,
        charts: true,
        images: true,
      },
      estimatedPages: { min: 3, max: 6 },
    });

    // Assessment Template
    this.register({
      id: 'assessment-standard',
      documentType: PDFDocumentType.ASSESSMENT,
      displayName: 'Standard Assessment',
      description: 'Test/quiz with multiple question types, rubric, and optional answer key',
      defaultTheme: 'minimalist',
      supports: {
        tableOfContents: false,
        multiPage: true,
        charts: false,
        images: false,
      },
      estimatedPages: { min: 4, max: 10 },
    });

    // Certificate Template
    this.register({
      id: 'certificate-achievement',
      documentType: PDFDocumentType.CERTIFICATE,
      displayName: 'Achievement Certificate',
      description: 'Decorative certificate for recognizing student achievements',
      defaultTheme: 'colorful',
      supports: {
        tableOfContents: false,
        multiPage: false,
        charts: false,
        images: true,
      },
      estimatedPages: { min: 1, max: 1 },
    });

    // Newsletter Template
    this.register({
      id: 'newsletter-classroom',
      documentType: PDFDocumentType.NEWSLETTER,
      displayName: 'Classroom Newsletter',
      description: 'Multi-column newsletter with announcements, highlights, and events',
      defaultTheme: 'colorful',
      supports: {
        tableOfContents: false,
        multiPage: true,
        charts: false,
        images: true,
      },
      estimatedPages: { min: 2, max: 4 },
    });

    // Enhanced Worksheet Template
    this.register({
      id: 'worksheet-enhanced',
      documentType: PDFDocumentType.WORKSHEET,
      displayName: 'Enhanced Worksheet',
      description: 'Rich worksheet with activities, vocabulary, and bonus challenges',
      defaultTheme: 'colorful',
      supports: {
        tableOfContents: false,
        multiPage: true,
        charts: false,
        images: false,
      },
      estimatedPages: { min: 2, max: 5 },
    });
  }

  register(template: TemplateDescriptor): void {
    this.templates.set(template.id, template);
  }

  get(templateId: string): TemplateDescriptor | undefined {
    return this.templates.get(templateId);
  }

  getByDocumentType(documentType: PDFDocumentType): TemplateDescriptor[] {
    return Array.from(this.templates.values()).filter(
      (t) => t.documentType === documentType
    );
  }

  getAll(): TemplateDescriptor[] {
    return Array.from(this.templates.values());
  }
}

// ====================================================================
// VALIDATION SERVICE
// ====================================================================

class ValidationService {
  validateStudyGuide(data: StudyGuideData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields
    if (!data.topic) errors.push('Topic is required');
    if (!data.gradeLevel) errors.push('Grade level is required');
    if (!data.introduction) errors.push('Introduction is required');

    // Content thresholds
    if (data.sections.length < 3) {
      warnings.push('Study guides should have at least 3 sections');
    }
    if (data.vocabulary.length < 10) {
      warnings.push('Study guides should include at least 10 vocabulary terms');
    }
    if (data.practiceQuestions.length < 5) {
      warnings.push('Study guides should include at least 5 practice questions');
    }

    // Suggestions
    if (!data.additionalResources) {
      suggestions.push('Consider adding additional resources section');
    }
    if (data.practiceQuestions.length > 0 && !data.answerKey) {
      suggestions.push('Consider enabling answer key for practice questions');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  validateLessonPlan(data: LessonPlanData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields
    if (!data.topic) errors.push('Topic is required');
    if (!data.subject) errors.push('Subject is required');
    if (!data.gradeLevel) errors.push('Grade level is required');
    if (!data.duration) errors.push('Duration is required');
    if (data.objectives.length === 0) errors.push('At least one objective is required');
    if (data.materials.length === 0) errors.push('Materials list is required');
    if (data.procedure.length === 0) errors.push('Procedure steps are required');

    // Content thresholds
    if (data.objectives.length < 2) {
      warnings.push('Lesson plans should have at least 2 learning objectives');
    }
    if (data.procedure.length < 3) {
      warnings.push('Procedure should have at least 3 steps');
    }

    // Suggestions
    if (!data.standards) {
      suggestions.push('Consider adding standards alignment');
    }
    if (!data.differentiation) {
      suggestions.push('Consider adding differentiation strategies');
    }
    if (!data.exitTicket) {
      suggestions.push('Consider adding an exit ticket');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  validateProgressReport(data: ProgressReportData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields
    if (!data.student.name) errors.push('Student name is required');
    if (!data.student.grade) errors.push('Student grade is required');
    if (!data.reportingPeriod) errors.push('Reporting period is required');
    if (data.subjects.length === 0) errors.push('At least one subject is required');
    if (!data.teacherName) errors.push('Teacher name is required');

    // Content validation
    data.subjects.forEach((subject, index) => {
      if (!subject.teacherComments) {
        warnings.push(`Subject ${index + 1} (${subject.name}) missing teacher comments`);
      }
      if (subject.strengths.length === 0) {
        warnings.push(`Subject ${index + 1} (${subject.name}) should include strengths`);
      }
    });

    // Suggestions
    if (!data.attendance) {
      suggestions.push('Consider adding attendance information');
    }
    if (data.achievements.length === 0) {
      suggestions.push('Consider highlighting student achievements');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  validateAssessment(data: AssessmentData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields
    if (!data.title) errors.push('Title is required');
    if (!data.subject) errors.push('Subject is required');
    if (!data.gradeLevel) errors.push('Grade level is required');
    if (!data.instructions) errors.push('Instructions are required');
    if (data.sections.length === 0) errors.push('At least one section is required');

    // Content validation
    let totalQuestions = 0;
    data.sections.forEach((section, i) => {
      if (section.questions.length === 0) {
        errors.push(`Section ${i + 1} must have at least one question`);
      }
      totalQuestions += section.questions.length;
    });

    if (totalQuestions < 5) {
      warnings.push('Assessments should have at least 5 questions total');
    }

    // Suggestions
    if (!data.rubric) {
      suggestions.push('Consider adding a rubric for essay/short-answer questions');
    }
    if (!data.answerKey) {
      suggestions.push('Consider enabling answer key');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  validateCertificate(data: CertificateData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields
    if (!data.recipientName) errors.push('Recipient name is required');
    if (!data.achievement) errors.push('Achievement is required');
    if (!data.date) errors.push('Date is required');
    if (data.signatures.length === 0) errors.push('At least one signature is required');

    // Suggestions
    if (!data.description) {
      suggestions.push('Consider adding a description of the achievement');
    }
    if (!data.seal) {
      suggestions.push('Consider adding a seal or badge');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  validateNewsletter(data: NewsletterData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields
    if (!data.title) errors.push('Title is required');
    if (!data.date) errors.push('Date is required');
    if (data.announcements.length === 0 && data.highlights.length === 0) {
      errors.push('Newsletter must have either announcements or highlights');
    }

    // Content thresholds
    if (data.announcements.length + data.highlights.length < 3) {
      warnings.push('Newsletter should have at least 3 content items');
    }

    // Suggestions
    if (data.upcomingEvents.length === 0) {
      suggestions.push('Consider adding upcoming events');
    }
    if (!data.contactInfo) {
      suggestions.push('Consider adding contact information');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  validateEnhancedWorksheet(data: EnhancedWorksheetData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields
    if (!data.title) errors.push('Title is required');
    if (!data.subject) errors.push('Subject is required');
    if (!data.gradeLevel) errors.push('Grade level is required');
    if (!data.instructions) errors.push('Instructions are required');
    if (data.activities.length === 0) errors.push('At least one activity is required');

    // Content thresholds
    if (data.objectives.length < 2) {
      warnings.push('Worksheets should have at least 2 learning objectives');
    }
    if (data.activities.length < 2) {
      warnings.push('Worksheets should have at least 2 activities');
    }

    // Suggestions
    if (!data.vocabulary) {
      suggestions.push('Consider adding a vocabulary section');
    }
    if (!data.bonusChallenge) {
      suggestions.push('Consider adding a bonus challenge');
    }
    if (!data.parentNotes) {
      suggestions.push('Consider adding notes for parents');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
}

// ====================================================================
// PDF TEMPLATE SERVICE
// ====================================================================

class PDFTemplateServiceImpl {
  private registry: TemplateRegistry;
  private validator: ValidationService;
  private pdfService: typeof EducationalPDFService;

  constructor() {
    this.registry = new TemplateRegistry();
    this.validator = new ValidationService();
    this.pdfService = EducationalPDFService;
  }

  /**
   * Get all registered templates
   */
  getTemplates(): TemplateDescriptor[] {
    return this.registry.getAll();
  }

  /**
   * Get templates for a specific document type
   */
  getTemplatesByType(documentType: PDFDocumentType): TemplateDescriptor[] {
    return this.registry.getByDocumentType(documentType);
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(templateId: string): TemplateDescriptor | undefined {
    return this.registry.get(templateId);
  }

  /**
   * Validate data for a template
   */
  validate(templateId: string, data: TemplateData): ValidationResult {
    const template = this.registry.get(templateId);
    if (!template) {
      return {
        valid: false,
        errors: [`Template not found: ${templateId}`],
        warnings: [],
        suggestions: [],
      };
    }

    switch (template.documentType) {
      case PDFDocumentType.STUDY_GUIDE:
        return this.validator.validateStudyGuide(data as StudyGuideData);
      case PDFDocumentType.LESSON_PLAN:
        return this.validator.validateLessonPlan(data as LessonPlanData);
      case PDFDocumentType.PROGRESS_REPORT:
        return this.validator.validateProgressReport(data as ProgressReportData);
      case PDFDocumentType.ASSESSMENT:
        return this.validator.validateAssessment(data as AssessmentData);
      case PDFDocumentType.CERTIFICATE:
        return this.validator.validateCertificate(data as CertificateData);
      case PDFDocumentType.NEWSLETTER:
        return this.validator.validateNewsletter(data as NewsletterData);
      case PDFDocumentType.WORKSHEET:
        return this.validator.validateEnhancedWorksheet(data as EnhancedWorksheetData);
      default:
        return {
          valid: false,
          errors: ['Unknown document type'],
          warnings: [],
          suggestions: [],
        };
    }
  }

  /**
   * Render a template with data
   */
  async render(
    templateId: string,
    data: TemplateData,
    options?: TemplateOptions
  ): Promise<TemplateRenderResult> {
    const template = this.registry.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate data
    const validation = this.validate(templateId, data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Merge options with defaults
    const config = getPDFConfig();
    const renderOptions: TemplateOptions = {
      theme: options?.theme || template.defaultTheme,
      branding: options?.branding || DEFAULT_BRANDING,
      paperSize: options?.paperSize || config.defaultPaperSize as 'A4' | 'Letter',
      orientation: options?.orientation || config.defaultOrientation as 'portrait' | 'landscape',
      enablePageNumbers: options?.enablePageNumbers !== false && config.enablePageNumbers,
      enableWatermark: options?.enableWatermark || config.enableWatermark,
      enableTableOfContents: options?.enableTableOfContents !== false && template.supports.tableOfContents,
    };

    // Render based on document type
    let html: string;
    let title: string;

    switch (template.documentType) {
      case PDFDocumentType.STUDY_GUIDE: {
        const sgResult = await this.renderStudyGuide(data as StudyGuideData, renderOptions);
        html = sgResult.html;
        title = sgResult.title;
        break;
      }
      case PDFDocumentType.LESSON_PLAN: {
        const lpResult = await this.renderLessonPlan(data as LessonPlanData, renderOptions);
        html = lpResult.html;
        title = lpResult.title;
        break;
      }
      case PDFDocumentType.PROGRESS_REPORT: {
        const prResult = await this.renderProgressReport(data as ProgressReportData, renderOptions);
        html = prResult.html;
        title = prResult.title;
        break;
      }
      case PDFDocumentType.ASSESSMENT: {
        const asResult = await this.renderAssessment(data as AssessmentData, renderOptions);
        html = asResult.html;
        title = asResult.title;
        break;
      }
      case PDFDocumentType.CERTIFICATE: {
        const certResult = await this.renderCertificate(data as CertificateData, renderOptions);
        html = certResult.html;
        title = certResult.title;
        break;
      }
      case PDFDocumentType.NEWSLETTER: {
        const nlResult = await this.renderNewsletter(data as NewsletterData, renderOptions);
        html = nlResult.html;
        title = nlResult.title;
        break;
      }
      case PDFDocumentType.WORKSHEET: {
        const wsResult = await this.renderEnhancedWorksheet(data as EnhancedWorksheetData, renderOptions);
        html = wsResult.html;
        title = wsResult.title;
        break;
      }
      default:
        throw new Error(`Unsupported document type: ${template.documentType}`);
    }

    return {
      html,
      metadata: {
        documentType: template.documentType,
        title,
        pageCount: template.estimatedPages.min, // Approximation
        generatedAt: new Date().toISOString(),
        theme: renderOptions.theme || 'professional',
      },
    };
  }

  // Template rendering methods
  private async renderStudyGuide(data: StudyGuideData, options: TemplateOptions): Promise<{ html: string; title: string }> {
    const { Renderers } = await import('./PDFTemplateRenderers');
    const html = Renderers.StudyGuideRenderer.render(data, options);
    return { html, title: `${data.topic} - Study Guide` };
  }

  private async renderLessonPlan(data: LessonPlanData, options: TemplateOptions): Promise<{ html: string; title: string }> {
    const { Renderers } = await import('./PDFTemplateRenderers');
    const html = Renderers.LessonPlanRenderer.render(data, options);
    return { html, title: `${data.topic} - Lesson Plan` };
  }

  private async renderProgressReport(data: ProgressReportData, options: TemplateOptions): Promise<{ html: string; title: string }> {
    const { Renderers } = await import('./PDFTemplateRenderers');
    const html = Renderers.ProgressReportRenderer.render(data, options);
    return { html, title: `Progress Report - ${data.student.name}` };
  }

  private async renderAssessment(data: AssessmentData, options: TemplateOptions): Promise<{ html: string; title: string }> {
    const { Renderers } = await import('./PDFTemplateRenderers');
    const html = Renderers.AssessmentRenderer.render(data, options);
    return { html, title: data.title };
  }

  private async renderCertificate(data: CertificateData, options: TemplateOptions): Promise<{ html: string; title: string }> {
    const { Renderers } = await import('./PDFTemplateRenderers');
    const html = Renderers.CertificateRenderer.render(data, options);
    return { html, title: `Certificate - ${data.recipientName}` };
  }

  private async renderNewsletter(data: NewsletterData, options: TemplateOptions): Promise<{ html: string; title: string }> {
    const { Renderers } = await import('./PDFTemplateRenderers');
    const html = Renderers.NewsletterRenderer.render(data, options);
    return { html, title: data.title };
  }

  private async renderEnhancedWorksheet(data: EnhancedWorksheetData, options: TemplateOptions): Promise<{ html: string; title: string }> {
    const { Renderers } = await import('./PDFTemplateRenderers');
    const html = Renderers.EnhancedWorksheetRenderer.render(data, options);
    return { html, title: data.title };
  }
}

export const PDFTemplateService = new PDFTemplateServiceImpl();
