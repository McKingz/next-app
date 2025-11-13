/**
 * Teacher Management Screen
 * 
 * Allows principals to view, add, and manage teaching staff
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { TeacherInviteService } from '@/lib/services/teacherInviteService';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { navigateBack } from '@/lib/navigation';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { TeacherDocumentsService, TeacherDocument, TeacherDocType } from '@/lib/services/TeacherDocumentsService';
import * as DocumentPicker from 'expo-document-picker';
// NEW: Import seat management hooks and types
import { useSeatLimits, useTeacherHasSeat } from '@/lib/hooks/useSeatLimits';
import { SeatUsageDisplay } from '@/lib/types/seats';

interface Teacher {
  id: string; // primary key from teachers table
  teacherUserId: string; // public.users.id (seat RPC expects this)
  authUserId: string | null; // auth.users.id (nullable)
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  idNumber: string;
  status: 'active' | 'inactive' | 'pending' | 'probation' | 'suspended';
  contractType: 'permanent' | 'temporary' | 'substitute' | 'probationary';
  classes: string[];
  subjects: string[];
  qualifications: string[];
  studentCount?: number;
  hireDate: string;
  contractEndDate?: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  salary: {
    basic: number;
    allowances: number;
    deductions: number;
    net: number;
    payScale: string;
  };
  performance: {
    rating: number; // 1-5
    lastReviewDate: string;
    strengths: string[];
    improvementAreas: string[];
    goals: string[];
  };
  documents: Record<string, TeacherDocument>;
  attendance: {
    daysPresent: number;
    daysAbsent: number;
    lateArrivals: number;
    leaveBalance: number;
  };
  workload: {
    teachingHours: number;
    adminDuties: string[];
    extraCurricular: string[];
  };
}

type TeacherManagementView = 'overview' | 'hiring' | 'performance' | 'payroll' | 'profile';

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  appliedFor: string;
  applicationDate: string;
  status: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
  qualifications: string[];
  experience: number;
  expectedSalary: number;
  availableFrom: string;
  notes: string;
}

interface HiringCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  appliedFor: string;
  applicationDate: string;
  status: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
  qualifications: string[];
  experience: number;
  expectedSalary: number;
  availableFrom: string;
  notes: string;
}

export default function TeacherManagement() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [invites, setInvites] = useState<Array<{ id: string; email: string; status: string; created_at: string }>>([]);
  const [currentView, setCurrentView] = useState<TeacherManagementView>('overview');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [teacherDocsMap, setTeacherDocsMap] = useState<Record<string, TeacherDocument | undefined>>({ /* TODO: Implement */ });
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  // Hiring hub state
  const [availableTeachers, setAvailableTeachers] = useState<Array<{ id: string; name: string; email: string; phone?: string; home_city?: string | null; home_postal_code?: string | null; distance_km?: number }>>([]);
  const [hiringSearch, setHiringSearch] = useState('');
  const [radiusKm, setRadiusKm] = useState<number>(10);
  
  // NEW: Seat management integration
  const {
    seatUsageDisplay,
    shouldDisableAssignment,
    assignSeat,
    revokeSeat,
    isAssigning,
    isRevoking,
    isLoading: seatLimitsLoading,
    isError: seatLimitsError,
    refetch: refetchSeatLimits,
  } = useSeatLimits();
  const selectedTeacherHasSeat = useTeacherHasSeat(selectedTeacher?.teacherUserId ?? '__none__');
  
  // Get preschool ID from user context
  const getPreschoolId = useCallback((): string | null => {
    if (profile?.organization_id) {
      return profile.organization_id as string;
    }
    return user?.user_metadata?.preschool_id || null;
  }, [profile, user]);



  // Fetch real teachers from database
  const fetchTeachers = useCallback(async () => {
    const preschoolId = getPreschoolId();
    
if (!preschoolId) {
      console.warn('No preschool ID available or Supabase not initialized');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('🔍 Fetching real teachers for preschool:', preschoolId);
      
      // Query teachers table with document columns
      const { data: teachersData, error: teachersError } = await assertSupabase()
        .from('teachers')
        .select(`
          id,
          user_id,
          auth_user_id,
          email,
          full_name,
          preschool_id,
          is_active,
          created_at,
          cv_file_path, cv_file_name, cv_mime_type, cv_file_size, cv_uploaded_at, cv_uploaded_by,
          qualifications_file_path, qualifications_file_name, qualifications_mime_type, qualifications_file_size, qualifications_uploaded_at, qualifications_uploaded_by,
          id_copy_file_path, id_copy_file_name, id_copy_mime_type, id_copy_file_size, id_copy_uploaded_at, id_copy_uploaded_by,
          contracts_file_path, contracts_file_name, contracts_mime_type, contracts_file_size, contracts_uploaded_at, contracts_uploaded_by
        `)
        .eq('preschool_id', preschoolId)
        .eq('is_active', true);
        
      if (teachersError) {
        console.error('Error fetching teachers:', teachersError);
        Alert.alert('Error', 'Failed to load teachers. Please try again.');
        return;
      }
      
      console.log('✅ Real teachers fetched:', teachersData?.length || 0);
      
      // Query secure tenant-isolated view for per-teacher class and student stats
      const { data: overviewRows, error: overviewError } = await assertSupabase()
        .from('vw_teacher_overview')
        .select('email, class_count, student_count, classes_text');
      if (overviewError) {
        console.warn('[TeacherManagement] vw_teacher_overview error:', overviewError);
      }
      const overviewByEmail = new Map<string, { class_count: number; student_count: number; classes_text: string }>();
      (overviewRows || []).forEach((row: any) => {
        if (row?.email) overviewByEmail.set(String(row.email).toLowerCase(), {
          class_count: Number(row.class_count || 0),
          student_count: Number(row.student_count || 0),
          classes_text: String(row.classes_text || ''),
        });
      });
      
      const parseClasses = (text?: string): string[] => {
        const t = (text || '').trim();
        if (!t) return [];
        return t.split(',').map(s => s.trim()).filter(Boolean);
      };
      
      // Transform database data to match Teacher interface
      const transformedTeachersRaw: (Teacher | null)[] = (teachersData || []).map((dbTeacher: any) => {
        // Try to get name from teachers table first, fallback to users/profiles table
        let fullName = dbTeacher.full_name;

        // If full_name is null/empty, use fallback logic (synchronous)
        if (!fullName) {
          console.log('[fetchTeachers] full_name is null, using fallback for:', dbTeacher.email);

          // For now, use email-based fallback (can be enhanced later with proper async lookups)
          if (dbTeacher.email) {
            fullName = dbTeacher.email.split('@')[0];
            console.log('[fetchTeachers] Using email fallback:', fullName);
          }

          // TODO: In production, consider implementing proper async lookups:
          // 1. Query users table by user_id for name data
          // 2. Query profiles table by auth_user_id for name data
          // 3. Cache results for performance
        }

        // Final fallback if still no name
        if (!fullName) {
          console.warn('[fetchTeachers] Using email as fallback for name:', dbTeacher.email);
          fullName = dbTeacher.email.split('@')[0] || 'Unknown Teacher';
        }

        // Convert document data from teachers table format to TeacherDocument format
        const documents: Record<string, TeacherDocument> = { /* TODO: Implement */ };

        // CV document
        if (dbTeacher.cv_file_path) {
          documents.cv = {
            id: `cv_${dbTeacher.id}`,
            teacher_user_id: dbTeacher.id,
            preschool_id: dbTeacher.preschool_id || preschoolId || '',
            doc_type: 'cv',
            file_path: dbTeacher.cv_file_path,
            file_name: dbTeacher.cv_file_name || 'CV',
            mime_type: dbTeacher.cv_mime_type || 'application/pdf',
            file_size: dbTeacher.cv_file_size || 0,
            uploaded_by: dbTeacher.cv_uploaded_by || '',
            created_at: dbTeacher.cv_uploaded_at || dbTeacher.created_at,
            updated_at: dbTeacher.updated_at || dbTeacher.created_at
          };
        }

        // Qualifications document
        if (dbTeacher.qualifications_file_path) {
          documents.qualifications = {
            id: `qualifications_${dbTeacher.id}`,
            teacher_user_id: dbTeacher.id,
            preschool_id: dbTeacher.preschool_id || preschoolId || '',
            doc_type: 'qualifications',
            file_path: dbTeacher.qualifications_file_path,
            file_name: dbTeacher.qualifications_file_name || 'Qualifications',
            mime_type: dbTeacher.qualifications_mime_type || 'application/pdf',
            file_size: dbTeacher.qualifications_file_size || 0,
            uploaded_by: dbTeacher.qualifications_uploaded_by || '',
            created_at: dbTeacher.qualifications_uploaded_at || dbTeacher.created_at,
            updated_at: dbTeacher.updated_at || dbTeacher.created_at
          };
        }

        // ID Copy document
        if (dbTeacher.id_copy_file_path) {
          documents.id_copy = {
            id: `id_copy_${dbTeacher.id}`,
            teacher_user_id: dbTeacher.id,
            preschool_id: dbTeacher.preschool_id || preschoolId || '',
            doc_type: 'id_copy',
            file_path: dbTeacher.id_copy_file_path,
            file_name: dbTeacher.id_copy_file_name || 'ID Copy',
            mime_type: dbTeacher.id_copy_mime_type || 'image/jpeg',
            file_size: dbTeacher.id_copy_file_size || 0,
            uploaded_by: dbTeacher.id_copy_uploaded_by || '',
            created_at: dbTeacher.id_copy_uploaded_at || dbTeacher.created_at,
            updated_at: dbTeacher.updated_at || dbTeacher.created_at
          };
        }

        // Contracts document
        if (dbTeacher.contracts_file_path) {
          documents.contracts = {
            id: `contracts_${dbTeacher.id}`,
            teacher_user_id: dbTeacher.id,
            preschool_id: dbTeacher.preschool_id || preschoolId || '',
            doc_type: 'contracts',
            file_path: dbTeacher.contracts_file_path,
            file_name: dbTeacher.contracts_file_name || 'Contracts',
            mime_type: dbTeacher.contracts_mime_type || 'application/pdf',
            file_size: dbTeacher.contracts_file_size || 0,
            uploaded_by: dbTeacher.contracts_uploaded_by || '',
            created_at: dbTeacher.contracts_uploaded_at || dbTeacher.created_at,
            updated_at: dbTeacher.updated_at || dbTeacher.created_at
          };
        }

        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.slice(1).join(' ') || 'Teacher';

        // Debug logging for data transformation
        // teacherUserId must be the public.users.id (user_id)
        const teacherUserId = dbTeacher.user_id;

        // Preserve auth_user_id separately for document lookups
        const authUserId = dbTeacher.auth_user_id || null;

        if (!teacherUserId) {
          console.error('[fetchTeachers] Skipping teacher due to missing user_id:', {
            teacherEmail: dbTeacher.email,
            teacherId: dbTeacher.id,
            authUserId
          });
          return null;
        }

        console.log('[fetchTeachers TRANSFORM DEBUG]', {
          dbTeacher: {
            id: dbTeacher.id,
            user_id: dbTeacher.user_id,
            auth_user_id: dbTeacher.auth_user_id,
            email: dbTeacher.email,
            full_name: dbTeacher.full_name,
          },
          nameResolution: {
            originalFullName: dbTeacher.full_name,
            resolvedFullName: fullName,
            source: dbTeacher.full_name ? 'teachers.full_name' : 'users/profiles fallback',
          },
          transformed: {
            teacherUserId,
            authUserId,
            firstName,
            lastName,
          }
        });

        return {
          id: dbTeacher.id,
          teacherUserId,
          authUserId,
          employeeId: `EMP${dbTeacher.id.slice(0, 3)}`,
          firstName,
          lastName,
          email: dbTeacher.email || 'No email',
          phone: 'No phone', // teachers table doesn't have phone field
          address: 'Address not available',
          idNumber: 'ID not available',
          status: 'active' as const,
          contractType: 'permanent' as const,
          // Use secure view stats by email (tenant-isolated)
          classes: parseClasses(overviewByEmail.get(String(dbTeacher.email || '').toLowerCase())?.classes_text),
          subjects: ['General Education'], // TODO: Get from teacher specialization
          qualifications: ['Teaching Qualification'],
          studentCount: overviewByEmail.get(String(dbTeacher.email || '').toLowerCase())?.student_count || 0,
          hireDate: dbTeacher.created_at?.split('T')[0] || '2024-01-01',
          // Use resolved fullName instead of dbTeacher.full_name
          fullName: fullName,
          emergencyContact: {
            name: 'Emergency contact not available',
            phone: 'Not available',
            relationship: 'Unknown'
          },
          salary: {
            basic: 25000,
            allowances: 2000,
            deductions: 4000,
            net: 23000,
            payScale: 'Level 3'
          },
          performance: {
            rating: 4.0,
            lastReviewDate: '2024-08-01',
            strengths: ['Dedicated teacher'],
            improvementAreas: ['Professional development'],
            goals: ['Continuous improvement']
          },
documents: documents,
          attendance: {
            daysPresent: 180,
            daysAbsent: 5,
            lateArrivals: 2,
            leaveBalance: 15
          },
          workload: {
            teachingHours: 25,
            adminDuties: ['General duties'],
            extraCurricular: ['TBD']
          }
        };
      });

      // Filter out null values (teachers without valid user IDs)
      const transformedTeachers = transformedTeachersRaw.filter((teacher): teacher is Teacher => teacher !== null);

      console.log('✅ Valid teachers after filtering:', transformedTeachers.length);

      setTeachers(transformedTeachers);
      
      // No mock candidates in production; leave empty until real data source is available
    } catch (_error) {
      console.error('Failed to fetch teachers:', _error);
      Alert.alert('Error', 'Failed to load teacher data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [getPreschoolId]);
  
  useEffect(() => {
    loadInvites();
    fetchTeachers();
    fetchAvailableCandidates();
  }, [fetchTeachers]);

  const [showInviteModal, setShowInviteModal] = useState(false);


  const fetchAvailableCandidates = useCallback(async () => {
    try {
      setLoading(true);
      const schoolId = getPreschoolId();
      if (schoolId) {
        const { data, error } = await assertSupabase().rpc('rpc_find_available_teachers_near', {
          school_id: schoolId,
          radius_km: radiusKm,
          subject_filter: null,
        });
        if (!error && Array.isArray(data)) {
          let list = data as any[];
          if (hiringSearch && hiringSearch.trim()) {
            const term = hiringSearch.trim().toLowerCase();
            list = list.filter((x) =>
              (x.full_name || '').toLowerCase().includes(term) ||
              (x.email || '').toLowerCase().includes(term) ||
              (x.home_city || '').toLowerCase().includes(term) ||
              (x.home_postal_code || '').toLowerCase().includes(term)
            );
          }
          setAvailableTeachers(list.map((x) => ({
            id: x.user_id,
            name: x.full_name || x.email || 'Teacher',
            email: x.email,
            phone: x.phone,
            home_city: x.home_city,
            home_postal_code: x.home_postal_code,
            distance_km: x.distance_km,
          })));
          return;
        }
      }
      // Fallback when RPC not available or school has no coordinates
      const base = assertSupabase()
        .from('users')
        .select('id, auth_user_id, email, name, phone, city, postal_code, role, is_active, preschool_id')
        .eq('role', 'teacher')
        .eq('is_active', true)
        .is('preschool_id', null)
        .limit(100);
      let query = base;
      if (hiringSearch && hiringSearch.trim().length > 0) {
        const term = hiringSearch.trim();
        query = query.or(`city.ilike.%${term}%,postal_code.ilike.%${term}%,email.ilike.%${term}%,name.ilike.%${term}%`);
      }
      const { data, error } = await query;
      if (error) {
        console.error('Error loading available teachers:', error);
        setAvailableTeachers([]);
      } else {
        const fallbackList = (data || []).map((u: any) => ({
          id: u.id,
          name: u.name || u.email || 'Teacher',
          email: u.email,
          phone: u.phone,
          home_city: u.city || null,
          home_postal_code: u.postal_code || null,
        }));
        setAvailableTeachers(fallbackList);
      }
    } catch (_e) {
      console.error('Failed to load available teachers:', _e);
      setAvailableTeachers([]);
    } finally {
      setLoading(false);
    }
  }, [hiringSearch, radiusKm, getPreschoolId]);

  const loadInvites = async () => {
    try {
      const schoolId = getPreschoolId();
      if (!schoolId) return;
      const list = await TeacherInviteService.listInvites(schoolId);
      setInvites(list.map(i => ({ id: i.id, email: i.email, status: i.status, created_at: i.created_at })));
    } catch {
      // ignore
    }
  };
  
  // NEW: Seat management handlers
  const handleAssignSeat = useCallback((teacherUserId: string, teacherName: string) => {
    if (shouldDisableAssignment) {
      Alert.alert(
        'Seat Limit Reached',
        `Cannot assign more teacher seats. You have reached the limit for your current plan.${seatUsageDisplay ? `\n\nCurrent usage: ${seatUsageDisplay.displayText}` : ''}`,
        [
          { text: 'OK', style: 'default' },
          { text: 'Upgrade Plan', onPress: () => {
            // TODO: Navigate to subscription upgrade screen
            Alert.alert('Upgrade Plan', 'Plan upgrade feature coming soon!');
          }}
        ]
      );
      return;
    }
    
    Alert.alert(
      'Assign Teacher Seat',
      `Assign a teacher seat to ${teacherName}?\n\nThis will allow them to use the teacher portal and access student information.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign Seat',
          onPress: async () => {
            try {
              await assignSeat({ teacherUserId });
              // Refresh teachers list after successful assignment
              await fetchTeachers();
            } catch (_error) {
              console.error('Seat assignment failed:', _error);
            }
          }
        }
      ]
    );
  }, [shouldDisableAssignment, seatUsageDisplay, assignSeat, fetchTeachers]);
  
  const handleRevokeSeat = useCallback((teacherUserId: string, teacherName: string) => {
    Alert.alert(
      'Revoke Teacher Seat',
      `Are you sure you want to revoke the teacher seat from ${teacherName}?\n\nThey will lose access to the teacher portal until a new seat is assigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Seat',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[TeacherManagement] Revoking seat from user:', teacherUserId);
              await revokeSeat({ teacherUserId });
              console.log('[TeacherManagement] Seat revoked successfully');
              // Refresh teachers list after successful revocation
              await fetchTeachers();
              Alert.alert('Success', `Seat revoked from ${teacherName} successfully!`);
            } catch (_error) {
              console.error('[TeacherManagement] Seat revocation failed:', _error);
              Alert.alert('Revocation Failed', _error instanceof Error ? _error.message : 'Unknown error occurred');
            }
          }
        }
      ]
    );
  }, [revokeSeat, fetchTeachers]);
  const [inviteEmail, setInviteEmail] = useState('');

  const handleAddTeacher = () => {
    Alert.alert(
      '👨‍🏫 Add New Teacher',
      'Choose how you\'d like to add a teacher to your school:',
      [
        {
          text: 'Post Job Opening',
          onPress: () => {
            Alert.alert(
              '📝 Job Posting Created',
              'Your job posting for a new teacher position has been created and will be published to:\n\n• School website\n• Education job boards\n• Social media channels\n\nApplications will appear in the Hiring tab.',
              [{ text: 'Great!', style: 'default' }]
            );
          }
        },
        {
          text: 'Invite by Email',
          onPress: () => setShowInviteModal(true)
        },
        {
          text: 'Add Directly',
          onPress: () => {
            Alert.alert(
              '➕ Direct Teacher Addition',
              'Teacher added successfully!\n\nNext steps:\n• Send welcome email with login details\n• Schedule orientation session\n• Prepare classroom assignment\n• Update staff directory',
              [{ text: 'Done', style: 'default' }]
            );
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleTeacherPress = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setCurrentView('profile');
  };

  const refreshSelectedTeacherDocs = useCallback(async () => {
    if (!selectedTeacher?.id) return;
    const docs = await TeacherDocumentsService.listDocuments(selectedTeacher.id);
    const map: Record<string, TeacherDocument> = { /* TODO: Implement */ };
    for (const d of docs) { if (!map[d.doc_type]) map[d.doc_type] = d; }
    setTeacherDocsMap(map);
  }, [selectedTeacher]);

  const pickAndUploadTeacherDoc = useCallback(async (docType: TeacherDocType) => {
    try {
      if (!selectedTeacher?.id) { Alert.alert('No teacher selected'); return; }
      const preschoolId = getPreschoolId();
      if (!preschoolId) { Alert.alert('No school linked', 'Cannot attach documents without a school context.'); return; }
      setIsUploadingDoc(true);

const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: false, copyToCacheDirectory: true });
      if (result.canceled) { setIsUploadingDoc(false); return; }
      const asset = (result.assets?.[0]) as DocumentPicker.DocumentPickerAsset;
      const uri = asset.uri as string;
      const name = (asset.name as string) || uri.split('/').pop() || `${docType}.dat`;
      const mime = (asset.mimeType as string) || 'application/octet-stream';

      const uploaded = await TeacherDocumentsService.uploadDocument({
        teacherUserId: selectedTeacher.id,
        preschoolId,
        uploadedBy: user?.id || '',
        localUri: uri,
        docType,
        originalFileName: name,
        mimeType: mime,
      });
      if (!uploaded.success) {
        Alert.alert('Upload failed', uploaded.error || 'Unknown error');
        setIsUploadingDoc(false);
        return;
      }

      await refreshSelectedTeacherDocs();
      Alert.alert('Attached', `${name} uploaded as ${docType.replace('_', ' ')}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to attach document');
    } finally {
      setIsUploadingDoc(false);
    }
  }, [selectedTeacher, user, getPreschoolId, refreshSelectedTeacherDocs]);

  const showAttachDocActionSheet = useCallback(() => {
    Alert.alert(
      'Attach Document',
      'Select which document to attach',
      [
        { text: 'CV', onPress: () => pickAndUploadTeacherDoc('cv') },
        { text: 'Qualifications', onPress: () => pickAndUploadTeacherDoc('qualifications') },
        { text: 'ID Copy', onPress: () => pickAndUploadTeacherDoc('id_copy') },
        { text: 'Contracts', onPress: () => pickAndUploadTeacherDoc('contracts') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [pickAndUploadTeacherDoc]);

  // Load teacher documents when entering profile view
  useEffect(() => {
    const loadDocs = async () => {
      try {
        if (currentView === 'profile' && selectedTeacher?.id) {
          const docs = await TeacherDocumentsService.listDocuments(selectedTeacher.id);
          // Map latest by doc_type
          const map: Record<string, TeacherDocument> = { /* TODO: Implement */ };
          for (const d of docs) {
            if (!map[d.doc_type]) map[d.doc_type] = d;
          }
          setTeacherDocsMap(map);
        } else {
          setTeacherDocsMap({ /* TODO: Implement */ });
        }
      } catch (_e) {
        console.warn('Failed to load teacher documents:', _e);
        setTeacherDocsMap({ /* TODO: Implement */ });
      }
    };
    loadDocs();
  }, [currentView, selectedTeacher]);

  const handleCandidateAction = (candidateId: string, action: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    Alert.alert(
      `${action} ${candidate.firstName} ${candidate.lastName}`,
      `Are you sure you want to ${action.toLowerCase()} this candidate?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          onPress: () => {
            setCandidates(prev => 
              prev.map(c => 
                c.id === candidateId 
                  ? { ...c, status: action.toLowerCase() as any }
                  : c
              )
            );
            Alert.alert('Success', `Candidate has been ${action.toLowerCase()}.`);
          }
        }
      ]
    );
  };

  const generatePayroll = () => {
    Alert.alert(
      'Generate Payroll',
      'Payroll for current month will be generated and sent to accounting.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate', onPress: () => Alert.alert('Success', 'Payroll generated successfully!') }
      ]
    );
  };

  const schedulePerformanceReview = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    Alert.alert(
      'Schedule Performance Review',
      `Schedule review for ${teacher.firstName} ${teacher.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Schedule', onPress: () => Alert.alert('Scheduled', 'Performance review has been scheduled.') }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#059669';
      case 'inactive': return '#6B7280';
      case 'pending': return '#EA580C';
      case 'probation': return '#F59E0B';
      case 'suspended': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getCandidateStatusColor = (status: string) => {
    switch (status) {
      case 'applied': return '#6B7280';
      case 'screening': return '#F59E0B';
      case 'interview': return '#3B82F6';
      case 'offer': return '#059669';
      case 'hired': return '#10B981';
      case 'rejected': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getViewIcon = (view: TeacherManagementView) => {
    switch (view) {
      case 'overview': return 'grid-outline';
      case 'hiring': return 'person-add-outline';
      case 'performance': return 'analytics-outline';
      case 'payroll': return 'card-outline';
      case 'profile': return 'person-outline';
      default: return 'grid-outline';
    }
  };

  const renderNavigationTabs = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.tabsContainer}
      contentContainerStyle={styles.tabsContent}
    >
      {(['overview', 'hiring', 'performance', 'payroll'] as TeacherManagementView[]).map((view) => (
        <TouchableOpacity
          key={view}
          style={[styles.tab, currentView === view && styles.activeTab]}
          onPress={() => setCurrentView(view)}
        >
          <Ionicons 
            name={getViewIcon(view) as any} 
            size={18} 
            color={currentView === view ? (theme?.primary || '#007AFF') : (theme?.textSecondary || '#666')}
          />
          <Text style={[styles.tabText, currentView === view && styles.activeTabText]}>
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = searchQuery === '' || 
      `${teacher.firstName} ${teacher.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || teacher.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // NEW: Component for teacher cards with seat management
  const TeacherCardWithSeatManagement = ({ item }: { item: Teacher }) => {
    const teacherHasSeat = useTeacherHasSeat(item.teacherUserId);
    const fullName = `${item.firstName} ${item.lastName}`;
    
    // Debug logging for teacher card
    React.useEffect(() => {
      console.log('[TeacherCard DEBUG]', {
        teacherName: fullName,
        teacherEmail: item.email,
        teacherUserId: item.teacherUserId,
        teacherHasSeat,
        teacherData: {
          id: item.id,
          employeeId: item.employeeId,
          status: item.status,
        }
      });
    }, [item, teacherHasSeat, fullName]);
    
    return (
      <TouchableOpacity
        style={styles.teacherCard}
        onPress={() => handleTeacherPress(item)}
      >
        <View style={styles.teacherTopRow}>
          <View style={styles.teacherAvatar}>
            <Text style={styles.avatarText}>
              {item.firstName.charAt(0)}{item.lastName.charAt(0)}
            </Text>
          </View>
          <View style={styles.teacherInfo}>
            <Text style={styles.teacherName}>
              {fullName}
            </Text>
            <Text style={styles.teacherEmail}>{item.email}</Text>
            <Text style={styles.teacherClasses}>
              {item.classes.length > 0 ? `Classes: ${item.classes.join(', ')}` : 'No classes assigned'}
            </Text>
            <Text style={styles.teacherStudentCount}>
              Students: {item.studentCount || 0}
            </Text>
            <View style={styles.seatStatusContainer}>
              <Ionicons 
                name={teacherHasSeat ? 'checkmark-circle' : 'ellipse-outline'} 
                size={14} 
                color={teacherHasSeat ? '#059669' : '#6b7280'} 
              />
              <Text style={[styles.seatStatusText, { color: teacherHasSeat ? '#059669' : '#6b7280' }]}>
                {teacherHasSeat ? 'Has teacher seat' : 'No teacher seat'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.teacherActionsColumn}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}> 
            <Text style={styles.statusText}>{item.status}</Text>
          </View>

          <View style={styles.seatActionButtons}>
            {teacherHasSeat ? (
              <TouchableOpacity
                style={[styles.seatActionButton, styles.revokeButton]}
                onPress={(e: any) => {
                  e.stopPropagation();
                  console.log('[TeacherCard] Revoking seat from:', { teacherId: item.id, teacherName: fullName, teacherUserId: item.teacherUserId });
                  handleRevokeSeat(item.teacherUserId, fullName);
                }}
                disabled={isRevoking}
              >
                <Ionicons name="remove-circle" size={16} color="#fca5a5" />
                <Text style={styles.seatActionText}>Revoke Seat</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.seatActionButton,
                  styles.assignButton,
                  shouldDisableAssignment && styles.disabledButton
                ]}
                onPress={(e: any) => {
                  e.stopPropagation();
                  console.log('[TeacherCard] Assigning seat to:', { teacherId: item.id, teacherName: fullName, teacherUserId: item.teacherUserId });
                  handleAssignSeat(item.teacherUserId, fullName);
                }}
                disabled={isAssigning || shouldDisableAssignment}
              >
                <Ionicons
                  name="add-circle"
                  size={16}
                  color={shouldDisableAssignment ? '#9ca3af' : '#34d399'}
                />
                <Text style={styles.seatActionText}>Assign Seat</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.seatActionButton, styles.messageQuickAction]}
              onPress={() => handleTeacherPress(item)}
            >
              <Ionicons name="eye" size={16} color="#e2e8f0" />
              <Text style={styles.seatActionText}>View Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderTeacher = ({ item }: { item: Teacher }) => (
    <TeacherCardWithSeatManagement item={item} />
  );

  return (
    <View style={styles.container}>
      {/* Invite Teacher Modal */}
      {showInviteModal && (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Invite Teacher</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12 }}
              placeholder="teacher@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={inviteEmail}
              onChangeText={setInviteEmail}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => setShowInviteModal(false)}>
                <Text style={styles.btnDangerText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={async () => {
                  try {
                    const schoolId = getPreschoolId();
                    if (!schoolId) { Alert.alert('Error', 'No school associated'); return; }
                    const invitedBy = user?.id || '';
                    const { TeacherInviteService } = await import('@/lib/services/teacherInviteService');
                    const invite = await TeacherInviteService.createInvite({ schoolId, email: inviteEmail.trim(), invitedBy });
                    setShowInviteModal(false);
                    setInviteEmail('');
                    Alert.alert('Invite created', `Share this invite token with the teacher:\n\n${invite.token}`);
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || 'Failed to create invite');
                  }
                }}
              >
                <Text style={styles.btnPrimaryText}>Send Invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Header */}
      <RoleBasedHeader 
        title="Teacher Management" 
        showBackButton={true}
        onBackPress={() => navigateBack('/')}
      />
      
      {/* Floating Action Button for Adding Teachers */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddTeacher}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      {/* Navigation Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {(['overview', 'hiring', 'performance', 'payroll'] as TeacherManagementView[]).map((view) => (
            <TouchableOpacity
              key={view}
              style={[styles.tab, currentView === view && styles.activeTab]}
              onPress={() => setCurrentView(view)}
            >
              <Ionicons 
                name={getViewIcon(view) as any} 
                size={18} 
                color={currentView === view ? (theme?.primary || '#007AFF') : (theme?.textSecondary || '#666')}
              />
              <Text style={[styles.tabText, currentView === view && styles.activeTabText]}>
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content based on current view */}
      <View style={styles.contentContainer}>
        {currentView === 'overview' && (
          <View style={styles.overviewContainer}>
            {/* NEW: Seat Usage Display Header */}
            {seatUsageDisplay && (
              <View style={styles.seatUsageHeader}>
                <View style={styles.seatUsageInfo}>
                  <Ionicons name="people" size={20} color={theme?.primary || '#007AFF'} />
                  <Text style={styles.seatUsageText}>{seatUsageDisplay.displayText}</Text>
                  {seatUsageDisplay.isOverLimit && (
                    <View style={styles.overLimitBadge}>
                      <Ionicons name="warning" size={14} color="#dc2626" />
                      <Text style={styles.overLimitText}>Over Limit</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={() => {
                    refetchSeatLimits();
                    fetchTeachers();
                  }}
                  disabled={seatLimitsLoading}
                >
                  <Ionicons 
                    name="refresh" 
                    size={18} 
                    color={theme?.textSecondary || '#6b7280'} 
                  />
                </TouchableOpacity>
              </View>
            )}
            
            <FlatList
              data={filteredTeachers}
              renderItem={renderTeacher}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl 
                  refreshing={loading} 
                  onRefresh={() => {
                    console.log('🔄 Refreshing teacher data...');
                    fetchTeachers();
                  }} 
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={64} color={theme?.textSecondary || '#666'} />
                  <Text style={styles.emptyTitle}>No Teachers Yet</Text>
                  <Text style={styles.emptyText}>
                    Start building your teaching team by adding your first teacher.
                  </Text>
                  <TouchableOpacity style={styles.emptyButton} onPress={handleAddTeacher}>
                    <Text style={styles.emptyButtonText}>Add First Teacher</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        )}

        {currentView === 'hiring' && (
          <View style={styles.sectionContainer}>
            {/* Available teachers hub */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Teachers</Text>
              <Text style={styles.sectionSubtitle}>{availableTeachers.length} available</Text>
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={theme?.textSecondary || '#666'} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name, email, city or postal code..."
                  value={hiringSearch}
                  onChangeText={(t) => setHiringSearch(t)}
                  onSubmitEditing={fetchAvailableCandidates}
                />
              </View>
              <View style={styles.radiusChips}>
                {[5,10,25].map((km) => (
                  <TouchableOpacity
                    key={km}
                    style={[styles.radiusChip, radiusKm === km && styles.radiusChipActive]}
                    onPress={() => { setRadiusKm(km); fetchAvailableCandidates(); }}
                  >
                    <Text style={[styles.radiusChipText, radiusKm === km && styles.radiusChipTextActive]}>{km} km</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.addButton} onPress={fetchAvailableCandidates}>
                <Ionicons name="refresh" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableTeachers}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <View style={styles.candidateCard}>
                  <View style={styles.candidateHeader}>
                    <View style={styles.candidateInfo}>
                      <Text style={styles.candidateName}>{item.name}</Text>
                      <Text style={styles.candidateEmail}>{item.email}</Text>
                      <Text style={styles.candidateDetails}>{(item.home_city || 'Unknown city') + (item.home_postal_code ? ` • ${item.home_postal_code}` : '')}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.inviteButton}
                      onPress={async () => {
                        try {
                          const schoolId = getPreschoolId();
                          if (!schoolId) return;
                          if (!item.email) { Alert.alert('Missing email', 'This teacher profile has no email.'); return; }
                          await TeacherInviteService.createInvite({ schoolId, email: item.email, invitedBy: user?.id || '' });
                          await loadInvites();
                          Alert.alert('Invite sent', `Invitation sent to ${item.email}`);
                        } catch (_e) {
                          console.error('Invite error:', _e);
                          Alert.alert('Error', 'Failed to send invite.');
                        }
                      }}
                    >
                      <Ionicons name="send" size={16} color="#fff" />
                      <Text style={styles.inviteButtonText}>Invite</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAvailableCandidates} />}
              ListEmptyComponent={<Text style={styles.sectionSubtitle}>No available teachers</Text>}
            />

            {/* Invites list */}
            <View style={[styles.sectionHeader, { marginTop: 8 }] }>
              <Text style={styles.sectionTitle}>Invitations</Text>
              <Text style={styles.sectionSubtitle}>{invites.length} invites</Text>
            </View>
            <FlatList
              data={invites}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <View style={styles.candidateCard}>
                  <View style={styles.candidateHeader}>
                    <View style={styles.candidateInfo}>
                      <Text style={styles.candidateName}>{item.email}</Text>
                      <Text style={styles.candidateEmail}>Status: {item.status}</Text>
                    </View>
                    {item.status === 'pending' && (
                      <TouchableOpacity
style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}
                        onPress={async () => {
                          try {
                            await TeacherInviteService.revoke(item.id)
                            await loadInvites()
                          } catch (e: any) {
                            Alert.alert('Error', e?.message || 'Failed to revoke invite')
                          }
                        }}
                      >
                        <Ionicons name="trash" size={18} color="#dc2626" />
<Text style={{ color: '#dc2626', fontWeight: '700' }}>Revoke</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.sectionSubtitle}>No invites yet</Text>}
            />

            {/* Candidates pipeline */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Hiring Pipeline</Text>
              <Text style={styles.sectionSubtitle}>{candidates.length} candidates in pipeline</Text>
            </View>
            <FlatList
              data={candidates}
              renderItem={({ item }) => (
                <View style={styles.candidateCard}>
                  <View style={styles.candidateHeader}>
                    <View style={styles.candidateInfo}>
                      <Text style={styles.candidateName}>
                        {item.firstName} {item.lastName}
                      </Text>
                      <Text style={styles.candidateEmail}>{item.email}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getCandidateStatusColor(item.status) }]}>
                      <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.candidatePosition}>📍 Applied for: {item.appliedFor}</Text>
                  <Text style={styles.candidateDetails}>💼 {item.experience} years experience • 💰 R{item.expectedSalary.toLocaleString()}</Text>
                </View>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {currentView === 'performance' && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Performance Reviews</Text>
              <Text style={styles.sectionSubtitle}>{filteredTeachers.length} teachers enrolled</Text>
            </View>
            <FlatList
              data={filteredTeachers}
              renderItem={({ item }) => (
                <View style={styles.performanceCard}>
                  <View style={styles.performanceHeader}>
                    <View>
                      <Text style={styles.teacherName}>
                        {item.firstName} {item.lastName}
                      </Text>
                      <Text style={styles.teacherRole}>{item.subjects.join(', ')}</Text>
                    </View>
                    <View style={styles.ratingContainer}>
                      <Text style={styles.ratingScore}>{item.performance.rating}</Text>
                      <Text style={styles.ratingLabel}>/5.0</Text>
                    </View>
                  </View>
                  <View style={styles.performanceDetails}>
                    <Text style={styles.lastReview}>
                      📅 Last Review: {item.performance.lastReviewDate}
                    </Text>
                    <View style={styles.strengthsContainer}>
                      <Text style={styles.strengthsLabel}>Strengths:</Text>
                      <Text style={styles.strengthsText}>{item.performance.strengths.join(', ')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.reviewButton}
                    onPress={() => schedulePerformanceReview(item.id)}
                  >
                    <Ionicons name="calendar" size={16} color="white" />
                    <Text style={styles.reviewButtonText}>Schedule Review</Text>
                  </TouchableOpacity>
                </View>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {currentView === 'payroll' && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Payroll Management</Text>
              <Text style={styles.sectionSubtitle}>Monthly salary overview</Text>
            </View>
            <FlatList
              data={filteredTeachers}
              renderItem={({ item }) => (
                <View style={styles.payrollCard}>
                  <View style={styles.payrollHeader}>
                    <View>
                      <Text style={styles.teacherName}>
                        {item.firstName} {item.lastName}
                      </Text>
                      <Text style={styles.payScale}>{item.salary.payScale}</Text>
                    </View>
                  </View>
                  <View style={styles.salaryBreakdown}>
                    <View style={styles.salaryRow}>
                      <Text style={styles.salaryLabel}>Basic Salary:</Text>
                      <Text style={styles.salaryAmount}>R{item.salary.basic.toLocaleString()}</Text>
                    </View>
                    <View style={styles.salaryRow}>
                      <Text style={styles.salaryLabel}>Allowances:</Text>
                      <Text style={styles.salaryAmount}>R{item.salary.allowances.toLocaleString()}</Text>
                    </View>
                    <View style={styles.salaryRow}>
                      <Text style={styles.salaryLabel}>Deductions:</Text>
                      <Text style={[styles.salaryAmount, styles.deduction]}>-R{item.salary.deductions.toLocaleString()}</Text>
                    </View>
                    <View style={[styles.salaryRow, styles.netRow]}>
                      <Text style={styles.netLabel}>Net Salary:</Text>
                      <Text style={styles.netAmount}>R{item.salary.net.toLocaleString()}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.payrollButton}
                    onPress={() => generatePayroll()}
                  >
                    <Ionicons name="document-text" size={16} color="white" />
                    <Text style={styles.payrollButtonText}>Generate Payslip</Text>
                  </TouchableOpacity>
                </View>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}


        {currentView === 'profile' && selectedTeacher && (
          <ScrollView style={styles.sectionContainer} contentContainerStyle={styles.profileContent}>
            <View style={styles.sectionHeader}>
              <TouchableOpacity onPress={() => setCurrentView('overview')} style={{ paddingRight: 12, paddingVertical: 4 }}>
                <Ionicons name="chevron-back" size={20} color={theme?.text || '#333'} />
              </TouchableOpacity>
              <Text style={styles.sectionTitle}>
                {selectedTeacher.firstName} {selectedTeacher.lastName}
              </Text>
              <Text style={styles.sectionSubtitle}>{selectedTeacher.email}</Text>
            </View>

            <View style={styles.documentCard}>
              <Text style={styles.teacherName}>Profile</Text>
              <Text style={styles.teacherEmail}>Phone: {selectedTeacher.phone}</Text>
              <Text style={styles.teacherEmail}>Employee ID: {selectedTeacher.employeeId}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity 
                  style={[styles.payrollButton, styles.messageButton]} 
                  onPress={() => Alert.alert('Messaging', 'Teacher communications coming soon')}
                >
                  <Ionicons name="chatbubbles" size={16} color="#fff" />
                  <Text style={styles.payrollButtonText}>{selectedTeacherHasSeat ? 'Message (Has Seat)' : 'Message (No Seat)'}</Text>
                </TouchableOpacity>
              <View style={styles.inlineSeatActions}>
                <TouchableOpacity 
                  style={[styles.payrollButton, styles.assignSeatButton]}
                  onPress={() => handleAssignSeat(selectedTeacher.teacherUserId, `${selectedTeacher.firstName} ${selectedTeacher.lastName}`)}
                  disabled={shouldDisableAssignment || isAssigning}
                >
                  <Ionicons name="add-circle" size={16} color="#fff" />
                  <Text style={styles.payrollButtonText}>Assign Seat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.payrollButton, styles.revokeSeatButton]}
                  onPress={() => handleRevokeSeat(selectedTeacher.teacherUserId, `${selectedTeacher.firstName} ${selectedTeacher.lastName}`)}
                  disabled={isRevoking}
                >
                  <Ionicons name="remove-circle" size={16} color="#fff" />
                  <Text style={styles.payrollButtonText}>Revoke Seat</Text>
                </TouchableOpacity>
              </View>
              </View>
            </View>

            <View style={styles.documentCard}>
              <View style={[styles.documentHeader, { alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Documents</Text>
                  <Text style={styles.documentProgress}>
                    {Object.keys(selectedTeacher.documents).length}/4 complete
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[styles.inviteButton, { backgroundColor: '#2563eb' }]} 
                  onPress={showAttachDocActionSheet}
                  disabled={isUploadingDoc}
                >
                  <Ionicons name="cloud-upload" size={16} color="#fff" />
                  <Text style={styles.inviteButtonText}>{isUploadingDoc ? 'Uploading...' : 'Attach'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.documentGrid}>
                {(
                  [
                    { key: 'cv', label: 'CV', complete: !!selectedTeacher.documents.cv },
                    { key: 'qualifications', label: 'Qualifications', complete: !!selectedTeacher.documents.qualifications },
                    { key: 'id_copy', label: 'ID Copy', complete: !!selectedTeacher.documents.id_copy },
                    { key: 'contracts', label: 'Contracts', complete: !!selectedTeacher.documents.contracts },
                  ] as Array<{ key: string; label: string; complete: boolean }>
                ).map((doc) => (
                  <TouchableOpacity
                    key={doc.key}
                    style={[styles.docItem, (doc.complete || teacherDocsMap[doc.key]) && styles.docComplete]}
                    onPress={async () => {
                      const existing = teacherDocsMap[doc.key];
                      if (!existing) {
                        Alert.alert('No File', 'No file is currently attached for this document.');
                        return;
                      }
                      try {
                        const url = await TeacherDocumentsService.getSignedUrl(existing.file_path);
                        if (!url) { Alert.alert('Error', 'Failed to open document.'); return; }
                        // Prefer in-app browser when available
                        if (WebBrowser && WebBrowser.openBrowserAsync) {
                          await WebBrowser.openBrowserAsync(url);
                        } else {
                          await Linking.openURL(url);
                        }
                      } catch (_e) {
                        Alert.alert('Error', 'Could not open document.');
                      }
                    }}
                  >
                    <Ionicons 
                      name={doc.complete ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={doc.complete ? '#065f46' : '#6b7280'}
                    />
                    <Text style={[styles.docText, (doc.complete || teacherDocsMap[doc.key]) && styles.docCompleteText]}>{doc.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#f8fafc',
  },
  contentContainer: {
    flex: 1,
  },
  // Tab Navigation
  tabsContainer: {
    backgroundColor: theme?.surface || 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#e5e7eb',
    paddingVertical: 8,
  },
  tabsContent: {
    paddingHorizontal: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: theme?.surfaceVariant || '#f9fafb',
  },
  activeTab: {
    backgroundColor: theme?.primary || '#2563eb',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: theme?.textSecondary || '#6b7280',
  },
  activeTabText: {
    color: 'white',
  },
  // Section Containers
  sectionContainer: {
    flex: 1,
    backgroundColor: theme?.background || '#f8fafc',
  },
  profileContent: {
    paddingBottom: 160,
  },
  overviewContainer: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: theme?.surface || 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme?.text || '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme?.textSecondary || '#6b7280',
  },
  // List Content
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  // Teacher Cards
  teacherCard: {
    backgroundColor: theme?.surface || 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme?.border || '#f3f4f6',
  },
  teacherTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  teacherAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme?.primary || '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme?.text || '#1f2937',
    marginBottom: 4,
  },
  teacherEmail: {
    fontSize: 14,
    color: theme?.textSecondary || '#6b7280',
    marginBottom: 4,
  },
  teacherClasses: {
    fontSize: 13,
    color: theme?.textTertiary || '#9ca3af',
  },
  teacherStudentCount: {
    fontSize: 13,
    color: theme?.textSecondary || '#6b7280',
    marginTop: 2,
    fontWeight: '600',
  },
  teacherRole: {
    fontSize: 13,
    color: theme?.textSecondary || '#6b7280',
    marginBottom: 2,
  },
  teacherStatus: {
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
    textTransform: 'capitalize',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme?.text || '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: theme?.textSecondary || '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: theme?.primary || '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Candidate Cards
  candidateCard: {
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme?.border || '#f3f4f6',
  },
  candidateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  candidateInfo: {
    flex: 1,
  },
  candidateName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme?.text || '#333',
    marginBottom: 4,
  },
  candidateEmail: {
    fontSize: 14,
    color: theme?.textSecondary || '#6b7280',
  },
  candidatePosition: {
    fontSize: 14,
    color: theme?.text || '#333',
    marginBottom: 8,
  },
  candidateDetails: {
    fontSize: 13,
    color: theme?.textTertiary || '#9ca3af',
  },
  // Performance Cards
  performanceCard: {
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme?.border || '#f3f4f6',
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  ratingContainer: {
    alignItems: 'center',
    backgroundColor: theme?.primary + '10' || '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  ratingScore: {
    fontSize: 20,
    fontWeight: '700',
    color: theme?.primary || '#007AFF',
  },
  ratingLabel: {
    fontSize: 12,
    color: theme?.textSecondary || '#6b7280',
    marginTop: -2,
  },
  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme?.primary || '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000, // Ensure it's above other elements
  },
  performanceDetails: {
    marginBottom: 16,
  },
  lastReview: {
    fontSize: 14,
    color: theme?.textSecondary || '#6b7280',
    marginBottom: 12,
  },
  strengthsContainer: {
    marginTop: 8,
  },
  strengthsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginBottom: 4,
  },
  strengthsText: {
    fontSize: 13,
    color: theme?.textSecondary || '#6b7280',
    lineHeight: 18,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme?.primary || '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  reviewButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  inviteButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  radiusChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 6,
  },
  radiusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  radiusChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  radiusChipText: { color: '#9ca3af', fontWeight: '700' },
  radiusChipTextActive: { color: '#fff', fontWeight: '800' },
  // Payroll Cards
  payrollCard: {
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme?.border || '#f3f4f6',
  },
  payrollHeader: {
    marginBottom: 16,
  },
  payScale: {
    fontSize: 13,
    color: theme?.textSecondary || '#6b7280',
    marginTop: 2,
  },
  salaryBreakdown: {
    marginBottom: 16,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  salaryLabel: {
    fontSize: 14,
    color: theme?.textSecondary || '#6b7280',
  },
  salaryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  deduction: {
    color: theme?.error || '#dc2626',
  },
  netRow: {
    borderTopWidth: 1,
    borderTopColor: theme?.border || '#f3f4f6',
    paddingTop: 8,
    marginTop: 4,
  },
  netLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: theme?.text || '#333',
  },
  netAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: theme?.success || '#059669',
  },
  payrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme?.success || '#059669',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  payrollButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  messageButton: {
    backgroundColor: '#2563eb',
  },
  assignSeatButton: {
    backgroundColor: '#059669',
  },
  revokeSeatButton: {
    backgroundColor: '#dc2626',
  },
  inlineSeatActions: {
    flexDirection: 'row',
    gap: 8,
  },
  // Document Cards
  documentCard: {
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme?.border || '#f3f4f6',
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  documentProgress: {
    fontSize: 13,
    color: theme?.textSecondary || '#6b7280',
    marginTop: 2,
  },
  progressCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme?.primary + '10' || '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme?.primary || '#007AFF',
  },
  documentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme?.surfaceVariant || '#f9fafb',
    marginRight: 8,
    marginBottom: 8,
    minWidth: '45%',
    flex: 1,
  },
  docComplete: {
    backgroundColor: theme?.success + '20' || '#d1fae5',
  },
  docText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme?.textSecondary || '#6b7280',
    marginLeft: 6,
  },
  btn: { alignItems: 'center', padding: 12, borderRadius: 12 },
  btnPrimary: { backgroundColor: theme?.primary || '#00f5ff' },
  btnPrimaryText: { color: '#000', fontWeight: '800' },
  btnDanger: { backgroundColor: theme?.error || '#ff0080' },
  btnDangerText: { color: '#000', fontWeight: '800' },
  docCompleteText: {
    color: theme?.success || '#065f46',
  },
  // NEW: Seat Management Styles
  seatUsageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme?.surface || 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#f3f4f6',
    marginBottom: 8,
  },
  seatUsageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  seatUsageText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginLeft: 8,
  },
  overLimitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  overLimitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
    marginLeft: 4,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme?.surfaceVariant || '#f9fafb',
  },
  seatStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  seatStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  teacherActions: {
    alignItems: 'flex-end',
  },
  teacherActionsColumn: {
    gap: 8,
  },
  seatActions: {
    marginVertical: 8,
  },
  seatActionsStack: {
    gap: 8,
  },
  seatActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  seatActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 95,
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
  },
  assignButton: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  revokeButton: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  disabledButton: {
    backgroundColor: '#e5e7eb',
    borderColor: '#e5e7eb',
    opacity: 0.6,
  },
  seatActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  messageQuickAction: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  // Missing styles for search interface
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme?.surface || 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#f3f4f6',
  },
  searchBox: {
    flex: 1,
    marginRight: 12,
  },
  searchInput: {
    backgroundColor: theme?.inputBackground || '#f9fafb',
    borderWidth: 1,
    borderColor: theme?.inputBorder || '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme?.inputText || '#111827',
  },
  addButton: {
    backgroundColor: theme?.primary || '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
