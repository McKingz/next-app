import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function OrgAdminDashboard() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('org_admin.title', { defaultValue: 'Organization Admin' }) }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('org_admin.overview', { defaultValue: 'Organization Overview' })}</Text>
        <View style={styles.kpiRow}>
          <KPI title={t('org_admin.kpi.active_learners', { defaultValue: 'Active Learners' })} value="--" />
          <KPI title={t('org_admin.kpi.completion_rate', { defaultValue: 'Completion Rate' })} value="--%" />
          <KPI title={t('org_admin.kpi.cert_pipeline', { defaultValue: 'Cert Pipeline' })} value="--" />
          <KPI title={t('org_admin.kpi.mrr', { defaultValue: 'MRR' })} value="$--" />
        </View>

        <Text style={styles.sectionTitle}>{t('org_admin.quick_actions', { defaultValue: 'Quick Actions' })}</Text>
        <View style={styles.row}>
          <ActionBtn label={t('org_admin.actions.programs', { defaultValue: 'Programs' })} />
          <ActionBtn label={t('org_admin.actions.cohorts', { defaultValue: 'Cohorts' })} />
          <ActionBtn label={t('org_admin.actions.instructors', { defaultValue: 'Instructors' })} />
          <ActionBtn label={t('org_admin.actions.enrollments', { defaultValue: 'Enrollments' })} />
        </View>
        <View style={styles.row}>
          <ActionBtn label={t('org_admin.actions.certifications', { defaultValue: 'Certifications' })} />
          <ActionBtn label={t('org_admin.actions.placements', { defaultValue: 'Placements' })} />
          <ActionBtn label={t('org_admin.actions.invoices', { defaultValue: 'Invoices' })} />
          <ActionBtn label={t('org_admin.actions.settings', { defaultValue: 'Settings' })} />
        </View>
      </ScrollView>
    </View>
  );
}

function KPI({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
    </View>
  );
}

function ActionBtn({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  content: { padding: 16, gap: 12 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '800' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: { flexBasis: '48%', backgroundColor: '#111827', padding: 12, borderRadius: 12, borderColor: '#1f2937', borderWidth: 1 },
  kpiValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  kpiTitle: { color: '#9CA3AF', marginTop: 4 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexBasis: '48%', backgroundColor: '#111827', padding: 14, borderRadius: 12, borderColor: '#1f2937', borderWidth: 1, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '700' },
});
