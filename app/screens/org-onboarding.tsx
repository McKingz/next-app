import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { createOrganization } from '@/services/OrganizationService';
import { assertSupabase } from '@/lib/supabase';

// Organization Onboarding with Authentication
// For new organizations (skills/tertiary/other organizations)
// Creates both user account and organization, then routes to Org Admin Dashboard
export default function OrgOnboardingScreen() {
  const { user, profile, refreshProfile } = useAuth();

  type Step = 'account_creation' | 'type_selection' | 'details' | 'review';

  const [step, setStep] = useState<Step>(user ? 'type_selection' : 'account_creation');
  const [creating, setCreating] = useState(false);
  const [orgId, setOrgId] = useState<string | null>((profile as any)?.organization_id || null);

  // Account creation fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Organization fields
  const [orgKind, setOrgKind] = useState<'skills' | 'tertiary' | 'org'>('skills');
  const [orgName, setOrgName] = useState<string>((profile as any)?.organization_name || '');
  const [adminName, setAdminName] = useState(`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim());
  const [phone, setPhone] = useState('');

  const canCreateAccount = useMemo(() => 
    email.trim().length > 0 && 
    password.length >= 6 && 
    password === confirmPassword &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0,
    [email, password, confirmPassword, firstName, lastName]
  );

  const canCreate = useMemo(() => Boolean(user?.id) && orgName.trim().length > 1, [user?.id, orgName]);

  const handleCreateAccount = useCallback(async () => {
    if (!canCreateAccount || creatingAccount) return;
    
    try {
      setCreatingAccount(true);
      
      // Create user account with Supabase Auth
      const { data: authData, error: authError } = await assertSupabase().auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo: 'https://www.edudashpro.org.za/landing?flow=email-confirm',
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            role: 'principal', // Organization admins get principal role
          }
        }
      });

      if (authError) throw authError;
      
      if (!authData.user) {
        throw new Error('Account creation failed - no user returned');
      }

      // If confirmations are enabled, route to verify screen and stop the wizard
      if (!authData.session) {
        Alert.alert(
          'Verify your email',
          'We\'ve sent you a confirmation email. Please verify your address to continue.',
          [{ text: 'OK' }]
        );
        router.replace({
          pathname: '/screens/verify-your-email',
          params: { email }
        } as any);
        return;
      }

      // Update admin name for next steps
      setAdminName(`${firstName.trim()} ${lastName.trim()}`);

      Alert.alert(
        'Account Created!', 
        'Your account has been created successfully. Now let\'s set up your organization.',
        [{ text: 'Continue', onPress: () => setStep('type_selection') }]
      );
      
    } catch (e: any) {
      console.error('Create account failed', e);
      let errorMessage = 'Failed to create account';
      if (e.message?.includes('already registered')) {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (e.message) {
        errorMessage = e.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setCreatingAccount(false);
    }
  }, [canCreateAccount, creatingAccount, email, password, firstName, lastName]);

  const handleCreateOrg = useCallback(async () => {
    if (!canCreate || creating) return;
    try {
      setCreating(true);
      
      // Create organization using server-side RPC
      // The RPC handles:
      // - Permission validation
      // - Organization insertion
      // - Profile linking automatically
      // - Auto-activation (no manual approval needed)
      const created = await createOrganization({
        name: orgName.trim(),
        type: orgKind,
        phone: phone.trim() || null,
        status: 'active',
      });
      
      setOrgId(created.id);

      // Refresh profile to get updated organization_id
      try { 
        await refreshProfile?.(); 
      } catch (e) { 
        console.debug('refreshProfile failed', e); 
      }

      Alert.alert(
        'Organization Created!', 
        `${orgName} has been created and activated. You can now start using your organization dashboard.`
      );
      router.replace('/screens/org-admin-dashboard');
    } catch (e: any) {
      console.error('Create org failed', e);
      Alert.alert('Error', e?.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  }, [canCreate, creating, orgName, orgKind, phone, refreshProfile]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Organization Onboarding' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>
          {step === 'account_creation' ? 'Create Your Account' : `Welcome, ${adminName || profile?.first_name || 'Admin'}`}
        </Text>
        <Text style={styles.subheading}>
          {step === 'account_creation'
            ? 'First, let\'s create your admin account.'
            : step === 'type_selection'
            ? 'Tell us what type of organization you represent.'
            : 'Provide your organization details to complete onboarding.'}
        </Text>

        {step === 'account_creation' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="John"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Doe"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password (minimum 6 characters)</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••"
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••"
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity 
              disabled={!canCreateAccount || creatingAccount} 
              style={[styles.button, (!canCreateAccount || creatingAccount) && styles.buttonDisabled]} 
              onPress={handleCreateAccount}
            >
              {creatingAccount ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')} style={styles.linkBtn}>
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'type_selection' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Organization Type</Text>
            <View style={styles.pillRow}>
              {(['skills', 'tertiary', 'org'] as const).map((k) => (
                <TouchableOpacity key={k} style={[styles.pill, orgKind === k && styles.pillActive]} onPress={() => setOrgKind(k)}>
                  <Text style={[styles.pillText, orgKind === k && styles.pillTextActive]}>
                    {k === 'skills' ? 'Skills/Training' : k === 'tertiary' ? 'Tertiary/Edu' : 'Organization'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.button} onPress={() => setStep('details')}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'details' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Organization name</Text>
            <TextInput
              style={styles.input}
              value={orgName}
              onChangeText={setOrgName}
              placeholder="e.g. Future Skills Academy"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              value={adminName}
              onChangeText={setAdminName}
              placeholder="Admin full name"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Organization phone (optional)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+27-.."
              keyboardType="phone-pad"
            />

            <TouchableOpacity disabled={!canCreate || creating} style={[styles.button, (!canCreate || creating) && styles.buttonDisabled]} onPress={handleCreateOrg}>
              {creating ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Create organization</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('type_selection')} style={styles.linkBtn}><Text style={styles.linkText}>Back</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  content: { padding: 16 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  subheading: { color: '#9CA3AF', marginBottom: 12 },
  label: { color: '#fff', marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: '#111827', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#1f2937', padding: 12 },
  button: { marginTop: 12, backgroundColor: '#00f5ff', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#000', fontWeight: '800' },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#1f2937', backgroundColor: '#0b1220' },
  pillActive: { backgroundColor: '#00f5ff', borderColor: '#00f5ff' },
  pillText: { color: '#fff', fontWeight: '700' },
  pillTextActive: { color: '#000' },
  linkBtn: { marginTop: 8, alignItems: 'center' },
  linkText: { color: '#60A5FA', textDecorationLine: 'underline' },
});
