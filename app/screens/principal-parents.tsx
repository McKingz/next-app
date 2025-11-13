import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';

interface ParentRow {
  auth_user_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  children: string[];
}

export default function PrincipalParentsScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const schoolId = (profile?.organization_id as string) || (profile as any)?.preschool_id || null;

  const [parents, setParents] = useState<ParentRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      // 1) Fetch students for the school
      const { data: students, error: studentsErr } = await assertSupabase()
        .from('students')
        .select('id, first_name, last_name, parent_id, guardian_id, preschool_id, is_active')
        .eq('preschool_id', schoolId)
        .eq('is_active', true);
      if (studentsErr) throw studentsErr;

      const idToChildren: Record<string, string[]> = {};
      const uniqueIds = new Set<string>();

      (students || []).forEach((s: any) => {
        const childName = `${s.first_name || ''} ${s.last_name || ''}`.trim();
        if (s.parent_id) {
          uniqueIds.add(s.parent_id);
          idToChildren[s.parent_id] = idToChildren[s.parent_id] || [];
          idToChildren[s.parent_id].push(childName);
        }
        if (s.guardian_id && s.guardian_id !== s.parent_id) {
          uniqueIds.add(s.guardian_id);
          idToChildren[s.guardian_id] = idToChildren[s.guardian_id] || [];
          idToChildren[s.guardian_id].push(childName);
        }
      });

      const ids = Array.from(uniqueIds);
      if (ids.length === 0) {
        setParents([]);
        return;
      }

      // 2) Fetch parent profiles by auth_user_id
      const { data: users, error: usersErr } = await assertSupabase()
        .from('users')
        .select('auth_user_id, name, email, phone')
        .in('auth_user_id', ids);
      if (usersErr) throw usersErr;

      const merged: ParentRow[] = (users || []).map((u: any) => ({
        auth_user_id: u.auth_user_id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        children: idToChildren[u.auth_user_id] || [],
      }));

      // Sort by name/email
      merged.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));

      setParents(merged);
    } catch (e: any) {
      console.error('Load parents failed', e);
      Alert.alert('Error', e?.message || 'Failed to load parents');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q)
    );
  }, [parents, search]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Parents', headerShown: true }} />
      {!schoolId ? (
        <Text style={styles.text}>No school found on your profile.</Text>
      ) : (
        <>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email, or phone"
            placeholderTextColor={theme?.textSecondary || '#9CA3AF'}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.auth_user_id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme?.primary || '#00f5ff'} />}
            ListEmptyComponent={
              loading ? <Text style={styles.muted}>Loading…</Text> : <Text style={styles.muted}>No parents found</Text>
            }
            renderItem={({ item }) => {
              const childCount = item.children.length;
              const childPreview = item.children.slice(0, 2).join(', ');
              return (
                <View style={styles.card}>
                  <Text style={styles.name}>{item.name || item.email || 'Parent'}</Text>
                  {!!item.email && <Text style={styles.text}>Email: {item.email}</Text>}
                  {!!item.phone && <Text style={styles.text}>Phone: {item.phone}</Text>}
                  <Text style={styles.text}>Children: {childCount}{childPreview ? ` – ${childPreview}${childCount > 2 ? '…' : ''}` : ''}</Text>
                </View>
              );
            }}
          />
        </>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220', padding: 12 },
  text: { color: theme?.text || '#fff' },
  muted: { color: theme?.textSecondary || '#9CA3AF', padding: 12, textAlign: 'center' },
  search: { backgroundColor: theme?.surface || '#111827', color: theme?.text || '#fff', borderRadius: 10, padding: 12, borderColor: theme?.border || '#1f2937', borderWidth: 1, marginBottom: 8 },
  card: { backgroundColor: theme?.cardBackground || '#111827', borderRadius: 12, padding: 12, borderColor: theme?.border || '#1f2937', borderWidth: 1, marginBottom: 10 },
  name: { color: theme?.text || '#fff', fontWeight: '800', fontSize: 16, marginBottom: 4 },
});