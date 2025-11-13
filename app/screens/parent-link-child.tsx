import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ParentJoinService } from '@/lib/services/parentJoinService';

export default function ParentLinkChildScreen() {
  const { user, profile } = useAuth();
  const [childFullName, setChildFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!user) return;
    if (!childFullName && !studentId) {
      Alert.alert('Missing info', 'Enter your child name or student ID');
      return;
    }
    try {
      setSubmitting(true);
      const reqId = await ParentJoinService.requestLink({
        schoolId: (profile?.organization_id as string) || null,
        parentAuthId: user.id,
        parentEmail: user.email || null,
        studentId: studentId || null,
        childFullName: childFullName || null,
      });
      Alert.alert('Request sent', 'Your request has been submitted for approval.');
      setChildFullName('');
      setStudentId('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Link Your Child' }} />
      <Text style={styles.title}>Request to link your child</Text>
      <Text style={styles.label}>Child full name</Text>
      <TextInput style={styles.input} value={childFullName} onChangeText={setChildFullName} placeholder="e.g. Thandi Ndlovu" />
      <Text style={styles.or}>OR</Text>
      <Text style={styles.label}>Student ID (if provided by school)</Text>
      <TextInput style={styles.input} value={studentId} onChangeText={setStudentId} placeholder="UUID or school-provided ID" />
      <TouchableOpacity disabled={submitting} style={styles.button} onPress={onSubmit}>
        <Text style={styles.buttonText}>{submitting ? 'Submitting...' : 'Submit Request'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#0b1220' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { color: '#fff', marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: '#111827', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#1f2937', padding: 12 },
  or: { color: '#9CA3AF', textAlign: 'center', marginVertical: 8 },
  button: { marginTop: 16, backgroundColor: '#00f5ff', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#000', fontWeight: '800' },
});