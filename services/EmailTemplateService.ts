/**
 * EmailTemplateService
 * 
 * Service for managing email templates, rendering with variables,
 * and sending progress reports and newsletters.
 * 
 * Features:
 * - Template management (CRUD)
 * - Variable substitution (Mustache-style {{variable}})
 * - Progress report generation
 * - Newsletter composition
 * - Email sending via Supabase Edge Function
 */

import { supabase } from '@/lib/supabase';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

export interface EmailTemplate {
  id: string;
  preschool_id: string | null;
  name: string;
  template_type: 'progress_report' | 'newsletter' | 'event_reminder' | 'invoice' | 'welcome' | 'custom';
  subject_template: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  is_system_template: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressReport {
  id?: string;
  preschool_id: string;
  student_id: string;
  teacher_id: string;
  report_period: string; // e.g., "Q1 2025", "Term 1"
  report_type: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  overall_comments?: string;
  teacher_comments?: string;
  strengths?: string;
  areas_for_improvement?: string;
  subjects_performance?: Record<string, { grade: string; comments: string }>;
  attendance_summary?: { present: number; absent: number; percentage: number };
  behavioral_notes?: any;
  overall_grade?: string;
  email_sent_at?: string;
  email_message_id?: string;
  
  // Approval workflow fields
  status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'sent';
  teacher_signature?: string;
  teacher_signature_data?: string;
  teacher_signed_at?: string;
  principal_signature_data?: string;
  principal_signed_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  reviewer_name?: string;
  rejection_reason?: string;
  review_notes?: string;
  
  // School readiness fields (for Grade R transition reports)
  report_category?: 'general' | 'school_readiness';
  school_readiness_indicators?: {
    social_skills?: { rating: number; notes: string };
    emotional_development?: { rating: number; notes: string };
    gross_motor_skills?: { rating: number; notes: string };
    fine_motor_skills?: { rating: number; notes: string };
    cognitive_development?: { rating: number; notes: string };
    language_development?: { rating: number; notes: string };
    independence?: { rating: number; notes: string };
    self_care?: { rating: number; notes: string };
  };
  developmental_milestones?: Record<string, boolean>; // e.g., { "can_write_name": true, "can_count_to_20": true }
  transition_readiness_level?: 'not_ready' | 'developing' | 'ready' | 'exceeds_expectations';
  readiness_notes?: string;
  recommendations?: string;
}

export interface Newsletter {
  id?: string;
  preschool_id: string;
  title: string;
  content_html: string;
  content_text?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduled_for?: string;
  sent_at?: string;
  recipient_filter?: {
    roles?: string[];
    classes?: string[];
  };
  total_recipients?: number;
  sent_count?: number;
  failed_count?: number;
  open_count?: number;
  click_count?: number;
  created_by: string;
}

export interface EmailSendRequest {
  to: string | string[];
  subject: string;
  body: string;
  is_html?: boolean;
  reply_to?: string;
  cc?: string[];
  bcc?: string[];
  confirmed?: boolean;
}

class EmailTemplateService {
  /**
   * Get all templates for a preschool (including system templates)
   */
  async getTemplates(preschoolId: string, type?: string): Promise<EmailTemplate[]> {
    let query = supabase
      .from('email_templates')
      .select('*')
      .or(`preschool_id.eq.${preschoolId},is_system_template.eq.true`)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('template_type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[EmailTemplateService] Failed to fetch templates:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get a specific template by ID
   */
  async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      console.error('[EmailTemplateService] Failed to fetch template:', error);
      return null;
    }

    return data;
  }

  /**
   * Create a custom template
   */
  async createTemplate(template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<EmailTemplate | null> {
    const { data, error } = await supabase
      .from('email_templates')
      .insert(template)
      .select()
      .single();

    if (error) {
      console.error('[EmailTemplateService] Failed to create template:', error);
      return null;
    }

    return data;
  }

  /**
   * Render template with variables
   */
  renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;

    // Simple Mustache-style variable substitution
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      const value = variables[key] ?? '';
      rendered = rendered.replace(regex, String(value));
    });

    return rendered;
  }

  /**
   * Generate progress report HTML
   */
  async generateProgressReportEmail(
    report: ProgressReport,
    studentName: string,
    parentName: string,
    teacherName: string,
    preschoolName: string
  ): Promise<{ subject: string; html: string; text: string }> {
    // Get progress report template
    const templates = await this.getTemplates(report.preschool_id, 'progress_report');
    const template = templates[0]; // Use first available template

    // If no template exists, use professional PDF HTML as fallback
    if (!template) {
      if (__DEV__) {
        console.log('[EmailTemplateService] No template found, using professional PDF HTML fallback');
      }
      const html = this.generateProfessionalPDFHTML(report, studentName, parentName, teacherName, preschoolName);
      const subject = `Progress Report for ${studentName} - ${report.report_period}`;
      return { subject, html, text: '' };
    }

    // Generate subjects performance table
    const subjectsTable = report.subjects_performance
      ? Object.entries(report.subjects_performance)
          .map(
            ([subject, data]) =>
              `<tr><td style="padding: 8px; border: 1px solid #ddd;">${subject}</td><td style="padding: 8px; border: 1px solid #ddd;">${data.grade}</td><td style="padding: 8px; border: 1px solid #ddd;">${data.comments}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="3" style="padding: 8px;">No subject data available</td></tr>';

    const subjectsTableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Subject</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Grade</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Comments</th>
          </tr>
        </thead>
        <tbody>
          ${subjectsTable}
        </tbody>
      </table>
    `;

    // Variables for template
    const variables = {
      student_name: studentName,
      parent_name: parentName,
      report_period: report.report_period,
      overall_grade: report.overall_grade || 'N/A',
      teacher_comments: report.teacher_comments || 'No comments provided',
      subjects_table: subjectsTableHtml,
      teacher_name: teacherName,
      preschool_name: preschoolName,
      strengths: report.strengths || '',
      areas_for_improvement: report.areas_for_improvement || '',
    };

    const subject = this.renderTemplate(template.subject_template, variables);
    const html = this.renderTemplate(template.body_html, variables);
    const text = template.body_text ? this.renderTemplate(template.body_text, variables) : '';

    return { subject, html, text };
  }

  /**
   * Generate newsletter HTML
   */
  async generateNewsletterEmail(
    newsletter: Newsletter,
    preschoolName: string
  ): Promise<{ subject: string; html: string; text: string }> {
    // Get newsletter template
    const templates = await this.getTemplates(newsletter.preschool_id, 'newsletter');
    const template = templates[0];

    if (!template) {
      throw new Error('No newsletter template found');
    }

    // Extract month from title or use current
    const month = newsletter.title.includes(' - ')
      ? newsletter.title.split(' - ')[1]
      : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const variables = {
      preschool_name: preschoolName,
      month,
      content: newsletter.content_html,
    };

    const subject = this.renderTemplate(template.subject_template, variables);
    const html = this.renderTemplate(template.body_html, variables);
    const text = newsletter.content_text || this.renderTemplate(template.body_text || '', variables);

    return { subject, html, text };
  }

  /**
   * Send email via Supabase Edge Function
   */
  async sendEmail(request: EmailSendRequest): Promise<{ success: boolean; message_id?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        ...request,
        is_html: request.is_html !== false,
        confirmed: true, // Explicitly confirm
      },
    });

    if (error) {
      console.error('[EmailTemplateService] Failed to send email:', error);
      return { success: false, error: error.message };
    }

    return data;
  }

  /**
   * Send progress report to parent
   */
  async sendProgressReport(
    report: ProgressReport,
    parentEmail: string,
    studentName: string,
    parentName: string,
    teacherName: string,
    preschoolName: string
  ): Promise<{ success: boolean; message_id?: string; error?: string }> {
    try {
      const { subject, html } = await this.generateProgressReportEmail(
        report,
        studentName,
        parentName,
        teacherName,
        preschoolName
      );

      const result = await this.sendEmail({
        to: parentEmail,
        subject,
        body: html,
        is_html: true,
        confirmed: true,
      });

      // Update report with email tracking info
      if (result.success && report.id) {
        await supabase
          .from('progress_reports')
          .update({
            email_sent_at: new Date().toISOString(),
            email_message_id: result.message_id,
          })
          .eq('id', report.id);
      }

      return result;
    } catch (error: any) {
      console.error('[EmailTemplateService] Failed to send progress report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate professional PDF HTML for progress reports
   * Enhanced with charts, visual indicators, and print optimization
   */
  private generateProfessionalPDFHTML(
    report: ProgressReport,
    studentName: string,
    parentName: string,
    teacherName: string,
    preschoolName: string
  ): string {
    const isSchoolReadiness = report.report_category === 'school_readiness';
    const currentDate = new Date().toLocaleDateString('en-ZA', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Generate radar chart for school readiness indicators
    const radarChartSVG = isSchoolReadiness && report.school_readiness_indicators 
      ? this.generateRadarChartSVG(report.school_readiness_indicators)
      : '';

    // Generate progress bars for milestones
    const milestoneProgress = isSchoolReadiness && report.developmental_milestones
      ? this.calculateMilestoneProgress(report.developmental_milestones)
      : null;

    // Generate QR code data URL (placeholder - would integrate with actual QR library)
    const qrCodeURL = this.generateQRCodePlaceholder(report.id || 'preview');

    // Generate subjects table
    let subjectsHTML = '';
    if (!isSchoolReadiness && report.subjects_performance) {
      const subjectRows = Object.entries(report.subjects_performance)
        .map(([subject, data]) => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${subject}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #059669;">${data.grade || 'N/A'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${data.comments || '-'}</td>
          </tr>
        `).join('');

      subjectsHTML = `
        <div style="margin: 30px 0;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Subject Performance</h2>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Subject</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Grade</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Comments</th>
              </tr>
            </thead>
            <tbody>
              ${subjectRows}
            </tbody>
          </table>
        </div>
      `;
    }

    // Generate school readiness indicators
    let readinessHTML = '';
    if (isSchoolReadiness && report.school_readiness_indicators) {
      const indicatorRows = Object.entries(report.school_readiness_indicators)
        .map(([key, value]: [string, any]) => {
          const stars = '★'.repeat(value.rating || 0) + '☆'.repeat(5 - (value.rating || 0));
          return `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #f59e0b; font-size: 18px;">${stars}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${value.notes || '-'}</td>
            </tr>
          `;
        }).join('');

      const milestonesHTML = report.developmental_milestones
        ? Object.entries(report.developmental_milestones)
            .map(([key, achieved]: [string, boolean]) => `
              <li style="padding: 8px 0; color: ${achieved ? '#059669' : '#6b7280'};">
                <span style="display: inline-block; width: 20px; font-weight: bold;">${achieved ? '✓' : '○'}</span>
                ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </li>
            `).join('')
        : '';

      readinessHTML = `
        <div style="margin: 30px 0;">
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">School Readiness Assessment</h2>
          
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #374151;"><strong>Overall Readiness Level:</strong> <span style="color: #059669; font-weight: 600;">${report.transition_readiness_level?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}</span></p>
          </div>

          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Development Area</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Rating</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${indicatorRows}
            </tbody>
          </table>

          ${milestonesHTML ? `
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h3 style="color: #1f2937; font-size: 16px; font-weight: 600; margin-bottom: 12px;">Developmental Milestones</h3>
              <ul style="list-style: none; padding: 0; margin: 0;">
                ${milestonesHTML}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Progress Report - ${studentName}</title>
        <style>
          @page { 
            margin: 20mm;
            @bottom-center {
              content: "Page " counter(page) " of " counter(pages);
              font-size: 10px;
              color: #6b7280;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            position: relative;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 72px;
            font-weight: bold;
            color: rgba(59, 130, 246, 0.05);
            z-index: -1;
            pointer-events: none;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
            position: relative;
          }
          .school-logo {
            max-width: 120px;
            max-height: 80px;
            margin-bottom: 15px;
          }
          .school-name {
            font-size: 28px;
            font-weight: 700;
            color: #1f2937;
            margin: 0;
          }
          .report-title {
            font-size: 20px;
            color: #6b7280;
            margin: 8px 0 0 0;
          }
          .qr-code {
            position: absolute;
            top: 0;
            right: 0;
            width: 80px;
            height: 80px;
          }
          .student-info {
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            color: white;
            padding: 24px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            page-break-inside: avoid;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .info-label {
            font-weight: 600;
            opacity: 0.9;
          }
          .section {
            margin: 30px 0;
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            page-break-inside: avoid;
          }
          .section-title {
            color: #1f2937;
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 16px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 8px;
          }
          .chart-container {
            width: 100%;
            max-width: 500px;
            margin: 20px auto;
            page-break-inside: avoid;
          }
          .progress-bar-container {
            margin: 15px 0;
          }
          .progress-bar {
            width: 100%;
            height: 30px;
            background: #e5e7eb;
            border-radius: 15px;
            overflow: hidden;
            position: relative;
          }
          .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #059669 0%, #10b981 100%);
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 14px;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 60px;
            gap: 40px;
            page-break-inside: avoid;
          }
          .signature-box {
            flex: 1;
            min-width: 200px;
          }
          .signature-label {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 8px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .signature-line {
            border-bottom: 2px solid #1f2937;
            height: 60px;
            margin-bottom: 8px;
          }
          .signature-name {
            font-size: 14px;
            color: #1f2937;
            font-weight: 500;
          }
          .signature-date {
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
          .page-footer {
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          .page-number {
            position: fixed;
            bottom: 10mm;
            right: 10mm;
            font-size: 10px;
            color: #9ca3af;
          }
          .approval-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .badge-approved {
            background: #d1fae5;
            color: #065f46;
          }
          .badge-pending {
            background: #fef3c7;
            color: #92400e;
          }
          .badge-rejected {
            background: #fee2e2;
            color: #991b1b;
          }
          .signature-img {
            max-width: 200px;
            max-height: 80px;
            height: auto;
            margin: 10px 0;
            display: block;
            object-fit: contain;
            image-orientation: from-image;
            border: 1px solid #e5e7eb;
            padding: 8px;
            background: white;
            border-radius: 4px;
          }
          @media print {
            body { 
              margin: 0;
              padding: 10mm;
            }
            .section {
              box-shadow: none;
              border: 1px solid #e5e7eb;
            }
          }
        </style>
      </head>
      <body>
        <div class="watermark">OFFICIAL DOCUMENT</div>
        <div class="header">
          <!-- School logo placeholder - will be populated from preschool settings -->
          <!-- <img src="[SCHOOL_LOGO_URL]" alt="School Logo" class="school-logo" /> -->
          <h1 class="school-name">${preschoolName}</h1>
          <p class="report-title">${isSchoolReadiness ? '🎓 School Readiness Report' : '📚 Student Progress Report'}</p>
          ${report.status ? `
            <div style="margin-top: 12px;">
              <span class="approval-badge ${report.status === 'approved' ? 'badge-approved' : report.status === 'pending_review' ? 'badge-pending' : report.status === 'rejected' ? 'badge-rejected' : ''}">
                ${report.status === 'approved' ? '✓ Approved' : report.status === 'pending_review' ? '⏳ Pending Review' : report.status === 'rejected' ? '✗ Needs Revision' : report.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          ` : ''}
          <!-- QR Code for digital verification -->
          <div class="qr-code">
            ${qrCodeURL}
          </div>
        </div>

        <div class="student-info">
          <div class="info-row">
            <span class="info-label">Student:</span>
            <span>${studentName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Parent/Guardian:</span>
            <span>${parentName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Report Period:</span>
            <span>${report.report_period}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date Issued:</span>
            <span>${currentDate}</span>
          </div>
          ${report.overall_grade ? `
          <div class="info-row" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.3);">
            <span class="info-label">Overall Grade:</span>
            <span style="font-size: 24px; font-weight: 700;">${report.overall_grade}</span>
          </div>
          ` : ''}
        </div>

        ${report.teacher_comments ? `
        <div class="section">
          <h2 class="section-title">Teacher's Comments</h2>
          <p style="color: #374151; margin: 0; white-space: pre-wrap;">${report.teacher_comments}</p>
        </div>
        ` : ''}

        ${report.strengths ? `
        <div class="section">
          <h2 class="section-title">Strengths</h2>
          <p style="color: #059669; margin: 0; white-space: pre-wrap;">${report.strengths}</p>
        </div>
        ` : ''}

        ${report.areas_for_improvement ? `
        <div class="section">
          <h2 class="section-title">Areas for Improvement</h2>
          <p style="color: #f59e0b; margin: 0; white-space: pre-wrap;">${report.areas_for_improvement}</p>
        </div>
        ` : ''}

        ${subjectsHTML}
        
        ${isSchoolReadiness && radarChartSVG ? `
        <div class="section">
          <h2 class="section-title">Development Areas Overview</h2>
          <div class="chart-container">
            ${radarChartSVG}
          </div>
        </div>
        ` : ''}
        
        ${readinessHTML}
        
        ${milestoneProgress ? `
        <div class="section">
          <h2 class="section-title">Milestone Progress</h2>
          <div class="progress-bar-container">
            <p style="margin: 0 0 10px 0; color: #374151; font-weight: 600;">
              ${milestoneProgress.achieved} of ${milestoneProgress.total} milestones achieved
            </p>
            <div class="progress-bar">
              <div class="progress-bar-fill" style="width: ${milestoneProgress.percentage}%;">
                ${milestoneProgress.percentage}%
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        ${report.readiness_notes && isSchoolReadiness ? `
        <div class="section">
          <h2 class="section-title">Readiness Notes</h2>
          <p style="color: #374151; margin: 0; white-space: pre-wrap;">${report.readiness_notes}</p>
        </div>
        ` : ''}

        ${report.recommendations && isSchoolReadiness ? `
        <div class="section">
          <h2 class="section-title">Recommendations</h2>
          <p style="color: #374151; margin: 0; white-space: pre-wrap;">${report.recommendations}</p>
        </div>
        ` : ''}

        ${report.recommendations && isSchoolReadiness ? `
        <div style="page-break-before: avoid;">
          <h3 style="color: #1f2937; margin-top: 30px;">Next Steps Timeline</h3>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
            <ul style="margin: 0; padding-left: 20px; color: #374151;">
              ${this.generateNextStepsTimeline(report.transition_readiness_level || 'developing')}
            </ul>
          </div>
        </div>
        ` : ''}
        
        <div class="signature-section">
          <div class="signature-box">
            <p class="signature-label">Teacher/Preparer</p>
            ${(report.teacher_signature || report.teacher_signature_data) ? `
              <img src="${report.teacher_signature || report.teacher_signature_data}" alt="Teacher Signature" 
                   class="signature-img" />
            ` : `
              <div class="signature-line"></div>
            `}
            <p class="signature-name">${teacherName}</p>
            <p class="signature-date">Signed: ${report.teacher_signed_at ? new Date(report.teacher_signed_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }) : currentDate}</p>
          </div>
          <div class="signature-box">
            <p class="signature-label">Principal/Head - ${report.status === 'approved' ? 'Approved' : 'Approval'}</p>
            ${report.principal_signature_data && report.status === 'approved' ? `
              <img src="${report.principal_signature_data}" alt="Principal Signature" 
                   class="signature-img" />
              <p class="signature-name">${report.reviewer_name || 'Principal'}</p>
              <p class="signature-date">Approved: ${report.principal_signed_at ? new Date(report.principal_signed_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date unavailable'}</p>
              ${report.review_notes ? `
                <p style="margin-top: 8px; font-size: 12px; color: #6b7280; font-style: italic;">Note: ${report.review_notes}</p>
              ` : ''}
            ` : `
              <div class="signature-line"></div>
              <p class="signature-name">___________________________</p>
              <p class="signature-date">Date: __________________</p>
            `}
          </div>
        </div>

        <div class="footer">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
            <div style="text-align: left;">
              <p style="margin: 0; font-weight: 600;">Prepared by: ${teacherName}</p>
              <p style="margin: 4px 0 0 0; font-size: 11px;">Teacher Signature: ${report.teacher_signed_at ? new Date(report.teacher_signed_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Pending'}</p>
            </div>
            ${report.status === 'approved' && report.reviewed_by ? `
              <div style="text-align: right;">
                <p style="margin: 0; font-weight: 600;">Approved by: ${report.reviewer_name || 'Principal'}</p>
                <p style="margin: 4px 0 0 0; font-size: 11px;">Approval Date: ${report.principal_signed_at ? new Date(report.principal_signed_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</p>
              </div>
            ` : ''}
          </div>
          <p style="margin: 0;">Generated by EduDash Pro - ${preschoolName}</p>
          <p style="margin: 4px 0 0 0;">Document ID: ${report.id || 'Preview'} | Generated: ${currentDate}</p>
          ${report.status ? `
            <p style="margin: 8px 0 0 0; font-size: 11px;">Status: ${report.status === 'approved' ? 'Approved & Finalized' : report.status === 'pending_review' ? 'Awaiting Principal Approval' : report.status === 'rejected' ? 'Returned for Revision' : report.status.toUpperCase()}</p>
          ` : ''}
          <p style="margin: 12px 0 0 0; font-size: 10px; font-style: italic;">
            This document is confidential and intended solely for the named parent/guardian. Unauthorized distribution is prohibited.
          </p>
        </div>
        <div class="page-number">Page 1</div>
      </body>
      </html>
    `;
  }

  /**
   * Generate progress report as PDF
   */
  async generateProgressReportPDF(
    report: ProgressReport,
    studentName: string,
    parentName: string,
    teacherName: string,
    preschoolName: string
  ): Promise<{ success: boolean; uri?: string; error?: string }> {
    try {
      // Generate professional PDF HTML instead of email template
      const html = this.generateProfessionalPDFHTML(
        report,
        studentName,
        parentName,
        teacherName,
        preschoolName
      );

      // Generate PDF from HTML
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      if (!uri) {
        return { success: false, error: 'Failed to generate PDF' };
      }

      // Optionally upload to Supabase Storage
      const fileName = `progress_report_${studentName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      // Move file to permanent location
      await FileSystem.moveAsync({
        from: uri,
        to: filePath,
      });

      return { success: true, uri: filePath };
    } catch (error: any) {
      console.error('[EmailTemplateService] Failed to generate PDF:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save progress report to database (upsert: insert or update if duplicate)
   */
  async saveProgressReport(report: Omit<ProgressReport, 'id'>): Promise<ProgressReport | null> {
    try {
      // First, check if a report exists for this student and period
      const { data: existing, error: fetchError } = await supabase
        .from('progress_reports')
        .select('id')
        .eq('student_id', report.student_id)
        .eq('report_period', report.report_period)
        .maybeSingle();

      if (fetchError) {
        console.error('[EmailTemplateService] Failed to check existing report:', fetchError);
        return null;
      }

      // If report exists, update it
      if (existing) {
        const { data, error } = await supabase
          .from('progress_reports')
          .update({
            ...report,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          console.error('[EmailTemplateService] Failed to update progress report:', error);
          return null;
        }

        return data;
      }

      // Otherwise, insert new report
      const { data, error } = await supabase
        .from('progress_reports')
        .insert(report)
        .select()
        .single();

      if (error) {
        console.error('[EmailTemplateService] Failed to save progress report:', error);
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('[EmailTemplateService] Unexpected error saving progress report:', error);
      return null;
    }
  }

  /**
   * Get progress reports for a student
   */
  async getProgressReports(studentId: string): Promise<ProgressReport[]> {
    const { data, error } = await supabase
      .from('progress_reports')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[EmailTemplateService] Failed to fetch progress reports:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Save newsletter to database
   */
  async saveNewsletter(newsletter: Omit<Newsletter, 'id'>): Promise<Newsletter | null> {
    const { data, error } = await supabase
      .from('newsletters')
      .insert(newsletter)
      .select()
      .single();

    if (error) {
      console.error('[EmailTemplateService] Failed to save newsletter:', error);
      return null;
    }

    return data;
  }

  /**
   * Get newsletters for a preschool
   */
  async getNewsletters(preschoolId: string): Promise<Newsletter[]> {
    const { data, error } = await supabase
      .from('newsletters')
      .select('*')
      .eq('preschool_id', preschoolId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[EmailTemplateService] Failed to fetch newsletters:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Send newsletter to recipients
   */
  async sendNewsletter(
    newsletter: Newsletter,
    recipients: Array<{ email: string; name: string; user_id?: string }>,
    preschoolName: string
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    try {
      const { subject, html } = await this.generateNewsletterEmail(newsletter, preschoolName);

      let sent = 0;
      let failed = 0;

      // Send to each recipient
      for (const recipient of recipients) {
        const result = await this.sendEmail({
          to: recipient.email,
          subject,
          body: html,
          is_html: true,
          confirmed: true,
        });

        if (result.success) {
          sent++;
          
          // Track individual send
          if (newsletter.id) {
            await supabase.from('newsletter_recipients').insert({
              newsletter_id: newsletter.id,
              user_id: recipient.user_id,
              email: recipient.email,
              status: 'sent',
              sent_at: new Date().toISOString(),
            });
          }
        } else {
          failed++;
          
          // Track failed send
          if (newsletter.id) {
            await supabase.from('newsletter_recipients').insert({
              newsletter_id: newsletter.id,
              user_id: recipient.user_id,
              email: recipient.email,
              status: 'failed',
              error_message: result.error,
            });
          }
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Update newsletter stats
      if (newsletter.id) {
        await supabase
          .from('newsletters')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            total_recipients: recipients.length,
            sent_count: sent,
            failed_count: failed,
          })
          .eq('id', newsletter.id);
      }

      return { success: true, sent, failed };
    } catch (error: any) {
      console.error('[EmailTemplateService] Failed to send newsletter:', error);
      return { success: false, sent: 0, failed: recipients.length };
    }
  }

  /**
   * Generate radar chart SVG for school readiness indicators
   */
  private generateRadarChartSVG(indicators: Record<string, { rating: number; notes: string }>): string {
    const size = 500;  // Increased from 400 to give more room for labels
    const center = size / 2;
    const maxRadius = 130;  // Reduced from 150 to give more label space
    const numAxes = Object.keys(indicators).length;
    const angleStep = (2 * Math.PI) / numAxes;

    // Calculate points for the polygon
    const points = Object.values(indicators).map((indicator, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const radius = (indicator.rating / 5) * maxRadius;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');

    // Generate axis lines and labels with better positioning
    const axes = Object.keys(indicators).map((key, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const x2 = center + maxRadius * Math.cos(angle);
      const y2 = center + maxRadius * Math.sin(angle);
      const labelDistance = maxRadius + 60;  // Increased from 30 to 60
      const labelX = center + labelDistance * Math.cos(angle);
      const labelY = center + labelDistance * Math.sin(angle);
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Determine text anchor based on position
      let textAnchor = 'middle';
      if (labelX < center - 20) textAnchor = 'end';
      else if (labelX > center + 20) textAnchor = 'start';
      
      return `
        <line x1="${center}" y1="${center}" x2="${x2}" y2="${y2}" stroke="#cbd5e1" stroke-width="1" />
        <text x="${labelX}" y="${labelY}" text-anchor="${textAnchor}" dominant-baseline="middle" font-size="11" fill="#374151" font-weight="600">${label}</text>
      `;
    }).join('');

    // Generate concentric circles for scale
    const circles = [1, 2, 3, 4, 5].map(level => {
      const radius = (level / 5) * maxRadius;
      return `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#e5e7eb" stroke-width="1" />`;
    }).join('');

    return `
      <svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto;">
        <!-- Background circles -->
        ${circles}
        
        <!-- Axes -->
        ${axes}
        
        <!-- Data polygon -->
        <polygon points="${points}" fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" stroke-width="2" />
        
        <!-- Center point -->
        <circle cx="${center}" cy="${center}" r="4" fill="#3b82f6" />
        
        <!-- Legend -->
        <text x="${center}" y="${size - 20}" text-anchor="middle" font-size="11" fill="#6b7280">Rating Scale: 1 (Center) to 5 (Outer)</text>
      </svg>
    `;
  }

  /**
   * Calculate milestone progress
   */
  private calculateMilestoneProgress(milestones: Record<string, boolean>): { achieved: number; total: number; percentage: number } {
    const total = Object.keys(milestones).length;
    const achieved = Object.values(milestones).filter(Boolean).length;
    const percentage = total > 0 ? Math.round((achieved / total) * 100) : 0;
    
    return { achieved, total, percentage };
  }

  /**
   * Generate QR code placeholder
   * TODO: Integrate with actual QR code library (e.g., qrcode.react or expo-qrcode)
   */
  private generateQRCodePlaceholder(reportId: string): string {
    // Placeholder SVG QR code icon
    return `
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" rx="4" fill="#f3f4f6"/>
        <rect x="10" y="10" width="25" height="25" rx="2" fill="#1f2937"/>
        <rect x="45" y="10" width="25" height="25" rx="2" fill="#1f2937"/>
        <rect x="10" y="45" width="25" height="25" rx="2" fill="#1f2937"/>
        <rect x="15" y="15" width="15" height="15" rx="1" fill="#f3f4f6"/>
        <rect x="50" y="15" width="15" height="15" rx="1" fill="#f3f4f6"/>
        <rect x="15" y="50" width="15" height="15" rx="1" fill="#f3f4f6"/>
        <rect x="45" y="45" width="10" height="10" fill="#1f2937"/>
        <rect x="58" y="45" width="12" height="12" fill="#1f2937"/>
        <rect x="45" y="58" width="12" height="12" fill="#1f2937"/>
        <text x="40" y="75" font-size="8" fill="#6b7280" text-anchor="middle">Scan Me</text>
      </svg>
    `;
  }

  /**
   * Generate next steps timeline based on readiness level
   */
  private generateNextStepsTimeline(readinessLevel: string): string {
    const timelines: Record<string, string[]> = {
      not_ready: [
        'Focus on developing basic self-care skills (using toilet, washing hands)',
        'Practice following simple 2-3 step instructions at home',
        'Read together daily to build vocabulary and listening skills',
        'Arrange regular playdates to develop social interaction',
        'Work on recognizing letters and numbers through play',
        'Schedule follow-up assessment in 3-4 months'
      ],
      developing: [
        'Continue building on strengths identified in this report',
        'Practice writing name and basic letter formation',
        'Encourage counting and simple addition/subtraction during daily activities',
        'Support independence in dressing and personal care',
        'Maintain consistent bedtime and morning routines',
        'Plan school visits to build familiarity and confidence'
      ],
      ready: [
        'Maintain current routines and continue supporting learning at home',
        'Visit the new school together to meet teachers and see classrooms',
        'Practice the new school routine (wake-up time, packing bag)',
        'Read books about starting "big school" to build excitement',
        'Continue developing reading and writing skills through fun activities',
        'Ensure all school registration paperwork is complete'
      ],
      exceeds_expectations: [
        'Challenge your child with age-appropriate advanced activities',
        'Consider enrichment programs or additional learning opportunities',
        'Prepare for potential placement in advanced learning groups',
        'Continue fostering love of learning through exploration and discovery',
        'Maintain balance between academic activities and play',
        'Connect with the new school about gifted/talented programs if available'
      ]
    };

    const steps = timelines[readinessLevel] || timelines.developing;
    return steps.map(step => `<li style="margin-bottom: 8px;">${step}</li>`).join('');
  }

  /**
   * Export progress report data as CSV for record keeping
   */
  async exportProgressReportCSV(
    report: ProgressReport,
    studentName: string,
    preschoolName: string
  ): Promise<{ success: boolean; csv?: string; uri?: string; error?: string }> {
    try {
      const isSchoolReadiness = report.report_category === 'school_readiness';
      
      // Build CSV header
      let csvContent = 'Field,Value\n';
      
      // Basic information
      csvContent += `"Student Name","${studentName}"\n`;
      csvContent += `"School","${preschoolName}"\n`;
      csvContent += `"Report Period","${report.report_period}"\n`;
      csvContent += `"Report Type","${report.report_type}"\n`;
      csvContent += `"Report Category","${report.report_category || 'general'}"\n`;
      csvContent += `"Overall Grade","${report.overall_grade || 'N/A'}"\n`;
      csvContent += `"Date Generated","${new Date().toISOString()}"\n`;
      csvContent += '\n';
      
      // Teacher comments
      csvContent += `"Teacher Comments","${(report.teacher_comments || '').replace(/"/g, '""')}"\n`;
      csvContent += `"Strengths","${(report.strengths || '').replace(/"/g, '""')}"\n`;
      csvContent += `"Areas for Improvement","${(report.areas_for_improvement || '').replace(/"/g, '""')}"\n`;
      csvContent += '\n';
      
      // School readiness specific data
      if (isSchoolReadiness) {
        csvContent += `"Transition Readiness Level","${report.transition_readiness_level || 'N/A'}"\n`;
        csvContent += `"Readiness Notes","${(report.readiness_notes || '').replace(/"/g, '""')}"\n`;
        csvContent += `"Recommendations","${(report.recommendations || '').replace(/"/g, '""')}"\n`;
        csvContent += '\n';
        
        // Development indicators
        if (report.school_readiness_indicators) {
          csvContent += '"Development Area","Rating","Notes"\n';
          Object.entries(report.school_readiness_indicators).forEach(([key, value]) => {
            const area = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            csvContent += `"${area}","${value.rating}/5","${(value.notes || '').replace(/"/g, '""')}"\n`;
          });
          csvContent += '\n';
        }
        
        // Milestones
        if (report.developmental_milestones) {
          csvContent += '"Milestone","Achieved"\n';
          Object.entries(report.developmental_milestones).forEach(([key, achieved]) => {
            const milestone = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            csvContent += `"${milestone}","${achieved ? 'Yes' : 'No'}"\n`;
          });
        }
      } else {
        // Subject performance
        if (report.subjects_performance) {
          csvContent += '"Subject","Grade","Comments"\n';
          Object.entries(report.subjects_performance).forEach(([subject, data]) => {
            csvContent += `"${subject}","${data.grade}","${(data.comments || '').replace(/"/g, '""')}"\n`;
          });
        }
      }
      
      // Save to file
      const fileName = `progress_report_${studentName.replace(/\s+/g, '_')}_${Date.now()}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      
      return { success: true, csv: csvContent, uri: filePath };
    } catch (error: any) {
      console.error('[EmailTemplateService] Failed to export CSV:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Bulk generate progress reports for multiple students
   */
  async bulkGenerateProgressReports(
    reports: Array<{ report: Omit<ProgressReport, 'id'>; studentName: string; parentEmail: string; parentName: string }>,
    teacherName: string,
    preschoolName: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < reports.length; i++) {
      const { report, studentName, parentEmail, parentName } = reports[i];
      
      try {
        // Save report
        const savedReport = await this.saveProgressReport(report);
        if (!savedReport) {
          throw new Error('Failed to save report');
        }
        
        // Send email
        const result = await this.sendProgressReport(
          { ...savedReport, id: savedReport.id },
          parentEmail,
          studentName,
          parentName,
          teacherName,
          preschoolName
        );
        
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push(`${studentName}: ${result.error || 'Unknown error'}`);
        }
      } catch (error: any) {
        failed++;
        errors.push(`${studentName}: ${error.message}`);
      }
      
      // Report progress
      if (onProgress) {
        onProgress(i + 1, reports.length);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { success, failed, errors };
  }

  /**
   * Generate school readiness report HTML
   * Specialized template for Grade R students transitioning to formal school
   */
  async generateSchoolReadinessEmail(
    report: ProgressReport,
    studentName: string,
    parentName: string,
    teacherName: string,
    preschoolName: string
  ): Promise<{ subject: string; html: string; text: string }> {
    // Generate readiness indicators table
    const readinessTable = report.school_readiness_indicators
      ? Object.entries(report.school_readiness_indicators)
          .map(
            ([indicator, data]) => {
              const ratingStars = '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating);
              const indicatorLabel = indicator.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              return `<tr>
                <td style="padding: 12px; border: 1px solid #ddd;">${indicatorLabel}</td>
                <td style="padding: 12px; border: 1px solid #ddd; color: #F59E0B;">${ratingStars}</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${data.notes || 'N/A'}</td>
              </tr>`;
            }
          )
          .join('')
      : '<tr><td colspan="3" style="padding: 8px;">No readiness data available</td></tr>';

    const readinessTableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Development Area</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Rating</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${readinessTable}
        </tbody>
      </table>
    `;

    // Generate milestones checklist
    const milestonesHtml = report.developmental_milestones
      ? Object.entries(report.developmental_milestones)
          .map(
            ([milestone, achieved]) => {
              const icon = achieved ? '✅' : '⏳';
              const milestoneLabel = milestone.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              return `<li style="padding: 4px 0;"><span style="font-size: 16px;">${icon}</span> ${milestoneLabel}</li>`;
            }
          )
          .join('')
      : '<li>No milestones tracked</li>';

    const readinessLevelColor = {
      not_ready: '#DC2626',
      developing: '#F59E0B',
      ready: '#059669',
      exceeds_expectations: '#7C3AED',
    }[report.transition_readiness_level || 'developing'];

    const readinessLevelText = {
      not_ready: 'Not Ready',
      developing: 'Developing',
      ready: 'Ready for School',
      exceeds_expectations: 'Exceeds Expectations',
    }[report.transition_readiness_level || 'developing'];

    // Variables for template
    const variables = {
      student_name: studentName,
      parent_name: parentName,
      report_period: report.report_period,
      transition_readiness_level: readinessLevelText,
      readiness_level_color: readinessLevelColor,
      readiness_indicators_table: readinessTableHtml,
      developmental_milestones: milestonesHtml,
      readiness_notes: report.readiness_notes || 'No additional notes',
      recommendations: report.recommendations || 'Continue supporting your child\'s learning at home.',
      teacher_comments: report.teacher_comments || '',
      teacher_name: teacherName,
      preschool_name: preschoolName,
      strengths: report.strengths || '',
      areas_for_improvement: report.areas_for_improvement || '',
    };

    // Build HTML email body
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>School Readiness Report - ${studentName}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px;">🎓 School Readiness Report</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${preschoolName}</p>
        </div>

        <div style="background: #f9fafb; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <p style="margin: 0;">Dear ${parentName},</p>
          <p>This report assesses <strong>${studentName}'s</strong> readiness for transitioning to formal schooling for the period: <strong>${report.report_period}</strong></p>
        </div>

        <div style="background: ${readinessLevelColor}15; border-left: 4px solid ${readinessLevelColor}; padding: 20px; margin-bottom: 20px; border-radius: 5px;">
          <h2 style="margin: 0 0 10px 0; color: ${readinessLevelColor};">Overall Readiness Level</h2>
          <p style="font-size: 24px; font-weight: bold; margin: 0; color: ${readinessLevelColor};">${readinessLevelText}</p>
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Development Areas Assessment</h2>
          ${readinessTableHtml}
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Developmental Milestones</h2>
          <ul style="list-style: none; padding: 0;">
            ${milestonesHtml}
          </ul>
        </div>

        ${variables.strengths ? `
        <div style="background: #d1fae5; border-left: 4px solid #059669; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0; color: #059669;">💪 Strengths</h3>
          <p style="margin: 0;">${variables.strengths}</p>
        </div>
        ` : ''}

        ${variables.areas_for_improvement ? `
        <div style="background: #fef3c7; border-left: 4px solid #F59E0B; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0; color: #F59E0B;">🎯 Areas for Growth</h3>
          <p style="margin: 0;">${variables.areas_for_improvement}</p>
        </div>
        ` : ''}

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0; color: #3b82f6;">📝 Teacher's Notes</h3>
          <p style="margin: 0;">${variables.readiness_notes}</p>
        </div>

        <div style="background: #faf5ff; border-left: 4px solid #7c3aed; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0; color: #7c3aed;">💡 Recommendations</h3>
          <p style="margin: 0;">${variables.recommendations}</p>
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280;">
          <p style="margin: 5px 0;"><strong>Prepared by:</strong> ${teacherName}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p style="margin: 15px 0 5px 0; font-size: 12px;">This report is confidential and intended for parent/guardian review.</p>
        </div>
      </body>
      </html>
    `;

    const subject = `School Readiness Report - ${studentName} (${report.report_period})`;
    const text = `School Readiness Report for ${studentName}\n\nOverall Readiness: ${readinessLevelText}\n\nTeacher: ${teacherName}\n${preschoolName}`;

    return { subject, html, text };
  }
}

export const emailTemplateService = new EmailTemplateService();
export default emailTemplateService;
