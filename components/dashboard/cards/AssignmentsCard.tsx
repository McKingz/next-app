import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DashboardCard } from './DashboardCard';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTerm } from '@/contexts/TerminologyContext';
import { useTheme } from '@/contexts/ThemeContext';

export function AssignmentsCard() {
  const taskTerm = useTerm('task'); // "Assignment" / "Task" / "Project"
  const { theme } = useTheme();

  // TODO: Replace with real assignments data
  const assignments = [
    { title: 'Math Problem Set 5', dueDate: 'Due Tomorrow', status: 'pending' },
    { title: 'Science Lab Report', dueDate: 'Due in 3 days', status: 'in_progress' },
    { title: 'History Essay', dueDate: 'Due next week', status: 'pending' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return theme.colors.warning || '#f59e0b';
      case 'in_progress':
        return theme.colors.info || '#3b82f6';
      case 'completed':
        return theme.colors.success || '#10b981';
      default:
        return theme.colors.text;
    }
  };

  return (
    <DashboardCard title={`My ${taskTerm}s`} icon="document-text-outline">
      <View style={styles.list}>
        {assignments.map((item, idx) => (
          <View
            key={idx}
            style={[styles.item, { borderLeftColor: getStatusColor(item.status) }]}
          >
            <ThemedText style={styles.title}>{item.title}</ThemedText>
            <ThemedText style={styles.dueDate}>{item.dueDate}</ThemedText>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  item: {
    paddingLeft: 12,
    paddingVertical: 8,
    borderLeftWidth: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  dueDate: {
    fontSize: 12,
    opacity: 0.6,
  },
});
