/**
 * PDF Action Bar Component
 * 
 * Bottom action bar with primary and secondary actions for PDF generation
 */

import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface PDFActionBarProps {
  onPreview: () => void;
  onGenerate: () => void;
  onSaveDraft?: () => void;
  onShare?: () => void;
  isGenerating?: boolean;
  canPreview?: boolean;
  canGenerate?: boolean;
  hasPreview?: boolean; // Whether a preview has been generated
  previewError?: string; // If there was a preview error
}

export function PDFActionBar({
  onPreview,
  onGenerate,
  onSaveDraft,
  onShare,
  isGenerating = false,
  canPreview = true,
  canGenerate = true,
  hasPreview = false,
  previewError,
}: PDFActionBarProps) {
  const { theme } = useTheme();

  const styles = useThemedStyles((theme) => ({
    container: {
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
      paddingHorizontal: 20,
      paddingVertical: 16,
      ...Platform.select({
        ios: {
          paddingBottom: 20, // Account for home indicator
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    primaryActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    secondaryActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
    },
    primaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      minHeight: 50,
    },
    previewButton: {
      backgroundColor: theme.surfaceVariant,
      borderWidth: 1,
      borderColor: theme.border,
    },
    generateButton: {
      backgroundColor: theme.primary,
    },
    disabledButton: {
      backgroundColor: theme.surfaceVariant,
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    previewButtonText: {
      color: theme.text,
    },
    generateButtonText: {
      color: theme.onPrimary,
    },
    disabledButtonText: {
      color: theme.textDisabled,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    secondaryButtonText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginLeft: 6,
    },
    loadingIndicator: {
      marginRight: 8,
    },
  }));

  const handlePreview = () => {
    if (canPreview && !isGenerating) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onPreview();
    }
  };

  const handleGenerate = () => {
    // Require preview first, unless there's a preview error (allow retry)
    const canActuallyGenerate = canGenerate && !isGenerating && (hasPreview || previewError);
    
    if (canActuallyGenerate) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      onGenerate();
    }
  };

  const handleSaveDraft = () => {
    if (onSaveDraft && !isGenerating) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onSaveDraft();
    }
  };

  const handleShare = () => {
    if (onShare && !isGenerating) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onShare();
    }
  };

  return (
    <View style={styles.container}>
      {/* Primary Actions */}
      <View style={styles.primaryActions}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            styles.previewButton,
            (!canPreview || isGenerating) && styles.disabledButton,
          ]}
          onPress={handlePreview}
          disabled={!canPreview || isGenerating}
          accessibilityLabel="Generate preview"
          accessibilityRole="button"
        >
          <Ionicons
            name="eye-outline"
            size={20}
            color={
              !canPreview || isGenerating
                ? theme.textDisabled
                : theme.text
            }
          />
          <Text
            style={[
              styles.buttonText,
              styles.previewButtonText,
              (!canPreview || isGenerating) && styles.disabledButtonText,
            ]}
          >
            Preview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            styles.generateButton,
            (!canGenerate || isGenerating || (!hasPreview && !previewError)) && styles.disabledButton,
          ]}
          onPress={handleGenerate}
          disabled={!canGenerate || isGenerating || (!hasPreview && !previewError)}
          accessibilityLabel={isGenerating ? 'Generating PDF...' : 
                             !hasPreview && !previewError ? 'Generate preview first' : 'Generate PDF'}
          accessibilityRole="button"
        >
          {isGenerating ? (
            <View style={styles.loadingIndicator}>
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={theme.onPrimary}
              />
            </View>
          ) : (
            <Ionicons
              name="document-outline"
              size={20}
              color={
                (!canGenerate || (!hasPreview && !previewError))
                  ? theme.textDisabled
                  : theme.onPrimary
              }
            />
          )}
          <Text
            style={[
              styles.buttonText,
              styles.generateButtonText,
              (!canGenerate || isGenerating || (!hasPreview && !previewError)) && styles.disabledButtonText,
            ]}
          >
            {isGenerating ? 'Generating...' : 
             !hasPreview && !previewError ? 'Preview First' : 
             previewError ? 'Generate Anyway' : 'Generate PDF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Secondary Actions */}
      <View style={styles.secondaryActions}>
        {onSaveDraft && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSaveDraft}
            disabled={isGenerating}
            accessibilityLabel="Save draft"
            accessibilityRole="button"
          >
            <Ionicons
              name="bookmark-outline"
              size={16}
              color={isGenerating ? theme.textDisabled : theme.textSecondary}
            />
            <Text
              style={[
                styles.secondaryButtonText,
                isGenerating && { color: theme.textDisabled },
              ]}
            >
              Save Draft
            </Text>
          </TouchableOpacity>
        )}

        {onShare && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleShare}
            disabled={isGenerating}
            accessibilityLabel="Share"
            accessibilityRole="button"
          >
            <Ionicons
              name="share-outline"
              size={16}
              color={isGenerating ? theme.textDisabled : theme.textSecondary}
            />
            <Text
              style={[
                styles.secondaryButtonText,
                isGenerating && { color: theme.textDisabled },
              ]}
            >
              Share
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}