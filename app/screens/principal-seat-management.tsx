import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { assertSupabase } from '@/lib/supabase';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { getEffectiveLimits } from '@/lib/ai/limits';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { navigateBack } from '@/lib/navigation';

export default function PrincipalSeatManagementScreen() {
  const { theme, isDark } = useTheme();
  // Use theme tokens and explicit isDark flag for styling
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const params = useLocalSearchParams<{ school?: string }>();
  const routeSchoolId = (params?.school ? String(params.school) : null);
  const { seats, assignSeat, revokeSeat, refresh } = useSubscription();
  const [effectiveSchoolId, setEffectiveSchoolId] = useState<string | null>(routeSchoolId);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [schoolLabel, setSchoolLabel] = useState<string | null>(null);
  const [teacherEmail, setTeacherEmail] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<{ id: string; email: string; hasSeat: boolean }[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [pendingTeacherId, setPendingTeacherId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Resolve the school id if not provided in the route
  useEffect(() => {
    (async () => {
      if (effectiveSchoolId) return; // already set from route
      try {
        // Try user metadata first
        const { data: userRes } = await assertSupabase().auth.getUser();
        const metaSchool = (userRes?.user?.user_metadata as any)?.preschool_id as string | undefined;
        if (metaSchool) { setEffectiveSchoolId(metaSchool); return; }
        // Fallback to profiles table
        if (userRes?.user?.id) {
          const { data: prof } = await assertSupabase()
            .from('profiles')
            .select('preschool_id')
            .eq('id', userRes.user.id)
            .maybeSingle();
          if (prof?.preschool_id) { setEffectiveSchoolId(prof.preschool_id); }
        }
      } catch (e) {
        console.debug('Failed to resolve school id:', e);
      }
    })();
  }, [effectiveSchoolId]);

  const loadSubscription = useCallback(async () => {
    if (!effectiveSchoolId) return;
    try {
      setLoading(true); setError(null);
      const { data, error } = await assertSupabase().from('subscriptions').select('id').eq('owner_type','school').eq('school_id', effectiveSchoolId).eq('status','active').maybeSingle();
      if (!error && data) setSubscriptionId((data as any).id);
    } catch (e: any) { setError(e?.message || 'Load failed'); }
    finally { setLoading(false); setSubscriptionLoaded(true); }
  }, [effectiveSchoolId]);

  useEffect(() => { loadSubscription(); }, [loadSubscription]);

  // Load school label (tenant_slug -> name -> id)
  useEffect(() => {
    (async () => {
      if (!effectiveSchoolId) return;
      try {
        const { data, error } = await assertSupabase()
          .from('preschools')
          .select('tenant_slug, name')
          .eq('id', effectiveSchoolId)
          .maybeSingle();
        if (!error) {
          setSchoolLabel((data as any)?.tenant_slug ?? (data as any)?.name ?? effectiveSchoolId);
        } else {
          setSchoolLabel(effectiveSchoolId);
        }
      } catch {
        setSchoolLabel(effectiveSchoolId);
      }
    })();
  }, [effectiveSchoolId]);

  const loadTeachers = useCallback(async () => {
    if (!effectiveSchoolId) return;
    try {
      // Fetch teacher identities from profiles first
      const { data: profs, error: profErr } = await assertSupabase()
        .from('profiles')
        .select('id,email,role,preschool_id')
        .eq('preschool_id', effectiveSchoolId)
        .eq('role', 'teacher');

      // Use profiles.id (auth user ID) for RPC calls - RPC function expects this
      let teacherList: { id: string; email: string; hasSeat: boolean }[] = (profs || []).map((p: any) => ({ id: p.id, email: p.email, hasSeat: false }));

      // If none found (schema variance), fall back to users table by auth_user_id
      if ((!teacherList || teacherList.length === 0)) {
        try {
          const { data: users } = await assertSupabase()
            .from('users')
            .select('auth_user_id, email, role, preschool_id')
            .eq('preschool_id', effectiveSchoolId)
            .eq('role', 'teacher');
          teacherList = (users || []).map((u: any) => ({ id: u.auth_user_id || u.id, email: u.email, hasSeat: false }));
        } catch (fallbackErr) {
          console.debug('Fallback users query failed:', fallbackErr);
        }
      }

      // Use the fixed RPC function to get seat assignments
      // This function now properly returns auth_user_id as user_id for comparison
      let seatSet = new Set<string>();
      if (subscriptionId) {
        try {
          const { data: seatsData, error: seatsError } = await assertSupabase()
            .rpc('rpc_list_teacher_seats');
            
          if (!seatsError && seatsData) {
            // The RPC now returns auth_user_id as user_id, and only active seats (revoked_at IS NULL)
            seatSet = new Set(
              seatsData
                .filter((seat: any) => seat.revoked_at === null) // Only active seats
                .map((seat: any) => seat.user_id)
                .filter(Boolean)
            );
          } else if (seatsError) {
            console.warn('Failed to load seats via RPC:', seatsError);
          }
        } catch (rpcErr) {
          console.warn('RPC call failed:', rpcErr);
        }
      }

      setTeachers(teacherList.map(t => ({ ...t, hasSeat: seatSet.has(t.id) })));
    } catch (e) {
      console.debug('Failed to load teachers for seat management', e);
    }
  }, [effectiveSchoolId, subscriptionId]);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await loadSubscription(); await loadTeachers(); setRefreshing(false); }, [loadSubscription, loadTeachers]);

  const findTeacherIdByEmail = async (email: string): Promise<string | null> => {
    try {
      // First try profiles table (RPC function expects profiles.id which is auth user ID)
      const { data } = await assertSupabase().from('profiles').select('id,role,preschool_id').eq('email', email).maybeSingle();
      if (data && (data as any).id) {
        return (data as any).id as string; // This is the auth user ID
      }
      
      // Fallback to users table and get auth_user_id
      const { data: u } = await assertSupabase().from('users').select('auth_user_id,email').eq('email', email).maybeSingle();
      if (u && (u as any).auth_user_id) return (u as any).auth_user_id as string;
      
      return null;
    } catch { return null; }
  };

  const onAssign = async () => {
    if (!subscriptionId || !teacherEmail) { setError('Missing subscription or email'); return; }
    try {
      setAssigning(true); setError(null); setSuccess(null);
      const userId = await findTeacherIdByEmail(teacherEmail);
      if (!userId) { setError('Teacher not found by email'); return; }
      await assignSeat(subscriptionId, userId);
      // Optimistically update UI
      setTeachers(prev => prev.map(t => t.id === userId ? { ...t, hasSeat: true } : t));
      setSuccess('Seat assigned successfully');
      setTeacherEmail('');
      // Also refresh from server to stay in sync
      await loadTeachers();
      try { await refresh(); } catch { /* Intentional: non-fatal */ }
    } catch (error: any) {
      setError(error?.message || 'Failed to assign seat');
    } finally {
      setAssigning(false);
    }
  };

  const onRevoke = async () => {
    if (!subscriptionId || !teacherEmail) { setError('Missing subscription or email'); return; }
    try {
      setRevoking(true); setError(null); setSuccess(null);
      const userId = await findTeacherIdByEmail(teacherEmail);
      if (!userId) { setError('Teacher not found by email'); return; }
      await revokeSeat(subscriptionId, userId);
      // Optimistically update UI
      setTeachers(prev => prev.map(t => t.id === userId ? { ...t, hasSeat: false } : t));
      setSuccess('Seat revoked successfully');
      setTeacherEmail('');
      await loadTeachers();
    } catch (error: any) {
      setError(error?.message || 'Failed to revoke seat');
    } finally {
      setRevoking(false);
    }
  };

  const [canManageAI, setCanManageAI] = useState(false);
  useEffect(() => { (async () => { try { const limits = await getEffectiveLimits(); setCanManageAI(!!limits.canOrgAllocate); } catch { /* noop */ } })(); }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Seat Management', headerStyle: { backgroundColor: theme.headerBackground }, headerTitleStyle: { color: theme.headerText }, headerTintColor: theme.headerTint }} />
      <ThemedStatusBar />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}>
        <View style={styles.backRow}>
          <TouchableOpacity style={styles.backLink} onPress={() => navigateBack('/screens/principal-dashboard')}>
            <Ionicons name="chevron-back" size={20} color={styles.accentColor} />
            <Text style={styles.backText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Manage Seats</Text>
        <Text style={styles.subtitle}>School: {schoolLabel || '—'}</Text>
        <Text style={styles.subtitle}>Seats: {seats ? `${seats.used}/${seats.total}` : '—'}</Text>

        {/* Assign all current teachers button */}
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, (!subscriptionId || assigning) && styles.btnDisabled]}
          disabled={!subscriptionId || assigning}
          onPress={async () => {
            if (!subscriptionId) { setError('No active subscription for this school'); return; }
            try {
              setAssigning(true); setError(null); setSuccess(null);
              // Call bulk assignment RPC
              const { data, error } = await assertSupabase().rpc('assign_all_teachers_to_subscription', {
                p_subscription_id: subscriptionId,
                p_school_id: effectiveSchoolId,
              });
              if (error) throw error;
              const assigned = Array.isArray(data) ? (data as any[]).filter(r => r.assigned).length : 0;
              const skipped = Array.isArray(data) ? (data as any[]).filter(r => !r.assigned).length : 0;
              setSuccess(`Assigned ${assigned} teacher(s). ${skipped > 0 ? `${skipped} skipped.` : ''}`);
              await loadTeachers();
            } catch (e: any) {
              setError(e?.message || 'Bulk assignment failed');
            } finally {
              setAssigning(false);
            }
          }}
        >
          {assigning ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnPrimaryText}>Assign all current teachers</Text>
          )}
        </TouchableOpacity>

        {loading ? <Text style={styles.info}>Loading subscription…</Text> : null}
        {subscriptionLoaded && !subscriptionId ? (
          <View style={styles.bannerCard}>
            <Text style={styles.bannerTitle}>No Active Subscription</Text>
            <Text style={styles.bannerText}>No active subscription found for this school.</Text>
            <Text style={styles.bannerSubtext}>You can start a free 14-day trial with limited seats. You can assign or revoke seats anytime.</Text>
            <View style={styles.contactButtonsRow}>
              <TouchableOpacity
                style={[styles.contactBtn, styles.contactBtnEmail]}
                onPress={async () => {
                  try {
                  // Start free trial via secure RPC that principals are allowed to run
                  // This ensures a school-owned "free" subscription exists (status active)
                  const { data, error } = await assertSupabase().rpc('ensure_school_free_subscription', {
                    p_school_id: effectiveSchoolId,
                    p_seats: 3,
                  });
                  if (error) throw error;
                  // Optimistically set subscription id returned by RPC (enables bulk-assign immediately)
                  if (data) {
                    try { setSubscriptionId(String(data)); } catch { /* Intentional: non-fatal */ }
                  }
                  setSuccess('Free trial started. You can now assign seats.');
                  await loadSubscription();
                  await loadTeachers();
                  } catch (e: any) {
                    setError(e?.message || 'Failed to start trial');
                  }
                }}
              >
                <Ionicons name="flash" size={16} color="#000" />
                <Text style={styles.contactBtnText}>Start Free Trial (14 days)</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Teacher email</Text>
          <TextInput
            placeholder="teacher@example.com"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
            value={teacherEmail}
            onChangeText={setTeacherEmail}
            style={styles.input}
          />
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, (!subscriptionId || !teacherEmail || assigning) && styles.btnDisabled]}
            onPress={onAssign}
            disabled={!subscriptionId || !teacherEmail || assigning}
          >
            {assigning ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.btnPrimaryText}>Assign seat</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger, (!subscriptionId || !teacherEmail || revoking) && styles.btnDisabled]}
            onPress={onRevoke}
            disabled={!subscriptionId || !teacherEmail || revoking}
          >
            {revoking ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.btnDangerText}>Revoke seat</Text>
            )}
          </TouchableOpacity>
        </View>

        {canManageAI && (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => router.push('/screens/admin-ai-allocation')}>
            <Text style={styles.btnPrimaryText}>Manage AI Allocation</Text>
          </TouchableOpacity>
        )}

        {/* Teacher Management Section */}
        <View style={styles.teachersSection}>
          <View style={styles.teachersSectionHeader}>
            <Text style={styles.title}>All Teachers ({teachers.length})</Text>
            <View style={styles.seatsSummary}>
              <Text style={styles.seatsAssigned}>
                {teachers.filter(t => t.hasSeat).length} with seats
              </Text>
              <Text style={styles.seatsUnassigned}>
                {teachers.filter(t => !t.hasSeat).length} without seats
              </Text>
            </View>
          </View>

          {teachers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={styles.subtitle.color} />
              <Text style={styles.emptyStateTitle}>No Teachers Found</Text>
              <Text style={styles.emptyStateSubtitle}>Add teachers to your school to manage seat assignments</Text>
            </View>
          ) : (
            <View style={styles.teachersList}>
              {/* Teachers with seats */}
              {teachers.filter(t => t.hasSeat).length > 0 && (
                <>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryIndicator}>
                      <View style={[styles.statusDot, { backgroundColor: styles.successColor }]} />
                      <Text style={styles.categoryTitle}>Teachers with Seats ({teachers.filter(t => t.hasSeat).length})</Text>
                    </View>
                  </View>
                  {teachers.filter(t => t.hasSeat).map((t) => (
                    <View key={t.id} style={[styles.teacherRow, styles.teacherRowWithSeat]}>
                      <View style={styles.teacherInfo}>
                        <Ionicons name="checkmark-circle" size={20} color={styles.successColor} />
                        <Text style={styles.teacherEmail}>{t.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.smallBtn, styles.btnDanger, (pendingTeacherId === t.id || !subscriptionId) && styles.btnDisabled]}
                        disabled={pendingTeacherId === t.id || !subscriptionId}
                        onPress={async () => {
                          if (!subscriptionId) { 
                            setError('No active subscription for this school'); 
                            return; 
                          }
                          
                          console.log('[Seat Revoke] Starting revoke for:', {
                            teacherId: t.id,
                            teacherEmail: t.email,
                            subscriptionId
                          });
                          
                          try {
                            setPendingTeacherId(t.id); 
                            setError(null); 
                            setSuccess(null);
                            
                            // Call the revoke RPC function
                            await revokeSeat(subscriptionId, t.id);
                            
                            console.log('[Seat Revoke] RPC call successful');
                            
                            // Optimistically update UI before reload
                            setTeachers(prev => prev.map(x => 
                              x.id === t.id ? { ...x, hasSeat: false } : x
                            ));
                            
                            setSuccess(`Seat revoked for ${t.email}`);
                            
                            // Reload data from server to ensure consistency
                            console.log('[Seat Revoke] Reloading teacher data...');
                            await loadTeachers();
                            
                            // Try to refresh subscription context
                            try { 
                              await refresh(); 
                            } catch (refreshErr) {
                              console.warn('[Seat Revoke] Subscription refresh failed:', refreshErr);
                            }
                          } catch (error: any) {
                            console.error('[Seat Revoke] Failed:', error);
                            setError(error?.message || `Failed to revoke seat for ${t.email}`);
                          } finally {
                            setPendingTeacherId(null);
                          }
                        }}
                      >
                        {pendingTeacherId === t.id ? (
                          <ActivityIndicator color="#000" size="small" />
                        ) : (
                          <Text style={styles.btnDangerText}>Revoke</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* Teachers without seats */}
              {teachers.filter(t => !t.hasSeat).length > 0 && (
                <>
                  <View style={[styles.categoryHeader, { marginTop: teachers.filter(t => t.hasSeat).length > 0 ? 20 : 0 }]}>
                    <View style={styles.categoryIndicator}>
                      <View style={[styles.statusDot, { backgroundColor: styles.warningColor }]} />
                      <Text style={styles.categoryTitle}>Teachers without Seats ({teachers.filter(t => !t.hasSeat).length})</Text>
                    </View>
                  </View>
                  {teachers.filter(t => !t.hasSeat).map((t) => (
                    <View key={t.id} style={[styles.teacherRow, styles.teacherRowWithoutSeat]}>
                      <View style={styles.teacherInfo}>
                        <Ionicons name="alert-circle-outline" size={20} color={styles.warningColor} />
                        <Text style={styles.teacherEmail}>{t.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.smallBtn, styles.btnPrimary, (pendingTeacherId === t.id || !subscriptionId) && styles.btnDisabled]}
                        disabled={pendingTeacherId === t.id || !subscriptionId}
                        onPress={async () => {
                          if (!subscriptionId) { setError('No active subscription for this school'); return; }
                          try {
                            setPendingTeacherId(t.id); setError(null); setSuccess(null);
                            await assignSeat(subscriptionId, t.id);
                            // Optimistically update before reload
                            setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, hasSeat: true } : x));
                            try { const { notifySeatRequestApproved } = await import('@/lib/notify'); await notifySeatRequestApproved(t.id); } catch { /* Intentional: non-fatal */ }
                            setSuccess(`Seat assigned to ${t.email}`);
                            await loadTeachers();
                            try { await refresh(); } catch { /* Intentional: non-fatal */ }
                          } catch (error: any) {
                            setError(error?.message || `Failed to assign seat to ${t.email}`);
                          } finally {
                            setPendingTeacherId(null);
                          }
                        }}
                      >
                        {pendingTeacherId === t.id ? (
                          <ActivityIndicator color="#000" size="small" />
                        ) : (
                          <Text style={styles.btnPrimaryText}>Assign Seat</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      </SafeAreaView>
    </>
  );
}

const createStyles = (theme: any, isDark: boolean) => {
  // Theme-respecting tokens
  const darkBg = theme.background;
  const cardBg = theme.surface;
  const borderColor = theme.border;
  const textPrimary = theme.text;
  const textSecondary = theme.textSecondary;
  const accentColor = theme.primary;
  const successColor = theme.success;
  const warningColor = theme.warning;
  const errorColor = theme.error;
  const dangerColor = theme.error;

  // Create styles object with theme colors accessible separately
  const styles = StyleSheet.create({
    container: { padding: 16, gap: 12, backgroundColor: darkBg },
    title: { fontSize: 22, fontWeight: '800', color: textPrimary },
    subtitle: { fontSize: 14, color: textSecondary },
    info: { color: textSecondary },
    error: { color: errorColor },
    success: { color: successColor },
    banner: { color: warningColor },
    bannerCard: { backgroundColor: cardBg, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: warningColor },
    bannerTitle: { color: warningColor, fontWeight: '800', fontSize: 16, marginBottom: 8 },
    bannerText: { color: textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 8 },
    bannerSubtext: { color: textSecondary, fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
    contactButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
    contactBtnEmail: { backgroundColor: accentColor },
    contactBtnText: { color: theme.onPrimary, fontWeight: '800' },
    inputGroup: { gap: 6 },
    label: { color: textPrimary },
    input: { backgroundColor: cardBg, color: textPrimary, borderRadius: 10, borderWidth: 1, borderColor: borderColor, padding: 12 },
    row: { flexDirection: 'row', gap: 12 },
    btn: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12 },
    btnPrimary: { backgroundColor: accentColor },
    btnPrimaryText: { color: theme.onPrimary, fontWeight: '800' },
    btnDanger: { backgroundColor: dangerColor },
    btnDangerText: { color: theme.onError, fontWeight: '800' },
  
  // New teacher management section styles
  teachersSection: {
    marginTop: 16,
  },
  teachersSectionHeader: {
    marginBottom: 16,
  },
  seatsSummary: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
    seatsAssigned: {
      color: successColor,
      fontSize: 14,
      fontWeight: '600',
    },
    seatsUnassigned: {
      color: warningColor,
      fontSize: 14,
      fontWeight: '600',
    },
  
  // Empty state
    emptyState: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: cardBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: borderColor,
    },
    emptyStateTitle: {
      color: textPrimary,
      fontSize: 18,
      fontWeight: '600',
      marginTop: 16,
    },
    emptyStateSubtitle: {
      color: textSecondary,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
  
  // Teacher list styles
  teachersList: {
    gap: 8,
  },
  categoryHeader: {
    marginBottom: 12,
  },
  categoryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
    categoryTitle: {
      color: textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    
    // Teacher row styles
    teacherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: cardBg,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      marginBottom: 8,
    },
    teacherRowWithSeat: {
      borderColor: successColor,
      backgroundColor: cardBg,
    },
    teacherRowWithoutSeat: {
      borderColor: warningColor,
      backgroundColor: cardBg,
    },
    teacherInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    teacherEmail: {
      color: textPrimary,
      fontSize: 14,
      fontWeight: '500',
    },
    
    smallBtn: { 
      paddingVertical: 8, 
      paddingHorizontal: 12, 
      borderRadius: 10,
      minWidth: 80,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.5 },
    backRow: { marginBottom: 8 },
    backLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    backText: { color: accentColor, fontWeight: '800' },
  });

  // Return styles object with color properties attached
  return Object.assign(styles, {
    accentColor,
    successColor,
    warningColor,
    errorColor,
    dangerColor,
  });
};
