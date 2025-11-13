import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

const STATUSES = ['new','contacted','qualified','proposal','closed-won','closed-lost'] as const;

interface SalesLeadsProps {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const SalesLeads: React.FC<SalesLeadsProps> = ({ loading, setLoading }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [convertOpenFor, setConvertOpenFor] = useState<string | null>(null);
  const [stats, setStats] = useState<{ schools: number; activeSubs: number; seats: number }>({ schools: 0, activeSubs: 0, seats: 0 });
  const [convertForm, setConvertForm] = useState<{ org: string; country: string; principalEmail: string; seats: string }>({ org: '', country: '', principalEmail: '', seats: '10' });
  const { user } = useAuth();
  const { theme } = useTheme();

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      let q = assertSupabase().from('enterprise_leads').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') {
        q = q.eq('status', filter);
      }
      const { data, error } = await q;
      if (!error) setLeads(data || []);
    } catch (e) {
      console.error('Failed to fetch leads:', e);
    }
    finally { setLoading(false); }
  }, [filter, setLoading]);

  useEffect(() => { fetchLeads(); fetchStats(); }, [fetchLeads]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchLeads(); setRefreshing(false); }, [fetchLeads]);

  const fetchStats = async () => {
    try {
      const { data: schools } = await assertSupabase().from('preschools').select('id');
      const { data: subs } = await assertSupabase().from('subscriptions').select('id,seats_total,status').eq('owner_type','school');
      const active = (subs || []).filter(s => s.status === 'active');
      const seats = active.reduce((sum, s: any) => sum + (s.seats_total || 0), 0);
      setStats({ schools: (schools || []).length, activeSubs: active.length, seats });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const updateStatus = async (id: string, status: typeof STATUSES[number]) => {
    try {
      const { error } = await assertSupabase().from('enterprise_leads').update({ status }).eq('id', id);
      if (!error) {
        track('edudash.superadmin.lead_status_changed', { 
          lead_id: id, 
          status,
          user_id: user?.id,
          platform: Platform.OS,
        });
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
      }
    } catch (e) {
      console.error('Failed to update lead status:', e);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SkeletonLoader height={100} style={{ margin: 16 }} />
        <SkeletonLoader height={200} style={{ margin: 16 }} />
        <SkeletonLoader height={150} style={{ margin: 16 }} />
      </View>
    );
  }

  return (
    <ScrollView 
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]} 
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh} 
          tintColor={theme.primary}
          colors={[theme.primary]} 
        />
      }
    >
      {/* Summary Stats */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <View style={[styles.statPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statPillText, { color: theme.textSecondary }]}>Schools: {stats.schools}</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statPillText, { color: theme.textSecondary }]}>Active Subs: {stats.activeSubs}</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statPillText, { color: theme.textSecondary }]}>Seats: {stats.seats}</Text>
        </View>
      </View>

      <View style={styles.filtersRow}>
        {['all', ...STATUSES].map((s) => (
          <TouchableOpacity 
            key={s} 
            onPress={() => setFilter(String(s))} 
            style={[
              styles.filterChip, 
              { borderColor: theme.border },
              filter === s && { backgroundColor: theme.primary + '22', borderColor: theme.primary }
            ]}
          >
            <Text style={[
              styles.filterChipText, 
              { color: theme.textSecondary },
              filter === s && { color: theme.primary, fontWeight: '700' }
            ]}>
              {String(s)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <Text style={[styles.loading, { color: theme.textSecondary }]}>Loading…</Text> : null}

      {leads.map((lead) => (
        <View key={lead.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{lead.organization_name || 'Unknown org'}</Text>
          <Text style={[styles.cardRow, { color: theme.textSecondary }]}>Contact: {lead.contact_name || '—'} • {lead.contact_email}</Text>
          <Text style={[styles.cardRow, { color: theme.textSecondary }]}>Phone: {lead.phone || '—'} • Country: {lead.country || '—'}</Text>
          <Text style={[styles.cardRow, { color: theme.textSecondary }]}>Role: {lead.role || '—'} • Size: {lead.school_size || '—'}</Text>
          <Text style={[styles.cardRow, { color: theme.textSecondary }]}>Plan: {lead.plan_interest || 'enterprise'}</Text>
          <Text style={[styles.cardRow, { color: theme.textSecondary }]}>Notes: {lead.notes || '—'}</Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => {
              setConvertOpenFor(lead.id);
              setConvertForm({ org: lead.organization_name || '', country: lead.country || '', principalEmail: lead.contact_email || '', seats: '10' });
            }} style={[styles.primaryBtn, { backgroundColor: theme.primary }] }>
              <Text style={[styles.primaryBtnText, { color: theme.onPrimary }]}>Convert to School</Text>
            </TouchableOpacity>
          </View>

          {convertOpenFor === lead.id ? (
            <View style={[styles.convertBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text style={[styles.convertTitle, { color: theme.text }]}>Provision Enterprise</Text>
              <TextInput 
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                placeholderTextColor={theme.textSecondary} 
                placeholder="School / Org name" 
                value={convertForm.org} 
                onChangeText={(v) => setConvertForm({ ...convertForm, org: v })} 
              />
              <TextInput 
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                placeholderTextColor={theme.textSecondary} 
                placeholder="Country" 
                value={convertForm.country} 
                onChangeText={(v) => setConvertForm({ ...convertForm, country: v })} 
              />
              <TextInput 
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                placeholderTextColor={theme.textSecondary} 
                placeholder="Principal email (optional)" 
                autoCapitalize="none" 
                keyboardType="email-address" 
                value={convertForm.principalEmail} 
                onChangeText={(v) => setConvertForm({ ...convertForm, principalEmail: v })} 
              />
              <TextInput 
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} 
                placeholderTextColor={theme.textSecondary} 
                placeholder="Seats (e.g., 10)" 
                keyboardType="numeric" 
                value={convertForm.seats} 
                onChangeText={(v) => setConvertForm({ ...convertForm, seats: v })} 
              />
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.btn, styles.btnSecondary, { backgroundColor: theme.surfaceVariant }]} 
                  onPress={() => setConvertOpenFor(null)}
                >
                  <Text style={[styles.btnSecondaryText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.primary }]} 
                  onPress={async () => {
                    try {
                      const seatsNum = Math.max(1, parseInt(convertForm.seats || '1', 10) || 1);
                      // Create school
                      const { data: schoolIns, error: schoolErr } = await assertSupabase()
                        .from('preschools')
                        .insert({ name: convertForm.org || lead.organization_name, country: convertForm.country || lead.country })
                        .select('id').maybeSingle();
                      if (schoolErr) throw schoolErr;
                      const schoolId = (schoolIns as any)?.id;
                      if (!schoolId) throw new Error('No school id');
                      // Create enterprise subscription
                      const { error: subErr } = await assertSupabase()
                        .from('subscriptions')
                        .insert({ 
                          owner_type: 'school', 
                          school_id: schoolId, 
                          plan: 'enterprise', 
                          seats_total: seatsNum, 
                          seats_used: 0 
                        });
                      if (subErr) throw subErr;
                      // Optionally link principal
                      if (convertForm.principalEmail) {
                        const { data: prof } = await assertSupabase()
                          .from('profiles')
                          .select('id,role')
                          .eq('email', convertForm.principalEmail)
                          .maybeSingle();
                        if (prof && (prof as any).id) {
                          await assertSupabase()
                            .from('profiles')
                            .update({ 
                              preschool_id: schoolId, 
                              role: (prof as any).role === 'superadmin' ? (prof as any).role : 'principal' 
                            })
                            .eq('id', (prof as any).id);
                        }
                      }
                      // Mark lead as closed-won
                      await assertSupabase().from('enterprise_leads').update({ status: 'closed-won' }).eq('id', lead.id);
                      track('edudash.superadmin.lead_converted_to_school', { 
                        lead_id: lead.id, 
                        school_id: schoolId, 
                        seats: seatsNum,
                        user_id: user?.id,
                        platform: Platform.OS,
                      });
                      Alert.alert('Success', 'School and subscription provisioned.');
                      setConvertOpenFor(null);
                      fetchLeads();
                    } catch (e: any) {
                      Alert.alert('Failed', e?.message || 'Could not convert');
                    }
                  }}
                >
                  <Text style={[styles.btnPrimaryText, { color: theme.onPrimary }]}>Provision</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View style={styles.statusRow}>
            {STATUSES.map((s) => (
              <TouchableOpacity 
                key={s} 
                onPress={() => updateStatus(lead.id, s)} 
                style={[
                  styles.statusBtn, 
                  { borderColor: theme.border },
                  lead.status === s && { backgroundColor: theme.primary + '22', borderColor: theme.primary }
                ]}
              >
                <Text style={[
                  styles.statusBtnText, 
                  { color: theme.textSecondary },
                  lead.status === s && { color: theme.primary, fontWeight: '700' }
                ]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {(!loading && leads.length === 0) ? 
        <Text style={[styles.empty, { color: theme.textSecondary }]}>No leads found.</Text> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9999 },
  filterChipText: { fontSize: 12 },
  loading: { textAlign: 'center' },
  card: { borderRadius: 12, padding: 12, borderWidth: 1 },
  cardTitle: { fontWeight: '800', marginBottom: 4 },
  cardRow: { fontSize: 12, marginBottom: 2 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  primaryBtnText: { fontWeight: '800' },
  convertBox: { marginTop: 8, borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  convertTitle: { fontWeight: '800' },
  input: { borderRadius: 10, borderWidth: 1, padding: 10 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10 },
  btnPrimary: {},
  btnPrimaryText: { fontWeight: '800' },
  btnSecondary: {},
  btnSecondaryText: { fontWeight: '700' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  statusBtn: { borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  statusBtnText: { fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 20 },
  statPill: { borderWidth: 1, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 6 },
  statPillText: { fontWeight: '700' },
});

export default SalesLeads;