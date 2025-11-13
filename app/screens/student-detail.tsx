/**
 * Individual Student Detail Screen
 * 
 * Features:
 * - View comprehensive student information
 * - Assign/change student class (Principal functionality)
 * - Update student details
 * - View attendance and academic records
 * - Contact parent/guardian
 * - Financial records and fee management
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Linking,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Picker } from '@react-native-picker/picker';

interface StudentDetail {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  age_months: number;
  age_years: number;
  status: string;
  enrollment_date: string;
  preschool_id: string;
  class_id: string | null;
  parent_id: string | null;
  guardian_id: string | null;
  medical_conditions?: string;
  allergies?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  profile_photo?: string;
  // Related data
  class_name?: string;
  teacher_name?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  age_group_name?: string;
  // Calculated fields
  attendance_rate?: number;
  last_attendance?: string;
  outstanding_fees?: number;
  payment_status?: 'current' | 'overdue' | 'pending';
}

interface Class {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string | null;
  teacher_name?: string;
  capacity: number;
  current_enrollment: number;
}

export default function StudentDetailScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showClassAssignment, setShowClassAssignment] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editedStudent, setEditedStudent] = useState<Partial<StudentDetail>>({});
  const [saving, setSaving] = useState(false);
  
  // Financial details state
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);
  const [childTransactions, setChildTransactions] = useState<any[]>([]);
  
  // Role-based checks
  const isPrincipal = profile?.role === 'principal';

  const loadStudentData = async () => {
    if (!studentId || !user) return;

    try {
      setLoading(true);

      // Get user's preschool
      const { data: userProfile } = await assertSupabase()
        .from('users')
        .select('preschool_id, role')
        .eq('auth_user_id', user.id)
        .single();

      if (!userProfile?.preschool_id) {
        Alert.alert('Error', 'No school assigned to your account');
        return;
      }

      // Get student details with related information
      const { data: studentData, error: studentError } = await assertSupabase()
        .from('students')
        .select(`
          *,
          classes (
            id,
            name,
            grade_level,
            teacher_id,
            users!classes_teacher_id_fkey (
              id,
              name
            )
          ),
          users!parent_id (
            id,
            name,
            email,
            phone
          ),
          age_groups!students_age_group_id_fkey (
            name
          )
        `)
        .eq('id', studentId)
        .eq('preschool_id', userProfile.preschool_id)
        .single();

      if (studentError) {
        console.error('Error loading student:', studentError);
        Alert.alert('Error', 'Student not found');
        router.back();
        return;
      }

      // Calculate age information
      const ageInfo = calculateAge(studentData.date_of_birth);
      
      // Get attendance data
      const { data: attendanceData } = await assertSupabase()
        .from('attendance_records')
        .select('status, date')
        .eq('student_id', studentId)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('date', { ascending: false });

      const totalRecords = attendanceData?.length || 0;
      const presentRecords = attendanceData?.filter(a => a.status === 'present').length || 0;
      const attendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0;
      const lastAttendance = attendanceData?.[0]?.date;

      // Get financial data - summary for outstanding fees
      const { data: financialData } = await assertSupabase()
        .from('financial_transactions')
        .select('amount, status, type')
        .eq('student_id', studentId)
        .eq('type', 'fee_payment');

      const outstandingFees = financialData
        ?.filter(f => f.status === 'pending')
        ?.reduce((sum, f) => sum + f.amount, 0) || 0;

      // Get child-specific transaction history (last 10)
      const { data: transactionsData } = await assertSupabase()
        .from('financial_transactions')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(10);

      setChildTransactions(transactionsData || []);

      const processedStudent: StudentDetail = {
        ...studentData,
        age_months: ageInfo.months,
        age_years: ageInfo.years,
        class_name: studentData.classes?.name,
        teacher_name: studentData.classes?.users?.name,
        parent_name: studentData.users?.name,
        parent_email: studentData.users?.email,
        parent_phone: studentData.users?.phone,
        age_group_name: studentData.age_groups?.name,
        attendance_rate: attendanceRate,
        last_attendance: lastAttendance,
        outstanding_fees: outstandingFees,
        payment_status: outstandingFees > 0 ? 'overdue' : 'current',
      };

      setStudent(processedStudent);

      // Load available classes for assignment (Principal only)
      if (userProfile.role === 'principal') {
        const { data: classesData } = await assertSupabase()
          .from('classes')
          .select(`
            *,
            users!classes_teacher_id_fkey (
              id,
              name
            ),
            students!inner (
              id
            )
          `)
          .eq('preschool_id', userProfile.preschool_id)
          .eq('is_active', true);

        const processedClasses = classesData?.map(cls => ({
          id: cls.id,
          name: cls.name,
          grade_level: cls.grade_level,
          teacher_id: cls.users?.id || null,
          teacher_name: cls.users?.name,
          capacity: cls.capacity || 25,
          current_enrollment: cls.students?.length || 0,
        })) || [];

        setClasses(processedClasses);
      }

    } catch (error) {
      console.error('Error loading student data:', error);
      Alert.alert('Error', 'Failed to load student information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    const totalMonths = (today.getFullYear() - birth.getFullYear()) * 12 + 
                       (today.getMonth() - birth.getMonth());
    const years = Math.floor(totalMonths / 12);
    return { months: totalMonths, years };
  };

  const formatAge = (ageMonths: number, ageYears: number) => {
    if (ageYears < 2) {
      return `${ageMonths} months`;
    } else {
      const remainingMonths = ageMonths % 12;
      return remainingMonths > 0 
        ? `${ageYears}y ${remainingMonths}m`
        : `${ageYears} years`;
    }
  };

  const handleAssignClass = async () => {
    if (!selectedClassId || !student) return;

    try {
const { error } = await assertSupabase()
        .from('students')
        .update({ class_id: selectedClassId })
        .eq('id', student.id);

      if (error) {
        Alert.alert('Error', 'Failed to assign class');
        return;
      }

      Alert.alert('Success', 'Student successfully assigned to class');
      setShowClassAssignment(false);
      loadStudentData(); // Refresh data
    } catch {
      Alert.alert('Error', 'Failed to assign class');
    }
  };

  const handleContactParent = (type: 'call' | 'email' | 'sms') => {
    if (!student?.parent_phone && !student?.parent_email) {
      Alert.alert('No Contact', 'No parent contact information available');
      return;
    }

    switch (type) {
      case 'call':
        if (student.parent_phone) {
          Linking.openURL(`tel:${student.parent_phone}`);
        }
        break;
      case 'email':
        if (student.parent_email) {
          Linking.openURL(`mailto:${student.parent_email}`);
        }
        break;
      case 'sms':
        if (student.parent_phone) {
          Linking.openURL(`sms:${student.parent_phone}`);
        }
        break;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  const handleEditToggle = () => {
    if (editMode) {
      // Canceling edit
      setEditMode(false);
      setEditedStudent({});
    } else {
      // Enter edit mode
      setEditMode(true);
      setEditedStudent({
        first_name: student?.first_name,
        last_name: student?.last_name,
        medical_conditions: student?.medical_conditions,
        allergies: student?.allergies,
        emergency_contact: student?.emergency_contact,
        emergency_phone: student?.emergency_phone,
      });
    }
  };

  const handleSave = async () => {
    if (!student || !editedStudent) return;

    try {
      setSaving(true);

      const { error } = await assertSupabase()
        .from('students')
        .update({
          first_name: editedStudent.first_name,
          last_name: editedStudent.last_name,
          medical_conditions: editedStudent.medical_conditions,
          allergies: editedStudent.allergies,
          emergency_contact: editedStudent.emergency_contact,
          emergency_phone: editedStudent.emergency_phone,
        })
        .eq('id', student.id);

      if (error) {
        Alert.alert('Error', 'Failed to save student details');
        return;
      }

      Alert.alert('Success', 'Student details updated successfully');
      setEditMode(false);
      setEditedStudent({});
      loadStudentData(); // Refresh data
    } catch (error) {
      console.error('Error saving student:', error);
      Alert.alert('Error', 'Failed to save student details');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [studentId, user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStudentData();
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="person-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.loadingText}>Loading student details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Student not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Details</Text>
        {editMode ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={handleEditToggle} disabled={saving}>
              <Ionicons name="close" size={24} color={theme.error} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Ionicons name="checkmark" size={24} color={theme.success} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleEditToggle}>
            <Ionicons name="create" size={24} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Student Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {student.profile_photo ? (
                <Image source={{ uri: student.profile_photo }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {student.first_name[0]}{student.last_name[0]}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              {editMode ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={styles.input}
                    value={editedStudent.first_name}
                    onChangeText={(text) => setEditedStudent({ ...editedStudent, first_name: text })}
                    placeholder="First Name"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <TextInput
                    style={styles.input}
                    value={editedStudent.last_name}
                    onChangeText={(text) => setEditedStudent({ ...editedStudent, last_name: text })}
                    placeholder="Last Name"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              ) : (
                <>
                  <Text style={styles.studentName}>
                    {student.first_name} {student.last_name}
                  </Text>
                  <Text style={styles.studentAge}>
                    {formatAge(student.age_months, student.age_years)}
                  </Text>
                  {student.age_group_name && (
                    <Text style={styles.ageGroup}>{student.age_group_name}</Text>
                  )}
                </>
              )}
            </View>
            <View style={styles.statusBadge}>
              <Text style={[styles.statusText, { color: student.status === 'active' ? '#10B981' : '#EF4444' }]}>
                {student.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Class Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Class Information</Text>
            {classes.length > 0 && (
              <TouchableOpacity onPress={() => setShowClassAssignment(true)}>
                <Text style={styles.editText}>Assign Class</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {student.class_name ? (
            <View style={styles.classInfo}>
              <Ionicons name="school" size={20} color="#007AFF" />
              <View style={styles.classDetails}>
                <Text style={styles.className}>{student.class_name}</Text>
                {student.teacher_name && (
                  <Text style={styles.teacherName}>Teacher: {student.teacher_name}</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.unassignedClass}>
              <Ionicons name="alert-circle" size={20} color="#F59E0B" />
              <Text style={styles.unassignedText}>Not assigned to any class</Text>
              {classes.length > 0 && (
                <TouchableOpacity 
                  style={styles.assignButton}
                  onPress={() => setShowClassAssignment(true)}
                >
                  <Text style={styles.assignButtonText}>Assign Class</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Attendance & Academic Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Academic Performance</Text>
          <View style={styles.performanceGrid}>
            <View style={styles.performanceCard}>
              <Text style={styles.performanceValue}>
                {student.attendance_rate?.toFixed(1) || '0.0'}%
              </Text>
              <Text style={styles.performanceLabel}>Attendance Rate</Text>
            </View>
            <View style={styles.performanceCard}>
              <Text style={styles.performanceValue}>
                {student.last_attendance 
                  ? new Date(student.last_attendance).toLocaleDateString()
                  : 'N/A'
                }
              </Text>
              <Text style={styles.performanceLabel}>Last Attendance</Text>
            </View>
          </View>
        </View>

        {/* Parent/Guardian Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parent/Guardian</Text>
          {student.parent_name ? (
            <View>
              <View style={styles.contactInfo}>
                <Text style={styles.parentName}>{student.parent_name}</Text>
                {student.parent_email && (
                  <Text style={styles.contactDetail}>{student.parent_email}</Text>
                )}
                {student.parent_phone && (
                  <Text style={styles.contactDetail}>{student.parent_phone}</Text>
                )}
              </View>
              
              <View style={styles.contactActions}>
                <TouchableOpacity 
                  style={styles.contactButton}
                  onPress={() => handleContactParent('call')}
                >
                  <Ionicons name="call" size={20} color="#10B981" />
                  <Text style={styles.contactButtonText}>Call</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.contactButton}
                  onPress={() => handleContactParent('sms')}
                >
                  <Ionicons name="chatbubble" size={20} color="#007AFF" />
                  <Text style={styles.contactButtonText}>SMS</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.contactButton}
                  onPress={() => handleContactParent('email')}
                >
                  <Ionicons name="mail" size={20} color="#8B5CF6" />
                  <Text style={styles.contactButtonText}>Email</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.noContact}>No parent contact information</Text>
          )}
        </View>

        {/* Progress Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Academic Reports</Text>
          <TouchableOpacity 
            style={styles.progressReportButton}
            onPress={() => {
              if (isPrincipal) {
                router.push('/screens/principal-report-review');
              } else {
                router.push(`/screens/progress-report-creator?student_id=${student.id}`);
              }
            }}
          >
            <View style={styles.progressReportContent}>
              <View style={styles.progressReportIcon}>
                <Ionicons name="document-text" size={24} color="#8B5CF6" />
              </View>
              <View style={styles.progressReportText}>
                <Text style={styles.progressReportTitle}>
                  {isPrincipal ? 'Review Progress Reports' : 'Create Progress Report'}
                </Text>
                <Text style={styles.progressReportSubtitle}>
                  {isPrincipal ? 'View and approve student reports' : 'Send academic progress to parents'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Financial Information - Child Specific */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowFinancialDetails(!showFinancialDetails)}
          >
            <Text style={styles.sectionTitle}>Financial Status</Text>
            <Ionicons 
              name={showFinancialDetails ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={theme.primary} 
            />
          </TouchableOpacity>
          
          <View style={styles.financialCard}>
            <View style={styles.feeInfo}>
              <Text style={styles.feeLabel}>Outstanding Fees</Text>
              <Text style={[
                styles.feeAmount,
                { color: (student.outstanding_fees || 0) > 0 ? '#EF4444' : '#10B981' }
              ]}>
                {formatCurrency(student.outstanding_fees || 0)}
              </Text>
            </View>
            <View style={[
              styles.paymentStatus,
              { backgroundColor: student.payment_status === 'current' ? '#10B981' : '#EF4444' }
            ]}>
              <Text style={styles.paymentStatusText}>
                {student.payment_status === 'current' ? 'Up to Date' : 'Overdue'}
              </Text>
            </View>
          </View>

          {/* Transaction History (Expandable) */}
          {showFinancialDetails && (
            <View style={styles.transactionHistory}>
              <Text style={styles.transactionHistoryTitle}>Recent Transactions</Text>
              {childTransactions.length > 0 ? (
                childTransactions.map((transaction) => (
                  <View key={transaction.id} style={styles.transactionItem}>
                    <View style={styles.transactionLeft}>
                      <Text style={styles.transactionType}>{transaction.type.replace('_', ' ')}</Text>
                      <Text style={styles.transactionDate}>
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={[
                      styles.transactionAmount,
                      { color: transaction.type.includes('payment') ? '#10B981' : '#EF4444' }
                    ]}>
                      {transaction.type.includes('payment') ? '+' : '-'}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noTransactions}>No transaction history</Text>
              )}
            </View>
          )}
        </View>

        {/* Medical Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical & Emergency Information</Text>
          {editMode ? (
            <View style={{ gap: 12 }}>
              <View>
                <Text style={styles.fieldLabel}>Medical Conditions</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editedStudent.medical_conditions || ''}
                  onChangeText={(text) => setEditedStudent({ ...editedStudent, medical_conditions: text })}
                  placeholder="Enter medical conditions..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Allergies</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editedStudent.allergies || ''}
                  onChangeText={(text) => setEditedStudent({ ...editedStudent, allergies: text })}
                  placeholder="Enter allergies..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Emergency Contact Name</Text>
                <TextInput
                  style={styles.input}
                  value={editedStudent.emergency_contact || ''}
                  onChangeText={(text) => setEditedStudent({ ...editedStudent, emergency_contact: text })}
                  placeholder="Emergency contact name..."
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Emergency Contact Phone</Text>
                <TextInput
                  style={styles.input}
                  value={editedStudent.emergency_phone || ''}
                  onChangeText={(text) => setEditedStudent({ ...editedStudent, emergency_phone: text })}
                  placeholder="Emergency phone number..."
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {student.medical_conditions && (
                <View style={styles.medicalItem}>
                  <Text style={styles.medicalLabel}>Medical Conditions:</Text>
                  <Text style={styles.medicalValue}>{student.medical_conditions}</Text>
                </View>
              )}
              {student.allergies && (
                <View style={styles.medicalItem}>
                  <Text style={styles.medicalLabel}>Allergies:</Text>
                  <Text style={styles.medicalValue}>{student.allergies}</Text>
                </View>
              )}
              {student.emergency_contact && (
                <View style={styles.medicalItem}>
                  <Text style={styles.medicalLabel}>Emergency Contact:</Text>
                  <Text style={styles.medicalValue}>{student.emergency_contact}</Text>
                  {student.emergency_phone && (
                    <Text style={styles.medicalValue}>{student.emergency_phone}</Text>
                  )}
                </View>
              )}
              {!student.medical_conditions && !student.allergies && !student.emergency_contact && (
                <Text style={styles.noMedicalInfo}>No medical or emergency information</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Class Assignment Modal */}
      <Modal
        visible={showClassAssignment}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClassAssignment(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowClassAssignment(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Assign Class</Text>
            <TouchableOpacity onPress={handleAssignClass} disabled={!selectedClassId}>
              <Text style={[
                styles.modalSave,
                { color: selectedClassId ? '#007AFF' : '#ccc' }
              ]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.pickerLabel}>Select a class for {student.first_name}:</Text>
            <Picker
              selectedValue={selectedClassId}
              onValueChange={setSelectedClassId}
              style={styles.picker}
            >
              <Picker.Item label="Select a class..." value="" />
              {classes.map((cls) => (
                <Picker.Item
                  key={cls.id}
                  label={`${cls.name} - ${cls.teacher_name || 'No teacher'} (${cls.current_enrollment}/${cls.capacity})`}
                  value={cls.id}
                />
              ))}
            </Picker>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: theme.error,
    marginTop: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    margin: 16,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 20,
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  studentAge: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  ageGroup: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    margin: 16,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  editText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  classInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classDetails: {
    marginLeft: 12,
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  teacherName: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  unassignedClass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unassignedText: {
    fontSize: 16,
    color: '#F59E0B',
    marginLeft: 8,
    flex: 1,
  },
  assignButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  performanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceCard: {
    flex: 1,
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  performanceLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  contactInfo: {
    marginBottom: 16,
  },
  parentName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  contactDetail: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  contactButton: {
    alignItems: 'center',
    padding: 12,
  },
  contactButtonText: {
    fontSize: 12,
    color: theme.text,
    marginTop: 4,
  },
  noContact: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  financialCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeInfo: {
    flex: 1,
  },
  feeLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  feeAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  paymentStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  paymentStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  medicalItem: {
    marginBottom: 12,
  },
  medicalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  medicalValue: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  modalCancel: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  pickerLabel: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 16,
  },
  picker: {
    backgroundColor: theme.surface,
    borderRadius: 8,
  },
  progressReportButton: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  progressReportContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressReportIcon: {
    width: 48,
    height: 48,
    backgroundColor: theme.card,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  progressReportText: {
    flex: 1,
  },
  progressReportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  progressReportSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  // Edit mode styles
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 6,
  },
  noMedicalInfo: {
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  // Transaction history styles
  transactionHistory: {
    marginTop: 16,
    padding: 12,
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  transactionHistoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  noTransactions: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    padding: 16,
    fontStyle: 'italic',
  },
});
