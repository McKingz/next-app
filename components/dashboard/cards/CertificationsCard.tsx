import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DashboardCard } from './DashboardCard';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';

export function CertificationsCard() {
  const { theme } = useTheme();

  // TODO: Replace with real certifications data
  const certifications = [
    {
      name: 'Project Management Professional',
      progress: 75,
      status: 'in_progress',
      dueDate: '2 weeks left',
    },
    {
      name: 'AWS Cloud Practitioner',
      progress: 100,
      status: 'completed',
      completedDate: 'Completed May 1',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return theme.colors.success || '#10b981';
      case 'in_progress':
        return theme.colors.info || '#3b82f6';
      case 'not_started':
        return theme.colors.text;
      default:
        return theme.colors.text;
    }
  };

  return (
    <DashboardCard title="Certifications" icon="ribbon-outline">
      <View style={styles.list}>
        {certifications.map((item, idx) => (
          <View key={idx} style={styles.item}>
            <View style={styles.header}>
              <ThemedText style={styles.name}>{item.name}</ThemedText>
              <ThemedText style={[styles.progress, { color: getStatusColor(item.status) }]}>
                {item.progress}%
              </ThemedText>
            </View>
            <View
              style={[
                styles.progressBar,
                { backgroundColor: theme.colors.border },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${item.progress}%`,
                    backgroundColor: getStatusColor(item.status),
                  },
                ]}
              />
            </View>
            <ThemedText style={styles.statusText}>
              {item.status === 'completed' ? item.completedDate : item.dueDate}
            </ThemedText>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 16,
  },
  item: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  progress: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    opacity: 0.6,
  },
});
