import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, Platform, Alert } from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';

interface SignatureModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signature: string) => void;
  title?: string;
  currentSignature?: string;
}

const SIGNATURE_STORAGE_KEY = 'teacher_signature_';

export const SignatureModal: React.FC<SignatureModalProps> = ({
  visible,
  onClose,
  onSave,
  title = 'Sign Here',
  currentSignature,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const signatureRef = useRef<any>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const { width, height } = Dimensions.get('window');

  // Load saved signature from AsyncStorage when modal opens
  useEffect(() => {
    if (visible && user?.id) {
      loadSavedSignature();
    }
  }, [visible, user?.id]);

  const loadSavedSignature = async () => {
    if (!user?.id) {
      console.log('[SignatureModal] No user ID, skipping saved signature load');
      setLoadingSaved(false);
      return;
    }
    
    try {
      setLoadingSaved(true);
      const key = `${SIGNATURE_STORAGE_KEY}${user.id}`;
      const saved = await AsyncStorage.getItem(key);
      console.log('[SignatureModal] Loaded saved signature:', saved ? 'Yes (length: ' + saved.length + ')' : 'No');
      setSavedSignature(saved);
    } catch (error) {
      console.error('[SignatureModal] Error loading saved signature:', error);
    } finally {
      setLoadingSaved(false);
    }
  };

  const saveSignatureToStorage = async (signature: string) => {
    if (!user?.id) {
      console.log('[SignatureModal] No user ID, skipping signature save');
      return;
    }
    
    try {
      const key = `${SIGNATURE_STORAGE_KEY}${user.id}`;
      await AsyncStorage.setItem(key, signature);
      console.log('[SignatureModal] Saved signature to AsyncStorage for user:', user.id);
      setSavedSignature(signature);
    } catch (error) {
      console.error('[SignatureModal] Error saving signature:', error);
    }
  };

  const handleSignature = (signature: string) => {
    // Save to parent component
    onSave(signature);
    // Save to AsyncStorage for reuse
    saveSignatureToStorage(signature);
    // Close modal
    onClose();
    setHasDrawn(false);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setHasDrawn(false);
  };

  const handleDone = () => {
    if (hasDrawn) {
      // Only read signature when Done is pressed
      signatureRef.current?.readSignature();
    } else {
      // No signature drawn, just close
      onClose();
    }
  };

  const handleUseSaved = () => {
    if (savedSignature) {
      Alert.alert(
        'Use Saved Signature',
        'Do you want to use your previously saved signature?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Use Saved',
            onPress: () => {
              onSave(savedSignature);
              onClose();
            },
          },
        ]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView 
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top', 'bottom']}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Sign with your finger or stylus
              </Text>
            </View>
          </View>
        </View>

        {/* Signature Canvas */}
        <View style={styles.canvasContainer}>
          <View 
            style={[styles.canvas, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}
            pointerEvents="box-none"
          >
            <SignatureCanvas
              ref={signatureRef}
              onOK={handleSignature}
              onBegin={() => setHasDrawn(true)}
              descriptionText=""
              clearText="Clear"
              confirmText="Save"
              webStyle={`
                * {
                  -webkit-user-select: none;
                  -webkit-touch-callout: none;
                }
                .m-signature-pad {
                  box-shadow: none;
                  border: none;
                  margin: 0;
                  padding: 0;
                  position: relative;
                }
                .m-signature-pad--body {
                  border: none;
                  margin: 0;
                  padding: 0;
                }
                .m-signature-pad--footer {
                  display: none;
                }
                body, html {
                  width: 100%;
                  height: 100%;
                  margin: 0;
                  padding: 0;
                  overflow: hidden;
                  position: fixed;
                }
                canvas {
                  width: 100% !important;
                  height: 100% !important;
                  display: block;
                  touch-action: none;
                  cursor: crosshair;
                }
              `}
              backgroundColor="#FFFFFF"
              penColor="#000000"
              minWidth={1.5}
              maxWidth={4}
            />
          </View>

          {/* Guide text & Use Saved Button */}
          <View style={styles.guideContainer}>
            <Ionicons name="hand-left-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.guideText, { color: theme.textSecondary }]}>
              {Platform.OS === 'ios' ? 'Use your finger or Apple Pencil to sign' : 'Use your finger or stylus to sign'}
            </Text>
          </View>

          {/* Use Saved Signature Button */}
          {!loadingSaved && savedSignature && (
            <TouchableOpacity 
              style={[styles.useSavedButton, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}
              onPress={handleUseSaved}
              activeOpacity={0.7}
            >
              <Ionicons name="bookmark" size={18} color={theme.primary} />
              <Text style={[styles.useSavedText, { color: theme.primary }]}>Use My Saved Signature</Text>
            </TouchableOpacity>
          )}
          
          {/* First-time hint */}
          {!loadingSaved && !savedSignature && (
            <View style={styles.hintContainer}>
              <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                Your signature will be saved for future use
              </Text>
            </View>
          )}

          {/* Rotate hint for portrait mode */}
          {height > width && (
            <View style={styles.rotateHint}>
              <Ionicons name="phone-landscape-outline" size={24} color={theme.primary} />
              <Text style={[styles.rotateText, { color: theme.primary }]}>
                Rotate your device for easier signing
              </Text>
            </View>
          )}
        </View>

        {/* Footer Actions */}
        <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TouchableOpacity 
            style={[styles.clearButton, { backgroundColor: theme.error + '15', borderColor: theme.error }]}
            onPress={handleClear}
          >
            <Ionicons name="trash-outline" size={20} color={theme.error} />
            <Text style={[styles.clearButtonText, { color: theme.error }]}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.doneButton, { backgroundColor: hasDrawn ? theme.primary : theme.surface, borderColor: theme.border }]}
            onPress={handleDone}
          >
            <Ionicons 
              name="checkmark-circle" 
              size={20} 
              color={hasDrawn ? '#FFFFFF' : theme.textSecondary} 
            />
            <Text style={[styles.doneButtonText, { color: hasDrawn ? '#FFFFFF' : theme.textSecondary }]}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  canvasContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  canvas: {
    width: '100%',
    height: '70%',
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  guideContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  guideText: {
    fontSize: 14,
  },
  useSavedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  useSavedText: {
    fontSize: 15,
    fontWeight: '600',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
  },
  rotateHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  rotateText: {
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
