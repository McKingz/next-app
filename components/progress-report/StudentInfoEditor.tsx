import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { differenceInYears, parse, format, isValid } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { createProgressReportStyles } from '@/styles/progress-report/creator.styles';

/**
 * StudentInfoEditor Component
 * 
 * Collapsible, editable student information section with validation and Supabase persistence.
 * Follows React Native 0.79.5 and Supabase v2 patterns.
 * 
 * References:
 * - React Native TextInput: https://reactnative.dev/docs/0.79/textinput
 * - Zod validation: https://zod.dev/
 * - date-fns: https://date-fns.org/docs/Getting-Started
 * - Supabase JS v2: https://supabase.com/docs/reference/javascript/update
 * - TanStack Query v5: https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation
 * 
 * @component
 */

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  parent_name?: string;  // From joined query, not in students table
  parent_email?: string; // From joined query, not in students table
  parent_phone?: string; // From joined query, not in students table
  age_years?: number;
}

interface StudentInfoEditorProps {
  student: Student;
  preschoolId: string;
  onSaved: (updatedStudent: Student) => void;
  collapsedInitially?: boolean;
}

/**
 * Zod Schema for Student Info Validation
 * 
 * Reference: https://zod.dev/
 * 
 * NOTE: parent_name, parent_email, parent_phone are NOT in the students table.
 * They are displayed from joined queries but cannot be updated here.
 * Only first_name, last_name, and date_of_birth can be updated.
 */
const StudentEditorSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  date_of_birth: z.string()
    .min(1, 'Date of birth is required')
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Invalid date format (use DD/MM/YYYY)'),
});

/**
 * Convert DD/MM/YYYY to YYYY-MM-DD for database storage
 */
function convertToISODate(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split('/');
  if (parts.length !== 3) return ddmmyyyy;
  const [day, month, year] = parts;
  return `${year}-${month}-${day}`;
}

/**
 * Convert YYYY-MM-DD to DD/MM/YYYY for display
 */
function convertFromISODate(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

type StudentEditForm = z.infer<typeof StudentEditorSchema>;

export const StudentInfoEditor: React.FC<StudentInfoEditorProps> = ({
  student,
  preschoolId,
  onSaved,
  collapsedInitially = true,
}) => {
  const { theme } = useTheme();
  const styles = createProgressReportStyles(theme);
  const queryClient = useQueryClient();

  const [expanded, setExpanded] = useState(!collapsedInitially);
  const [saving, setSaving] = useState(false);
  
  // Initialize form with student data (convert date to DD/MM/YYYY for display)
  // NOTE: Only first_name, last_name, and date_of_birth can be edited (exist in students table)
  const [editedStudent, setEditedStudent] = useState<StudentEditForm>({
    first_name: student.first_name || '',
    last_name: student.last_name || '',
    date_of_birth: convertFromISODate(student.date_of_birth || ''),
  });

  const [errors, setErrors] = useState<Partial<Record<keyof StudentEditForm, string>>>({});

  /**
   * Compute age from date of birth (DD/MM/YYYY format)
   * Reference: https://date-fns.org/v4.1.0/docs/differenceInYears
   */
  const computedAge = useMemo(() => {
    if (!editedStudent.date_of_birth) return null;
    
    try {
      // Parse DD/MM/YYYY format
      const birthDate = parse(editedStudent.date_of_birth, 'dd/MM/yyyy', new Date());
      if (!isValid(birthDate)) return null;
      
      const age = differenceInYears(new Date(), birthDate);
      return age >= 0 && age < 100 ? age : null;
    } catch {
      return null;
    }
  }, [editedStudent.date_of_birth]);

  /**
   * Check if form has been modified (dirty state)
   * Reference: https://react.dev/reference/react/useMemo
   */
  const isDirty = useMemo(() => {
    const normalize = (val?: string) => val?.trim() || '';
    
    // Compare date in same format (convert DB format to display format)
    const currentDateDisplay = convertFromISODate(student.date_of_birth || '');
    
    const dirty = (
      normalize(editedStudent.first_name) !== normalize(student.first_name) ||
      normalize(editedStudent.last_name) !== normalize(student.last_name) ||
      normalize(editedStudent.date_of_birth) !== normalize(currentDateDisplay)
    );
    
    if (__DEV__) {
      console.log('[StudentInfo] isDirty check:', {
        dirty,
        first_name: `"${normalize(editedStudent.first_name)}" vs "${normalize(student.first_name)}"`,
        last_name: `"${normalize(editedStudent.last_name)}" vs "${normalize(student.last_name)}"`,
        date_of_birth: `"${normalize(editedStudent.date_of_birth)}" vs "${normalize(currentDateDisplay)}"`,
      });
    }
    
    return dirty;
  }, [editedStudent, student]);

  /**
   * Handle saving student info to Supabase
   * Reference: https://supabase.com/docs/reference/javascript/update
   */
  const handleSave = useCallback(async () => {
    // Validate with Zod
    const validation = StudentEditorSchema.safeParse(editedStudent);
    
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      setErrors(fieldErrors as any);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      if (__DEV__) {
        console.log('[StudentInfo] Saving student:', student.id);
      }

      // Prepare payload (convert DD/MM/YYYY to YYYY-MM-DD for database)
      // NOTE: Only updating fields that exist in students table
      const payload = {
        first_name: editedStudent.first_name.trim(),
        last_name: editedStudent.last_name.trim(),
        date_of_birth: convertToISODate(editedStudent.date_of_birth),
      };

      // Update in Supabase with RLS filter
      // Reference: https://supabase.com/docs/reference/javascript/update
      const { data, error } = await supabase
        .from('students')
        .update(payload)
        .eq('id', student.id)
        .eq('preschool_id', preschoolId) // RLS enforcement
        .select()
        .single();

      if (error) throw error;

      if (__DEV__) {
        console.log('[StudentInfo] Student saved successfully:', data);
      }

      // Invalidate TanStack Query caches
      // Reference: https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation
      queryClient.invalidateQueries({ queryKey: ['student', preschoolId, student.id] });
      queryClient.invalidateQueries({ queryKey: ['students', preschoolId] });

      // Notify parent component
      onSaved(data as Student);

      // Collapse editor
      setExpanded(false);

      Alert.alert('Success', 'Student information updated successfully');
    } catch (error: any) {
      console.error('[StudentInfo] Save error:', error);
      Alert.alert('Error', error.message || 'Failed to save student information');
    } finally {
      setSaving(false);
    }
  }, [editedStudent, student.id, preschoolId, onSaved, queryClient]);

  /**
   * Cancel editing and revert changes
   */
  const handleCancel = useCallback(() => {
    setEditedStudent({
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      date_of_birth: convertFromISODate(student.date_of_birth || ''),
    });
    setErrors({});
    setExpanded(false);
  }, [student]);

  /**
   * Render collapsed view
   */
  if (!expanded) {
    return (
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>
              {student.first_name} {student.last_name}
            </Text>
            {student.age_years !== undefined && (
              <Text style={styles.parentInfo}>Age: {student.age_years} years</Text>
            )}
            <Text style={styles.parentInfo}>
              Parent/Guardian: {student.parent_name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setExpanded(true)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: theme.primary,
              minHeight: 36,
            }}
            accessibilityLabel="Edit student information"
            accessibilityRole="button"
          >
            <Text style={{ color: theme.onPrimary, fontSize: 13, fontWeight: '600' }}>
              Edit
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /**
   * Render expanded edit form
   */
  return (
    <View style={[styles.header, { gap: 16 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[styles.label, { marginBottom: 0 }]}>Student Information</Text>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.closeButton}
          accessibilityLabel="Cancel editing"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* First Name */}
      <View>
        <Text style={styles.label}>First Name *</Text>
        <TextInput
          style={[styles.input, errors.first_name && { borderColor: theme.error }]}
          value={editedStudent.first_name}
          onChangeText={(text) => setEditedStudent((prev) => ({ ...prev, first_name: text }))}
          placeholder="Enter first name"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="words"
          returnKeyType="next"
          blurOnSubmit={false}
        />
        {errors.first_name && (
          <Text style={[styles.helperText, { color: theme.error }]}>{errors.first_name}</Text>
        )}
      </View>

      {/* Last Name */}
      <View>
        <Text style={styles.label}>Last Name *</Text>
        <TextInput
          style={[styles.input, errors.last_name && { borderColor: theme.error }]}
          value={editedStudent.last_name}
          onChangeText={(text) => setEditedStudent((prev) => ({ ...prev, last_name: text }))}
          placeholder="Enter last name"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="words"
          returnKeyType="next"
          blurOnSubmit={false}
        />
        {errors.last_name && (
          <Text style={[styles.helperText, { color: theme.error }]}>{errors.last_name}</Text>
        )}
      </View>

      {/* Date of Birth */}
      <View>
        <Text style={styles.label}>Date of Birth * {computedAge !== null && `(Age: ${computedAge})`}</Text>
        <TextInput
          style={[styles.input, errors.date_of_birth && { borderColor: theme.error }]}
          value={editedStudent.date_of_birth}
          onChangeText={(text) => {
            // Auto-format date as DD/MM/YYYY
            // Remove non-digits
            const digits = text.replace(/\D/g, '');
            let formatted = '';
            
            if (digits.length > 0) {
              // DD
              formatted = digits.substring(0, 2);
              
              if (digits.length >= 3) {
                // DD/MM
                formatted += '/' + digits.substring(2, 4);
              }
              
              if (digits.length >= 5) {
                // DD/MM/YYYY
                formatted += '/' + digits.substring(4, 8);
              }
            }
            
            setEditedStudent((prev) => ({ ...prev, date_of_birth: formatted }));
          }}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={theme.textSecondary}
          keyboardType="numeric"
          maxLength={10}
          returnKeyType="next"
          blurOnSubmit={false}
        />
        {errors.date_of_birth && (
          <Text style={[styles.helperText, { color: theme.error }]}>{errors.date_of_birth}</Text>
        )}
        <Text style={styles.helperText}>Format: DD/MM/YYYY (e.g., 15/05/2020)</Text>
      </View>

      {/* Parent/Guardian Info (Read-Only Display) */}
      {student.parent_name && (
        <View style={{ padding: 12, backgroundColor: theme.surface, borderRadius: 8 }}>
          <Text style={[styles.label, { marginBottom: 4 }]}>Parent/Guardian Information</Text>
          <Text style={{ color: theme.text, fontSize: 14, marginBottom: 2 }}>
            Name: {student.parent_name}
          </Text>
          {student.parent_email && (
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 2 }}>
              Email: {student.parent_email}
            </Text>
          )}
          {student.parent_phone && (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Phone: {student.parent_phone}
            </Text>
          )}
          <Text style={[styles.helperText, { marginTop: 8, fontStyle: 'italic' }]}>Parent details are managed separately and cannot be edited here.</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        <TouchableOpacity
          style={[styles.actionButton, { flex: 1, opacity: (!isDirty || saving || Object.keys(errors).length > 0) ? 0.5 : 1 }]}
          onPress={() => {
            if (__DEV__) {
              console.log('[StudentInfo] Save button pressed', {
                isDirty,
                saving,
                hasErrors: Object.keys(errors).length > 0,
                errors,
                disabled: !isDirty || saving || Object.keys(errors).length > 0,
              });
            }
            handleSave();
          }}
          disabled={!isDirty || saving || Object.keys(errors).length > 0}
          accessibilityLabel="Save changes"
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.onPrimary} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.onPrimary} />
              <Text style={styles.actionButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            { 
              flex: 1, 
              backgroundColor: theme.error,
              opacity: saving ? 0.5 : 1,
            }
          ]}
          onPress={handleCancel}
          disabled={saving}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" />
          <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
