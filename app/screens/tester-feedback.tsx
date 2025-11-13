/**
 * Tester Feedback Screen
 * 
 * Mobile-first feedback submission for internal testing phase.
 * Supports bug reports, feature requests, and improvements with optional screenshots.
 * 
 * Documentation Sources:
 * - React Native 0.79: https://reactnative.dev/docs/0.79/getting-started
 * - Expo Router v5: https://docs.expo.dev/router/introduction/
 * - React Native View Shot: https://github.com/gre/react-native-view-shot
 * 
 * WARP.md Compliance:
 * - File size: ≤500 lines
 * - Mobile-first (5.5" baseline)
 * - Touch targets ≥44x44 pixels
 * - Multi-language support (en-ZA, af-ZA, zu-ZA, xh-ZA)
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSubmitFeedback } from '@/hooks/useSubmitFeedback';
import { useTheme } from '@/contexts/ThemeContext';
import { validateFeedbackText, FEEDBACK_SEVERITY_ICONS } from '@/types/feedback.types';
import type { FeedbackSeverity } from '@/types/feedback.types';

// NOTE: react-native-view-shot must be installed
// npm install react-native-view-shot
// Platform guards ensure web compatibility
let captureRef: any = null;
try {
  if (Platform.OS !== 'web') {
    captureRef = require('react-native-view-shot').captureRef;
  }
} catch (e) {
  console.warn('[TesterFeedback] react-native-view-shot not available:', e);
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function TesterFeedbackScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const viewRef = useRef<View>(null);
  
  // Form state
  const [feedbackText, setFeedbackText] = useState('');
  const [severity, setSeverity] = useState<FeedbackSeverity>('bug');
  const [screenshotUri, setScreenshotUri] = useState<string | undefined>();
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Mutation
  const { mutate, isPending } = useSubmitFeedback();

  // ============================================
  // HANDLERS
  // ============================================

  const handleCaptureScreenshot = async () => {
    if (Platform.OS === 'web' || !captureRef || !viewRef.current) {
      Alert.alert(
        t('feedback.screenshotUnavailable', 'Screenshot Unavailable'),
        t('feedback.screenshotUnavailableMessage', 'Screenshot capture is not available on this platform.')
      );
      return;
    }

    try {
      setIsCapturing(true);
      
      const uri = await captureRef(viewRef.current, {
        format: 'jpg',
        quality: 0.8,
      });
      
      setScreenshotUri(uri);
      
      Alert.alert(
        t('feedback.screenshotCaptured', 'Screenshot Captured'),
        t('feedback.screenshotCapturedMessage', 'Screenshot will be included with your feedback.')
      );
    } catch (error) {
      console.error('[TesterFeedback] Capture error:', error);
      Alert.alert(
        t('feedback.captureError', 'Capture Failed'),
        t('feedback.captureErrorMessage', 'Failed to capture screenshot. Please try again.')
      );
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshotUri(undefined);
  };

  const handleSubmit = () => {
    // Validate feedback text
    const validation = validateFeedbackText(feedbackText);
    if (!validation.valid) {
      Alert.alert(
        t('feedback.validationError', 'Validation Error'),
        validation.error
      );
      return;
    }

    // Submit feedback
    mutate(
      {
        feedback_text: feedbackText,
        severity,
        screenshotUri,
      },
      {
        onSuccess: () => {
          Alert.alert(
            t('feedback.submitSuccess', 'Thank You!'),
            t('feedback.submitSuccessMessage', 'Your feedback has been submitted successfully.'),
            [
              {
                text: t('common.ok', 'OK'),
                onPress: () => router.back(),
              },
            ]
          );
        },
        onError: (error) => {
          Alert.alert(
            t('feedback.submitError', 'Submission Failed'),
            error.message || t('feedback.submitErrorMessage', 'Failed to submit feedback. Please try again.')
          );
        },
      }
    );
  };

  // ============================================
  // RENDER
  // ============================================

  const styles = createStyles(colors);

  return (
    <View ref={viewRef} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {t('feedback.title', 'Report Feedback')}
          </Text>
          <Text style={styles.subtitle}>
            {t('feedback.subtitle', 'Help us improve EduDash Pro by reporting bugs, requesting features, or suggesting improvements.')}
          </Text>
        </View>

        {/* Severity Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>
            {t('feedback.severityLabel', 'Type')} <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.severityContainer}>
            {(['bug', 'feature', 'improvement'] as FeedbackSeverity[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.severityButton,
                  severity === type && styles.severityButtonActive,
                ]}
                onPress={() => setSeverity(type)}
                activeOpacity={0.7}
              >
                <Text style={styles.severityIcon}>
                  {FEEDBACK_SEVERITY_ICONS[type]}
                </Text>
                <Text style={[
                  styles.severityText,
                  severity === type && styles.severityTextActive,
                ]}>
                  {t(`feedback.severity.${type}`, type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Feedback Text */}
        <View style={styles.section}>
          <Text style={styles.label}>
            {t('feedback.feedbackLabel', 'Describe the issue or suggestion')} <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            value={feedbackText}
            onChangeText={setFeedbackText}
            placeholder={t('feedback.feedbackPlaceholder', 'Please provide detailed information...')}
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            editable={!isPending}
          />
          <Text style={styles.charCount}>
            {feedbackText.length} / 5000
          </Text>
        </View>

        {/* Screenshot Section */}
        <View style={styles.section}>
          <Text style={styles.label}>
            {t('feedback.screenshotLabel', 'Screenshot (Optional)')}
          </Text>
          
          {screenshotUri ? (
            <View style={styles.screenshotPreview}>
              <Image
                source={{ uri: screenshotUri }}
                style={styles.screenshotImage}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={handleRemoveScreenshot}
                disabled={isPending}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCaptureScreenshot}
              disabled={isCapturing || isPending}
              activeOpacity={0.7}
            >
              {isCapturing ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Text style={styles.captureButtonIcon}>📸</Text>
                  <Text style={styles.captureButtonText}>
                    {t('feedback.captureButton', 'Capture Screenshot')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          
          <Text style={styles.hint}>
            {t('feedback.screenshotHint', 'Screenshots help us understand the issue better.')}
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (isPending || feedbackText.trim().length < 10) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isPending || feedbackText.trim().length < 10}
          activeOpacity={0.8}
        >
          {isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              {t('feedback.submitButton', 'Submit Feedback')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isPending}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>
            {t('common.cancel', 'Cancel')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    required: {
      color: '#FF6B6B',
    },
    severityContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    severityButton: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.card,
      minHeight: 80,
    },
    severityButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight || colors.primary + '20',
    },
    severityIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    severityText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    severityTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    textInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      minHeight: 140,
    },
    charCount: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'right',
      marginTop: 4,
    },
    captureButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: 12,
      paddingVertical: 20,
      paddingHorizontal: 16,
      minHeight: 80,
    },
    captureButtonIcon: {
      fontSize: 24,
      marginRight: 12,
    },
    captureButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    screenshotPreview: {
      position: 'relative',
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    screenshotImage: {
      width: '100%',
      height: 200,
    },
    removeButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: '#FF6B6B',
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: 'bold',
    },
    hint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
      fontStyle: 'italic',
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      minHeight: 52,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    cancelButton: {
      backgroundColor: 'transparent',
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
