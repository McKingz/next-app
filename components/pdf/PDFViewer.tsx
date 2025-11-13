/**
 * PDF Viewer Component
 * 
 * Cross-platform PDF viewing with zoom, navigation, and sharing
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface PDFViewerProps {
  uri?: string;
  filename?: string;
  onClose?: () => void;
  onShare?: () => void;
  onPrint?: () => void;
  onDownload?: () => void;
}

export function PDFViewer({
  uri,
  filename,
  onClose,
  onShare,
  onPrint,
  onDownload,
}: PDFViewerProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

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
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    closeButton: {
      padding: 8,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
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
    viewer: {
      flex: 1,
      backgroundColor: theme.surfaceVariant,
    },
    webView: {
      flex: 1,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    errorIcon: {
      marginBottom: 16,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    errorMessage: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    loadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.surfaceVariant,
    },
    loadingText: {
      fontSize: 16,
      color: theme.textSecondary,
      marginTop: 16,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
      gap: 16,
    },
    toolbarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.surfaceVariant,
    },
    toolbarButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
      marginLeft: 6,
    },
    zoomControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    zoomButton: {
      padding: 8,
      borderRadius: 6,
      backgroundColor: theme.surfaceVariant,
    },
    zoomText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      minWidth: 50,
      textAlign: 'center',
    },
  }));

  // Generate PDF viewer HTML with embedded PDF
  const viewerHtml = useMemo(() => {
    if (!uri) return null;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=${zoom}, maximum-scale=3.0, user-scalable=yes">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            html, body {
              height: 100%;
              overflow: hidden;
              background: #f5f5f5;
            }
            
            .pdf-container {
              width: 100%;
              height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 20px;
            }
            
            .pdf-embed {
              width: 100%;
              height: 100%;
              border: none;
              border-radius: 8px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              background: white;
            }
            
            .fallback {
              text-align: center;
              padding: 40px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            
            .fallback a {
              color: #0066cc;
              text-decoration: none;
              font-weight: 600;
            }
            
            @media (max-width: 768px) {
              .pdf-container {
                padding: 10px;
              }
            }
          </style>
        </head>
        <body>
          <div class="pdf-container">
            ${Platform.OS === 'web' ? 
              `<embed src="${uri}" type="application/pdf" class="pdf-embed">
               <div class="fallback">
                 <h3>PDF Preview</h3>
                 <p>If the PDF doesn't load, <a href="${uri}" target="_blank">click here to open it</a>.</p>
               </div>` :
              `<iframe src="https://docs.google.com/viewer?url=${encodeURIComponent(uri)}&embedded=true" class="pdf-embed"></iframe>`
            }
          </div>
        </body>
      </html>
    `;
  }, [uri, zoom]);

  const handleShare = useCallback(async () => {
    if (!uri) return;

    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${filename || 'PDF'}`,
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not supported on this device');
      }
    } catch (error) {
      Alert.alert('Sharing failed', 'Could not share the PDF');
    }

    onShare?.();
  }, [uri, filename, onShare]);

  const handlePrint = useCallback(async () => {
    if (!uri) return;

    try {
      if (Platform.OS === 'web') {
        // Open PDF in new tab for printing
        window.open(uri, '_blank');
      } else {
        await Print.printAsync({
          uri,
          printerUrl: undefined, // Use default printer
        });
      }
    } catch (error) {
      Alert.alert('Print failed', 'Could not print the PDF');
    }

    onPrint?.();
  }, [uri, onPrint]);

  const handleDownload = useCallback(async () => {
    if (!uri) return;

    try {
      if (Platform.OS === 'web') {
        // Create download link
        const link = document.createElement('a');
        link.href = uri;
        link.download = filename || 'document.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // On mobile, sharing is effectively downloading
        await handleShare();
        return;
      }
    } catch (error) {
      Alert.alert('Download failed', 'Could not download the PDF');
    }

    onDownload?.();
  }, [uri, filename, handleShare, onDownload]);

  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
  }, []);

  if (!uri) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <Ionicons name="document-outline" size={64} color={theme.textSecondary} />
        </View>
        <Text style={styles.errorTitle}>No PDF to Display</Text>
        <Text style={styles.errorMessage}>
          Please generate a PDF first to preview it here.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {onClose && (
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>{filename || 'PDF Document'}</Text>
          </View>
        </View>

        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={64} color={theme.error} />
          </View>
          <Text style={styles.errorTitle}>Failed to Load PDF</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {filename || 'PDF Document'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <View style={styles.zoomControls}>
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={() => handleZoom(-0.2)}
            >
              <Ionicons name="remove" size={16} color={theme.text} />
            </TouchableOpacity>
            
            <Text style={styles.zoomText}>
              {Math.round(zoom * 100)}%
            </Text>
            
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={() => handleZoom(0.2)}
            >
              <Ionicons name="add" size={16} color={theme.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerButton} onPress={handlePrint}>
            <Ionicons name="print-outline" size={18} color={theme.text} />
          </TouchableOpacity>

          {Platform.OS === 'web' && (
            <TouchableOpacity style={styles.headerButton} onPress={handleDownload}>
              <Ionicons name="download-outline" size={18} color={theme.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.viewer}>
        <WebView
          style={styles.webView}
          source={{ html: viewerHtml || '' }}
          onLoadStart={() => setLoading(true)}
          onLoad={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setLoading(false);
            setError(nativeEvent.description || 'Failed to load PDF');
          }}
          scalesPageToFit={true}
          startInLoadingState={true}
          javaScriptEnabled={true}
          domStorageEnabled={false}
          scrollEnabled={true}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={true}
          originWhitelist={['*']}
        />

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading PDF...</Text>
          </View>
        )}
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={theme.text} />
          <Text style={styles.toolbarButtonText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarButton} onPress={handlePrint}>
          <Ionicons name="print-outline" size={20} color={theme.text} />
          <Text style={styles.toolbarButtonText}>Print</Text>
        </TouchableOpacity>

        {Platform.OS === 'web' && (
          <TouchableOpacity style={styles.toolbarButton} onPress={handleDownload}>
            <Ionicons name="download-outline" size={20} color={theme.text} />
            <Text style={styles.toolbarButtonText}>Download</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}