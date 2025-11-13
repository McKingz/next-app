import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DashboardCard } from './DashboardCard';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTerm } from '@/contexts/TerminologyContext';
import { useTheme } from '@/contexts/ThemeContext';

export function ScheduleCard() {
  const sessionTerm = useTerm('session'); // "Class" / "Training" / "Match" etc
  const { theme } = useTheme();

  // TODO: Replace with real schedule data
  const scheduleItems = [
    { time: '09:00 AM', title: `Math ${sessionTerm}`, location: 'Room 101' },
    { time: '11:00 AM', title: `Science ${sessionTerm}`, location: 'Lab 2' },
    { time: '02:00 PM', title: `PE ${sessionTerm}`, location: 'Gymnasium' },
  ];

  return (
    <DashboardCard title="Today's Schedule" icon="calendar-outline">
      <View style={styles.list}>
        {scheduleItems.map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.item,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <ThemedText style={styles.time}>{item.time}</ThemedText>
            <View style={styles.details}>
              <ThemedText style={styles.title}>{item.title}</ThemedText>
              <ThemedText style={styles.location}>{item.location}</ThemedText>
            </View>
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
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  time: {
    fontSize: 13,
    fontWeight: '600',
    width: 80,
  },
  details: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  location: {
    fontSize: 12,
    opacity: 0.6,
  },
});
