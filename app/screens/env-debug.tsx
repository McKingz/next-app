import React from 'react'
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native'

const keyStatus = (label: string, value?: string) => {
  const present = !!value
  const preview = present ? `${value!.slice(0, 16)}…` : 'MISSING'
  return (
    <View style={styles.row} key={label}>
      <Text style={[styles.key, present ? styles.ok : styles.missing]}>{label}</Text>
      <Text style={styles.val}>{preview}</Text>
    </View>
  )
}

export default function EnvDebugScreen() {
  const env = process.env || ({} as Record<string, string>)
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Environment Debug</Text>
      <Text style={styles.desc}>These are client-side EXPO_PUBLIC_* variables embedded in the bundle.</Text>

      {keyStatus('EXPO_PUBLIC_SUPABASE_URL', env.EXPO_PUBLIC_SUPABASE_URL)}
      {keyStatus('EXPO_PUBLIC_SUPABASE_ANON_KEY', env.EXPO_PUBLIC_SUPABASE_ANON_KEY)}
      {keyStatus('EXPO_PUBLIC_API_BASE', env.EXPO_PUBLIC_API_BASE)}

      <View style={styles.hintBox}>
        <Text style={styles.hintTitle}>Fix tips</Text>
        <Text style={styles.hint}>1) Create .env in the project root (copy from .env.template)</Text>
        <Text style={styles.hint}>2) Restart dev server: npx expo start --clear</Text>
        <Text style={styles.hint}>3) On web, only EXPO_PUBLIC_* vars are exposed</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  desc: {
    opacity: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
  },
  key: {
    fontWeight: '600',
  },
  ok: { color: '#059669' },
  missing: { color: '#DC2626' },
  val: {
    fontFamily: Platform?.OS === 'web' ? 'monospace' : undefined,
    opacity: 0.8,
  },
  hintBox: {
    marginTop: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)'
  },
  hintTitle: { fontWeight: '700', marginBottom: 4 },
  hint: { opacity: 0.9 },
})
