/**
 * StudentEditModal Component
 * 
 * Modal for editing student information with:
 * - Dark mode support
 * - Zod validation
 * - TanStack Query mutations
 * - Role-based access control
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useUpdateStudent } from '@/hooks/useStudents';
import { Student, StudentUpdatePayload } from '@/services/students';
import { z } from 'zod';

// Validation schema
const StudentUpdateSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  preferred_name: z.string().max(50).optional(),
  status: z.enum(['active', 'inactive', 'pending']),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  medical_conditions: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  emergency_contact_name: z.string().max(100).optional().nullable(),
  emergency_contact_phone: z.string().max(20).optional().nullable(),
  email: z.string().email('Invalid email').or(z.literal('')).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});

interface Props {
  visible: boolean;
  onClose: () => void;
  student: Student;
  onSuccess?: () => void;
}

export default function StudentEditModal({ visible, onClose, student, onSuccess }: Props) {
  const { theme } = useTheme();
  const updateMutation = useUpdateStudent();

  // Form state
  const [firstName, setFirstName] = useState(student.first_name);
  const [lastName, setLastName] = useState(student.last_name);
  const [preferredName, setPreferredName] = useState(student.preferred_name || '');
  const [status, setStatus] = useState<'active' | 'inactive' | 'pending'>(student.status);
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(student.gender || null);
  const [dateOfBirth, setDateOfBirth] = useState(student.date_of_birth || '');
  const [medicalConditions, setMedicalConditions] = useState(student.medical_conditions || '');
  const [allergies, setAllergies] = useState(student.allergies || '');
  const [emergencyContactName, setEmergencyContactName] = useState(
    student.emergency_contact_name || ''
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    student.emergency_contact_phone || ''
  );
  const [email, setEmail] = useState(student.email || '');
  const [phone, setPhone] = useState(student.phone || '');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when student changes
  useEffect(() => {
    if (visible) {
      setFirstName(student.first_name);
      setLastName(student.last_name);
      setPreferredName(student.preferred_name || '');
      setStatus(student.status);
      setGender(student.gender || null);
      setDateOfBirth(student.date_of_birth || '');
      setMedicalConditions(student.medical_conditions || '');
      setAllergies(student.allergies || '');
      setEmergencyContactName(student.emergency_contact_name || '');
      setEmergencyContactPhone(student.emergency_contact_phone || '');
      setEmail(student.email || '');
      setPhone(student.phone || '');
      setErrors({});
    }
  }, [visible, student]);

  const handleSave = async () => {
    const payload: StudentUpdatePayload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      preferred_name: preferredName.trim() || null,
      status,
      gender,
      date_of_birth: dateOfBirth || null,
      medical_conditions: medicalConditions.trim() || null,
      allergies: allergies.trim() || null,
      emergency_contact_name: emergencyContactName.trim() || null,
      emergency_contact_phone: emergencyContactPhone.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
    };

    // Validate with Zod
    const result = StudentUpdateSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        studentId: student.id,
        payload,
      });

      Alert.alert('Success', 'Student details updated successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update student'
      );
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        },
        modalContainer: {
          backgroundColor: theme.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '90%',
        },
        modalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 20,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        },
        modalTitle: {
          fontSize: 20,
          fontWeight: '600',
          color: theme.text,
          flex: 1,
        },
        modalContent: {
          padding: 20,
        },
        section: {
          marginBottom: 20,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.text,
          marginBottom: 12,
        },
        label: {
          fontSize: 14,
          fontWeight: '500',
          color: theme.text,
          marginBottom: 6,
        },
        required: {
          color: theme.error,
        },
        input: {
          backgroundColor: theme.surface,
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
          color: theme.text,
          borderWidth: 1,
          borderColor: theme.border,
          marginBottom: 4,
        },
        inputError: {
          borderColor: theme.error,
        },
        textArea: {
          minHeight: 80,
          textAlignVertical: 'top',
        },
        errorText: {
          fontSize: 12,
          color: theme.error,
          marginBottom: 8,
        },
        statusButtons: {
          flexDirection: 'row',
          gap: 8,
          marginBottom: 12,
        },
        statusButton: {
          flex: 1,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          alignItems: 'center',
        },
        statusButtonActive: {
          backgroundColor: theme.primary + '20',
          borderColor: theme.primary,
        },
        statusButtonText: {
          fontSize: 14,
          color: theme.textSecondary,
          fontWeight: '500',
        },
        statusButtonTextActive: {
          color: theme.primary,
          fontWeight: '600',
        },
        genderButtons: {
          flexDirection: 'row',
          gap: 8,
          marginBottom: 12,
        },
        genderButton: {
          flex: 1,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          alignItems: 'center',
        },
        genderButtonActive: {
          backgroundColor: theme.primary + '20',
          borderColor: theme.primary,
        },
        genderButtonText: {
          fontSize: 14,
          color: theme.textSecondary,
          fontWeight: '500',
        },
        genderButtonTextActive: {
          color: theme.primary,
          fontWeight: '600',
        },
        modalActions: {
          flexDirection: 'row',
          gap: 12,
          padding: 20,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        },
        cancelButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 8,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          alignItems: 'center',
        },
        cancelButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.textSecondary,
        },
        saveButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 8,
          backgroundColor: theme.primary,
          alignItems: 'center',
        },
        saveButtonDisabled: {
          backgroundColor: theme.textSecondary + '40',
        },
        saveButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.onPrimary,
        },
      }),
    [theme]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Student</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Basic Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Information</Text>

              <Text style={styles.label}>
                First Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.first_name && styles.inputError]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                placeholderTextColor={theme.textSecondary}
              />
              {errors.first_name && <Text style={styles.errorText}>{errors.first_name}</Text>}

              <Text style={styles.label}>
                Last Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.last_name && styles.inputError]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter last name"
                placeholderTextColor={theme.textSecondary}
              />
              {errors.last_name && <Text style={styles.errorText}>{errors.last_name}</Text>}

              <Text style={styles.label}>Preferred Name</Text>
              <TextInput
                style={styles.input}
                value={preferredName}
                onChangeText={setPreferredName}
                placeholder="Enter preferred name (optional)"
                placeholderTextColor={theme.textSecondary}
              />

              <Text style={styles.label}>Date of Birth</Text>
              <TextInput
                style={styles.input}
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textSecondary}
              />

              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderButtons}>
                {['male', 'female', 'other'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderButton, gender === g && styles.genderButtonActive]}
                    onPress={() => setGender(g as 'male' | 'female' | 'other')}
                  >
                    <Text
                      style={[
                        styles.genderButtonText,
                        gender === g && styles.genderButtonTextActive,
                      ]}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>
                Status <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.statusButtons}>
                {['active', 'inactive', 'pending'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusButton, status === s && styles.statusButtonActive]}
                    onPress={() => setStatus(s as 'active' | 'inactive' | 'pending')}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        status === s && styles.statusButtonTextActive,
                      ]}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Medical Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Medical Information</Text>

              <Text style={styles.label}>Medical Conditions</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={medicalConditions}
                onChangeText={setMedicalConditions}
                placeholder="Any medical conditions..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Allergies</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={allergies}
                onChangeText={setAllergies}
                placeholder="Any allergies..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Emergency Contact */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Emergency Contact</Text>

              <Text style={styles.label}>Emergency Contact Name</Text>
              <TextInput
                style={styles.input}
                value={emergencyContactName}
                onChangeText={setEmergencyContactName}
                placeholder="Enter emergency contact name"
                placeholderTextColor={theme.textSecondary}
              />

              <Text style={styles.label}>Emergency Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={emergencyContactPhone}
                onChangeText={setEmergencyContactPhone}
                placeholder="+27 XX XXX XXXX"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            {/* Contact Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Contact</Text>

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={email}
                onChangeText={setEmail}
                placeholder="student@example.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+27 XX XXX XXXX"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
              />
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, updateMutation.isPending && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color={theme.onPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
