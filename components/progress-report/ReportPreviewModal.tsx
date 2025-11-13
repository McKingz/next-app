import React from 'react';
import { Modal, View, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface ReportPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  html: string;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({ visible, onClose, html }) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.previewTitle, { color: theme.text }]}>Report Preview</Text>
          <View style={{ width: 28 }} />
        </View>
        <WebView
          originWhitelist={['*']}
          source={{
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
                <style>
                  * {
                    box-sizing: border-box;
                  }
                  html, body {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: auto;
                    overflow-x: hidden;
                    -webkit-text-size-adjust: 100%;
                  }
                  body {
                    padding: 16px;
                  }
                </style>
              </head>
              <body>
                ${html}
              </body>
              </html>
            `,
            baseUrl: '',
          }}
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
          scalesPageToFit={true}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          mixedContentMode="always"
          allowFileAccess={true}
          nestedScrollEnabled={true}
          automaticallyAdjustContentInsets={false}
          bounces={true}
          renderLoading={() => (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});
