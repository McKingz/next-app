import React, { useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { createProgressReportStyles } from '@/styles/progress-report/creator.styles';

/**
 * SuggestionsModal Component
 * 
 * Bottom sheet modal displaying age-appropriate suggestions for progress reports.
 * Follows React Native 0.79.5 functional component patterns with hooks.
 * 
 * References:
 * - React Native Modal: https://reactnative.dev/docs/0.79/modal
 * - React Hooks: https://react.dev/reference/react
 * - useCallback: https://react.dev/reference/react/useCallback
 * 
 * @component
 * @param props - Component props
 * @param props.visible - Whether the modal is visible
 * @param props.onClose - Callback when modal is closed
 * @param props.suggestions - Array of suggestion strings to display
 * @param props.onInsert - Callback when a suggestion is selected, receives suggestion text
 * @param props.title - Optional modal title (default: "Suggestions")
 * @param props.subtitle - Optional subtitle explaining usage
 */

interface SuggestionsModalProps {
  visible: boolean;
  onClose: () => void;
  suggestions: string[];
  onInsert: (text: string) => void;
  title?: string;
  subtitle?: string;
}

export const SuggestionsModal: React.FC<SuggestionsModalProps> = ({
  visible,
  onClose,
  suggestions,
  onInsert,
  title = 'Suggestions',
  subtitle = 'Tap a suggestion to add it to your report:',
}) => {
  const { theme } = useTheme();
  const styles = createProgressReportStyles(theme);

  /**
   * Handle suggestion selection
   * Inserts the selected text and closes the modal
   * 
   * Reference: https://react.dev/reference/react/useCallback
   */
  const handleSuggestionPress = useCallback((text: string) => {
    onInsert(text);
    onClose();
  }, [onInsert, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      accessibilityLabel="Suggestions modal"
      accessibilityRole="dialog"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close suggestions"
              accessibilityRole="button"
              accessibilityHint="Double-tap to close the suggestions modal"
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Subtitle */}
          {subtitle && (
            <Text style={styles.modalSubtitle}>{subtitle}</Text>
          )}

          {/* Suggestions List */}
          <ScrollView
            style={styles.modalScroll}
            showsVerticalScrollIndicator
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {suggestions.length === 0 ? (
              <Text style={styles.modalSubtitle}>
                No suggestions available for this field.
              </Text>
            ) : (
              suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestionPress(suggestion)}
                  accessibilityLabel={`Suggestion: ${suggestion}`}
                  accessibilityRole="button"
                  accessibilityHint="Double-tap to insert this suggestion into your report"
                >
                  <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                  <Text style={styles.suggestionChipText}>{suggestion}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
