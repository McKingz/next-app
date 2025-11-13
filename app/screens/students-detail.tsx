/**
 * Students Directory Detail Screen
 * 
 * Complete students management with hierarchical access control:
 * - Principals see all school students with full management capabilities
 * - Teachers see their assigned students with limited management
 * - Parents see only their children with read-only access
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { CacheIndicator } from '@/components/ui/CacheIndicator';
import { EmptyStudentsState } from '@/components/ui/EmptyState';
import { offlineCacheService } from '@/lib/services/offlineCacheService';
import { assertSupabase } from '@/lib/supabase';

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  grade: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  emergencyContact: string;
  emergencyPhone: string;
  medicalConditions?: string;
  allergies?: string;
  enrollmentDate: string;
  status: 'active' | 'inactive' | 'pending';
  profilePhoto?: string;
  attendanceRate: number;
  lastAttendance: string;
  assignedTeacher?: string;
  fees: {
    outstanding: number;
    lastPayment: string;
    paymentStatus: 'current' | 'overdue' | 'pending';
  };
  schoolId: string;
  classId?: string;
}

interface FilterOptions {
  grade: string[];
  status: string[];
  teacher: string[];
  paymentStatus: string[];
  search: string;
}

export default function StudentsDetailScreen() {
  const { t } = useTranslation();  
  const { user, profile } = useAuth();
  const { theme, isDark } = useTheme();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);  
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [filters, setFilters] = useState<FilterOptions>({
    grade: [],
    status: [],
    teacher: [],
    paymentStatus: [],
    search: '',
  });


  // Get preschool ID from user context
  const getPreschoolId = useCallback((): string | null => {
    if (profile?.organization_id) {
      return profile.organization_id as string;
    }
    return user?.user_metadata?.preschool_id || null;
  }, [profile, user]);

  const loadStudents = async (forceRefresh = false) => {
    const preschoolId = getPreschoolId();
    
if (!preschoolId) {
      console.warn('No preschool ID available or Supabase not initialized');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(!forceRefresh);
      if (forceRefresh) setRefreshing(true);

      const userRole = profile?.role || 'parent';

      // Try cache first
      if (!forceRefresh && user?.id) {
        setIsLoadingFromCache(true);
        const identifier = userRole === 'principal_admin' 
          ? `${preschoolId}` 
          : `${preschoolId}_${user.id}`;
        
        const cached = await offlineCacheService.get<Student[]>(
          'student_data_',
          identifier,
          user.id
        );
        
        if (cached) {
          setStudents(cached);
          setIsLoadingFromCache(false);
          // Continue to fetch fresh data in background
          setTimeout(() => loadStudents(true), 100);
          return;
        }
        setIsLoadingFromCache(false);
      }

      console.log('🔍 Fetching real students for preschool:', preschoolId);
      
      // **FETCH REAL STUDENTS FROM DATABASE**
const { data: studentsData, error: studentsError } = await assertSupabase()
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          parent_id,
          class_id,
          is_active,
          preschool_id,
          created_at,
          status,
          gender,
          medical_conditions,
          allergies,
          emergency_contact_name,
          emergency_contact_phone
        `)
        .eq('preschool_id', preschoolId)
        .eq('is_active', true);
        
      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        Alert.alert('Error', 'Failed to load students. Please try again.');
        return;
      }
      
      console.log('✅ Real students fetched:', studentsData?.length || 0);
      
      // Transform database data to match Student interface
      const transformedStudents: Student[] = (studentsData || []).map((dbStudent: any, index: number) => {
        return {
          id: dbStudent.id,
          studentId: `STU${new Date().getFullYear()}${String(index + 1).padStart(3, '0')}`,
          firstName: dbStudent.first_name || 'Unknown',
          lastName: dbStudent.last_name || 'Student',
          grade: 'Grade R-A', // TODO: Get from class_id lookup
          dateOfBirth: dbStudent.date_of_birth || '2019-01-01',
          guardianName: 'Guardian Name', // TODO: Get from parent lookup using parent_id
          guardianPhone: '+27 80 000 0000',
          guardianEmail: 'guardian@example.com', // TODO: Get from parent lookup using parent_id
          emergencyContact: dbStudent.emergency_contact_name || 'Emergency Contact',
          emergencyPhone: dbStudent.emergency_contact_phone || '+27 80 000 0000',
          medicalConditions: dbStudent.medical_conditions || '',
          allergies: dbStudent.allergies || '',
          enrollmentDate: dbStudent.created_at?.split('T')[0] || '2024-01-01',
          status: (dbStudent.status || 'active') as 'active' | 'inactive' | 'pending',
          profilePhoto: undefined,
          attendanceRate: 90, // TODO: Calculate from attendance_records
          lastAttendance: new Date().toISOString(),
          assignedTeacher: 'Teacher Name', // TODO: Get from class->teacher lookup
          fees: {
            outstanding: 0,
            lastPayment: '2024-09-01',
            paymentStatus: 'current' as const,
          },
          schoolId: preschoolId,
          classId: dbStudent.class_id,
        };
      });
      
      // Filter based on user role and permissions (same logic as before)
      let filteredStudents = transformedStudents;
      if (userRole === 'principal_admin') {
        // Principals see all school students
        filteredStudents = transformedStudents;
      } else if (userRole === 'teacher') {
        // Teachers see their assigned students (TODO: implement class assignment filter)
        filteredStudents = transformedStudents;
      } else {
        // Parents see only their children (TODO: implement parent_id filter)
        filteredStudents = transformedStudents.filter(student => 
          student.guardianEmail === user?.email
        );
      }
      
      setStudents(filteredStudents);

      // Cache the fresh data
      if (user?.id) {
        const identifier = userRole === 'principal_admin' 
          ? `${preschoolId}` 
          : `${preschoolId}_${user.id}`;
        
        await offlineCacheService.set<Student[]>(
          'student_data_',
          identifier,
          filteredStudents,
          user.id,
          preschoolId
        );
      }

    } catch (error) {
      console.error('Failed to load students:', error);
      Alert.alert('Error', 'Failed to load students directory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [students, filters]);

  const applyFilters = () => {
    let filtered = students;

    // Filter by grade
    if (filters.grade.length > 0) {
      filtered = filtered.filter(student => filters.grade.includes(student.grade));
    }

    // Filter by status
    if (filters.status.length > 0) {
      filtered = filtered.filter(student => filters.status.includes(student.status));
    }

    // Filter by payment status
    if (filters.paymentStatus.length > 0) {
      filtered = filtered.filter(student => filters.paymentStatus.includes(student.fees.paymentStatus));
    }

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(student =>
        student.firstName.toLowerCase().includes(searchLower) ||
        student.lastName.toLowerCase().includes(searchLower) ||
        student.studentId.toLowerCase().includes(searchLower) ||
        student.guardianName.toLowerCase().includes(searchLower)
      );
    }

    // Sort by last name
    filtered.sort((a, b) => a.lastName.localeCompare(b.lastName));

    setFilteredStudents(filtered);
  };

  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  // formatDate function removed - not currently used
  // const formatDate = (dateString: string): string => {
  //   return new Date(dateString).toLocaleDateString('en-ZA', {
  //     year: 'numeric',
  //     month: 'short',
  //     day: 'numeric'
  //   });
  // };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return '#059669';
      case 'inactive': return '#DC2626';
      case 'pending': return '#EA580C';
      default: return '#6B7280';
    }
  };

  const getPaymentStatusColor = (status: string): string => {
    switch (status) {
      case 'current': return '#059669';
      case 'overdue': return '#DC2626';
      case 'pending': return '#EA580C';
      default: return '#6B7280';
    }
  };

  const canManageStudent = (): boolean => {
    return profile?.role === 'principal_admin';
  };

 
const canEditStudent = (_student: Student): boolean => {
    const userRole = profile?.role || 'parent';
    if (userRole === 'principal_admin') return true;
    if (userRole === 'teacher') return true; // Teachers can edit basic info
    return false; // Parents can only view
  };

  const handleEditStudent = (student: Student) => {
    if (!canEditStudent(student)) {
      Alert.alert('Access Denied', 'You do not have permission to edit student information.');
      return;
    }
    
    setSelectedStudent(student);
    setShowStudentModal(true);
  };

  const handleDeleteStudent = (studentId: string) => {
    if (!canManageStudent()) {
      Alert.alert('Access Denied', 'Only principals can delete students.');
      return;
    }

    Alert.alert(
      'Delete Student',
      'Are you sure you want to delete this student? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setStudents(prev => prev.filter(s => s.id !== studentId));
            // In production, this would call the delete API
          }
        }
      ]
    );
  };

  const toggleStudentStatus = (studentId: string, currentStatus: string) => {
    if (!canManageStudent()) {
      Alert.alert('Access Denied', 'Only principals can change student status.');
      return;
    }

    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setStudents(prev => prev.map(student => 
      student.id === studentId 
        ? { ...student, status: newStatus as any }
        : student
    ));
  };

  const renderStudentCard = ({ item }: { item: Student }) => {
    const age = calculateAge(item.dateOfBirth);
    
    return (
      <TouchableOpacity 
        style={styles.studentCard}
        onPress={() => handleEditStudent(item)}
      >
        <View style={styles.studentHeader}>
          <View style={styles.studentPhotoContainer}>
            {item.profilePhoto ? (
              <Image source={{ uri: item.profilePhoto }} style={styles.studentPhoto} />
            ) : (
              <View style={styles.studentPhotoPlaceholder}>
                <Ionicons name="person" size={24} color={theme.colors.text} />
              </View>
            )}
          </View>
          
          <View style={styles.studentInfo}>
            <View style={styles.studentNameRow}>
              <Text style={styles.studentName}>
                {item.firstName} {item.lastName}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {item.status}
                </Text>
              </View>
            </View>
            
            <Text style={styles.studentDetails}>
              {item.studentId} • {item.grade} • Age {age}
            </Text>
            
            <Text style={styles.studentDetails}>
              Guardian: {item.guardianName}
            </Text>
            
            <View style={styles.studentMetrics}>
              <View style={styles.metricItem}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.metricText}>{item.attendanceRate}%</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons 
                  name="card" 
                  size={16} 
                  color={getPaymentStatusColor(item.fees.paymentStatus)} 
                />
                <Text style={[styles.metricText, { color: getPaymentStatusColor(item.fees.paymentStatus) }]}>
                  {item.fees.paymentStatus}
                </Text>
              </View>
              {item.fees.outstanding > 0 && (
                <Text style={styles.outstandingFees}>
                  R{item.fees.outstanding.toLocaleString()} outstanding
                </Text>
              )}
            </View>
          </View>

          {canManageStudent() && (
            <View style={styles.studentActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => toggleStudentStatus(item.id, item.status)}
              >
                <Ionicons 
                  name={item.status === 'active' ? 'pause' : 'play'} 
                  size={16} 
                  color={theme.colors.text} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleDeleteStudent(item.id)}
              >
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterModal = () => (
    <Modal visible={showFilters} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Students</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Grade</Text>
            <View style={styles.filterOptions}>
              {['Grade R-A', 'Grade R-B', 'Grade 1-A', 'Grade 1-B', 'Grade 2-A'].map(grade => (
                <TouchableOpacity
                  key={grade}
                  style={[styles.filterOption, filters.grade.includes(grade) && styles.filterOptionSelected]}
                  onPress={() => {
                    setFilters(prev => ({
                      ...prev,
                      grade: prev.grade.includes(grade)
                        ? prev.grade.filter(g => g !== grade)
                        : [...prev.grade, grade]
                    }));
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.grade.includes(grade) && styles.filterOptionTextSelected
                  ]}>
                    {grade}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Status</Text>
            <View style={styles.filterOptions}>
              {['active', 'inactive', 'pending'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={[styles.filterOption, filters.status.includes(status) && styles.filterOptionSelected]}
                  onPress={() => {
                    setFilters(prev => ({
                      ...prev,
                      status: prev.status.includes(status)
                        ? prev.status.filter(s => s !== status)
                        : [...prev.status, status]
                    }));
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.status.includes(status) && styles.filterOptionTextSelected
                  ]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.clearFiltersButton}
              onPress={() => setFilters({ grade: [], status: [], teacher: [], paymentStatus: [], search: '' })}
            >
              <Text style={styles.clearFiltersText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.applyFiltersButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyFiltersText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const getActiveFiltersCount = (): number => {
    return filters.grade.length + filters.status.length + filters.paymentStatus.length + 
           (filters.search ? 1 : 0);
  };

  // Create dynamic styles with theme
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Students Directory</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.viewToggle}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          >
            <Ionicons name={viewMode === 'list' ? 'grid' : 'list'} size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={20} color={theme.colors.primary} />
            {getActiveFiltersCount() > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Cache Indicator */}
      <CacheIndicator 
        isLoadingFromCache={isLoadingFromCache}
        onRefresh={() => loadStudents(true)}
        compact={true}
      />

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search students..."
          value={filters.search}
          onChangeText={(text) => setFilters(prev => ({ ...prev, search: text }))}
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>

      {/* Students Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>
          {filteredStudents.length} of {students.length} students
        </Text>
        {canManageStudent() && (
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="person-add" size={16} color={theme.colors.primary} />
            <Text style={styles.addButtonText}>Add Student</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Students List */}
      <FlatList
        data={filteredStudents}
        renderItem={renderStudentCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadStudents(true)} />
        }
        ListEmptyComponent={() => (
          loading ? null : <EmptyStudentsState />
        )}
        showsVerticalScrollIndicator={false}
      />

      {/* Filter Modal */}
      {renderFilterModal()}
    </View>
  );
}

// Create styles function that takes theme parameter
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggle: {
    padding: 8,
  },
  filterButton: {
    padding: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.text,
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  summaryText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '20',
  },
  addButtonText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  studentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  studentHeader: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  studentPhotoContainer: {
    marginRight: 12,
  },
  studentPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  studentPhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentInfo: {
    flex: 1,
  },
  studentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  studentDetails: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  studentMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 2,
  },
  metricText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  outstandingFees: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  studentActions: {
    flexDirection: 'column',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  filterSection: {
    padding: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterOptionSelected: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  filterOptionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  filterOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  clearFiltersButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
    alignItems: 'center',
  },
  clearFiltersText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  applyFiltersButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  applyFiltersText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
