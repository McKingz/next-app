/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Educational PDF Generation Service
 * 
 * Generates printable worksheets, activities, and educational resources
 * for children and teachers using the existing expo-print infrastructure.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import type { Assignment } from '@/lib/models/Assignment';
import type { Submission } from '@/lib/models/Submission';
import { getPDFConfig, PDFDocumentType, PDFTheme, type PDFBranding, DEFAULT_BRANDING } from '@/lib/config/pdfConfig';

export type TextPDFPaperSize = 'A4' | 'Letter';
export type TextPDFOrientation = 'portrait' | 'landscape';
export interface TextPDFOptions {
  paperSize?: TextPDFPaperSize;
  orientation?: TextPDFOrientation;
}

// ====================================================================
// TYPES AND INTERFACES
// ====================================================================

export interface WorksheetOptions {
  title?: string;
  studentName?: string;
  dateCreated?: string;
  includeAnswerKey?: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  ageGroup: '3-4' | '4-5' | '5-6' | '6-7' | '7-8';
  colorMode: 'color' | 'blackwhite';
  paperSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
}

export interface MathWorksheetData {
  type: 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed';
  problemCount: number;
  numberRange: { min: number; max: number };
  showHints?: boolean;
  includeImages?: boolean;
}

export interface ReadingWorksheetData {
  type: 'comprehension' | 'vocabulary' | 'phonics' | 'sight-words';
  content: string;
  questions: Array<{
    question: string;
    type: 'multiple-choice' | 'short-answer' | 'true-false';
    options?: string[];
    correctAnswer?: string;
  }>;
}

export interface ActivitySheetData {
  type: 'coloring' | 'tracing' | 'matching' | 'puzzle' | 'creative';
  theme: string;
  instructions: string;
  materials?: string[];
}

export type WorksheetType = 'math' | 'reading' | 'activity' | 'assignment' | 'practice';

export interface GeneratePDFOptions {
  worksheetType: WorksheetType;
  data: MathWorksheetData | ReadingWorksheetData | ActivitySheetData | Assignment;
  options: WorksheetOptions;
}

// ====================================================================
// ENHANCED PDF TYPES
// ====================================================================

export interface EnhancedPDFOptions {
  theme?: 'professional' | 'colorful' | 'minimalist';
  branding?: PDFBranding;
  paperSize?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  enablePageNumbers?: boolean;
  enableWatermark?: boolean;
  enableTableOfContents?: boolean;
}

export interface PDFComponent {
  type: string;
  data: any;
  options?: any;
}

export interface ChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface CalloutOptions {
  kind: 'info' | 'tip' | 'warning' | 'objective';
  title?: string;
  content: string;
  icon?: string;
}

export interface TimelineStep {
  title: string;
  description: string;
  duration?: string;
}

export interface RubricCriterion {
  name: string;
  levels: { label: string; description: string; points: number }[];
}

// ====================================================================
// EDUCATIONAL PDF SERVICE
// ====================================================================

class EducationalPDFServiceImpl {
  generateLessonPDF(lessonConfig: { subject: any; grade: any; duration: any; objectives: any; activities: any; resources: any; assessments: any; differentiation: any; extensions: any; }) {
    throw new Error('Method not implemented.');
  }

  /**
   * Generate Lesson Plan PDF (wrapper for screens)
   */
  public async generateLessonPlanPDF(args: {
    title: string;
    subject: string;
    grade: string;
    duration: string;
    objectives: string[];
    activities: Array<{ name: string; duration: string; description: string; materials: string[] }>;
    resources: string[];
    assessments: string[];
    differentiation: string;
    extensions: string[];
  }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.title}</title>
      <style>body{font-family:Arial,sans-serif;padding:16px;color:#333} h1{color:#1565c0} h2{color:#1565c0} ul{margin-left:18px}</style>
      </head><body>
      <h1>${args.title}</h1>
      <p><strong>Subject:</strong> ${args.subject} • <strong>Grade:</strong> ${args.grade} • <strong>Duration:</strong> ${args.duration}</p>
      <h2>Objectives</h2><ul>${args.objectives.map(o => `<li>${o}</li>`).join('')}</ul>
      <h2>Activities</h2>${args.activities.map(a => `<div><strong>${a.name}</strong> (${a.duration})<br/>${a.description}${a.materials?.length ? `<br/><em>Materials:</em> ${a.materials.join(', ')}` : ''}</div>`).join('<hr/>')}
      <h2>Resources</h2><ul>${args.resources.map(r => `<li>${r}</li>`).join('')}</ul>
      <h2>Assessments</h2><ul>${args.assessments.map(a => `<li>${a}</li>`).join('')}</ul>
      <h2>Differentiation</h2><p>${args.differentiation}</p>
      ${args.extensions?.length ? `<h2>Extensions</h2><ul>${args.extensions.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
      </body></html>`;
      const uri = await this.createPDFFile(html, `${args.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.pdf`);
      return { success: true, filePath: uri };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to generate lesson PDF' };
    }
  }

  /**
   * Generate Math Worksheet PDF (wrapper)
   */
  public async generateMathWorksheetPDF(args: {
    title: string;
    ageGroup: string;
    difficulty: string;
    problems: Array<{ question: string; answer: number; operation?: string }>;
    includeAnswerKey?: boolean;
  }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const problemsHtml = args.problems.map((p, i) => `<div style="padding:8px 0;border-bottom:1px solid #eee;">${i+1}. ${p.question} = _______</div>`).join('');
      const answersHtml = args.includeAnswerKey ? `<h3>Answer Key</h3>${args.problems.map((p,i)=> `<div>${i+1}. ${p.answer}</div>`).join('')}` : '';
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.title}</title>
      <style>body{font-family:Arial,sans-serif;padding:16px;color:#333} h1{color:#1565c0}</style></head><body>
      <h1>${args.title}</h1>
      <p><strong>Age Group:</strong> ${args.ageGroup} • <strong>Difficulty:</strong> ${args.difficulty}</p>
      ${problemsHtml}
      ${answersHtml}
      </body></html>`;
      const uri = await this.createPDFFile(html, `${args.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.pdf`);
      return { success: true, filePath: uri };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to generate worksheet PDF' };
    }
  }

  /**
   * Generate Generic Worksheet PDF (wrapper)
   */
  public async generateWorksheetPDF(args: {
    title: string;
    type: string;
    ageGroup: string;
    contentSections?: Array<{ title: string; content: string }>;
  }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const sections = (args.contentSections || []).map(s => `<h3>${s.title}</h3><p>${s.content}</p>`).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.title}</title>
      <style>body{font-family:Arial,sans-serif;padding:16px;color:#333} h1{color:#1565c0}</style></head><body>
      <h1>${args.title}</h1>
      <p><strong>Type:</strong> ${args.type} • <strong>Age Group:</strong> ${args.ageGroup}</p>
      ${sections}
      </body></html>`;
      const uri = await this.createPDFFile(html, `${args.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.pdf`);
      return { success: true, filePath: uri };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to generate worksheet PDF' };
    }
  }
  
  /**
   * Generate a worksheet PDF from assignment data
   */
  async generateWorksheetFromAssignment(
    assignment: Assignment, 
    options: WorksheetOptions
  ): Promise<void> {
    try {
      const htmlContent = this.createAssignmentWorksheetHTML(assignment, options);
      await this.generateAndSharePDF(
        htmlContent, 
        `worksheet-${assignment.title.toLowerCase().replace(/\s+/g, '-')}`
      );
    } catch (error) {
      console.error('Assignment worksheet generation failed:', error);
      Alert.alert('Error', 'Failed to generate worksheet PDF');
    }
  }

  /**
   * Generate math practice worksheet
   */
  async generateMathWorksheet(
    data: MathWorksheetData, 
    options: WorksheetOptions
  ): Promise<void> {
    try {
      const htmlContent = this.createMathWorksheetHTML(data, options);
      await this.generateAndSharePDF(
        htmlContent, 
        `math-worksheet-${data.type}-${Date.now()}`
      );
    } catch (error) {
      console.error('Math worksheet generation failed:', error);
      Alert.alert('Error', 'Failed to generate math worksheet PDF');
    }
  }

  /**
   * Generate reading comprehension worksheet
   */
  async generateReadingWorksheet(
    data: ReadingWorksheetData, 
    options: WorksheetOptions
  ): Promise<void> {
    try {
      const htmlContent = this.createReadingWorksheetHTML(data, options);
      await this.generateAndSharePDF(
        htmlContent, 
        `reading-worksheet-${data.type}-${Date.now()}`
      );
    } catch (error) {
      console.error('Reading worksheet generation failed:', error);
      Alert.alert('Error', 'Failed to generate reading worksheet PDF');
    }
  }

  /**
   * Generate activity sheet for children
   */
  async generateActivitySheet(
    data: ActivitySheetData, 
    options: WorksheetOptions
  ): Promise<void> {
    try {
      const htmlContent = this.createActivitySheetHTML(data, options);
      await this.generateAndSharePDF(
        htmlContent, 
        `activity-sheet-${data.type}-${Date.now()}`
      );
    } catch (error) {
      console.error('Activity sheet generation failed:', error);
      Alert.alert('Error', 'Failed to generate activity sheet PDF');
    }
  }

  /**
   * Generate answer key for any worksheet
   */
  async generateAnswerKey(
    worksheetData: MathWorksheetData | ReadingWorksheetData,
    options: WorksheetOptions
  ): Promise<void> {
    try {
      const htmlContent = this.createAnswerKeyHTML(worksheetData, options);
      await this.generateAndSharePDF(
        htmlContent, 
        `answer-key-${Date.now()}`
      );
    } catch (error) {
      console.error('Answer key generation failed:', error);
      Alert.alert('Error', 'Failed to generate answer key PDF');
    }
  }

  // ====================================================================
  // HTML TEMPLATE GENERATORS
  // ====================================================================

  /**
   * Create HTML for assignment-based worksheet
   */
  private createAssignmentWorksheetHTML(
    assignment: Assignment, 
    options: WorksheetOptions
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${assignment.title} - Worksheet</title>
        <style>${this.getBaseStyles(options)}</style>
      </head>
      <body>
        ${this.getWorksheetHeader(assignment.title, options)}
        
        <div class="content-section">
          <div class="instructions">
            <h3>📋 Instructions</h3>
            <p>${assignment.instructions || assignment.description || 'Complete the following tasks.'}</p>
          </div>

          <div class="assignment-content">
            <h3>📝 ${assignment.assignment_type.toUpperCase()}</h3>
            ${this.generateAssignmentQuestions(assignment, options)}
          </div>

          ${options.includeAnswerKey ? this.generateAnswerSection() : ''}
        </div>

        ${this.getWorksheetFooter(options)}
      </body>
      </html>
    `;
  }

  /**
   * Create HTML for math worksheet
   */
  private createMathWorksheetHTML(
    data: MathWorksheetData, 
    options: WorksheetOptions
  ): string {
    const problems = this.generateMathProblems(data);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Math Worksheet - ${data.type}</title>
        <style>${this.getBaseStyles(options)}${this.getMathStyles()}</style>
      </head>
      <body>
        ${this.getWorksheetHeader(`Math Practice: ${data.type.charAt(0).toUpperCase() + data.type.slice(1)}`, options)}
        
        <div class="content-section">
          <div class="instructions">
            <h3>🔢 Instructions</h3>
            <p>Solve each problem. Show your work in the space provided.</p>
            ${data.showHints ? '<p><em>💡 Hint: Take your time and check your answers!</em></p>' : ''}
          </div>

          <div class="math-problems">
            ${problems.map((problem, index) => `
              <div class="problem-item">
                <span class="problem-number">${index + 1}.</span>
                <span class="problem-text">${problem.question}</span>
                <span class="answer-space">= _______</span>
                ${data.showHints && problem.hint ? `<div class="hint">💡 ${problem.hint}</div>` : ''}
              </div>
            `).join('')}
          </div>

          ${options.includeAnswerKey ? this.generateMathAnswerKey(problems) : ''}
        </div>

        ${this.getWorksheetFooter(options)}
      </body>
      </html>
    `;
  }

  /**
   * Create HTML for reading worksheet
   */
  private createReadingWorksheetHTML(
    data: ReadingWorksheetData, 
    options: WorksheetOptions
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reading Worksheet - ${data.type}</title>
        <style>${this.getBaseStyles(options)}${this.getReadingStyles()}</style>
      </head>
      <body>
        ${this.getWorksheetHeader(`Reading Practice: ${data.type.charAt(0).toUpperCase() + data.type.slice(1)}`, options)}
        
        <div class="content-section">
          ${data.type === 'comprehension' ? `
            <div class="reading-passage">
              <h3>📖 Reading Passage</h3>
              <div class="passage-text">${data.content}</div>
            </div>
          ` : ''}

          <div class="questions-section">
            <h3>❓ Questions</h3>
            ${data.questions.map((question, index) => `
              <div class="question-item">
                <p><strong>${index + 1}. ${question.question}</strong></p>
                ${this.generateQuestionAnswerSpace(question)}
              </div>
            `).join('')}
          </div>

          ${options.includeAnswerKey ? this.generateReadingAnswerKey(data.questions) : ''}
        </div>

        ${this.getWorksheetFooter(options)}
      </body>
      </html>
    `;
  }

  /**
   * Create HTML for activity sheet
   */
  private createActivitySheetHTML(
    data: ActivitySheetData, 
    options: WorksheetOptions
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Activity Sheet - ${data.type}</title>
        <style>${this.getBaseStyles(options)}${this.getActivityStyles()}</style>
      </head>
      <body>
        ${this.getWorksheetHeader(`Fun Activity: ${data.theme}`, options)}
        
        <div class="content-section">
          <div class="activity-intro">
            <h3>🎨 Let's Have Fun!</h3>
            <p>${data.instructions}</p>
            ${data.materials ? `
              <div class="materials-list">
                <h4>📦 You'll Need:</h4>
                <ul>
                  ${data.materials.map(item => `<li>${item}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>

          <div class="activity-space">
            ${this.generateActivityContent(data)}
          </div>
        </div>

        ${this.getWorksheetFooter(options)}
      </body>
      </html>
    `;
  }

  // ====================================================================
  // CONTENT GENERATORS
  // ====================================================================

  /**
   * Generate math problems based on type and difficulty
   */
  private generateMathProblems(data: MathWorksheetData): Array<{question: string, answer: number, hint?: string}> {
    const problems: Array<{question: string, answer: number, hint?: string}> = [];
    
    for (let i = 0; i < data.problemCount; i++) {
      const num1 = Math.floor(Math.random() * (data.numberRange.max - data.numberRange.min + 1)) + data.numberRange.min;
      const num2 = Math.floor(Math.random() * (data.numberRange.max - data.numberRange.min + 1)) + data.numberRange.min;
      
      let question: string;
      let answer: number;
      let hint: string | undefined;

      switch (data.type) {
        case 'addition':
          question = `${num1} + ${num2}`;
          answer = num1 + num2;
          hint = data.showHints ? `Try counting up from ${num1}` : undefined;
          break;
        case 'subtraction': {
          const larger = Math.max(num1, num2);
          const smaller = Math.min(num1, num2);
          question = `${larger} - ${smaller}`;
          answer = larger - smaller;
          hint = data.showHints ? `Count backwards from ${larger}` : undefined;
          break;
        }
        case 'multiplication':
          question = `${num1} × ${num2}`;
          answer = num1 * num2;
          hint = data.showHints ? `Think of ${num1} groups of ${num2}` : undefined;
          break;
        case 'division': {
          const dividend = num1 * num2;
          question = `${dividend} ÷ ${num1}`;
          answer = num2;
          hint = data.showHints ? `How many ${num1}s make ${dividend}?` : undefined;
          break;
        }
        default: { // mixed
          const operations = ['+', '-', '×'];
          const op = operations[Math.floor(Math.random() * operations.length)];
          if (op === '+') {
            question = `${num1} + ${num2}`;
            answer = num1 + num2;
          } else if (op === '-') {
            const larger = Math.max(num1, num2);
            const smaller = Math.min(num1, num2);
            question = `${larger} - ${smaller}`;
            answer = larger - smaller;
          } else {
            question = `${num1} × ${num2}`;
            answer = num1 * num2;
          }
          break;
        }
      }

      problems.push({ question, answer, hint });
    }

    return problems;
  }

  /**
   * Generate assignment-specific questions
   */
  private generateAssignmentQuestions(assignment: Assignment, options: WorksheetOptions): string {
    // This would be expanded based on assignment type and content
    const questionCount = Math.min(10, Math.max(5, Math.floor(assignment.max_points / 2)));
    
    let questionsHTML = '';
    for (let i = 1; i <= questionCount; i++) {
      questionsHTML += `
        <div class="question-space">
          <p><strong>Question ${i}:</strong></p>
          <div class="answer-lines">
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
          </div>
        </div>
      `;
    }
    
    return questionsHTML;
  }

  /**
   * Generate question answer space based on type
   */
  private generateQuestionAnswerSpace(question: any): string {
    switch (question.type) {
      case 'multiple-choice':
        return `
          <div class="multiple-choice">
            ${question.options?.map((option: string, index: number) => `
              <div class="choice-item">
                <input type="checkbox" disabled> ${String.fromCharCode(65 + index)}. ${option}
              </div>
            `).join('') || ''}
          </div>
        `;
      case 'true-false':
        return `
          <div class="true-false">
            <input type="checkbox" disabled> True &nbsp;&nbsp;&nbsp;
            <input type="checkbox" disabled> False
          </div>
        `;
      default: // short-answer
        return `
          <div class="answer-lines">
            <div class="line"></div>
            <div class="line"></div>
          </div>
        `;
    }
  }

  /**
   * Generate activity content based on type
   */
  private generateActivityContent(data: ActivitySheetData): string {
    switch (data.type) {
      case 'coloring':
        return `
          <div class="coloring-area">
            <div class="coloring-frame">
              <p style="text-align: center; font-size: 48px; margin: 100px 0;">
                🎨 Coloring Space 🖍️
              </p>
              <p style="text-align: center; color: #666;">
                Draw and color your ${data.theme} here!
              </p>
            </div>
          </div>
        `;
      case 'tracing':
        return `
          <div class="tracing-area">
            ${Array.from({length: 8}, (_, i) => `
              <div class="trace-line">
                <span class="trace-guide">${data.theme.charAt(0).toUpperCase()}</span>
                <span class="trace-dots">• • • • • • • • • •</span>
              </div>
            `).join('')}
          </div>
        `;
      case 'matching':
        return `
          <div class="matching-area">
            <div class="match-column">
              <h4>Column A</h4>
              <div class="match-item">🐱 Cat</div>
              <div class="match-item">🐶 Dog</div>
              <div class="match-item">🐦 Bird</div>
              <div class="match-item">🐠 Fish</div>
            </div>
            <div class="match-column">
              <h4>Column B</h4>
              <div class="match-item">Meow</div>
              <div class="match-item">Woof</div>
              <div class="match-item">Tweet</div>
              <div class="match-item">Splash</div>
            </div>
          </div>
        `;
      default:
        return `
          <div class="creative-space">
            <div class="creative-frame">
              <p style="text-align: center; margin: 150px 0;">
                ✨ Creative Space ✨<br>
                <small>Use this space for your ${data.theme} activity!</small>
              </p>
            </div>
          </div>
        `;
    }
  }

  // ====================================================================
  // ANSWER KEY GENERATORS
  // ====================================================================

  private generateAnswerSection(): string {
    return `
      <div class="answer-key-section">
        <h3>📝 For Teachers/Parents - Answer Space</h3>
        <div class="answer-notes">
          <div class="line"></div>
          <div class="line"></div>
          <div class="line"></div>
          <div class="line"></div>
          <div class="line"></div>
        </div>
      </div>
    `;
  }

  private generateMathAnswerKey(problems: Array<{question: string, answer: number}>): string {
    return `
      <div class="answer-key">
        <h3>🔑 Answer Key (For Teachers/Parents)</h3>
        <div class="answers-grid">
          ${problems.map((problem, index) => `
            <div class="answer-item">
              ${index + 1}. ${problem.question} = <strong>${problem.answer}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private generateReadingAnswerKey(questions: any[]): string {
    return `
      <div class="answer-key">
        <h3>🔑 Answer Key (For Teachers/Parents)</h3>
        ${questions.map((question, index) => `
          <div class="answer-item">
            <strong>${index + 1}.</strong> ${question.correctAnswer || 'Sample answer provided by teacher'}
          </div>
        `).join('')}
      </div>
    `;
  }

  private createAnswerKeyHTML(worksheetData: any, options: WorksheetOptions): string {
    // Implementation for standalone answer key
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Answer Key</title>
        <style>${this.getBaseStyles(options)}</style>
      </head>
      <body>
        ${this.getWorksheetHeader('Answer Key', options)}
        <div class="content-section">
          <h3>🔑 Complete Answer Key</h3>
          <p>Detailed answers and explanations for teachers and parents.</p>
        </div>
      </body>
      </html>
    `;
  }

  // ====================================================================
  // PDF GENERATION AND SHARING
  // ====================================================================

  /**
   * Generate an ad-hoc text-based PDF (simple export)
   */
  public async generateTextPDF(title: string, body: string, opts?: TextPDFOptions): Promise<void> {
    const safeBody = (body || '')
      .split('\n')
      .map(p => `<p>${p
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</p>`)
      .join('\n');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page { size: ${(opts?.paperSize || 'A4')} ${(opts?.orientation || 'portrait')}; margin: 20mm; }
        body { font-family: Arial, sans-serif; color: #333; }
        .title { font-size: 24px; font-weight: bold; color: #007AFF; margin-bottom: 10px; }
        .meta { color: #777; font-size: 12px; margin-bottom: 20px; }
        .content p { margin: 8px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
      </style></head><body>
      <div class="title">${title}</div>
      <div class="meta">Generated by EduDash Pro • ${new Date().toLocaleString()}</div>
      <div class="content">${safeBody}</div>
      <div class="footer">Exported by Dash • EduDash Pro</div>
    </body></html>`;
    await this.generateAndSharePDF(html, (title || 'dash-export').toLowerCase().replace(/\s+/g, '-'));
  }
  
  /**
   * Generate PDF from complete HTML (for educational guides, etc.)
   * Use this when you have fully formatted HTML content
   */
  public async generateHTMLPDF(title: string, htmlContent: string, opts?: TextPDFOptions): Promise<void> {
    // If the content is already a complete HTML document, use it as-is
    let html = htmlContent;
    
    // If it's not a complete document, wrap it
    if (!htmlContent.includes('<!DOCTYPE html>') && !htmlContent.includes('<html')) {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${htmlContent}</body></html>`;
    }
    
    const filename = (title || 'educational-guide').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await this.generateAndSharePDF(html, filename);
  }

  /**
   * Generate a text PDF and return a downloadable URI (web: data URI; native: file URI)
   * NOTE: This method does NOT open a share sheet; it only returns the URI
   */
  public async generateTextPDFUri(title: string, body: string, opts?: TextPDFOptions): Promise<{ uri: string; filename: string }> {
    const safeBody = (body || '')
      .split('\n')
      .map(p => `<p>${p
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</p>`)
      .join('\n');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page { size: ${(opts?.paperSize || 'A4')} ${(opts?.orientation || 'portrait')}; margin: 20mm; }
        body { font-family: Arial, sans-serif; color: #333; }
        .title { font-size: 24px; font-weight: bold; color: #007AFF; margin-bottom: 10px; }
        .meta { color: #777; font-size: 12px; margin-bottom: 20px; }
        .content p { margin: 8px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
      </style></head><body>
      <div class="title">${title}</div>
      <div class="meta">Generated by EduDash Pro • ${new Date().toLocaleString()}</div>
      <div class="content">${safeBody}</div>
      <div class="footer">Exported by Dash • EduDash Pro</div>
    </body></html>`;
    const filename = (title || 'dash-export').toLowerCase().replace(/\s+/g, '-');
    const fullFilename = `${filename}.pdf`;
    const uri = await this.createPDFFile(html, fullFilename);
    return { uri, filename: fullFilename };
  }

  /**
   * Generate an HTML PDF and return a downloadable URI (web: data URI; native: file URI)
   * NOTE: This method does NOT open a share sheet; it only returns the URI
   */
  public async generateHTMLPDFUri(title: string, htmlContent: string): Promise<{ uri: string; filename: string }> {
    let html = htmlContent;
    if (!htmlContent.includes('<!DOCTYPE html>') && !htmlContent.includes('<html')) {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${htmlContent}</body></html>`;
    }
    const filename = (title || 'educational-guide').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const fullFilename = `${filename}.pdf`;
    const uri = await this.createPDFFile(html, fullFilename);
    return { uri, filename: fullFilename };
  }

  /**
   * Create a PDF file from HTML and return its URI without sharing (web: data URI; native: file URI)
   * For mobile, this now saves to a more accessible location
   */
  private async createPDFFile(html: string, filename?: string): Promise<string> {
    // Web: return base64 data URI to enable direct downloads or upload
    if (Platform.OS === 'web') {
      const result: any = await Print.printToFileAsync({ html, base64: true });
      return `data:application/pdf;base64,${result.base64}`;
    }
    
    // Native: Generate PDF and copy to accessible location
    const { uri: tempUri } = await Print.printToFileAsync({ html, base64: false });
    
    // For mobile, move the file to document directory where it's more accessible
    if (filename) {
      try {
        const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        const documentDirectory = FileSystem.documentDirectory;
        const finalUri = `${documentDirectory}${finalFilename}`;
        
        // Copy the temporary file to document directory
        await FileSystem.copyAsync({
          from: tempUri,
          to: finalUri
        });
        
        console.log('[EducationalPDFService] PDF saved to:', finalUri);
        return finalUri;
      } catch (error) {
        console.error('[EducationalPDFService] Failed to move PDF to document directory:', error);
        return tempUri; // Fallback to temp URI
      }
    }
    
    return tempUri;
  }

  /**
   * Generate PDF from HTML and share it
   */
  private async generateAndSharePDF(html: string, filename: string): Promise<string> {
    try {
      // Web: produce base64 and trigger a browser download; return data URI
      if (Platform.OS === 'web') {
        const result: any = await Print.printToFileAsync({
          html,
          base64: true,
        });
        const dataUri = `data:application/pdf;base64,${result.base64}`;
        try {
          const link = document.createElement('a');
          link.href = dataUri;
          link.download = `${filename}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (e) {
          console.warn('Web download trigger failed; returning data URI only.', e);
        }
        return dataUri;
      }

      // Native: create file and open share sheet
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${filename}.pdf`,
        });
      } else {
        Alert.alert('Success', `Worksheet saved as ${filename}.pdf`);
      }
      return uri;
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw error;
    }
  }

  // ====================================================================
  // STYLING AND LAYOUT
  // ====================================================================

  /**
   * Base CSS styles for all worksheets
   */
  private getBaseStyles(options: WorksheetOptions): string {
    const colorScheme = options.colorMode === 'color' ? 'color' : 'black-and-white';
    
    return `
      @page {
        size: ${options.paperSize} ${options.orientation};
        margin: 20mm;
      }
      
      body {
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        color: ${colorScheme === 'color' ? '#333' : '#000'};
        margin: 0;
        padding: 0;
      }
      
      .worksheet-header {
        text-align: center;
        border-bottom: 3px solid ${colorScheme === 'color' ? '#007AFF' : '#000'};
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      
      .worksheet-title {
        font-size: 28px;
        font-weight: bold;
        color: ${colorScheme === 'color' ? '#007AFF' : '#000'};
        margin: 0 0 10px 0;
      }
      
      .worksheet-info {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        color: #666;
      }
      
      .content-section {
        margin: 20px 0;
      }
      
      .instructions {
        background: ${colorScheme === 'color' ? '#f0f8ff' : '#f5f5f5'};
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 30px;
        border-left: 4px solid ${colorScheme === 'color' ? '#007AFF' : '#000'};
      }
      
      .line {
        border-bottom: 1px solid #ccc;
        height: 30px;
        margin: 10px 0;
      }
      
      .answer-lines .line {
        margin: 5px 0;
        height: 25px;
      }
      
      .worksheet-footer {
        margin-top: 50px;
        text-align: center;
        font-size: 12px;
        color: #999;
        border-top: 1px solid #ddd;
        padding-top: 15px;
      }
      
      .answer-key {
        background: #fff5f5;
        padding: 20px;
        border-radius: 8px;
        margin-top: 30px;
        border: 2px dashed #ff6b6b;
      }
      
      .answer-key h3 {
        color: #ff6b6b;
        margin-top: 0;
      }
      
      h3 {
        color: ${colorScheme === 'color' ? '#007AFF' : '#000'};
        margin: 20px 0 10px 0;
      }
    `;
  }

  /**
   * Math-specific styles
   */
  private getMathStyles(): string {
    return `
      .math-problems {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin: 30px 0;
      }
      
      .problem-item {
        border: 1px solid #ddd;
        padding: 15px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .problem-number {
        font-weight: bold;
        color: #007AFF;
        min-width: 30px;
      }
      
      .problem-text {
        font-size: 18px;
        font-weight: bold;
        flex-grow: 1;
      }
      
      .answer-space {
        font-size: 16px;
        min-width: 100px;
        text-align: right;
      }
      
      .hint {
        grid-column: 1 / -1;
        font-style: italic;
        color: #666;
        font-size: 12px;
        margin-top: 5px;
      }
      
      .answers-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 10px;
      }
      
      .answer-item {
        padding: 5px;
        font-size: 14px;
      }
    `;
  }

  /**
   * Reading-specific styles
   */
  private getReadingStyles(): string {
    return `
      .reading-passage {
        background: #f9f9f9;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 30px;
        border-left: 4px solid #28a745;
      }
      
      .passage-text {
        font-size: 16px;
        line-height: 1.8;
        text-align: justify;
      }
      
      .questions-section {
        margin-top: 30px;
      }
      
      .question-item {
        margin: 20px 0;
        padding: 15px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
      }
      
      .multiple-choice {
        margin: 10px 0;
      }
      
      .choice-item {
        margin: 8px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .true-false {
        margin: 10px 0;
        font-size: 16px;
      }
    `;
  }

  /**
   * Activity-specific styles
   */
  private getActivityStyles(): string {
    return `
      .activity-intro {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 30px;
      }
      
      .materials-list {
        background: rgba(255,255,255,0.1);
        padding: 15px;
        border-radius: 8px;
        margin-top: 15px;
      }
      
      .materials-list ul {
        margin: 10px 0 0 20px;
      }
      
      .activity-space {
        min-height: 400px;
      }
      
      .coloring-frame, .creative-frame {
        border: 3px dashed #ff6b6b;
        border-radius: 12px;
        min-height: 300px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #fff9f9;
      }
      
      .tracing-area {
        margin: 30px 0;
      }
      
      .trace-line {
        display: flex;
        align-items: center;
        margin: 20px 0;
        font-size: 24px;
      }
      
      .trace-guide {
        width: 60px;
        text-align: center;
        font-weight: bold;
        color: #007AFF;
      }
      
      .trace-dots {
        flex-grow: 1;
        letter-spacing: 8px;
        color: #ccc;
        padding: 0 20px;
      }
      
      .matching-area {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        margin: 30px 0;
      }
      
      .match-column h4 {
        text-align: center;
        color: #007AFF;
        margin-bottom: 20px;
      }
      
      .match-item {
        padding: 10px;
        margin: 10px 0;
        border: 2px solid #ddd;
        border-radius: 8px;
        text-align: center;
        font-size: 18px;
      }
    `;
  }

  /**
   * Generate worksheet header
   */
  private getWorksheetHeader(title: string, options: WorksheetOptions): string {
    const currentDate = options.dateCreated || new Date().toLocaleDateString();
    
    return `
      <div class="worksheet-header">
        <h1 class="worksheet-title">${title}</h1>
        <div class="worksheet-info">
          <div>
            <strong>Name:</strong> ${options.studentName || '________________________'}
          </div>
          <div>
            <strong>Date:</strong> ${currentDate}
          </div>
          <div>
            <strong>Age:</strong> ${options.ageGroup} years
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate worksheet footer
   */
  private getWorksheetFooter(options: WorksheetOptions): string {
    return `
      <div class="worksheet-footer">
        <p>Generated by EduDash Pro • Educational Excellence for Every Child</p>
        <p>Remember: Learning is fun! 🌟 Keep practicing and you'll get better every day! 🚀</p>
      </div>
    `;
  }

  // ====================================================================
  // ENHANCED PDF GENERATION - THEME SYSTEM
  // ====================================================================

  /**
   * Get theme-specific CSS variables
   */
  private getThemeCSS(theme: 'professional' | 'colorful' | 'minimalist'): string {
    const themes = {
      professional: {
        primaryColor: '#1a237e',
        secondaryColor: '#3949ab',
        accentColor: '#5c6bc0',
        backgroundColor: '#ffffff',
        textColor: '#212121',
        borderColor: '#e0e0e0',
        headingFont: 'Georgia, serif',
        bodyFont: 'Arial, sans-serif',
        sectionBg: '#f5f5f5',
      },
      colorful: {
        primaryColor: '#1565c0',
        secondaryColor: '#42a5f5',
        accentColor: '#ff9800',
        backgroundColor: '#ffffff',
        textColor: '#333333',
        borderColor: '#90caf9',
        headingFont: 'Comic Sans MS, cursive',
        bodyFont: 'Arial, sans-serif',
        sectionBg: '#e3f2fd',
      },
      minimalist: {
        primaryColor: '#000000',
        secondaryColor: '#424242',
        accentColor: '#757575',
        backgroundColor: '#ffffff',
        textColor: '#212121',
        borderColor: '#bdbdbd',
        headingFont: 'Helvetica, Arial, sans-serif',
        bodyFont: 'Helvetica, Arial, sans-serif',
        sectionBg: '#fafafa',
      },
    };

    const t = themes[theme] || themes.professional;

    return `
      :root {
        --primary-color: ${t.primaryColor};
        --secondary-color: ${t.secondaryColor};
        --accent-color: ${t.accentColor};
        --bg-color: ${t.backgroundColor};
        --text-color: ${t.textColor};
        --border-color: ${t.borderColor};
        --heading-font: ${t.headingFont};
        --body-font: ${t.bodyFont};
        --section-bg: ${t.sectionBg};
      }
    `;
  }

  /**
   * Get enhanced base styles with theme support
   */
  private getEnhancedBaseStyles(options: EnhancedPDFOptions): string {
    const theme = options.theme || 'professional';
    const branding = options.branding || DEFAULT_BRANDING;

    return `
      ${this.getThemeCSS(theme)}
      
      @page {
        size: ${options.paperSize || 'A4'} ${options.orientation || 'portrait'};
        margin: 2cm;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: var(--body-font);
        color: var(--text-color);
        line-height: 1.6;
        background: var(--bg-color);
        counter-reset: page;
      }

      h1, h2, h3, h4, h5, h6 {
        font-family: var(--heading-font);
        color: var(--primary-color);
        page-break-after: avoid;
      }

      h1 { font-size: 32px; margin-bottom: 16px; }
      h2 { font-size: 26px; margin-top: 24px; margin-bottom: 12px; }
      h3 { font-size: 22px; margin-top: 20px; margin-bottom: 10px; }
      h4 { font-size: 18px; margin-top: 16px; margin-bottom: 8px; }

      p { margin-bottom: 12px; }
      
      ul, ol {
        margin: 12px 0 12px 24px;
      }

      li {
        margin-bottom: 6px;
      }

      /* Page break utilities */
      .page-break { page-break-after: always; }
      .page-break-before { page-break-before: always; }
      .no-break { page-break-inside: avoid; }

      /* Document header */
      .document-header {
        text-align: center;
        border-bottom: 3px solid var(--primary-color);
        padding-bottom: 20px;
        margin-bottom: 30px;
        page-break-after: avoid;
      }

      .document-header h1 {
        margin: 0;
        font-size: 36px;
      }

      .document-header .subtitle {
        font-size: 18px;
        color: var(--secondary-color);
        margin-top: 8px;
      }

      /* Document footer */
      .document-footer {
        text-align: center;
        border-top: 1px solid var(--border-color);
        padding-top: 16px;
        margin-top: 40px;
        font-size: 12px;
        color: #666;
      }

      ${options.enablePageNumbers ? `
      .document-footer::after {
        counter-increment: page;
        content: "Page " counter(page);
        display: block;
        margin-top: 8px;
      }
      ` : ''}

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
        white-space: nowrap;
        pointer-events: none;
      }
      ` : ''}

      /* Branding */
      .branding-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }

      .branding-logo {
        max-width: 120px;
        max-height: 60px;
      }

      .branding-name {
        font-size: 20px;
        font-weight: bold;
        color: var(--primary-color);
      }
    `;
  }

  // ====================================================================
  // ENHANCED PDF GENERATION - FORMATTING HELPERS
  // ====================================================================

  /**
   * Create an HTML/CSS chart (bar or line)
   */
  public createChartHTML(
    type: 'bar' | 'line',
    data: ChartData,
    options?: { title?: string; width?: number; height?: number }
  ): string {
    const width = options?.width || 600;
    const height = options?.height || 300;
    const maxValue = Math.max(...data.values);
    const colors = data.colors || ['#1565c0', '#42a5f5', '#90caf9', '#bbdefb'];

    if (type === 'bar') {
      return `
        <div class="chart-container no-break" style="margin: 20px 0;">
          ${options?.title ? `<h4 style="text-align: center; margin-bottom: 16px;">${options.title}</h4>` : ''}
          <div class="bar-chart" style="display: flex; align-items: flex-end; justify-content: space-around; height: ${height}px; border-bottom: 2px solid #333; padding: 10px;">
            ${data.labels.map((label, i) => {
              const barHeight = (data.values[i] / maxValue) * (height - 40);
              const color = colors[i % colors.length];
              return `
                <div class="bar-item" style="text-align: center; flex: 1; margin: 0 4px;">
                  <div style="background: ${color}; height: ${barHeight}px; border-radius: 4px 4px 0 0; margin-bottom: 4px;"></div>
                  <div style="font-size: 12px; font-weight: bold;">${data.values[i]}</div>
                  <div style="font-size: 11px; margin-top: 4px;">${label}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      // Line chart using SVG
      const points = data.values
        .map((val, i) => {
          const x = (i / (data.values.length - 1)) * (width - 40) + 20;
          const y = height - 40 - (val / maxValue) * (height - 60);
          return `${x},${y}`;
        })
        .join(' ');

      return `
        <div class="chart-container no-break" style="margin: 20px 0;">
          ${options?.title ? `<h4 style="text-align: center; margin-bottom: 16px;">${options.title}</h4>` : ''}
          <svg width="${width}" height="${height}" style="border: 1px solid #ddd; border-radius: 8px;">
            <polyline points="${points}" fill="none" stroke="#1565c0" stroke-width="2" />
            ${data.values.map((val, i) => {
              const x = (i / (data.values.length - 1)) * (width - 40) + 20;
              const y = height - 40 - (val / maxValue) * (height - 60);
              return `<circle cx="${x}" cy="${y}" r="4" fill="#1565c0" />`;
            }).join('')}
            ${data.labels.map((label, i) => {
              const x = (i / (data.values.length - 1)) * (width - 40) + 20;
              return `<text x="${x}" y="${height - 10}" text-anchor="middle" font-size="11">${label}</text>`;
            }).join('')}
          </svg>
        </div>
      `;
    }
  }

  /**
   * Create a styled HTML table
   */
  public createTableHTML(data: TableData, options?: { zebra?: boolean; compact?: boolean; title?: string }): string {
    const zebra = options?.zebra !== false;
    const compact = options?.compact || false;

    return `
      <div class="table-container no-break" style="margin: 20px 0;">
        ${options?.title ? `<h4 style="margin-bottom: 12px;">${options.title}</h4>` : ''}
        <table style="width: 100%; border-collapse: collapse; border: 1px solid var(--border-color);">
          <thead>
            <tr style="background: var(--primary-color); color: white;">
              ${data.headers.map(h => `<th style="padding: ${compact ? '8px' : '12px'}; text-align: left; font-weight: bold;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.rows.map((row, i) => `
              <tr style="${zebra && i % 2 === 1 ? 'background: var(--section-bg);' : ''}">
                ${row.map(cell => `<td style="padding: ${compact ? '6px 8px' : '10px 12px'}; border-bottom: 1px solid var(--border-color);">${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Create a callout box
   */
  public createCalloutBox(options: CalloutOptions): string {
    const iconMap = {
      info: 'ℹ️',
      tip: '💡',
      warning: '⚠️',
      objective: '🎯',
    };

    const colorMap = {
      info: { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
      tip: { bg: '#fff3e0', border: '#f57c00', text: '#e65100' },
      warning: { bg: '#fff3e0', border: '#f57c00', text: '#e65100' },
      objective: { bg: '#e8f5e9', border: '#388e3c', text: '#1b5e20' },
    };

    const icon = options.icon || iconMap[options.kind];
    const color = colorMap[options.kind];

    return `
      <div class="callout-box no-break" style="
        background: ${color.bg};
        border-left: 4px solid ${color.border};
        padding: 16px;
        margin: 20px 0;
        border-radius: 4px;
      ">
        <div style="display: flex; align-items: flex-start;">
          <span style="font-size: 24px; margin-right: 12px;">${icon}</span>
          <div style="flex: 1;">
            ${options.title ? `<h4 style="margin: 0 0 8px 0; color: ${color.text};">${options.title}</h4>` : ''}
            <p style="margin: 0; color: ${color.text};">${options.content}</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create a timeline for procedures/activities
   */
  public createTimelineHTML(steps: TimelineStep[]): string {
    return `
      <div class="timeline-container" style="margin: 20px 0;">
        ${steps.map((step, i) => `
          <div class="timeline-item no-break" style="
            display: flex;
            margin-bottom: 20px;
            padding-bottom: ${i < steps.length - 1 ? '20px' : '0'};
            ${i < steps.length - 1 ? 'border-left: 2px solid var(--border-color);' : ''}
            margin-left: 20px;
          ">
            <div style="
              width: 40px;
              height: 40px;
              background: var(--primary-color);
              color: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 18px;
              flex-shrink: 0;
              margin-left: -21px;
              margin-right: 16px;
            ">${i + 1}</div>
            <div style="flex: 1;">
              <h4 style="margin: 0 0 8px 0; color: var(--primary-color);">${step.title}</h4>
              <p style="margin: 0 0 4px 0; color: var(--text-color);">${step.description}</p>
              ${step.duration ? `<span style="font-size: 12px; color: #666;">⏱️ ${step.duration}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Create a rubric table
   */
  public createRubricTable(criteria: RubricCriterion[]): string {
    if (!criteria.length) return '';

    const levels = criteria[0].levels;

    return `
      <div class="rubric-container no-break" style="margin: 20px 0;">
        <h4 style="margin-bottom: 12px;">Assessment Rubric</h4>
        <table style="width: 100%; border-collapse: collapse; border: 2px solid var(--primary-color);">
          <thead>
            <tr style="background: var(--primary-color); color: white;">
              <th style="padding: 12px; text-align: left; font-weight: bold; width: 25%;">Criterion</th>
              ${levels.map(level => `
                <th style="padding: 12px; text-align: center; font-weight: bold;">
                  ${level.label}<br>
                  <span style="font-size: 12px; font-weight: normal;">(${level.points} pts)</span>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${criteria.map((criterion, i) => `
              <tr style="${i % 2 === 1 ? 'background: var(--section-bg);' : ''}">
                <td style="padding: 12px; font-weight: bold; border: 1px solid var(--border-color);">${criterion.name}</td>
                ${criterion.levels.map(level => `
                  <td style="padding: 12px; border: 1px solid var(--border-color); font-size: 14px;">${level.description}</td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Create a progress bar
   */
  public createProgressBar(percent: number, label?: string): string {
    const clampedPercent = Math.max(0, Math.min(100, percent));

    return `
      <div class="progress-container" style="margin: 16px 0;">
        ${label ? `<div style="margin-bottom: 8px; font-weight: bold; font-size: 14px;">${label}</div>` : ''}
        <div style="
          width: 100%;
          height: 24px;
          background: #e0e0e0;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        ">
          <div style="
            width: ${clampedPercent}%;
            height: 100%;
            background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
            transition: width 0.3s ease;
          "></div>
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${clampedPercent > 50 ? 'white' : 'var(--text-color)'};
            font-weight: bold;
            font-size: 12px;
          ">${clampedPercent}%</div>
        </div>
      </div>
    `;
  }
}

export const EducationalPDFService = new EducationalPDFServiceImpl();