import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function TeacherInviteAcceptScreen() {
  const { user } = useAuth();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Prefill from deep link params if present
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  React.useEffect(() => {
    if (typeof params?.token === 'string' && params.token) setToken(String(params.token));
    if (typeof params?.email === 'string' && params.email) setEmail(String(params.email));
  }, [params?.token, params?.email]);

  const onAccept = async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in first, then accept the invite.');
      return;
    }
    if (!token.trim() || !email.trim()) {
      Alert.alert('Missing info', 'Enter the invite token and email.');
      return;
    }
    try {
      setSubmitting(true);
      const { TeacherInviteService } = await import('@/lib/services/teacherInviteService');
      await TeacherInviteService.accept({ token: token.trim(), authUserId: user.id, email: email.trim() });
      Alert.alert('Invite accepted', 'Your account has been linked as a teacher.');
      router.replace('/screens/teacher-dashboard');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to accept invite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Accept Teacher Invite' }} />
      <Text style={styles.title}>Enter your invite token</Text>
      <Text style={styles.label}>Invite token</Text>
      <TextInput style={styles.input} value={token} onChangeText={setToken} autoCapitalize="none" placeholder="Paste the invite token" />
      <Text style={styles.label}>Your email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
      <TouchableOpacity disabled={submitting} style={styles.button} onPress={onAccept}>
        <Text style={styles.buttonText}>{submitting ? 'Submitting…' : 'Accept Invite'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#0b1220' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { color: '#fff', marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: '#111827', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#1f2937', padding: 12 },
  button: { marginTop: 16, backgroundColor: '#00f5ff', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#000', fontWeight: '800' },
});