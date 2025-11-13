import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { assertSupabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { useLocalSearchParams } from 'expo-router'

export default function TeacherMessagesScreen() {
  const { profile, permissions } = useAuth()
  const { theme } = useTheme()
  
  const hasActiveSeat = profile?.seat_status === 'active'
  const canMessage = hasActiveSeat && permissions.can('communicate_with_parents')
  
  const palette = {
    background: theme.background,
    text: theme.text,
    textSecondary: theme.textSecondary,
    outline: theme.border,
    surface: theme.cardBackground,
    primary: theme.primary
  }

  const [classId, setClassId] = useState<string | null>(null)
  const [subject, setSubject] = useState('Announcement')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Prefill support for Dash
  const params = useLocalSearchParams<{ prefillSubject?: string; prefillMessage?: string }>()
  React.useEffect(() => {
    const s = (params?.prefillSubject || '').trim()
    const m = (params?.prefillMessage || '').trim()
    if (s) setSubject(s)
    if (m) setMessage(m)
  }, [params])

  const classesQuery = useQuery({
    queryKey: ['teacher_classes_for_messages', profile?.id],
    queryFn: async () => {
      // Restrict to teacher's org if available, to avoid cross-tenant data
      const query = assertSupabase().from('classes').select('id,name').eq('is_active', true)
      if ((profile as any)?.organization_id) {
        query.eq('preschool_id', (profile as any).organization_id)
      }
      const { data, error } = await query
      if (error) throw error
      return (data || []) as { id: string; name: string }[]
    },
    enabled: !!profile?.id,
    staleTime: 60_000,
  })

  const onSend = async () => {
    if (!classId) { Alert.alert('Select class', 'Please select a class.'); return }
    if (!message.trim()) { Alert.alert('Enter message', 'Please write a message.'); return }
    if (!canMessage) { Alert.alert('No access', 'Your seat or plan does not allow messaging.'); return }

    setSending(true)
    try {
      // Get current user info
      const { data: authUser } = await assertSupabase().auth.getUser()
      const teacherId = authUser?.user?.id
      
      // Use direct database insert - more reliable than cloud function
      const payload: any = {
        class_id: classId,
        subject,
        message,
        teacher_id: teacherId,
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString()
      }
      // Include org for RLS when present
      if ((profile as any)?.organization_id) payload.preschool_id = (profile as any).organization_id

      const { error } = await assertSupabase().from('teacher_messages').insert(payload as any)
      if (error) throw error
      
      track('edudash.messages.sent', { classId, subject, length: message.length })
      Alert.alert('Message sent', 'Parents will receive this in their app or email (where configured).')
      setMessage('')
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not send message.')
    } finally {
      setSending(false)
    }
  }

  const classes = classesQuery.data || []

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScreenHeader 
        title="Message Parents" 
        subtitle="Send announcements to parent groups" 
      />
      <ScrollView contentContainerStyle={styles.content}>
          {!canMessage && (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Access Restricted</Text>
              <Text style={[styles.label, { color: palette.textSecondary }]}>
                {!hasActiveSeat 
                  ? 'Your teacher seat is not active. Please contact your administrator.' 
                  : 'Your account does not have messaging permissions. Please contact your administrator.'}
              </Text>
            </View>
          )}
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Class</Text>
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

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Message</Text>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Subject</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: palette.surface, color: palette.text, borderColor: palette.outline }]} 
              value={subject} 
              onChangeText={setSubject} 
              placeholder="Subject" 
              placeholderTextColor={palette.textSecondary} 
            />
            <Text style={[styles.label, { marginTop: 10, color: palette.textSecondary }]}>Body</Text>
            <TextInput 
              style={[styles.input, styles.multiline, { backgroundColor: palette.surface, color: palette.text, borderColor: palette.outline }]} 
              value={message} 
              onChangeText={setMessage} 
              placeholder="Write your message to parents..." 
              placeholderTextColor={palette.textSecondary} 
              multiline 
            />
            <TouchableOpacity 
              onPress={onSend} 
              disabled={sending || !classId} 
              style={[
                styles.primaryBtn, 
                { backgroundColor: palette.primary },
                (sending || !classId) && { opacity: 0.6 }
              ]}
            >
              {sending ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: theme.onPrimary }]}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
      </ScrollView>
    </SafeAreaView>
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
  label: { 
    fontSize: 14, 
    fontWeight: '600',
    marginBottom: 8
  },
  input: { 
    borderRadius: 8, 
    borderWidth: 1, 
    padding: 12,
    fontSize: 16
  },
  multiline: { 
    minHeight: 120, 
    textAlignVertical: 'top' 
  },
  chip: { 
    borderWidth: 1, 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    marginRight: 8 
  },
  chipActive: { 
    opacity: 1 
  },
  chipText: { 
    fontWeight: '600' 
  },
  chipTextActive: {},
  primaryBtn: { 
    paddingVertical: 14, 
    borderRadius: 8, 
    alignItems: 'center',
    marginTop: 8
  },
  primaryBtnText: { 
    fontWeight: '600',
    fontSize: 16
  },
})

