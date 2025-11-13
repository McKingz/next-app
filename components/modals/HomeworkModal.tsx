/**
 * HomeworkModal - Tool-enabled homework help for parents
 * 
 * Extracted from ParentDashboard to maintain file size limits.
 * Enhanced with agentic AI capabilities for better learning support.
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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useHomeworkGenerator, HomeworkResult } from '@/hooks/useHomeworkGenerator';
import { track } from '@/lib/analytics';

interface HomeworkModalProps {
  visible: boolean;
  onClose: () => void;
  userId?: string;
  activeChildId?: string | null;
  children: any[];
}

export const HomeworkModal: React.FC<HomeworkModalProps> = ({
  visible,
  onClose,
  userId,
  activeChildId,
  children,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<HomeworkResult | null>(null);
  const { loading, generate } = useHomeworkGenerator();

  const handleSubmit = async () => {
    if (!question.trim()) return;

    try {
      const start = Date.now();

      // Use tool-enabled generation with child context
      const homeworkResult = await generate({
        question,
        subject: 'General Education',
        gradeLevel: children.length > 0 ? 8 : 10,
        difficulty: 'easy',
        studentId: activeChildId || undefined,
      });

      setResult(homeworkResult);

      track('edudash.ai.homework_help_completed', {
        user_id: userId,
        question_length: question.length,
        success: true,
        duration_ms: Date.now() - start,
        tools_used: homeworkResult.toolsUsed?.length || 0,
        has_practice_problems: !!homeworkResult.practiceProblems,
        source: 'parent_dashboard',
      });
    } catch (error) {
      Alert.alert(t('common.error'), t('ai.homework.error'));
      console.error('Homework help error:', error);
    }
  };

  const handleClose = () => {
    setQuestion('');
    setResult(null);
    onClose();
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: theme.text,
      backgroundColor: theme.background,
      marginBottom: 16,
      minHeight: 100,
    },
    submitButton: {
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 16,
    },
    disabledButton: {
      opacity: 0.5,
    },
    submitGradient: {
      padding: 12,
      alignItems: 'center',
    },
    submitText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
      fontSize: 16,
    },
    responseContainer: {
      maxHeight: 300,
      marginBottom: 16,
    },
    responseTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 8,
    },
    responseText: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    practiceProblemsSection: {
      marginTop: 16,
    },
    problemCard: {
      backgroundColor: theme.elevated,
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    problemDifficulty: {
      fontSize: 13,
      color: theme.text,
      fontWeight: '600',
      marginBottom: 4,
    },
    problemText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    suggestedActionsSection: {
      marginTop: 16,
      gap: 8,
    },
    actionButton: {
      backgroundColor: theme.primary + '15',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    actionText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '600',
    },
    modalCloseButton: {
      padding: 12,
      alignItems: 'center',
    },
    modalCloseText: {
      color: theme.textSecondary,
      fontSize: 16,
    },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('ai.homework.title')}</Text>

          <TextInput
            style={styles.textInput}
            placeholder={t('ai.homework.questionPlaceholder')}
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
            <ScrollView style={styles.responseContainer}>
              <Text style={styles.responseTitle}>{t('ai.homework.explanation')}</Text>
              <Text style={styles.responseText}>{result.text}</Text>

              {/* Show practice problems if available */}
              {result.practiceProblems && result.practiceProblems.length > 0 && (
                <View style={styles.practiceProblemsSection}>
                  <Text style={[styles.responseTitle, { marginBottom: 8 }]}>
                    Practice Problems
                  </Text>
                  {result.practiceProblems.map((problem: any, index: number) => (
                    <View key={index} style={styles.problemCard}>
                      <Text style={styles.problemDifficulty}>
                        {index + 1}. {problem.difficulty}
                      </Text>
                      <Text style={styles.problemText}>{problem.problem}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Show suggested actions */}
              {result.suggestedActions && result.suggestedActions.length > 0 && (
                <View style={styles.suggestedActionsSection}>
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
            </ScrollView>
          )}

          <TouchableOpacity style={styles.modalCloseButton} onPress={handleClose}>
            <Text style={styles.modalCloseText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
