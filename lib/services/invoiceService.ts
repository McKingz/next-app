// ================================================
// Invoice Service API
// Comprehensive service layer for invoice management
// Uses TanStack Query for caching and state management
// ================================================

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { extractOrganizationId } from '@/lib/tenant/compat';
import type {
  Invoice,
  InvoiceItem,
  InvoicePayment,
  InvoiceTemplate,
  SchoolBranding,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  CreateInvoicePaymentRequest,
  CreateInvoiceTemplateRequest,
  UpdateSchoolBrandingRequest,
  InvoiceFilters,
  InvoiceListResponse,
  InvoiceStats,
  InvoiceError,
  PaymentMethod,
  InvoiceStatus,
} from '@/lib/types/invoice';

// ================================================
// Core Invoice Operations
// ================================================

export class InvoiceService {
  private static get supabase() {
    return assertSupabase();
  }

  // ================================================
  // Invoice Notification Helper
  // ================================================

  /**
   * Helper to invoke the notifications-dispatcher edge function for invoice events
   */
  private static async notifyInvoiceEvent(
    event: 'new_invoice' | 'invoice_sent' | 'overdue_reminder' | 'payment_confirmed' | 'invoice_viewed',
    invoiceId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase.functions.invoke('notifications-dispatcher', {
        body: { event_type: event, invoice_id: invoiceId }
      });
      if (error) {
        console.error('Failed to trigger invoice notification:', error);
      }
      track('edudash.invoice.notification_triggered', { invoice_id: invoiceId, event });
    } catch (error) {
      console.error('Error triggering invoice notification:', error);
      // Don't throw here - notifications are optional and shouldn't break the main flow
    }
  }

  // ================================================
  // Invoice CRUD Operations
  // ================================================

  /**
   * Create a new invoice with auto-generated invoice number
   */
  static async createInvoice(data: CreateInvoiceRequest): Promise<Invoice> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('organization_id, preschool_id')
        .eq('id', user.user.id)
        .single();

      const organizationId = extractOrganizationId(profile);
      if (!organizationId) throw new Error('User not associated with an organization');

      // Generate invoice number using the database function
      const { data: invoiceNumber } = await this.supabase
        .rpc('generate_invoice_number', { p_preschool_id: organizationId });

      if (!invoiceNumber) throw new Error('Failed to generate invoice number');

      // Create the invoice
      const invoiceData = {
        ...data,
        invoice_number: invoiceNumber,
        preschool_id: organizationId, // Database field still named preschool_id
        created_by: user.user.id,
        tax_rate: data.tax_rate || 0,
        discount_amount: data.discount_amount || 0,
      };

      const { data: invoice, error } = await this.supabase
        .from('invoices')
        .insert(invoiceData)
        .select(`
          *,
          student:students(id, first_name, last_name, class_id),
          template:invoice_templates(id, name)
        `)
        .single();

      if (error) throw error;

      // Create invoice items
      if (data.items && data.items.length > 0) {
        const items = data.items.map((item, index) => ({
          ...item,
          invoice_id: invoice.id,
          sort_order: index,
        }));

        const { error: itemsError } = await this.supabase
          .from('invoice_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      // Track analytics
      track('edudash.invoice.created', {
        invoice_id: invoice.id,
        total_amount: invoice.total_amount,
        item_count: data.items?.length || 0,
        has_student: !!data.student_id,
      });

      // Trigger invoice notification
      await this.notifyInvoiceEvent('new_invoice', invoice.id);

      return invoice;
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'CREATE_INVOICE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create invoice',
      };
      throw invoiceError;
    }
  }

  /**
   * Update an existing invoice
   */
  static async updateInvoice(data: UpdateInvoiceRequest): Promise<Invoice> {
    try {
      const { id, items, ...updateData } = data;

      // Update the main invoice record
      const { data: invoice, error } = await this.supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          student:students(id, first_name, last_name, class_id),
          template:invoice_templates(id, name)
        `)
        .single();

      if (error) throw error;

      // Update items if provided
      if (items) {
        // Delete existing items
        await this.supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id);

        // Insert new items
        if (items.length > 0) {
          const itemsData = items.map((item, index) => ({
            ...item,
            invoice_id: id,
            sort_order: index,
          }));

          const { error: itemsError } = await this.supabase
            .from('invoice_items')
            .insert(itemsData);

          if (itemsError) throw itemsError;
        }
      }

      // Track analytics
      track('edudash.invoice.updated', {
        invoice_id: id,
        status: updateData.status,
      });

      // Trigger overdue notification if status changed to overdue
      if (updateData.status === 'overdue') {
        await this.notifyInvoiceEvent('overdue_reminder', id);
      }

      return invoice;
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'UPDATE_INVOICE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update invoice',
      };
      throw invoiceError;
    }
  }

  /**
   * Get invoices with filters and pagination
   */
  static async getInvoices(filters: InvoiceFilters = {}): Promise<InvoiceListResponse> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', user.user.id)
        .single();

      if (!profile?.preschool_id) throw new Error('User not associated with a preschool');

      let query = this.supabase
        .from('invoices')
        .select(`
          *,
          student:students(id, first_name, last_name),
          items:invoice_items(id, description, quantity, unit_price, total),
          payments:invoice_payments(id, amount, payment_method, payment_date)
        `, { count: 'exact' })
        .eq('preschool_id', profile.preschool_id);

      // Apply filters
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters.payment_status && filters.payment_status.length > 0) {
        query = query.in('payment_status', filters.payment_status);
      }

      if (filters.student_id) {
        query = query.eq('student_id', filters.student_id);
      }

      if (filters.date_from) {
        query = query.gte('issue_date', filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte('issue_date', filters.date_to);
      }

      if (filters.amount_min) {
        query = query.gte('total_amount', filters.amount_min);
      }

      if (filters.amount_max) {
        query = query.lte('total_amount', filters.amount_max);
      }

      if (filters.search) {
        query = query.or(`
          invoice_number.ilike.%${filters.search}%,
          bill_to_name.ilike.%${filters.search}%,
          notes.ilike.%${filters.search}%
        `);
      }

      if (filters.created_by) {
        query = query.eq('created_by', filters.created_by);
      }

      if (filters.overdue_only) {
        const today = new Date().toISOString().split('T')[0];
        query = query.lt('due_date', today).neq('status', 'paid');
      }

      // Apply sorting
      const sortBy = filters.sort_by || 'created_at';
      const sortOrder = filters.sort_order || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data: invoices, error, count } = await query;

      if (error) throw error;

      // Calculate totals
      const totalAmount = invoices?.reduce((sum, invoice) => sum + invoice.total_amount, 0) || 0;
      const totalPaid = invoices?.reduce((sum, invoice) => sum + invoice.paid_amount, 0) || 0;
      const totalOutstanding = totalAmount - totalPaid;

      return {
        invoices: invoices || [],
        total_count: count || 0,
        total_amount: totalAmount,
        total_paid: totalPaid,
        total_outstanding: totalOutstanding,
      };
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'GET_INVOICES_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch invoices',
      };
      throw invoiceError;
    }
  }

  /**
   * Get a single invoice by ID with all related data
   */
  static async getInvoiceById(id: string): Promise<Invoice> {
    try {
      const { data: invoice, error } = await this.supabase
        .from('invoices')
        .select(`
          *,
          student:students(id, first_name, last_name, class_id),
          template:invoice_templates(id, name, description),
          items:invoice_items(*),
          payments:invoice_payments(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!invoice) throw new Error('Invoice not found');

      // Track analytics
      track('edudash.invoice.viewed', {
        invoice_id: id,
        total_amount: invoice.total_amount,
        status: invoice.status,
      });

      // Trigger invoice viewed notification
      await this.notifyInvoiceEvent('invoice_viewed', id);

      return invoice;
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'GET_INVOICE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch invoice',
      };
      throw invoiceError;
    }
  }

  /**
   * Delete an invoice (only if it's in draft status)
   */
  static async deleteInvoice(id: string): Promise<void> {
    try {
      // Check if invoice can be deleted (only drafts)
      const { data: invoice } = await this.supabase
        .from('invoices')
        .select('status')
        .eq('id', id)
        .single();

      if (!invoice) throw new Error('Invoice not found');
      if (invoice.status !== 'draft') {
        throw new Error('Only draft invoices can be deleted');
      }

      const { error } = await this.supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Track analytics
      track('edudash.invoice.deleted', {
        invoice_id: id,
      });
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'DELETE_INVOICE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to delete invoice',
      };
      throw invoiceError;
    }
  }

  // ================================================
  // Payment Operations
  // ================================================

  /**
   * Record a payment against an invoice
   */
  static async createPayment(data: CreateInvoicePaymentRequest): Promise<InvoicePayment> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const paymentData = {
        ...data,
        recorded_by: user.user.id,
      };

      const { data: payment, error } = await this.supabase
        .from('invoice_payments')
        .insert(paymentData)
        .select('*')
        .single();

      if (error) throw error;

      // Track analytics
      track('edudash.invoice.payment_recorded', {
        invoice_id: data.invoice_id,
        amount: data.amount,
        payment_method: data.payment_method,
      });

      return payment;
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'CREATE_PAYMENT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to record payment',
      };
      throw invoiceError;
    }
  }

  /**
   * Mark an invoice as paid
   */
  static async markAsPaid(
    invoiceId: string,
    paymentMethod: PaymentMethod = 'cash',
    referenceNumber?: string
  ): Promise<void> {
    try {
      // Get the invoice total
      const { data: invoice } = await this.supabase
        .from('invoices')
        .select('total_amount, paid_amount')
        .eq('id', invoiceId)
        .single();

      if (!invoice) throw new Error('Invoice not found');

      const remainingAmount = invoice.total_amount - invoice.paid_amount;

      if (remainingAmount > 0) {
        // Create payment record for the remaining amount
        await this.createPayment({
          invoice_id: invoiceId,
          amount: remainingAmount,
          payment_method: paymentMethod,
          payment_date: new Date().toISOString().split('T')[0],
          reference_number: referenceNumber,
        });
      }

      // Update invoice status
      await this.updateInvoice({
        id: invoiceId,
        status: 'paid',
      });

      // Track analytics
      track('edudash.invoice.marked_paid', {
        invoice_id: invoiceId,
        payment_amount: remainingAmount,
        payment_method: paymentMethod,
      });

      // Trigger payment confirmation notification
      await this.notifyInvoiceEvent('payment_confirmed', invoiceId);
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'MARK_PAID_FAILED',
        message: error instanceof Error ? error.message : 'Failed to mark invoice as paid',
      };
      throw invoiceError;
    }
  }

  // ================================================
  // Invoice Statistics
  // ================================================

  /**
   * Get comprehensive invoice statistics
   */
  static async getInvoiceStats(): Promise<InvoiceStats> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', user.user.id)
        .single();

      if (!profile?.preschool_id) throw new Error('User not associated with a preschool');

      // Get basic stats
      const { data: invoices } = await this.supabase
        .from('invoices')
        .select('total_amount, paid_amount, status, payment_status, created_at')
        .eq('preschool_id', profile.preschool_id);

      if (!invoices) throw new Error('Failed to fetch invoice statistics');

      // Get payment method breakdown
      const { data: payments } = await this.supabase
        .from('invoice_payments')
        .select('amount, payment_method')
        .in('invoice_id', 
          (await this.supabase
            .from('invoices')
            .select('id')
            .eq('preschool_id', profile.preschool_id)
          ).data?.map(i => i.id) || []
        );

      // Calculate stats
      const totalInvoices = invoices.length;
      const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      const totalPaid = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0);
      const totalOutstanding = totalRevenue - totalPaid;
      const averageInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

      // Status breakdown
      const statusCounts = invoices.reduce((counts, inv) => {
        counts[inv.status] = (counts[inv.status] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      // Payment status amounts
      const paymentAmounts = invoices.reduce((amounts, inv) => {
        if (inv.payment_status === 'paid') amounts.paid += inv.total_amount;
        else if (inv.payment_status === 'partial') amounts.partial += inv.paid_amount;
        else amounts.unpaid += inv.total_amount - inv.paid_amount;
        return amounts;
      }, { paid: 0, partial: 0, unpaid: 0 });

      // Time-based revenue
      const currentMonth = new Date();
      const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      const thisMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

      const thisMonthRevenue = invoices
        .filter(inv => new Date(inv.created_at) >= thisMonthStart)
        .reduce((sum, inv) => sum + inv.paid_amount, 0);

      const lastMonthRevenue = invoices
        .filter(inv => {
          const date = new Date(inv.created_at);
          return date >= lastMonth && date < thisMonthStart;
        })
        .reduce((sum, inv) => sum + inv.paid_amount, 0);

      const revenueGrowth = lastMonthRevenue > 0 
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;

      // Payment method breakdown
      const paymentMethods = (payments || []).reduce((methods, payment) => {
        if (!methods[payment.payment_method]) {
          methods[payment.payment_method] = { count: 0, amount: 0 };
        }
        methods[payment.payment_method].count += 1;
        methods[payment.payment_method].amount += payment.amount;
        return methods;
      }, {} as Record<PaymentMethod, { count: number; amount: number }>);

      const stats: InvoiceStats = {
        total_invoices: totalInvoices,
        total_revenue: totalRevenue,
        total_outstanding: totalOutstanding,
        average_invoice_value: averageInvoiceValue,
        draft_count: statusCounts.draft || 0,
        sent_count: statusCounts.sent || 0,
        paid_count: statusCounts.paid || 0,
        overdue_count: statusCounts.overdue || 0,
        unpaid_amount: paymentAmounts.unpaid,
        partial_amount: paymentAmounts.partial,
        paid_amount: paymentAmounts.paid,
        this_month_revenue: thisMonthRevenue,
        last_month_revenue: lastMonthRevenue,
        revenue_growth: revenueGrowth,
        payment_methods: paymentMethods,
      };

      return stats;
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'GET_STATS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch invoice statistics',
      };
      throw invoiceError;
    }
  }

  // ================================================
  // Template Operations
  // ================================================

  /**
   * Get invoice templates for the current school
   */
  static async getTemplates(): Promise<InvoiceTemplate[]> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', user.user.id)
        .single();

      if (!profile?.preschool_id) throw new Error('User not associated with a preschool');

      const { data: templates, error } = await this.supabase
        .from('invoice_templates')
        .select('*')
        .eq('preschool_id', profile.preschool_id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;

      return templates || [];
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'GET_TEMPLATES_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch templates',
      };
      throw invoiceError;
    }
  }

  /**
   * Create a new invoice template
   */
  static async createTemplate(data: CreateInvoiceTemplateRequest): Promise<InvoiceTemplate> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', user.user.id)
        .single();

      if (!profile?.preschool_id) throw new Error('User not associated with a preschool');

      const templateData = {
        ...data,
        preschool_id: profile.preschool_id,
        created_by: user.user.id,
      };

      const { data: template, error } = await this.supabase
        .from('invoice_templates')
        .insert(templateData)
        .select('*')
        .single();

      if (error) throw error;

      // Track analytics
      track('edudash.invoice.template_created', {
        template_id: template.id,
        template_name: template.name,
        is_default: template.is_default,
      });

      return template;
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'CREATE_TEMPLATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create template',
      };
      throw invoiceError;
    }
  }

  // ================================================
  // School Branding Operations
  // ================================================

  /**
   * Get school branding settings
   */
  static async getSchoolBranding(): Promise<SchoolBranding | null> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', user.user.id)
        .single();

      if (!profile?.preschool_id) throw new Error('User not associated with a preschool');

      const { data: branding, error } = await this.supabase
        .from('school_branding')
        .select('*')
        .eq('preschool_id', profile.preschool_id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned

      return branding;
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'GET_BRANDING_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch branding',
      };
      throw invoiceError;
    }
  }

  /**
   * Update school branding settings
   */
  static async updateSchoolBranding(data: UpdateSchoolBrandingRequest): Promise<SchoolBranding> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', user.user.id)
        .single();

      if (!profile?.preschool_id) throw new Error('User not associated with a preschool');

      const { data: branding, error } = await this.supabase
        .from('school_branding')
        .upsert({
          preschool_id: profile.preschool_id,
          ...data,
        })
        .select('*')
        .single();

      if (error) throw error;

      // Track analytics
      track('edudash.invoice.branding_updated', {
        preschool_id: profile.preschool_id,
        has_logo: !!data.logo_url,
        has_custom_colors: !!(data.primary_color || data.secondary_color),
      });

      return branding;
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'UPDATE_BRANDING_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update branding',
      };
      throw invoiceError;
    }
  }

  // ================================================
  // Utility Functions
  // ================================================

  /**
   * Send invoice via email
   */
  static async sendInvoiceEmail(invoiceId: string, recipientEmail?: string): Promise<void> {
    try {
      // This would integrate with your email service (SendGrid, etc.)
      const { data, error } = await this.supabase.functions.invoke('send-invoice-email', {
        body: {
          invoice_id: invoiceId,
          recipient_email: recipientEmail,
        },
      });

      if (error) throw error;

      // Update invoice status to sent
      await this.updateInvoice({
        id: invoiceId,
        status: 'sent' as InvoiceStatus,
      });

      // Track analytics
      track('edudash.invoice.sent_email', {
        invoice_id: invoiceId,
        recipient_provided: !!recipientEmail,
      });

      // Trigger invoice sent notification
      await this.notifyInvoiceEvent('invoice_sent', invoiceId);
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'SEND_EMAIL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to send invoice email',
      };
      throw invoiceError;
    }
  }

  /**
   * Generate QR code for payment tracking
   */
  static async generateQRCode(invoiceId: string): Promise<string> {
    try {
      const { data, error } = await this.supabase.functions.invoke('payment-qr-generator', {
        body: {
          invoice_id: invoiceId,
        },
      });

      if (error) throw error;

      return data.qr_code_url;
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'GENERATE_QR_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate QR code',
      };
      throw invoiceError;
    }
  }

  /**
   * Generate PDF for invoice
   */
  static async generateInvoicePDF(invoiceId: string): Promise<string> {
    try {
      const { data, error } = await this.supabase.functions.invoke('generate-invoice-pdf', {
        body: {
          invoice_id: invoiceId,
        },
      });

      if (error) throw error;

      // Optionally update invoice metadata with PDF URL via dedicated endpoint (skipped here)

      // Track analytics
      track('edudash.invoice.pdf_generated', {
        invoice_id: invoiceId,
      });

      return data.pdf_url;
    } catch (error) {
      const invoiceError: InvoiceError = {
        code: 'GENERATE_PDF_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate PDF',
      };
      throw invoiceError;
    }
  }
}

// ================================================
// Export the service
// ================================================

export default InvoiceService;