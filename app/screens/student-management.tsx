/**
 * Comprehensive Student Management System
 * Age-appropriate for preschools vs K-12 schools
 * 
 * Features:
 * - Student list with filtering by age groups
 * - Age-appropriate grouping (preschool vs primary/secondary)
 * - Student details with proper context
 * - Real database integration
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { router } from 'expo-router';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  age_months: number;
  age_years: number;
  preschool_id: string;
  class_id: string | null;
  parent_id: string | null;
  guardian_id: string | null;
  is_active: boolean;
  status: string;
  age_group_name?: string;
  class_name?: string;
  parent_name?: string;
}

interface SchoolInfo {
  id: string;
  name: string;
  school_type: 'preschool' | 'primary' | 'secondary' | 'combined';
  grade_levels: string[];
}

interface AgeGroup {
  id: string;
  name: string;
  min_age_months: number;
  max_age_months: number;
  age_min: number;
  age_max: number;
  school_type: string;
  description: string;
}

interface FilterOptions {
  searchTerm: string;
  ageGroup: string;
  status: string;
  classId: string;
}

export default function StudentManagementScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [, setAgeGroups] = useState<AgeGroup[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: '',
    ageGroup: '',
    status: '',
    classId: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get user's preschool ID
      const { data: userProfile } = await assertSupabase()
        .from('users')
        .select('preschool_id')
        .eq('auth_user_id', user?.id)
        .single();

      if (!userProfile?.preschool_id) {
        Alert.alert('Error', 'No school assigned to your account');
        return;
      }

      const preschoolId = userProfile.preschool_id;

      // Get school information
      const { data: school } = await assertSupabase()
        .from('preschools')
        .select('id, name, school_type, grade_levels')
        .eq('id', preschoolId)
        .single();

      setSchoolInfo(school);

      // Get age groups appropriate for this school type
      const { data: ageGroupsData } = await assertSupabase()
        .from('age_groups')
        .select('id, name, min_age_months, max_age_months, age_min, age_max, school_type, description')
        .eq('school_type', school?.school_type || 'preschool')
        .eq('is_active', true)
        .order('min_age_months');

      setAgeGroups(ageGroupsData || []);

      // Get classes for this school
      const { data: classesData } = await assertSupabase()
        .from('classes')
        .select('id, name, grade_level, teacher_id')
        .eq('preschool_id', preschoolId)
        .eq('is_active', true)
        .order('name');

      setClasses(classesData || []);

      // Get students with comprehensive information
      const { data: studentsData } = await assertSupabase()
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          date_of_birth,
          preschool_id,
          class_id,
          parent_id,
          guardian_id,
          is_active,
          status,
          classes (name),
          users!parent_id (name)
        `)
        .eq('preschool_id', preschoolId)
        .order('first_name');

      // Process student data with age calculations and appropriate grouping
      const processedStudents = (studentsData || []).map((student: any) => {
        const ageInfo = calculateAgeInfo(student.date_of_birth);
        const ageGroup = findAgeGroup(ageInfo.age_months, ageGroupsData || []);
        
        return {
          ...student,
          age_months: ageInfo.age_months,
          age_years: ageInfo.age_years,
          age_group_name: ageGroup?.name,
          class_name: student.classes?.name,
          parent_name: student.users?.name,
        };
      });

      setStudents(processedStudents);
      
    } catch (error) {
      console.error('Error fetching student data:', error);
      Alert.alert('Error', 'Failed to load student information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateAgeInfo = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return { age_months: 0, age_years: 0 };
    
    const birth = new Date(dateOfBirth);
    const today = new Date();
    
    const totalMonths = (today.getFullYear() - birth.getFullYear()) * 12 + 
                       (today.getMonth() - birth.getMonth());
    const years = Math.floor(totalMonths / 12);
    
    return {
      age_months: Math.max(0, totalMonths),
      age_years: years
    };
  };

  const findAgeGroup = (ageMonths: number, ageGroups: AgeGroup[]) => {
    return ageGroups.find(group => 
      ageMonths >= group.min_age_months && 
      ageMonths <= group.max_age_months
    );
  };

  const formatAge = (ageMonths: number, ageYears: number, schoolType: string) => {
    if (schoolType === 'preschool') {
      if (ageYears < 2) {
        return `${ageMonths} months`;
      } else {
        const remainingMonths = ageMonths % 12;
        return remainingMonths > 0 
          ? `${ageYears}y ${remainingMonths}m`
          : `${ageYears} years`;
      }
    } else {
      return `${ageYears} years`;
    }
  };

  const getAgeGroupColor = (ageGroupName: string | undefined, schoolType: string) => {
    if (!ageGroupName) return '#9CA3AF';
    
    if (schoolType === 'preschool') {
      switch (ageGroupName) {
        case 'Toddlers': return '#EC4899'; // Pink for toddlers
        case 'Preschool 3-4': return '#8B5CF6'; // Purple for 3-4 year olds
        case 'Preschool 4-5': return '#3B82F6'; // Blue for 4-5 year olds
        case 'Pre-K (Reception)': return '#059669'; // Green for school readiness
        default: return '#6B7280';
      }
    } else {
      // Primary/Secondary color coding by phase
      if (ageGroupName?.includes('Grade R') || ageGroupName?.includes('Grade 1-3')) return '#059669';
      if (ageGroupName?.includes('Grade 4-6')) return '#3B82F6';
      if (ageGroupName?.includes('Grade 7-9')) return '#8B5CF6';
      if (ageGroupName?.includes('Grade 10-12')) return '#DC2626';
      return '#6B7280';
    }
  };

  const filteredStudents = students.filter(student => {
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      if (!fullName.includes(searchLower)) return false;
    }
    
    if (filters.ageGroup) {
      if (filters.ageGroup === 'Unassigned') {
        if (student.age_group_name) return false; // Hide students with age groups
      } else {
        if (student.age_group_name !== filters.ageGroup) return false;
      }
    }
    if (filters.status && student.status !== filters.status) return false;
    if (filters.classId && student.class_id !== filters.classId) return false;
    
    return true;
  });

  const getSchoolTypeDisplay = (schoolType: string) => {
    switch (schoolType) {
      case 'preschool': return 'Pre-School';
      case 'primary': return 'Primary School';
      case 'secondary': return 'Secondary School';
      case 'combined': return 'Combined School';
      default: return 'School';
    }
  };

  const getAgeGroupStats = () => {
    const stats: Record<string, number> = {};
    filteredStudents.forEach(student => {
      const group = student.age_group_name || 'Unassigned';
      stats[group] = (stats[group] || 0) + 1;
    });
    return stats;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const handleStudentPress = (student: Student) => {
    router.push(`/screens/student-detail?studentId=${student.id}`);
  };

  const handleAddStudent = () => {
    router.push('/screens/student-enrollment');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </View>
    );
  }

  const ageGroupStats = getAgeGroupStats();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Student Management</Text>
            <Text style={styles.headerSubtitle}>
              {schoolInfo?.name} • {getSchoolTypeDisplay(schoolInfo?.school_type || 'preschool')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.filterButton}>
            <Ionicons name="filter" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{filteredStudents.length}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{Object.keys(ageGroupStats).length}</Text>
            <Text style={styles.statLabel}>Age Groups</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{classes.length}</Text>
            <Text style={styles.statLabel}>Classes</Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search students..."
          placeholderTextColor={theme.textSecondary}
          value={filters.searchTerm}
          onChangeText={(text) => setFilters({...filters, searchTerm: text})}
        />
        {filters.searchTerm ? (
          <TouchableOpacity onPress={() => setFilters({...filters, searchTerm: ''})} style={styles.searchIcon}>
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        ) : null}
        <Ionicons name="search-outline" size={20} color={theme.textSecondary} style={styles.searchIcon} />
      </View>

      {/* Age Group Overview for Preschools */}
      {schoolInfo?.school_type === 'preschool' && Object.keys(ageGroupStats).length > 0 && (
        <View style={styles.ageGroupOverview}>
          <Text style={styles.sectionTitle}>Age Group Distribution</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.ageGroupsRow}>
              {Object.entries(ageGroupStats).map(([groupName, count]) => (
                <TouchableOpacity
                  key={groupName}
                  style={[
                    styles.ageGroupChip,
                    { backgroundColor: getAgeGroupColor(groupName, schoolInfo.school_type) + '20' },
                    { borderColor: getAgeGroupColor(groupName, schoolInfo.school_type) }
                  ]}
                  onPress={() => {
                    const newFilter = filters.ageGroup === groupName ? '' : groupName;
                    setFilters({...filters, ageGroup: newFilter});
                  }}
                >
                  <Text style={[
                    styles.ageGroupName,
                    { color: getAgeGroupColor(groupName, schoolInfo.school_type) }
                  ]}>
                    {groupName}
                  </Text>
                  <Text style={styles.ageGroupCount}>{count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Students List */}
      <ScrollView
        style={styles.studentsList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredStudents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>
              {students.length === 0 ? 'No Students Enrolled' : 'No Students Match Filters'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {students.length === 0
                ? `Add your first student to this ${getSchoolTypeDisplay(schoolInfo?.school_type || 'preschool').toLowerCase()}`
                : 'Try adjusting your search or filter criteria'
              }
            </Text>
            {students.length === 0 && (
              <TouchableOpacity style={styles.addButton} onPress={handleAddStudent}>
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.addButtonText}>Add Student</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.studentsGrid}>
            {filteredStudents.map((student) => (
              <TouchableOpacity
                key={student.id}
                style={styles.studentCard}
                onPress={() => handleStudentPress(student)}
              >
                <View style={styles.studentHeader}>
                  <View style={[
                    styles.studentAvatar,
                    { backgroundColor: getAgeGroupColor(student.age_group_name, schoolInfo?.school_type || 'preschool') }
                  ]}>
                    <Text style={styles.studentInitials}>
                      {student.first_name[0]}{student.last_name[0]}
                    </Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {student.first_name} {student.last_name}
                    </Text>
                    <Text style={styles.studentAge}>
                      {formatAge(student.age_months, student.age_years, schoolInfo?.school_type || 'preschool')}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.studentDetails}>
                  {student.age_group_name && (
                    <View style={[
                      styles.ageGroupBadge,
                      { backgroundColor: getAgeGroupColor(student.age_group_name, schoolInfo?.school_type || 'preschool') + '20' }
                    ]}>
                      <Text style={[
                        styles.ageGroupBadgeText,
                        { color: getAgeGroupColor(student.age_group_name, schoolInfo?.school_type || 'preschool') }
                      ]}>
                        {student.age_group_name}
                      </Text>
                    </View>
                  )}
                  
                  {student.class_name && (
                    <Text style={styles.classInfo}>📚 {student.class_name}</Text>
                  )}
                  
                  {student.parent_name && (
                    <Text style={styles.parentInfo}>👨‍👩‍👧‍👦 {student.parent_name}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Student FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleAddStudent}>
        <Ionicons name="add" size={24} color={theme.onPrimary} />
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.filterModal}>
          <View style={styles.filterHeader}>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Text style={styles.filterCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.filterTitle}>Filter Students</Text>
            <TouchableOpacity 
              onPress={() => {
                setFilters({searchTerm: '', ageGroup: '', status: '', classId: ''});
                setShowFilters(false);
              }}
            >
              <Text style={styles.filterClear}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          {/* Filter options would go here */}
          <ScrollView style={styles.filterContent}>
            <Text style={styles.filterNote}>
              Filter by age group, class, or status to find specific students.
              {schoolInfo?.school_type === 'preschool' 
                ? ' Age groups are designed for developmental stages.'
                : ' Grades follow the South African education system.'
              }
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
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
    backgroundColor: theme.background,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.textSecondary,
  },
  header: {
    backgroundColor: theme.primary,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.onPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.onPrimary + 'CC',
    marginTop: 2,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.onPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.onPrimary + 'CC',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
  },
  ageGroupOverview: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  ageGroupsRow: {
    flexDirection: 'row',
    paddingRight: 20,
  },
  ageGroupChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  ageGroupName: {
    fontSize: 14,
    fontWeight: '600',
  },
  ageGroupCount: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  studentsList: {
    flex: 1,
  },
  studentsGrid: {
    padding: 20,
    paddingTop: 0,
  },
  studentCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentInitials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  studentAge: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  studentDetails: {
    gap: 8,
  },
  ageGroupBadge: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ageGroupBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  classInfo: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  parentInfo: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  addButtonText: {
    color: theme.onPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  filterModal: {
    flex: 1,
    backgroundColor: theme.background,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  filterCancel: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  filterClear: {
    fontSize: 16,
    color: theme.primary,
    fontWeight: '600',
  },
  filterContent: {
    flex: 1,
    padding: 20,
  },
  filterNote: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});
