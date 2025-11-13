import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl, TextInput, Platform } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import { assertSupabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { LessonGeneratorService } from '@/lib/ai/lessonGenerator'
import { getFeatureFlagsSync } from '@/lib/featureFlags'
import { track } from '@/lib/analytics'
import { getCombinedUsage, incrementUsage, logUsageEvent, getUsage, getServerUsage } from '@/lib/ai/usage'
import { canUseFeature, getQuotaStatus, getEffectiveLimits } from '@/lib/ai/limits'
import { getPreferredModel, setPreferredModel } from '@/lib/ai/preferences'
import { router, useLocalSearchParams } from 'expo-router'
import { useSimplePullToRefresh } from '@/hooks/usePullToRefresh'
import { useLessonGenerator } from '@/hooks/useLessonGenerator'
import { useLessonGeneratorModels, useTierInfo } from '@/hooks/useAIModelSelection'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'
import { toast } from '@/components/ui/ToastProvider'
import { EducationalPDFService } from '@/lib/services/EducationalPDFService'

export default function AILessonGeneratorScreen() {
  const { theme } = useTheme()
  const palette = useMemo(() => ({
    background: theme.background,
    text: theme.text,
    textSecondary: theme.textSecondary,
    outline: theme.border,
    surface: theme.surface,
    primary: theme.primary,
    accent: theme.accent,
  }), [theme])
  const [generated, setGenerated] = useState<any | null>(null)
  const [topic, setTopic] = useState('Fractions')
  const [subject, setSubject] = useState('Mathematics')
  const [gradeLevel, setGradeLevel] = useState('3')
  const [duration, setDuration] = useState('45')
  const [objectives, setObjectives] = useState('Understand proper fractions; Compare simple fractions')
  const [language, setLanguage] = useState<'en' | 'es' | 'fr' | 'pt' | 'de' | 'af' | 'zu' | 'st'>('en')
  const searchParams = useLocalSearchParams<{ topic?: string; subject?: string; gradeLevel?: string; duration?: string; objectives?: string; autogenerate?: string; model?: string; language?: string }>()
  const [saving, setSaving] = useState(false)
  const { loading: generating, result, generate } = useLessonGenerator() as any
  const [pending, setPending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [usage, setUsage] = useState<{ lesson_generation: number; grading_assistance: number; homework_help: number }>({ lesson_generation: 0, grading_assistance: 0, homework_help: 0 })
  const [quotaStatus, setQuotaStatus] = useState<{ used: number; limit: number; remaining: number } | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [progressInterval, setProgressInterval] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastPayload, setLastPayload] = useState<any | null>(null)
  const [attempt, setAttempt] = useState(0)
  
  // Use tier-based model selection
  const {
    availableModels,
    selectedModel,
    setSelectedModel,
    tier,
    quotas,
    isLoading: modelsLoading
  } = useLessonGeneratorModels()
  
  const { tierInfo } = useTierInfo()

  const categoriesQuery = useQuery({
    queryKey: ['lesson_categories'],
    queryFn: async () => {
      const { data, error } = await assertSupabase().from('lesson_categories').select('id,name')
      if (error) throw error
      return (data || []) as { id: string; name: string }[]
    },
    staleTime: 60_000,
  })

  const flags = getFeatureFlagsSync();
  const AI_ENABLED = (process.env.EXPO_PUBLIC_AI_ENABLED === 'true') || (process.env.EXPO_PUBLIC_ENABLE_AI_FEATURES === 'true');

  // Refresh function to reload usage data and categories
  const handleRefresh = async () => {
    try {
      // Use combined usage to get server-authoritative counts
      setUsage(await getCombinedUsage())
      // Refetch categories
      await categoriesQuery.refetch()
    } catch (error) {
      console.error('Error refreshing AI lesson generator data:', error)
    }
  }

  const { refreshing, onRefreshHandler } = useSimplePullToRefresh(handleRefresh, 'ai_lesson_generator')

  useEffect(() => {
    (async () => {
      // Use combined usage to show accurate cross-device counts
      setUsage(await getCombinedUsage())
      try {
        const s = await getQuotaStatus('lesson_generation')
        setQuotaStatus(s)
      } catch (err) {
        console.warn('[Lesson Generator] Failed to load quota status:', err)
        setQuotaStatus(null)
      }
    })()
  }, [])

  // Apply prefill from Dash action params
  useEffect(() => {
    const t = (searchParams?.topic || '').trim();
    const s = (searchParams?.subject || '').trim();
    const g = (searchParams?.gradeLevel || '').trim();
    const d = (searchParams?.duration || '').trim();
    const o = (searchParams?.objectives || '').trim();
    const m = (searchParams?.model || '').trim();
    const lang = (searchParams?.language || '').trim().toLowerCase();
    
    if (t) setTopic(t);
    if (s) setSubject(s);
    if (g && /^\d+$/.test(g)) setGradeLevel(g);
    if (d && /^\d+$/.test(d)) setDuration(d);
    if (o) setObjectives(o);
    if (lang && ['en','es','fr','pt','de','af','zu','st'].includes(lang)) setLanguage(lang as any)
    
    // Set model from Dash if provided and valid
    if (m && (m === 'claude-3-haiku' || m === 'claude-3-sonnet' || m === 'claude-3-opus')) {
      console.log('[Lesson Generator] Setting model from Dash:', m);
      setSelectedModel(m as any);
    }

    // Explicitly ignore any autogenerate flags: user must press Generate
    // This preserves the requirement for a manual confirmation action.
  }, [searchParams, setSelectedModel])
  
  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Cancel any ongoing generation when leaving the screen
      if (abortController) {
        abortController.abort()
      }
    }
  }, [])

  const buildDashPrompt = () => {
    const objs = (objectives || '').split(';').map(s => s.trim()).filter(Boolean)
    const langSuffix = language && language !== 'en' ? `\nPlease respond in ${language}.` : ''
    return `Generate a ${Number(duration) || 45} minute lesson plan for Grade ${Number(gradeLevel) || 3} in ${subject} on the topic "${topic}".
Learning objectives: ${objs.join('; ') || 'derive reasonable objectives'}.
Provide a structured plan with objectives, warm-up, core activities, assessment ideas, and closure. Use clear bullet points.${langSuffix}`
  }

  const onOpenWithDash = () => {
    const initialMessage = buildDashPrompt()
    try {
      const { safeRouter } = require('@/lib/navigation/safeRouter');
      safeRouter.push({ pathname: '/screens/dash-assistant', params: { initialMessage } })
    } catch {
      router.push({ pathname: '/screens/dash-assistant', params: { initialMessage } })
    }
  }
  
  const onExportPDF = async () => {
    try {
      const title = `${subject}: ${topic}`
      const content = (result?.text || generated?.description || '').trim()
      if (!content) { Alert.alert('Export PDF', 'Please generate a lesson first.'); return }
      await EducationalPDFService.generateTextPDF(title, content)
      toast.success('PDF generated');
    } catch (e: any) {
      toast.error('Failed to generate PDF')
    }
  }
  
  const onCancel = () => {
    // Cancel the ongoing request
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
    
    // Clear progress interval
    if (progressInterval) {
      clearInterval(progressInterval)
      setProgressInterval(null)
    }
    
    // Reset state
    setPending(false)
    setProgress(0)
    setProgressMessage('')
    setErrorMsg(null)
    
    toast.info('Generation cancelled')
    track('edudash.ai.lesson.generate_cancelled', {})
  }
  
  // Promise.race helper with timeout
  async function invokeWithTimeout<T>(p: Promise<T>, ms = 30000): Promise<T> {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Request timed out after ${ms/1000}s`)), ms))
    ])
  }

  const onGenerate = async (payloadOverride?: any) => {
    try {
      // Create abort controller for cancellation
      const controller = new AbortController()
      setAbortController(controller)
      
      setPending(true)
      setProgress(0)
      setProgressMessage('Initializing...')

      // Start progress ticker immediately to avoid "stuck at 10%"
      // Clear any existing interval first
      if (progressInterval) { clearInterval(progressInterval); setProgressInterval(null); }
      const earlyInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 90) {
            const inc = Math.random() * 6 + 2
            const next = Math.min(prev + inc, 90)
            if (next < 30) setProgressMessage('Preparing...')
            else if (next < 50) setProgressMessage('Checking quota...')
            else if (next < 70) setProgressMessage('Generating lesson structure...')
            else if (next < 85) setProgressMessage('Creating activities and assessments...')
            else setProgressMessage('Finalizing...')
            return next
          }
          return prev
        })
      }, 600)
      setProgressInterval(earlyInterval)
      
      if (!AI_ENABLED || flags.ai_lesson_generation === false) {
        toast.warn('AI Lesson Generator is disabled in this build.');
        return;
      }
      
      setProgress(10)
      setProgressMessage('Checking quota...')
      setErrorMsg(null)
      
      // Enforce quota before making a request, but don't block indefinitely
      let gate: any = null
      try {
        gate = await invokeWithTimeout(canUseFeature('lesson_generation', 1), 10000)
      } catch (gateErr) {
        console.warn('[Lesson Generator] Quota check timed out; proceeding with server-side enforcement')
        toast.info('Network is slow; proceeding. If you are over your quota, the server will block this request.')
        gate = { allowed: true }
      }

      if (!gate.allowed) {
        const status = await getQuotaStatus('lesson_generation')
        Alert.alert(
          'Monthly limit reached',
          `You have used ${status.used} of ${status.limit} lesson generations this month. ${gate.requiresPrepay ? 'Please upgrade or purchase more to continue.' : ''}`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'See plans', onPress: () => router.push('/pricing') },
          ]
        )
        return
      }
      
      setProgress(20)
      setProgressMessage('Preparing lesson request...')
      track('edudash.ai.lesson.generate_started', {})
      
      // Use the same AI service architecture as Dash AI Assistant
      const payload = payloadOverride || {
        action: 'lesson_generation',
        topic: topic || 'Lesson Topic',
        subject: subject || 'General Studies',
        gradeLevel: Number(gradeLevel) || 3,
        duration: Number(duration) || 45,
        objectives: (objectives || '').split(';').map(s => s.trim()).filter(Boolean),
        language: language || 'en',
        model: selectedModel || process.env.EXPO_PUBLIC_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      };
      setLastPayload(payload)
      setAttempt(a => a + 1)

      setProgress(30)
      setProgressMessage('Connecting to AI service...')
      
      // Simulate progress updates during AI generation
      // Replace early interval with a slightly faster interval during AI call
      if (progressInterval) { clearInterval(progressInterval); }
      const interval = setInterval(() => {
        setProgress(prev => (prev < 90 ? Math.min(prev + (Math.random() * 8 + 4), 90) : prev))
      }, 500)
      setProgressInterval(interval)

      // Check if cancelled before making API call
      if (controller.signal.aborted) {
        throw new Error('Generation cancelled')
      }
      
      const invokePromise = assertSupabase().functions.invoke('ai-gateway', { 
        body: payload,
      }) as Promise<{ data: any; error: any }>

      const { data, error } = await invokeWithTimeout(invokePromise, 30000)
      
      if (interval) clearInterval(interval);
      setProgressInterval(null);
      setProgress(95)
      setProgressMessage('Processing results...')
      
      if (error) throw error;

      const lessonText = data?.content || '';
      
      setProgress(100)
      setProgressMessage('Complete!')
      
      // Set generated lesson content
      setGenerated({
        title: `${subject}: ${topic}`,
        description: lessonText || 'No lesson content returned.',
        content: { sections: [] },
        activities: []
      })
      
      // Track successful lesson generation
      try {
        console.log('[Lesson Generator] Starting usage tracking...')
        
        // Check both server and local usage separately
        const serverUsageBefore = await getServerUsage()
        const localUsageBefore = await getUsage()
        const combinedUsageBefore = await getCombinedUsage()
        
        console.log('[Lesson Generator] Server usage before:', serverUsageBefore)
        console.log('[Lesson Generator] Local usage before:', localUsageBefore)
        console.log('[Lesson Generator] Combined usage before:', combinedUsageBefore)
        
        await incrementUsage('lesson_generation', 1)
        console.log('[Lesson Generator] incrementUsage called')
        
        await logUsageEvent({
          feature: 'lesson_generation',
          model: String(payload.model),
          tokensIn: (data && data.usage?.input_tokens) || 0,
          tokensOut: (data && data.usage?.output_tokens) || 0,
          estCostCents: (data && data.cost) || 0,
          timestamp: new Date().toISOString(),
        })
        console.log('[Lesson Generator] logUsageEvent called')
        
        // Check both after increment
        const serverUsageAfter = await getServerUsage()
        const localUsageAfter = await getUsage()
        const combinedUsageAfter = await getCombinedUsage()
        
        console.log('[Lesson Generator] Server usage after:', serverUsageAfter)
        console.log('[Lesson Generator] Local usage after:', localUsageAfter)
        console.log('[Lesson Generator] Combined usage after:', combinedUsageAfter)
        
        // Show alert for immediate feedback
        Alert.alert(
          'Usage Tracking Debug', 
          `Local: ${localUsageBefore.lesson_generation} → ${localUsageAfter.lesson_generation}\nServer: ${serverUsageBefore?.lesson_generation || 'N/A'} → ${serverUsageAfter?.lesson_generation || 'N/A'}\nCombined: ${combinedUsageBefore.lesson_generation} → ${combinedUsageAfter.lesson_generation}`,
          [{ text: 'OK' }]
        )
        
        console.log('[Lesson Generator] Usage tracked successfully')
      } catch (usageError) {
        console.error('[Lesson Generator] Failed to track usage:', usageError)
      }
      
      // Update usage stats display - use local data for now
      const localUsageAfterGeneration = await getUsage()
      setUsage(localUsageAfterGeneration)
      // Refresh quota status after counting usage
      try {
        const sAfter = await getQuotaStatus('lesson_generation')
        setQuotaStatus(sAfter)
      } catch { /* Intentional: non-fatal */ }
      console.log('[Lesson Generator] Updated display with local usage:', localUsageAfterGeneration)
      
      // Show success toast
      if (lessonText) {
        toast.success('Lesson generated successfully! Review the content below.');
      } else {
        toast.warn('Lesson generated but no content returned. Please try again.');
      }
      
      track('edudash.ai.lesson.generate_completed', {})
    } catch (e: any) {
      track('edudash.ai.lesson.generate_failed', { error: e?.message })
      const message = e?.message || 'Please try again'
      setErrorMsg(message)
      toast.error(`Generation failed: ${message}`)
    } finally {
      // Clean up abort controller and progress interval
      setAbortController(null)
      if (progressInterval) {
        try { clearInterval(progressInterval) } catch { /* Intentional: non-fatal */ }
        setProgressInterval(null)
      }
      setPending(false)
      setSaving(false)
      setProgress(0)
      setProgressMessage('')
    }
  }

  const onSave = async () => {
    try {
      setSaving(true)
      const { data: auth } = await assertSupabase().auth.getUser()
      const authUserId = auth?.user?.id || ''
      const { data: profile } = await assertSupabase().from('users').select('id,preschool_id').eq('auth_user_id', authUserId).maybeSingle()
      if (!profile) { toast.error('Not signed in'); return }

      const categoryId = categoriesQuery.data?.[0]?.id
      if (!categoryId) { toast.warn('Please create a category first'); return }

      const res = await LessonGeneratorService.saveGeneratedLesson({
        lesson: generated,
        teacherId: profile.id,
        preschoolId: profile.preschool_id,
        ageGroupId: 'n/a',
        categoryId,
        template: { duration: 30, complexity: 'moderate' },
        isPublished: true,
      })
      if (!res.success) {
        toast.error(`Save failed: ${res.error || 'Unknown error'}`)
        return
      }
      toast.success(`Lesson saved (id ${res.lessonId})`)
    } catch (e: any) {
      toast.error(`Save error: ${e?.message || 'Failed to save'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScreenHeader 
        title="AI Lesson Generator" 
        subtitle="Create AI-powered lesson plans" 
        showBackButton={true}
      />

      {/* Dash-styled header row */}
      <View style={[styles.dashHeaderRow]}>
        <View style={[styles.inlineAvatar, { backgroundColor: theme.primary }]}>
          <Ionicons name="sparkles" size={16} color={theme.onPrimary} />
        </View>
        <Text style={[styles.dashTitleText, { color: palette.text }]}>Dash • Lesson Generator</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[styles.openWithDashBtn, { borderColor: palette.outline, marginRight: 8 }]} onPress={onExportPDF}>
          <Ionicons name="document-outline" size={16} color={palette.text} />
          <Text style={[styles.openWithDashText, { color: palette.text }]}>Export PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.openWithDashBtn, { borderColor: palette.outline }]} onPress={onOpenWithDash}>
          <Ionicons name="chatbubbles-outline" size={16} color={palette.text} />
          <Text style={[styles.openWithDashText, { color: palette.text }]}>Open with Dash</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.contentPadding}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefreshHandler}
            tintColor="#3B82F6"
            title="Refreshing AI data..."
          />
        }
      >
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline, marginTop: 16 }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Lesson Parameters</Text>
          <Text style={{ color: palette.textSecondary }}>Customize the generation prompt. Dash can auto-fill and generate for you.</Text>

          <Text style={[styles.label, { color: palette.textSecondary, marginTop: 8 }]}>Topic</Text>
          <TextInput style={[styles.input, { color: palette.text, borderColor: palette.outline }]} value={topic} onChangeText={setTopic} placeholder="e.g., Fractions" />

          <Text style={[styles.label, { color: palette.textSecondary, marginTop: 8 }]}>Subject</Text>
          <TextInput style={[styles.input, { color: palette.text, borderColor: palette.outline }]} value={subject} onChangeText={setSubject} placeholder="e.g., Mathematics" />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: palette.textSecondary, marginTop: 8 }]}>Grade Level</Text>
              <TextInput style={[styles.input, { color: palette.text, borderColor: palette.outline }]} value={gradeLevel} onChangeText={setGradeLevel} keyboardType="numeric" placeholder="e.g., 3" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: palette.textSecondary, marginTop: 8 }]}>Duration (min)</Text>
              <TextInput style={[styles.input, { color: palette.text, borderColor: palette.outline }]} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="e.g., 45" />
            </View>
          </View>

          <Text style={[styles.label, { color: palette.textSecondary, marginTop: 8 }]}>Learning Objectives (separate with ;)</Text>
          <TextInput style={[styles.input, { color: palette.text, borderColor: palette.outline }]} value={objectives} onChangeText={setObjectives} placeholder="Objective A; Objective B" />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: palette.textSecondary, marginTop: 8 }]}>Language</Text>
              <TextInput 
                style={[styles.input, { color: palette.text, borderColor: palette.outline }]}
                value={language}
                onChangeText={t => setLanguage((t as any) as any)}
                placeholder="en, es, fr, pt, de, af, zu, st"
              />
            </View>
          </View>

          <Text style={{ color: palette.textSecondary, marginTop: 8 }}>
            This month: {usage.lesson_generation} lessons generated
          </Text>
          <QuotaBar feature="lesson_generation" color={theme.primary} />
          {quotaStatus && quotaStatus.limit !== -1 && quotaStatus.used >= quotaStatus.limit && (
            <View style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 8,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '#EF4444',
              backgroundColor: '#EF4444' + '10'
            }}>
              <Text style={{ color: '#EF4444', fontWeight: '700', marginBottom: 4 }}>
                Monthly limit reached
              </Text>
              <Text style={{ color: palette.textSecondary, marginBottom: 8 }}>
                You have used {quotaStatus.used} of {quotaStatus.limit} lesson generations for this month.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => router.push('/pricing')} style={[styles.primaryBtn, { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 8 }]}>
                  <Text style={[styles.primaryBtnText, { color: '#FFFFFF' }]}>See plans</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toast.info('Your quota resets at the start of next month.')} style={[styles.primaryBtn, { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 8 }]}>
                  <Text style={[styles.primaryBtnText, { color: '#EF4444' }]}>When does it reset?</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {result?.__fallbackUsed && (
            <View style={[styles.fallbackChip, { borderColor: palette.outline, backgroundColor: theme.accent + '20' }]}>
              <Ionicons name={result.__savedToDatabase ? "checkmark-circle" : "information-circle"} size={16} color={result.__savedToDatabase ? theme.success : theme.accent} />
              <Text style={{ color: palette.textSecondary, marginLeft: 6 }}>
                {result.__savedToDatabase ? 'Fallback used • Saved to database' : 'Fallback used'}
              </Text>
            </View>
          )}
        </View>

        {/* Tier-based Model selector */}
        {!modelsLoading && availableModels.length > 0 && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>AI Model</Text>
              {tierInfo && (
                <View style={{ 
                  paddingHorizontal: 8, 
                  paddingVertical: 4, 
                  borderRadius: 12, 
                  backgroundColor: tierInfo.color + '20' 
                }}>
                  <Text style={{ color: tierInfo.color, fontSize: 11, fontWeight: '600' }}>
                    {tierInfo.badge} Plan
                  </Text>
                </View>
              )}
            </View>
            
            <Text style={{ color: palette.textSecondary, marginBottom: 12, fontSize: 13 }}>
              {tierInfo?.description || 'Select your AI model'}
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {availableModels.map(m => {
                const isSelected = selectedModel === m.id
                const costDisplay = m.relativeCost <= 1 ? '$' : m.relativeCost <= 5 ? '$$' : '$$$'
                
                return (
                  <TouchableOpacity 
                    key={m.id} 
                    onPress={() => {
                      setSelectedModel(m.id)
                      // Persist preference
                      setPreferredModel(m.id, 'lesson_generation').catch(() => { /* Intentional: error handled */ })
                    }} 
                    style={{
                      paddingHorizontal: 12, 
                      paddingVertical: 8, 
                      borderRadius: 8, 
                      borderWidth: 1, 
                      borderColor: isSelected ? (tierInfo?.color || '#111827') : palette.outline, 
                      backgroundColor: isSelected ? (tierInfo?.color || '#111827') + '10' : 'transparent'
                    }}
                  >
                    <Text style={{ 
                      color: isSelected ? (tierInfo?.color || '#111827') : palette.text,
                      fontSize: 13,
                      fontWeight: isSelected ? '600' : '400'
                    }}>
                      {m.displayName || m.name}
                    </Text>
                    <Text style={{
                      color: palette.textSecondary,
                      fontSize: 11,
                      marginTop: 2
                    }}>
                      {costDisplay} · {m.notes}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            
            {/* Show quota information */}
            <View style={{ 
              marginTop: 12, 
              padding: 8, 
              backgroundColor: palette.outline + '30', 
              borderRadius: 6 
            }}>
              <Text style={{ color: palette.textSecondary, fontSize: 11 }}>
                Plan limits: {quotas.ai_requests === -1 ? 'Unlimited' : `${quotas.ai_requests}`} requests/month, {quotas.rpm_limit} requests/minute
              </Text>
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => {
              if (quotaStatus && quotaStatus.limit !== -1 && quotaStatus.used >= quotaStatus.limit) {
                router.push('/pricing');
                return;
              }
              onGenerate();
            }}
            style={[styles.primaryBtn, { backgroundColor: (quotaStatus && quotaStatus.limit !== -1 && quotaStatus.used >= quotaStatus.limit) ? '#9CA3AF' : theme.primary, flex: 1 }]}
            disabled={(generating || pending || (quotaStatus && quotaStatus.limit !== -1 && quotaStatus.used >= quotaStatus.limit)) ? true : false}
          >
            {(generating || pending) ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: theme.onPrimary }]}> 
                {(quotaStatus && quotaStatus.limit !== -1 && quotaStatus.used >= quotaStatus.limit) ? 'Upgrade to Generate' : 'Generate Lesson'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onSave} style={[styles.primaryBtn, { backgroundColor: generated?.description ? theme.accent : palette.outline, flex: 1 }]} disabled={saving || !generated?.description}>
            {saving ? <ActivityIndicator color={theme.onAccent} /> : <Text style={[styles.primaryBtnText, { color: generated?.description ? theme.onAccent : palette.textSecondary }]}>Save Lesson</Text>}
          </TouchableOpacity>
        </View>
        

        {/* Progress Bar */}
        {(generating || pending) && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: theme.primary, marginTop: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.inlineAvatar, { backgroundColor: theme.primary }]}>
                  <Ionicons name="sparkles" size={16} color={theme.onPrimary} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.primary, marginLeft: 8, marginBottom: 0 }]}>Generating Lesson...</Text>
              </View>
              
              {/* Cancel Button */}
              <TouchableOpacity 
                style={[
                  styles.cancelButton, 
                  { 
                    backgroundColor: theme.error, 
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6
                  }
                ]}
                onPress={onCancel}
                accessibilityLabel="Cancel lesson generation"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="close" size={16} color={theme.onError || theme.background} style={{ marginRight: 4 }} />
                  <Text style={{ color: theme.onError || theme.background, fontSize: 12, fontWeight: '600' }}>
                    Cancel
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            
            <Text style={{ color: palette.textSecondary, marginBottom: 12, fontSize: 13 }}>
              {progressMessage}
            </Text>

            <View style={{ 
              height: 8, 
              borderRadius: 4, 
              backgroundColor: palette.outline + '40',
              overflow: 'hidden'
            }}>
              <View 
                style={{ 
                  width: `${progress}%`, 
                  height: 8, 
                  borderRadius: 4, 
                  backgroundColor: theme.primary
                }} 
              />
            </View>
            
            <Text style={{ 
              color: palette.textSecondary, 
              marginTop: 8, 
              fontSize: 12,
              textAlign: 'center'
            }}>
              {Math.round(progress)}% complete
            </Text>
            
            <Text style={{ 
              color: palette.textSecondary, 
              marginTop: 4, 
              fontSize: 11,
              textAlign: 'center',
              fontStyle: 'italic'
            }}>
              Press Cancel to stop generation at any time
            </Text>
          </View>
        )}

        {/* Error + Retry Section */}
        {!!errorMsg && !pending && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: '#EF4444', borderWidth: 1, marginTop: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="warning-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: '#EF4444', marginBottom: 0, flex: 1 }]}>Generation failed</Text>
              {!!lastPayload && (
                <TouchableOpacity 
                  style={[styles.primaryBtn, { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6 }]}
                  onPress={() => onGenerate(lastPayload)}
                >
                  <Text style={[styles.primaryBtnText, { color: '#EF4444', fontSize: 12 }]}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={{ color: palette.textSecondary, fontSize: 13, marginBottom: 10 }}>{errorMsg}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {!!lastPayload && (
                <TouchableOpacity onPress={() => onGenerate(lastPayload)} style={[styles.primaryBtn, { backgroundColor: theme.primary, flex: 1 }] }>
                  <Text style={[styles.primaryBtnText, { color: theme.onPrimary }]}>Retry Same Request</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={async () => {
                  try {
                    setPending(true)
                    setProgress(10)
                    setProgressMessage('Using Dash fallback...')
                    const text = await generate({
                      topic,
                      subject,
                      gradeLevel: Number(gradeLevel) || 3,
                      duration: Number(duration) || 45,
                      learningObjectives: (objectives || '').split(';').map(s => s.trim()).filter(Boolean),
                      language,
                      model: selectedModel,
                    })
                    setGenerated({
                      title: `${subject}: ${topic}`,
                      description: String(text || ''),
                      content: { sections: [] },
                      activities: []
                    })
                    setErrorMsg(null)
                    toast.success('Dash fallback succeeded')
                  } catch (err: any) {
                    toast.error(`Fallback failed: ${err?.message || 'Try again later'}`)
                  } finally {
                    setPending(false)
                    setProgress(0)
                    setProgressMessage('')
                  }
                }}
                style={[styles.primaryBtn, { backgroundColor: palette.outline, flex: 1 }]}
              >
                <Text style={[styles.primaryBtnText, { color: palette.text }]}>Try Dash Fallback</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Generated Content Display Section */}
        {generated?.description && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: theme.success, borderWidth: 2, marginTop: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={[styles.inlineAvatar, { backgroundColor: theme.success }]}>
                <Ionicons name="checkmark" size={16} color={theme.onPrimary} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.success, marginLeft: 8, marginBottom: 0 }]}>Lesson Generated Successfully!</Text>
            </View>
            
            <Text style={{ color: palette.textSecondary, marginBottom: 12, fontSize: 13 }}>
              Your AI-generated lesson is ready. Review the content below and save it to your lessons library.
            </Text>

            <View style={{ 
              backgroundColor: palette.background, 
              borderRadius: 8, 
              padding: 12,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: palette.outline,
              maxHeight: 300
            }}>
              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={true}>
                <Text style={{ 
                  color: palette.text, 
                  fontSize: 14, 
                  lineHeight: 20,
                  fontFamily: 'System' // Use monospace-like font for better readability
                }}>
                  {generated.description}
                </Text>
              </ScrollView>
            </View>

            {/* Action buttons for generated content */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity 
                style={[
                  styles.primaryBtn, 
                  { 
                    backgroundColor: theme.primary, 
                    flex: 1,
                    paddingVertical: 10
                  }
                ]} 
                onPress={onSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={theme.onPrimary} size="small" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="save-outline" size={16} color={theme.onPrimary} style={{ marginRight: 6 }} />
                    <Text style={[styles.primaryBtnText, { color: theme.onPrimary, fontSize: 13 }]}>
                      Save to Lessons
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.primaryBtn, 
                  { 
                    backgroundColor: 'transparent',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: palette.outline,
                    flex: 1,
                    paddingVertical: 10
                  }
                ]} 
                onPress={async () => {
                  try {
                    await Clipboard.setStringAsync(generated.description);
                    toast.success('Lesson content copied to clipboard!');
                  } catch (error) {
                    toast.error('Failed to copy to clipboard');
                  }
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="copy-outline" size={16} color={palette.text} style={{ marginRight: 6 }} />
                  <Text style={[styles.primaryBtnText, { color: palette.text, fontSize: 13 }]}>
                    Copy Text
                  </Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.primaryBtn, 
                  { 
                    backgroundColor: 'transparent',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: palette.outline,
                    paddingHorizontal: 10,
                    paddingVertical: 10
                  }
                ]} 
                onPress={() => {
                  setGenerated(null);
                  toast.info('Generated content cleared. You can generate a new lesson.');
                }}
              >
                <Ionicons name="refresh-outline" size={16} color={palette.text} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Loading State for Generation */}
        {(generating || pending) && (
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: theme.primary, borderWidth: 1, marginTop: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <ActivityIndicator color={theme.primary} style={{ marginRight: 12 }} />
              <Text style={[styles.cardTitle, { color: theme.primary, marginBottom: 0, flex: 1 }]}>Generating Your Lesson...</Text>
              <TouchableOpacity 
                style={[
                  styles.primaryBtn, 
                  { 
                    backgroundColor: 'transparent',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: '#EF4444',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    marginLeft: 8
                  }
                ]}
                onPress={onCancel}
              >
                <Text style={[styles.primaryBtnText, { color: '#EF4444', fontSize: 12 }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: palette.textSecondary, fontSize: 13 }}>
              AI is creating a customized lesson plan based on your parameters. This may take 10-30 seconds.
            </Text>
            {progress > 0 && (
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ color: palette.textSecondary, fontSize: 12 }}>{progressMessage}</Text>
                  <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>{Math.round(progress)}%</Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' }}>
                  <View style={{ width: `${progress}%`, height: 4, borderRadius: 2, backgroundColor: theme.primary }} />
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function QuotaBar({ feature, planLimit, color }: { feature: 'lesson_generation' | 'grading_assistance' | 'homework_help'; planLimit?: number; color: string }) {
  const [status, setStatus] = React.useState<{ used: number; limit: number; remaining: number } | null>(null)
  const [loading, setLoading] = React.useState(true)
  
  React.useEffect(() => {
    let mounted = true
    
    ;(async () => {
      try {
        console.log(`[QuotaBar] Loading quota status for ${feature}...`);
        setLoading(true)
        
        const s = await getQuotaStatus(feature)
        const limit = planLimit && planLimit > 0 ? planLimit : s.limit
        const remaining = Math.max(0, (limit === -1 ? 0 : limit) - s.used)
        
        console.log(`[QuotaBar] Quota status loaded for ${feature}:`, { used: s.used, limit, remaining });
        
        if (mounted) {
          setStatus({ used: s.used, limit, remaining })
          setLoading(false)
        }
      } catch (error) {
        console.error(`[QuotaBar] Error loading quota for ${feature}:`, error);
        // Provide fallback status instead of null
        if (mounted) {
          setStatus({ used: 0, limit: 5, remaining: 5 }) // Default free tier limits
          setLoading(false)
        }
      }
    })()
    
    return () => { mounted = false }
  }, [feature, planLimit])
  
  if (loading) {
    return (
      <View style={{ marginTop: 6 }}>
        <Text style={{ color: '#6B7280', fontSize: 12 }}>Loading quota...</Text>
      </View>
    )
  }
  
  if (!status) {
    return (
      <View style={{ marginTop: 6 }}>
        <Text style={{ color: '#EF4444', fontSize: 12 }}>Failed to load quota</Text>
      </View>
    )
  }
  
  if (status.limit === -1) {
    return <Text style={{ color: '#6B7280', marginTop: 4 }}>Quota: Unlimited</Text>
  }
  
  const used = status.used
  const limit = status.limit
  const remaining = Math.max(0, limit - used)
  const overBy = Math.max(0, used - limit)
  const pct = Math.max(0, Math.min(100, Math.round((Math.min(used, limit) / Math.max(1, limit)) * 100)))
  const barColor = overBy > 0 ? '#EF4444' : color
  
  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' }}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: barColor }} />
      </View>
      {overBy > 0 ? (
        <Text style={{ color: '#EF4444', marginTop: 4, fontSize: 12, fontWeight: '600' }}>
          Monthly limit reached · {used}/{limit} used ({overBy} over)
        </Text>
      ) : (
        <Text style={{ color: '#6B7280', marginTop: 4, fontSize: 12 }}>
          Quota: {used}/{limit} used · {remaining} remaining
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  contentPadding: { padding: 16 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'transparent' },
  primaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  primaryBtnText: { fontWeight: '700' },
  dashHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, marginTop: 16 },
  inlineAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  dashTitleText: { fontSize: 14, fontWeight: '700' },
  openWithDashBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  openWithDashText: { fontSize: 12, marginLeft: 6, fontWeight: '600' },
  fallbackChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  cancelButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6
  },
})
