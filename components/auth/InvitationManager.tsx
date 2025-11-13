// 🔐 Invitation Management System Component
// Manage teacher and parent invitations with bulk support

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  TeacherInvitation, 
  ParentInvitation,
  InvitationStatus,
  EnhancedUserRole 
} from '../../types/auth-enhanced';

interface InvitationManagerProps {
  userRole: 'principal' | 'teacher';
  organizationId: string;
  onInvitationSent?: (invitations: Invitation[]) => void;
  onError?: (error: string) => void;
}

interface Invitation {
  email: string;
  name: string;
  role: 'teacher' | 'parent';
  subjects?: string[];
  gradeLevel?: string[];
  studentConnections?: Array<{
    studentId: string;
    studentName: string;
  }>;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  error?: string;
}

interface BulkImportData {
  teachers?: Array<{
    email: string;
    name: string;
    subjects: string[];
    gradeLevel: string[];
  }>;
  parents?: Array<{
    email: string;
    name: string;
    studentName: string;
    studentId?: string;
  }>;
}

const SUBJECTS = [
  'Mathematics', 'Science', 'English', 'History', 'Geography',
  'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Art',
  'Music', 'Physical Education', 'Foreign Language', 'Social Studies'
];

const GRADE_LEVELS = [
  'Pre-K', 'Kindergarten',
  '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade',
  '6th Grade', '7th Grade', '8th Grade',
  '9th Grade', '10th Grade', '11th Grade', '12th Grade'
];

export const InvitationManager: React.FC<InvitationManagerProps> = ({
  userRole,
  organizationId,
  onInvitationSent,
  onError
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  // State management
  const [activeTab, setActiveTab] = React.useState<'individual' | 'bulk'>('individual');
  const [invitationType, setInvitationType] = React.useState<'teacher' | 'parent'>(
    userRole === 'principal' ? 'teacher' : 'parent'
  );
  
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [currentInvitation, setCurrentInvitation] = React.useState<Invitation>({
    email: '',
    name: '',
    role: invitationType,
    status: 'draft'
  });
  
  const [bulkData, setBulkData] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [sentInvitations, setSentInvitations] = React.useState<Invitation[]>([]);
  
  // Validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  const validateInvitation = (invitation: Invitation): string | null => {
    if (!invitation.email || !validateEmail(invitation.email)) {
      return t('invitation.error_valid_email');
    }
    if (!invitation.name || invitation.name.trim().length < 2) {
      return t('invitation.error_valid_name');
    }
    if (invitation.role === 'teacher' && userRole === 'principal') {
      if (!invitation.subjects || invitation.subjects.length === 0) {
        return t('invitation.error_select_subject');
      }
      if (!invitation.gradeLevel || invitation.gradeLevel.length === 0) {
        return t('invitation.error_select_grade');
      }
    }
    if (invitation.role === 'parent' && userRole === 'teacher') {
      if (!invitation.studentConnections || invitation.studentConnections.length === 0) {
        return t('invitation.error_select_student');
      }
    }
    return null;
  };
  
  // Add invitation to list
  const addInvitation = () => {
    const error = validateInvitation(currentInvitation);
    if (error) {
      Alert.alert(t('invitation.validation_error'), error);
      return;
    }
    
    // Check for duplicates
    const duplicate = invitations.find(inv => 
      inv.email.toLowerCase() === currentInvitation.email.toLowerCase()
    );
    if (duplicate) {
      Alert.alert(t('invitation.duplicate_email'), t('invitation.duplicate_email_message'));
      return;
    }
    
    setInvitations([...invitations, { ...currentInvitation, status: 'draft' }]);
    
    // Reset form
    setCurrentInvitation({
      email: '',
      name: '',
      role: invitationType,
      status: 'draft'
    });
  };
  
  // Remove invitation from list
  const removeInvitation = (index: number) => {
    const updated = [...invitations];
    updated.splice(index, 1);
    setInvitations(updated);
  };
  
  // Parse bulk CSV data
  const parseBulkData = (): BulkImportData | null => {
    try {
      const lines = bulkData.trim().split('\n');
      if (lines.length < 2) {
        throw new Error(t('invitation.csv_headers_required'));
      }
      
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      const data = lines.slice(1);
      
      if (invitationType === 'teacher') {
        // Expected headers: email, name, subjects, grades
        if (!headers.includes('email') || !headers.includes('name')) {
          throw new Error(t('invitation.csv_email_name_required'));
        }
        
        const teachers = data.map(line => {
          const values = line.split(',').map(v => v.trim());
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          
          return {
            email: row.email,
            name: row.name,
            subjects: row.subjects ? row.subjects.split(';').map((s: string) => s.trim()) : [],
            gradeLevel: row.grades ? row.grades.split(';').map((g: string) => g.trim()) : []
          };
        });
        
        return { teachers };
      } else {
        // Expected headers: email, name, student_name, student_id
        if (!headers.includes('email') || !headers.includes('name') || !headers.includes('student_name')) {
          throw new Error(t('invitation.csv_parent_columns_required'));
        }
        
        const parents = data.map(line => {
          const values = line.split(',').map(v => v.trim());
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          
          return {
            email: row.email,
            name: row.name,
            studentName: row.student_name,
            studentId: row.student_id
          };
        });
        
        return { parents };
      }
    } catch (error) {
      Alert.alert(
        t('invitation.parse_error'),
        error instanceof Error ? error.message : t('invitation.parse_failed')
      );
      return null;
    }
  };
  
  // Process bulk invitations
  const processBulkInvitations = () => {
    const parsedData = parseBulkData();
    if (!parsedData) return;
    
    const newInvitations: Invitation[] = [];
    
    if (invitationType === 'teacher' && parsedData.teachers) {
      parsedData.teachers.forEach(teacher => {
        if (validateEmail(teacher.email) && teacher.name) {
          newInvitations.push({
            email: teacher.email,
            name: teacher.name,
            role: 'teacher',
            subjects: teacher.subjects,
            gradeLevel: teacher.gradeLevel,
            status: 'draft'
          });
        }
      });
    } else if (invitationType === 'parent' && parsedData.parents) {
      parsedData.parents.forEach(parent => {
        if (validateEmail(parent.email) && parent.name && parent.studentName) {
          newInvitations.push({
            email: parent.email,
            name: parent.name,
            role: 'parent',
            studentConnections: [{
              studentId: parent.studentId || '',
              studentName: parent.studentName
            }],
            status: 'draft'
          });
        }
      });
    }
    
    if (newInvitations.length === 0) {
      Alert.alert(t('invitation.no_valid_data'), t('invitation.no_valid_data_message'));
      return;
    }
    
    setInvitations([...invitations, ...newInvitations]);
    setBulkData('');
    setActiveTab('individual');
    Alert.alert(t('common.success'), t('invitation.invitations_added', { count: newInvitations.length }));
  };
  
  // Send all invitations
  const sendInvitations = async () => {
    if (invitations.length === 0) {
      Alert.alert(t('invitation.no_invitations'), t('invitation.add_one_invitation'));
      return;
    }
    
    setLoading(true);
    const results: Invitation[] = [];
    
    for (let i = 0; i < invitations.length; i++) {
      const invitation = invitations[i];
      
      // Update status to sending
      setInvitations(prev => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: 'sending' };
        return updated;
      });
      
      try {
        // Simulate API call (replace with actual API call)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock success (90% success rate for demo)
        const success = Math.random() > 0.1;
        
        if (success) {
          results.push({ ...invitation, status: 'sent' });
          setInvitations(prev => {
            const updated = [...prev];
            updated[i] = { ...updated[i], status: 'sent' };
            return updated;
          });
        } else {
          throw new Error(t('invitation.send_failed'));
        }
      } catch (error) {
        results.push({ 
          ...invitation, 
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        setInvitations(prev => {
          const updated = [...prev];
          updated[i] = { 
            ...updated[i], 
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          return updated;
        });
      }
    }
    
    setLoading(false);
    
    const successCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    
    setSentInvitations(results);
    
    if (successCount > 0) {
      onInvitationSent?.(results.filter(r => r.status === 'sent'));
    }
    
    Alert.alert(
      t('invitation.invitations_sent'),
      t('invitation.send_results', { success: successCount, failed: failedCount }),
      [
        {
          text: t('common.ok'),
          onPress: () => {
            // Clear successful invitations
            setInvitations(prev => prev.filter(inv => inv.status === 'failed'));
          }
        }
      ]
    );
  };
  
  // Render individual invitation form
  const renderIndividualForm = () => (
    <View style={styles.formContainer}>
      <View style={styles.fieldContainer}>
        <Text style={[styles.label, { color: theme.text }]}>
          {t('invitation.email_address')}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text
            }
          ]}
          value={currentInvitation.email}
          onChangeText={email => setCurrentInvitation({ ...currentInvitation, email })}
          placeholder={t('invitation.email_placeholder')}
          placeholderTextColor={theme.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      
      <View style={styles.fieldContainer}>
        <Text style={[styles.label, { color: theme.text }]}>
          {t('invitation.full_name')}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text
            }
          ]}
          value={currentInvitation.name}
          onChangeText={name => setCurrentInvitation({ ...currentInvitation, name })}
          placeholder={t('invitation.name_placeholder')}
          placeholderTextColor={theme.textSecondary}
        />
      </View>
      
      {invitationType === 'teacher' && userRole === 'principal' && (
        <>
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: theme.text }]}>
              {t('invitation.subjects')}
            </Text>
            <ScrollView 
              style={styles.chipContainer}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {SUBJECTS.map(subject => {
                const isSelected = currentInvitation.subjects?.includes(subject);
                return (
                  <TouchableOpacity
                    key={subject}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected 
                          ? theme.primaryLight 
                          : theme.surface,
                        borderColor: isSelected 
                          ? theme.primary 
                          : theme.border
                      }
                    ]}
                    onPress={() => {
                      const subjects = currentInvitation.subjects || [];
                      if (isSelected) {
                        setCurrentInvitation({
                          ...currentInvitation,
                          subjects: subjects.filter(s => s !== subject)
                        });
                      } else {
                        setCurrentInvitation({
                          ...currentInvitation,
                          subjects: [...subjects, subject]
                        });
                      }
                    }}
                  >
                    <Text style={[
                      styles.chipText,
                      {
                      color: isSelected 
                          ? theme.onPrimary 
                          : theme.text
                      }
                    ]}>
                      {subject}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: theme.text }]}>
              {t('invitation.grade_levels')}
            </Text>
            <ScrollView 
              style={styles.chipContainer}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {GRADE_LEVELS.map(grade => {
                const isSelected = currentInvitation.gradeLevel?.includes(grade);
                return (
                  <TouchableOpacity
                    key={grade}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected 
                          ? theme.primaryLight 
                          : theme.surface,
                        borderColor: isSelected 
                          ? theme.primary 
                          : theme.border
                      }
                    ]}
                    onPress={() => {
                      const grades = currentInvitation.gradeLevel || [];
                      if (isSelected) {
                        setCurrentInvitation({
                          ...currentInvitation,
                          gradeLevel: grades.filter(g => g !== grade)
                        });
                      } else {
                        setCurrentInvitation({
                          ...currentInvitation,
                          gradeLevel: [...grades, grade]
                        });
                      }
                    }}
                  >
                    <Text style={[
                      styles.chipText,
                      {
                        color: isSelected 
                          ? theme.onPrimary 
                          : theme.text
                      }
                    ]}>
                      {grade}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}
      
      <TouchableOpacity
        style={[
          styles.addButton,
          { backgroundColor: theme.primary }
        ]}
        onPress={addInvitation}
      >
        <Text style={[styles.addButtonText, { color: theme.onPrimary }]}>
          {t('invitation.add_to_list')}
        </Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render bulk import form
  const renderBulkForm = () => (
    <View style={styles.formContainer}>
      <View style={styles.bulkInstructions}>
        <Text style={[styles.instructionsTitle, { color: theme.colors.onSurface }]}>
          CSV Format Instructions
        </Text>
        <Text style={[styles.instructionsText, { color: theme.colors.onSurfaceVariant }]}>
          {invitationType === 'teacher' 
            ? 'Required columns: email, name, subjects, grades\nSubjects and grades should be separated by semicolons (;)'
            : 'Required columns: email, name, student_name, student_id (optional)'
          }
        </Text>
        <Text style={[styles.exampleText, { color: theme.colors.onSurfaceVariant }]}>
          Example:
          {invitationType === 'teacher'
            ? '\nemail,name,subjects,grades\njohn@school.edu,John Doe,Mathematics;Science,9th Grade;10th Grade'
            : '\nemail,name,student_name,student_id\nparent@email.com,Jane Smith,Tommy Smith,STU001'
          }
        </Text>
      </View>
      
      <TextInput
        style={[
          styles.bulkInput,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline,
            color: theme.colors.onSurface
          }
        ]}
        value={bulkData}
        onChangeText={setBulkData}
        placeholder="Paste your CSV data here..."
        placeholderTextColor={theme.colors.onSurfaceVariant}
        multiline
        numberOfLines={10}
        textAlignVertical="top"
      />
      
      <TouchableOpacity
        style={[
          styles.processButton,
          { backgroundColor: theme.colors.primary }
        ]}
        onPress={processBulkInvitations}
        disabled={!bulkData.trim()}
      >
        <Text style={[styles.processButtonText, { color: theme.colors.onPrimary }]}>
          Process CSV Data
        </Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render invitation list
  const renderInvitationList = () => (
    <FlatList
      data={invitations}
      keyExtractor={(item, index) => `${item.email}-${index}`}
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No invitations added yet
          </Text>
        </View>
      )}
      renderItem={({ item, index }) => (
        <View style={[
          styles.invitationItem,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline
          }
        ]}>
          <View style={styles.invitationInfo}>
            <Text style={[styles.invitationName, { color: theme.colors.onSurface }]}>
              {item.name}
            </Text>
            <Text style={[styles.invitationEmail, { color: theme.colors.onSurfaceVariant }]}>
              {item.email}
            </Text>
            {item.subjects && item.subjects.length > 0 && (
              <Text style={[styles.invitationDetails, { color: theme.colors.primary }]}>
                Subjects: {item.subjects.join(', ')}
              </Text>
            )}
            {item.gradeLevel && item.gradeLevel.length > 0 && (
              <Text style={[styles.invitationDetails, { color: theme.colors.primary }]}>
                Grades: {item.gradeLevel.join(', ')}
              </Text>
            )}
          </View>
          
          <View style={styles.invitationActions}>
            {item.status === 'draft' && (
              <TouchableOpacity
                style={[styles.removeButton, { backgroundColor: theme.colors.errorContainer }]}
                onPress={() => removeInvitation(index)}
              >
                <Text style={[styles.removeButtonText, { color: theme.colors.onErrorContainer }]}>
                  Remove
                </Text>
              </TouchableOpacity>
            )}
            {item.status === 'sending' && (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            )}
            {item.status === 'sent' && (
              <Text style={[styles.statusText, { color: theme.colors.primary }]}>✓ Sent</Text>
            )}
            {item.status === 'failed' && (
              <Text style={[styles.statusText, { color: theme.colors.error }]}>✗ Failed</Text>
            )}
          </View>
        </View>
      )}
    />
  );
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Send {invitationType === 'teacher' ? 'Teacher' : 'Parent'} Invitations
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Invite {invitationType === 'teacher' ? 'teachers to join your organization' : 'parents to connect with their children'}
        </Text>
      </View>
      
      {/* Role Toggle (for principals only) */}
      {userRole === 'principal' && (
        <View style={styles.roleToggle}>
          <TouchableOpacity
            style={[
              styles.roleButton,
              invitationType === 'teacher' && styles.roleButtonActive,
              {
                backgroundColor: invitationType === 'teacher' 
                  ? theme.colors.primaryContainer 
                  : theme.colors.surface,
                borderColor: invitationType === 'teacher' 
                  ? theme.colors.primary 
                  : theme.colors.outline
              }
            ]}
            onPress={() => setInvitationType('teacher')}
          >
            <Text style={[
              styles.roleButtonText,
              {
                color: invitationType === 'teacher' 
                  ? theme.colors.onPrimaryContainer 
                  : theme.colors.onSurface
              }
            ]}>
              Invite Teachers
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Tab Navigation */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'individual' && styles.tabActive,
            {
              borderBottomColor: activeTab === 'individual' 
                ? theme.colors.primary 
                : theme.colors.surfaceVariant
            }
          ]}
          onPress={() => setActiveTab('individual')}
        >
          <Text style={[
            styles.tabText,
            {
              color: activeTab === 'individual' 
                ? theme.colors.primary 
                : theme.colors.onSurfaceVariant
            }
          ]}>
            Individual
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'bulk' && styles.tabActive,
            {
              borderBottomColor: activeTab === 'bulk' 
                ? theme.colors.primary 
                : theme.colors.surfaceVariant
            }
          ]}
          onPress={() => setActiveTab('bulk')}
        >
          <Text style={[
            styles.tabText,
            {
              color: activeTab === 'bulk' 
                ? theme.colors.primary 
                : theme.colors.onSurfaceVariant
            }
          ]}>
            Bulk Import
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Form Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'individual' ? renderIndividualForm() : renderBulkForm()}
        
        {/* Invitation List */}
        {invitations.length > 0 && (
          <View style={styles.listSection}>
            <Text style={[styles.listTitle, { color: theme.colors.onSurface }]}>
              Pending Invitations ({invitations.length})
            </Text>
            {renderInvitationList()}
          </View>
        )}
      </ScrollView>
      
      {/* Send Button */}
      {invitations.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.sendButton,
              { 
                backgroundColor: loading 
                  ? theme.colors.surfaceVariant 
                  : theme.colors.primary 
              }
            ]}
            onPress={sendInvitations}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.onPrimary} />
            ) : (
              <Text style={[styles.sendButtonText, { color: theme.colors.onPrimary }]}>
                Send {invitations.length} Invitation{invitations.length > 1 ? 's' : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  roleToggle: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  roleButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  roleButtonActive: {
    // Styles handled dynamically
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  tabActive: {
    // Styles handled dynamically
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formContainer: {
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  chipContainer: {
    maxHeight: 44,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bulkInstructions: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  exampleText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  bulkInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 200,
  },
  processButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  processButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  listSection: {
    marginTop: 24,
    marginBottom: 100,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  invitationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationName: {
    fontSize: 16,
    fontWeight: '600',
  },
  invitationEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  invitationDetails: {
    fontSize: 12,
    marginTop: 4,
  },
  invitationActions: {
    marginLeft: 12,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  sendButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default InvitationManager;