import React, { useEffect, useState } from 'react'
import { View, Text, Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/contexts/ThemeContext'
import { router, useLocalSearchParams } from 'expo-router'
import { AnnouncementModal, AnnouncementData } from '@/components/modals/AnnouncementModal'
import AnnouncementService from '@/lib/services/announcementService'
import { assertSupabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function PrincipalAnnouncementScreen() {
  const { theme } = useTheme()
  const { profile } = useAuth()
  const params = useLocalSearchParams<{ title?: string; content?: string; audience?: string; priority?: string; compose?: string }>()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Auto-open modal when screen is opened
    setVisible(true)
  }, [])

  const onClose = () => {
    setVisible(false)
    router.back()
  }

  const onSend = async (announcement: AnnouncementData) => {
    try {
      const { data: auth } = await assertSupabase().auth.getUser()
      const authUserId = auth?.user?.id
      if (!authUserId) { Alert.alert('Error', 'Not signed in'); return }

      // Resolve teacher/user record to get preschool (school) id
      let preschoolId: string | undefined = (profile as any)?.preschool_id
      if (!preschoolId) {
        const { data: userRow } = await assertSupabase()
          .from('users')
          .select('preschool_id')
          .eq('auth_user_id', authUserId)
          .maybeSingle()
        preschoolId = userRow?.preschool_id
      }
      if (!preschoolId) { Alert.alert('Error', 'No school found for your profile'); return }

      const res = await AnnouncementService.createAnnouncement(preschoolId, authUserId, announcement)
      if (!res.success) { Alert.alert('Error', res.error || 'Failed to create announcement'); return }
      Alert.alert('Success', 'Announcement created', [{ text: 'OK', onPress: onClose }])
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create announcement')
    }
  }

  const prefill: AnnouncementData = {
    title: (params?.title as string) || '',
    message: (params?.content as string) || '',
    audience: (() => {
      const a = String(params?.audience || '').toLowerCase()
      if (['teachers','parents','students'].includes(a)) return [a]
      return ['teachers']
    })(),
    priority: (['low','normal','high','urgent'].includes(String(params?.priority || '').toLowerCase())
      ? (params?.priority as any)
      : 'normal'),
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Create Announcement</Text>
        <Text style={{ color: theme.textSecondary }}>School-wide announcement</Text>
      </View>
      <AnnouncementModal
        visible={visible}
        onClose={onClose}
        onSend={onSend}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16 },
  title: { fontSize: 18, fontWeight: '700' },
})