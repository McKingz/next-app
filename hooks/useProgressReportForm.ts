import React, { useState, useEffect } from 'react';
import { Alert, Text } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getSubjectsForOrganization } from '@/lib/progress-report-helpers';
import { useTheme } from '@/contexts/ThemeContext';

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  parent_email: string;
  parent_name: string;
  date_of_birth?: string;
  age_years?: number;
}

export interface OrganizationInfo {
  name: string;
  type?: string;
}

export interface UseProgressReportFormProps {
  studentId: string;
  profile: any;
}

export const CHAR_LIMITS = {
  teacherComments: 1000,
  strengths: 500,
  areasForImprovement: 500,
  readinessNotes: 800,
  recommendations: 800,
};

export const useProgressReportForm = ({ studentId, profile }: UseProgressReportFormProps) => {
  const { theme } = useTheme();
  
  // Core state
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [organizationInfo, setOrganizationInfo] = useState<OrganizationInfo | null>(null);

  // Suggestions modal state
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [currentField, setCurrentField] = useState<'strengths' | 'improvements' | 'recommendations' | 'comments' | null>(null);

  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  // Confirmation and success modals
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Report form state
  const [reportCategory, setReportCategory] = useState<'general' | 'school_readiness'>('general');
  const [reportPeriod, setReportPeriod] = useState('Q4 2025');
  const [reportType, setReportType] = useState<'weekly' | 'monthly' | 'quarterly' | 'annual'>('quarterly');
  const [preparerNameOverride, setPreparerNameOverride] = useState('');
  const [overallGrade, setOverallGrade] = useState('');
  const [teacherComments, setTeacherComments] = useState('');
  const [strengths, setStrengths] = useState('');
  const [areasForImprovement, setAreasForImprovement] = useState('');
  const [teacherSignature, setTeacherSignature] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<'pending_review' | 'approved' | 'rejected'>('pending_review');

  // Subjects (will be set based on organization type)
  const [subjects, setSubjects] = useState<Record<string, { grade: string; comments: string }>>({});

  // School readiness specific fields
  const [transitionReadinessLevel, setTransitionReadinessLevel] = useState<'not_ready' | 'developing' | 'ready' | 'exceeds_expectations'>('developing');
  const [readinessNotes, setReadinessNotes] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [readinessIndicators, setReadinessIndicators] = useState<Record<string, { rating: number; notes: string }>>({
    social_skills: { rating: 3, notes: '' },
    emotional_development: { rating: 3, notes: '' },
    gross_motor_skills: { rating: 3, notes: '' },
    fine_motor_skills: { rating: 3, notes: '' },
    cognitive_development: { rating: 3, notes: '' },
    language_development: { rating: 3, notes: '' },
    independence: { rating: 3, notes: '' },
    self_care: { rating: 3, notes: '' },
  });
  const [milestones, setMilestones] = useState<Record<string, boolean>>({
    can_write_name: false,
    can_count_to_20: false,
    recognizes_letters: false,
    follows_instructions: false,
    shares_with_others: false,
    sits_still_in_circle_time: false,
    uses_toilet_independently: false,
    ties_shoelaces: false,
  });

  // UI Enhancement: Progress tracking and collapsed sections
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('unsaved');

  // Calculate completion percentage
  useEffect(() => {
    const calculateCompletion = () => {
      const requiredFields = [
        { filled: !!reportPeriod, weight: 10 },
        { filled: !!overallGrade, weight: 10 },
        { filled: !!teacherComments, weight: 20 },
        { filled: reportCategory === 'school_readiness' ? !!readinessNotes : !!strengths, weight: 15 },
        { filled: reportCategory === 'school_readiness' ? !!recommendations : !!areasForImprovement, weight: 15 },
      ];

      if (reportCategory === 'school_readiness') {
        const indicatorsComplete = Object.values(readinessIndicators).every(ind => ind.rating > 0);
        const milestonesChecked = Object.values(milestones).some(Boolean);
        requiredFields.push(
          { filled: indicatorsComplete, weight: 20 },
          { filled: milestonesChecked, weight: 10 }
        );
      } else {
        const subjectsComplete = Object.values(subjects).some(subj => subj.grade !== '');
        requiredFields.push({ filled: subjectsComplete, weight: 30 });
      }

      const totalWeight = requiredFields.reduce((sum, field) => sum + field.weight, 0);
      const completedWeight = requiredFields
        .filter(field => field.filled)
        .reduce((sum, field) => sum + field.weight, 0);

      setCompletionPercentage(Math.round((completedWeight / totalWeight) * 100));
    };

    calculateCompletion();
  }, [
    reportPeriod,
    overallGrade,
    teacherComments,
    strengths,
    areasForImprovement,
    readinessNotes,
    recommendations,
    readinessIndicators,
    milestones,
    subjects,
    reportCategory,
  ]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    const saveTimer = setInterval(() => {
      if (student && (teacherComments || strengths || areasForImprovement)) {
        saveDraft();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(saveTimer);
  }, [student, teacherComments, strengths, areasForImprovement, readinessNotes, recommendations]);

  // Load student on mount
  useEffect(() => {
    if (profile) {
      loadStudent();
      loadDraft();
    }
  }, [studentId, profile]);

  // Check for existing report when report period changes
  useEffect(() => {
    if (profile && studentId && reportPeriod) {
      checkExistingReport();
    }
  }, [reportPeriod, studentId, profile]);

  // Check if a report already exists for this student and period
  const checkExistingReport = async () => {
    if (!studentId || !profile) return;

    const preschoolId = profile.preschool_id || profile.organization_id;
    if (!preschoolId) return;

    try {
      // Check for existing report with current report period
      const { data: existingReport, error } = await supabase
        .from('progress_reports')
        .select('id, approval_status')
        .eq('student_id', studentId)
        .eq('report_period', reportPeriod)
        .eq('preschool_id', preschoolId)
        .maybeSingle();

      if (error) {
        console.error('[useProgressReportForm] Error checking existing report:', error);
        return;
      }

      // If report exists, mark as submitted and set approval status
      if (existingReport) {
        setIsSubmitted(true);
        setApprovalStatus(existingReport.approval_status as 'pending_review' | 'approved' | 'rejected');
      } else {
        // No existing report for this period - reset submission state
        setIsSubmitted(false);
        setApprovalStatus('pending_review');
      }
    } catch (error) {
      console.error('[useProgressReportForm] Unexpected error checking report:', error);
    }
  };

  const loadStudent = async () => {
    const preschoolId = profile?.preschool_id || profile?.organization_id;

    if (!studentId || !preschoolId) {
      Alert.alert('Error', 'Missing required information');
      setLoading(false);
      return;
    }

    try {
      // Fetch organization info first to determine subject types
      const { data: orgData } = await supabase
        .from('preschools')
        .select('name, type')
        .eq('id', preschoolId)
        .single();

      if (orgData) {
        setOrganizationInfo(orgData);
        setSubjects(getSubjectsForOrganization(orgData.type));
      }

      // Simple query without age_groups join to avoid ambiguity issues
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, parent_id, guardian_id, date_of_birth')
        .eq('id', studentId)
        .eq('preschool_id', preschoolId)
        .single();

      if (error) {
        Alert.alert('Error', `Failed to load student: ${error.message}`);
        setLoading(false);
        return;
      }

      // Calculate age from date_of_birth if available
      let ageYears = 4; // Default age
      if (data?.date_of_birth) {
        const birthDate = new Date(data.date_of_birth);
        const today = new Date();
        ageYears = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          ageYears--;
        }
      }

      if (!data) {
        Alert.alert('Error', 'Student not found');
        setLoading(false);
        return;
      }

      // Try to get parent information
      let parentData = null;
      if (data.parent_id) {
        const { data: parent } = await supabase
          .from('users')
          .select('email, first_name, last_name')
          .eq('id', data.parent_id)
          .maybeSingle();
        parentData = parent;
      }

      // If no parent, try guardian
      if (!parentData && data.guardian_id) {
        const { data: guardian } = await supabase
          .from('users')
          .select('email, first_name, last_name')
          .eq('id', data.guardian_id)
          .maybeSingle();
        parentData = guardian;
      }

      setStudent({
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        parent_email: parentData?.email || '',
        parent_name: parentData ? `${parentData.first_name || ''} ${parentData.last_name || ''}`.trim() : 'Parent',
        date_of_birth: data.date_of_birth,
        age_years: ageYears,
      });

      setLoading(false);
    } catch (err: any) {
      Alert.alert('Error', 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const updateSubject = (subject: string, field: 'grade' | 'comments', value: string) => {
    setSubjects((prev) => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        [field]: value,
      },
    }));
  };

  const updateReadinessIndicator = (indicator: string, field: 'rating' | 'notes', value: number | string) => {
    setReadinessIndicators((prev) => ({
      ...prev,
      [indicator]: {
        ...prev[indicator],
        [field]: value,
      },
    }));
  };

  const toggleMilestone = (milestone: string) => {
    setMilestones((prev) => ({
      ...prev,
      [milestone]: !prev[milestone],
    }));
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Save draft to AsyncStorage
  const saveDraft = async () => {
    if (!student) return;

    try {
      setAutoSaveStatus('saving');
      const draftKey = `progress_report_draft_${student.id}`;
      const draftData = {
        reportCategory,
        reportPeriod,
        reportType,
        overallGrade,
        teacherComments,
        strengths,
        areasForImprovement,
        subjects,
        transitionReadinessLevel,
        readinessNotes,
        recommendations,
        readinessIndicators,
        milestones,
        savedAt: new Date().toISOString(),
      };

      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem(draftKey, JSON.stringify(draftData));
      setLastAutoSave(new Date());
      setAutoSaveStatus('saved');
    } catch (error) {
      setAutoSaveStatus('unsaved');
    }
  };

  // Load draft from AsyncStorage
  const loadDraft = async () => {
    if (!studentId) return;

    try {
      const draftKey = `progress_report_draft_${studentId}`;
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const draftJson = await AsyncStorage.getItem(draftKey);

      if (draftJson) {
        const draft = JSON.parse(draftJson);
        setReportCategory(draft.reportCategory || 'general');
        setReportPeriod(draft.reportPeriod || 'Q4 2025');
        setReportType(draft.reportType || 'quarterly');
        setOverallGrade(draft.overallGrade || '');
        setTeacherComments(draft.teacherComments || '');
        setStrengths(draft.strengths || '');
        setAreasForImprovement(draft.areasForImprovement || '');
        if (draft.subjects) setSubjects(draft.subjects);
        if (draft.transitionReadinessLevel) setTransitionReadinessLevel(draft.transitionReadinessLevel);
        setReadinessNotes(draft.readinessNotes || '');
        setRecommendations(draft.recommendations || '');
        if (draft.readinessIndicators) setReadinessIndicators(draft.readinessIndicators);
        if (draft.milestones) setMilestones(draft.milestones);
        setLastAutoSave(new Date(draft.savedAt));
        setAutoSaveStatus('saved');
      }
    } catch (error) {
      // Silently fail
    }
  };

  // Clear draft after successful send
  const clearDraft = async () => {
    if (!student) return;
    try {
      const draftKey = `progress_report_draft_${student.id}`;
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem(draftKey);
    } catch (error) {
      // Silently fail
    }
  };

  // Get character counter data
  const getCharCounterData = (currentLength: number, maxLength: number) => {
    const remaining = maxLength - currentLength;
    const percentage = (currentLength / maxLength) * 100;
    const color = percentage > 90 ? theme.error : percentage > 75 ? '#F59E0B' : theme.textSecondary;

    return { remaining, color };
  };

  return {
    // Core state
    loading,
    sending,
    setSending,
    student,
    setStudent,
    organizationInfo,
    
    // Modal state
    showSuggestionsModal,
    setShowSuggestionsModal,
    currentField,
    setCurrentField,
    showPreviewModal,
    setShowPreviewModal,
    previewHtml,
    setPreviewHtml,
    showSubmitConfirmModal,
    setShowSubmitConfirmModal,
    showSuccessModal,
    setShowSuccessModal,
    isSubmitted,
    setIsSubmitted,
    
    // Form state
    reportCategory,
    setReportCategory,
    reportPeriod,
    setReportPeriod,
    reportType,
    preparerNameOverride,
    setPreparerNameOverride,
    overallGrade,
    setOverallGrade,
    teacherComments,
    setTeacherComments,
    strengths,
    setStrengths,
    areasForImprovement,
    setAreasForImprovement,
    teacherSignature,
    setTeacherSignature,
    approvalStatus,
    setApprovalStatus,
    subjects,
    setSubjects,
    
    // School readiness state
    transitionReadinessLevel,
    setTransitionReadinessLevel,
    readinessNotes,
    setReadinessNotes,
    recommendations,
    setRecommendations,
    readinessIndicators,
    milestones,
    
    // Progress tracking
    completionPercentage,
    collapsedSections,
    lastAutoSave,
    autoSaveStatus,
    setAutoSaveStatus,
    
    // Methods
    updateSubject,
    updateReadinessIndicator,
    toggleMilestone,
    toggleSection,
    saveDraft,
    clearDraft,
    getCharCounterData,
    
    // Constants
    CHAR_LIMITS,
  };
};
