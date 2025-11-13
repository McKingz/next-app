import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import emailTemplateService, { ProgressReport } from '@/services/EmailTemplateService';
import * as Sharing from 'expo-sharing';
import { getAgeSuggestions } from '@/lib/progress-report-helpers';
import { notifyReportSubmittedForReview } from '@/services/notification-service';

export interface UseProgressReportActionsProps {
  formState: any;
  profile: any;
  studentId: string;
}

export const useProgressReportActions = ({ formState, profile, studentId }: UseProgressReportActionsProps) => {
  // Open suggestions modal
  const openSuggestions = (field: 'strengths' | 'improvements' | 'recommendations' | 'comments') => {
    formState.setCurrentField(field);
    formState.setShowSuggestionsModal(true);
  };

  // Insert suggestion into field
  const insertSuggestion = (text: string) => {
    if (!formState.currentField) return;

    switch (formState.currentField) {
      case 'strengths':
        formState.setStrengths((prev: string) => prev ? `${prev}\n• ${text}` : `• ${text}`);
        break;
      case 'improvements':
        formState.setAreasForImprovement((prev: string) => prev ? `${prev}\n• ${text}` : `• ${text}`);
        break;
      case 'recommendations':
        formState.setRecommendations((prev: string) => prev ? `${prev}\n• ${text}` : `• ${text}`);
        break;
      case 'comments':
        formState.setTeacherComments((prev: string) => prev ? `${prev} ${text}` : text);
        break;
    }
  };

  // Get current suggestions based on student age and report category
  const getCurrentSuggestions = () => {
    const ageYears = formState.student?.age_years || 4;
    const suggestions = getAgeSuggestions(ageYears, formState.reportCategory);

    if (formState.currentField === 'strengths') {
      return suggestions.strengths || [];
    } else if (formState.currentField === 'improvements') {
      return suggestions.improvements || [];
    } else if (formState.currentField === 'recommendations') {
      return suggestions.recommendations || [];
    }
    return [];
  };

  // Build report object
  const buildReport = (preschoolId: string): ProgressReport => {
    return {
      preschool_id: preschoolId,
      student_id: studentId,
      teacher_id: profile.id,
      report_period: formState.reportPeriod,
      report_type: formState.reportType,
      overall_comments: formState.teacherComments,
      teacher_comments: formState.teacherComments,
      strengths: formState.strengths,
      areas_for_improvement: formState.areasForImprovement,
      subjects_performance: formState.subjects,
      overall_grade: formState.overallGrade,
      report_category: formState.reportCategory,
      teacher_signature: formState.teacherSignature,
      status: 'pending_review' as const,
      teacher_signature_data: formState.teacherSignature,
      teacher_signed_at: new Date().toISOString(),
      ...(formState.reportCategory === 'school_readiness' && {
        school_readiness_indicators: formState.readinessIndicators,
        developmental_milestones: formState.milestones,
        transition_readiness_level: formState.transitionReadinessLevel,
        readiness_notes: formState.readinessNotes,
        recommendations: formState.recommendations,
      }),
    };
  };

  const handlePreview = async () => {
    if (!formState.student || !profile) return;

    const preschoolId = profile.preschool_id || profile.organization_id;
    if (!preschoolId) {
      Alert.alert('Error', 'No organization/preschool associated with your account');
      return;
    }

    formState.setSending(true);

    try {
      const preschoolData = await supabase
        .from('preschools')
        .select('name')
        .eq('id', preschoolId)
        .single();

      const defaultName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email?.split('@')[0] || 'Staff';
      const teacherName = formState.preparerNameOverride.trim() || defaultName;

      const report = buildReport(preschoolId);

      // Generate HTML based on report type
      let html: string;
      if (formState.reportCategory === 'school_readiness') {
        const result = await emailTemplateService.generateSchoolReadinessEmail(
          report,
          `${formState.student.first_name} ${formState.student.last_name}`,
          formState.student.parent_name,
          teacherName,
          preschoolData.data?.name || 'School'
        );
        html = result.html;
      } else {
        const result = await emailTemplateService.generateProgressReportEmail(
          report,
          `${formState.student.first_name} ${formState.student.last_name}`,
          formState.student.parent_name,
          teacherName,
          preschoolData.data?.name || 'School'
        );
        html = result.html;
      }

      // Wrap HTML with mobile viewport settings
      const mobileOptimizedHtml = html.includes('<!DOCTYPE html>')
        ? html
        : `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
            <style>
              body { margin: 0; padding: 0; }
            </style>
          </head>
          <body>
            ${html}
          </body>
          </html>
        `;

      formState.setPreviewHtml(mobileOptimizedHtml);
      formState.setShowPreviewModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      formState.setSending(false);
    }
  };

  const handleSendPDF = async () => {
    if (!formState.student || !profile) return;

    const preschoolId = profile.preschool_id || profile.organization_id;
    if (!preschoolId) {
      Alert.alert('Error', 'No organization/preschool associated with your account');
      return;
    }

    formState.setSending(true);

    try {
      const preschoolData = await supabase
        .from('preschools')
        .select('name')
        .eq('id', preschoolId)
        .single();

      const defaultName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email?.split('@')[0] || 'Staff';
      const teacherName = formState.preparerNameOverride.trim() || defaultName;

      const report = buildReport(preschoolId);

      const pdfResult = await emailTemplateService.generateProgressReportPDF(
        report,
        `${formState.student.first_name} ${formState.student.last_name}`,
        formState.student.parent_name,
        teacherName,
        preschoolData.data?.name || 'School'
      );

      if (!pdfResult.success || !pdfResult.uri) {
        throw new Error(pdfResult.error || 'Failed to generate PDF');
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      await Sharing.shareAsync(pdfResult.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Progress Report',
      });

      Alert.alert('Success', 'PDF generated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      formState.setSending(false);
    }
  };

  const handleSendViaWhatsApp = async () => {
    if (!formState.student || !profile) return;

    const preschoolId = profile.preschool_id || profile.organization_id;
    if (!preschoolId) {
      Alert.alert('Error', 'No organization/preschool associated with your account');
      return;
    }

    formState.setSending(true);

    try {
      const preschoolData = await supabase
        .from('preschools')
        .select('name')
        .eq('id', preschoolId)
        .single();

      const defaultName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email?.split('@')[0] || 'Staff';
      const teacherName = formState.preparerNameOverride.trim() || defaultName;

      const report = buildReport(preschoolId);

      const pdfResult = await emailTemplateService.generateProgressReportPDF(
        report,
        `${formState.student.first_name} ${formState.student.last_name}`,
        formState.student.parent_name,
        teacherName,
        preschoolData.data?.name || 'School'
      );

      if (!pdfResult.success || !pdfResult.uri) {
        throw new Error(pdfResult.error || 'Failed to generate PDF');
      }

      const message = `Progress Report for ${formState.student.first_name} ${formState.student.last_name} - ${formState.reportPeriod}`;
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (!canOpen) {
        Alert.alert('WhatsApp Not Installed', 'Please install WhatsApp to share via WhatsApp');
        return;
      }

      await Linking.openURL(whatsappUrl);

      await Sharing.shareAsync(pdfResult.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share via WhatsApp',
      });

      Alert.alert('Success', 'Opening WhatsApp...', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      formState.setSending(false);
    }
  };

  const handleExportCSV = async () => {
    if (!formState.student || !profile) return;

    const preschoolId = profile.preschool_id || profile.organization_id;
    if (!preschoolId) {
      Alert.alert('Error', 'No organization/preschool associated with your account');
      return;
    }

    formState.setSending(true);

    try {
      const preschoolData = await supabase
        .from('preschools')
        .select('name')
        .eq('id', preschoolId)
        .single();

      const report = buildReport(preschoolId);

      const csvResult = await emailTemplateService.exportProgressReportCSV(
        report,
        `${formState.student.first_name} ${formState.student.last_name}`,
        preschoolData.data?.name || 'School'
      );

      if (!csvResult.success || !csvResult.uri) {
        throw new Error(csvResult.error || 'Failed to export CSV');
      }

      await Sharing.shareAsync(csvResult.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Progress Report Data',
      });

      Alert.alert('Success', 'CSV exported successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      formState.setSending(false);
    }
  };

  const handleSend = async () => {
    if (!formState.student || !profile) return;

    if (!formState.student.parent_email) {
      Alert.alert('Error', 'No parent email found for this student');
      return;
    }

    const preschoolId = profile.preschool_id || profile.organization_id;
    if (!preschoolId) {
      Alert.alert('Error', 'No organization/preschool associated with your account');
      return;
    }

    formState.setSending(true);

    try {
      const preschoolData = await supabase
        .from('preschools')
        .select('name')
        .eq('id', preschoolId)
        .single();

      const report = buildReport(preschoolId);

      const savedReport = await emailTemplateService.saveProgressReport(report);

      if (!savedReport) {
        throw new Error('Failed to save progress report');
      }

      let result;
      if (formState.reportCategory === 'school_readiness') {
        const { subject, html } = await emailTemplateService.generateSchoolReadinessEmail(
          { ...savedReport, id: savedReport.id },
          `${formState.student.first_name} ${formState.student.last_name}`,
          formState.student.parent_name,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
          preschoolData.data?.name || 'School'
        );

        result = await emailTemplateService.sendEmail({
          to: formState.student.parent_email,
          subject,
          body: html,
          is_html: true,
          confirmed: true,
        });
      } else {
        result = await emailTemplateService.sendProgressReport(
          { ...savedReport, id: savedReport.id },
          formState.student.parent_email,
          `${formState.student.first_name} ${formState.student.last_name}`,
          formState.student.parent_name,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
          preschoolData.data?.name || 'School'
        );
      }

      if (result.success) {
        await formState.clearDraft();
        Alert.alert(
          'Report Submitted', 
          'Progress report has been submitted for principal review. You will be notified once it is approved.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to submit progress report');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      formState.setSending(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!formState.student || !profile) return;

    const preschoolId = profile.preschool_id || profile.organization_id;
    if (!preschoolId) {
      Alert.alert('Error', 'No organization/preschool associated with your account');
      return;
    }

    // Show confirmation modal
    formState.setShowSubmitConfirmModal(true);
  };

  const confirmSubmitForReview = async () => {
    if (!formState.student || !profile) return;

    const preschoolId = profile.preschool_id || profile.organization_id;
    if (!preschoolId) return;

    formState.setShowSubmitConfirmModal(false);
    formState.setSending(true);

    try {
      const report = buildReport(preschoolId);
      const savedReport = await emailTemplateService.saveProgressReport(report);

      if (!savedReport) {
        throw new Error('Failed to save progress report');
      }

      // Update approval status and submission state
      formState.setApprovalStatus('pending_review');
      formState.setIsSubmitted(true);
      await formState.clearDraft();

      // Send notification to principals
      try {
        await notifyReportSubmittedForReview(
          savedReport.id,
          studentId,
          preschoolId
        );
        console.log('Notification sent to principals');
      } catch (notifError: any) {
        // Log but don't fail the submission
        console.error('Failed to send notification:', notifError);
      }

      // Show success modal
      formState.setShowSuccessModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      formState.setSending(false);
    }
  };

  return {
    openSuggestions,
    insertSuggestion,
    getCurrentSuggestions,
    handlePreview,
    handleSendPDF,
    handleSendViaWhatsApp,
    handleExportCSV,
    handleSend,
    handleSubmitForReview,
    confirmSubmitForReview,
  };
};
