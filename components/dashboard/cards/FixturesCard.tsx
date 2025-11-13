import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DashboardCard } from './DashboardCard';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';

export function FixturesCard() {
  const { theme } = useTheme();

  // TODO: Replace with real fixtures data
  const fixtures = [
    {
      opponent: 'Springfield FC',
      date: 'Sat, May 18',
      time: '3:00 PM',
      venue: 'Home',
      status: 'upcoming',
    },
    {
      opponent: 'Riverside United',
      date: 'Sat, May 25',
      time: '11:00 AM',
      venue: 'Away',
      status: 'upcoming',
    },
  ];

  return (
    <DashboardCard title="Upcoming Fixtures" icon="trophy-outline">
      <View style={styles.list}>
        {fixtures.map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.item,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <View style={styles.header}>
              <ThemedText style={styles.opponent}>{item.opponent}</ThemedText>
              <View
                style={[
                  styles.venueBadge,
                  {
                    backgroundColor:
                      item.venue === 'Home'
                        ? theme.colors.success || '#10b981'
                        : theme.colors.info || '#3b82f6',
                  },
                ]}
              >
                <ThemedText style={styles.venueText}>{item.venue}</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.datetime}>
              {item.date} • {item.time}
            </ThemedText>
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
    padding: 12,
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  opponent: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  venueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  venueText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  datetime: {
    fontSize: 12,
    opacity: 0.6,
  },
});
