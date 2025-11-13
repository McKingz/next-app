import React, { useMemo, useState } from 'react'
import { View, Text, Modal, StyleSheet, TextInput, TouchableOpacity, ScrollView, Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

export type CommandItem = {
  id: string
  title: string
  subtitle?: string
  icon?: string
  route?: string
  params?: Record<string, any>
  onPress?: () => void
  section?: string
}

export function DashCommandPalette({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  // Close on ESC (web)
  React.useEffect(() => {
    if (!visible) return;
    
    // Verify DOM APIs exist before using them (React Native compatibility)
    if (
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function' ||
      typeof window.removeEventListener !== 'function'
    ) {
      return undefined;
    }
    
    const handler = (e: any) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, onClose]);
  const { theme } = useTheme()
  const { profile } = useAuth()
  const [query, setQuery] = useState('')

  const baseItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      // AI
      { id: 'ai_lesson_generator', title: 'AI Lesson Generator', subtitle: 'Create AI-powered lesson plans', icon: 'sparkles', route: '/screens/ai-lesson-generator', section: 'AI' },
      { id: 'ai_homework_helper', title: 'AI Homework Helper', subtitle: 'Assist students with homework', icon: 'help-circle-outline', route: '/screens/ai-homework-helper', section: 'AI' },
      { id: 'ai_grader', title: 'AI Grading Assistant', subtitle: 'Grade submissions with feedback', icon: 'checkmark-done-outline', route: '/screens/ai-homework-grader-live', section: 'AI' },
      { id: 'ai_progress', title: 'AI Progress Analysis', subtitle: 'Analyze student progress', icon: 'analytics-outline', route: '/screens/ai-progress-analysis', section: 'AI' },

      // Lessons
      { id: 'lessons_hub', title: 'Lessons Hub', subtitle: 'Browse and manage lessons', icon: 'book-outline', route: '/screens/lessons-hub', section: 'Lessons' },
      { id: 'lessons_search', title: 'Search Lessons', subtitle: 'Find lessons by topic', icon: 'search-outline', route: '/screens/lessons-search', section: 'Lessons' },
      { id: 'lessons_categories', title: 'Lesson Categories', subtitle: 'Explore by subject', icon: 'grid-outline', route: '/screens/lessons-categories', section: 'Lessons' },
      { id: 'create_lesson', title: 'Create Lesson (Manual)', subtitle: 'Use templates instead of AI', icon: 'create-outline', route: '/screens/create-lesson', section: 'Lessons' },

      // Dashboards
      { id: 'admin_dashboard', title: 'Admin Dashboard', subtitle: 'School administration', icon: 'options-outline', route: '/admin-dashboard', section: 'Dashboards' },
      { id: 'teacher_dashboard', title: 'Teacher Dashboard', subtitle: 'Your daily workspace', icon: 'speedometer-outline', route: '/screens/teacher-dashboard', section: 'Dashboards' },
      { id: 'principal_dashboard', title: 'Principal Dashboard', subtitle: 'School overview and actions', icon: 'school-outline', route: '/screens/principal-dashboard', section: 'Dashboards' },
      { id: 'parent_dashboard', title: 'Parent Dashboard', subtitle: 'Track your child', icon: 'home-outline', route: '/screens/parent-dashboard', section: 'Dashboards' },
      { id: 'financial_dashboard', title: 'Financial Dashboard', subtitle: 'Fees and finance', icon: 'cash-outline', route: '/screens/financial-dashboard', section: 'Dashboards' },
      { id: 'principal_approval', title: 'Principal Approvals', subtitle: 'Review/approve requests', icon: 'checkmark-circle-outline', route: '/screens/principal-approval-dashboard', section: 'Dashboards' },
      { id: 'principal_announcement', title: 'Create School Announcement', subtitle: 'Principal announcement composer', icon: 'megaphone', route: '/screens/principal-announcement', params: { compose: '1' }, section: 'Dashboards' },

      // People
      { id: 'students', title: 'Students', subtitle: 'Browse students', icon: 'people-outline', route: '/screens/students-detail', section: 'People' },
      { id: 'teachers', title: 'Teachers', subtitle: 'Browse teachers', icon: 'person-outline', route: '/screens/teachers-detail', section: 'People' },

      // Admin/AI
      { id: 'admin_ai_allocation', title: 'AI Quota Allocation', subtitle: 'Allocate AI usage to teachers', icon: 'pie-chart-outline', route: '/screens/admin-ai-allocation', section: 'Admin' },
      { id: 'super_admin_ai', title: 'AI Quotas (Super Admin)', subtitle: 'Review org usage and limits', icon: 'server-outline', route: '/screens/super-admin-ai-quotas', section: 'Admin' },

      // Dash & Settings
      { id: 'dash_assistant', title: 'Open Dash Assistant', subtitle: 'Chat with Dash', icon: 'chatbubble-ellipses', route: '/screens/dash-assistant', section: 'Dash' },
      { id: 'dash_settings', title: 'Dash AI Settings', subtitle: 'Model, voice, and behavior', icon: 'settings-outline', route: '/screens/dash-ai-settings', section: 'Dash' },
      { id: 'dash_settings_enhanced', title: 'Dash Settings (Enhanced)', subtitle: 'Advanced AI controls', icon: 'construct-outline', route: '/screens/dash-ai-settings-enhanced', section: 'Dash' },
      { id: 'dash_history', title: 'Dash Conversations', subtitle: 'View recent chats', icon: 'time-outline', route: '/screens/dash-conversations-history', section: 'Dash' },

      // Auth/Misc
      { id: 'email_verification', title: 'Email Verification', subtitle: 'Verify your email', icon: 'mail-outline', route: '/screens/email-verification', section: 'Auth' },

      // Insights / Capabilities
      { id: 'capabilities', title: 'What can Dash do?', subtitle: 'See capabilities and examples', icon: 'information-circle-outline', route: '/screens/dash-assistant', params: { initialMessage: 'What can you do? Show me examples for my role.' }, section: 'Learn' },
    ]

    // Role-specific entries (duplicates are okay; filter in UI by search)
    const role = String(profile?.role || '')
    if (role === 'teacher') {
      // already included above
    } else if (role === 'principal' || role === 'principal_admin') {
      // already included above
    } else if (role === 'parent') {
      // already included above
    } else if (role === 'super_admin') {
      items.push({ id: 'super_admin_dashboard', title: 'Super Admin Dashboard', subtitle: 'Global controls', icon: 'construct-outline', route: '/screens/super-admin-dashboard', section: 'Dashboards' })
    }

    return items
  }, [profile])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return baseItems
    return baseItems.filter(i =>
      i.title.toLowerCase().includes(q) ||
      (i.subtitle && i.subtitle.toLowerCase().includes(q)) ||
      (i.section && i.section.toLowerCase().includes(q))
    )
  }, [query, baseItems])

  const onSelect = (item: CommandItem) => {
    try {
      if (item.onPress) {
        item.onPress()
      } else if (item.route) {
        router.push({ pathname: item.route, params: item.params || {} } as any)
      }
    } finally {
      onClose()
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <Ionicons name="sparkles" size={18} color={theme.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.title, { color: theme.text }]}>Dash Command Palette</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
          <TextInput
            placeholder="Search destinations, features, or type a command..."
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            style={[styles.input, { borderColor: theme.inputBorder, color: theme.inputText, backgroundColor: theme.inputBackground }]}
            autoFocus
          />

          <ScrollView style={{ maxHeight: screenHeight * 0.6 }}>
            {items.map((it) => (
              <TouchableOpacity key={it.id} style={[styles.itemRow, { borderBottomColor: theme.border }]} onPress={() => onSelect(it)}>
                <View style={[styles.itemIcon, { backgroundColor: theme.primary + '20' }]}>
                  <Ionicons name={(it.icon || 'caret-forward-outline') as any} size={18} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>{it.title}</Text>
                  {!!it.subtitle && (
                    <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>{it.subtitle}</Text>
                  )}
                </View>
                {!!it.section && (
                  <Text style={[styles.sectionTag, { color: theme.textSecondary, borderColor: theme.border }]}>{it.section}</Text>
                )}
              </TouchableOpacity>
            ))}
            {items.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={24} color={theme.textSecondary} />
                <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No matches. Try a different search.</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              Shortcuts: Cmd/Ctrl+K open • Esc close • g l Lessons Hub • g s Search • g c Categories • g a Dash • g d Dashboard (role-aware) • g p Principal • g f Financial • g h History • g t Teachers • g u Students • g q AI Quotas
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  container: {
    width: Math.min(560, screenWidth - 24),
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700'
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  sectionTag: {
    fontSize: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20
  },
  footer: {
    marginTop: 8,
  }
})
