import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { useCreatePOPUpload, CreatePOPUploadData } from '@/hooks/usePOPUploads';
import { formatFileSize } from '@/lib/popUpload';

// Payment method options
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card Payment' },
  { value: 'mobile_payment', label: 'Mobile Payment' },
  { value: 'other', label: 'Other' },
];

interface SelectedFile {
  uri: string;
  name: string;
  size?: number;
  type?: string;
}

export default function ProofOfPaymentScreen() {
  const { studentId, studentName } = useLocalSearchParams<{
    studentId: string;
    studentName: string;
  }>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const createUpload = useCreatePOPUpload();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentReference, setPaymentReference] = useState('');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  
  const styles = StyleSheet.create({
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
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    datePickerButton: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    datePickerText: {
      fontSize: 16,
      color: theme.text,
    },
    dropdown: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    dropdownButton: {
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dropdownButtonText: {
      fontSize: 16,
      color: theme.text,
    },
    dropdownList: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    dropdownItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    dropdownItemText: {
      fontSize: 16,
      color: theme.text,
    },
    fileSection: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    fileSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    fileButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    fileButton: {
      flex: 1,
      backgroundColor: theme.primary + '20',
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.primary + '40',
    },
    fileButtonText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: '500',
      marginTop: 4,
    },
    selectedFileContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: theme.elevated,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    filePreview: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 12,
      backgroundColor: theme.textSecondary + '20',
    },
    fileInfo: {
      flex: 1,
    },
    fileName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 4,
    },
    fileDetails: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    removeFileButton: {
      padding: 8,
    },
    submitButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 12,
    },
    submitButtonDisabled: {
      backgroundColor: theme.textSecondary + '40',
    },
    submitButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    errorText: {
      color: theme.error,
      fontSize: 14,
      marginTop: 4,
    },
  });
  
  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error'),
          'Camera roll permission is required to select images.'
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `payment_receipt_${Date.now()}.jpg`,
          size: asset.fileSize,
          type: asset.type || 'image/jpeg',
        });
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to select image');
    }
  };
  
  const handleDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          size: asset.size || undefined,
          type: asset.mimeType || undefined,
        });
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to select document');
    }
  };
  
  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!title.trim()) {
      errors.push('Title is required');
    }
    if (!amount.trim() || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      errors.push('Valid payment amount is required');
    }
    if (!paymentMethod) {
      errors.push('Payment method is required');
    }
    if (!selectedFile) {
      errors.push('Payment receipt file is required');
    }
    
    return errors;
  };
  
  const handleSubmit = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      Alert.alert(t('common.error'), errors.join('\n'));
      return;
    }
    
    if (!studentId || !selectedFile) return;
    
    try {
      const uploadData: CreatePOPUploadData = {
        student_id: studentId,
        upload_type: 'proof_of_payment',
        title: title.trim(),
        description: description.trim() || undefined,
        file_uri: selectedFile.uri,
        file_name: selectedFile.name,
        payment_amount: parseFloat(amount),
        payment_method: paymentMethod,
        payment_date: paymentDate.toISOString().split('T')[0], // YYYY-MM-DD format
        payment_reference: paymentReference.trim() || undefined,
      };
      
      await createUpload.mutateAsync(uploadData);
      
      Alert.alert(
        t('pop.uploadSuccess'),
        t('pop.uploadSuccessDesc'),
        [
          {
            text: t('common.ok'),
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : 'Upload failed'
      );
    }
  };
  
  const getSelectedPaymentMethodLabel = () => {
    const method = PAYMENT_METHODS.find(m => m.value === paymentMethod);
    return method ? method.label : t('pop.selectPaymentMethod');
  };
  
  return (
    <View style={styles.container}>
      <RoleBasedHeader 
        title={t('pop.uploadProofOfPayment')} 
        showBackButton
      />
      
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Student Info */}
        {studentName && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('pop.paymentFor')}: {decodeURIComponent(studentName)}
            </Text>
          </View>
        )}
        
        {/* Payment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('pop.paymentDetails')}</Text>
          
          <Text style={styles.label}>{t('pop.title')} *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('pop.titlePlaceholder')}
            placeholderTextColor={theme.textSecondary}
          />
          
          <Text style={styles.label}>{t('pop.amount')} *</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
          />
          
          <Text style={styles.label}>{t('pop.paymentMethod')} *</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowPaymentMethods(!showPaymentMethods)}
            >
              <Text style={styles.dropdownButtonText}>
                {getSelectedPaymentMethodLabel()}
              </Text>
              <Ionicons 
                name={showPaymentMethods ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={theme.textSecondary} 
              />
            </TouchableOpacity>
            {showPaymentMethods && (
              <View style={styles.dropdownList}>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setPaymentMethod(method.value);
                      setShowPaymentMethods(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{method.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          
          <Text style={styles.label}>{t('pop.paymentDate')} *</Text>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.datePickerText}>
              {paymentDate.toLocaleDateString()}
            </Text>
            <Ionicons name="calendar" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker
              value={paymentDate}
              mode="date"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setPaymentDate(selectedDate);
                }
              }}
            />
          )}
          
          <Text style={styles.label}>{t('pop.reference')}</Text>
          <TextInput
            style={styles.input}
            value={paymentReference}
            onChangeText={setPaymentReference}
            placeholder={t('pop.referencePlaceholder')}
            placeholderTextColor={theme.textSecondary}
          />
          
          <Text style={styles.label}>{t('pop.notes')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('pop.notesPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            multiline
          />
        </View>
        
        {/* File Upload */}
        <View style={styles.fileSection}>
          <Text style={styles.fileSectionTitle}>{t('pop.uploadReceipt')} *</Text>
          
          {!selectedFile ? (
            <View style={styles.fileButtons}>
              <TouchableOpacity style={styles.fileButton} onPress={handleImagePicker}>
                <Ionicons name="camera" size={24} color={theme.primary} />
                <Text style={styles.fileButtonText}>{t('pop.takePhoto')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.fileButton} onPress={handleDocumentPicker}>
                <Ionicons name="document" size={24} color={theme.primary} />
                <Text style={styles.fileButtonText}>{t('pop.selectFile')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.selectedFileContainer}>
              {selectedFile.type?.startsWith('image/') ? (
                <Image source={{ uri: selectedFile.uri }} style={styles.filePreview} />
              ) : (
                <View style={[styles.filePreview, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="document-text" size={24} color={theme.textSecondary} />
                </View>
              )}
              
              <View style={styles.fileInfo}>
                <Text style={styles.fileName}>{selectedFile.name}</Text>
                <Text style={styles.fileDetails}>
                  {selectedFile.size ? formatFileSize(selectedFile.size) : 'Unknown size'}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={styles.removeFileButton}
                onPress={() => setSelectedFile(null)}
              >
                <Ionicons name="close-circle" size={24} color={theme.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (createUpload.isPending || validateForm().length > 0) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={createUpload.isPending || validateForm().length > 0}
        >
          {createUpload.isPending ? (
            <ActivityIndicator size="small" color={theme.onPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>{t('pop.uploadPaymentProof')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}