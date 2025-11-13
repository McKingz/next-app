/**
 * Usage Sync Hook
 * 
 * Handles synchronization of local usage data to server on app startup
 * Prevents cross-device quota inconsistencies by ensuring server is authoritative
 * 
 * Usage:
 * ```tsx
 * import { useUsageSync } from '@/lib/ai/hooks/useUsageSync'
 * 
 * function App() {
 *   useUsageSync() // Call in your main app component
 *   // ... rest of your app
 * }
 * ```
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { syncLocalUsageToServer, flushUsageLogQueue } from '../usage'

export function useUsageSync() {
  const { session, loading } = useAuth()
  const hasRunSync = useRef(false)

  useEffect(() => {
    // Only run sync once per app session when user is authenticated
    if (loading || !session?.user || hasRunSync.current) {
      return
    }

    const performSync = async () => {
      try {
        console.log('[Usage Sync] Starting app startup sync...')
        
        // Sync any pending local usage to server
        await syncLocalUsageToServer()
        
        // Set up periodic queue flushing for reliability
        const flushInterval = setInterval(async () => {
          try {
            await flushUsageLogQueue()
          } catch (error) {
            console.warn('[Usage Sync] Periodic flush failed:', error)
          }
        }, 30000) // Every 30 seconds
        
        // Clean up interval on app unmount
        return () => {
          clearInterval(flushInterval)
        }
        
      } catch (error) {
        console.error('[Usage Sync] App startup sync failed:', error)
      }
    }

    // Mark as run to prevent duplicate syncs
    hasRunSync.current = true
    
    // Perform sync with a small delay to let auth settle
    const timeoutId = setTimeout(performSync, 1000)
    
    return () => {
      clearTimeout(timeoutId)
    }
    
  }, [session?.user, loading])
}

/**
 * Alternative function-based approach for non-React contexts
 * Call this in your app's main initialization logic
 */
export async function initializeUsageSync(): Promise<void> {
  try {
    console.log('[Usage Sync] Initializing usage sync...')
    await syncLocalUsageToServer()
    
    // Set up background queue flushing
    const startPeriodicFlush = () => {
      setInterval(async () => {
        try {
          await flushUsageLogQueue()
        } catch (error) {
          console.warn('[Usage Sync] Background flush failed:', error)
        }
      }, 30000)
    }
    
    // Start after a short delay
    setTimeout(startPeriodicFlush, 5000)
    
  } catch (error) {
    console.error('[Usage Sync] Initialization failed:', error)
  }
}