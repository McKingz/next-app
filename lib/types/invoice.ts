// ================================================
// Invoice System Types
// Comprehensive TypeScript interfaces for digital invoice management
// ================================================

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'partial' | 'overdue' | 'cancelled';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'eft' | 'payfast' | 'other';

export type InvoiceAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'SEND' | 'VIEW' | 'PAY';

// ================================================
// Core Invoice Types
// ================================================

export interface Invoice {
  id: string;
  invoice_number: string;
  preschool_id: string;
  student_id?: string;
  
  // Invoice Details
  issue_date: string;
  due_date: string;
  
  // Billing Information
  bill_to_name: string;
  bill_to_email?: string;
  bill_to_phone?: string;
  bill_to_address?: string;
  
  // Financial
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  
  // Status
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  
  // Additional Info
  notes?: string;
  terms?: string;
  internal_notes?: string;
  
  // PDF and Delivery
  pdf_url?: string;
  pdf_public_id?: string;
  sent_at?: string;
  viewed_at?: string;
  
  // Payment Tracking
  payment_due_reminder_sent: boolean;
  overdue_reminder_sent: boolean;
  
  // Template
  template_id?: string;
  
  // Audit
  created_by: string;
  created_at: string;
  updated_at: string;
  
  // Relations
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  student?: {
    id: string;
    first_name: string;
    last_name: string;
    class_name?: string;
  };
  template?: InvoiceTemplate;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  
  // Item Details
  description: string;
  quantity: number;
  unit_price: number;
  
  // Tax
  tax_rate: number;
  tax_amount: number;
  
  // Calculated (read-only)
  subtotal: number;
  total: number;
  
  // Categorization
  item_type: string;
  category?: string;
  
  // Sort
  sort_order: number;
  
  // Audit
  created_at: string;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  
  // Payment Details
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  
  // Reference
  reference_number?: string;
  transaction_id?: string;
  
  // Bank Details
  bank_name?: string;
  account_holder?: string;
  
  // Notes
  notes?: string;
  
  // Proof of Payment
  receipt_url?: string;
  receipt_public_id?: string;
  
  // Verification
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
  
  // Audit
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceTemplate {
  id: string;
  preschool_id: string;
  
  // Template Details
  name: string;
  description?: string;
  
  // Configuration
  template_data: Record<string, any>;
  default_items: InvoiceItemTemplate[];
  
  // Settings
  is_default: boolean;
  is_active: boolean;
  
  // Usage
  usage_count: number;
  last_used_at?: string;
  
  // Audit
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemTemplate {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  item_type: string;
  category?: string;
}

export interface SchoolBranding {
  id: string;
  preschool_id: string;
  
  // Brand Colors
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  
  // Logo and Images
  logo_url?: string;
  logo_public_id?: string;
  letterhead_url?: string;
  letterhead_public_id?: string;
  
  // Typography
  font_family: string;
  
  // Invoice Customization
  letterhead_html?: string;
  footer_text: string;
  payment_terms: string;
  
  // Business Details
  tax_number?: string;
  vat_number?: string;
  registration_number?: string;
  
  // Contact Override
  billing_email?: string;
  billing_phone?: string;
  billing_address?: string;
  
  // Settings
  include_qr_code: boolean;
  include_payment_terms: boolean;
  show_tax_breakdown: boolean;
  auto_invoice_numbering: boolean;
  
  // Audit
  created_at: string;
  updated_at: string;
}

export interface InvoiceAuditLog {
  id: string;
  invoice_id: string;
  
  // Action Details
  action: InvoiceAction;
  description?: string;
  
  // Data Changes
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  
  // Context
  user_id?: string;
  user_role?: string;
  ip_address?: string;
  user_agent?: string;
  
  // Audit
  created_at: string;
}

// ================================================
// Request/Response Types
// ================================================

export interface CreateInvoiceRequest {
  student_id?: string;
  bill_to_name: string;
  bill_to_email?: string;
  bill_to_phone?: string;
  bill_to_address?: string;
  issue_date: string;
  due_date: string;
  tax_rate?: number;
  discount_amount?: number;
  notes?: string;
  terms?: string;
  template_id?: string;
  items: Omit<InvoiceItem, 'id' | 'invoice_id' | 'subtotal' | 'total' | 'created_at'>[];
}

export interface UpdateInvoiceRequest extends Partial<CreateInvoiceRequest> {
  id: string;
  status?: InvoiceStatus;
}

export interface CreateInvoicePaymentRequest {
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_number?: string;
  transaction_id?: string;
  bank_name?: string;
  account_holder?: string;
  notes?: string;
  receipt_url?: string;
}

export interface CreateInvoiceTemplateRequest {
  name: string;
  description?: string;
  template_data?: Record<string, any>;
  default_items: InvoiceItemTemplate[];
  is_default?: boolean;
}

export interface UpdateSchoolBrandingRequest {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  letterhead_url?: string;
  font_family?: string;
  letterhead_html?: string;
  footer_text?: string;
  payment_terms?: string;
  tax_number?: string;
  vat_number?: string;
  registration_number?: string;
  billing_email?: string;
  billing_phone?: string;
  billing_address?: string;
  include_qr_code?: boolean;
  include_payment_terms?: boolean;
  show_tax_breakdown?: boolean;
  auto_invoice_numbering?: boolean;
}

// ================================================
// Filter and Query Types
// ================================================

export interface InvoiceFilters {
  status?: InvoiceStatus[];
  payment_status?: PaymentStatus[];
  student_id?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  search?: string;
  created_by?: string;
  overdue_only?: boolean;
  sort_by?: 'issue_date' | 'due_date' | 'total_amount' | 'created_at' | 'invoice_number';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total_count: number;
  total_amount: number;
  total_paid: number;
  total_outstanding: number;
}

export interface InvoiceStats {
  total_invoices: number;
  total_revenue: number;
  total_outstanding: number;
  average_invoice_value: number;
  
  // Status Breakdown
  draft_count: number;
  sent_count: number;
  paid_count: number;
  overdue_count: number;
  
  // Payment Status
  unpaid_amount: number;
  partial_amount: number;
  paid_amount: number;
  
  // Time-based stats
  this_month_revenue: number;
  last_month_revenue: number;
  revenue_growth: number;
  
  // Payment method breakdown
  payment_methods: {
    [key in PaymentMethod]: {
      count: number;
      amount: number;
    };
  };
}

// ================================================
// UI-specific Types
// ================================================

export interface InvoiceFormData {
  // Basic Info
  student_id: string;
  issue_date: string;
  due_date: string;
  
  // Billing
  bill_to_name: string;
  bill_to_email: string;
  bill_to_phone: string;
  bill_to_address: string;
  
  // Items
  items: Array<{
    id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    item_type: string;
    category?: string;
  }>;
  
  // Settings
  tax_rate: number;
  discount_amount: number;
  notes: string;
  terms: string;
}

export interface InvoicePreviewData {
  invoice: InvoiceFormData;
  branding: SchoolBranding;
  preschool: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  calculated: {
    subtotal: number;
    tax_amount: number;
    total_amount: number;
  };
}

export interface BulkInvoiceAction {
  action: 'send' | 'mark_overdue' | 'delete' | 'export';
  invoice_ids: string[];
  options?: {
    send_email?: boolean;
    include_pdf?: boolean;
    export_format?: 'csv' | 'excel' | 'pdf';
  };
}

// ================================================
// Color and Theme Types
// ================================================

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  text: string;
  background: string;
  surface: string;
}

export interface BrandingPreview {
  colors: ColorPalette;
  logo?: string;
  font_family: string;
  sample_invoice: {
    header: string;
    body: string;
    footer: string;
  };
}

// ================================================
// Error Types
// ================================================

export interface InvoiceError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

export interface InvoiceValidationError extends InvoiceError {
  field: string;
  value?: any;
}


// ================================================
// Utility Types
// ================================================

export type InvoiceWithCalculations = Invoice & {
  calculated: {
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
    outstanding_amount: number;
    days_overdue: number;
    is_overdue: boolean;
  };
};

export type InvoiceListItem = Pick<Invoice, 
  | 'id' 
  | 'invoice_number' 
  | 'bill_to_name' 
  | 'total_amount' 
  | 'paid_amount' 
  | 'status' 
  | 'payment_status' 
  | 'issue_date' 
  | 'due_date'
> & {
  student?: {
    first_name: string;
    last_name: string;
  };
  outstanding_amount: number;
  days_overdue: number;
  is_overdue: boolean;
};

// ================================================
// Default Values
// ================================================

export const DEFAULT_SCHOOL_BRANDING: Omit<SchoolBranding, 'id' | 'preschool_id' | 'created_at' | 'updated_at'> = {
  primary_color: '#4F46E5',
  secondary_color: '#7C3AED',
  accent_color: '#00f5ff',
  font_family: 'Inter',
  footer_text: 'Thank you for your payment!',
  payment_terms: 'Payment due within 30 days',
  include_qr_code: true,
  include_payment_terms: true,
  show_tax_breakdown: true,
  auto_invoice_numbering: true,
};

export const DEFAULT_INVOICE_TEMPLATE: Omit<InvoiceTemplate, 'id' | 'preschool_id' | 'created_at' | 'updated_at'> = {
  name: 'Standard Invoice',
  description: 'Default invoice template',
  template_data: {},
  default_items: [],
  is_default: true,
  is_active: true,
  usage_count: 0,
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card Payment',
  bank_transfer: 'Bank Transfer',
  eft: 'EFT',
  payfast: 'PayFast Online',
  other: 'Other',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  paid: 'Paid',
  partial: 'Partially Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partially Paid',
  paid: 'Paid in Full',
  refunded: 'Refunded',
};