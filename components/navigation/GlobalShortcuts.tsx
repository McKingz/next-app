import React, { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/contexts/AuthContext'
import { DashCommandPalette } from '@/components/ai/DashCommandPalette'

/**
 * Global keyboard shortcuts (web only) + Command Palette
 * - Cmd/Ctrl+K open palette
 * - Esc close palette
 * - Two-key sequences: g + {l,s,c,a,d,p,f,h,t,u,q}
 *   - g d is role-aware (teacher/principal/parent)
 *   - g q routes based on role (super_admin -> super-admin quotas; else -> admin allocation)
 */
export default function GlobalShortcuts() {
  const { profile } = useAuth()
  const [showPalette, setShowPalette] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') return

    // Verify DOM APIs exist before using them (React Native compatibility)
    if (
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function' ||
      typeof window.removeEventListener !== 'function'
    ) {
      return undefined;
    }

    const seqRef = { lastKey: '', lastTime: 0 } as { lastKey: string; lastTime: number }

    const handler = (e: any) => {
      const key = e.key
      const lower = key?.toLowerCase?.() || ''

      // Esc closes
      if (key === 'Escape' && showPalette) {
        e.preventDefault()
        setShowPalette(false)
        return
      }

      // Cmd/Ctrl+K opens
      if ((e.metaKey || e.ctrlKey) && lower === 'k') {
        // Ignore if typing in inputs
        const t = e.target as HTMLElement | null
        const tag = (t && t.tagName) ? t.tagName.toLowerCase() : ''
        const editing = tag === 'input' || tag === 'textarea' || (t && (t as any).isContentEditable)
        if (editing) return
        e.preventDefault()
        setShowPalette(true)
        return
      }

      // Two-key sequences within 800ms
      const now = Date.now()
      const within = now - seqRef.lastTime < 800
      if (seqRef.lastKey === 'g' && within) {
        const role = String(profile?.role || '').toLowerCase()
        // role-aware defaults
        const dashboardRoute = role === 'principal' || role === 'principal_admin'
          ? '/screens/principal-dashboard'
          : role === 'parent'
            ? '/screens/parent-dashboard'
            : '/screens/teacher-dashboard'

        // quotas route per role
        const quotasRoute = role === 'super_admin'
          ? '/screens/super-admin-ai-quotas'
          : '/screens/admin-ai-allocation'

        const map: Record<string, string> = {
          'l': '/screens/lessons-hub',
          's': '/screens/lessons-search',
          'c': '/screens/lessons-categories',
          'a': '/screens/dash-assistant',
          'd': dashboardRoute,
          'p': '/screens/principal-dashboard',
          'f': '/screens/financial-dashboard',
          'h': '/screens/dash-conversations-history',
          't': '/screens/teachers-detail',
          'u': '/screens/students-detail',
          'q': quotasRoute,
        }
        const route = map[lower]
        if (route) {
          e.preventDefault()
          seqRef.lastKey = ''
          seqRef.lastTime = 0
          try { router.push(route as any) } catch { /* Intentional: non-fatal */ }
          return
        }
      }

      // Update sequence start
      seqRef.lastKey = lower
      seqRef.lastTime = now
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [profile?.role, showPalette])

  return (
    <DashCommandPalette visible={showPalette} onClose={() => setShowPalette(false)} />
  )
}
