import React from 'react'
import { Stack } from 'expo-router'
import ThemedStatusBar from '@/components/ui/ThemedStatusBar'
import { View, StyleSheet } from 'react-native'

import AllocationManagementScreen from '@/components/ai/AllocationManagementScreen'
import { RoleBasedHeader } from '@/components/RoleBasedHeader'
import { navigateBack } from '@/lib/navigation'
import { useTheme } from '@/contexts/ThemeContext'

export default function AdminAIAllocationScreen() {
  const { theme, isDark } = useTheme();
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedStatusBar />
      
      <RoleBasedHeader
        title="AI Quota Management"
        onBackPress={() => navigateBack()}
      />
      
      <AllocationManagementScreen />
    </View>
  )
}
