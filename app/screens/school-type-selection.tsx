import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';
import { useTheme } from '@/contexts/ThemeContext';

// Type definitions
interface SchoolTypeOption {
  id: 'preschool' | 'k12_school' | 'hybrid';
  name: string;
  description: string;
  features: string[];
  icon: any; // Would be better with proper typing for images
  primaryColor: string;
  secondaryColor: string;
}

// School type options with detailed information
const SCHOOL_TYPES: SchoolTypeOption[] = [
  {
    id: 'preschool',
    name: 'Preschool',
    description: 'For early childhood education centers, daycares, and nurseries.',
    features: [
      'Simplified attendance tracking',
      'Parent communication tools',
      'Daily activity reporting',
      'Child development tracking',
      'Photo sharing with parents'
    ],
    icon: require('@/assets/icons/preschool-icon.png'),
    primaryColor: '#00f5ff',
    secondaryColor: '#0ea5b6'
  },
  {
    id: 'k12_school',
    name: 'K-12 School',
    description: 'For primary and secondary schools with formal grade levels.',
    features: [
      'Grade and curriculum management',
      'Timetable scheduling',
      'Homework and assignment tracking',
      'Student performance analytics',
      'Test and exam management'
    ],
    icon: require('@/assets/icons/k12-icon.png'),
    primaryColor: '#7e22ce',
    secondaryColor: '#6b21a8'
  },
  {
    id: 'hybrid',
    name: 'Hybrid Institution',
    description: 'For educational centers that offer both preschool and K-12 programs.',
    features: [
      'Combined grade/class management',
      'Seamless transition between levels',
      'Unified administration tools',
      'Age-appropriate features by level',
      'Custom role management'
    ],
    icon: require('@/assets/icons/hybrid-icon.png'),
    primaryColor: '#16a34a',
    secondaryColor: '#15803d'
  }
];

export default function SchoolTypeSelectionScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ from?: string }>();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [showDetailView, setShowDetailView] = useState<string | null>(null);
  const { width } = Dimensions.get('window');
  const isSmallScreen = width < 380;

  // If coming back from a different screen, show a summary view
  useEffect(() => {
    if (params.from === 'registration') {
      // If returning from registration, get saved type from AsyncStorage
      const loadSavedType = async () => {
        try {
          if (Platform.OS !== 'web') {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const savedType = await AsyncStorage.getItem('selected_school_type');
            if (savedType) {
              setSelectedType(savedType);
            }
          }
        } catch (e) {
          console.debug('Failed to load saved school type', e);
        }
      };
      loadSavedType();
    }
  }, [params.from]);

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    track('school_type_selected', { type: typeId });
  };

  const handleViewDetails = (typeId: string) => {
    setShowDetailView(typeId);
  };

  const handleContinue = async () => {
    if (!selectedType || continuing) return;
    
    setContinuing(true);
    
    try {
      // Save selected type to AsyncStorage for persistence
      if (Platform.OS !== 'web') {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('selected_school_type', selectedType);
      }
      
      track('school_type_selection_continued', { 
        type: selectedType,
        user_id: user?.id || 'anonymous'
      });
      
      // Navigate to the school registration screen with the selected type
      router.push({
        pathname: '/screens/school-registration',
        params: { schoolType: selectedType }
      });
    } catch (e) {
      console.error('Failed to save school type or navigate', e);
    } finally {
      setContinuing(false);
    }
  };

  const handleBackFromDetail = () => {
    setShowDetailView(null);
  };

  // Detail view for a specific school type
  if (showDetailView) {
    const typeDetails = SCHOOL_TYPES.find(t => t.id === showDetailView);
    
    if (!typeDetails) return null;
    
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ 
          title: `${typeDetails.name} Details`,
          headerStyle: { backgroundColor: theme.headerBackground },
          headerTitleStyle: { color: theme.headerText },
          headerTintColor: theme.headerTint
        }} />
        <ThemedStatusBar />
        
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={[styles.detailHeader, { backgroundColor: typeDetails.secondaryColor }]}>
              <Image source={typeDetails.icon} style={styles.detailIcon} />
              <Text style={styles.detailTitle}>{typeDetails.name}</Text>
              <Text style={styles.detailDescription}>{typeDetails.description}</Text>
            </View>
            
            <View style={styles.detailContent}>
              <Text style={styles.detailSectionTitle}>Key Features</Text>
              {typeDetails.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Text style={styles.featureItemBullet}>•</Text>
                  <Text style={styles.featureItemText}>{feature}</Text>
                </View>
              ))}
              
              <Text style={styles.detailSectionTitle}>Recommended For</Text>
              <Text style={styles.recommendedText}>
                {typeDetails.id === 'preschool' && 
                  'Early childhood education centers, daycares, nurseries, and montessori schools serving children typically aged 0-6 years.'}
                {typeDetails.id === 'k12_school' && 
                  'Primary and secondary schools, including government, private, and independent schools serving grades K-12 (ages 5-18).'}
                {typeDetails.id === 'hybrid' && 
                  'Combined institutions offering both preschool and K-12 education, or schools that provide continuous education from early childhood through secondary levels.'}
              </Text>
              
              <Text style={styles.detailSectionTitle}>Platform Customizations</Text>
              <Text style={styles.customizationText}>
                {typeDetails.id === 'preschool' && 
                  'Your dashboard will focus on daily activities, child development tracking, and simplified attendance. Features are optimized for early childhood educators and daycare providers.'}
                {typeDetails.id === 'k12_school' && 
                  'Your platform will include grade management, formal assessment tools, and advanced academic tracking. The interface is designed for teachers working with formal curriculum requirements.'}
                {typeDetails.id === 'hybrid' && 
                  'You\'ll have access to both preschool and K-12 features in a unified system. Administrators can customize which features are available to different grade levels and staff members.'}
              </Text>
              
              <View style={styles.detailButtonContainer}>
                <TouchableOpacity 
                  style={[styles.detailButton, { backgroundColor: typeDetails.primaryColor }]}
                  onPress={() => {
                    handleTypeSelect(typeDetails.id);
                    handleBackFromDetail();
                  }}
                >
                  <Text style={styles.detailButtonText}>Select This Type</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.detailBackButton}
                  onPress={handleBackFromDetail}
                >
                  <Text style={styles.detailBackButtonText}>Back to Options</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // Main selection screen
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Select School Type',
        headerStyle: { backgroundColor: '#0b1220' },
        headerTitleStyle: { color: '#fff' },
        headerTintColor: '#00f5ff'
      }} />
      <ThemedStatusBar />
      
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>What type of educational institution are you registering?</Text>
          <Text style={styles.subtitle}>
            We'll customize your experience based on your selection. You can modify this later if needed.
          </Text>
          
          <View style={styles.typeOptions}>
            {SCHOOL_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  selectedType === type.id && { borderColor: type.primaryColor, borderWidth: 2 },
                  isSmallScreen && styles.typeCardSmall
                ]}
                onPress={() => handleTypeSelect(type.id)}
              >
                <View style={[styles.typeHeader, { backgroundColor: type.secondaryColor }]}>
                  <Image source={type.icon} style={styles.typeIcon} />
                  <Text style={styles.typeName}>{type.name}</Text>
                </View>
                
                <View style={styles.typeContent}>
                  <Text style={styles.typeDescription}>{type.description}</Text>
                  <View style={styles.typeFeatures}>
                    {type.features.slice(0, 3).map((feature, index) => (
                      <Text key={index} style={styles.featureText}>• {feature}</Text>
                    ))}
                    {type.features.length > 3 && (
                      <Text style={styles.moreFeatures}>+ {type.features.length - 3} more</Text>
                    )}
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.detailsButton, { borderColor: type.primaryColor }]}
                    onPress={() => handleViewDetails(type.id)}
                  >
                    <Text style={[styles.detailsButtonText, { color: type.primaryColor }]}>View Details</Text>
                  </TouchableOpacity>
                </View>
                
                {selectedType === type.id && (
                  <View style={[styles.selectedIndicator, { backgroundColor: type.primaryColor }]}>
                    <Text style={styles.selectedText}>Selected</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          
          <TouchableOpacity
            style={[
              styles.continueButton,
              !selectedType && styles.continueButtonDisabled,
              continuing && styles.continueButtonLoading
            ]}
            onPress={handleContinue}
            disabled={!selectedType || continuing}
          >
            {continuing ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.continueButtonText}>Continue with {
                selectedType ? SCHOOL_TYPES.find(t => t.id === selectedType)?.name : 'Selected Type'
              }</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  typeOptions: {
    gap: 16,
    marginBottom: 24,
  },
  typeCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  typeCardSmall: {
    minHeight: 180,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  typeIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  typeName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  typeContent: {
    padding: 12,
    gap: 8,
  },
  typeDescription: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  typeFeatures: {
    gap: 4,
    marginVertical: 8,
  },
  featureText: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
  moreFeatures: {
    color: '#6B7280',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  detailsButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  detailsButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  selectedText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  continueButton: {
    backgroundColor: '#00f5ff',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#1f2937',
    opacity: 0.7,
  },
  continueButtonLoading: {
    opacity: 0.8,
  },
  continueButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  // Detail view styles
  detailHeader: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 16,
  },
  detailIcon: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    marginBottom: 12,
  },
  detailTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  detailDescription: {
    color: '#E5E7EB',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  detailContent: {
    padding: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    marginBottom: 24,
  },
  detailSectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  featureItemBullet: {
    color: '#00f5ff',
    fontSize: 16,
    marginRight: 8,
    lineHeight: 22,
  },
  featureItemText: {
    color: '#E5E7EB',
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  recommendedText: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  customizationText: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  detailButtonContainer: {
    marginTop: 16,
    gap: 12,
  },
  detailButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  detailButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  detailBackButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  detailBackButtonText: {
    color: '#E5E7EB',
    fontWeight: '600',
    fontSize: 16,
  }
});