/**
 * Prompt Tab Component
 * 
 * Natural language input for PDF generation
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import type { DocumentType } from '@/types/pdf';
import { DOCUMENT_TYPE_SCHEMAS } from '@/types/pdf';

interface PromptTabProps {
  form: {
    content: string;
    documentType: DocumentType;
    title: string;
    options: any;
  };
  onChange: (form: any) => void;
  onPreview: () => void;
  isGenerating: boolean;
}

export function PromptTab({ form, onChange, onPreview, isGenerating }: PromptTabProps) {
  const { theme } = useTheme();
  const [showOptions, setShowOptions] = useState(false);

  const styles = useThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      padding: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.inputBackground,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.inputText,
      minHeight: 48,
    },
    textArea: {
      minHeight: 200,
      textAlignVertical: 'top',
    },
    focusedInput: {
      borderColor: theme.primary,
    },
    docTypeSelector: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    docTypeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    docTypeTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    docTypeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    docTypeChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    selectedDocTypeChip: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    docTypeChipText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
    },
    selectedDocTypeChipText: {
      color: theme.onPrimary,
    },
    optionsToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    optionsToggleText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    optionsContent: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    helpText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 6,
      lineHeight: 18,
    },
    characterCount: {
      fontSize: 12,
      color: theme.textTertiary,
      textAlign: 'right',
      marginTop: 4,
    },
    suggestionsContainer: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    suggestionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    suggestionChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.surfaceVariant,
      marginRight: 8,
      marginBottom: 8,
    },
    suggestionText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
  }));

  const documentTypes = Object.values(DOCUMENT_TYPE_SCHEMAS)
    .filter(schema => schema.type)
    .map(schema => ({
      id: schema.type,
      name: schema.name,
      description: schema.description,
    }));

  const suggestions = [
    'Create a parent letter about upcoming school events',
    'Generate a progress report for a student',
    'Write a lesson plan for teaching fractions',
    'Compose a newsletter with school updates',
    'Draft a worksheet for vocabulary practice',
  ];

  const handleContentChange = useCallback((text: string) => {
    onChange({
      ...form,
      content: text,
      // Auto-generate title from first line if title is empty
      title: form.title || text.split('\n')[0].slice(0, 50),
    });
  }, [form, onChange]);

  const handleDocTypeSelect = useCallback((docType: DocumentType) => {
    onChange({
      ...form,
      documentType: docType,
    });
  }, [form, onChange]);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    onChange({
      ...form,
      content: suggestion,
      title: suggestion.slice(0, 50),
    });
  }, [form, onChange]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Document Title</Text>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={(text) => onChange({ ...form, title: text })}
            placeholder="Enter a title for your document..."
            placeholderTextColor={theme.inputPlaceholder}
            maxLength={100}
          />
          <Text style={styles.helpText}>
            A clear title helps organize your PDFs
          </Text>
        </View>

        {/* Document Type Selector */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Document Type</Text>
          <View style={styles.docTypeSelector}>
            <View style={styles.docTypeHeader}>
              <Text style={styles.docTypeTitle}>
                {DOCUMENT_TYPE_SCHEMAS[form.documentType]?.name || 'General'}
              </Text>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.docTypeGrid}
            >
              {documentTypes.map((docType) => {
                const isSelected = form.documentType === docType.id;
                return (
                  <TouchableOpacity
                    key={docType.id}
                    style={[
                      styles.docTypeChip,
                      isSelected && styles.selectedDocTypeChip,
                    ]}
                    onPress={() => handleDocTypeSelect(docType.id as DocumentType)}
                  >
                    <Text
                      style={[
                        styles.docTypeChipText,
                        isSelected && styles.selectedDocTypeChipText,
                      ]}
                    >
                      {docType.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Content Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Content</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.content}
            onChangeText={handleContentChange}
            placeholder="Describe what you want in your PDF. Be as detailed as possible..."
            placeholderTextColor={theme.inputPlaceholder}
            multiline
            textAlignVertical="top"
            maxLength={5000}
          />
          <Text style={styles.characterCount}>
            {form.content.length}/5000 characters
          </Text>
          <Text style={styles.helpText}>
            Tip: Be specific about formatting, sections, and content you want included
          </Text>
        </View>

        {/* Suggestions */}
        {!form.content && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionTitle}>Example prompts:</Text>
            <View style={styles.docTypeGrid}>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestionPress(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Options Toggle */}
        <TouchableOpacity
          style={styles.optionsToggle}
          onPress={() => setShowOptions(!showOptions)}
        >
          <Text style={styles.optionsToggleText}>Advanced Options</Text>
          <Ionicons
            name={showOptions ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {/* Options Content */}
        {showOptions && (
          <View style={styles.optionsContent}>
            <Text style={styles.label}>Coming soon...</Text>
            <Text style={styles.helpText}>
              Advanced options for themes, layouts, and formatting will be available here
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}