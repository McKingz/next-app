/**
 * PDF Generation System - Type Definitions
 * 
 * Centralized types for the entire PDF generation workflow
 */

// Re-export existing types from DashPDFGenerator for consistency
export type {
  DocumentType,
  ContentSection,
  BrandingOptions,
  DashPDFOptions,
  ChartData,
  TableData,
  PDFGenerationRequest,
  PDFGenerationResult,
  UserPDFPreferences,
  CustomTemplate,
  DocumentSpec,
  KnowledgeBaseItem,
  ProgressPhase,
  ProgressCallback
} from '@/services/DashPDFGenerator';

// Extended types for UI layer
export interface PDFTab {
  id: 'prompt' | 'template' | 'structured';
  title: string;
  icon: string;
  description: string;
}

export interface GenerationJob {
  id: string;
  userId: string;
  organizationId?: string;
  type: 'prompt' | 'template' | 'structured';
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  input: import('@/services/DashPDFGenerator').PDFGenerationRequest;
  result?: import('@/services/DashPDFGenerator').PDFGenerationResult;
  progress: {
    phase: import('@/services/DashPDFGenerator').ProgressPhase;
    percentage: number;
    message?: string;
    timeElapsed?: number;
    timeRemaining?: number;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface HistoryItem {
  id: string;
  userId: string;
  organizationId?: string;
  jobId: string;
  title: string;
  documentType: import('@/services/DashPDFGenerator').DocumentType;
  generationType: 'prompt' | 'template' | 'structured';
  templateId?: string;
  templateName?: string;
  previewHtmlHash?: string;
  fileUri?: string;
  storagePath?: string;
  filename?: string;
  fileSize?: number;
  pageCount?: number;
  status: 'completed' | 'failed';
  createdAt: string;
  tags?: string[];
  isFavorite?: boolean;
  shareSettings?: {
    isShared: boolean;
    sharedWith?: string[];
    sharedAt?: string;
  };
}

export interface BatchJob {
  id: string;
  userId: string;
  organizationId?: string;
  name: string;
  templateId?: string;
  documentType?: import('@/services/DashPDFGenerator').DocumentType;
  dataset: Record<string, any>[];
  fieldMapping: Record<string, string>;
  options: {
    concurrency: number;
    fileNamingPattern: string;
    exportAsZip: boolean;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    failed: number;
    currentItem?: number;
  };
  results: Array<{
    index: number;
    status: 'pending' | 'completed' | 'failed';
  result?: import('@/services/DashPDFGenerator').PDFGenerationResult;
    error?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PreferenceSet {
  id?: string;
  userId: string;
  organizationId?: string;
  name: string;
  isDefault: boolean;
  theme: 'professional' | 'colorful' | 'minimalist';
  paperSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  branding: import('@/services/DashPDFGenerator').BrandingOptions;
  fonts: {
    primary: string;
    secondary?: string;
  };
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  enablePageNumbers: boolean;
  enableWatermark: boolean;
  headerHtml?: string;
  footerHtml?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTypeSchema {
  type: import('@/services/DashPDFGenerator').DocumentType;
  name: string;
  description: string;
  icon: string;
  category: 'business' | 'educational' | 'personal' | 'administrative';
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'multiselect' | 'date' | 'number' | 'boolean' | 'rich_text';
    required: boolean;
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
    validation?: {
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      message?: string;
    };
    defaultValue?: any;
    helpText?: string;
  }>;
  sections?: Array<{
    id: string;
    title: string;
    description?: string;
    fields: string[];
    collapsible?: boolean;
    defaultExpanded?: boolean;
  }>;
  previewTemplate?: string;
  examples?: Array<{
    title: string;
    data: Record<string, any>;
  }>;
}

export interface TemplateGalleryItem {
  id: string;
  name: string;
  description?: string;
  documentType: import('@/services/DashPDFGenerator').DocumentType;
  thumbnailUrl?: string;
  previewUrl?: string;
  ownerUserId: string;
  ownerName: string;
  organizationId?: string;
  organizationName?: string;
  isPublic: boolean;
  isOrgShared: boolean;
  isFavorited: boolean;
  usageCount: number;
  rating?: number;
  tags: string[];
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  inputSchema?: Record<string, any>;
  version: number;
}

export interface KnowledgeBaseEntity {
  id: string;
  type: 'student' | 'teacher' | 'class' | 'course' | 'assignment' | 'document' | 'organization';
  name: string;
  displayName: string;
  properties: Record<string, any>;
  searchableFields: string[];
  templateVariables: Array<{
    key: string;
    label: string;
    type: 'string' | 'number' | 'date' | 'array' | 'object';
    description?: string;
  }>;
}

export interface PreviewState {
  isLoading: boolean;
  html?: string;
  error?: string;
  lastUpdated?: string;
  settings: {
    paperSize: 'A4' | 'Letter';
    orientation: 'portrait' | 'landscape';
    theme: 'professional' | 'colorful' | 'minimalist';
    showMargins: boolean;
    showPageBreaks: boolean;
    zoom: number;
  };
}

export interface PDFGeneratorState {
  // Current tab
  activeTab: 'prompt' | 'template' | 'structured';
  
  // Generation state
  currentJob?: GenerationJob;
  isGenerating: boolean;
  
  // Preview state
  preview: PreviewState;
  
  // Form data for each tab
  promptForm: {
    content: string;
    documentType?: import('@/services/DashPDFGenerator').DocumentType;
    title: string;
    options: Partial<import('@/services/DashPDFGenerator').DashPDFOptions>;
  };
  
  templateForm: {
    selectedTemplate?: TemplateGalleryItem;
    formData: Record<string, any>;
    validation: Record<string, string>;
  };
  
  structuredForm: {
    documentType?: import('@/services/DashPDFGenerator').DocumentType;
    formData: Record<string, any>;
    validation: Record<string, string>;
  };
  
  // User preferences
  preferences?: PreferenceSet;
  
  // Templates and history
  templates: {
    items: TemplateGalleryItem[];
    favorites: string[];
    recent: string[];
    isLoading: boolean;
    error?: string;
  };
  
  history: {
    items: HistoryItem[];
    isLoading: boolean;
    error?: string;
  };
  
  // Knowledge base context
  knowledgeBase: {
    entities: KnowledgeBaseEntity[];
    isLoading: boolean;
    error?: string;
  };
  
  // UI state
  ui: {
    sidebarCollapsed: boolean;
    previewCollapsed: boolean;
    showSettings: boolean;
    notifications: Array<{
      id: string;
      type: 'info' | 'success' | 'warning' | 'error';
      message: string;
      dismissible: boolean;
      timeout?: number;
    }>;
  };
}

// Constants
export const PAPER_SIZES = {
  A4: { width: 210, height: 297, label: 'A4 (210 × 297 mm)' },
  Letter: { width: 216, height: 279, label: 'Letter (8.5 × 11 in)' },
} as const;

export const PDF_THEMES = {
  professional: {
    name: 'Professional',
    description: 'Clean, business-appropriate design',
    colors: {
      primary: '#1565c0',
      secondary: '#0d47a1',
      accent: '#42a5f5',
    },
  },
  colorful: {
    name: 'Colorful',
    description: 'Vibrant, engaging design',
    colors: {
      primary: '#1976d2',
      secondary: '#388e3c',
      accent: '#fbc02d',
    },
  },
  minimalist: {
    name: 'Minimalist',
    description: 'Simple, clean design',
    colors: {
      primary: '#424242',
      secondary: '#757575',
      accent: '#e0e0e0',
    },
  },
} as const;

export const DOCUMENT_TYPE_SCHEMAS: Record<import('@/services/DashPDFGenerator').DocumentType, DocumentTypeSchema> = {
  report: {
    type: 'report',
    name: 'Report',
    description: 'Business or academic reports with sections and data',
    icon: 'document-text',
    category: 'business',
    fields: [
      {
        key: 'title',
        label: 'Report Title',
        type: 'text',
        required: true,
        placeholder: 'Enter report title...',
      },
      {
        key: 'subtitle',
        label: 'Subtitle',
        type: 'text',
        required: false,
        placeholder: 'Optional subtitle...',
      },
      {
        key: 'author',
        label: 'Author',
        type: 'text',
        required: false,
        placeholder: 'Report author...',
      },
      {
        key: 'date',
        label: 'Report Date',
        type: 'date',
        required: true,
      },
      {
        key: 'executive_summary',
        label: 'Executive Summary',
        type: 'textarea',
        required: false,
        placeholder: 'Brief overview of the report...',
      },
      {
        key: 'content',
        label: 'Report Content',
        type: 'rich_text',
        required: true,
        placeholder: 'Main report content...',
      },
    ],
    sections: [
      {
        id: 'header',
        title: 'Report Header',
        fields: ['title', 'subtitle', 'author', 'date'],
      },
      {
        id: 'summary',
        title: 'Summary',
        fields: ['executive_summary'],
      },
      {
        id: 'content',
        title: 'Content',
        fields: ['content'],
      },
    ],
  },
  letter: {
    type: 'letter',
    name: 'Letter',
    description: 'Formal correspondence and communications',
    icon: 'mail',
    category: 'business',
    fields: [
      {
        key: 'recipient_name',
        label: 'Recipient Name',
        type: 'text',
        required: true,
        placeholder: 'To whom...',
      },
      {
        key: 'recipient_address',
        label: 'Recipient Address',
        type: 'textarea',
        required: false,
        placeholder: 'Address lines...',
      },
      {
        key: 'subject',
        label: 'Subject',
        type: 'text',
        required: false,
        placeholder: 'Letter subject...',
      },
      {
        key: 'salutation',
        label: 'Salutation',
        type: 'select',
        required: true,
        options: [
          { label: 'Dear', value: 'Dear' },
          { label: 'Dear Sir/Madam', value: 'Dear Sir/Madam' },
          { label: 'To Whom It May Concern', value: 'To Whom It May Concern' },
        ],
        defaultValue: 'Dear',
      },
      {
        key: 'content',
        label: 'Letter Content',
        type: 'rich_text',
        required: true,
        placeholder: 'Letter content...',
      },
      {
        key: 'closing',
        label: 'Closing',
        type: 'select',
        required: true,
        options: [
          { label: 'Sincerely', value: 'Sincerely' },
          { label: 'Best regards', value: 'Best regards' },
          { label: 'Yours truly', value: 'Yours truly' },
          { label: 'Respectfully', value: 'Respectfully' },
        ],
        defaultValue: 'Sincerely',
      },
      {
        key: 'sender_name',
        label: 'Sender Name',
        type: 'text',
        required: true,
        placeholder: 'Your name...',
      },
    ],
  },
  // Add other document types as needed...
  general: {
    type: 'general',
    name: 'General Document',
    description: 'General purpose document',
    icon: 'document',
    category: 'personal',
    fields: [
      {
        key: 'title',
        label: 'Document Title',
        type: 'text',
        required: true,
        placeholder: 'Enter title...',
      },
      {
        key: 'content',
        label: 'Content',
        type: 'rich_text',
        required: true,
        placeholder: 'Document content...',
      },
    ],
  },
  // Placeholder for other types - will be expanded
  invoice: {} as DocumentTypeSchema,
  study_guide: {} as DocumentTypeSchema,
  lesson_plan: {} as DocumentTypeSchema,
  progress_report: {} as DocumentTypeSchema,
  assessment: {} as DocumentTypeSchema,
  certificate: {} as DocumentTypeSchema,
  newsletter: {} as DocumentTypeSchema,
  worksheet: {} as DocumentTypeSchema,
};