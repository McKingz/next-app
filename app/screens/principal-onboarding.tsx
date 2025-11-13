import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { TenantService } from '@/lib/services/tenant';
import { TeacherInviteService } from '@/lib/services/teacherInviteService';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

// Best-effort local persistence (works in native; silently no-ops on web if not available)
let AsyncStorage: any = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch (e) { console.debug('AsyncStorage unavailable', e); }

type Step = 'type_selection' | 'details' | 'invites' | 'templates' | 'subscription' | 'review';

export default function PrincipalOnboardingScreen() {
  const { user, profile, refreshProfile } = useAuth();

  // Guard: if user is not authenticated, never show onboarding
  useEffect(() => {
    if (!user) {
      try { router.replace('/(auth)/sign-in'); } catch { /* Intentional: non-fatal */ }
    }
  }, [user]);

  // Wizard state
  const [step, setStep] = useState<Step>('type_selection');
  const [creating, setCreating] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(profile?.organization_id || null);
  
  // School type selection
  const [schoolType, setSchoolType] = useState<'preschool' | 'k12_school' | 'hybrid'>('preschool');
  const [showSubscriptionStep, setShowSubscriptionStep] = useState(true);

  // Details
  const [schoolName, setSchoolName] = useState(profile?.organization_name || '');
  const [adminName, setAdminName] = useState(`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim());
  const [phone, setPhone] = useState('');
  const [planTier, setPlanTier] = useState<'free' | 'starter' | 'premium' | 'enterprise'>('free');

  // Invites
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [sentInvites, setSentInvites] = useState<{ email: string; status: 'pending' | 'sent' | 'error'; id?: string }[]>([]);

  // Templates (mock selections for now)
  const availableTemplates = useMemo(() => [
    { id: 'starter_classes', name: 'Starter Class Groups' },
    { id: 'starter_lessons', name: 'AI Lesson Starters' },
    { id: 'attendance_pack', name: 'Attendance + Reports Pack' },
  ], []);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  // Load saved progress
  useEffect(() => {
    (async () => {
      if (!AsyncStorage) return;
      try {
        const raw = await AsyncStorage.getItem('onboarding_principal_state');
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.step) setStep(saved.step);
          if (saved.schoolType) setSchoolType(saved.schoolType);
          if (saved.schoolName) setSchoolName(saved.schoolName);
          if (saved.adminName) setAdminName(saved.adminName);
          if (saved.phone) setPhone(saved.phone);
          if (saved.planTier) setPlanTier(saved.planTier);
          if (saved.emails) setEmails(saved.emails);
          if (saved.selectedTemplates) setSelectedTemplates(saved.selectedTemplates);
          if (saved.schoolId) setSchoolId(saved.schoolId);
          if (saved.showSubscriptionStep !== undefined) setShowSubscriptionStep(saved.showSubscriptionStep);
        }
      } catch (e) { console.debug('Load onboarding state failed', e); }
    })();
  }, []);

  // Save progress
  const persist = useCallback(async (next?: Partial<any>) => {
    if (!AsyncStorage) return;
    try {
      const state = {
        step,
        schoolType,
        schoolName,
        adminName,
        phone,
        planTier,
        emails,
        selectedTemplates,
        schoolId,
        showSubscriptionStep,
        ...(next || {}),
      };
      await AsyncStorage.setItem('onboarding_principal_state', JSON.stringify(state));
    } catch (e) { console.debug('Persist onboarding state failed', e); }
  }, [step, schoolName, adminName, phone, planTier, emails, selectedTemplates, schoolId]);

  const canCreate = useMemo(() => Boolean(user?.id) && Boolean(schoolName.trim()), [user?.id, schoolName]);

  const handleCreateSchool = useCallback(async () => {
    if (!canCreate || creating) return;
    try {
      setCreating(true);
      
      // Use the new register_new_school RPC function to properly handle school types
      const { data, error } = await assertSupabase().rpc('register_new_school', {
        p_school_name: schoolName.trim(),
        p_principal_email: user?.email || profile?.email || '',
        p_principal_name: adminName.trim() || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
        p_school_type: schoolType,
        p_grade_levels: schoolType === 'preschool' ? ['pre_k'] : schoolType === 'k12_school' ? ['foundation'] : ['pre_k', 'foundation'], // Default grade levels
        p_contact_email: profile?.email || user?.email,
        p_contact_phone: phone.trim() || null,
        p_physical_address: null,
        p_selected_plan_id: null // Will be handled in subscription step if enabled
      });
      
      if (error) {
        throw error;
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      const schoolId = data.school_id;
      setSchoolId(schoolId);
      
      // Track the creation
      track('school_created_via_principal_onboarding', {
        school_type: schoolType,
        has_phone: !!phone.trim(),
        school_id: schoolId
      });
      
      try { 
        await refreshProfile(); 
      } catch (e) { 
        console.debug('refreshProfile failed', e); 
      }
      
      Alert.alert(
        'School Created!', 
        `${schoolName} has been registered successfully. ${data.next_step === 'email_verification' ? 'You may receive an email verification shortly. ' : ''}Let's invite your teachers next.`
      );
      
      setStep('invites');
      persist({ step: 'invites', schoolId });
      
    } catch (e: any) {
      console.error('Create school failed', e);
      
      // Enhanced error messages
      let errorMessage = 'Failed to create school';
      if (e.message?.includes('already exists')) {
        errorMessage = 'A school with this name already exists. Please choose a different name.';
      } else if (e.message?.includes('email already registered')) {
        errorMessage = 'This email is already registered. Please use a different email address.';
      } else if (e.message) {
        errorMessage = e.message;
      }
      
      Alert.alert('Error', errorMessage);
      
      track('school_creation_failed_principal_onboarding', {
        error: e.message,
        school_type: schoolType
      });
    } finally {
      setCreating(false);
    }
  }, [canCreate, creating, schoolName, adminName, phone, schoolType, user, profile, refreshProfile, persist]);

  const addEmail = useCallback(() => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (emails.includes(trimmed)) return;
    const next = [...emails, trimmed];
    setEmails(next);
    setEmailInput('');
    persist({ emails: next });
  }, [emailInput, emails, persist]);

  const removeEmail = useCallback((target: string) => {
    const next = emails.filter(e => e !== target);
    setEmails(next);
    persist({ emails: next });
  }, [emails, persist]);

  const sendInvites = useCallback(async () => {
    if (!schoolId || !user?.id) {
      Alert.alert('Missing school', 'Please create the school first.');
      return;
    }
    if (!emails.length) {
      setStep('templates');
      persist({ step: 'templates' });
      return;
    }
    try {
      setSendingInvites(true);
      const results: { email: string; status: 'pending' | 'sent' | 'error'; id?: string }[] = [];
      for (const email of emails) {
        try {
          const inv = await TeacherInviteService.createInvite({ schoolId, email, invitedBy: user.id });
          results.push({ email, status: 'sent', id: inv.id });
        } catch (e) {
          console.debug('Invite failed', e);
          results.push({ email, status: 'error' });
        }
      }
      setSentInvites(results);
      Alert.alert('Invites processed', `Sent: ${results.filter(r => r.status === 'sent').length}, Failed: ${results.filter(r => r.status === 'error').length}`);
      setStep('templates');
      persist({ step: 'templates', sentInvites: results });
    } finally {
      setSendingInvites(false);
    }
  }, [schoolId, user?.id, emails, persist]);

  const toggleTemplate = useCallback((id: string) => {
    const next = selectedTemplates.includes(id)
      ? selectedTemplates.filter(t => t !== id)
      : [...selectedTemplates, id];
    setSelectedTemplates(next);
    persist({ selectedTemplates: next });
  }, [selectedTemplates, persist]);

  const goReview = useCallback(() => {
    setStep('review');
    persist({ step: 'review' });
  }, [persist]);

  const finish = useCallback(() => {
    // In future: call seeding RPC for selectedTemplates
    Alert.alert('Setup complete', 'Your school is ready. You can adjust settings anytime.');
    try { AsyncStorage?.removeItem('onboarding_principal_state'); } catch (e) { console.debug('clear state failed', e); }
    router.replace('/screens/principal-dashboard');
  }, []);

  const StepIndicator = () => {
    const steps = showSubscriptionStep 
      ? ['type_selection', 'details', 'invites', 'templates', 'subscription', 'review'] as Step[]
      : ['type_selection', 'details', 'invites', 'templates', 'review'] as Step[];
      
    return (
      <View style={styles.stepper}>
        {steps.map((s, idx) => {
          const stepNames: Record<Step, string> = {
            'type_selection': 'Type',
            'details': 'School',
            'invites': 'Teachers', 
            'templates': 'Setup',
            'subscription': 'Plan',
            'review': 'Review'
          };
          
          return (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, step === s ? styles.stepDotActive : styles.stepDotInactive]} />
              <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>
                {idx + 1}. {stepNames[s]}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Principal Onboarding' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Welcome, {adminName || profile?.first_name || 'Principal'}</Text>
        <Text style={styles.subheading}>
          {step === 'type_selection' 
            ? 'First, tell us what type of educational institution you run.'
            : `Let's set up your ${schoolType === 'preschool' ? 'preschool' : schoolType === 'k12_school' ? 'school' : 'educational institution'} in a few quick steps.`}
        </Text>

        <StepIndicator />

        {step === 'type_selection' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>What type of educational institution do you run?</Text>
            
            <View style={styles.typeContainer}>
              {[{id: 'preschool', name: 'Preschool', desc: 'Early childhood education (ages 0-6)'}, 
                {id: 'k12_school', name: 'K-12 School', desc: 'Primary & secondary education (grades K-12)'},
                {id: 'hybrid', name: 'Hybrid Institution', desc: 'Combined preschool and K-12 programs'}].map(type => (
                <TouchableOpacity 
                  key={type.id}
                  style={[styles.typeOption, schoolType === type.id && styles.typeOptionActive]}
                  onPress={() => { 
                    setSchoolType(type.id as any); 
                    persist({ schoolType: type.id });
                  }}
                >
                  <View style={[styles.typeRadio, schoolType === type.id && styles.typeRadioActive]} />
                  <View style={styles.typeContent}>
                    <Text style={[styles.typeName, schoolType === type.id && styles.typeNameActive]}>
                      {type.name}
                    </Text>
                    <Text style={styles.typeDesc}>{type.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => {
                setStep('details');
                persist({ step: 'details' });
              }}
            >
              <Text style={styles.buttonText}>Continue with {schoolType === 'preschool' ? 'Preschool' : schoolType === 'k12_school' ? 'K-12 School' : 'Hybrid Institution'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'details' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>School name</Text>
            <TextInput
              style={styles.input}
              value={schoolName}
              onChangeText={(v) => { setSchoolName(v); persist({ schoolName: v }); }}
              placeholder="e.g. Bright Beginnings School"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              value={adminName}
              onChangeText={(v) => { setAdminName(v); persist({ adminName: v }); }}
              placeholder="Principal full name"
              autoCapitalize="words"
            />

            <Text style={styles.label}>School phone (optional)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(v) => { setPhone(v); persist({ phone: v }); }}
              placeholder="+27-.."
              keyboardType="phone-pad"
            />

            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>Plan tier</Text>
              <View style={styles.pillRow}>
                {(['free', 'starter', 'premium', 'enterprise'] as const).map(t => (
                  <TouchableOpacity key={t} style={[styles.pill, planTier === t && styles.pillActive]} onPress={() => { setPlanTier(t); persist({ planTier: t }); }}>
                    <Text style={[styles.pillText, planTier === t && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity disabled={!canCreate || creating} style={[styles.button, (!canCreate || creating) && styles.buttonDisabled]} onPress={handleCreateSchool}>
              {creating ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Create school & Continue</Text>}
            </TouchableOpacity>
          </View>
        )}

        {step === 'invites' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Invite teachers (optional)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={emailInput}
                onChangeText={setEmailInput}
                placeholder="teacher@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.smallButton} onPress={addEmail}>
                <Text style={styles.smallButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {emails.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {emails.map((e) => (
                  <View key={e} style={styles.emailRow}>
                    <Text style={styles.emailText}>{e}</Text>
                    <TouchableOpacity onPress={() => removeEmail(e)}>
                      <Text style={[styles.emailText, { color: '#f87171' }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity disabled={sendingInvites} style={[styles.button, sendingInvites && styles.buttonDisabled]} onPress={sendInvites}>
              {sendingInvites ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>{emails.length ? 'Send invites & Continue' : 'Skip & Continue'}</Text>}
            </TouchableOpacity>

            {sentInvites.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {sentInvites.map((r, i) => (
                  <Text key={i} style={styles.hint}>• {r.email}: {r.status}</Text>
                ))}
              </View>
            )}

            <TouchableOpacity onPress={() => { setStep('details'); persist({ step: 'details' }); }} style={styles.linkBtn}><Text style={styles.linkText}>Back</Text></TouchableOpacity>
          </View>
        )}

        {step === 'templates' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Starter templates (optional)</Text>
            {availableTemplates.map(t => (
              <TouchableOpacity key={t.id} style={styles.templateRow} onPress={() => toggleTemplate(t.id)}>
                <View style={[styles.checkbox, selectedTemplates.includes(t.id) && styles.checkboxChecked]} />
                <Text style={styles.templateText}>{t.name}</Text>
              </TouchableOpacity>
            ))}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={() => {
                const nextStep = showSubscriptionStep ? 'subscription' : 'review';
                setStep(nextStep);
                persist({ step: nextStep });
              }}>
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => { 
                setSelectedTemplates([]);
                const nextStep = showSubscriptionStep ? 'subscription' : 'review';
                setStep(nextStep);
                persist({ step: nextStep, selectedTemplates: [] });
              }}>
                <Text style={styles.secondaryButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => { setStep('invites'); persist({ step: 'invites' }); }} style={styles.linkBtn}><Text style={styles.linkText}>Back</Text></TouchableOpacity>
          </View>
        )}

        {step === 'subscription' && showSubscriptionStep && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Subscription Plan (Optional)</Text>
            <Text style={styles.hint}>Choose a plan to unlock premium features and teacher seat management.</Text>
            
            <View style={styles.planContainer}>
              <TouchableOpacity 
                style={[styles.planOption, !planTier && styles.planOptionActive]}
                onPress={() => {
                  setPlanTier('free' as any);
                  persist({ planTier: 'free' });
                }}
              >
                <View style={[styles.typeRadio, planTier === 'free' && styles.typeRadioActive]} />
                <View style={styles.typeContent}>
                  <Text style={[styles.typeName, planTier === 'free' && styles.typeNameActive]}>Free Plan</Text>
                  <Text style={styles.typeDesc}>Basic features • Limited seats • Community support</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.planOption, planTier === 'starter' && styles.planOptionActive]}
                onPress={() => {
                  setPlanTier('starter');
                  persist({ planTier: 'starter' });
                }}
              >
                <View style={[styles.typeRadio, planTier === 'starter' && styles.typeRadioActive]} />
                <View style={styles.typeContent}>
                  <Text style={[styles.typeName, planTier === 'starter' && styles.typeNameActive]}>Starter Plan</Text>
                  <Text style={styles.typeDesc}>More features • 10 teachers • Email support</Text>
                </View>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => {
                setStep('review');
                persist({ step: 'review' });
              }}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setStep('templates'); persist({ step: 'templates' }); }} style={styles.linkBtn}><Text style={styles.linkText}>Back</Text></TouchableOpacity>
          </View>
        )}

        {step === 'review' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Review</Text>
            <Text style={styles.hint}>School: <Text style={{ color: '#fff' }}>{schoolName}</Text></Text>
            <Text style={styles.hint}>Plan: <Text style={{ color: '#fff' }}>{planTier}</Text></Text>
            <Text style={styles.hint}>Invites: <Text style={{ color: '#fff' }}>{emails.length}</Text></Text>
            <Text style={styles.hint}>Templates: <Text style={{ color: '#fff' }}>{selectedTemplates.length}</Text></Text>

            <TouchableOpacity style={[styles.button, { marginTop: 16 }]} onPress={finish}>
              <Text style={styles.buttonText}>Finish setup & Go to dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { 
              const prevStep = showSubscriptionStep ? 'subscription' : 'templates';
              setStep(prevStep); 
              persist({ step: prevStep }); 
            }} style={styles.linkBtn}><Text style={styles.linkText}>Back</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  subheading: { color: '#9CA3AF', marginBottom: 16 },
  label: { color: '#E5E7EB', marginTop: 12, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: '#111827', color: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#1f2937', padding: 12 },
  button: { marginTop: 18, backgroundColor: '#00f5ff', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#000', fontWeight: '800' },
  hint: { color: '#9CA3AF', marginTop: 6, fontSize: 13 },

  // Stepper
  stepper: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepDotActive: { backgroundColor: '#00f5ff' },
  stepDotInactive: { backgroundColor: '#1f2937' },
  stepLabel: { color: '#9CA3AF', fontSize: 12 },
  stepLabelActive: { color: '#E5E7EB', fontWeight: '700' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: '#1f2937', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#0b1220' },
  pillActive: { backgroundColor: '#0ea5b6' },
  pillText: { color: '#9CA3AF' },
  pillTextActive: { color: '#001011', fontWeight: '800' },

  smallButton: { backgroundColor: '#00f5ff', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: '#000', fontWeight: '800' },

  emailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  emailText: { color: '#E5E7EB' },

  templateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  templateText: { color: '#E5E7EB' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#1f2937', backgroundColor: '#0b1220' },
  checkboxChecked: { backgroundColor: '#00f5ff', borderColor: '#00f5ff' },

  secondaryButton: { marginTop: 18, backgroundColor: '#0b1220', borderWidth: 1, borderColor: '#1f2937', padding: 12, borderRadius: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#E5E7EB', fontWeight: '700' },

  linkBtn: { marginTop: 10, alignSelf: 'flex-start' },
  linkText: { color: '#00f5ff', textDecorationLine: 'underline' },
  
  // Type selection styles
  typeContainer: { gap: 12, marginTop: 12, marginBottom: 16 },
  typeOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#111827', 
    borderWidth: 1, 
    borderColor: '#1f2937', 
    borderRadius: 10, 
    padding: 12, 
    gap: 12 
  },
  typeOptionActive: { borderColor: '#00f5ff', backgroundColor: '#0b1f26' },
  typeRadio: { 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    borderWidth: 2, 
    borderColor: '#1f2937' 
  },
  typeRadioActive: { backgroundColor: '#00f5ff', borderColor: '#00f5ff' },
  typeContent: { flex: 1 },
  typeName: { color: '#E5E7EB', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  typeNameActive: { color: '#00f5ff' },
  typeDesc: { color: '#9CA3AF', fontSize: 13, lineHeight: 18 },
  
  // Plan selection styles
  planContainer: { gap: 12, marginTop: 12, marginBottom: 16 },
  planOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#111827', 
    borderWidth: 1, 
    borderColor: '#1f2937', 
    borderRadius: 10, 
    padding: 12, 
    gap: 12 
  },
  // Alias to match existing usage in component
  planOptionActive: { borderColor: '#00f5ff', backgroundColor: '#0b1f26' },
});
