import React from 'react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Create persister for React Query cache
const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'EDUDASH_QUERY_CACHE',
  throttleTime: 1000,
})

// Query client configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - refetch when data is stale
      gcTime: 10 * 60 * 1000,   // 10 minutes - keep in cache for quick nav
      retry: (failureCount, error: any) => {
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }
        return failureCount < 3
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'always',
      refetchOnMount: true,      // Always check for fresh data on component mount
      refetchOnWindowFocus: false, // Disable for mobile (not applicable)
    },
    mutations: {
      retry: (failureCount, error: any) => {
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }
        return failureCount < 2
      },
      networkMode: 'online',
    },
  },
})

// Query keys for consistent caching
export const queryKeys = {
  students: ['students'] as const,
  student: (studentId: string) => ['students', studentId] as const,
  assignments: ['assignments'] as const,
  submissions: (studentId?: string) => 
    studentId ? ['submissions', studentId] : ['submissions'] as const,
  messageThreads: ['message-threads'] as const,
  messages: (threadId: string) => ['message-threads', threadId, 'messages'] as const,
  announcements: ['announcements'] as const,
  whatsappContacts: ['whatsapp-contacts'] as const,
  profile: ['profile'] as const,
  preschool: ['preschool'] as const,
} as const

// Provider configuration for app root
export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 30 * 60 * 1000, // 30 minutes persistence (reduced from 24 hours)
        buster: 'edudash-v1.1.0', // Bump to invalidate old cache
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}

export default queryClient
