/**
 * PDF Preview Panel Component
 * 
 * Real-time HTML preview with cross-platform WebView/iframe
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import type { PreviewState } from '@/types/pdf';

interface PDFPreviewPanelProps {
  preview: PreviewState;
  onSettingsChange?: (settings: Partial<PreviewState['settings']>) => void;
  onContentChange?: (newHtml: string) => void;
}

export function PDFPreviewPanel({ preview, onSettingsChange, onContentChange }: PDFPreviewPanelProps) {
  const { theme, isDark } = useTheme();
  const [isEditMode, setIsEditMode] = React.useState(false);

  const styles = useThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerButton: {
      padding: 8,
      borderRadius: 6,
      backgroundColor: theme.surfaceVariant,
    },
    previewContent: {
      flex: 1,
      backgroundColor: theme.surfaceVariant,
    },
    webViewContainer: {
      flex: 1,
      margin: 16,
      borderRadius: 12,
      backgroundColor: 'white',
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    webView: {
      flex: 1,
    },
    placeholderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      margin: 16,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.borderLight,
      borderStyle: 'dashed',
    },
    placeholderIcon: {
      marginBottom: 16,
      opacity: 0.5,
    },
    placeholderTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 8,
    },
    placeholderMessage: {
      fontSize: 14,
      color: theme.textTertiary,
      textAlign: 'center',
      maxWidth: 300,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      backgroundColor: theme.surface,
      margin: 16,
      borderRadius: 12,
    },
    errorIcon: {
      marginBottom: 16,
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.error,
      marginBottom: 8,
    },
    errorMessage: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.surface,
      margin: 16,
      borderRadius: 12,
    },
    loadingText: {
      fontSize: 16,
      color: theme.textSecondary,
      marginTop: 16,
    },
  }));

  // Generate styled HTML with theme integration
  const styledHtml = useMemo(() => {
    if (!preview.html) return null;

    const paperSize = preview.settings.paperSize === 'A4' 
      ? { width: '210mm', height: '297mm' } 
      : { width: '8.5in', height: '11in' };

    const css = `
      <style>
        * {
          box-sizing: border-box;
        }
        
        html, body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: white;
        }
        
        .pdf-container {
          width: ${paperSize.width};
          min-height: ${paperSize.height};
          margin: 20px auto;
          padding: 40px;
          background: white;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          transform: scale(${preview.settings.zoom});
          transform-origin: center top;
          ${isEditMode ? 'outline: 2px dashed #4CAF50; cursor: text;' : ''}
        }
        
        ${preview.settings.showMargins ? `
          .pdf-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border: 1px dashed #ccc;
            margin: 40px;
            pointer-events: none;
          }
        ` : ''}
        
        ${preview.settings.showPageBreaks ? `
          .page-break {
            height: 1px;
            background: linear-gradient(to right, #ddd 50%, transparent 50%);
            background-size: 20px 1px;
            margin: 20px 0;
            position: relative;
          }
          
          .page-break::after {
            content: 'Page Break';
            position: absolute;
            right: 0;
            top: -10px;
            font-size: 10px;
            color: #999;
            background: white;
            padding: 0 5px;
          }
        ` : ''}
        
        @media print {
          .pdf-container {
            box-shadow: none;
            margin: 0;
            transform: none;
          }
        }
      </style>
    `;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${css}
        </head>
        <body>
          <div class="pdf-container" ${isEditMode ? 'contenteditable="true"' : ''}>
            ${preview.html}
          </div>
          ${isEditMode ? `
          <script>
            const container = document.querySelector('.pdf-container');
            let timeout = null;
            container.addEventListener('input', function() {
              clearTimeout(timeout);
              timeout = setTimeout(() => {
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'contentChange',
                  html: container.innerHTML
                }));
              }, 500);
            });
          </script>
          ` : ''}
        </body>
      </html>
    `;
  }, [preview.html, preview.settings, isEditMode]);

  const handleZoom = useCallback((delta: number) => {
    const newZoom = Math.max(0.5, Math.min(2, preview.settings.zoom + delta));
    onSettingsChange?.({ zoom: newZoom });
  }, [preview.settings.zoom, onSettingsChange]);

  const toggleSetting = useCallback((key: keyof PreviewState['settings']) => {
    onSettingsChange?.({ 
      [key]: !preview.settings[key] 
    } as Partial<PreviewState['settings']>);
  }, [preview.settings, onSettingsChange]);

  const renderContent = () => {
    if (preview.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Ionicons 
            name="refresh-outline" 
            size={32} 
            color={theme.textSecondary}
            style={{ opacity: 0.7 }}
          />
          <Text style={styles.loadingText}>Generating preview...</Text>
        </View>
      );
    }

    if (preview.error) {
      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Ionicons 
              name="alert-circle-outline" 
              size={48} 
              color={theme.error} 
            />
          </View>
          <Text style={styles.errorTitle}>Preview Error</Text>
          <Text style={styles.errorMessage}>{preview.error}</Text>
        </View>
      );
    }

    if (!preview.html) {
      return (
        <View style={styles.placeholderContainer}>
          <View style={styles.placeholderIcon}>
            <Ionicons 
              name="document-outline" 
              size={64} 
              color={theme.textSecondary}
            />
          </View>
          <Text style={styles.placeholderTitle}>No Preview Available</Text>
          <Text style={styles.placeholderMessage}>
            Generate a preview to see how your PDF will look
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.webViewContainer}>
        <WebView
          style={styles.webView}
          source={{ html: styledHtml || '' }}
          scalesPageToFit={false}
          scrollEnabled={true}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={false}
          originWhitelist={['*']}
          javaScriptEnabled={isEditMode}
          domStorageEnabled={isEditMode}
          startInLoadingState={true}
          onMessage={(event) => {
            if (isEditMode && onContentChange) {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'contentChange') {
                  onContentChange(data.html);
                }
              } catch (e) {
                console.warn('Failed to parse WebView message:', e);
              }
            }
          }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Preview</Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => handleZoom(-0.1)}
            accessibilityLabel="Zoom out"
          >
            <Ionicons name="remove" size={16} color={theme.text} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => handleZoom(0.1)}
            accessibilityLabel="Zoom in"
          >
            <Ionicons name="add" size={16} color={theme.text} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.headerButton,
              preview.settings.showMargins && { backgroundColor: theme.primary }
            ]}
            onPress={() => toggleSetting('showMargins')}
            accessibilityLabel="Toggle margins"
          >
            <Ionicons 
              name="square-outline" 
              size={16} 
              color={preview.settings.showMargins ? theme.onPrimary : theme.text} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.headerButton,
              isEditMode && { backgroundColor: theme.primary }
            ]}
            onPress={() => setIsEditMode(!isEditMode)}
            accessibilityLabel="Toggle edit mode"
          >
            <Ionicons 
              name={isEditMode ? "create" : "create-outline"} 
              size={16} 
              color={isEditMode ? theme.onPrimary : theme.text} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.previewContent}>
        {renderContent()}
      </View>
    </View>
  );
}