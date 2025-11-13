/**
 * Template Tab Component (Basic Stub)
 * 
 * Template-based PDF generation interface
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface TemplateTabProps {
  form: {
    selectedTemplate: any;
    formData: Record<string, any>;
    validation: Record<string, string>;
  };
  onChange: (form: any) => void;
  onPreview: () => void;
  isGenerating: boolean;
}

export function TemplateTab({ form, onChange, onPreview, isGenerating }: TemplateTabProps) {
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
            name="library-outline"
            size={80}
            color={theme.textSecondary}
          />
        </View>
        
        <Text style={styles.title}>Template Gallery</Text>
        
        <Text style={styles.message}>
          Choose from pre-built templates with customizable fields. 
          Template gallery coming soon!
        </Text>
      </View>
    </View>
  );
}