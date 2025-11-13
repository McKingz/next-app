import React from 'react'
import { View, StyleSheet, SafeAreaView } from 'react-native'
import { WhatsAppIntegrationDemo } from '../../components/whatsapp/WhatsAppIntegrationDemo'
import { useTheme } from '../../contexts/ThemeContext'

export default function WhatsAppDemoScreen() {
  const { theme } = useTheme()

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
  })

  return (
    <SafeAreaView style={styles.container}>
      <WhatsAppIntegrationDemo />
    </SafeAreaView>
  )
}