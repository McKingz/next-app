/**
 * Student Enrollment Screen
 * 
 * Allows principals to enroll new students and manage enrollments
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import ClassPlacementService from '@/lib/services/ClassPlacementService';

interface Grade {
  id: string;
  name: string;
  capacity: number;
  enrolled: number;
  available: number;
  fees: {
    admission: number;
    tuition: number;
    books: number;
    uniform: number;
    activities: number;
  };
}

interface StudentInfo {
  // Basic Info
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | '';
  idNumber: string;
  
  // Contact Info
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  
  // Parent/Guardian Info
  parentFirstName: string;
  parentLastName: string;
  parentPhone: string;
  parentEmail: string;
  parentIdNumber: string;
  relationship: 'mother' | 'father' | 'guardian' | '';
  
  // Emergency Contact
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  
  // Medical Info
  allergies: string;
  medicalConditions: string;
  medications: string;
  doctorName: string;
  doctorPhone: string;
  
  // Previous School
  previousSchool: string;
  previousGrade: string;
  reasonForLeaving: string;
  
  // Additional Notes
  specialRequirements: string;
  transportNeeds: 'none' | 'school_bus' | 'private' | '';
}

type EnrollmentStep = 'basic' | 'contact' | 'parent' | 'medical' | 'documents' | 'fees' | 'review';

const initialStudentInfo: StudentInfo = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  idNumber: '',
  address: '',
  city: '',
  postalCode: '',
  phone: '',
  email: '',
  parentFirstName: '',
  parentLastName: '',
  parentPhone: '',
  parentEmail: '',
  parentIdNumber: '',
  relationship: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  allergies: '',
  medicalConditions: '',
  medications: '',
  doctorName: '',
  doctorPhone: '',
  previousSchool: '',
  previousGrade: '',
  reasonForLeaving: '',
  specialRequirements: '',
  transportNeeds: '',
};

export default function StudentEnrollment() {
  const { user, profile } = useAuth();
  const { theme, isDark } = useTheme();
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<EnrollmentStep>('basic');
  const [studentInfo, setStudentInfo] = useState<StudentInfo>(initialStudentInfo);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<{[key: string]: string}>({});
  const [schoolType, setSchoolType] = useState<'preschool' | 'k12'>('k12'); // Default to K-12
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Auto placement suggestion state
  const [suggestedClass, setSuggestedClass] = useState<{ classId: string; className?: string; reason?: string } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  
  // Get preschool ID from user context
  const getPreschoolId = useCallback((): string | null => {
    if (profile?.organization_id) {
      return profile.organization_id as string;
    }
    return user?.user_metadata?.preschool_id || null;
  }, [profile, user]);

  // Define grade options based on school type
  const preschoolGrades: Grade[] = [
    { 
      id: 'baby-class', name: 'Baby Class (6-12 months)', capacity: 8, enrolled: 6, available: 2,
      fees: { admission: 300, tuition: 1800, books: 150, uniform: 200, activities: 100 }
    },
    { 
      id: 'toddler-class', name: 'Toddler Class (1-2 years)', capacity: 12, enrolled: 10, available: 2,
      fees: { admission: 350, tuition: 2000, books: 200, uniform: 220, activities: 120 }
    },
    { 
      id: 'pre-k', name: 'Pre-K (3-4 years)', capacity: 15, enrolled: 14, available: 1,
      fees: { admission: 400, tuition: 2200, books: 250, uniform: 250, activities: 150 }
    },
    { 
      id: 'kindergarten', name: 'Kindergarten (4-5 years)', capacity: 18, enrolled: 16, available: 2,
      fees: { admission: 450, tuition: 2400, books: 300, uniform: 280, activities: 170 }
    },
  ];

  const k12Grades: Grade[] = [
    { 
      id: 'grade-r', name: 'Grade R (5-6 years)', capacity: 30, enrolled: 28, available: 2,
      fees: { admission: 500, tuition: 2800, books: 450, uniform: 300, activities: 200 }
    },
    { 
      id: 'grade-1', name: 'Grade 1', capacity: 30, enrolled: 25, available: 5,
      fees: { admission: 500, tuition: 3200, books: 520, uniform: 350, activities: 250 }
    },
    { 
      id: 'grade-2', name: 'Grade 2', capacity: 30, enrolled: 30, available: 0,
      fees: { admission: 500, tuition: 3200, books: 520, uniform: 350, activities: 250 }
    },
    { 
      id: 'grade-3', name: 'Grade 3', capacity: 30, enrolled: 27, available: 3,
      fees: { admission: 500, tuition: 3500, books: 580, uniform: 380, activities: 300 }
    },
    { 
      id: 'grade-4', name: 'Grade 4', capacity: 30, enrolled: 24, available: 6,
      fees: { admission: 500, tuition: 3500, books: 580, uniform: 380, activities: 300 }
    },
    { 
      id: 'grade-5', name: 'Grade 5', capacity: 30, enrolled: 29, available: 1,
      fees: { admission: 500, tuition: 3800, books: 620, uniform: 400, activities: 350 }
    },
    { 
      id: 'grade-6', name: 'Grade 6', capacity: 30, enrolled: 26, available: 4,
      fees: { admission: 500, tuition: 3800, books: 620, uniform: 400, activities: 350 }
    },
    { 
      id: 'grade-7', name: 'Grade 7', capacity: 30, enrolled: 23, available: 7,
      fees: { admission: 500, tuition: 4200, books: 720, uniform: 450, activities: 400 }
    },
    { 
      id: 'grade-8', name: 'Grade 8', capacity: 30, enrolled: 28, available: 2,
      fees: { admission: 500, tuition: 4200, books: 720, uniform: 450, activities: 400 }
    },
    { 
      id: 'grade-9', name: 'Grade 9', capacity: 30, enrolled: 25, available: 5,
      fees: { admission: 600, tuition: 4500, books: 800, uniform: 500, activities: 450 }
    },
    { 
      id: 'grade-10', name: 'Grade 10', capacity: 30, enrolled: 27, available: 3,
      fees: { admission: 600, tuition: 4500, books: 800, uniform: 500, activities: 450 }
    },
    { 
      id: 'grade-11', name: 'Grade 11', capacity: 30, enrolled: 22, available: 8,
      fees: { admission: 600, tuition: 4800, books: 850, uniform: 520, activities: 480 }
    },
    { 
      id: 'grade-12', name: 'Grade 12', capacity: 30, enrolled: 24, available: 6,
      fees: { admission: 600, tuition: 4800, books: 850, uniform: 520, activities: 480 }
    },
  ];

  // Get appropriate grades based on school type
  const grades = schoolType === 'preschool' ? preschoolGrades : k12Grades;

  const stepOrder: EnrollmentStep[] = ['basic', 'contact', 'parent', 'medical', 'documents', 'fees', 'review'];
  
  const updateStudentInfo = (field: keyof StudentInfo, value: string) => {
    setStudentInfo(prev => ({ ...prev, [field]: value }));
  };
  
  const goToNextStep = () => {
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };
  
  const goToPreviousStep = () => {
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };
  
  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 'basic':
        return !!(studentInfo.firstName && studentInfo.lastName && studentInfo.dateOfBirth && selectedGrade);
      case 'contact':
        return !!(studentInfo.address && studentInfo.city && studentInfo.phone);
      case 'parent':
        return !!(studentInfo.parentFirstName && studentInfo.parentLastName && studentInfo.parentPhone && studentInfo.parentEmail);
      case 'medical':
        return true; // Medical info is optional but recommended
      case 'documents':
        return Object.keys(documents).length >= 2; // At least birth certificate and ID copy
      case 'fees':
        return true; // Fees are calculated automatically
      case 'review':
        return agreedToTerms;
      default:
        return false;
    }
  };
  
  const getStepTitle = (): string => {
    switch (currentStep) {
      case 'basic': return 'Basic Information';
      case 'contact': return 'Contact Details';
      case 'parent': return 'Parent/Guardian Info';
      case 'medical': return 'Medical Information';
      case 'documents': return 'Required Documents';
      case 'fees': return 'Fee Structure';
      case 'review': return 'Review & Submit';
      default: return 'Enrollment';
    }
  };
  
  const calculateTotalFees = (): number => {
    if (!selectedGrade) return 0;
    const grade = grades.find(g => g.id === selectedGrade);
    if (!grade) return 0;
    return Object.values(grade.fees).reduce((total, fee) => total + fee, 0);
  };

  const getSchoolTypeTitle = () => {
    return schoolType === 'preschool' ? 'Preschool Enrollment' : 'K-12 School Enrollment';
  };

  const getSchoolTypeDescription = () => {
    return schoolType === 'preschool' 
      ? 'Enroll children aged 6 months to 5 years in our preschool programs'
      : 'Enroll students from Grade R (Reception) to Grade 12 in our K-12 school';
  };

  const handleEnrollStudent = async () => {
    const studentFullName = `${studentInfo.firstName} ${studentInfo.lastName}`.trim();
    if (!studentFullName || !studentInfo.parentEmail.trim() || !selectedGrade) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    const preschoolId = getPreschoolId();
    if (!preschoolId) {
      Alert.alert('Error', 'Unable to enroll student. Please try again later.');
      return;
    }

    Alert.alert(
      'Enroll Student',
      `Ready to enroll ${studentFullName} in ${grades.find(g => g.id === selectedGrade)?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enroll',
          onPress: async () => {
            try {
              setLoading(true);
              
              console.log('📝 Enrolling student in database:', {
                firstName: studentInfo.firstName,
                lastName: studentInfo.lastName,
                parentEmail: studentInfo.parentEmail,
                grade: selectedGrade,
                preschoolId
              });
              
              // **INSERT REAL STUDENT INTO DATABASE**
              const { data: newStudent, error: insertError } = await assertSupabase()
                .from('students')
                .insert({
                  first_name: studentInfo.firstName,
                  last_name: studentInfo.lastName,
                  date_of_birth: studentInfo.dateOfBirth || '2019-01-01', // Default if not provided
                  preschool_id: preschoolId,
                  is_active: true,
                  status: 'active',
                  // TODO: Add parent_id lookup based on parentEmail
                  // TODO: Add more fields as needed (gender, medical conditions, etc.)
                  ...(suggestedClass ? { class_id: suggestedClass.classId } : {}),
                })
                .select()
                .single();
              
              if (insertError) {
                console.error('Error enrolling student:', insertError);
                Alert.alert('Enrollment Error', 'Failed to enroll student. Please try again.');
                return;
              }
              
              console.log('✅ Student enrolled successfully:', newStudent);
              
              Alert.alert(
                'Success! 🎉', 
                `${studentFullName} has been enrolled successfully!\n\nStudent ID: ${newStudent.id}\nParent will receive a welcome email at ${studentInfo.parentEmail}`,
                [
                  {
                    text: 'Enroll Another',
                    onPress: () => {
                      setStudentInfo(initialStudentInfo);
                      setSelectedGrade('');
                    }
                  },
                  {
                    text: 'View Students',
                    onPress: () => router.push('/screens/students-detail')
                  }
                ]
              );
              
            } catch (error) {
              console.error('Failed to enroll student:', error);
              Alert.alert('Error', 'Failed to enroll student. Please check your connection and try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderGradeCard = (grade: Grade) => {
    const isSelected = selectedGrade === grade.id;
    const isAvailable = grade.available > 0;

    return (
      <TouchableOpacity
        key={grade.id}
        style={[
          styles.gradeCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
          isSelected && { borderColor: theme.primary, backgroundColor: theme.primaryLight + '20' },
          !isAvailable && styles.disabledGradeCard
        ]}
        onPress={() => isAvailable ? setSelectedGrade(grade.id) : null}
        disabled={!isAvailable}
      >
        <View style={styles.gradeHeader}>
          <Text style={[
            styles.gradeName,
            { color: theme.text },
            isSelected && { color: theme.primary },
            !isAvailable && { color: theme.textTertiary }
          ]}>
            {grade.name}
          </Text>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
          )}
        </View>
        
        <View style={styles.gradeStats}>
          <Text style={[
            styles.statText, 
            { color: theme.textSecondary },
            !isAvailable && { color: theme.textTertiary }
          ]}>
            {grade.enrolled}/{grade.capacity} enrolled
          </Text>
          <Text style={[
            styles.availableText,
            !isAvailable ? styles.fullText : styles.availableTextGreen
          ]}>
            {isAvailable ? `${grade.available} spaces available` : 'Full'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBackground, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>{getSchoolTypeTitle()}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* School Type Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>School Type</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Select the type of school for enrollment
          </Text>
          
          <View style={styles.schoolTypeContainer}>
            <TouchableOpacity
              style={[
                styles.schoolTypeButton,
                { borderColor: theme.border, backgroundColor: theme.surface },
                schoolType === 'preschool' && { borderColor: theme.primary, backgroundColor: theme.primaryLight + '20' }
              ]}
              onPress={() => {
                setSchoolType('preschool');
                setSelectedGrade(''); // Reset grade selection
              }}
            >
              <Text style={[styles.schoolTypeTitle, { color: schoolType === 'preschool' ? theme.primary : theme.text }]}>
                Preschool
              </Text>
              <Text style={[styles.schoolTypeDescription, { color: theme.textSecondary }]}>
                Ages 6 months - 5 years
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.schoolTypeButton,
                { borderColor: theme.border, backgroundColor: theme.surface },
                schoolType === 'k12' && { borderColor: theme.primary, backgroundColor: theme.primaryLight + '20' }
              ]}
              onPress={() => {
                setSchoolType('k12');
                setSelectedGrade(''); // Reset grade selection
              }}
            >
              <Text style={[styles.schoolTypeTitle, { color: schoolType === 'k12' ? theme.primary : theme.text }]}>
                K-12 School
              </Text>
              <Text style={[styles.schoolTypeDescription, { color: theme.textSecondary }]}>
                Grade R - Grade 12 (South African System)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Grade Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Select {schoolType === 'preschool' ? 'Class' : 'Grade'}</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            {getSchoolTypeDescription()}
          </Text>
          
          <View style={styles.gradesGrid}>
            {grades.map(renderGradeCard)}
          </View>

          {/* Auto-Assign Class (suggestion) */}
          <View style={{ marginTop: 12, gap: 8 }}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.border }]}
              onPress={async () => {
                try {
                  const preschoolId = getPreschoolId();
                  if (!preschoolId) {
                    Alert.alert('Error', 'Missing preschool context.');
                    return;
                  }
                  setSuggesting(true);
                  const suggestion = await ClassPlacementService.suggestClassForStudent({
                    organizationId: preschoolId,
                    dateOfBirth: studentInfo.dateOfBirth || undefined,
                    gradeLevel: undefined,
                  });
                  if (!suggestion) {
                    Alert.alert('No Class Found', 'No suitable class suggestion is available.');
                    setSuggestedClass(null);
                  } else {
                    setSuggestedClass({ classId: suggestion.classId, className: suggestion.className, reason: suggestion.reason });
                  }
                } catch (e) {
                  console.error('Auto-assign class failed', e);
                  Alert.alert('Error', 'Could not suggest a class.');
                } finally {
                  setSuggesting(false);
                }
              }}
              disabled={suggesting}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                {suggesting ? 'Finding class…' : 'Auto-Assign Class'}
              </Text>
            </TouchableOpacity>

            {suggestedClass && (
              <View style={[styles.suggestionCard, { borderColor: theme.border, backgroundColor: theme.surface }]}> 
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="sparkles" size={18} color={theme.primary} />
                  <Text style={{ color: theme.text, fontWeight: '600' }}>Suggested Class</Text>
                </View>
                <Text style={{ color: theme.textSecondary, marginTop: 4 }}>
                  {suggestedClass.className || suggestedClass.classId}
                </Text>
                {suggestedClass.reason ? (
                  <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 2 }}>{suggestedClass.reason}</Text>
                ) : null}
                <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 8 }}>
                  This class will be applied when enrolling.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Student Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Student Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Student First Name *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.inputText }]}
              value={studentInfo.firstName}
              onChangeText={(value) => updateStudentInfo('firstName', value)}
              placeholder="Enter student's first name"
              placeholderTextColor={theme.inputPlaceholder}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Student Last Name *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.inputText }]}
              value={studentInfo.lastName}
              onChangeText={(value) => updateStudentInfo('lastName', value)}
              placeholder="Enter student's last name"
              placeholderTextColor={theme.inputPlaceholder}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Parent/Guardian Email *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.inputText }]}
              value={studentInfo.parentEmail}
              onChangeText={(value) => updateStudentInfo('parentEmail', value)}
              placeholder="parent@example.com"
              placeholderTextColor={theme.inputPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Enrollment Summary */}
        {selectedGrade && studentInfo.firstName && studentInfo.parentEmail && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Enrollment Summary</Text>
            <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                School Type: <Text style={[styles.summaryBold, { color: theme.text }]}>{schoolType === 'preschool' ? 'Preschool' : 'K-12 School'}</Text>
              </Text>
              <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                Student: <Text style={[styles.summaryBold, { color: theme.text }]}>{studentInfo.firstName} {studentInfo.lastName}</Text>
              </Text>
              <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                {schoolType === 'preschool' ? 'Class' : 'Grade'}: <Text style={[styles.summaryBold, { color: theme.text }]}>
                  {grades.find(g => g.id === selectedGrade)?.name}
                </Text>
              </Text>
              <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
                Parent Email: <Text style={[styles.summaryBold, { color: theme.text }]}>{studentInfo.parentEmail}</Text>
              </Text>
            </View>
          </View>
        )}

        {/* Enroll Button */}
        <TouchableOpacity
          style={[
            styles.enrollButton,
            { backgroundColor: theme.primary },
            (!selectedGrade || !studentInfo.firstName || !studentInfo.parentEmail) && [styles.disabledButton, { backgroundColor: theme.textDisabled }]
          ]}
          onPress={handleEnrollStudent}
          disabled={!selectedGrade || !studentInfo.firstName || !studentInfo.parentEmail || loading}
        >
          <Text style={[
            styles.enrollButtonText,
            { color: theme.onPrimary },
            (!selectedGrade || !studentInfo.firstName || !studentInfo.parentEmail) && [styles.disabledButtonText, { color: theme.textTertiary }]
          ]}>
            {loading ? 'Enrolling...' : 'Enroll Student'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc', // Will be overridden by theme
  },
  schoolTypeContainer: {
    gap: 12,
  },
  schoolTypeButton: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
  },
  schoolTypeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  schoolTypeDescription: {
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    // color will be set dynamically with theme
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    // color will be set dynamically with theme
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    // color will be set dynamically with theme
    marginBottom: 16,
  },
  gradesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gradeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  selectedGradeCard: {
    // borderColor and backgroundColor will be set dynamically with theme
  },
  disabledGradeCard: {
    opacity: 0.5,
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeName: {
    fontSize: 16,
    fontWeight: '600',
    // color will be set dynamically with theme
  },
  selectedGradeText: {
    // color will be set dynamically with theme
  },
  disabledText: {
    // color will be set dynamically with theme
  },
  gradeStats: {
    gap: 2,
  },
  statText: {
    fontSize: 14,
    // color will be set dynamically with theme
  },
  availableText: {
    fontSize: 12,
    fontWeight: '500',
  },
  availableTextGreen: {
    color: '#059669',
  },
  fullText: {
    color: '#dc2626',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    // color will be set dynamically with theme
    marginBottom: 8,
  },
  textInput: {
    // backgroundColor, borderColor, color will be set dynamically with theme
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  summaryCard: {
    // backgroundColor and borderColor will be set dynamically with theme
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: 16,
    // color will be set dynamically with theme
  },
  summaryBold: {
    fontWeight: '600',
    // color will be set dynamically with theme
  },
  enrollButton: {
    // backgroundColor will be set dynamically with theme
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionCard: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  disabledButton: {
    // backgroundColor will be set dynamically with theme
  },
  enrollButtonText: {
    // color will be set dynamically with theme
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButtonText: {
    // color will be set dynamically with theme
  },
});
