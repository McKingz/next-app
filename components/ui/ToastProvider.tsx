import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Animated, Easing, Platform, ToastAndroid, StyleSheet } from 'react-native'

export type ToastType = 'info' | 'success' | 'warn' | 'error'
export type ToastInput = { message: string; type?: ToastType; durationMs?: number }

const ToastContext = createContext<{
  show: (input: ToastInput) => void
} | null>(null)

let globalShow: ((input: ToastInput) => void) | null = null

export const toast = {
  show: (message: string, opts: Partial<ToastInput> = {}) => globalShow?.({ message, ...opts }),
  info: (message: string, durationMs = 2500) => globalShow?.({ message, type: 'info', durationMs }),
  success: (message: string, durationMs = 2500) => globalShow?.({ message, type: 'success', durationMs }),
  warn: (message: string, durationMs = 3000) => {
    if (Platform.OS === 'android') {
      try { ToastAndroid.show(message, ToastAndroid.SHORT) } catch { /* Intentional: non-fatal */ }
    }
    globalShow?.({ message, type: 'warn', durationMs })
  },
  error: (message: string, durationMs = 3500) => globalShow?.({ message, type: 'error', durationMs }),
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Array<ToastInput & { id: string }>>([])

  const show = (input: ToastInput) => {
    const item = { id: String(Date.now() + Math.random()), type: 'info' as ToastType, durationMs: 2500, ...input }
    setQueue((q) => [...q, item])
  }

  useEffect(() => { globalShow = show; return () => { globalShow = null } }, [])

  useEffect(() => {
    if (queue.length === 0) return
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), queue[0].durationMs)
    return () => clearTimeout(timer)
  }, [queue])

  const theme = {
    bg: {
      info: '#374151',
      success: '#065f46',
      warn: '#92400e',
      error: '#7f1d1d',
    },
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View pointerEvents="none" style={styles.host}>
        {queue.map((t) => (
          <View key={t.id} style={[styles.toast, { backgroundColor: theme.bg[t.type || 'info'] }]}>
            <Text style={styles.text}>{t.message}</Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  )
}

const styles = StyleSheet.create({
  host: { position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' },
  toast: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, maxWidth: '90%' },
  text: { color: '#fff', fontSize: 13 }
})