/**
 * PDF Export Utility for EduDash Pro
 * 
 * Generates PDF documents from exam data, flashcards, and study materials.
 * Uses jsPDF for client-side PDF generation.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generate PDF from exam data
 */
export function exportExamToPDF(examData: any): void {
  const doc = new jsPDF();
  let yPos = 20;
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(examData.title || 'CAPS Practice Examination', 105, yPos, { align: 'center' });
  yPos += 10;
  
  // Metadata
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Grade: ${examData.grade || 'N/A'}`, 20, yPos);
  yPos += 6;
  doc.text(`Subject: ${examData.subject || 'N/A'}`, 20, yPos);
  yPos += 6;
  doc.text(`Duration: ${examData.duration || 'N/A'}`, 20, yPos);
  yPos += 6;
  doc.text(`Total Marks: ${examData.totalMarks || examData.marks || 'N/A'}`, 20, yPos);
  yPos += 12;
  
  // Instructions (if present)
  if (examData.instructions) {
    doc.setFont('helvetica', 'bold');
    doc.text('INSTRUCTIONS:', 20, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const instructions = Array.isArray(examData.instructions) 
      ? examData.instructions 
      : examData.instructions.split('\n');
    
    instructions.forEach((instruction: string, index: number) => {
      const text = instruction.trim();
      if (text) {
        doc.text(`${index + 1}. ${text}`, 25, yPos);
        yPos += 5;
      }
    });
    yPos += 8;
  }
  
  // Sections and Questions
  if (examData.sections && Array.isArray(examData.sections)) {
    examData.sections.forEach((section: any, sectionIndex: number) => {
      // Check if we need a new page
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      // Section header
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`SECTION ${String.fromCharCode(65 + sectionIndex)}: ${section.title || section.name || 'Questions'}`, 20, yPos);
      yPos += 8;
      
      // Section description (if present)
      if (section.description) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        const descLines = doc.splitTextToSize(section.description, 170);
        doc.text(descLines, 20, yPos);
        yPos += (descLines.length * 5) + 5;
      }
      
      // Questions
      if (section.questions && Array.isArray(section.questions)) {
        section.questions.forEach((question: any, qIndex: number) => {
          // Check if we need a new page
          if (yPos > 265) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.text(`Question ${qIndex + 1}.`, 20, yPos);
          yPos += 6;
          
          // Question text
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          const questionText = question.text || question.question || question.prompt || '';
          const lines = doc.splitTextToSize(questionText, 165);
          doc.text(lines, 25, yPos);
          yPos += (lines.length * 5);
          
          // Sub-questions or options
          if (question.parts && Array.isArray(question.parts)) {
            question.parts.forEach((part: any, partIndex: number) => {
              if (yPos > 270) {
                doc.addPage();
                yPos = 20;
              }
              
              const partText = part.text || part.question || '';
              const partLines = doc.splitTextToSize(`${String.fromCharCode(97 + partIndex)}) ${partText}`, 160);
              doc.text(partLines, 30, yPos);
              yPos += (partLines.length * 5) + 2;
            });
          }
          
          // Options (for multiple choice)
          if (question.options && Array.isArray(question.options)) {
            question.options.forEach((option: any, optIndex: number) => {
              if (yPos > 270) {
                doc.addPage();
                yPos = 20;
              }
              
              const optionText = typeof option === 'string' ? option : option.text;
              doc.text(`${String.fromCharCode(65 + optIndex)}) ${optionText}`, 30, yPos);
              yPos += 5;
            });
          }
          
          // Marks
          if (question.marks || question.points) {
            doc.setFont('helvetica', 'italic');
            doc.text(`[${question.marks || question.points} marks]`, 185, yPos - 5, { align: 'right' });
          }
          
          yPos += 8;
        });
      }
      
      yPos += 5;
    });
  }
  
  // Memorandum (if present)
  if (examData.memo || examData.memorandum || examData.answers) {
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MARKING MEMORANDUM', 105, yPos, { align: 'center' });
    yPos += 12;
    
    const memoData = examData.memo || examData.memorandum || examData.answers;
    
    if (typeof memoData === 'string') {
      // Simple text memo
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const memoLines = doc.splitTextToSize(memoData, 170);
      doc.text(memoLines, 20, yPos);
    } else if (Array.isArray(memoData)) {
      // Structured memo
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      memoData.forEach((answer: any, index: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text(`Question ${index + 1}:`, 20, yPos);
        yPos += 6;
        
        doc.setFont('helvetica', 'normal');
        const answerText = answer.answer || answer.solution || answer.text || answer;
        const answerLines = doc.splitTextToSize(String(answerText), 165);
        doc.text(answerLines, 25, yPos);
        yPos += (answerLines.length * 5) + 5;
      });
    }
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${pageCount}`, 105, 287, { align: 'center' });
    doc.text('© EduDash Pro • CAPS-Aligned Resources', 105, 292, { align: 'center' });
  }
  
  // Save PDF
  const filename = `${examData.title || 'exam'}.pdf`.replace(/[^a-z0-9_-]/gi, '_');
  doc.save(filename);
}

/**
 * Generate PDF from flashcards
 */
export function exportFlashcardsToPDF(flashcardsData: any): void {
  const doc = new jsPDF();
  let yPos = 20;
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Flashcards', 105, yPos, { align: 'center' });
  yPos += 8;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${flashcardsData.subject || 'Subject'} - ${flashcardsData.grade || 'Grade'}`, 105, yPos, { align: 'center' });
  yPos += 15;
  
  // Flashcards
  const cards = flashcardsData.cards || flashcardsData.flashcards || [];
  
  cards.forEach((card: any, index: number) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    // Card number
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Card ${index + 1}`, 20, yPos);
    yPos += 7;
    
    // Front (Question)
    doc.setFont('helvetica', 'bold');
    doc.text('FRONT:', 20, yPos);
    yPos += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const frontText = card.front || card.question || card.term || '';
    const frontLines = doc.splitTextToSize(frontText, 165);
    doc.text(frontLines, 25, yPos);
    yPos += (frontLines.length * 5) + 5;
    
    // Back (Answer)
    doc.setFont('helvetica', 'bold');
    doc.text('BACK:', 20, yPos);
    yPos += 5;
    
    doc.setFont('helvetica', 'normal');
    const backText = card.back || card.answer || card.definition || '';
    const backLines = doc.splitTextToSize(backText, 165);
    doc.text(backLines, 25, yPos);
    yPos += (backLines.length * 5) + 10;
    
    // Separator line
    doc.setDrawColor(200);
    doc.line(20, yPos, 190, yPos);
    yPos += 8;
  });
  
  // Save PDF
  const filename = `flashcards_${flashcardsData.subject || 'subject'}.pdf`.replace(/[^a-z0-9_-]/gi, '_');
  doc.save(filename);
}

/**
 * Generate PDF from study guide
 */
export function exportStudyGuideToPDF(studyGuideData: any): void {
  const doc = new jsPDF();
  let yPos = 20;
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(studyGuideData.title || 'Study Guide', 105, yPos, { align: 'center' });
  yPos += 8;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${studyGuideData.subject || ''} - ${studyGuideData.grade || ''}`, 105, yPos, { align: 'center' });
  yPos += 15;
  
  // Content
  const content = studyGuideData.content || studyGuideData.text || '';
  
  if (typeof content === 'string') {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Split by paragraphs and format
    const paragraphs = content.split('\n\n');
    
    paragraphs.forEach((paragraph: string) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      // Check if it's a heading
      if (paragraph.startsWith('#')) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        const heading = paragraph.replace(/^#+\s*/, '');
        doc.text(heading, 20, yPos);
        yPos += 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      } else {
        const lines = doc.splitTextToSize(paragraph, 170);
        doc.text(lines, 20, yPos);
        yPos += (lines.length * 5) + 8;
      }
    });
  }
  
  // Save PDF
  const filename = `${studyGuideData.title || 'study_guide'}.pdf`.replace(/[^a-z0-9_-]/gi, '_');
  doc.save(filename);
}

/**
 * Generic text-to-PDF export
 */
export function exportTextToPDF(text: string, title: string = 'Document'): void {
  const doc = new jsPDF();
  let yPos = 20;
  
  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 105, yPos, { align: 'center' });
  yPos += 15;
  
  // Content
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const lines = doc.splitTextToSize(text, 170);
  
  lines.forEach((line: string) => {
    if (yPos > 280) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.text(line, 20, yPos);
    yPos += 5;
  });
  
  // Save PDF
  const filename = `${title}.pdf`.replace(/[^a-z0-9_-]/gi, '_');
  doc.save(filename);
}
