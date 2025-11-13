import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { SchoolSettingsService } from '@/lib/services/SchoolSettingsService';
import { useAuth } from '@/contexts/AuthContext';

export default function SchoolSettingsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [number, setNumber] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        if (!profile?.organization_id) return;
        const { data, error } = await assertSupabase()
          .from('preschools')
          .select('settings, phone')
          .eq('id', profile.organization_id)
          .single();
        if (error) throw error;
        const configured = data?.settings?.whatsapp_number || data?.phone || '';
        if (active) setNumber(configured);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to load school settings');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [profile?.organization_id]);

  const save = async () => {
    try {
      if (!profile?.organization_id) return;
      const cleaned = number.replace(/\s+/g, '');
      if (!/^\+?\d{8,15}$/.test(cleaned)) {
        Alert.alert('Invalid number', 'Please enter a valid WhatsApp number in E.164 format (e.g. +27821234567)');
        return;
      }
      setSaving(true);
      await SchoolSettingsService.updateWhatsAppNumber(profile.organization_id, cleaned);
      Alert.alert('Saved', 'WhatsApp number updated');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save number');
    } finally { setSaving(false); }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16 },
    label: { color: theme.textSecondary, marginBottom: 8 },
    input: { backgroundColor: theme.surface, color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 12 },
    hint: { color: theme.textSecondary, fontSize: 12, marginTop: 6 },
    btn: { backgroundColor: theme.primary, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 16 },
    btnText: { color: theme.onPrimary, fontWeight: '700' },
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'School Settings', headerStyle: { backgroundColor: theme.background }, headerTitleStyle: { color: theme.text }, headerTintColor: theme.primary }} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <>
              <Text style={styles.label}>WhatsApp number (E.164)</Text>
              <TextInput
                style={styles.input}
                value={number}
                onChangeText={setNumber}
                keyboardType="phone-pad"
                placeholder="+27821234567"
                placeholderTextColor={theme.textSecondary}
              />
              <Text style={styles.hint}>Used for WhatsApp updates (wa.me deep link). You can include the + prefix.</Text>
              <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.btnText}>Save</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
