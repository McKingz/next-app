import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
// import { assertSupabase } from '@/lib/supabase'
import { getFeatureFlagsSync } from '@/lib/featureFlags'
import { track } from '@/lib/analytics'
import { Colors } from '@/constants/Colors'
import { getCombinedUsage } from '@/lib/ai/usage'
import { useHomeworkGenerator } from '@/hooks/useHomeworkGenerator'
import { canUseFeature, getQuotaStatus, getEffectiveLimits } from '@/lib/ai/limits'
import { getPreferredModel, setPreferredModel } from '@/lib/ai/preferences'
import { router } from 'expo-router'
import { useSimplePullToRefresh } from '@/hooks/usePullToRefresh'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { toast } from '@/components/ui/ToastProvider'
import { useHomeworkHelperModels, useTierInfo } from '@/hooks/useAIModelSelection'
import { useTheme } from '@/contexts/ThemeContext'

export default function AIHomeworkHelperScreen() {
  const { theme } = useTheme()
  const [question, setQuestion] = useState('Explain how to solve long division: 156 ÷ 12 step by step for a Grade 4 learner.')
  const [subject, setSubject] = useState('Mathematics')
  const { loading, generate, result } = useHomeworkGenerator()
  const [pending, setPending] = useState(false)
  const [answer, setAnswer] = useState('')
  const [usage, setUsage] = useState<{ lesson_generation: number; grading_assistance: number; homework_help: number }>({ lesson_generation: 0, grading_assistance: 0, homework_help: 0 })
  const [models, setModels] = useState<Array<{ id: string; name: string; provider: 'claude' | 'openai' | 'custom'; relativeCost: number }>>([])
  const [selectedModel, setSelectedModel] = useState<string>('')

  const flags = getFeatureFlagsSync()
  const { quotas } = useHomeworkHelperModels()
  const AI_ENABLED = (process.env.EXPO_PUBLIC_AI_ENABLED === 'true') || (process.env.EXPO_PUBLIC_ENABLE_AI_FEATURES === 'true')
  const aiHelperEnabled = AI_ENABLED && flags.ai_homework_help !== false

  // Refresh function to reload usage and model data
  const handleRefresh = async () => {
    try {
      setUsage(await getCombinedUsage())
      const limits = await getEffectiveLimits()
      setModels(limits.modelOptions || [])
      const stored = await getPreferredModel('homework_help')
      setSelectedModel(stored || (limits.modelOptions && limits.modelOptions[0]?.id) || 'claude-3-haiku')
    } catch (error) {
      console.error('Error refreshing AI homework helper data:', error)
    }
  }

  const { refreshing, onRefreshHandler } = useSimplePullToRefresh(handleRefresh, 'ai_homework_helper')

  useEffect(() => {
    (async () => {
      setUsage(await getCombinedUsage())
      try {
        const limits = await getEffectiveLimits()
        setModels(limits.modelOptions || [])
        const stored = await getPreferredModel('homework_help')
        setSelectedModel(stored || (limits.modelOptions && limits.modelOptions[0]?.id) || 'claude-3-haiku')
      } catch { /* noop */ void 0; }
    })()
  }, [])

  const onAskAI = async () => {
    setPending(true)
    if (!question.trim()) {
      toast.warn('Please enter a question or problem.')
      setPending(false)
      return
    }
    if (!aiHelperEnabled) {
      toast.warn('AI Homework Helper is not enabled in this build.')
      setPending(false)
      return
    }

    // Enforce quota before making a request
    const gate = await canUseFeature('homework_help', 1)
    if (!gate.allowed) {
      const status = await getQuotaStatus('homework_help')
      Alert.alert(
        'Monthly limit reached',
        `You have used ${status.used} of ${status.limit} homework help sessions this month. ${gate.requiresPrepay ? 'Please upgrade or purchase more to continue.' : ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'See plans', onPress: () => router.push('/pricing') },
        ]
      )
      setPending(false)
      return
    }

    try {
      setAnswer('')
      track('edudash.ai.helper.started', { subject })
      const text = await generate({
        question: question,
        subject,
        gradeLevel: 4,
        difficulty: 'medium',
        model: selectedModel,
      })
      setAnswer(typeof text === 'string' ? text : String(text || ''))
      setUsage(await getCombinedUsage())
      track('edudash.ai.helper.completed', { subject })
    } catch (e: any) {
      const msg = String(e?.message || 'Unknown error')
      if (msg.toLowerCase().includes('rate') || msg.includes('429')) {
        toast.warn('Rate limit reached. Please try again later.')
        track('edudash.ai.helper.rate_limited', {})
      } else {
        toast.error(`Error: ${msg}`)
        track('edudash.ai.helper.failed', { error: msg })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader 
        title="AI Homework Helper" 
        subtitle="Child-safe, step-by-step guidance" 
      />
      
      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefreshHandler}
            tintColor="#007AFF"
            title="Refreshing AI data..."
          />
        }
      >

        {!aiHelperEnabled && (
          <Text style={styles.disabledBanner}>AI Homework Helper is currently disabled by feature flags or build configuration.</Text>
        )}

        <View style={styles.card}>
          {/* Model selector */}
          {models.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.label}>Model</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {models.map(m => {
                  const costIndicator = m.relativeCost <= 1 ? '$' : m.relativeCost <= 5 ? '$$' : '$$$';
                  const notes = (m as any).notes ? ` · ${(m as any).notes}` : '';
                  const modelText = `${m.name} · x${m.relativeCost} · ${costIndicator}${notes}`;
                  
                  return (
                    <TouchableOpacity key={m.id} onPress={async () => { setSelectedModel(m.id); try { await setPreferredModel(m.id, 'homework_help') } catch { /* noop */ void 0; } }} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: selectedModel === m.id ? Colors.light.text : '#E5E7EB', backgroundColor: selectedModel === m.id ? Colors.light.text : 'transparent' }}>
                      <Text style={{ color: selectedModel === m.id ? '#fff' : Colors.light.text }}>
                        {modelText}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g., Mathematics"
            placeholderTextColor={Colors.light.tabIconDefault}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Question / Problem</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={question}
            onChangeText={setQuestion}
            placeholder="Paste or type the question here"
            placeholderTextColor={Colors.light.tabIconDefault}
            multiline
          />

          <TouchableOpacity onPress={onAskAI} disabled={loading || pending || !aiHelperEnabled} style={[styles.button, (loading || pending || !aiHelperEnabled) && styles.buttonDisabled]}>
            {(loading || pending) ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Ask AI</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Response</Text>
          <Text style={styles.usage}>Monthly usage (local/server): Helper {usage.homework_help}</Text>
          <QuotaBar feature="homework_help" planLimit={quotas.ai_requests} />
          {result?.__fallbackUsed && (
            <View style={[styles.fallbackChip, { borderColor: '#E5E7EB', backgroundColor: theme.accent + '20' }]}>
              <Ionicons name="information-circle" size={16} color={theme.accent} />
              <Text style={{ color: Colors.light.tabIconDefault, fontSize: 12, marginLeft: 6 }}>Fallback used</Text>
            </View>
          )}
          {answer ? (
            <Text style={styles.answer} selectable>{answer}</Text>
          ) : (
            <Text style={styles.placeholder}>No response yet. Enter a question and press "Ask AI".</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function QuotaBar({ feature, planLimit }: { feature: 'lesson_generation' | 'grading_assistance' | 'homework_help'; planLimit?: number }) {
  const [status, setStatus] = React.useState<{ used: number; limit: number; remaining: number } | null>(null)
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const s = await getQuotaStatus(feature)
        const limit = planLimit && planLimit > 0 ? planLimit : s.limit
        if (mounted) setStatus({ used: s.used, limit, remaining: Math.max(0, (limit === -1 ? 0 : limit) - s.used) })
      } catch {
        if (mounted) setStatus(null)
      }
    })()
    return () => { mounted = false }
  }, [feature, planLimit])
  if (!status) return null
  if (status.limit === -1) return <Text style={{ color: Colors.light.tabIconDefault, marginBottom: 8 }}>Quota: Unlimited</Text>
  const pct = Math.max(0, Math.min(100, Math.round((status.used / Math.max(1, status.limit)) * 100)))
  return (
    <View style={{ marginTop: 4 }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' }}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: '#111827' }} />
      </View>
      <Text style={{ color: Colors.light.tabIconDefault, marginTop: 4, fontSize: 12 }}>Quota: {status.used}/{status.limit} used · {Math.max(0, status.limit - status.used)} remaining</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.light.tabIconDefault, marginBottom: 12 },
  disabledBanner: { color: '#b45309', backgroundColor: '#fef3c7', borderColor: '#f59e0b', borderWidth: StyleSheet.hairlineWidth, padding: 8, borderRadius: 8, marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderColor: '#E5E7EB', borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  label: { fontSize: 12, color: Colors.light.tabIconDefault, marginBottom: 6 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: Colors.light.text },
  textArea: { minHeight: 120 },
  button: { marginTop: 12, backgroundColor: '#111827', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6, color: Colors.light.text },
  usage: { fontSize: 12, color: Colors.light.tabIconDefault, marginBottom: 8 },
  answer: { fontSize: 13, color: Colors.light.text, lineHeight: 19 },
  placeholder: { fontSize: 13, color: Colors.light.tabIconDefault },
  fallbackChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
})

