/**
 * Structured Tab Component (Basic Stub)
 * 
 * Form-based document creation interface
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import type { DocumentType } from '@/types/pdf';

interface StructuredTabProps {
  form: {
    documentType: DocumentType;
    formData: Record<string, any>;
    validation: Record<string, string>;
  };
  onChange: (form: any) => void;
  onPreview: () => void;
  isGenerating: boolean;
}

export function StructuredTab({ form, onChange, onPreview, isGenerating }: StructuredTabProps) {
  const { theme } = useTheme();

  const styles = useThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    icon: {
      marginBottom: 24,
      opacity: 0.5,
    },
    title: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    message: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 300,
    },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.icon}>
          <Ionicons
            name="document-text-outline"
            size={80}
            color={theme.textSecondary}
          />
        </View>
        
        <Text style={styles.title}>Structured Forms</Text>
        
        <Text style={styles.message}>
          Create documents using guided forms based on document type. 
          Dynamic forms coming soon!
        </Text>
      </View>
    </View>
  );
}