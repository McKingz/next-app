/**
 * PDF Template Renderers
 * 
 * HTML rendering implementations for all document types.
 * These are used by PDFTemplateService to generate themed PDFs.
 */

import { EducationalPDFService } from './EducationalPDFService';
import type {
  StudyGuideData,
  LessonPlanData,
  ProgressReportData,
  AssessmentData,
  CertificateData,
  NewsletterData,
  EnhancedWorksheetData,
  TemplateOptions,
} from './PDFTemplateService';

// ====================================================================
// BASE RENDERER
// ====================================================================

class BaseRenderer {
  protected getEnhancedStyles(options: TemplateOptions): string {
    const theme = options.theme || 'professional';
    const branding = options.branding || { organizationName: 'EduDash Pro', primaryColor: '#1565c0' };

    const themeColors = {
      professional: { primary: '#1a237e', secondary: '#3949ab', accent: '#5c6bc0' },
      colorful: { primary: '#1565c0', secondary: '#42a5f5', accent: '#ff9800' },
      minimalist: { primary: '#000000', secondary: '#424242', accent: '#757575' },
    };

    const colors = themeColors[theme];

    return `
      <style>
        :root {
          --primary: ${branding.primaryColor || colors.primary};
          --secondary: ${colors.secondary};
          --accent: ${branding.accentColor || colors.accent};
        }
        @page { size: ${options.paperSize || 'A4'} ${options.orientation || 'portrait'}; margin: 2cm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        h1 { font-size: 32px; color: var(--primary); margin-bottom: 16px; page-break-after: avoid; }
        h2 { font-size: 26px; color: var(--primary); margin: 24px 0 12px; page-break-after: avoid; }
        h3 { font-size: 22px; color: var(--secondary); margin: 20px 0 10px; }
        h4 { font-size: 18px; color: var(--secondary); margin: 16px 0 8px; }
        p { margin-bottom: 12px; }
        ul, ol { margin: 12px 0 12px 24px; }
        li { margin-bottom: 6px; }
        .page-break { page-break-after: always; }
        .no-break { page-break-inside: avoid; }
        .header { text-align: center; border-bottom: 3px solid var(--primary); padding-bottom: 20px; margin-bottom: 30px; }
        .footer { text-align: center; border-top: 1px solid #ddd; padding-top: 16px; margin-top: 40px; font-size: 12px; color: #666; }
        .section { margin: 20px 0; padding: 16px; background: #f9f9f9; border-left: 4px solid var(--primary); }
        .vocab-box { background: #e3f2fd; padding: 12px; margin: 10px 0; border-radius: 8px; }
        .callout { background: #fff3e0; border-left: 4px solid var(--accent); padding: 16px; margin: 20px 0; }
        ${options.enableWatermark && branding.watermarkText ? `
          body::before {
            content: "${branding.watermarkText}";
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            color: rgba(0, 0, 0, 0.05);
            z-index: -1;
          }
        ` : ''}
      </style>
    `;
  }

  protected escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// ====================================================================
// STUDY GUIDE RENDERER
// ====================================================================

export class StudyGuideRenderer extends BaseRenderer {
  render(data: StudyGuideData, options: TemplateOptions): string {
    const toc = this.renderTableOfContents(data);
    const content = this.renderContent(data);
    const vocabulary = this.renderVocabulary(data);
    const practice = this.renderPracticeQuestions(data);
    const answerKey = data.answerKey ? this.renderAnswerKey(data) : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${this.escapeHtml(data.topic)} - Study Guide</title>
        ${this.getEnhancedStyles(options)}
      </head>
      <body>
        <div class="header">
          <h1>📚 ${this.escapeHtml(data.topic)}</h1>
          <p style="font-size: 18px; color: #666;">Study Guide for Grade ${data.gradeLevel}</p>
          ${data.subject ? `<p style="color: #999;">${this.escapeHtml(data.subject)}</p>` : ''}
        </div>

        ${options.enableTableOfContents ? toc : ''}
        
        <div class="section">
          <h2>📖 Introduction</h2>
          <p>${this.escapeHtml(data.introduction)}</p>
        </div>

        ${data.objectives.length > 0 ? `
          <div class="callout">
            <h3>🎯 Learning Objectives</h3>
            <ul>
              ${data.objectives.map(obj => `<li>${this.escapeHtml(obj)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${content}
        ${vocabulary}
        <div class="page-break"></div>
        ${practice}
        ${answerKey}

        ${data.additionalResources ? `
          <div class="section">
            <h2>📚 Additional Resources</h2>
            <ul>
              ${data.additionalResources.map(res => `<li>${this.escapeHtml(res)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="footer">
          <p>${options.branding?.footerText || 'Generated by Dash AI • EduDash Pro'}</p>
          <p>Study Guide | ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
  }

  private renderTableOfContents(data: StudyGuideData): string {
    return `
      <div class="section no-break">
        <h2>📋 Table of Contents</h2>
        <ol style="line-height: 2;">
          <li>Introduction</li>
          ${data.sections.map(s => `<li>${this.escapeHtml(s.title)}</li>`).join('')}
          <li>Key Vocabulary</li>
          <li>Practice Questions</li>
          ${data.answerKey ? '<li>Answer Key</li>' : ''}
        </ol>
      </div>
      <div class="page-break"></div>
    `;
  }

  private renderContent(data: StudyGuideData): string {
    return data.sections.map(section => `
      <div class="section no-break">
        <h2>${this.escapeHtml(section.title)}</h2>
        <p>${this.escapeHtml(section.content)}</p>
        ${section.keyPoints ? `
          <div style="margin-top: 16px;">
            <h4>Key Points:</h4>
            <ul>
              ${section.keyPoints.map(kp => `<li>${this.escapeHtml(kp)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  private renderVocabulary(data: StudyGuideData): string {
    return `
      <div class="page-break"></div>
      <h2>📖 Key Vocabulary</h2>
      ${data.vocabulary.map(v => `
        <div class="vocab-box no-break">
          <h4 style="color: #1565c0; margin: 0 0 8px 0;">${this.escapeHtml(v.term)}</h4>
          <p style="margin: 0;">${this.escapeHtml(v.definition)}</p>
          ${v.example ? `<p style="margin-top: 8px; font-style: italic; color: #666;">Example: ${this.escapeHtml(v.example)}</p>` : ''}
        </div>
      `).join('')}
    `;
  }

  private renderPracticeQuestions(data: StudyGuideData): string {
    return `
      <h2>✍️ Practice Questions</h2>
      ${data.practiceQuestions.map((q, i) => `
        <div class="no-break" style="margin: 20px 0;">
          <p style="font-weight: bold;">${i + 1}. ${this.escapeHtml(q.question)}</p>
          ${q.type === 'multiple-choice' && q.options ? `
            <div style="margin-left: 20px;">
              ${q.options.map((opt, j) => `<p>${String.fromCharCode(65 + j)}. ${this.escapeHtml(opt)}</p>`).join('')}
            </div>
          ` : q.type === 'short-answer' ? `
            <div style="border-bottom: 1px solid #ccc; height: 60px; margin: 10px 0;"></div>
          ` : `
            <div style="border: 1px solid #ddd; min-height: 120px; margin: 10px 0; padding: 10px;"></div>
          `}
        </div>
      `).join('')}
    `;
  }

  private renderAnswerKey(data: StudyGuideData): string {
    return `
      <div class="page-break"></div>
      <div style="background: #fff3e0; padding: 20px; border: 2px dashed #ff9800; border-radius: 8px;">
        <h2 style="color: #e65100;">🔑 Answer Key (For Teachers/Parents)</h2>
        ${data.practiceQuestions.map((q, i) => q.answer ? `
          <p><strong>${i + 1}.</strong> ${this.escapeHtml(q.answer)}</p>
        ` : '').join('')}
      </div>
    `;
  }
}

// ====================================================================
// LESSON PLAN RENDERER
// ====================================================================

export class LessonPlanRenderer extends BaseRenderer {
  render(data: LessonPlanData, options: TemplateOptions): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${this.escapeHtml(data.topic)} - Lesson Plan</title>
        ${this.getEnhancedStyles(options)}
      </head>
      <body>
        <div class="header">
          <h1>📝 ${this.escapeHtml(data.topic)}</h1>
          <p style="font-size: 18px;">Lesson Plan | Grade ${data.gradeLevel} | ${data.duration} minutes</p>
          <p style="color: #666;">${this.escapeHtml(data.subject)}</p>
        </div>

        ${this.renderObjectives(data)}
        ${data.standards ? this.renderStandards(data.standards) : ''}
        ${this.renderMaterials(data)}
        ${this.renderProcedure(data)}
        ${data.differentiation ? this.renderDifferentiation(data.differentiation) : ''}
        ${this.renderAssessment(data)}
        ${data.exitTicket ? this.renderExitTicket(data.exitTicket) : ''}
        ${data.reflectionNotes ? this.renderReflection(data.reflectionNotes) : ''}

        <div class="footer">
          <p>${options.branding?.footerText || 'Generated by Dash AI • EduDash Pro'}</p>
          <p>Lesson Plan | ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
  }

  private renderObjectives(data: LessonPlanData): string {
    return `
      <div class="callout">
        <h2>🎯 Learning Objectives</h2>
        <ul>
          ${data.objectives.map(obj => `<li>${this.escapeHtml(obj)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  private renderStandards(standards: string[]): string {
    return `
      <div class="section">
        <h3>📐 Standards Alignment</h3>
        <ul>
          ${standards.map(std => `<li>${this.escapeHtml(std)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  private renderMaterials(data: LessonPlanData): string {
    return `
      <div class="section">
        <h2>📦 Materials Needed</h2>
        <ul>
          ${data.materials.map(mat => `<li>${this.escapeHtml(mat)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  private renderProcedure(data: LessonPlanData): string {
    return `
      <div class="page-break"></div>
      <h2>🔄 Procedure</h2>
      ${EducationalPDFService.createTimelineHTML(data.procedure)}
    `;
  }

  private renderDifferentiation(diff: { support: string[]; extension: string[] }): string {
    return `
      <div class="section">
        <h2>🎨 Differentiation</h2>
        ${diff.support.length > 0 ? `
          <h4>Support Strategies:</h4>
          <ul>
            ${diff.support.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}
          </ul>
        ` : ''}
        ${diff.extension.length > 0 ? `
          <h4>Extension Activities:</h4>
          <ul>
            ${diff.extension.map(e => `<li>${this.escapeHtml(e)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;
  }

  private renderAssessment(data: LessonPlanData): string {
    return `
      <div class="section">
        <h2>✅ Assessment</h2>
        <h4>Formative Assessment:</h4>
        <ul>
          ${data.assessment.formative.map(f => `<li>${this.escapeHtml(f)}</li>`).join('')}
        </ul>
        ${data.assessment.summative ? `
          <h4>Summative Assessment:</h4>
          <p>${this.escapeHtml(data.assessment.summative)}</p>
        ` : ''}
      </div>
    `;
  }

  private renderExitTicket(exitTicket: string): string {
    return `
      <div class="callout">
        <h3>🎫 Exit Ticket</h3>
        <p>${this.escapeHtml(exitTicket)}</p>
      </div>
    `;
  }

  private renderReflection(notes: string): string {
    return `
      <div class="section">
        <h3>💭 Reflection Notes</h3>
        <p>${this.escapeHtml(notes)}</p>
      </div>
    `;
  }
}

// ====================================================================
// PROGRESS REPORT RENDERER
// ====================================================================

export class ProgressReportRenderer extends BaseRenderer {
  render(data: ProgressReportData, options: TemplateOptions): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Progress Report - ${this.escapeHtml(data.student.name)}</title>
        ${this.getEnhancedStyles(options)}
      </head>
      <body>
        <div class="header">
          <h1>📊 Student Progress Report</h1>
          <p style="font-size: 18px;">${this.escapeHtml(data.student.name)} | Grade ${data.student.grade}</p>
          <p style="color: #666;">${this.escapeHtml(data.reportingPeriod)}</p>
        </div>

        ${this.renderOverview(data)}
        ${this.renderSubjects(data)}
        ${data.achievements.length > 0 ? this.renderAchievements(data.achievements) : ''}
        ${data.recommendations.length > 0 ? this.renderRecommendations(data.recommendations) : ''}
        ${data.attendance ? this.renderAttendance(data.attendance) : ''}
        ${this.renderSignatures(data)}

        <div class="footer">
          <p>${options.branding?.footerText || 'Generated by Dash AI • EduDash Pro'}</p>
          <p>Progress Report | ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;
  }

  private renderOverview(data: ProgressReportData): string {
    return `
      <div class="section">
        <h2>📈 Overall Progress</h2>
        ${EducationalPDFService.createProgressBar(data.overallProgress, 'Overall Achievement')}
      </div>
    `;
  }

  private renderSubjects(data: ProgressReportData): string {
    return `
      <div class="page-break"></div>
      <h2>📚 Subject Performance</h2>
      ${data.subjects.map(subject => `
        <div class="section no-break" style="margin: 20px 0;">
          <h3>${this.escapeHtml(subject.name)} - ${this.escapeHtml(subject.grade)}</h3>
          ${EducationalPDFService.createProgressBar(subject.progress, 'Progress')}
          
          ${subject.strengths.length > 0 ? `
            <h4 style="color: #388e3c; margin-top: 16px;">💪 Strengths:</h4>
            <ul>
              ${subject.strengths.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}
            </ul>
          ` : ''}
          
          ${subject.areasForGrowth.length > 0 ? `
            <h4 style="color: #f57c00; margin-top: 12px;">📈 Areas for Growth:</h4>
            <ul>
              ${subject.areasForGrowth.map(a => `<li>${this.escapeHtml(a)}</li>`).join('')}
            </ul>
          ` : ''}
          
          <h4 style="margin-top: 12px;">💬 Teacher Comments:</h4>
          <p style="font-style: italic;">${this.escapeHtml(subject.teacherComments)}</p>
        </div>
      `).join('')}
    `;
  }

  private renderAchievements(achievements: string[]): string {
    return `
      <div class="callout">
        <h2>🏆 Achievements & Highlights</h2>
        <ul>
          ${achievements.map(a => `<li>${this.escapeHtml(a)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  private renderRecommendations(recommendations: string[]): string {
    return `
      <div class="section">
        <h2>💡 Recommendations</h2>
        <ul>
          ${recommendations.map(r => `<li>${this.escapeHtml(r)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  private renderAttendance(attendance: { present: number; absent: number; tardy: number }): string {
    const total = attendance.present + attendance.absent + attendance.tardy;
    const attendanceRate = total > 0 ? Math.round((attendance.present / total) * 100) : 0;

    return `
      <div class="section">
        <h2>📅 Attendance</h2>
        ${EducationalPDFService.createTableHTML({
          headers: ['Status', 'Days', 'Percentage'],
          rows: [
            ['Present', attendance.present.toString(), `${Math.round((attendance.present / total) * 100)}%`],
            ['Absent', attendance.absent.toString(), `${Math.round((attendance.absent / total) * 100)}%`],
            ['Tardy', attendance.tardy.toString(), `${Math.round((attendance.tardy / total) * 100)}%`],
          ],
        }, { compact: true })}
        ${EducationalPDFService.createProgressBar(attendanceRate, 'Attendance Rate')}
      </div>
    `;
  }

  private renderSignatures(data: ProgressReportData): string {
    return `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd;">
        <div style="display: flex; justify-content: space-between;">
          <div style="flex: 1; margin-right: 20px;">
            <p><strong>Teacher:</strong> ${this.escapeHtml(data.teacherName)}</p>
            <div style="border-bottom: 1px solid #000; margin-top: 30px; margin-bottom: 10px;"></div>
            <p style="font-size: 12px;">Signature & Date</p>
          </div>
          <div style="flex: 1;">
            <p><strong>Parent/Guardian:</strong></p>
            <div style="border-bottom: 1px solid #000; margin-top: 30px; margin-bottom: 10px;"></div>
            <p style="font-size: 12px;">Signature & Date</p>
          </div>
        </div>
      </div>
    `;
  }
}

// ====================================================================
// ASSESSMENT RENDERER
// ====================================================================

export class AssessmentRenderer extends BaseRenderer {
  render(data: AssessmentData, options: TemplateOptions): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${this.escapeHtml(data.title)}</title>
        ${this.getEnhancedStyles(options)}
      </head>
      <body>
        <div class="header">
          <h1>📝 ${this.escapeHtml(data.title)}</h1>
          <p style="font-size: 18px;">Grade ${data.gradeLevel} | ${data.subject}</p>
          <p style="color: #666;">Time: ${data.duration} minutes | Total Points: ${data.totalPoints}</p>
        </div>

        <div style="display: flex; justify-content: space-between; margin: 20px 0;">
          <div>
            <p><strong>Name:</strong> ___________________________</p>
            <p><strong>Date:</strong> ___________________________</p>
          </div>
          <div>
            <p><strong>Score:</strong> _______ / ${data.totalPoints}</p>
            <p><strong>Grade:</strong> _______</p>
          </div>
        </div>

        <div class="callout">
          <h3>📋 Instructions</h3>
          <p>${this.escapeHtml(data.instructions)}</p>
        </div>

        ${this.renderSections(data)}
        ${data.rubric ? this.renderRubric(data.rubric) : ''}
        ${data.answerKey ? this.renderAnswerKey(data) : ''}

        <div class="footer">
          <p>${options.branding?.footerText || 'Generated by Dash AI • EduDash Pro'}</p>
        </div>
      </body>
      </html>
    `;
  }

  private renderSections(data: AssessmentData): string {
    return data.sections.map((section, sectionIndex) => `
      <div class="page-break"></div>
      <div class="section">
        <h2>Section ${sectionIndex + 1}: ${this.escapeHtml(section.title)}</h2>
        <p><em>Difficulty: ${section.difficulty.toUpperCase()} | Points: ${section.points}</em></p>
      </div>

      ${section.questions.map((q, qIndex) => `
        <div class="no-break" style="margin: 20px 0;">
          <p style="font-weight: bold;">${q.id}. ${this.escapeHtml(q.question)} <span style="float: right;">[${q.points} pts]</span></p>
          
          ${q.type === 'multiple-choice' && q.options ? `
            <div style="margin-left: 20px;">
              ${q.options.map((opt, i) => `
                <p><input type="checkbox" disabled style="margin-right: 8px;"> ${String.fromCharCode(65 + i)}. ${this.escapeHtml(opt)}</p>
              `).join('')}
            </div>
          ` : q.type === 'true-false' ? `
            <div style="margin-left: 20px;">
              <p><input type="checkbox" disabled style="margin-right: 8px;"> True</p>
              <p><input type="checkbox" disabled style="margin-right: 8px;"> False</p>
            </div>
          ` : q.type === 'short-answer' ? `
            <div style="border-bottom: 1px solid #ccc; height: 60px; margin: 10px 0;"></div>
            <div style="border-bottom: 1px solid #ccc; height: 60px; margin: 10px 0;"></div>
          ` : `
            <div style="border: 1px solid #ddd; min-height: 150px; margin: 10px 0; padding: 10px;">
              <em style="color: #999;">Write your answer here...</em>
            </div>
          `}
        </div>
      `).join('')}
    `).join('');
  }

  private renderRubric(rubric: Array<{ name: string; levels: Array<{ label: string; description: string; points: number }> }>): string {
    return `
      <div class="page-break"></div>
      ${EducationalPDFService.createRubricTable(rubric)}
    `;
  }

  private renderAnswerKey(data: AssessmentData): string {
    return `
      <div class="page-break"></div>
      <div style="background: #fff3e0; padding: 20px; border: 2px dashed #ff9800; border-radius: 8px;">
        <h2 style="color: #e65100;">🔑 Answer Key (For Teachers)</h2>
        ${data.sections.map((section, si) => `
          <h3>Section ${si + 1}: ${this.escapeHtml(section.title)}</h3>
          ${section.questions.map(q => q.answer ? `
            <p><strong>${q.id}.</strong> ${this.escapeHtml(q.answer)}</p>
          ` : '').join('')}
        `).join('')}
      </div>
    `;
  }
}

// ====================================================================
// CERTIFICATE RENDERER
// ====================================================================

export class CertificateRenderer extends BaseRenderer {
  render(data: CertificateData, options: TemplateOptions): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Certificate - ${this.escapeHtml(data.recipientName)}</title>
        <style>
          @page { size: ${options.paperSize || 'A4'} landscape; margin: 1cm; }
          body { font-family: Georgia, serif; text-align: center; padding: 40px; }
          .certificate { border: 10px double #d4af37; padding: 60px; min-height: 500px; display: flex; flex-direction: column; justify-content: center; background: linear-gradient(135deg, #fff 0%, #f8f8f8 100%); }
          .ornament { font-size: 60px; color: #d4af37; }
          h1 { font-size: 48px; color: #1a237e; margin: 20px 0; letter-spacing: 2px; }
          .recipient { font-size: 36px; color: #000; margin: 30px 0; font-weight: bold; border-bottom: 2px solid #d4af37; display: inline-block; padding-bottom: 10px; }
          .achievement { font-size: 24px; margin: 20px 0; }
          .description { font-size: 18px; color: #666; margin: 20px 0; max-width: 600px; margin-left: auto; margin-right: auto; }
          .signatures { display: flex; justify-content: space-around; margin-top: 60px; }
          .signature-line { border-top: 2px solid #000; width: 200px; margin-top: 40px; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="ornament">✦</div>
          <h1>CERTIFICATE</h1>
          <div class="ornament" style="font-size: 30px;">OF ACHIEVEMENT</div>
          
          <p style="font-size: 20px; margin: 40px 0 20px;">This certificate is proudly presented to</p>
          <div class="recipient">${this.escapeHtml(data.recipientName)}</div>
          
          <p class="achievement">${this.escapeHtml(data.achievement)}</p>
          
          ${data.description ? `
            <p class="description">${this.escapeHtml(data.description)}</p>
          ` : ''}
          
          ${data.customMessage ? `
            <p class="description" style="font-style: italic;">${this.escapeHtml(data.customMessage)}</p>
          ` : ''}
          
          <p style="margin-top: 40px; font-size: 18px;">Awarded on ${this.escapeHtml(data.date)}</p>
          
          <div class="signatures">
            ${data.signatures.map(sig => `
              <div>
                <div class="signature-line"></div>
                <p style="font-size: 14px; margin-top: 5px;"><strong>${this.escapeHtml(sig.name)}</strong></p>
                <p style="font-size: 12px; color: #666;">${this.escapeHtml(sig.title)}</p>
              </div>
            `).join('')}
          </div>
          
          ${options.branding?.organizationName ? `
            <p style="margin-top: 40px; font-size: 16px; color: #999;">${this.escapeHtml(options.branding.organizationName)}</p>
          ` : ''}
          
          <div class="ornament" style="margin-top: 20px;">✦</div>
        </div>
      </body>
      </html>
    `;
  }
}

// ====================================================================
// NEWSLETTER RENDERER
// ====================================================================

export class NewsletterRenderer extends BaseRenderer {
  render(data: NewsletterData, options: TemplateOptions): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${this.escapeHtml(data.title)}</title>
        ${this.getEnhancedStyles(options)}
        <style>
          .newsletter-header { background: var(--primary); color: white; padding: 30px; text-align: center; }
          .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .announcement { background: #e3f2fd; padding: 16px; margin: 16px 0; border-left: 4px solid var(--primary); }
          .highlight { background: #f1f8e9; padding: 16px; margin: 16px 0; border-radius: 8px; }
          .event-item { display: flex; margin: 12px 0; }
          .event-date { background: var(--accent); color: white; padding: 10px; text-align: center; min-width: 60px; margin-right: 16px; }
        </style>
      </head>
      <body>
        <div class="newsletter-header">
          <h1>📰 ${this.escapeHtml(data.title)}</h1>
          ${data.issueNumber ? `<p>Issue ${data.issueNumber}</p>` : ''}
          <p>${this.escapeHtml(data.date)}</p>
        </div>

        ${this.renderAnnouncements(data)}
        ${this.renderHighlights(data)}
        ${this.renderEvents(data)}
        ${this.renderImportantDates(data)}
        ${data.contactInfo ? this.renderContact(data.contactInfo) : ''}

        <div class="footer">
          <p>${options.branding?.footerText || 'Generated by Dash AI • EduDash Pro'}</p>
        </div>
      </body>
      </html>
    `;
  }

  private renderAnnouncements(data: NewsletterData): string {
    if (data.announcements.length === 0) return '';
    return `
      <h2 style="margin: 30px 0 20px;">📢 Announcements</h2>
      <div class="columns">
        ${data.announcements.map(ann => `
          <div class="announcement">
            <h3>${ann.icon || '📌'} ${this.escapeHtml(ann.title)}</h3>
            <p>${this.escapeHtml(ann.content)}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderHighlights(data: NewsletterData): string {
    if (data.highlights.length === 0) return '';
    return `
      <h2 style="margin: 30px 0 20px;">⭐ Highlights</h2>
      ${data.highlights.map(h => `
        <div class="highlight">
          <h3>${this.escapeHtml(h.title)}</h3>
          <p>${this.escapeHtml(h.description)}</p>
        </div>
      `).join('')}
    `;
  }

  private renderEvents(data: NewsletterData): string {
    if (data.upcomingEvents.length === 0) return '';
    return `
      <div class="page-break"></div>
      <h2 style="margin: 30px 0 20px;">📅 Upcoming Events</h2>
      ${data.upcomingEvents.map(event => `
        <div class="event-item">
          <div class="event-date">
            <strong style="display: block; font-size: 20px;">${event.date.split('-')[2] || event.date}</strong>
            <span style="font-size: 12px;">${event.date.split('-')[1] || 'Month'}</span>
          </div>
          <div>
            <h4 style="margin: 0;">${this.escapeHtml(event.title)}</h4>
            <p style="margin: 4px 0;">${this.escapeHtml(event.description)}</p>
          </div>
        </div>
      `).join('')}
    `;
  }

  private renderImportantDates(data: NewsletterData): string {
    if (data.importantDates.length === 0) return '';
    return `
      <div class="section">
        <h2>📆 Important Dates</h2>
        ${EducationalPDFService.createTableHTML({
          headers: ['Date', 'Event'],
          rows: data.importantDates.map(d => [d.date, d.event]),
        }, { compact: true })}
      </div>
    `;
  }

  private renderContact(contact: { name: string; email: string; phone: string }): string {
    return `
      <div class="section" style="background: #e8f5e9;">
        <h3>📞 Contact Information</h3>
        <p><strong>${this.escapeHtml(contact.name)}</strong></p>
        <p>📧 ${this.escapeHtml(contact.email)}</p>
        <p>☎️ ${this.escapeHtml(contact.phone)}</p>
      </div>
    `;
  }
}

// ====================================================================
// ENHANCED WORKSHEET RENDERER
// ====================================================================

export class EnhancedWorksheetRenderer extends BaseRenderer {
  render(data: EnhancedWorksheetData, options: TemplateOptions): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${this.escapeHtml(data.title)}</title>
        ${this.getEnhancedStyles(options)}
      </head>
      <body>
        <div class="header">
          <h1>📝 ${this.escapeHtml(data.title)}</h1>
          <p style="font-size: 18px;">Grade ${data.gradeLevel} | ${this.escapeHtml(data.subject)}</p>
        </div>

        <div style="display: flex; justify-content: space-between; margin: 20px 0;">
          <p><strong>Name:</strong> _______________________</p>
          <p><strong>Date:</strong> _______________________</p>
        </div>

        ${this.renderObjectives(data)}
        ${this.renderInstructions(data)}
        ${this.renderActivities(data)}
        ${data.vocabulary ? this.renderVocabulary(data.vocabulary) : ''}
        ${data.bonusChallenge ? this.renderBonus(data.bonusChallenge) : ''}
        ${data.parentNotes ? this.renderParentNotes(data.parentNotes) : ''}

        <div class="footer">
          <p>${options.branding?.footerText || 'Generated by Dash AI • EduDash Pro'}</p>
        </div>
      </body>
      </html>
    `;
  }

  private renderObjectives(data: EnhancedWorksheetData): string {
    return `
      <div class="callout">
        <h3>🎯 Learning Objectives</h3>
        <ul>
          ${data.objectives.map(obj => `<li>${this.escapeHtml(obj)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  private renderInstructions(data: EnhancedWorksheetData): string {
    return `
      <div class="section">
        <h3>📋 Instructions</h3>
        <p>${this.escapeHtml(data.instructions)}</p>
      </div>
    `;
  }

  private renderActivities(data: EnhancedWorksheetData): string {
    return data.activities.map((activity, i) => `
      <div class="page-break"></div>
      <div class="section no-break">
        <h2>Activity ${i + 1}: ${this.escapeHtml(activity.title)}</h2>
        <p><em>Type: ${activity.type}</em></p>
        ${activity.materials ? `
          <p><strong>Materials:</strong> ${activity.materials.map(m => this.escapeHtml(m)).join(', ')}</p>
        ` : ''}
        <p>${this.escapeHtml(activity.content)}</p>
        <div style="border: 2px dashed #ddd; min-height: 200px; margin: 20px 0; padding: 20px; border-radius: 8px;">
          <em style="color: #999;">Work area</em>
        </div>
      </div>
    `).join('');
  }

  private renderVocabulary(vocabulary: Array<{ term: string; definition: string }>): string {
    return `
      <div class="page-break"></div>
      <h2>📖 Vocabulary</h2>
      ${vocabulary.map(v => `
        <div class="vocab-box">
          <h4 style="margin: 0 0 8px 0; color: #1565c0;">${this.escapeHtml(v.term)}</h4>
          <p style="margin: 0;">${this.escapeHtml(v.definition)}</p>
        </div>
      `).join('')}
    `;
  }

  private renderBonus(challenge: string): string {
    return `
      <div style="background: #fff3e0; padding: 20px; margin: 20px 0; border: 2px solid #ff9800; border-radius: 8px;">
        <h3 style="color: #e65100;">⭐ Bonus Challenge</h3>
        <p>${this.escapeHtml(challenge)}</p>
        <div style="border: 1px dashed #ff9800; min-height: 100px; margin-top: 16px; padding: 10px;">
          <em style="color: #999;">Show your work here...</em>
        </div>
      </div>
    `;
  }

  private renderParentNotes(notes: string): string {
    return `
      <div style="background: #e8f5e9; padding: 16px; margin: 20px 0; border-left: 4px solid #388e3c;">
        <h4 style="color: #1b5e20; margin: 0 0 8px 0;">📝 Notes for Parents</h4>
        <p style="margin: 0;">${this.escapeHtml(notes)}</p>
      </div>
    `;
  }
}

// Export all renderers
export const Renderers = {
  StudyGuideRenderer: new StudyGuideRenderer(),
  LessonPlanRenderer: new LessonPlanRenderer(),
  ProgressReportRenderer: new ProgressReportRenderer(),
  AssessmentRenderer: new AssessmentRenderer(),
  CertificateRenderer: new CertificateRenderer(),
  NewsletterRenderer: new NewsletterRenderer(),
  EnhancedWorksheetRenderer: new EnhancedWorksheetRenderer(),
};
