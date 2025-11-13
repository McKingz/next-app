import { StyleSheet } from 'react-native';

/**
 * Progress Report Creator Styles
 * 
 * Creates theme-aware styles for the progress report creation screen.
 * Follows React Native 0.79.5 patterns with New Architecture support.
 * 
 * References:
 * - React Native StyleSheet: https://reactnative.dev/docs/0.79/stylesheet
 * - React Native New Architecture: https://reactnative.dev/docs/the-new-architecture/landing-page
 * - Mobile-first design with 5.5" baseline (per WARP.md)
 * - 44px minimum touch targets (accessibility)
 * - 8px spacing grid
 * 
 * @param theme - Theme object from ThemeContext
 * @returns StyleSheet object with all component styles
 */
export const createProgressReportStyles = (theme: any) => StyleSheet.create({
  // Base Container Styles
  container: {
    flex: 1,
    backgroundColor: theme.background || '#000000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // Header Section
  header: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: theme.surface || '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border || '#38383A',
  },
  studentName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text || '#FFFFFF',
    marginBottom: 8,
  },
  parentInfo: {
    fontSize: 14,
    color: theme.textSecondary || '#8E8E93',
  },

  // Progress Tracking Styles
  progressContainer: {
    backgroundColor: theme.surface || '#1C1C1E',
    borderWidth: 1,
    borderColor: theme.border || '#38383A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text || '#FFFFFF',
  },
  autoSaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autoSaveText: {
    fontSize: 12,
    color: theme.textSecondary || '#8E8E93',
  },
  progressBarOuter: {
    height: 8,
    backgroundColor: theme.surfaceVariant || '#2C2C2E',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    backgroundColor: theme.primary || '#007AFF',
    borderRadius: 999,
    // Width is set dynamically via inline style
  },
  progressPercentage: {
    marginTop: 8,
    fontSize: 12,
    color: theme.textSecondary || '#8E8E93',
  },

  // Form Section Styles
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text || '#FFFFFF',
    marginBottom: 16,
    marginTop: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text || '#FFFFFF',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: theme.textSecondary || '#8E8E93',
    marginTop: 8,
    lineHeight: 16,
  },

  // Input Styles
  input: {
    backgroundColor: theme.surface || '#1C1C1E',
    borderRadius: 8,
    padding: 12,
    color: theme.text || '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.border || '#38383A',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Category Toggle Styles (General vs School Readiness)
  categoryToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Accessibility: minimum touch target
  },
  categoryButtonActive: {
    backgroundColor: theme.primary || '#007AFF',
    borderColor: theme.primary || '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryButtonTextActive: {
    color: theme.onPrimary || '#FFFFFF',
  },

  // Readiness Level Selection Styles
  readinessLevelContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  readinessLevelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44, // Accessibility: minimum touch target
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readinessLevelButtonActive: {
    backgroundColor: theme.primary || '#007AFF',
    borderColor: theme.primary || '#007AFF',
  },
  readinessLevelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  readinessLevelTextActive: {
    color: theme.onPrimary || '#FFFFFF',
  },

  // Development Indicators Card Styles
  indicatorCard: {
    backgroundColor: theme.surface || '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border || '#38383A',
  },
  indicatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary || '#007AFF',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  starButton: {
    width: 44, // Accessibility: minimum touch target
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: theme.surfaceVariant || '#2C2C2E',
  },
  starButtonActive: {
    backgroundColor: theme.primaryContainer || 'rgba(0, 122, 255, 0.15)',
  },
  starText: {
    fontSize: 24,
    color: theme.textSecondary || '#8E8E93',
  },

  // Milestones Checklist Styles
  milestonesContainer: {
    backgroundColor: theme.surface || '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border || '#38383A',
    overflow: 'hidden',
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border || '#38383A',
    minHeight: 56, // Sufficient touch target with padding
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.border || '#38383A',
    backgroundColor: theme.background || '#000000',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.primary || '#007AFF',
    borderColor: theme.primary || '#007AFF',
  },
  checkmark: {
    fontSize: 16,
    color: theme.onPrimary || '#FFFFFF',
    fontWeight: '700',
  },
  milestoneText: {
    flex: 1,
    fontSize: 14,
    color: theme.text || '#FFFFFF',
    textTransform: 'capitalize',
  },

  // Subject Card Styles
  subjectCard: {
    backgroundColor: theme.surface || '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border || '#38383A',
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary || '#007AFF',
    marginBottom: 12,
  },

  // Suggestion Button Styles
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
    backgroundColor: theme.primary || '#007AFF',
    minHeight: 32, // Smaller but still tappable
  },
  suggestionButtonText: {
    color: theme.onPrimary || '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Action Button Styles
  actionsContainer: {
    gap: 12,
    marginTop: 24,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10,
    minHeight: 52, // Comfortable touch target
    backgroundColor: theme.primary || '#007AFF',
  },
  actionButtonSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: theme.primary || '#007AFF',
  },
  secondaryButton: {
    backgroundColor: theme.surface || '#1C1C1E',
    borderWidth: 1,
    borderColor: theme.border || '#38383A',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.onPrimary || '#FFFFFF',
  },
  actionButtonTextSmall: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: theme.text || '#FFFFFF',
  },

  // Modal Styles (Bottom Sheet Pattern)
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.background || '#000000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text || '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.textSecondary || '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalScroll: {
    maxHeight: '70%',
  },
  closeButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Suggestion Chip Styles
  suggestionItem: {
    padding: 12,
    backgroundColor: theme.surface || '#1C1C1E',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border || '#38383A',
  },
  suggestionText: {
    fontSize: 14,
    color: theme.text || '#FFFFFF',
    lineHeight: 20,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.surface || '#1C1C1E',
    borderRadius: 10,
    marginBottom: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border || '#38383A',
    minHeight: 52, // Comfortable touch target
  },
  suggestionChipText: {
    flex: 1,
    fontSize: 14,
    color: theme.text || '#FFFFFF',
    lineHeight: 20,
  },
  modalCloseButton: {
    backgroundColor: theme.primary || '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
    minHeight: 48,
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.onPrimary || '#FFFFFF',
  },

  // Preview Modal Styles
  previewModal: {
    flex: 1,
    backgroundColor: theme.background || '#000000',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border || '#38383A',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text || '#FFFFFF',
  },
  webview: {
    flex: 1,
  },

  // Signature Button Styles
  signatureButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    minHeight: 100,
    gap: 8,
  },
  signatureButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  signatureSubtext: {
    fontSize: 13,
  },

  // Error State Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: theme.error || '#FF3B30',
    marginTop: 16,
    textAlign: 'center',
  },
});
