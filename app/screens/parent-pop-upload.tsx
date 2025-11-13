import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { assertSupabase } from '@/lib/supabase';

export default function ParentPoPUploadScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [ref, setRef] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!ref.trim() || !amount.trim()) {
      Alert.alert('Missing info', 'Please enter reference and amount');
      return;
    }
    setLoading(true);
    try {
      await assertSupabase().from('parent_payments').insert({
        reference: ref,
        amount: parseFloat(amount),
        status: 'pending_review',
      } as any);
      Alert.alert('Uploaded', 'Your proof of payment has been submitted.');
      setRef('');
      setAmount('');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, gap: 12, backgroundColor: theme.background },
    label: { color: theme.text },
    input: { backgroundColor: theme.surface, borderRadius: 10, padding: 12, color: theme.text },
    btn: { backgroundColor: theme.primary, padding: 12, borderRadius: 10, alignItems: 'center' },
    btnText: { color: theme.onPrimary, fontWeight: '800' },
  });

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Upload PoP', headerStyle: { backgroundColor: theme.background }, headerTitleStyle: { color: theme.text }, headerTintColor: theme.primary }} />
      <SafeAreaView style={styles.container}>
        <Text style={styles.label}>Payment reference</Text>
        <TextInput value={ref} onChangeText={setRef} style={styles.input} placeholder="e.g. POP-12345" placeholderTextColor={theme.textSecondary} />
        <Text style={styles.label}>Amount</Text>
        <TextInput value={amount} onChangeText={setAmount} style={styles.input} keyboardType="decimal-pad" placeholder="e.g. 500.00" placeholderTextColor={theme.textSecondary} />
        <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.btnText}>Submit</Text>}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}
