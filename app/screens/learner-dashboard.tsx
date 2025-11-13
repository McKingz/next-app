import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';

export default function LearnerDashboard() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Learner Dashboard' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Welcome to your Learning Space</Text>
        <Text style={styles.subheading}>Your courses, progress, and certificates will appear here.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  content: { padding: 16 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  subheading: { color: '#9CA3AF' },
});
