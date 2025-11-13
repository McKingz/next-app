/**
 * Class and Teacher Management Screen
 * 
 * Principal Hub functionality for managing:
 * - Classes (create, edit, assign teachers)
 * - Teachers (assign to classes, view performance)
 * - Class capacity and enrollment
 * - Teacher workload and ratios
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { navigateBack } from '@/lib/navigation';
import { navigateTo } from '@/lib/navigation/router-utils';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Picker } from '@react-native-picker/picker';

interface ClassInfo {
  id: string;
  name: string;
  grade_level: string;
  capacity: number;
  current_enrollment: number;
  teacher_id: string | null;
  teacher_name?: string;
  is_active: boolean;
  room_number?: string;
  schedule?: string;
  created_at: string;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  specialization?: string;
  status: 'active' | 'inactive';
  hire_date: string;
  classes_assigned: number;
  students_count: number;
}

export default function ClassTeacherManagementScreen() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
// useRouter not needed; using router singleton from expo-router
  
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'classes' | 'teachers'>('classes');
  
  // Modals
  const [showClassModal, setShowClassModal] = useState(false);
  const [showTeacherAssignment, setShowTeacherAssignment] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  
  // Form states
  const [classForm, setClassForm] = useState({
    name: '',
    grade_level: '',
    capacity: 25,
    room_number: '',
    teacher_id: '',
  });

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Resolve preschool (school) ID and organization ID robustly across schemas
      let schoolId: string | null = (user.user_metadata as any)?.preschool_id || null;
      let orgId: string | null = (user.user_metadata as any)?.organization_id || null;
      if (!schoolId || !orgId) {
        try {
          const { data: prof } = await assertSupabase()
            .from('profiles')
            .select('preschool_id, organization_id')
            .eq('id', user.id)
            .maybeSingle();
          schoolId = schoolId || (prof as any)?.preschool_id || null;
          orgId = orgId || (prof as any)?.organization_id || null;
        } catch { /* Intentional: non-fatal */ }
      }
      if (!schoolId) {
        try {
          const { data: userRow } = await assertSupabase()
            .from('users')
            .select('preschool_id')
            .eq('auth_user_id', user.id)
            .maybeSingle();
          schoolId = (userRow as any)?.preschool_id || null;
        } catch { /* Intentional: non-fatal */ }
      }

      if (!schoolId && !orgId) {
        Alert.alert('Error', 'No school or organization assigned to your account');
        return;
      }

      // Load classes with teacher and enrollment information using the same pattern as TeacherDashboard
      const { data: classesData, error: classesError } = await assertSupabase()
        .from('classes')
        .select(`
          id,
          name,
          grade_level,
          capacity,
          teacher_id,
          is_active,
          room_number,
          schedule,
          created_at,
          users!classes_teacher_id_fkey (
            id,
            first_name,
            last_name,
            name
          ),
          students(id)
        `)
        .eq('preschool_id', schoolId)
        .order('name');

      if (classesError) {
        console.error('Error loading classes:', classesError);
      }

      // Compute student counts per class from the joined students array (avoids N+1 queries)
      const processedClasses = (classesData || []).map((cls: any) => {
        const teacher = cls.users || null;
        const teacherName = teacher
          ? ((teacher.first_name && teacher.last_name)
              ? `${teacher.first_name} ${teacher.last_name}`
              : (teacher.name || null))
          : null;
        const studentCount = Array.isArray(cls.students) ? cls.students.length : 0;
        return {
          id: cls.id,
          name: cls.name,
          grade_level: cls.grade_level,
          capacity: cls.capacity || 25,
          current_enrollment: studentCount || 0,
          teacher_id: cls.teacher_id,
          teacher_name: teacherName || undefined,
          is_active: cls.is_active,
          room_number: cls.room_number,
          schedule: cls.schedule,
          created_at: cls.created_at,
        } as ClassInfo;
      });

      setClasses(processedClasses);

      // Load teachers based on organization membership + users (aligns with TeacherDashboard)
      const { data: teacherMembers, error: teacherMembersError } = await assertSupabase()
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', orgId || schoolId)
        .ilike('role', '%teacher%');

      if (teacherMembersError) {
        console.error('Error loading teacher memberships:', teacherMembersError);
      }

      const teacherAuthIds: string[] = (teacherMembers || [])
        .map((m: any) => m.user_id)
        .filter((v: any) => !!v);

      let teacherUsers: any[] = [];
      if (teacherAuthIds.length > 0) {
        const { data: usersData } = await assertSupabase()
          .from('users')
          .select('id, auth_user_id, email, first_name, last_name, name, role, created_at')
          .in('auth_user_id', teacherAuthIds);
        teacherUsers = usersData || [];
      }

      // Fallback: if membership is empty, try users table by preschool and role
      if (teacherUsers.length === 0) {
        const { data: fallbackUsers } = await assertSupabase()
          .from('users')
          .select('id, auth_user_id, email, first_name, last_name, name, role, created_at')
          .eq('preschool_id', schoolId)
          .ilike('role', '%teacher%');
        teacherUsers = fallbackUsers || [];
      }

      // Aggregate classes and student counts per teacher from processedClasses
      const classesByTeacher: Record<string, ClassInfo[]> = {};
      for (const cls of processedClasses) {
        if (!cls.teacher_id) continue;
        if (!classesByTeacher[cls.teacher_id]) classesByTeacher[cls.teacher_id] = [];
        classesByTeacher[cls.teacher_id].push(cls);
      }

      const processedTeachers: Teacher[] = (teacherUsers || []).map((u: any) => {
        const tClasses = classesByTeacher[u.id] || [];
        const classes_assigned = tClasses.length;
        const students_count = tClasses.reduce((sum, c) => sum + (c.current_enrollment || 0), 0);
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.email;
        return {
          id: u.id,
          full_name: fullName,
          email: u.email,
          phone: undefined,
          specialization: '',
          status: 'active',
          hire_date: u.created_at || new Date().toISOString(),
          classes_assigned,
          students_count,
        } as Teacher;
      });

      setTeachers(processedTeachers);

    } catch (error) {
      console.error('Error loading class/teacher data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Memoize filtered lists for better performance
  const activeTeachers = useMemo(() => 
    teachers.filter(t => t.status === 'active'),
    [teachers]
  );

  const activeClasses = useMemo(() => 
    classes.filter(c => c.is_active),
    [classes]
  );

  const handleCreateClass = async () => {
    if (!classForm.name.trim() || !classForm.grade_level.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      // Resolve school again to be safe
      let schoolId: string | null = (user?.user_metadata as any)?.preschool_id || null;
      if (!schoolId && user?.id) {
        const { data: prof } = await assertSupabase()
          .from('profiles')
          .select('preschool_id')
          .eq('id', user.id)
          .maybeSingle();
        schoolId = (prof as any)?.preschool_id || null;
      }

      const { error } = await assertSupabase()
        .from('classes')
        .insert({
          name: classForm.name.trim(),
          grade_level: classForm.grade_level.trim(),
          capacity: classForm.capacity,
          room_number: classForm.room_number.trim() || null,
          teacher_id: classForm.teacher_id || null,
          preschool_id: schoolId,
          is_active: true,
        });

      if (error) {
        Alert.alert('Error', 'Failed to create class');
        return;
      }

      Alert.alert('Success', 'Class created successfully');
      setShowClassModal(false);
      setClassForm({
        name: '',
        grade_level: '',
        capacity: 25,
        room_number: '',
        teacher_id: '',
      });
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to create class');
    }
  };

  const handleAssignTeacher = async () => {
    if (!selectedClass || !classForm.teacher_id) return;

    try {
      const { error } = await assertSupabase()
        .from('classes')
        .update({ teacher_id: classForm.teacher_id })
        .eq('id', selectedClass.id);

      if (error) {
        Alert.alert('Error', 'Failed to assign teacher');
        return;
      }

      Alert.alert('Success', 'Teacher assigned successfully');
      setShowTeacherAssignment(false);
      setSelectedClass(null);
      setClassForm(prev => ({ ...prev, teacher_id: '' }));
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to assign teacher');
    }
  };

  const handleRemoveTeacher = (classInfo: ClassInfo) => {
    Alert.alert(
      'Remove Teacher',
      `Remove ${classInfo.teacher_name} from ${classInfo.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await assertSupabase()
                .from('classes')
                .update({ teacher_id: null })
                .eq('id', classInfo.id);

              if (error) {
                Alert.alert('Error', 'Failed to remove teacher');
                return;
              }

              Alert.alert('Success', 'Teacher removed from class');
              loadData();
            } catch {
              Alert.alert('Error', 'Failed to remove teacher');
            }
          },
        },
      ]
    );
  };

  const handleToggleClassStatus = async (classInfo: ClassInfo) => {
    try {
      const { error } = await assertSupabase()
        .from('classes')
        .update({ is_active: !classInfo.is_active })
        .eq('id', classInfo.id);

      if (error) {
        Alert.alert('Error', 'Failed to update class status');
        return;
      }

      loadData();
    } catch {
      Alert.alert('Error', 'Failed to update class status');
    }
  };

  const getClassStatusColor = (classInfo: ClassInfo) => {
    if (!classInfo.is_active) return theme.textSecondary;
    if (classInfo.current_enrollment >= classInfo.capacity) return theme.error;
    if (classInfo.current_enrollment >= classInfo.capacity * 0.8) return theme.warning;
    return theme.success;
  };

  const getTeacherWorkloadColor = (teacher: Teacher) => {
    if (teacher.students_count > 30) return theme.error;
    if (teacher.students_count > 20) return theme.warning;
    return theme.success;
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const styles = getStyles(theme);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}>
          <Ionicons name="school-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.loadingText}>Loading class and teacher data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateBack('/screens/principal-dashboard')}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Class & Teacher Management</Text>
        <TouchableOpacity onPress={() => setShowClassModal(true)}>
          <Ionicons name="add" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'classes' && styles.activeTab]}
          onPress={() => setActiveTab('classes')}
        >
          <Text style={[styles.tabText, activeTab === 'classes' && styles.activeTabText]}>
            Classes ({classes.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'teachers' && styles.activeTab]}
          onPress={() => setActiveTab('teachers')}
        >
          <Text style={[styles.tabText, activeTab === 'teachers' && styles.activeTabText]}>
            Teachers ({teachers.filter(t => t.status === 'active').length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'classes' ? (
          /* Classes Tab */
          <View style={styles.content}>
            {classes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="school-outline" size={64} color={theme.textSecondary} />
                <Text style={styles.emptyTitle}>No Classes Created</Text>
                <Text style={styles.emptySubtitle}>Create your first class to start organizing students</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => setShowClassModal(true)}>
                  <Ionicons name="add" size={20} color={theme.onPrimary} />
                  <Text style={styles.addButtonText}>Create Class</Text>
                </TouchableOpacity>
              </View>
            ) : (
              classes.map((classInfo) => (
                <View key={classInfo.id} style={styles.classCard}>
                  <View style={styles.classHeader}>
                    <View style={styles.classInfo}>
                      <Text style={styles.className}>{classInfo.name}</Text>
                      <Text style={styles.gradeLevel}>{classInfo.grade_level}</Text>
                      {classInfo.room_number && (
                        <Text style={styles.roomNumber}>Room {classInfo.room_number}</Text>
                      )}
                    </View>
                    <View style={styles.classActions}>
                      <Switch
                        value={classInfo.is_active}
                        onValueChange={() => handleToggleClassStatus(classInfo)}
                        trackColor={{ false: theme.border, true: theme.success }}
                        thumbColor={classInfo.is_active ? theme.onPrimary : theme.textSecondary}
                      />
                    </View>
                  </View>

                  <View style={styles.classDetails}>
                    <View style={styles.enrollmentInfo}>
                      <Text style={styles.enrollmentLabel}>Enrollment</Text>
                      <Text style={[
                        styles.enrollmentValue,
                        { color: getClassStatusColor(classInfo) }
                      ]}>
                        {classInfo.current_enrollment}/{classInfo.capacity}
                      </Text>
                    </View>

                    <View style={styles.teacherInfo}>
                      {classInfo.teacher_name ? (
                        <View style={styles.assignedTeacher}>
                          <Text style={styles.teacherLabel}>Teacher</Text>
                          <Text style={styles.teacherName}>{classInfo.teacher_name}</Text>
                          <TouchableOpacity onPress={() => handleRemoveTeacher(classInfo)}>
                            <Ionicons name="close-circle" size={20} color={theme.error} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.assignTeacherButton}
                          onPress={() => {
                            setSelectedClass(classInfo);
                            setShowTeacherAssignment(true);
                          }}
                        >
                          <Ionicons name="person-add" size={16} color={theme.primary} />
                          <Text style={styles.assignTeacherText}>Assign Teacher</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View style={styles.classFooter}>
                    <TouchableOpacity
                      style={styles.viewStudentsButton}
                      onPress={() => navigateTo.classStudents(classInfo.id)}
                    >
                      <Ionicons name="people" size={16} color={theme.accent} />
                      <Text style={styles.viewStudentsText}>View Students</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.editClassButton}
                      onPress={() => navigateTo.editClass(classInfo.id)}
                    >
                      <Ionicons name="create" size={16} color={theme.textSecondary} />
                      <Text style={styles.editClassText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          /* Teachers Tab */
          <View style={styles.content}>
            {teachers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={theme.textSecondary} />
                <Text style={styles.emptyTitle}>No Teachers Added</Text>
                <Text style={styles.emptySubtitle}>Add teachers to assign them to classes</Text>
                <TouchableOpacity 
                  style={styles.addButton} 
                  onPress={() => navigateTo.addTeacher()}
                >
                  <Ionicons name="person-add" size={20} color={theme.onPrimary} />
                  <Text style={styles.addButtonText}>Add Teacher</Text>
                </TouchableOpacity>
              </View>
            ) : (
              teachers.map((teacher) => (
                <View key={teacher.id} style={styles.teacherCard}>
                  <View style={styles.teacherHeader}>
                    <View style={styles.teacherCardInfo}>
                      <Text style={styles.teacherCardName}>{teacher.full_name}</Text>
                      <Text style={styles.teacherEmail}>{teacher.email}</Text>
                      {teacher.specialization && (
                        <Text style={styles.teacherSpecialization}>{teacher.specialization}</Text>
                      )}
                    </View>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: teacher.status === 'active' ? theme.success : theme.error }
                    ]}>
                      <Text style={styles.statusText}>{teacher.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.teacherStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{teacher.classes_assigned}</Text>
                      <Text style={styles.statLabel}>Classes</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[
                        styles.statValue,
                        { color: getTeacherWorkloadColor(teacher) }
                      ]}>
                        {teacher.students_count}
                      </Text>
                      <Text style={styles.statLabel}>Students</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {new Date(teacher.hire_date).getFullYear()}
                      </Text>
                      <Text style={styles.statLabel}>Since</Text>
                    </View>
                  </View>

                  <View style={styles.teacherActions}>
                    <TouchableOpacity
                      style={styles.viewClassesButton}
                      onPress={() => navigateTo.teacherClasses(teacher.id)}
                    >
                      <Text style={styles.viewClassesText}>View Classes</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.editTeacherButton}
                      onPress={() => navigateTo.editTeacher(teacher.id)}
                    >
                      <Ionicons name="create" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Create Class Modal */}
      <Modal
        visible={showClassModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClassModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowClassModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create New Class</Text>
            <TouchableOpacity onPress={handleCreateClass}>
              <Text style={styles.modalSave}>Create</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Class Name *</Text>
              <TextInput
                style={styles.formInput}
                value={classForm.name}
                onChangeText={(text) => setClassForm(prev => ({ ...prev, name: text }))}
                placeholder="e.g., Grade R-A"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Grade Level *</Text>
              <Picker
                selectedValue={classForm.grade_level}
                onValueChange={(value) => setClassForm(prev => ({ ...prev, grade_level: value }))}
                style={styles.formPicker}
              >
                <Picker.Item label="Select grade level..." value="" />
                <Picker.Item label="Toddlers (18m - 2y)" value="Toddlers" />
                <Picker.Item label="Grade R" value="Grade R" />
                <Picker.Item label="Grade 1" value="Grade 1" />
                <Picker.Item label="Grade 2" value="Grade 2" />
                <Picker.Item label="Grade 3" value="Grade 3" />
                <Picker.Item label="Grade 4" value="Grade 4" />
                <Picker.Item label="Grade 5" value="Grade 5" />
                <Picker.Item label="Grade 6" value="Grade 6" />
                <Picker.Item label="Grade 7" value="Grade 7" />
              </Picker>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Class Capacity</Text>
              <TextInput
                style={styles.formInput}
                value={classForm.capacity.toString()}
                onChangeText={(text) => setClassForm(prev => ({ 
                  ...prev, 
                  capacity: parseInt(text) || 25 
                }))}
                keyboardType="numeric"
                placeholder="25"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Room Number (Optional)</Text>
              <TextInput
                style={styles.formInput}
                value={classForm.room_number}
                onChangeText={(text) => setClassForm(prev => ({ ...prev, room_number: text }))}
                placeholder="e.g., 101"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Assign Teacher (Optional)</Text>
              <Picker
                selectedValue={classForm.teacher_id}
                onValueChange={(value) => setClassForm(prev => ({ ...prev, teacher_id: value }))}
                style={styles.formPicker}
              >
                <Picker.Item label="No teacher assigned" value="" />
                {teachers.filter(t => t.status === 'active').map(teacher => (
                  <Picker.Item
                    key={teacher.id}
                    label={`${teacher.full_name} (${teacher.classes_assigned} classes)`}
                    value={teacher.id}
                  />
                ))}
              </Picker>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Teacher Assignment Modal */}
      <Modal
        visible={showTeacherAssignment}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTeacherAssignment(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTeacherAssignment(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Assign Teacher</Text>
            <TouchableOpacity 
              onPress={handleAssignTeacher} 
              disabled={!classForm.teacher_id}
            >
              <Text style={[
                styles.modalSave,
                { color: classForm.teacher_id ? theme.primary : theme.textSecondary }
              ]}>
                Assign
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.pickerLabel}>
              Select a teacher for {selectedClass?.name}:
            </Text>
            <Picker
              selectedValue={classForm.teacher_id}
              onValueChange={(value) => setClassForm(prev => ({ ...prev, teacher_id: value }))}
              style={styles.picker}
            >
              <Picker.Item label="Select a teacher..." value="" />
              {teachers.filter(t => t.status === 'active').map(teacher => (
                <Picker.Item
                  key={teacher.id}
                  label={`${teacher.full_name} (${teacher.classes_assigned} classes, ${teacher.students_count} students)`}
                  value={teacher.id}
                />
              ))}
            </Picker>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
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
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.primary,
  },
  tabText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  activeTabText: {
    color: theme.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
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
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: theme.onPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  classCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  gradeLevel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  roomNumber: {
    fontSize: 12,
    color: theme.accent,
  },
  classActions: {
    alignItems: 'flex-end',
  },
  classDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  enrollmentInfo: {
    flex: 1,
  },
  enrollmentLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  enrollmentValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  teacherInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  assignedTeacher: {
    alignItems: 'flex-end',
  },
  teacherLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  teacherName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
  },
  assignTeacherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: theme.elevated,
    borderRadius: 6,
  },
  assignTeacherText: {
    fontSize: 12,
    color: theme.primary,
    marginLeft: 4,
  },
  classFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  viewStudentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  viewStudentsText: {
    fontSize: 14,
    color: theme.accent,
    marginLeft: 4,
  },
  editClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  editClassText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginLeft: 4,
  },
  teacherCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teacherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  teacherCardInfo: {
    flex: 1,
  },
  teacherCardName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  teacherEmail: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  teacherSpecialization: {
    fontSize: 12,
    color: theme.accent,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: theme.onPrimary,
    fontWeight: '500',
  },
  teacherStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  teacherActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewClassesButton: {
    flex: 1,
    backgroundColor: theme.elevated,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 8,
  },
  viewClassesText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },
  editTeacherButton: {
    padding: 12,
    backgroundColor: theme.elevated,
    borderRadius: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
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
    color: theme.primary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: theme.surface,
    color: theme.text,
  },
  formPicker: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    color: theme.text,
  },
  pickerLabel: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 16,
  },
  picker: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    color: theme.text,
  },
});
