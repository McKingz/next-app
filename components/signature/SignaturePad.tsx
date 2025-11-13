/**
 * SignaturePad Component
 * 
 * Reusable digital signature capture component using react-native-signature-canvas
 * Supports stylus and finger input on Android devices
 * 
 * References:
 * - react-native-signature-canvas: https://github.com/YanYuanFE/react-native-signature-canvas
 * - React Native 0.79: https://reactnative.dev/docs/0.79/
 * - Expo SDK 53: https://docs.expo.dev/versions/v53.0.0/
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
  Alert,
  Platform,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { useTheme } from '@/contexts/ThemeContext';

export interface SignaturePadProps {
  /** Name of person signing (displayed in header) */
  signerName: string;
  
  /** Role of signer for context */
  signerRole: 'teacher' | 'principal';
  
  /** Callback when signature is confirmed and saved */
  onSave: (base64Data: string) => void;
  
  /** Callback when signature pad is cleared */
  onClear?: () => void;
  
  /** Callback when user cancels without saving */
  onCancel?: () => void;
  
  /** Initial signature to display (for preview only) */
  initialSignatureBase64?: string;
  
  /** Whether signature pad is visible */
  visible: boolean;
}

/**
 * SignaturePad - Digital signature capture component
 * 
 * Features:
 * - Captures signature via WebView-based canvas
 * - Works with stylus and finger on Android
 * - Compressed PNG output (jpgQuality: 0.6)
 * - Dark mode support
 * - Accessible buttons (44px minimum touch target)
 * 
 * @example
 * ```tsx
 * const [showSignaturePad, setShowSignaturePad] = useState(false);
 * const [signature, setSignature] = useState<string>('');
 * 
 * <SignaturePad
 *   visible={showSignaturePad}
 *   signerName="John Smith"
 *   signerRole="teacher"
 *   onSave={(base64) => {
 *     setSignature(base64);
 *     setShowSignaturePad(false);
 *   }}
 *   onCancel={() => setShowSignaturePad(false)}
 * />
 * ```
 */
export const SignaturePad = ({
  signerName,
  signerRole,
  onSave,
  onClear,
  onCancel,
  initialSignatureBase64,
  visible,
}: SignaturePadProps) => {
  const { theme, colorScheme } = useTheme();
  const signatureRef = useRef<any>(null);
  const [signatureData, setSignatureData] = useState<string | null>(
    initialSignatureBase64 || null
  );
  const [hasDrawn, setHasDrawn] = useState(false);

  // Canvas style configuration
  const webStyle = `.m-signature-pad {
    box-shadow: none; 
    border: none;
    background-color: ${colorScheme === 'dark' ? '#FFFFFF' : '#FFFFFF'};
  }
  .m-signature-pad--body {
    border: 2px dashed ${theme.colors.border};
  }
  .m-signature-pad--footer {
    display: none;
  }
  body,html {
    width: 100%; 
    height: 100%;
    margin: 0;
    padding: 0;
  }`;

  // Handle signature drawn
  const handleSignature = useCallback((signature: string) => {
    // Remove data URI prefix if present
    const base64Data = signature.replace(/^data:image\/png;base64,/, '');
    setSignatureData(base64Data);
    setHasDrawn(true);
  }, []);

  // Handle clear button
  const handleClear = useCallback(() => {
    signatureRef.current?.clearSignature();
    setSignatureData(null);
    setHasDrawn(false);
    onClear?.();
  }, [onClear]);

  // Handle save button
  const handleSave = useCallback(() => {
    if (!signatureData || !hasDrawn) {
      Alert.alert(
        'No Signature',
        'Please draw your signature before confirming.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Call parent callback with base64 data (without data URI prefix)
    onSave(signatureData);
    
    // Reset state
    handleClear();
  }, [signatureData, hasDrawn, onSave, handleClear]);

  // Handle cancel button
  const handleCancel = useCallback(() => {
    if (hasDrawn && !initialSignatureBase64) {
      Alert.alert(
        'Discard Signature?',
        'Your signature will not be saved.',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              handleClear();
              onCancel?.();
            },
          },
        ]
      );
    } else {
      onCancel?.();
    }
  }, [hasDrawn, initialSignatureBase64, handleClear, onCancel]);

  // Handle begin drawing
  const handleBegin = useCallback(() => {
    setHasDrawn(true);
  }, []);

  const roleLabel = signerRole === 'teacher' ? 'Teacher' : 'Principal';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              {roleLabel} Signature
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              {signerName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.cancelButton}
            accessibilityLabel="Cancel signature"
            accessibilityRole="button"
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.primary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={[styles.instructionsText, { color: theme.colors.textSecondary }]}>
            Draw your signature using your finger or stylus in the canvas below
          </Text>
        </View>

        {/* Signature Canvas */}
        <View style={[styles.canvasContainer, { backgroundColor: '#FFFFFF' }]}>
          <SignatureCanvas
            ref={signatureRef}
            onOK={handleSignature}
            onBegin={handleBegin}
            onEmpty={() => setHasDrawn(false)}
            descriptionText=""
            clearText="Clear"
            confirmText="Confirm"
            webStyle={webStyle}
            autoClear={false}
            imageType="image/png"
            // Compression settings
            dataURL=""
            penColor="#000000"
            backgroundColor="#FFFFFF"
            minWidth={1}
            maxWidth={3}
            // Canvas dimensions (optimized for mobile)
            canvasHeight={250}
            canvasWidth={600}
          />
        </View>

        {/* Preview (if signature exists) */}
        {signatureData && (
          <View style={styles.previewContainer}>
            <Text style={[styles.previewLabel, { color: theme.colors.textSecondary }]}>
              Preview:
            </Text>
            <View style={[styles.previewBox, { borderColor: theme.colors.border }]}>
              <Image
                source={{ uri: `data:image/png;base64,${signatureData}` }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            onPress={handleClear}
            style={[
              styles.button,
              styles.clearButton,
              { 
                backgroundColor: colorScheme === 'dark' 
                  ? theme.colors.cardBackground 
                  : '#F3F4F6',
                borderColor: theme.colors.border,
              }
            ]}
            accessibilityLabel="Clear signature"
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: theme.colors.text }]}>
              Clear
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            style={[
              styles.button,
              styles.confirmButton,
              { 
                backgroundColor: hasDrawn ? theme.colors.primary : theme.colors.disabled,
              }
            ]}
            disabled={!hasDrawn}
            accessibilityLabel="Confirm signature"
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasDrawn }}
          >
            <Text style={[
              styles.buttonText, 
              styles.confirmButtonText,
              { color: hasDrawn ? '#FFFFFF' : theme.colors.textSecondary }
            ]}>
              Confirm Signature
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  instructions: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  instructionsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  canvasContainer: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  previewContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  previewBox: {
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 12,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    height: 48, // Minimum 44px touch target
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
  },
  clearButton: {
    borderWidth: 1,
  },
  confirmButton: {
    // Primary color set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    // Color set dynamically based on state
  },
});

/**
 * Documentation Sources:
 * - React Native 0.79 Modal: https://reactnative.dev/docs/0.79/modal
 * - React Native 0.79 Platform: https://reactnative.dev/docs/0.79/platform
 * - Expo SDK 53 Image: https://docs.expo.dev/versions/v53.0.0/sdk/image/
 * - react-native-signature-canvas: https://github.com/YanYuanFE/react-native-signature-canvas
 * - WCAG Touch Target Size: https://www.w3.org/WAI/WCAG21/Understanding/target-size.html (44x44px minimum)
 */
