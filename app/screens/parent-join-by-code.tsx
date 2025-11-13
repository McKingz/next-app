import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';

export default function ParentJoinByCodeScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [code, setCode] = useState('');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<any | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [currentSchool, setCurrentSchool] = useState<{ id: string; name: string } | null>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);

  // Fetch current school info if parent is already linked
  useEffect(() => {
    const fetchCurrentSchool = async () => {
      if (!profile?.preschool_id) {
        setLoadingSchool(false);
        return;
      }
      try {
        const { data, error } = await assertSupabase()
          .from('preschools')
          .select('id, name')
          .eq('id', profile.preschool_id)
          .maybeSingle();
        
        if (!error && data) {
          setCurrentSchool(data);
        }
      } catch (e) {
        console.error('Failed to fetch current school:', e);
      } finally {
        setLoadingSchool(false);
      }
    };
    
    fetchCurrentSchool();
  }, [profile?.preschool_id]);

  const onValidate = async () => {
    if (!code.trim() || !email.trim()) {
      Alert.alert('Missing info', 'Enter the school code and your email.');
      return;
    }
    try {
      setValidated(null);
      setValidating(true);
      const { data, error } = await assertSupabase()
        .rpc('validate_invitation_code', { p_code: code.trim(), p_email: email.trim() });
      if (error) throw error;
      if (!data) throw new Error('Code not found or inactive');
      
      // Handle new JSON response format with school info
      if (typeof data === 'object' && 'valid' in data) {
        if (!data.valid) {
          throw new Error(data.error || 'Invalid invitation code');
        }
        setValidated(data);
        Alert.alert('Valid Code!', `You can join ${data.school_name || 'this school'}.`);
      } else {
        // Legacy format fallback
        setValidated(data);
        Alert.alert('Code valid', 'You can join this school.');
      }
    } catch (e: any) {
      Alert.alert('Invalid code', e?.message || 'This code is invalid or expired.');
    } finally {
      setValidating(false);
    }
  };

  const onJoin = async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in first.');
      return;
    }
    if (!code.trim()) {
      Alert.alert('Missing code', 'Enter a school code first.');
      return;
    }
    
    // Check if user already belongs to a school
    if (profile?.preschool_id && validated?.school_id && profile.preschool_id !== validated.school_id) {
      Alert.alert(
        'Already Linked',
        'You are already linked to a different school. Please contact support to change schools.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    try {
      setRedeeming(true);
      const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Parent';
      const { data, error } = await assertSupabase()
        .rpc('use_invitation_code', {
          p_auth_user_id: user.id,
          p_code: code.trim(),
          p_name: fullName,
          p_phone: (profile as any)?.phone || null,
        });
      
      if (error) {
        console.error('Join school error:', error);
        // Handle specific error cases
        if (error.code === 'P0001' || error.message?.includes('already')) {
          throw new Error('You are already linked to a school. Please contact support if you need to change schools.');
        }
        throw error;
      }
      
      Alert.alert('Success!', `You've joined ${validated?.school_name || 'the school'}!`);
      // Refresh the page to update profile
      setTimeout(() => {
        router.replace('/screens/parent-children');
      }, 1000);
    } catch (e: any) {
      console.error('Join error:', e);
      Alert.alert('Failed', e?.message || 'Could not join with this code.');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Stack.Screen options={{ title: 'Join School by Code' }} />
      
      {/* Current School Status */}
      {loadingSchool ? (
        <View style={styles.statusCard}>
          <ActivityIndicator color={theme?.primary || '#00f5ff'} />
          <Text style={styles.statusText}>Checking school status...</Text>
        </View>
      ) : currentSchool ? (
        <View style={[styles.statusCard, styles.statusCardLinked]}>
          <Text style={styles.statusIcon}>✓</Text>
          <Text style={styles.statusTitle}>Currently Linked</Text>
          <Text style={styles.statusSchoolName}>{currentSchool.name}</Text>
          <Text style={styles.statusHint}>Use the code below to join a different school or verify access</Text>
        </View>
      ) : (
        <View style={[styles.statusCard, styles.statusCardNotLinked]}>
          <Text style={styles.statusIcon}>ℹ️</Text>
          <Text style={styles.statusTitle}>Not Linked to Any School</Text>
          <Text style={styles.statusHint}>Enter an invitation code below to join a school</Text>
        </View>
      )}
      
      <Text style={styles.label}>School code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="e.g. 8-char code"
        autoCapitalize="characters"
      />
      <Text style={styles.label}>Your email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TouchableOpacity style={styles.button} onPress={onValidate} disabled={validating}>
        {validating ? <ActivityIndicator color={theme?.onPrimary || '#000'} /> : <Text style={styles.buttonText}>Validate Code</Text>}
      </TouchableOpacity>

      {validated && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏫 {validated.school_name || 'School'}</Text>
          <Text style={styles.cardSubtitle}>You're about to join this school</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Invitation Type:</Text>
            <Text style={styles.infoValue}>{validated.invitation_type === 'parent' ? 'Parent' : validated.invitation_type}</Text>
          </View>
          
          {validated.max_uses && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Uses:</Text>
              <Text style={styles.infoValue}>{validated.current_uses ?? 0} / {validated.max_uses}</Text>
            </View>
          )}
          
          {validated.expires_at && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Expires:</Text>
              <Text style={styles.infoValue}>{new Date(validated.expires_at).toLocaleDateString()}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.button, styles.joinBtn]} onPress={onJoin} disabled={redeeming}>
            {redeeming ? <ActivityIndicator color={theme?.onPrimary || '#000'} /> : <Text style={styles.buttonText}>✓ Join {validated.school_name || 'School'}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220' },
  scrollContent: { padding: 16 },
  statusCard: { marginBottom: 20, backgroundColor: theme?.surface || '#111827', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 2 },
  statusCardLinked: { borderColor: '#10b981' },
  statusCardNotLinked: { borderColor: theme?.border || '#1f2937' },
  statusIcon: { fontSize: 32, marginBottom: 8 },
  statusTitle: { color: theme?.text || '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  statusSchoolName: { color: theme?.primary || '#00f5ff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  statusText: { color: theme?.text || '#fff', marginTop: 8 },
  statusHint: { color: theme?.textSecondary || '#9ca3af', fontSize: 13, textAlign: 'center' },
  label: { color: theme?.text || '#fff', marginTop: 8, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: theme?.surface || '#111827', color: theme?.text || '#fff', borderRadius: 8, borderWidth: 1, borderColor: theme?.border || '#1f2937', padding: 12, fontSize: 16 },
  button: { marginTop: 12, backgroundColor: theme?.primary || '#00f5ff', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: theme?.onPrimary || '#000', fontWeight: '800', fontSize: 16 },
  card: { marginTop: 20, backgroundColor: theme?.surface || '#111827', borderRadius: 12, padding: 16, borderColor: theme?.primary || '#00f5ff', borderWidth: 2 },
  cardTitle: { color: theme?.text || '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { color: theme?.textSecondary || '#9ca3af', fontSize: 14, marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingVertical: 4 },
  infoLabel: { color: theme?.textSecondary || '#9ca3af', fontSize: 14 },
  infoValue: { color: theme?.text || '#fff', fontSize: 14, fontWeight: '600' },
  joinBtn: { marginTop: 16 },
});
