import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react'
import { getFeatureFlags, getFeatureFlagsSync, FeatureFlags } from '../lib/featureFlags'
import { useAuth } from '../contexts/AuthContext'

export function useFeatureFlags() {
  const { user } = useAuth()
  const [flags, setFlags] = useState<FeatureFlags>(getFeatureFlagsSync())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user?.id) {
      // Use sync flags for unauthenticated users
      setFlags(getFeatureFlagsSync())
      return
    }

    // Fetch fresh flags for authenticated users
    const fetchFlags = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const freshFlags = await getFeatureFlags(user.id)
        setFlags(freshFlags)
      } catch (err) {
        logger.warn('Failed to fetch feature flags:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
        // Fall back to sync flags on error
        setFlags(getFeatureFlagsSync())
      } finally {
        setIsLoading(false)
      }
    }

    fetchFlags()
  }, [user?.id])

  // Helper function to check if a feature is enabled
  const isEnabled = (flagName: keyof FeatureFlags): boolean => {
    return flags[flagName] === true
  }

  // Helper function to get flag value
  const getFlag = (flagName: keyof FeatureFlags) => {
    return flags[flagName]
  }

  return {
    flags,
    isLoading,
    error,
    isEnabled,
    getFlag,
  }
}