import React, { useState, useEffect } from 'react';
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
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { useCreatePOPUpload, CreatePOPUploadData } from '@/hooks/usePOPUploads';
import { formatFileSize } from '@/lib/popUpload';
import ProfileImageService from '@/services/ProfileImageService';

// Subject options (common subjects for early childhood)
const SUBJECTS = [
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'english', label: 'English' },
  { value: 'afrikaans', label: 'Afrikaans' },
  { value: 'art', label: 'Art & Creativity' },
  { value: 'science', label: 'Science' },
  { value: 'physical_education', label: 'Physical Education' },
  { value: 'life_skills', label: 'Life Skills' },
  { value: 'music', label: 'Music' },
  { value: 'reading', label: 'Reading' },
  { value: 'writing', label: 'Writing' },
  { value: 'social_skills', label: 'Social Skills' },
  { value: 'other', label: 'Other' },
];

// Achievement levels
const ACHIEVEMENT_LEVELS = [
  { value: 'excellent', label: '⭐ Excellent' },
  { value: 'good', label: '👍 Good' },
  { value: 'improving', label: '📈 Improving' },
  { value: 'needs_support', label: '🤝 Needs Support' },
  { value: 'milestone', label: '🎯 Milestone Achieved' },
];

interface SelectedFile {
  uri: string;
  name: string;
  size?: number;
  type?: string;
}

export default function PictureOfProgressScreen() {
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
  const [subject, setSubject] = useState<string>('');
  const [achievementLevel, setAchievementLevel] = useState<string>('');
  const [learningArea, setLearningArea] = useState('');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [showSubjects, setShowSubjects] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);

  // Convert local image URIs to data URIs for web compatibility
  useEffect(() => {
    const convertImageUri = async () => {
      if (selectedFile?.uri) {
        try {
          // Only convert for web platform and local URIs
          if (Platform.OS === 'web' && (selectedFile.uri.startsWith('blob:') || selectedFile.uri.startsWith('file:'))) {
            const dataUri = await ProfileImageService.convertToDataUri(selectedFile.uri);
            setDisplayUri(dataUri);
          } else {
            // For mobile or remote URIs, use the original URI
            setDisplayUri(selectedFile.uri);
          }
        } catch (error) {
          console.error('Failed to convert image URI:', error);
          setDisplayUri(selectedFile.uri); // Fallback to original URI
        }
      } else {
        setDisplayUri(null);
      }
    };
    
    convertImageUri();
  }, [selectedFile]);
  
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
      height: 100,
      textAlignVertical: 'top',
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
      maxHeight: 200,
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
      backgroundColor: theme.elevated,
      borderRadius: 8,
    },
    imagePreview: {
      width: '100%',
      height: 200,
      borderRadius: 8,
      backgroundColor: theme.textSecondary + '20',
    },
    fileInfo: {
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fileName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      flex: 1,
    },
    fileDetails: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    removeFileButton: {
      padding: 8,
      marginLeft: 12,
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
    helpText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
      lineHeight: 20,
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
          name: asset.fileName || `progress_${Date.now()}.jpg`,
          size: asset.fileSize,
          type: asset.type || 'image/jpeg',
        });
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to select image');
    }
  };
  
  const handleCameraPicker = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error'),
          'Camera permission is required to take photos.'
        );
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `progress_${Date.now()}.jpg`,
          size: asset.fileSize,
          type: asset.type || 'image/jpeg',
        });
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to take photo');
    }
  };
  
  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!title.trim()) {
      errors.push('Title is required');
    }
    if (!subject) {
      errors.push('Subject is required');
    }
    if (!description.trim()) {
      errors.push('Description is required');
    }
    if (!selectedFile) {
      errors.push('Photo is required');
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
        upload_type: 'picture_of_progress',
        title: title.trim(),
        description: description.trim(),
        file_uri: selectedFile.uri,
        file_name: selectedFile.name,
        subject: subject,
        achievement_level: achievementLevel || undefined,
        learning_area: learningArea.trim() || undefined,
      };
      
      await createUpload.mutateAsync(uploadData);
      
      Alert.alert(
        t('pop.progressUploadSuccess'),
        t('pop.progressUploadSuccessDesc'),
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
  
  const getSelectedSubjectLabel = () => {
    const subjectOption = SUBJECTS.find(s => s.value === subject);
    return subjectOption ? subjectOption.label : t('pop.subject');
  };
  
  const getSelectedAchievementLabel = () => {
    const achievement = ACHIEVEMENT_LEVELS.find(a => a.value === achievementLevel);
    return achievement ? achievement.label : t('pop.selectAchievementLevel');
  };
  
  return (
    <View style={styles.container}>
      <RoleBasedHeader 
        title={t('pop.uploadPictureOfProgress')} 
        showBackButton
      />
      
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Student Info */}
        {studentName && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('pop.progressFor')}: {decodeURIComponent(studentName)}
            </Text>
          </View>
        )}
        
        {/* Progress Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('pop.progressDetails')}</Text>
          
          <Text style={styles.label}>{t('pop.title')} *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('pop.titlePlaceholder')}
            placeholderTextColor={theme.textSecondary}
          />
          
          <Text style={styles.label}>{t('pop.subject')} *</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowSubjects(!showSubjects)}
            >
              <Text style={styles.dropdownButtonText}>
                {getSelectedSubjectLabel()}
              </Text>
              <Ionicons 
                name={showSubjects ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={theme.textSecondary} 
              />
            </TouchableOpacity>
            {showSubjects && (
              <ScrollView style={styles.dropdownList}>
                {SUBJECTS.map((subjectOption) => (
                  <TouchableOpacity
                    key={subjectOption.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSubject(subjectOption.value);
                      setShowSubjects(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{subjectOption.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
          
          <Text style={styles.label}>{t('pop.achievementLevel')}</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowAchievements(!showAchievements)}
            >
              <Text style={styles.dropdownButtonText}>
                {getSelectedAchievementLabel()}
              </Text>
              <Ionicons 
                name={showAchievements ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={theme.textSecondary} 
              />
            </TouchableOpacity>
            {showAchievements && (
              <View style={styles.dropdownList}>
                {ACHIEVEMENT_LEVELS.map((achievement) => (
                  <TouchableOpacity
                    key={achievement.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setAchievementLevel(achievement.value);
                      setShowAchievements(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{achievement.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          
          <Text style={styles.label}>{t('pop.learningArea')}</Text>
          <TextInput
            style={styles.input}
            value={learningArea}
            onChangeText={setLearningArea}
            placeholder={t('pop.learningAreaPlaceholder')}
            placeholderTextColor={theme.textSecondary}
          />
          <Text style={styles.helpText}>
            e.g., "Counting to 20", "Letter recognition", "Color mixing", "Fine motor skills"
          </Text>
          
          <Text style={styles.label}>{t('pop.description')} *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('pop.descriptionPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            multiline
          />
          <Text style={styles.helpText}>
            Tell us what makes you proud of this work. What did your child learn or accomplish?
          </Text>
        </View>
        
        {/* Photo Upload */}
        <View style={styles.fileSection}>
          <Text style={styles.fileSectionTitle}>{t('pop.uploadPhoto')} *</Text>
          
          {!selectedFile ? (
            <View style={styles.fileButtons}>
              <TouchableOpacity style={styles.fileButton} onPress={handleCameraPicker}>
                <Ionicons name="camera" size={24} color={theme.primary} />
                <Text style={styles.fileButtonText}>{t('pop.takePhoto')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.fileButton} onPress={handleImagePicker}>
                <Ionicons name="images" size={24} color={theme.primary} />
                <Text style={styles.fileButtonText}>{t('pop.selectPhoto')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.selectedFileContainer}>
              <Image source={{ uri: displayUri || selectedFile.uri }} style={styles.imagePreview} />
              
              <View style={styles.fileInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName}>{selectedFile.name}</Text>
                  <Text style={styles.fileDetails}>
                    {selectedFile.size ? formatFileSize(selectedFile.size) : 'Unknown size'}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.removeFileButton}
                  onPress={() => {
                    setSelectedFile(null);
                    setDisplayUri(null);
                  }}
                >
                  <Ionicons name="close-circle" size={24} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <Text style={styles.helpText}>
            📸 Tip: Take clear, well-lit photos that show your child's work clearly. Include any artwork, worksheets, projects, or activities that demonstrate their progress.
          </Text>
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
            <Text style={styles.submitButtonText}>{t('pop.uploadProgressPicture')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}