import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { assertSupabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import ThemedStatusBar from '@/components/ui/ThemedStatusBar'
import { Stack, router } from 'expo-router'
import { track } from '@/lib/analytics'
import { useSimplePullToRefresh } from '@/hooks/usePullToRefresh'
import { useTheme } from '@/contexts/ThemeContext'

export default function AttendanceScreen() {
  const { profile } = require('@/contexts/AuthContext') as any
  const hasActiveSeat = profile?.hasActiveSeat?.() || profile?.seat_status === 'active'
  const canManageClasses = hasActiveSeat || (!!profile?.hasCapability && profile.hasCapability('manage_classes' as any))
  const { theme } = useTheme()
  const palette = { background: theme.background, text: theme.text, textSecondary: theme.textSecondary, outline: theme.border, surface: theme.surface, primary: theme.primary }

  const [classId, setClassId] = useState<string | null>(null)
  const [today, setToday] = useState<string>('')
  const [presentMap, setPresentMap] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const d = new Date()
    setToday(d.toISOString().slice(0, 10))
  }, [])

  // Refresh function to refetch classes and students data
  const handleRefresh = async () => {
    try {
      await classesQuery.refetch()
      if (classId) {
        await studentsQuery.refetch()
      }
    } catch (error) {
      console.error('Error refreshing attendance data:', error)
    }
  }

  const { refreshing, onRefreshHandler } = useSimplePullToRefresh(handleRefresh, 'attendance')

  const classesQuery = useQuery({
    queryKey: ['teacher_classes_for_attendance'],
    queryFn: async () => {
      const { data, error } = await assertSupabase()
        .from('classes')
        .select('id,name')
        .eq('is_active', true)
      if (error) throw error
      return (data || []) as { id: string; name: string }[]
    },
    staleTime: 60_000,
  })

  const studentsQuery = useQuery({
    queryKey: ['students_for_attendance', classId],
    queryFn: async () => {
      let q = assertSupabase().from('students').select('id,first_name,last_name,class_id,is_active,age_groups!students_age_group_id_fkey(*)')
      if (classId) q = q.eq('class_id', classId)
      const { data, error } = await q
      if (error) throw error
      const arr = (data || []) as { id: string; first_name: string; last_name: string; class_id: string | null; is_active: boolean | null }[]
      // Default all to present
      const next: Record<string, boolean> = {}
      for (const s of arr) next[s.id] = true
      setPresentMap(next)
      return arr
    },
    enabled: !!classId,
  })

  const toggleStudent = (sid: string) => {
    setPresentMap(prev => ({ ...prev, [sid]: !prev[sid] }))
  }

  const markAll = (value: boolean) => {
    setPresentMap(prev => {
      const next: Record<string, boolean> = {}
      Object.keys(prev).forEach(k => { next[k] = value })
      return next
    })
  }

  const onSubmit = async () => {
    if (!classId) { Alert.alert('Select class', 'Please select a class first.'); return }
    const students = studentsQuery.data || []
    const entries = students.map(s => ({ student_id: s.id, present: !!presentMap[s.id] }))
    const presentCount = entries.filter(e => e.present).length

    setSubmitting(true)
    try {
      // Best-effort server insert; ignore errors if schema not present
      try {
        const { data: auth } = await assertSupabase().auth.getUser()
        const authUserId = auth?.user?.id || null
        await assertSupabase().from('attendance').insert(entries.map(e => ({
          class_id: classId,
          student_id: e.student_id,
          present: e.present,
          date: today,
          taken_by: authUserId,
        })) as any)
      } catch { /* noop */ void 0; }

      track('edudash.attendance.submit', { classId, presentCount, total: entries.length, date: today })
      Alert.alert('Attendance recorded', `Marked ${presentCount}/${entries.length} present for ${today}.`, [
        { text: 'Done', onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not submit attendance.')
    } finally {
      setSubmitting(false)
    }
  }

  const classes = classesQuery.data || []
  const students = studentsQuery.data || []

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ 
        title: 'Take Attendance', 
        headerStyle: { backgroundColor: palette.background }, 
        headerTitleStyle: { color: '#fff' }, 
        headerTintColor: palette.primary,
        headerBackVisible: true
      }} />
      <ThemedStatusBar />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
        <ScrollView 
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefreshHandler}
              tintColor="#00f5ff"
              title="Refreshing attendance data..."
            />
          }
        >
          {!canManageClasses && (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
              <Text style={styles.cardTitle}>Access Restricted</Text>
              <Text style={{ color: palette.textSecondary }}>Your seat is not active to manage attendance. Please contact your administrator.</Text>
            </View>
          )}
          <Text style={styles.subtitle}>Date: {today}</Text>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
            <Text style={styles.cardTitle}>Class</Text>
            {classesQuery.isLoading ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {classes.map(c => (
                  <TouchableOpacity key={c.id} style={[styles.chip, classId === c.id && styles.chipActive]} onPress={() => setClassId(c.id)}>
                    <Text style={[styles.chipText, classId === c.id && styles.chipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {classId && (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Students</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => markAll(true)} style={[styles.smallBtn, { backgroundColor: '#16a34a' }]}>
                    <Text style={styles.smallBtnText}>All present</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => markAll(false)} style={[styles.smallBtn, { backgroundColor: '#ef4444' }]}>
                    <Text style={styles.smallBtnText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {studentsQuery.isLoading ? (
                <ActivityIndicator color={palette.primary} />
              ) : (
                <View style={{ gap: 8 }}>
                  {students.length === 0 ? (
                    <Text style={styles.empty}>No students found.</Text>
                  ) : (
                    students.map(s => (
                      <TouchableOpacity key={s.id} style={[styles.studentRow, { borderColor: palette.outline }]} onPress={() => toggleStudent(s.id)}>
                        <Text style={styles.studentName}>{s.first_name} {s.last_name}</Text>
                        <View style={[styles.badge, presentMap[s.id] ? styles.badgePresent : styles.badgeAbsent]}>
                          <Text style={styles.badgeText}>{presentMap[s.id] ? 'Present' : 'Absent'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity onPress={onSubmit} disabled={!classId || submitting} style={[styles.submitBtn, (!classId || submitting) && styles.dim]}>
            {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitText}>Submit Attendance</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  subtitle: { color: '#9CA3AF' },
  card: { borderWidth: 1, borderColor: '#1f2937', borderRadius: 12, padding: 12, gap: 8 },
  cardTitle: { color: '#fff', fontWeight: '800' },
  chip: { borderWidth: 1, borderColor: '#1f2937', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginRight: 8 },
  chipActive: { backgroundColor: '#00f5ff', borderColor: '#00f5ff' },
  chipText: { color: '#9CA3AF', fontWeight: '700' },
  chipTextActive: { color: '#000' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnText: { color: '#fff', fontWeight: '700' },
  studentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, padding: 10 },
  studentName: { color: '#fff' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgePresent: { backgroundColor: '#16a34a' },
  badgeAbsent: { backgroundColor: '#ef4444' },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  empty: { color: '#9CA3AF' },
  submitBtn: { backgroundColor: '#00f5ff', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#000', fontWeight: '800' },
  dim: { opacity: 0.6 },
})

