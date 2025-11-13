import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { queryKeys } from '../../lib/query/queryClient'
import { useTheme } from '../../contexts/ThemeContext'

export const OfflineBanner: React.FC = () => {
  const { theme } = useTheme()
  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => {
      // Mock sync status for demo - replace with actual implementation
      return {
        isOnline: navigator?.onLine ?? true,
        isSyncing: false,
        queueCount: 0,
        failedItemsCount: 0,
        lastSyncTime: new Date(),
      }
    },
    refetchInterval: 5 * 1000, // Refresh every 5 seconds
    staleTime: 1000, // Always fresh
  })

  if (!syncStatus) return null

  // Don't show banner if everything is normal
  if (syncStatus.isOnline && !syncStatus.isSyncing && syncStatus.queueCount === 0) {
    return null
  }

  const handleRefresh = () => {
    if (syncStatus?.isOnline) {
      // Mock refresh - replace with actual implementation
      console.log('Refreshing data...')
    }
  }

  const getStatusText = () => {
    if (!syncStatus.isOnline) {
      if (syncStatus.queueCount > 0) {
        return `Offline • ${syncStatus.queueCount} items queued for sync`
      }
      return 'Offline • Working from cached data'
    }

    if (syncStatus.isSyncing) {
      return 'Syncing your data...'
    }

    if (syncStatus.queueCount > 0) {
      return `${syncStatus.queueCount} items waiting to sync`
    }

    if (syncStatus.failedItemsCount > 0) {
      return `${syncStatus.failedItemsCount} items failed to sync`
    }

    return 'Connected'
  }

  const getStatusColor = () => {
    if (!syncStatus.isOnline) return '#FF6B35' // Orange for offline
    if (syncStatus.failedItemsCount > 0) return '#FF4757' // Red for errors
    if (syncStatus.queueCount > 0) return '#FFA726' // Amber for pending
    return '#4CAF50' // Green for success
  }

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return 'cloud-offline-outline'
    if (syncStatus.isSyncing) return null // Will show spinner
    if (syncStatus.failedItemsCount > 0) return 'alert-circle-outline'
    if (syncStatus.queueCount > 0) return 'sync-outline'
    return 'cloud-done-outline'
  }

  const styles = StyleSheet.create({
    banner: {
      backgroundColor: getStatusColor(),
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    leftContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      marginRight: 8,
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '500',
      flex: 1,
    },
    rightContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    lastSyncText: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: 12,
      marginRight: 12,
    },
    refreshButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    refreshButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    disabledButton: {
      opacity: 0.5,
    },
  })

  const formatLastSyncTime = (lastSyncTime?: Date) => {
    if (!lastSyncTime) return 'Never synced'

    const now = new Date()
    const diff = now.getTime() - lastSyncTime.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'Just synced'
    if (minutes < 60) return `${minutes}m ago`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <View style={styles.banner}>
      <View style={styles.leftContent}>
        <View style={styles.iconContainer}>
          {syncStatus.isSyncing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            getStatusIcon() && (
              <Ionicons
                name={getStatusIcon() as any}
                size={16}
                color="#FFFFFF"
              />
            )
          )}
        </View>
        <Text style={styles.statusText} numberOfLines={1}>
          {getStatusText()}
        </Text>
      </View>

      <View style={styles.rightContent}>
        {syncStatus.lastSyncTime && (
          <Text style={styles.lastSyncText}>
            {formatLastSyncTime(syncStatus.lastSyncTime)}
          </Text>
        )}
        
        {syncStatus.isOnline && (
          <TouchableOpacity
            style={[
              styles.refreshButton,
              syncStatus.isSyncing && styles.disabledButton,
            ]}
            onPress={handleRefresh}
            disabled={syncStatus.isSyncing}
            accessibilityLabel="Refresh data"
            accessibilityHint="Manually sync your data with the server"
          >
            <Text style={styles.refreshButtonText}>
              {syncStatus.isSyncing ? 'Syncing...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

export default OfflineBanner