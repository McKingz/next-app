/**
 * PDF Generator Screen
 * 
 * Main interface for generating PDFs with three modes:
 * - Prompt-based: Natural language input
 * - Template-based: Pre-built templates  
 * - Structured: Form-based document creation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';

// Hooks and context
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles, themedStyles } from '@/hooks/useThemedStyles';

// Services and types
import { getDashPDFAdapter, type PDFProgressEvent } from '@/services/pdf/dashPdfAdapter';
import type { PDFTab, DocumentType, PreviewState } from '@/types/pdf';
import { PDF_THEMES } from '@/types/pdf';

// Components (to be created)
import { PDFTabBar } from '@/components/pdf/PDFTabBar';
import { PDFActionBar } from '@/components/pdf/PDFActionBar';
import { PDFNotificationBanner } from '@/components/pdf/PDFNotificationBanner';
import { GenerationProgress } from '@/components/pdf/GenerationProgress';
import { PDFPreviewPanel } from '@/components/pdf/PDFPreviewPanel';
import { PDFViewer } from '@/components/pdf/PDFViewer';

// Tab components (to be created)
import { PromptTab } from '@/components/pdf/tabs/PromptTab';
import { TemplateTab } from '@/components/pdf/tabs/TemplateTab';
import { StructuredTab } from '@/components/pdf/tabs/StructuredTab';

interface PDFGeneratorScreenProps {
  // Navigation params
  initialTab?: 'prompt' | 'template' | 'structured';
  templateId?: string;
  documentType?: DocumentType;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isDesktop = screenWidth >= 1024;

const PDF_TABS: PDFTab[] = [
  {
    id: 'prompt',
    title: 'Prompt',
    icon: 'chatbubble-ellipses-outline',
    description: 'Generate PDFs from natural language descriptions',
  },
  {
    id: 'template',
    title: 'Template',
    icon: 'library-outline',
    description: 'Use pre-built templates with customizable fields',
  },
  {
    id: 'structured',
    title: 'Structured',
    icon: 'document-text-outline',
    description: 'Create documents using structured forms',
  },
];

export default function PDFGeneratorScreen() {
  const { theme, isDark } = useTheme();
  const searchParams = useLocalSearchParams();
  const pdfAdapter = getDashPDFAdapter();

  // Screen state
  const [activeTab, setActiveTab] = useState<'prompt' | 'template' | 'structured'>(
    (searchParams.initialTab as any) || 'prompt'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<PDFProgressEvent | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState(!isTablet);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    dismissible: boolean;
    timeout?: number;
  }>>([]);
  
  // PDF viewer state
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [generatedPdfUri, setGeneratedPdfUri] = useState<string | null>(null);
  const [generatedFilename, setGeneratedFilename] = useState<string | null>(null);

  // Preview state
  const [preview, setPreview] = useState<PreviewState>({
    isLoading: false,
    html: undefined,
    error: undefined,
    lastUpdated: undefined,
    settings: {
      paperSize: 'A4',
      orientation: 'portrait',
      theme: 'professional',
      showMargins: false,
      showPageBreaks: true,
      zoom: 1,
    },
  });

  // Form states for each tab
  const [promptForm, setPromptForm] = useState({
    content: '',
    documentType: 'general' as DocumentType,
    title: '',
    options: {},
  });

  const [templateForm, setTemplateForm] = useState({
    selectedTemplate: null,
    formData: {},
    validation: {},
  });

  const [structuredForm, setStructuredForm] = useState({
    documentType: 'general' as DocumentType,
    formData: {},
    validation: {},
  });

  // Reactive state from adapter
  useEffect(() => {
    const subscription = pdfAdapter.state$.subscribe(state => {
      // Handle progress updates
      if (state.currentProgress) {
        setCurrentProgress(state.currentProgress);
        setIsGenerating(state.currentProgress.status === 'running');
      }
    });

    return () => subscription.unsubscribe();
  }, [pdfAdapter]);

  // Initialize from navigation params
  useEffect(() => {
    if (searchParams.templateId) {
      setActiveTab('template');
      // Load specific template
    }
    
    if (searchParams.documentType) {
      setStructuredForm(prev => ({
        ...prev,
        documentType: searchParams.documentType as DocumentType,
      }));
      if (searchParams.initialTab !== 'template') {
        setActiveTab('structured');
      }
    }
  }, [searchParams]);

  // Computed styles based on layout
  const styles = useThemedStyles((theme, isDark) => ({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
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
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.surfaceVariant,
    },
    content: {
      flex: 1,
      flexDirection: isTablet ? 'row' : 'column',
    },
    sidebar: {
      width: isTablet ? (isDesktop ? 400 : 350) : '100%',
      backgroundColor: theme.surface,
      borderRightWidth: isTablet ? 1 : 0,
      borderRightColor: theme.borderLight,
    },
    previewArea: {
      flex: 1,
      backgroundColor: theme.surfaceVariant,
      display: previewCollapsed ? 'none' : 'flex',
    },
    tabContent: {
      flex: 1,
    },
    loadingOverlay: {
      ...Platform.select({
        web: {
          position: 'fixed' as any,
        },
        default: {
          position: 'absolute' as any,
        },
      }),
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
  }));

  // Action handlers
  const handleTabChange = useCallback((tabId: 'prompt' | 'template' | 'structured') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveTab(tabId);
    
    // Clear any validation errors when switching tabs
    setNotifications(prev => prev.filter(n => n.type !== 'error'));
  }, []);

  const handlePreviewToggle = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setPreviewCollapsed(!previewCollapsed);
  }, [previewCollapsed]);

  const handleSettingsToggle = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSettingsVisible(!settingsVisible);
  }, [settingsVisible]);

  const handleGeneratePreview = useCallback(async () => {
    try {
      setPreview(prev => ({ ...prev, isLoading: true, error: undefined }));
      
      // Build request based on active tab
      let request;
      switch (activeTab) {
        case 'prompt':
          if (!promptForm.content.trim()) {
            throw new Error('Please enter some content to preview');
          }
          request = {
            type: promptForm.documentType,
            title: promptForm.title || 'Preview Document',
            prompt: promptForm.content,
          };
          break;
          
        case 'template':
          if (!templateForm.selectedTemplate) {
            throw new Error('Please select a template first');
          }
          request = {
            type: templateForm.selectedTemplate.documentType,
            title: (templateForm.formData as any).title || templateForm.selectedTemplate.name,
            templateId: templateForm.selectedTemplate.id,
            data: templateForm.formData,
          };
          break;
          
        case 'structured':
          request = {
            type: structuredForm.documentType,
            title: (structuredForm.formData as any).title || 'Structured Document',
            sections: [{
              id: 'main',
              title: 'Content',
              markdown: JSON.stringify(structuredForm.formData, null, 2),
            }],
          };
          break;
      }

      const result = await pdfAdapter.generatePreview(request);
      
      setPreview(prev => ({
        ...prev,
        isLoading: false,
        html: result.html,
        lastUpdated: new Date().toISOString(),
      }));

      if (result.warnings.length > 0) {
        addNotification({
          type: 'warning',
          message: `Preview generated with ${result.warnings.length} warning(s)`,
          dismissible: true,
          timeout: 5000,
        });
      }
      
    } catch (error) {
      setPreview(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to generate preview',
      }));
      
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate preview',
        dismissible: true,
        timeout: 10000,
      });
    }
  }, [activeTab, promptForm, templateForm, structuredForm, pdfAdapter]);

  const handleGeneratePDF = useCallback(async () => {
    try {
      setIsGenerating(true);
      
      let observable;
      switch (activeTab) {
        case 'prompt':
          if (!promptForm.content.trim()) {
            throw new Error('Please enter some content to generate PDF');
          }
          observable = pdfAdapter.generateFromPrompt(promptForm.content);
          break;
          
        case 'template':
          if (!templateForm.selectedTemplate) {
            throw new Error('Please select a template first');
          }
          observable = pdfAdapter.generateFromTemplate(
            templateForm.selectedTemplate.id,
            templateForm.formData
          );
          break;
          
        case 'structured':
          // This would use generateFromStructuredData when implemented
          observable = pdfAdapter.generateFromPrompt(
            JSON.stringify(structuredForm.formData, null, 2)
          );
          break;
      }

      observable.subscribe({
        next: (progress) => {
          setCurrentProgress(progress);
        },
        complete: () => {
          setIsGenerating(false);
          setCurrentProgress(null);
          
          // Get the generated PDF from the adapter
          const state = pdfAdapter.getState();
          if (state.currentJob?.status === 'completed' && state.currentJob?.result?.uri) {
            setGeneratedPdfUri(state.currentJob.result.uri);
            setGeneratedFilename(state.currentJob.result.filename || 'document.pdf');
            setShowPDFViewer(true);
          }
          
          addNotification({
            type: 'success',
            message: 'PDF generated successfully!',
            dismissible: true,
            timeout: 5000,
          });
        },
        error: (error) => {
          setIsGenerating(false);
          addNotification({
            type: 'error',
            message: error.message || 'Failed to generate PDF',
            dismissible: true,
            timeout: 10000,
          });
        },
      });
      
    } catch (error) {
      setIsGenerating(false);
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to start PDF generation',
        dismissible: true,
        timeout: 10000,
      });
    }
  }, [activeTab, promptForm, templateForm, structuredForm, pdfAdapter]);

  const addNotification = useCallback((notification: Omit<typeof notifications[0], 'id'>) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { ...notification, id }]);
    
    if (notification.timeout) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, notification.timeout);
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // PDF viewer handlers
  const handleClosePDFViewer = useCallback(() => {
    setShowPDFViewer(false);
    setGeneratedPdfUri(null);
    setGeneratedFilename(null);
  }, []);

  const handleSharePDF = useCallback(() => {
    addNotification({
      type: 'info',
      message: 'PDF shared successfully',
      dismissible: true,
      timeout: 3000,
    });
  }, []);

  const handlePrintPDF = useCallback(() => {
    addNotification({
      type: 'info',
      message: 'PDF sent to printer',
      dismissible: true,
      timeout: 3000,
    });
  }, []);

  const handleDownloadPDF = useCallback(() => {
    addNotification({
      type: 'info',
      message: 'PDF downloaded successfully',
      dismissible: true,
      timeout: 3000,
    });
  }, []);

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'prompt':
        return (
          <PromptTab
            form={promptForm}
            onChange={setPromptForm}
            onPreview={handleGeneratePreview}
            isGenerating={isGenerating}
          />
        );
      case 'template':
        return (
          <TemplateTab
            form={templateForm}
            onChange={setTemplateForm}
            onPreview={handleGeneratePreview}
            isGenerating={isGenerating}
          />
        );
      case 'structured':
        return (
          <StructuredTab
            form={structuredForm}
            onChange={setStructuredForm}
            onPreview={handleGeneratePreview}
            isGenerating={isGenerating}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={theme.surface} />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>PDF Generator</Text>
          <Text style={styles.headerSubtitle}>
            Create professional documents with AI
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handlePreviewToggle}
            accessibilityLabel={previewCollapsed ? 'Show preview' : 'Hide preview'}
          >
            <Ionicons 
              name={previewCollapsed ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={theme.text}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleSettingsToggle}
            accessibilityLabel="PDF Settings"
          >
            <Ionicons 
              name="settings-outline"
              size={20}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications */}
      {notifications.map(notification => (
        <PDFNotificationBanner
          key={notification.id}
          {...notification}
          onDismiss={() => dismissNotification(notification.id)}
        />
      ))}

      {/* Main Content */}
      <View style={styles.content}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          {/* Tab Bar */}
          <PDFTabBar
            tabs={PDF_TABS}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
          
          {/* Tab Content */}
          <View style={styles.tabContent}>
            {renderTabContent()}
          </View>
        </View>

        {/* Preview Panel */}
        {!previewCollapsed && (
          <View style={styles.previewArea}>
            <PDFPreviewPanel
              preview={preview}
              onSettingsChange={(settings) => 
                setPreview(prev => ({ ...prev, settings: { ...prev.settings, ...settings } }))
              }
              onContentChange={(newHtml) => {
                setPreview(prev => ({ ...prev, html: newHtml, lastUpdated: new Date().toISOString() }));
                console.log('[PDF Preview] Content edited by user');
              }}
            />
          </View>
        )}
      </View>

      {/* Action Bar */}
      <PDFActionBar
        onPreview={handleGeneratePreview}
        onGenerate={handleGeneratePDF}
        isGenerating={isGenerating}
        canPreview={activeTab === 'prompt' ? !!promptForm.content : true}
        canGenerate={activeTab === 'prompt' ? !!promptForm.content : true}
        hasPreview={!!preview.html && !preview.error}
        previewError={preview.error}
      />

      {/* Generation Progress Overlay */}
      {isGenerating && currentProgress && (
        <View style={styles.loadingOverlay}>
          <GenerationProgress
            progress={currentProgress}
            onCancel={() => {
              // Cancel generation
              setIsGenerating(false);
              setCurrentProgress(null);
            }}
          />
        </View>
      )}

      {/* PDF Viewer Modal */}
      {showPDFViewer && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.background,
          zIndex: 2000,
        }}>
          <PDFViewer
            uri={generatedPdfUri}
            filename={generatedFilename}
            onClose={handleClosePDFViewer}
            onShare={handleSharePDF}
            onPrint={handlePrintPDF}
            onDownload={handleDownloadPDF}
          />
        </View>
      )}
    </SafeAreaView>
  );
}