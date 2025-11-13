import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTeacherDashboard } from '@/hooks/useDashboardData'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Ionicons } from '@expo/vector-icons'

export default function TeacherReportsScreen() {
  const { profile, permissions } = useAuth()
  const { theme } = useTheme()
  
  // Check if user has proper access to analytics
  const hasActiveSeat = profile?.seat_status === 'active'
  const canViewAnalytics = hasActiveSeat && permissions.can('view_class_analytics')
  
  console.log('Teacher Reports Access Check:', {
    profile: profile ? { 
      id: profile.id, 
      role: profile.role, 
      seat_status: profile.seat_status 
    } : null,
    hasActiveSeat,
    canViewAnalytics,
    hasCapability: permissions.can('view_class_analytics')
  })
  // Use theme instead of hardcoded colors
  const palette = {
    background: theme.background,
    text: theme.text,
    textSecondary: theme.textSecondary,
    outline: theme.border,
    surface: theme.cardBackground,
    primary: theme.primary
  }
  const { data } = useTeacherDashboard()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScreenHeader 
        title="Teacher Reports" 
        subtitle="Analytics and class overview" 
      />
      <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{data?.schoolName || '—'}</Text>

          {!canViewAnalytics && (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
              <Text style={styles.cardTitle}>Access Restricted</Text>
              <Text style={{ color: palette.textSecondary }}>
                {!hasActiveSeat 
                  ? 'Your teacher seat is not active. Please contact your administrator.' 
                  : 'Your account does not have analytics permissions. Please contact your administrator.'}
              </Text>
              <Text style={{ color: palette.textSecondary, fontSize: 12, marginTop: 8 }}>
                Debug: Seat Status: {profile?.seat_status || 'unknown'} | Role: {profile?.role || 'unknown'}
              </Text>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Overview</Text>
            <View style={styles.metricsRow}>
              <Metric title="Students" value={String(data?.totalStudents ?? 0)} icon="people-outline" color="#4F46E5" />
              <Metric title="Classes" value={String(data?.totalClasses ?? 0)} icon="library-outline" color="#059669" />
              <Metric title="Pending grading" value={String(data?.pendingGrading ?? 0)} icon="document-text-outline" color="#DC2626" />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Recent assignments</Text>
            {(data?.recentAssignments || []).length === 0 ? (
              <Text style={[styles.muted, { color: palette.textSecondary }]}>No recent assignments.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {data?.recentAssignments?.map(a => (
                  <View key={a.id} style={styles.assignmentRow}>
                    <View>
                      <Text style={[styles.assignmentTitle, { color: palette.text }]}>{a.title}</Text>
                      <Text style={[styles.assignmentMeta, { color: palette.textSecondary }]}>Due: {a.dueDate} • {a.submitted}/{a.total} submitted • {a.status}</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/screens/assign-homework')}>
                      <Text style={[styles.link, { color: palette.primary }]}>Manage</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Actions</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: palette.primary }]} onPress={() => router.push('/screens/attendance')}>
                <Ionicons name="checkmark-done" size={18} color={palette.background} />
                <Text style={[styles.actionText, { color: palette.background }]}>Take Attendance</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: palette.primary }]} onPress={() => router.push('/screens/create-lesson')}>
                <Ionicons name="add-circle" size={18} color={palette.background} />
                <Text style={[styles.actionText, { color: palette.background }]}>Create Lesson</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: palette.primary }]} onPress={() => router.push('/screens/teacher-messages')}>
                <Ionicons name="chatbubbles" size={18} color={palette.background} />
                <Text style={[styles.actionText, { color: palette.background }]}>Message Parents</Text>
              </TouchableOpacity>
            </View>
          </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Metric({ title, value, icon, color }: { title: string; value: string; icon: any; color: string }) {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.metric, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
      <View style={[styles.metricIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.metricTitle, { color: theme.textSecondary }]}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: { 
    padding: 16, 
    gap: 12 
  },
  subtitle: { 
    fontSize: 14,
    marginBottom: 8
  },
  card: { 
    borderWidth: 1, 
    borderRadius: 12, 
    padding: 16, 
    gap: 12 
  },
  cardTitle: { 
    fontSize: 18,
    fontWeight: '700'
  },
  metricsRow: { 
    flexDirection: 'row', 
    gap: 12 
  },
  metric: { 
    borderWidth: 1, 
    borderRadius: 12, 
    padding: 12, 
    alignItems: 'center', 
    minWidth: 100, 
    flex: 1 
  },
  metricIcon: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 6 
  },
  metricValue: { 
    fontWeight: '900', 
    fontSize: 18 
  },
  metricTitle: { 
    fontSize: 12 
  },
  muted: { 
    fontSize: 14
  },
  assignmentRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 6 
  },
  assignmentTitle: { 
    fontWeight: '700' 
  },
  assignmentMeta: { 
    fontSize: 12 
  },
  link: { 
    fontWeight: '800' 
  },
  actionBtn: { 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  actionText: { 
    fontWeight: '700' 
  },
})

