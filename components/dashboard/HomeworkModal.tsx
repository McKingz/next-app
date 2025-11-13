/**
 * HomeworkModal - Tool-enabled homework help modal for parents
 * 
 * Features:
 * - AI-powered step-by-step homework explanations
 * - Context-aware practice problems
 * - Suggested learning actions
 * - Child-specific learning context integration
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useHomeworkGenerator } from '@/hooks/useHomeworkGenerator';
import { track } from '@/lib/analytics';

interface HomeworkModalProps {
  visible: boolean;
  onClose: () => void;
  activeChildId?: string | null;
  children?: any[];
}

export const HomeworkModal: React.FC<HomeworkModalProps> = ({
  visible,
  onClose,
  activeChildId,
  children = [],
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const { loading, result, generate } = useHomeworkGenerator();

  const handleSubmit = async () => {
    if (!question.trim()) return;

    try {
      const start = Date.now();
      
      await generate({
        question,
        subject: 'General Education',
        gradeLevel: children.length > 0 ? 8 : 10,
        difficulty: 'easy',
        studentId: activeChildId || undefined,
      });

      track('edudash.ai.homework_help_completed', {
        user_id: user?.id,
        question_length: question.length,
        success: true,
        duration_ms: Date.now() - start,
        source: 'parent_dashboard',
        has_child_context: !!activeChildId,
        tools_used: result?.toolsUsed?.length || 0,
      });
    } catch (error) {
      Alert.alert(t('common.error'), t('ai.homework.error'));
      console.error('Homework help error:', error);
    }
  };

  const handleClose = () => {
    setQuestion('');
    onClose();
  };

  const styles = createStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.modalTitle}>{t('ai.homework.title')}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            <TextInput
              style={styles.textInput}
              placeholder={t('ai.homework.questionPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={question}
              onChangeText={setQuestion}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitButton, (!question.trim() || loading) && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={!question.trim() || loading}
            >
              <LinearGradient
                colors={loading ? ['#6B7280', '#9CA3AF'] : ['#00f5ff', '#0080ff']}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>{t('ai.homework.getHelp')}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {result && (
              <View style={styles.resultContainer}>
                {/* Main Explanation */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('ai.homework.explanation')}</Text>
                  <Text style={styles.responseText}>{result.text}</Text>
                </View>

                {/* Tools Used Indicator */}
                {result.toolsUsed && result.toolsUsed.length > 0 && (
                  <View style={styles.toolsBadge}>
                    <Ionicons name="construct-outline" size={14} color={theme.primary} />
                    <Text style={styles.toolsText}>
                      {result.toolsUsed.length} {result.toolsUsed.length === 1 ? 'tool' : 'tools'} used
                    </Text>
                  </View>
                )}

                {/* Practice Problems */}
                {result.practiceProblems && result.practiceProblems.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="bulb-outline" size={20} color={theme.primary} />
                      <Text style={styles.sectionTitle}>Practice Problems</Text>
                    </View>
                    {result.practiceProblems.map((problem, index) => (
                      <View key={index} style={styles.practiceCard}>
                        <Text style={styles.practiceQuestion}>
                          {index + 1}. {problem.question}
                        </Text>
                        {problem.hint && (
                          <Text style={styles.practiceHint}>💡 Hint: {problem.hint}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Suggested Actions */}
                {result.suggestedActions && result.suggestedActions.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="flash-outline" size={20} color={theme.primary} />
                      <Text style={styles.sectionTitle}>Suggested Next Steps</Text>
                    </View>
                    {result.suggestedActions.map((action, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.actionButton}
                        onPress={action.action}
                      >
                        <Text style={styles.actionText}>{action.label}</Text>
                        <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      width: '100%',
      maxHeight: '85%',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.text,
    },
    closeButton: {
      padding: 4,
    },
    scrollContent: {
      padding: 20,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.elevated,
      minHeight: 120,
      marginBottom: 16,
    },
    submitButton: {
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
    },
    disabledButton: {
      opacity: 0.5,
    },
    submitGradient: {
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    resultContainer: {
      marginTop: 8,
    },
    section: {
      marginBottom: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    responseText: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.text,
    },
    toolsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.elevated,
      borderRadius: 20,
      alignSelf: 'flex-start',
      marginBottom: 16,
    },
    toolsText: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '500',
    },
    practiceCard: {
      backgroundColor: theme.elevated,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
    },
    practiceQuestion: {
      fontSize: 15,
      color: theme.text,
      marginBottom: 8,
      fontWeight: '500',
    },
    practiceHint: {
      fontSize: 13,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    actionButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.elevated,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionText: {
      fontSize: 15,
      color: theme.text,
      fontWeight: '500',
    },
  });
