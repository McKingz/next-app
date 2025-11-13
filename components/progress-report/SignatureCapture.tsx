import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface SignatureCaptureProps {
  onSave: (signature: string) => void;
  currentSignature?: string;
  label?: string;
  required?: boolean;
}

export const SignatureCapture: React.FC<SignatureCaptureProps> = ({
  onSave,
  currentSignature,
  label = 'Signature',
  required = false,
}) => {
  const { theme } = useTheme();
  const signatureRef = useRef<any>(null);

  const handleSignature = (signature: string) => {
    onSave(signature);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    onSave('');
  };

  const handleEnd = () => {
    signatureRef.current?.readSignature();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.text }]}>
          {label}{required && ' *'}
        </Text>
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Ionicons name="trash-outline" size={20} color={theme.error} />
          <Text style={[styles.clearText, { color: theme.error }]}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View 
        style={[styles.signatureContainer, { borderColor: theme.border }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        <SignatureCanvas
          ref={signatureRef}
          onOK={handleSignature}
          onEnd={handleEnd}
          descriptionText=""
          clearText="Clear"
          confirmText="Save"
          webStyle={`
            .m-signature-pad {
              box-shadow: none;
              border: none;
            }
            .m-signature-pad--body {
              border: none;
            }
            .m-signature-pad--footer {
              display: none;
            }
            body, html {
              width: 100%;
              height: 100%;
            }
          `}
          backgroundColor={theme.background}
          penColor={theme.text}
          minWidth={1}
          maxWidth={3}
        />
      </View>

      {currentSignature && (
        <View style={styles.signedIndicator}>
          <Ionicons name="checkmark-circle" size={16} color="#059669" />
          <Text style={[styles.signedText, { color: '#059669' }]}>Signed</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signatureContainer: {
    height: 200,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  signedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  signedText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
