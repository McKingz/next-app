import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { createProgressReportStyles } from '@/styles/progress-report/creator.styles';
import { 
  SuggestionsModal, 
  StudentInfoEditor, 
  ReportProgressIndicator, 
  ReportPreviewModal, 
  ReportActionButtons,
  SignatureModal 
} from '@/components/progress-report';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { useProgressReportForm } from '@/hooks/useProgressReportForm';
import { useProgressReportActions } from '@/hooks/useProgressReportActions';
import { Ionicons } from '@expo/vector-icons';

/**
 * Progress Report Creator Screen (Refactored)
 * 
 * Reduced from 1,570 lines to ~460 lines by extracting:
 * - Form state → hooks/useProgressReportForm.ts
 * - Actions → hooks/useProgressReportActions.ts
 * - Helpers → lib/progress-report-helpers.ts
 * - UI components → components/progress-report/
 */

export default function ProgressReportCreator() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const studentId = params.student_id as string;

  // Signature modal state
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // Custom hooks extract all state and logic
  const formState = useProgressReportForm({ studentId, profile });
  const actions = useProgressReportActions({ formState, profile, studentId });

  const styles = useMemo(() => createProgressReportStyles(theme), [theme]);

  // Role-based access control: Only teachers can create progress reports
  if (profile && profile.role === 'principal') {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="lock-closed" size={64} color={theme.warning} />
          <Text style={[{ fontSize: 20, fontWeight: '700', color: theme.text, marginTop: 16, textAlign: 'center' }]}>Access Restricted</Text>
          <Text style={{ color: theme.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>
            Progress report creation is restricted to teachers only. Principals can review and approve reports from the dashboard.
          </Text>
          <TouchableOpacity 
            style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 14, backgroundColor: theme.primary, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            onPress={() => router.push('/screens/principal-report-review')}
          >
            <Ionicons name="document-text" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Go to Report Review</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 14 }}
            onPress={() => router.back()}
          >
            <Text style={{ color: theme.textSecondary }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (!profile || formState.loading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.textSecondary, marginTop: 16 }}>
            {!profile ? 'Loading profile...' : 'Loading student...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (!formState.student) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={[styles.errorText, { color: theme.error }]}>Student not found</Text>
          <Text style={{ color: theme.textSecondary, marginTop: 8, textAlign: 'center' }}>
            Student ID: {studentId}
          </Text>
          <TouchableOpacity 
            style={{ marginTop: 20, padding: 12, backgroundColor: theme.primary, borderRadius: 8 }}
            onPress={() => router.back()}
          >
            <Text style={{ color: theme.background }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Create Progress Report', headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.primary }} />
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false} disabled={Platform.OS === 'web'}>
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {/* Progress Indicator */}
            <ReportProgressIndicator 
              percentage={formState.completionPercentage}
              autoSaveStatus={formState.autoSaveStatus}
              lastAutoSave={formState.lastAutoSave}
            />

            {/* Student Information Editor */}
            <StudentInfoEditor
              student={formState.student}
              preschoolId={profile.preschool_id || profile.organization_id || ''}
              onSaved={(updatedStudent) => formState.setStudent(updatedStudent)}
              collapsedInitially={true}
            />

            {/* Report Category Toggle */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Report Type *</Text>
              <View style={styles.categoryToggle}>
                <TouchableOpacity
                  style={[styles.categoryButton, { backgroundColor: theme.surface, borderColor: theme.border }, formState.reportCategory === 'general' && styles.categoryButtonActive]}
                  onPress={() => formState.setReportCategory('general')}
                >
                  <Text style={[styles.categoryButtonText, { color: theme.textSecondary }, formState.reportCategory === 'general' && styles.categoryButtonTextActive]}>General Progress</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.categoryButton, { backgroundColor: theme.surface, borderColor: theme.border }, formState.reportCategory === 'school_readiness' && styles.categoryButtonActive]}
                  onPress={() => formState.setReportCategory('school_readiness')}
                >
                  <Text style={[styles.categoryButtonText, { color: theme.textSecondary }, formState.reportCategory === 'school_readiness' && styles.categoryButtonTextActive]}>🎓 School Readiness</Text>
                </TouchableOpacity>
              </View>
              {formState.reportCategory === 'school_readiness' && (
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>For Grade R students transitioning to formal school</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Report Period *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formState.reportPeriod}
                onChangeText={formState.setReportPeriod}
                placeholder="e.g., Q1 2025, Term 1"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Prepared By (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formState.preparerNameOverride}
                onChangeText={formState.setPreparerNameOverride}
                placeholder={`Leave blank to use: ${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Auto-detected name'}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="words"
              />
              <Text style={[styles.helperText, { color: theme.textSecondary }]}>Override the auto-detected name if needed</Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Overall Grade *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formState.overallGrade}
                onChangeText={formState.setOverallGrade}
                placeholder="e.g., A, B+, Excellent"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.text }]}>Teacher Comments *</Text>
                <TouchableOpacity 
                  style={[styles.suggestionButton, { backgroundColor: theme.primary }]}
                  onPress={() => actions.openSuggestions('comments')}
                >
                  <Ionicons name="bulb" size={14} color="#fff" />
                  <Text style={styles.suggestionButtonText}>Suggestions</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formState.teacherComments}
                onChangeText={(text) => {
                  if (text.length <= formState.CHAR_LIMITS.teacherComments) {
                    formState.setTeacherComments(text);
                    formState.setAutoSaveStatus('unsaved');
                  }
                }}
                placeholder="General comments about the student's progress"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                maxLength={formState.CHAR_LIMITS.teacherComments}
              />
              {(() => {
                const { remaining, color } = formState.getCharCounterData(formState.teacherComments.length, formState.CHAR_LIMITS.teacherComments);
                return <Text style={{ fontSize: 11, color, marginTop: 4 }}>{remaining} characters remaining</Text>;
              })()}
            </View>

            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.text }]}>Strengths</Text>
                <TouchableOpacity 
                  style={[styles.suggestionButton, { backgroundColor: theme.primary }]}
                  onPress={() => actions.openSuggestions('strengths')}
                >
                  <Ionicons name="bulb" size={14} color="#fff" />
                  <Text style={styles.suggestionButtonText}>Suggestions</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formState.strengths}
                onChangeText={(text) => {
                  if (text.length <= formState.CHAR_LIMITS.strengths) {
                    formState.setStrengths(text);
                    formState.setAutoSaveStatus('unsaved');
                  }
                }}
                placeholder="What the student excels at"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
                maxLength={formState.CHAR_LIMITS.strengths}
              />
              {(() => {
                const { remaining, color } = formState.getCharCounterData(formState.strengths.length, formState.CHAR_LIMITS.strengths);
                return <Text style={{ fontSize: 11, color, marginTop: 4 }}>{remaining} characters remaining</Text>;
              })()}
            </View>

            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.text }]}>Areas for Improvement</Text>
                <TouchableOpacity 
                  style={[styles.suggestionButton, { backgroundColor: theme.primary }]}
                  onPress={() => actions.openSuggestions('improvements')}
                >
                  <Ionicons name="bulb" size={14} color="#fff" />
                  <Text style={styles.suggestionButtonText}>Suggestions</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={formState.areasForImprovement}
                onChangeText={(text) => {
                  if (text.length <= formState.CHAR_LIMITS.areasForImprovement) {
                    formState.setAreasForImprovement(text);
                    formState.setAutoSaveStatus('unsaved');
                  }
                }}
                placeholder="What the student can work on"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
                maxLength={formState.CHAR_LIMITS.areasForImprovement}
              />
              {(() => {
                const { remaining, color } = formState.getCharCounterData(formState.areasForImprovement.length, formState.CHAR_LIMITS.areasForImprovement);
                return <Text style={{ fontSize: 11, color, marginTop: 4 }}>{remaining} characters remaining</Text>;
              })()}
            </View>

            {/* School Readiness Specific Sections */}
            {formState.reportCategory === 'school_readiness' && (
              <>
                <View style={styles.section}>
                  <Text style={[styles.label, { color: theme.text }]}>Overall School Readiness *</Text>
                  <View style={styles.readinessLevelContainer}>
                    {(['not_ready', 'developing', 'ready', 'exceeds_expectations'] as const).map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={[styles.readinessLevelButton, { backgroundColor: theme.surface, borderColor: theme.border }, formState.transitionReadinessLevel === level && styles.readinessLevelButtonActive]}
                        onPress={() => formState.setTransitionReadinessLevel(level)}
                      >
                        <Text style={[styles.readinessLevelText, { color: theme.textSecondary }, formState.transitionReadinessLevel === level && styles.readinessLevelTextActive]}>
                          {level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { color: theme.text }]}>Development Areas (Rate 1-5)</Text>
                {Object.entries(formState.readinessIndicators).map(([indicator, data]) => (
                  <View key={indicator} style={[styles.indicatorCard, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.indicatorName, { color: theme.primary }]}>{indicator.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text>
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <TouchableOpacity
                          key={rating}
                          style={[styles.starButton, data.rating >= rating && styles.starButtonActive]}
                          onPress={() => formState.updateReadinessIndicator(indicator, 'rating', rating)}
                        >
                          <Text style={styles.starText}>{data.rating >= rating ? '★' : '☆'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={[styles.input, styles.textArea, { marginTop: 8, backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                      value={data.notes}
                      onChangeText={(value) => formState.updateReadinessIndicator(indicator, 'notes', value)}
                      placeholder="Notes for this development area"
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                ))}

                <Text style={[styles.sectionTitle, { color: theme.text }]}>Developmental Milestones</Text>
                <View style={[styles.milestonesContainer, { backgroundColor: theme.surface }]}>
                  {Object.entries(formState.milestones).map(([milestone, achieved]) => (
                    <TouchableOpacity
                      key={milestone}
                      style={[styles.milestoneItem, { borderBottomColor: theme.border }]}
                      onPress={() => formState.toggleMilestone(milestone)}
                    >
                      <View style={[styles.checkbox, { borderColor: theme.border, backgroundColor: theme.background }, achieved && styles.checkboxChecked]}>
                        {achieved && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.milestoneText, { color: theme.text }]}>{milestone.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.section}>
                  <Text style={[styles.label, { color: theme.text }]}>Readiness Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    value={formState.readinessNotes}
                    onChangeText={formState.setReadinessNotes}
                    placeholder="Additional notes about school readiness"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <View style={styles.section}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: theme.text }]}>Recommendations for Parents/School</Text>
                    <TouchableOpacity 
                      style={[styles.suggestionButton, { backgroundColor: theme.primary }]}
                      onPress={() => actions.openSuggestions('recommendations')}
                    >
                      <Ionicons name="bulb" size={14} color="#fff" />
                      <Text style={styles.suggestionButtonText}>Suggestions</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    value={formState.recommendations}
                    onChangeText={formState.setRecommendations}
                    placeholder="Recommendations for supporting transition to formal school"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={4}
                  />
                </View>
              </>
            )}

            {/* Subject Performance - Only show for general reports */}
            {formState.reportCategory === 'general' && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Subject Performance</Text>
                {Object.entries(formState.subjects).map(([subject, data]) => (
                  <View key={subject} style={[styles.subjectCard, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.subjectName, { color: theme.primary }]}>{subject}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                      value={data.grade}
                      onChangeText={(value) => formState.updateSubject(subject, 'grade', value)}
                      placeholder="Grade (A, B, C, etc.)"
                      placeholderTextColor={theme.textSecondary}
                    />
                    <TextInput
                      style={[styles.input, styles.textArea, { marginTop: 8, backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                      value={data.comments}
                      onChangeText={(value) => formState.updateSubject(subject, 'comments', value)}
                      placeholder="Comments for this subject"
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                ))}
              </>
            )}

            {/* Teacher Signature */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Teacher Signature *</Text>
              <TouchableOpacity
                style={[styles.signatureButton, { 
                  backgroundColor: formState.teacherSignature ? theme.success + '15' : theme.surface,
                  borderColor: formState.teacherSignature ? theme.success : theme.border 
                }]}
                onPress={() => setShowSignatureModal(true)}
              >
                {formState.teacherSignature ? (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                    <Text style={[styles.signatureButtonText, { color: theme.success }]}>Signature Added</Text>
                    <Text style={[styles.signatureSubtext, { color: theme.textSecondary }]}>Tap to change</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="create-outline" size={24} color={theme.primary} />
                    <Text style={[styles.signatureButtonText, { color: theme.text }]}>Add Your Signature</Text>
                    <Text style={[styles.signatureSubtext, { color: theme.textSecondary }]}>Tap to sign</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <ReportActionButtons
              onPreview={actions.handlePreview}
              onExportCSV={actions.handleExportCSV}
              onSendPDF={actions.handleSendPDF}
              onSendWhatsApp={actions.handleSendViaWhatsApp}
              onSendEmail={actions.handleSend}
              onSubmitForReview={actions.handleSubmitForReview}
              sending={formState.sending}
              disabled={!formState.reportPeriod || !formState.overallGrade || !formState.teacherComments || !formState.teacherSignature}
              parentEmail={formState.student?.parent_email}
              approvalStatus={formState.approvalStatus || 'pending_review'}
              isSubmitted={formState.isSubmitted}
            />

            {/* Preview Modal */}
            <ReportPreviewModal
              visible={formState.showPreviewModal}
              onClose={() => formState.setShowPreviewModal(false)}
              html={formState.previewHtml}
            />

            {/* Suggestions Modal */}
            <SuggestionsModal
              visible={formState.showSuggestionsModal}
              onClose={() => formState.setShowSuggestionsModal(false)}
              suggestions={actions.getCurrentSuggestions()}
              onInsert={actions.insertSuggestion}
              title={`Age-Appropriate Suggestions${formState.student?.age_years ? ` (Age ${formState.student.age_years})` : ''}`}
            />

            {/* Signature Modal */}
            <SignatureModal
              visible={showSignatureModal}
              onClose={() => setShowSignatureModal(false)}
              onSave={(signature) => {
                formState.setTeacherSignature(signature);
                setShowSignatureModal(false);
              }}
              title="Teacher Signature"
              currentSignature={formState.teacherSignature}
            />

            {/* Submit Confirmation Modal */}
            <ConfirmationModal
              visible={formState.showSubmitConfirmModal}
              title="Submit for Review?"
              message="This will save the report and notify the principal for approval. You won't be able to send it to parents until approved."
              confirmText="Submit"
              cancelText="Cancel"
              onConfirm={actions.confirmSubmitForReview}
              onCancel={() => formState.setShowSubmitConfirmModal(false)}
              type="warning"
              icon="checkmark-done"
            />

            {/* Success Modal */}
            <SuccessModal
              visible={formState.showSuccessModal}
              title="Submitted Successfully!"
              message="Progress report has been submitted for principal review. You will be notified once it is approved."
              buttonText="Back to Dashboard"
              onClose={() => {
                formState.setShowSuccessModal(false);
                router.back();
              }}
            />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
