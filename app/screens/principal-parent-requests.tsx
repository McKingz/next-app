import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, RefreshControl } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ParentJoinService, GuardianRequest } from '@/lib/services/parentJoinService';

export default function PrincipalParentRequestsScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const schoolId = (profile?.organization_id as string) || null;
  const [requests, setRequests] = useState<GuardianRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [studentIdMap, setStudentIdMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!schoolId) return;
    const data = await ParentJoinService.listPendingForSchool(schoolId);
    setRequests(data);
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const approve = async (req: GuardianRequest) => {
    const studentId = studentIdMap[req.id] || req.student_id || '';
    if (!studentId) {
      Alert.alert('Student required', 'Enter the student ID to link the parent.');
      return;
    }
    try {
      await ParentJoinService.approve(req.id, studentId, user?.id || '');
      Alert.alert('Approved', 'Parent linked to student');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to approve');
    }
  };

  const reject = async (req: GuardianRequest) => {
    try {
      await ParentJoinService.reject(req.id, user?.id || '');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to reject');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Parent Requests',
          headerShown: true,
          headerBackVisible: true,
        }} 
      />
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme?.primary || '#00f5ff'} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.text}>Parent: {item.parent_email || item.parent_auth_id}</Text>
            <Text style={styles.text}>Child: {item.child_full_name || '—'}</Text>
            <Text style={styles.text}>Requested: {new Date(item.created_at).toLocaleString()}</Text>
            <TextInput
              style={styles.input}
              value={studentIdMap[item.id] ?? ''}
              onChangeText={(v) => setStudentIdMap((m) => ({ ...m, [item.id]: v }))}
              placeholder={item.student_id || 'Enter student ID'}
              placeholderTextColor={theme?.textSecondary || '#9CA3AF'}
            />
            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.approve]} onPress={() => approve(item)}>
                <Text style={styles.btnTextDark}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.reject]} onPress={() => reject(item)}>
                <Text style={styles.btnTextDark}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No pending requests</Text>}
      />
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220', padding: 12 },
  card: { backgroundColor: theme?.cardBackground || '#111827', borderRadius: 12, padding: 12, borderColor: theme?.border || '#1f2937', borderWidth: 1, marginBottom: 10 },
  text: { color: theme?.text || '#fff', marginBottom: 4 },
  input: { backgroundColor: theme?.surface || '#0b1220', color: theme?.text || '#fff', borderRadius: 8, borderWidth: 1, borderColor: theme?.border || '#1f2937', padding: 10, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10 },
  approve: { backgroundColor: theme?.primary || '#00f5ff' },
  reject: { backgroundColor: theme?.error || '#ff0080' },
  btnTextDark: { color: '#000', fontWeight: '800' },
  empty: { color: theme?.textSecondary || '#9CA3AF', textAlign: 'center', marginTop: 20 },
});